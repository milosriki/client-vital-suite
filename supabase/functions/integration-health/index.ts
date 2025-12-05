import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// INTEGRATION HEALTH AGENT
// Monitors HubSpot, Meta CAPI, Stape connections
// Detects failures before they impact business
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Timeout wrapper for health checks
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = "Operation timed out"
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
}

interface IntegrationStatus {
  name: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  last_success: string | null;
  last_error: string | null;
  error_rate_24h: number;
  avg_latency_ms: number | null;
  checks: IntegrationCheck[];
  recommendations: string[];
}

interface IntegrationCheck {
  check_name: string;
  passed: boolean;
  message: string;
  timestamp: string;
}

interface HealthReport {
  timestamp: string;
  overall_status: "healthy" | "degraded" | "critical";
  integrations: IntegrationStatus[];
  alerts: string[];
}

async function checkHubSpot(): Promise<IntegrationStatus> {
  const checks: IntegrationCheck[] = [];
  const recommendations: string[] = [];
  let lastSuccess: string | null = null;
  let lastError: string | null = null;

  try {
    // Check if API key is configured
    const hasApiKey = !!Deno.env.get("HUBSPOT_API_KEY");
    checks.push({
      check_name: "API Key Configured",
      passed: hasApiKey,
      message: hasApiKey ? "HubSpot API key is set" : "HUBSPOT_API_KEY not configured",
      timestamp: new Date().toISOString()
    });

    if (!hasApiKey) {
      recommendations.push("Set HUBSPOT_API_KEY in Supabase secrets");
    }

    // Check recent sync logs with error handling for missing table
    try {
      const { data: recentSyncs, error } = await supabase
        .from("sync_logs")
        .select("*")
        .eq("platform", "hubspot")
        .order("started_at", { ascending: false })
        .limit(10);

      if (error) {
        if (error.code === "42P01") {
          checks.push({
            check_name: "Sync Logs Table",
            passed: false,
            message: "sync_logs table does not exist",
            timestamp: new Date().toISOString()
          });
          recommendations.push("Create sync_logs table to track sync history");
        } else {
          throw error;
        }
      } else if (recentSyncs && recentSyncs.length > 0) {
        lastSuccess = recentSyncs.find(s => s.status === "success")?.completed_at || null;
        lastError = recentSyncs.find(s => s.status === "error")?.error_details?.message || null;

        const failedCount = recentSyncs.filter(s => s.status === "error").length;
        const errorRate = (failedCount / recentSyncs.length) * 100;

        checks.push({
          check_name: "Recent Sync Activity",
          passed: recentSyncs.length > 0,
          message: `${recentSyncs.length} syncs in history, ${failedCount} failed`,
          timestamp: new Date().toISOString()
        });

        if (errorRate > 30) {
          recommendations.push(`High error rate (${Math.round(errorRate)}%) - check HubSpot API limits`);
        }
      } else {
        checks.push({
          check_name: "Recent Sync Activity",
          passed: false,
          message: "No recent sync activity found",
          timestamp: new Date().toISOString()
        });
        recommendations.push("Run sync-hubspot-to-capi to test connection");
      }
    } catch (dbError) {
      console.error("Database error in HubSpot sync logs check:", dbError);
      checks.push({
        check_name: "Recent Sync Activity",
        passed: false,
        message: `Error querying sync logs: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      });
    }

    // Check data freshness
    try {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: recentUpdates, error } = await supabase
        .from("client_health_scores")
        .select("*", { count: "exact", head: true })
        .gte("updated_at", hourAgo);

      if (error) {
        throw error;
      }

      checks.push({
        check_name: "Data Freshness",
        passed: (recentUpdates || 0) > 0,
        message: `${recentUpdates || 0} records updated in last hour`,
        timestamp: new Date().toISOString()
      });
    } catch (freshnessError) {
      console.error("Error checking data freshness:", freshnessError);
      checks.push({
        check_name: "Data Freshness",
        passed: false,
        message: `Error checking data freshness: ${freshnessError instanceof Error ? freshnessError.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Error in checkHubSpot:", error);
    lastError = error instanceof Error ? error.message : "Unknown error in HubSpot check";
  }

  // Determine overall status
  const failedChecks = checks.filter(c => !c.passed).length;
  let status: IntegrationStatus["status"] = "healthy";
  if (failedChecks >= 2) status = "down";
  else if (failedChecks === 1) status = "degraded";

  return {
    name: "HubSpot",
    status,
    last_success: lastSuccess,
    last_error: lastError,
    error_rate_24h: 0, // Would need more data to calculate
    avg_latency_ms: null,
    checks,
    recommendations
  };
}

async function checkStapeCAPI(): Promise<IntegrationStatus> {
  const checks: IntegrationCheck[] = [];
  const recommendations: string[] = [];
  let lastSuccess: string | null = null;
  let lastError: string | null = null;

  try {
    // Check if API key is configured
    const hasApiKey = !!Deno.env.get("STAPE_CAPIG_API_KEY");
    checks.push({
      check_name: "API Key Configured",
      passed: hasApiKey,
      message: hasApiKey ? "Stape CAPI key is set" : "STAPE_CAPIG_API_KEY not configured",
      timestamp: new Date().toISOString()
    });

    if (!hasApiKey) {
      recommendations.push("Set STAPE_CAPIG_API_KEY in Supabase secrets");
    }

    // Check recent CAPI events
    try {
      const { data: recentEvents, error } = await supabase
        .from("capi_events_enriched")
        .select("send_status, sent_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      if (recentEvents && recentEvents.length > 0) {
        const sentCount = recentEvents.filter(e => e.send_status === "sent").length;
        const failedCount = recentEvents.filter(e => e.send_status === "failed").length;
        const pendingCount = recentEvents.filter(e => e.send_status === "pending").length;

        const successRate = recentEvents.length > 0
          ? Math.round((sentCount / (sentCount + failedCount || 1)) * 100)
          : 0;

        checks.push({
          check_name: "Event Delivery",
          passed: successRate >= 80,
          message: `${successRate}% success rate (${sentCount} sent, ${failedCount} failed, ${pendingCount} pending)`,
          timestamp: new Date().toISOString()
        });

        if (successRate < 80) {
          recommendations.push("Review failed events with capi-validator");
        }

        // Check for stuck pending events
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const stuckPending = recentEvents.filter(e =>
          e.send_status === "pending" && e.created_at < dayAgo
        ).length;

        checks.push({
          check_name: "Queue Health",
          passed: stuckPending < 10,
          message: stuckPending > 0 ? `${stuckPending} events stuck in queue` : "Queue is healthy",
          timestamp: new Date().toISOString()
        });

        if (stuckPending >= 10) {
          recommendations.push("Clear stuck events with process-capi-batch");
        }

        lastSuccess = recentEvents.find(e => e.send_status === "sent")?.sent_at || null;
      } else {
        checks.push({
          check_name: "Event Delivery",
          passed: false,
          message: "No CAPI events found",
          timestamp: new Date().toISOString()
        });
      }
    } catch (eventsError) {
      console.error("Error checking CAPI events:", eventsError);
      checks.push({
        check_name: "Event Delivery",
        passed: false,
        message: `Error querying CAPI events: ${eventsError instanceof Error ? eventsError.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      });
    }

    // Check batch jobs
    try {
      const { data: recentBatches, error } = await supabase
        .from("batch_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) {
        throw error;
      }

      if (recentBatches && recentBatches.length > 0) {
        const failedBatches = recentBatches.filter(b =>
          b.status === "failed" || b.events_failed > 0
        ).length;

        checks.push({
          check_name: "Batch Processing",
          passed: failedBatches < 2,
          message: `${failedBatches}/${recentBatches.length} recent batches had issues`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (batchError) {
      console.error("Error checking batch jobs:", batchError);
      checks.push({
        check_name: "Batch Processing",
        passed: false,
        message: `Error querying batch jobs: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Error in checkStapeCAPI:", error);
    lastError = error instanceof Error ? error.message : "Unknown error in Stape CAPI check";
  }

  // Determine overall status
  const failedChecks = checks.filter(c => !c.passed).length;
  let status: IntegrationStatus["status"] = "healthy";
  if (failedChecks >= 2) status = "down";
  else if (failedChecks === 1) status = "degraded";

  return {
    name: "Stape CAPI (Meta)",
    status,
    last_success: lastSuccess,
    last_error: lastError,
    error_rate_24h: 0,
    avg_latency_ms: null,
    checks,
    recommendations
  };
}

async function checkSupabaseHealth(): Promise<IntegrationStatus> {
  const checks: IntegrationCheck[] = [];
  const recommendations: string[] = [];
  let latency = 0;

  try {
    // Check database connectivity
    const startTime = Date.now();
    const { error } = await supabase.from("client_health_scores").select("id").limit(1);
    latency = Date.now() - startTime;

    checks.push({
      check_name: "Database Connectivity",
      passed: !error,
      message: error ? `Connection error: ${error.message}` : `Connected (${latency}ms)`,
      timestamp: new Date().toISOString()
    });

    // Check table row counts
    const tables = ["client_health_scores", "intervention_log", "daily_summary", "capi_events_enriched"];
    for (const table of tables) {
      try {
        const { count, error: countError } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });

        checks.push({
          check_name: `Table: ${table}`,
          passed: !countError && (count || 0) >= 0,
          message: countError ? `Error: ${countError.message}` : `${count} rows`,
          timestamp: new Date().toISOString()
        });
      } catch (tableError) {
        console.error(`Error checking table ${table}:`, tableError);
        checks.push({
          check_name: `Table: ${table}`,
          passed: false,
          message: `Error: ${tableError instanceof Error ? tableError.message : 'Unknown error'}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Check edge function status by looking at sync logs
    try {
      const { data: functionLogs, error } = await supabase
        .from("sync_logs")
        .select("platform, status, started_at")
        .order("started_at", { ascending: false })
        .limit(20);

      if (error) {
        if (error.code === "42P01") {
          checks.push({
            check_name: "Edge Functions",
            passed: false,
            message: "sync_logs table does not exist",
            timestamp: new Date().toISOString()
          });
          recommendations.push("Create sync_logs table to track edge function execution");
        } else {
          throw error;
        }
      } else if (functionLogs) {
        const recentFailures = functionLogs.filter(l => l.status === "error").length;
        checks.push({
          check_name: "Edge Functions",
          passed: recentFailures < 5,
          message: `${recentFailures} failures in recent logs`,
          timestamp: new Date().toISOString()
        });

        if (recentFailures >= 5) {
          recommendations.push("Check edge function logs for errors");
        }
      }
    } catch (logsError) {
      console.error("Error checking sync logs:", logsError);
      checks.push({
        check_name: "Edge Functions",
        passed: false,
        message: `Error querying sync logs: ${logsError instanceof Error ? logsError.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Error in checkSupabaseHealth:", error);
    checks.push({
      check_name: "Health Check Error",
      passed: false,
      message: `Critical error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString()
    });
  }

  const failedChecks = checks.filter(c => !c.passed).length;
  let status: IntegrationStatus["status"] = "healthy";
  if (failedChecks >= 3) status = "down";
  else if (failedChecks >= 1) status = "degraded";

  return {
    name: "Supabase",
    status,
    last_success: new Date().toISOString(),
    last_error: null,
    error_rate_24h: 0,
    avg_latency_ms: latency,
    checks,
    recommendations
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log("[Integration Health] Running health checks...");

    // Run all checks in parallel
    const [hubspot, stape, supabaseHealth] = await Promise.all([
      checkHubSpot(),
      checkStapeCAPI(),
      checkSupabaseHealth()
    ]);

    const integrations = [hubspot, stape, supabaseHealth];

    // Determine overall status
    const downCount = integrations.filter(i => i.status === "down").length;
    const degradedCount = integrations.filter(i => i.status === "degraded").length;

    let overallStatus: HealthReport["overall_status"] = "healthy";
    if (downCount > 0) overallStatus = "critical";
    else if (degradedCount > 0) overallStatus = "degraded";

    // Generate alerts
    const alerts: string[] = [];
    for (const integration of integrations) {
      if (integration.status === "down") {
        alerts.push(`CRITICAL: ${integration.name} is DOWN`);
      } else if (integration.status === "degraded") {
        alerts.push(`WARNING: ${integration.name} is degraded`);
      }
    }

    const report: HealthReport = {
      timestamp: new Date().toISOString(),
      overall_status: overallStatus,
      integrations,
      alerts
    };

    // Log health check (with error handling for missing table)
    try {
      const { error: logError } = await supabase.from("sync_logs").insert({
        platform: "integration_health",
        sync_type: "health_check",
        status: overallStatus === "healthy" ? "success" : "completed_with_errors",
        records_processed: integrations.length,
        records_failed: downCount + degradedCount,
        error_details: { alerts },
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      });

      if (logError && logError.code !== "42P01") {
        console.error("Failed to log health check:", logError);
      }
    } catch (logError) {
      console.error("Error logging health check:", logError);
      // Continue execution even if logging fails
    }

    const duration = Date.now() - startTime;
    console.log(`[Integration Health] Complete in ${duration}ms - Status: ${overallStatus}`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error("[Integration Health] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
