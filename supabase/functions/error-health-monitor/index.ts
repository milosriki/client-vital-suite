import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// ERROR HEALTH MONITOR AGENT
// Real-time error health dashboard data provider
// Tracks system health metrics and trends
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function validateEnv(): { valid: boolean; missing: string[] } {
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter(key => !Deno.env.get(key));
  return { valid: missing.length === 0, missing };
}

const envCheck = validateEnv();
if (!envCheck.valid) {
  console.error("[Error Health Monitor] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

interface HealthMetric {
  name: string;
  value: number;
  unit: string;
  status: "healthy" | "warning" | "critical";
  trend: "improving" | "stable" | "degrading";
  threshold_warning: number;
  threshold_critical: number;
}

interface SourceHealth {
  source: string;
  overall_status: "healthy" | "warning" | "critical";
  error_count_1h: number;
  error_count_24h: number;
  resolution_rate: number;
  avg_resolution_time_hours: number;
  most_common_error: string;
  last_error_at: string | null;
}

interface HealthReport {
  timestamp: string;
  overall_system_health: "healthy" | "warning" | "critical";
  health_score: number;  // 0-100
  metrics: HealthMetric[];
  source_health: SourceHealth[];
  active_incidents: number;
  resolved_today: number;
  mean_time_to_resolution_hours: number;
  error_trend_24h: "increasing" | "stable" | "decreasing";
  recommendations: string[];
}

async function getErrorCounts(): Promise<{ hour: number; day: number; week: number }> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [hourResult, dayResult, weekResult] = await Promise.all([
    supabase.from("sync_errors").select("*", { count: "exact", head: true }).gte("created_at", hourAgo),
    supabase.from("sync_errors").select("*", { count: "exact", head: true }).gte("created_at", dayAgo),
    supabase.from("sync_errors").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
  ]);

  return {
    hour: hourResult.count || 0,
    day: dayResult.count || 0,
    week: weekResult.count || 0,
  };
}

async function getUnresolvedCount(): Promise<number> {
  const { count } = await supabase
    .from("sync_errors")
    .select("*", { count: "exact", head: true })
    .is("resolved_at", null);

  return count || 0;
}

async function getResolutionMetrics(): Promise<{ rate: number; avgTimeHours: number; resolvedToday: number }> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Get errors created in last 24 hours
  const { data: recentErrors } = await supabase
    .from("sync_errors")
    .select("id, created_at, resolved_at")
    .gte("created_at", dayAgo);

  if (!recentErrors || recentErrors.length === 0) {
    return { rate: 100, avgTimeHours: 0, resolvedToday: 0 };
  }

  const resolved = recentErrors.filter(e => e.resolved_at);
  const rate = Math.round((resolved.length / recentErrors.length) * 100);

  // Calculate average resolution time
  let totalTimeMs = 0;
  for (const error of resolved) {
    const created = new Date(error.created_at).getTime();
    const resolvedAt = new Date(error.resolved_at).getTime();
    totalTimeMs += resolvedAt - created;
  }
  const avgTimeHours = resolved.length > 0 ? totalTimeMs / resolved.length / (1000 * 60 * 60) : 0;

  // Count resolved today
  const resolvedToday = resolved.filter(e => new Date(e.resolved_at) >= todayStart).length;

  return {
    rate,
    avgTimeHours: Math.round(avgTimeHours * 10) / 10,
    resolvedToday,
  };
}

async function getSourceHealth(): Promise<SourceHealth[]> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: errors } = await supabase
    .from("sync_errors")
    .select("source, error_type, created_at, resolved_at")
    .gte("created_at", dayAgo);

  if (!errors) return [];

  const sourceStats = new Map<string, {
    errors_1h: number;
    errors_24h: number;
    resolved: number;
    total_resolution_time_ms: number;
    error_types: Map<string, number>;
    last_error: Date | null;
  }>();

  const hourAgoDate = new Date(hourAgo);

  for (const error of errors) {
    const source = error.source || "unknown";
    if (!sourceStats.has(source)) {
      sourceStats.set(source, {
        errors_1h: 0,
        errors_24h: 0,
        resolved: 0,
        total_resolution_time_ms: 0,
        error_types: new Map(),
        last_error: null,
      });
    }

    const stats = sourceStats.get(source)!;
    const createdAt = new Date(error.created_at);

    stats.errors_24h++;
    if (createdAt >= hourAgoDate) {
      stats.errors_1h++;
    }

    if (error.resolved_at) {
      stats.resolved++;
      stats.total_resolution_time_ms += new Date(error.resolved_at).getTime() - createdAt.getTime();
    }

    const errorType = error.error_type || "unknown";
    stats.error_types.set(errorType, (stats.error_types.get(errorType) || 0) + 1);

    if (!stats.last_error || createdAt > stats.last_error) {
      stats.last_error = createdAt;
    }
  }

  const sourceHealthList: SourceHealth[] = [];

  for (const [source, stats] of sourceStats) {
    const resolutionRate = stats.errors_24h > 0 ? Math.round((stats.resolved / stats.errors_24h) * 100) : 100;
    const avgResolutionHours = stats.resolved > 0
      ? Math.round((stats.total_resolution_time_ms / stats.resolved / (1000 * 60 * 60)) * 10) / 10
      : 0;

    // Find most common error type
    let mostCommonError = "none";
    let maxCount = 0;
    for (const [type, count] of stats.error_types) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonError = type;
      }
    }

    // Determine status
    let status: SourceHealth["overall_status"] = "healthy";
    if (stats.errors_1h > 10 || resolutionRate < 50) {
      status = "critical";
    } else if (stats.errors_1h > 5 || resolutionRate < 75) {
      status = "warning";
    }

    sourceHealthList.push({
      source,
      overall_status: status,
      error_count_1h: stats.errors_1h,
      error_count_24h: stats.errors_24h,
      resolution_rate: resolutionRate,
      avg_resolution_time_hours: avgResolutionHours,
      most_common_error: mostCommonError,
      last_error_at: stats.last_error?.toISOString() || null,
    });
  }

  return sourceHealthList.sort((a, b) => b.error_count_24h - a.error_count_24h);
}

function calculateHealthScore(
  unresolvedCount: number,
  errorCounts: { hour: number; day: number },
  resolutionRate: number,
  sourceHealth: SourceHealth[]
): number {
  let score = 100;

  // Deduct for unresolved errors
  score -= Math.min(30, unresolvedCount * 2);

  // Deduct for recent errors
  score -= Math.min(20, errorCounts.hour * 2);

  // Deduct for low resolution rate
  if (resolutionRate < 90) {
    score -= Math.min(20, (90 - resolutionRate));
  }

  // Deduct for critical sources
  const criticalSources = sourceHealth.filter(s => s.overall_status === "critical").length;
  score -= criticalSources * 10;

  return Math.max(0, Math.round(score));
}

function determineErrorTrend(errorCounts: { hour: number; day: number }): "increasing" | "stable" | "decreasing" {
  // Compare hourly rate to daily average
  const dailyAvgPerHour = errorCounts.day / 24;
  const ratio = errorCounts.hour / (dailyAvgPerHour || 1);

  if (ratio > 1.5) return "increasing";
  if (ratio < 0.5) return "decreasing";
  return "stable";
}

function generateRecommendations(
  healthScore: number,
  sourceHealth: SourceHealth[],
  unresolvedCount: number,
  errorTrend: string
): string[] {
  const recommendations: string[] = [];

  if (healthScore < 50) {
    recommendations.push("URGENT: System health is critical - immediate investigation required");
  }

  const criticalSources = sourceHealth.filter(s => s.overall_status === "critical");
  for (const source of criticalSources) {
    recommendations.push(`Investigate ${source.source} integration - ${source.error_count_1h} errors in last hour`);
  }

  if (unresolvedCount > 20) {
    recommendations.push(`${unresolvedCount} unresolved errors - run error auto-resolver`);
  }

  if (errorTrend === "increasing") {
    recommendations.push("Error rate is increasing - check for recent changes or external issues");
  }

  const lowResolutionSources = sourceHealth.filter(s => s.resolution_rate < 60);
  for (const source of lowResolutionSources) {
    recommendations.push(`${source.source} has low resolution rate (${source.resolution_rate}%) - review handling logic`);
  }

  if (recommendations.length === 0) {
    recommendations.push("System health is good - continue monitoring");
  }

  return recommendations;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    if (!envCheck.valid) {
      throw new Error(`Missing required environment variables: ${envCheck.missing.join(", ")}`);
    }

    console.log("[Error Health Monitor] Generating health report...");

    // Gather all metrics in parallel
    const [errorCounts, unresolvedCount, resolutionMetrics, sourceHealth] = await Promise.all([
      getErrorCounts(),
      getUnresolvedCount(),
      getResolutionMetrics(),
      getSourceHealth(),
    ]);

    // Calculate overall health
    const healthScore = calculateHealthScore(unresolvedCount, errorCounts, resolutionMetrics.rate, sourceHealth);
    const errorTrend = determineErrorTrend(errorCounts);

    // Determine overall system health
    let overallHealth: HealthReport["overall_system_health"] = "healthy";
    if (healthScore < 50 || sourceHealth.some(s => s.overall_status === "critical")) {
      overallHealth = "critical";
    } else if (healthScore < 75 || sourceHealth.some(s => s.overall_status === "warning")) {
      overallHealth = "warning";
    }

    // Build metrics
    const metrics: HealthMetric[] = [
      {
        name: "Unresolved Errors",
        value: unresolvedCount,
        unit: "errors",
        status: unresolvedCount > 20 ? "critical" : unresolvedCount > 10 ? "warning" : "healthy",
        trend: errorTrend === "increasing" ? "degrading" : errorTrend === "decreasing" ? "improving" : "stable",
        threshold_warning: 10,
        threshold_critical: 20,
      },
      {
        name: "Errors (Last Hour)",
        value: errorCounts.hour,
        unit: "errors",
        status: errorCounts.hour > 10 ? "critical" : errorCounts.hour > 5 ? "warning" : "healthy",
        trend: errorTrend === "increasing" ? "degrading" : errorTrend === "decreasing" ? "improving" : "stable",
        threshold_warning: 5,
        threshold_critical: 10,
      },
      {
        name: "Resolution Rate",
        value: resolutionMetrics.rate,
        unit: "%",
        status: resolutionMetrics.rate < 60 ? "critical" : resolutionMetrics.rate < 80 ? "warning" : "healthy",
        trend: resolutionMetrics.rate >= 80 ? "stable" : "degrading",
        threshold_warning: 80,
        threshold_critical: 60,
      },
      {
        name: "Avg Resolution Time",
        value: resolutionMetrics.avgTimeHours,
        unit: "hours",
        status: resolutionMetrics.avgTimeHours > 24 ? "critical" : resolutionMetrics.avgTimeHours > 4 ? "warning" : "healthy",
        trend: "stable",
        threshold_warning: 4,
        threshold_critical: 24,
      },
    ];

    const recommendations = generateRecommendations(healthScore, sourceHealth, unresolvedCount, errorTrend);

    const report: HealthReport = {
      timestamp: new Date().toISOString(),
      overall_system_health: overallHealth,
      health_score: healthScore,
      metrics,
      source_health: sourceHealth,
      active_incidents: unresolvedCount,
      resolved_today: resolutionMetrics.resolvedToday,
      mean_time_to_resolution_hours: resolutionMetrics.avgTimeHours,
      error_trend_24h: errorTrend,
      recommendations,
    };

    // Store health snapshot
    if (overallHealth !== "healthy") {
      await supabase.from("proactive_insights").upsert({
        insight_type: "system_health",
        priority: overallHealth === "critical" ? "critical" : "high",
        title: `System Health: ${overallHealth.toUpperCase()} (Score: ${healthScore}/100)`,
        content: recommendations[0],
        action_items: recommendations.slice(0, 5),
        affected_entities: { health_score: healthScore, unresolved: unresolvedCount },
        source_agent: "error_health_monitor",
        dedup_key: `health_${new Date().toISOString().split("T")[0]}_${overallHealth}`,
        expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "dedup_key", ignoreDuplicates: false });
    }

    const duration = Date.now() - startTime;
    console.log(`[Error Health Monitor] Complete in ${duration}ms - Health Score: ${healthScore}/100`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[Error Health Monitor] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
