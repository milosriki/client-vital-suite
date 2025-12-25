import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// ERROR TREND ANALYZER AGENT
// Analyzes error trends over time
// Identifies patterns and provides forecasts
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
  console.error("[Error Trend Analyzer] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

interface TrendDataPoint {
  period: string;
  error_count: number;
  resolution_rate: number;
  avg_resolution_time_hours: number;
}

interface SourceTrend {
  source: string;
  trend_direction: "increasing" | "stable" | "decreasing";
  change_percent: number;
  current_period_count: number;
  previous_period_count: number;
  primary_error_type: string;
}

interface ErrorTypeTrend {
  error_type: string;
  trend_direction: "increasing" | "stable" | "decreasing";
  change_percent: number;
  current_count: number;
  affected_sources: string[];
}

interface TrendForecast {
  metric: string;
  current_value: number;
  forecasted_value: number;
  forecast_period: string;
  confidence: number;
  trend_basis: string;
}

interface TrendReport {
  timestamp: string;
  analysis_period: string;
  daily_trends: TrendDataPoint[];
  weekly_comparison: {
    this_week: number;
    last_week: number;
    change_percent: number;
    trend: "increasing" | "stable" | "decreasing";
  };
  source_trends: SourceTrend[];
  error_type_trends: ErrorTypeTrend[];
  forecasts: TrendForecast[];
  key_insights: string[];
  recommendations: string[];
}

async function getDailyTrends(days: number): Promise<TrendDataPoint[]> {
  const trends: TrendDataPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - i);

    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const { data: errors } = await supabase
      .from("sync_errors")
      .select("id, resolved_at, created_at")
      .gte("created_at", dayStart.toISOString())
      .lt("created_at", dayEnd.toISOString());

    const errorCount = errors?.length || 0;
    const resolved = errors?.filter(e => e.resolved_at) || [];
    const resolutionRate = errorCount > 0 ? Math.round((resolved.length / errorCount) * 100) : 100;

    // Calculate average resolution time
    let avgResolutionHours = 0;
    if (resolved.length > 0) {
      let totalMs = 0;
      for (const e of resolved) {
        totalMs += new Date(e.resolved_at).getTime() - new Date(e.created_at).getTime();
      }
      avgResolutionHours = Math.round((totalMs / resolved.length / (1000 * 60 * 60)) * 10) / 10;
    }

    trends.push({
      period: dayStart.toISOString().split("T")[0],
      error_count: errorCount,
      resolution_rate: resolutionRate,
      avg_resolution_time_hours: avgResolutionHours,
    });
  }

  return trends;
}

async function getWeeklyComparison(): Promise<TrendReport["weekly_comparison"]> {
  const now = new Date();

  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(thisWeekStart.getDate() - 7);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const [thisWeekResult, lastWeekResult] = await Promise.all([
    supabase.from("sync_errors").select("*", { count: "exact", head: true })
      .gte("created_at", thisWeekStart.toISOString()),
    supabase.from("sync_errors").select("*", { count: "exact", head: true })
      .gte("created_at", lastWeekStart.toISOString())
      .lt("created_at", thisWeekStart.toISOString()),
  ]);

  const thisWeek = thisWeekResult.count || 0;
  const lastWeek = lastWeekResult.count || 0;

  const changePercent = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;

  let trend: "increasing" | "stable" | "decreasing" = "stable";
  if (changePercent > 15) trend = "increasing";
  else if (changePercent < -15) trend = "decreasing";

  return { this_week: thisWeek, last_week: lastWeek, change_percent: changePercent, trend };
}

async function getSourceTrends(): Promise<SourceTrend[]> {
  const currentPeriodStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const previousPeriodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: currentErrors } = await supabase
    .from("sync_errors")
    .select("source, error_type")
    .gte("created_at", currentPeriodStart);

  const { data: previousErrors } = await supabase
    .from("sync_errors")
    .select("source, error_type")
    .gte("created_at", previousPeriodStart)
    .lt("created_at", currentPeriodStart);

  // Count by source for current period
  const currentCounts = new Map<string, { count: number; types: Map<string, number> }>();
  for (const e of currentErrors || []) {
    const source = e.source || "unknown";
    if (!currentCounts.has(source)) {
      currentCounts.set(source, { count: 0, types: new Map() });
    }
    const data = currentCounts.get(source)!;
    data.count++;
    const errorType = e.error_type || "unknown";
    data.types.set(errorType, (data.types.get(errorType) || 0) + 1);
  }

  // Count by source for previous period
  const previousCounts = new Map<string, number>();
  for (const e of previousErrors || []) {
    const source = e.source || "unknown";
    previousCounts.set(source, (previousCounts.get(source) || 0) + 1);
  }

  // Build trends
  const allSources = new Set([...currentCounts.keys(), ...previousCounts.keys()]);
  const trends: SourceTrend[] = [];

  for (const source of allSources) {
    const currentData = currentCounts.get(source);
    const current = currentData?.count || 0;
    const previous = previousCounts.get(source) || 0;

    // Normalize to same period length (3 days vs 4 days)
    const normalizedPrevious = Math.round(previous * (3 / 4));

    const changePercent = normalizedPrevious > 0
      ? Math.round(((current - normalizedPrevious) / normalizedPrevious) * 100)
      : current > 0 ? 100 : 0;

    let trendDirection: SourceTrend["trend_direction"] = "stable";
    if (changePercent > 20) trendDirection = "increasing";
    else if (changePercent < -20) trendDirection = "decreasing";

    // Find primary error type
    let primaryType = "unknown";
    let maxCount = 0;
    if (currentData) {
      for (const [type, count] of currentData.types) {
        if (count > maxCount) {
          maxCount = count;
          primaryType = type;
        }
      }
    }

    trends.push({
      source,
      trend_direction: trendDirection,
      change_percent: changePercent,
      current_period_count: current,
      previous_period_count: previous,
      primary_error_type: primaryType,
    });
  }

  return trends.sort((a, b) => b.current_period_count - a.current_period_count);
}

async function getErrorTypeTrends(): Promise<ErrorTypeTrend[]> {
  const currentStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const previousStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: currentErrors } = await supabase
    .from("sync_errors")
    .select("source, error_type")
    .gte("created_at", currentStart);

  const { data: previousErrors } = await supabase
    .from("sync_errors")
    .select("error_type")
    .gte("created_at", previousStart)
    .lt("created_at", currentStart);

  // Current period by type
  const currentByType = new Map<string, { count: number; sources: Set<string> }>();
  for (const e of currentErrors || []) {
    const type = e.error_type || "unknown";
    if (!currentByType.has(type)) {
      currentByType.set(type, { count: 0, sources: new Set() });
    }
    const data = currentByType.get(type)!;
    data.count++;
    data.sources.add(e.source || "unknown");
  }

  // Previous period by type
  const previousByType = new Map<string, number>();
  for (const e of previousErrors || []) {
    const type = e.error_type || "unknown";
    previousByType.set(type, (previousByType.get(type) || 0) + 1);
  }

  // Build trends
  const allTypes = new Set([...currentByType.keys(), ...previousByType.keys()]);
  const trends: ErrorTypeTrend[] = [];

  for (const type of allTypes) {
    const currentData = currentByType.get(type);
    const current = currentData?.count || 0;
    const previous = previousByType.get(type) || 0;

    const normalizedPrevious = Math.round(previous * (3 / 4));
    const changePercent = normalizedPrevious > 0
      ? Math.round(((current - normalizedPrevious) / normalizedPrevious) * 100)
      : current > 0 ? 100 : 0;

    let direction: ErrorTypeTrend["trend_direction"] = "stable";
    if (changePercent > 20) direction = "increasing";
    else if (changePercent < -20) direction = "decreasing";

    trends.push({
      error_type: type,
      trend_direction: direction,
      change_percent: changePercent,
      current_count: current,
      affected_sources: currentData ? [...currentData.sources] : [],
    });
  }

  return trends.sort((a, b) => b.current_count - a.current_count);
}

function generateForecasts(dailyTrends: TrendDataPoint[], weeklyComparison: TrendReport["weekly_comparison"]): TrendForecast[] {
  const forecasts: TrendForecast[] = [];

  // Simple linear forecast based on daily trends
  if (dailyTrends.length >= 3) {
    const recentDays = dailyTrends.slice(-3);
    const avgRecent = recentDays.reduce((sum, d) => sum + d.error_count, 0) / 3;
    const previousDays = dailyTrends.slice(-6, -3);
    const avgPrevious = previousDays.length > 0
      ? previousDays.reduce((sum, d) => sum + d.error_count, 0) / previousDays.length
      : avgRecent;

    const growthRate = avgPrevious > 0 ? (avgRecent - avgPrevious) / avgPrevious : 0;
    const forecasted = Math.round(avgRecent * (1 + growthRate));

    forecasts.push({
      metric: "Daily Error Count",
      current_value: Math.round(avgRecent),
      forecasted_value: Math.max(0, forecasted),
      forecast_period: "Next 3 days",
      confidence: 60,
      trend_basis: "3-day moving average with growth rate",
    });
  }

  // Weekly forecast
  if (weeklyComparison.last_week > 0) {
    const growthRate = (weeklyComparison.this_week - weeklyComparison.last_week) / weeklyComparison.last_week;
    const forecasted = Math.round(weeklyComparison.this_week * (1 + growthRate));

    forecasts.push({
      metric: "Weekly Error Count",
      current_value: weeklyComparison.this_week,
      forecasted_value: Math.max(0, forecasted),
      forecast_period: "Next week",
      confidence: 50,
      trend_basis: "Week-over-week growth rate",
    });
  }

  return forecasts;
}

function generateInsightsAndRecommendations(
  sourceTrends: SourceTrend[],
  typeTrends: ErrorTypeTrend[],
  weeklyComparison: TrendReport["weekly_comparison"]
): { insights: string[]; recommendations: string[] } {
  const insights: string[] = [];
  const recommendations: string[] = [];

  // Weekly trend insight
  if (weeklyComparison.trend === "increasing") {
    insights.push(`Error rate increased ${weeklyComparison.change_percent}% compared to last week`);
    recommendations.push("Investigate recent changes that may have caused increased errors");
  } else if (weeklyComparison.trend === "decreasing") {
    insights.push(`Error rate decreased ${Math.abs(weeklyComparison.change_percent)}% compared to last week`);
  }

  // Source-specific insights
  const increasingSources = sourceTrends.filter(s => s.trend_direction === "increasing" && s.change_percent > 30);
  for (const source of increasingSources.slice(0, 3)) {
    insights.push(`${source.source} errors increased ${source.change_percent}% (primarily ${source.primary_error_type})`);
    recommendations.push(`Review ${source.source} integration for ${source.primary_error_type} issues`);
  }

  // Error type insights
  const increasingTypes = typeTrends.filter(t => t.trend_direction === "increasing" && t.change_percent > 30);
  for (const type of increasingTypes.slice(0, 3)) {
    insights.push(`${type.error_type} errors up ${type.change_percent}% across ${type.affected_sources.length} sources`);
  }

  if (insights.length === 0) {
    insights.push("Error trends are stable with no significant changes");
  }

  if (recommendations.length === 0) {
    recommendations.push("Continue monitoring - no immediate action required");
  }

  return { insights, recommendations };
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

    console.log("[Error Trend Analyzer] Starting trend analysis...");

    // Gather all trend data
    const [dailyTrends, weeklyComparison, sourceTrends, errorTypeTrends] = await Promise.all([
      getDailyTrends(7),
      getWeeklyComparison(),
      getSourceTrends(),
      getErrorTypeTrends(),
    ]);

    const forecasts = generateForecasts(dailyTrends, weeklyComparison);
    const { insights, recommendations } = generateInsightsAndRecommendations(
      sourceTrends,
      errorTypeTrends,
      weeklyComparison
    );

    const report: TrendReport = {
      timestamp: new Date().toISOString(),
      analysis_period: "Last 7 days",
      daily_trends: dailyTrends,
      weekly_comparison: weeklyComparison,
      source_trends: sourceTrends,
      error_type_trends: errorTypeTrends,
      forecasts,
      key_insights: insights,
      recommendations,
    };

    // Store significant insights
    if (weeklyComparison.trend === "increasing" && weeklyComparison.change_percent > 30) {
      await supabase.from("proactive_insights").upsert({
        insight_type: "error_trend",
        priority: "high",
        title: `Error Trend: ${weeklyComparison.change_percent}% increase this week`,
        content: insights.join(". "),
        action_items: recommendations,
        affected_entities: { weekly_change: weeklyComparison.change_percent },
        source_agent: "error_trend_analyzer",
        dedup_key: `trend_${new Date().toISOString().split("T")[0]}`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "dedup_key", ignoreDuplicates: true });
    }

    const duration = Date.now() - startTime;
    console.log(`[Error Trend Analyzer] Complete in ${duration}ms - Weekly trend: ${weeklyComparison.trend}`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[Error Trend Analyzer] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
