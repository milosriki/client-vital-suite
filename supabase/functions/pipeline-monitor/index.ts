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

async function checkDataIngestion(): Promise<PipelineStage> {
  const issues: string[] = [];

  // Check webhook logs for recent activity
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: webhooks, count: webhookCount } = await supabase
    .from("webhook_logs")
    .select("*", { count: "exact" })
    .gte("created_at", hourAgo);

  const processedCount = (webhooks || []).filter(w => w.processed).length;
  const failedCount = (webhooks || []).filter(w => w.error).length;

  if (webhookCount === 0) {
    issues.push("No webhook activity in the last hour");
  }
  if (failedCount > 0) {
    issues.push(`${failedCount} webhooks failed to process`);
  }

  // Check lead events
  const { count: leadCount } = await supabase
    .from("lead_events")
    .select("*", { count: "exact", head: true })
    .gte("received_at", hourAgo);

  return {
    name: "Data Ingestion (Webhooks/Leads)",
    status: failedCount > 5 ? "failing" : failedCount > 0 ? "warning" : "healthy",
    last_run: webhooks?.[0]?.created_at || null,
    records_processed: processedCount,
    records_failed: failedCount,
    bottleneck: false,
    issues
  };
}

async function checkHealthCalculation(): Promise<PipelineStage> {
  const issues: string[] = [];

  // Check when health scores were last calculated
  const { data: latestScores } = await supabase
    .from("client_health_scores")
    .select("calculated_at")
    .order("calculated_at", { ascending: false })
    .limit(1);

  const lastCalc = latestScores?.[0]?.calculated_at;
  const hoursSinceCalc = lastCalc
    ? (Date.now() - new Date(lastCalc).getTime()) / (1000 * 60 * 60)
    : 999;

  if (hoursSinceCalc > 24) {
    issues.push(`Health scores not calculated in ${Math.round(hoursSinceCalc)} hours`);
  }

  // Check for calculation errors
  const { count: nullScores } = await supabase
    .from("client_health_scores")
    .select("*", { count: "exact", head: true })
    .is("health_score", null);

  if ((nullScores || 0) > 0) {
    issues.push(`${nullScores} clients with null health scores`);
  }

  // Check for zone distribution sanity
  const { data: zoneCounts } = await supabase
    .from("client_health_scores")
    .select("health_zone")
    .not("health_zone", "is", null);

  const zones = { RED: 0, YELLOW: 0, GREEN: 0, PURPLE: 0 };
  (zoneCounts || []).forEach(c => {
    if (c.health_zone in zones) {
      zones[c.health_zone as keyof typeof zones]++;
    }
  });

  const total = Object.values(zones).reduce((a, b) => a + b, 0);
  const redPct = total > 0 ? (zones.RED / total) * 100 : 0;

  if (redPct > 30) {
    issues.push(`Unusually high RED zone: ${Math.round(redPct)}%`);
  }

  return {
    name: "Health Score Calculation",
    status: hoursSinceCalc > 48 ? "failing" : hoursSinceCalc > 24 ? "warning" : "healthy",
    last_run: lastCalc || null,
    records_processed: total,
    records_failed: nullScores || 0,
    bottleneck: hoursSinceCalc > 24,
    issues
  };
}

async function checkInterventionPipeline(): Promise<PipelineStage> {
  const issues: string[] = [];

  // Check intervention generation
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentInterventions, count: totalCount } = await supabase
    .from("intervention_log")
    .select("status, priority, triggered_at", { count: "exact" })
    .gte("triggered_at", dayAgo);

  const pendingCount = (recentInterventions || []).filter(i => i.status === "PENDING").length;
  const criticalPending = (recentInterventions || []).filter(i =>
    i.status === "PENDING" && i.priority === "CRITICAL"
  ).length;

  if (criticalPending > 0) {
    issues.push(`${criticalPending} CRITICAL interventions pending action`);
  }

  // Check for stale interventions
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: staleCount } = await supabase
    .from("intervention_log")
    .select("*", { count: "exact", head: true })
    .eq("status", "PENDING")
    .lt("triggered_at", weekAgo);

  if ((staleCount || 0) > 10) {
    issues.push(`${staleCount} interventions stale for 7+ days`);
  }

  return {
    name: "Intervention Pipeline",
    status: criticalPending > 0 ? "failing" : (staleCount || 0) > 10 ? "warning" : "healthy",
    last_run: recentInterventions?.[0]?.triggered_at || null,
    records_processed: totalCount || 0,
    records_failed: staleCount || 0,
    bottleneck: criticalPending > 0,
    issues
  };
}

async function checkCAPIPipeline(): Promise<PipelineStage> {
  const issues: string[] = [];

  // Check CAPI event processing
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentEvents } = await supabase
    .from("capi_events_enriched")
    .select("send_status, created_at")
    .gte("created_at", dayAgo);

  const total = recentEvents?.length || 0;
  const sent = (recentEvents || []).filter(e => e.send_status === "sent").length;
  const failed = (recentEvents || []).filter(e => e.send_status === "failed").length;
  const pending = (recentEvents || []).filter(e => e.send_status === "pending").length;

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

  // Check batch jobs
  const { data: recentBatches } = await supabase
    .from("batch_jobs")
    .select("*")
    .gte("created_at", dayAgo)
    .order("created_at", { ascending: false });

  const failedBatches = (recentBatches || []).filter(b => b.status === "failed").length;
  if (failedBatches > 0) {
    issues.push(`${failedBatches} batch jobs failed`);
  }

  return {
    name: "CAPI Event Delivery",
    status: successRate < 50 || failedBatches > 2 ? "failing" :
            successRate < 80 || pending > 50 ? "warning" : "healthy",
    last_run: recentBatches?.[0]?.completed_at || null,
    records_processed: sent,
    records_failed: failed,
    bottleneck: pending > 100,
    issues
  };
}

async function checkDailySummary(): Promise<PipelineStage> {
  const issues: string[] = [];

  // Check if daily summary is being generated
  const { data: summaries } = await supabase
    .from("daily_summary")
    .select("*")
    .order("summary_date", { ascending: false })
    .limit(7);

  if (!summaries || summaries.length === 0) {
    issues.push("No daily summaries found");
  } else {
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

  return {
    name: "Daily Summary Generation",
    status: issues.length > 1 ? "failing" : issues.length > 0 ? "warning" : "healthy",
    last_run: summaries?.[0]?.generated_at || null,
    records_processed: summaries?.length || 0,
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

    // Run all stage checks in parallel
    const [ingestion, healthCalc, interventions, capi, summary] = await Promise.all([
      checkDataIngestion(),
      checkHealthCalculation(),
      checkInterventionPipeline(),
      checkCAPIPipeline(),
      checkDailySummary()
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
