import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// PIPELINE MONITOR AGENT
// Monitors the full data pipeline for failures
// HubSpot → Health Scores → Interventions → CAPI
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Environment variable validation
function validateEnvVars(): void {
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter(key => !Deno.env.get(key));

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

validateEnvVars();

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface PipelineStage {
  name: string;
  status: "healthy" | "warning" | "failing";
  last_run: string | null;
  records_processed: number;
  records_failed: number;
  bottleneck: boolean;
  issues: string[];
}

interface PipelineReport {
  timestamp: string;
  overall_health: number;
  stages: PipelineStage[];
  bottlenecks: string[];
  failures: string[];
  recommendations: string[];
}

// Timeout wrapper for async operations
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, name: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

async function checkDataIngestion(): Promise<PipelineStage> {
  const issues: string[] = [];
  let processedCount = 0;
  let failedCount = 0;
  let webhookCount = 0;
  let lastRun: string | null = null;

  // Check webhook logs for recent activity
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  try {
    const { data: webhooks, count, error } = await supabase
      .from("webhook_logs")
      .select("*", { count: "exact" })
      .gte("created_at", hourAgo);

    if (error) throw error;

    webhookCount = count || 0;
    processedCount = (webhooks || []).filter(w => w.processed).length;
    failedCount = (webhooks || []).filter(w => w.error).length;
    lastRun = webhooks?.[0]?.created_at || null;

    if (webhookCount === 0) {
      issues.push("No webhook activity in the last hour");
    }
    if (failedCount > 0) {
      issues.push(`${failedCount} webhooks failed to process`);
    }
  } catch (e) {
    issues.push(`Webhook logs check failed: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  // Check lead events
  try {
    const { count: leadCount, error } = await supabase
      .from("lead_events")
      .select("*", { count: "exact", head: true })
      .gte("received_at", hourAgo);

    if (error) throw error;
  } catch (e) {
    issues.push(`Lead events check failed: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  return {
    name: "Data Ingestion (Webhooks/Leads)",
    status: failedCount > 5 ? "failing" : failedCount > 0 || issues.length > 0 ? "warning" : "healthy",
    last_run: lastRun,
    records_processed: processedCount,
    records_failed: failedCount,
    bottleneck: false,
    issues
  };
}

async function checkHealthCalculation(): Promise<PipelineStage> {
  const issues: string[] = [];
  let lastCalc: string | null = null;
  let hoursSinceCalc = 999;
  let nullScores = 0;
  let total = 0;

  // Check when health scores were last calculated
  try {
    const { data: latestScores, error } = await supabase
      .from("client_health_scores")
      .select("calculated_at")
      .order("calculated_at", { ascending: false })
      .limit(1);

    if (error) throw error;

    lastCalc = latestScores?.[0]?.calculated_at || null;
    hoursSinceCalc = lastCalc
      ? (Date.now() - new Date(lastCalc).getTime()) / (1000 * 60 * 60)
      : 999;

    if (hoursSinceCalc > 24) {
      issues.push(`Health scores not calculated in ${Math.round(hoursSinceCalc)} hours`);
    }
  } catch (e) {
    issues.push(`Health scores timestamp check failed: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  // Check for calculation errors
  try {
    const { count, error } = await supabase
      .from("client_health_scores")
      .select("*", { count: "exact", head: true })
      .is("health_score", null);

    if (error) throw error;

    nullScores = count || 0;
    if (nullScores > 0) {
      issues.push(`${nullScores} clients with null health scores`);
    }
  } catch (e) {
    issues.push(`Null scores check failed: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  // Check for zone distribution sanity
  try {
    const { data: zoneCounts, error } = await supabase
      .from("client_health_scores")
      .select("health_zone")
      .not("health_zone", "is", null);

    if (error) throw error;

    const zones = { RED: 0, YELLOW: 0, GREEN: 0, PURPLE: 0 };
    (zoneCounts || []).forEach(c => {
      if (c.health_zone in zones) {
        zones[c.health_zone as keyof typeof zones]++;
      }
    });

    total = Object.values(zones).reduce((a, b) => a + b, 0);
    const redPct = total > 0 ? (zones.RED / total) * 100 : 0;

    if (redPct > 30) {
      issues.push(`Unusually high RED zone: ${Math.round(redPct)}%`);
    }
  } catch (e) {
    issues.push(`Zone distribution check failed: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  return {
    name: "Health Score Calculation",
    status: hoursSinceCalc > 48 ? "failing" : hoursSinceCalc > 24 || issues.length > 1 ? "warning" : "healthy",
    last_run: lastCalc,
    records_processed: total,
    records_failed: nullScores,
    bottleneck: hoursSinceCalc > 24,
    issues
  };
}

async function checkInterventionPipeline(): Promise<PipelineStage> {
  const issues: string[] = [];
  let totalCount = 0;
  let criticalPending = 0;
  let staleCount = 0;
  let lastRun: string | null = null;

  // Check intervention generation
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data: recentInterventions, count, error } = await supabase
      .from("intervention_log")
      .select("status, priority, triggered_at", { count: "exact" })
      .gte("triggered_at", dayAgo);

    if (error) throw error;

    totalCount = count || 0;
    const pendingCount = (recentInterventions || []).filter(i => i.status === "PENDING").length;
    criticalPending = (recentInterventions || []).filter(i =>
      i.status === "PENDING" && i.priority === "CRITICAL"
    ).length;
    lastRun = recentInterventions?.[0]?.triggered_at || null;

    if (criticalPending > 0) {
      issues.push(`${criticalPending} CRITICAL interventions pending action`);
    }
  } catch (e) {
    issues.push(`Recent interventions check failed: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  // Check for stale interventions
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("intervention_log")
      .select("*", { count: "exact", head: true })
      .eq("status", "PENDING")
      .lt("triggered_at", weekAgo);

    if (error) throw error;

    staleCount = count || 0;
    if (staleCount > 10) {
      issues.push(`${staleCount} interventions stale for 7+ days`);
    }
  } catch (e) {
    issues.push(`Stale interventions check failed: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  return {
    name: "Intervention Pipeline",
    status: criticalPending > 0 ? "failing" : staleCount > 10 || issues.length > 0 ? "warning" : "healthy",
    last_run: lastRun,
    records_processed: totalCount,
    records_failed: staleCount,
    bottleneck: criticalPending > 0,
    issues
  };
}

async function checkCAPIPipeline(): Promise<PipelineStage> {
  const issues: string[] = [];
  let sent = 0;
  let failed = 0;
  let pending = 0;
  let failedBatches = 0;
  let lastRun: string | null = null;

  // Check CAPI event processing
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data: recentEvents, error } = await supabase
      .from("capi_events_enriched")
      .select("send_status, created_at")
      .gte("created_at", dayAgo);

    if (error) throw error;

    const total = recentEvents?.length || 0;
    sent = (recentEvents || []).filter(e => e.send_status === "sent").length;
    failed = (recentEvents || []).filter(e => e.send_status === "failed").length;
    pending = (recentEvents || []).filter(e => e.send_status === "pending").length;

    const successRate = (sent + failed) > 0 ? (sent / (sent + failed)) * 100 : 100;

    if (successRate < 80) {
      issues.push(`Low CAPI success rate: ${Math.round(successRate)}%`);
    }
    if (pending > 50) {
      issues.push(`${pending} events pending in queue`);
    }
    if (failed > 10) {
      issues.push(`${failed} events failed to send`);
    }
  } catch (e) {
    issues.push(`CAPI events check failed: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  // Check batch jobs
  try {
    const { data: recentBatches, error } = await supabase
      .from("batch_jobs")
      .select("*")
      .gte("created_at", dayAgo)
      .order("created_at", { ascending: false });

    if (error) throw error;

    failedBatches = (recentBatches || []).filter(b => b.status === "failed").length;
    lastRun = recentBatches?.[0]?.completed_at || null;

    if (failedBatches > 0) {
      issues.push(`${failedBatches} batch jobs failed`);
    }
  } catch (e) {
    issues.push(`Batch jobs check failed: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  const successRate = (sent + failed) > 0 ? (sent / (sent + failed)) * 100 : 100;

  return {
    name: "CAPI Event Delivery",
    status: successRate < 50 || failedBatches > 2 ? "failing" :
            successRate < 80 || pending > 50 || issues.length > 0 ? "warning" : "healthy",
    last_run: lastRun,
    records_processed: sent,
    records_failed: failed,
    bottleneck: pending > 100,
    issues
  };
}

async function checkDailySummary(): Promise<PipelineStage> {
  const issues: string[] = [];
  let lastRun: string | null = null;
  let recordsProcessed = 0;

  // Check if daily summary is being generated
  try {
    const { data: summaries, error } = await supabase
      .from("daily_summary")
      .select("*")
      .order("summary_date", { ascending: false })
      .limit(7);

    if (error) throw error;

    if (!summaries || summaries.length === 0) {
      issues.push("No daily summaries found");
    } else {
      recordsProcessed = summaries.length;
      lastRun = summaries[0]?.generated_at || null;

      const today = new Date().toISOString().split("T")[0];
      const hasToday = summaries.some(s => s.summary_date === today);

      if (!hasToday) {
        issues.push("Today's summary not yet generated");
      }

      // Check for gaps
      const dates = summaries.map(s => s.summary_date);
      for (let i = 1; i < dates.length; i++) {
        const diff = new Date(dates[i - 1]).getTime() - new Date(dates[i]).getTime();
        if (diff > 2 * 24 * 60 * 60 * 1000) {
          issues.push("Gap detected in daily summaries");
          break;
        }
      }
    }
  } catch (e) {
    issues.push(`Daily summary check failed: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  return {
    name: "Daily Summary Generation",
    status: issues.length > 1 ? "failing" : issues.length > 0 ? "warning" : "healthy",
    last_run: lastRun,
    records_processed: recordsProcessed,
    records_failed: 0,
    bottleneck: false,
    issues
  };
}

function generateRecommendations(stages: PipelineStage[]): string[] {
  const recommendations: string[] = [];

  const failingStages = stages.filter(s => s.status === "failing");
  const bottlenecks = stages.filter(s => s.bottleneck);

  if (failingStages.length > 0) {
    recommendations.push(`URGENT: Fix ${failingStages.map(s => s.name).join(", ")}`);
  }

  if (bottlenecks.length > 0) {
    recommendations.push(`Clear bottleneck at: ${bottlenecks.map(s => s.name).join(", ")}`);
  }

  // Specific recommendations
  for (const stage of stages) {
    if (stage.name.includes("Health Score") && stage.status !== "healthy") {
      recommendations.push("Run health-calculator agent to refresh scores");
    }
    if (stage.name.includes("CAPI") && stage.status !== "healthy") {
      recommendations.push("Run capi-validator then process-capi-batch");
    }
    if (stage.name.includes("Intervention") && stage.bottleneck) {
      recommendations.push("Action critical interventions immediately");
    }
  }

  return recommendations;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log("[Pipeline Monitor] Checking pipeline health...");

    // Wrapper to handle individual check failures gracefully
    const checkWithFallback = async (checkFn: () => Promise<PipelineStage>, name: string): Promise<PipelineStage> => {
      try {
        // Add 10 second timeout for each check
        return await withTimeout(checkFn(), 10000, name);
      } catch (e) {
        console.error(`Error in ${name}:`, e);
        return {
          name,
          status: "failing",
          last_run: null,
          records_processed: 0,
          records_failed: 0,
          bottleneck: false,
          issues: [`Check failed: ${e instanceof Error ? e.message : "Unknown error"}`]
        };
      }
    };

    // Run all stage checks with individual error handling
    const [ingestion, healthCalc, interventions, capi, summary] = await Promise.all([
      checkWithFallback(checkDataIngestion, "Data Ingestion"),
      checkWithFallback(checkHealthCalculation, "Health Calculation"),
      checkWithFallback(checkInterventionPipeline, "Interventions"),
      checkWithFallback(checkCAPIPipeline, "CAPI"),
      checkWithFallback(checkDailySummary, "Daily Summary")
    ]);

    const stages = [ingestion, healthCalc, interventions, capi, summary];

    // Calculate overall health
    const stageWeights = { healthy: 100, warning: 60, failing: 0 };
    const totalHealth = stages.reduce((sum, s) => sum + stageWeights[s.status], 0) / stages.length;

    // Collect all issues
    const bottlenecks = stages.filter(s => s.bottleneck).map(s => s.name);
    const failures = stages
      .filter(s => s.status === "failing")
      .flatMap(s => s.issues);

    const report: PipelineReport = {
      timestamp: new Date().toISOString(),
      overall_health: Math.round(totalHealth),
      stages,
      bottlenecks,
      failures,
      recommendations: generateRecommendations(stages)
    };

    // Log pipeline check
    try {
      await supabase.from("sync_logs").insert({
        platform: "pipeline_monitor",
        sync_type: "pipeline_check",
        status: totalHealth >= 80 ? "success" : totalHealth >= 50 ? "completed_with_errors" : "error",
        records_processed: stages.length,
        records_failed: stages.filter(s => s.status === "failing").length,
        error_details: { bottlenecks, failures },
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      });
    } catch (logError) {
      console.error("[Pipeline Monitor] Failed to log to sync_logs:", logError);
      // Continue execution even if logging fails
    }

    const duration = Date.now() - startTime;
    console.log(`[Pipeline Monitor] Complete in ${duration}ms - Health: ${report.overall_health}%`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error("[Pipeline Monitor] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
