import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

// ============================================
// API RATE LIMIT HANDLER AGENT
// Centralized handler for rate limiting across all APIs
// Implements intelligent backoff and request queuing
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
  console.error("[API Rate Limit Handler] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// Rate limit configurations by source
const rateLimitConfigs: Record<string, {
  maxRetries: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  resetWindowMs: number;
}> = {
  hubspot: {
    maxRetries: 5,
    baseBackoffMs: 1000,
    maxBackoffMs: 60000,
    resetWindowMs: 10000, // HubSpot rate limits reset every 10 seconds
  },
  stripe: {
    maxRetries: 4,
    baseBackoffMs: 1000,
    maxBackoffMs: 60000,
    resetWindowMs: 1000, // Stripe: 100 requests per second
  },
  meta: {
    maxRetries: 3,
    baseBackoffMs: 60000, // Meta requires longer backoff
    maxBackoffMs: 3600000,
    resetWindowMs: 3600000, // Hourly limits
  },
  facebook: {
    maxRetries: 3,
    baseBackoffMs: 60000,
    maxBackoffMs: 3600000,
    resetWindowMs: 3600000,
  },
  callgear: {
    maxRetries: 5,
    baseBackoffMs: 1000,
    maxBackoffMs: 60000,
    resetWindowMs: 60000,
  },
  anytrack: {
    maxRetries: 5,
    baseBackoffMs: 1000,
    maxBackoffMs: 60000,
    resetWindowMs: 60000,
  },
  default: {
    maxRetries: 5,
    baseBackoffMs: 1000,
    maxBackoffMs: 300000,
    resetWindowMs: 60000,
  },
};

interface RateLimitResolution {
  error_id: string;
  source: string;
  resolution_type: "backoff_scheduled" | "max_retries_exceeded" | "rate_limit_cleared" | "queued";
  retry_count: number;
  max_retries: number;
  backoff_ms: number;
  next_retry_at: string | null;
  rate_limit_status: "active" | "cleared" | "unknown";
  recommendation: string;
}

interface RateLimitStats {
  source: string;
  active_rate_limits: number;
  total_24h: number;
  avg_backoff_ms: number;
  max_retries_hit: number;
}

interface HandlerReport {
  timestamp: string;
  errors_processed: number;
  backoffs_scheduled: number;
  rate_limits_cleared: number;
  max_retries_exceeded: number;
  resolutions: RateLimitResolution[];
  stats_by_source: RateLimitStats[];
  recommendations: string[];
}

function getBackoffMs(source: string, retryCount: number): number {
  const config = rateLimitConfigs[source.toLowerCase()] || rateLimitConfigs.default;
  // Exponential backoff with jitter
  const exponentialBackoff = Math.pow(2, retryCount) * config.baseBackoffMs;
  const jitter = Math.random() * 0.3 * exponentialBackoff; // 30% jitter
  return Math.min(exponentialBackoff + jitter, config.maxBackoffMs);
}

function getMaxRetries(source: string): number {
  const config = rateLimitConfigs[source.toLowerCase()] || rateLimitConfigs.default;
  return config.maxRetries;
}

async function checkRateLimitStatus(source: string): Promise<"active" | "cleared" | "unknown"> {
  const config = rateLimitConfigs[source.toLowerCase()] || rateLimitConfigs.default;

  // Check if there are recent rate limit errors (within reset window)
  const windowStart = new Date(Date.now() - config.resetWindowMs).toISOString();

  const { data: recentErrors, error } = await supabase
    .from("sync_errors")
    .select("id")
    .eq("source", source)
    .eq("error_type", "rate_limit")
    .is("resolved_at", null)
    .gte("created_at", windowStart)
    .limit(1);

  if (error) return "unknown";
  return recentErrors && recentErrors.length > 0 ? "active" : "cleared";
}

async function processRateLimitError(error: Record<string, unknown>): Promise<RateLimitResolution> {
  const source = String(error.source || "unknown").toLowerCase();
  const retryCount = Number(error.retry_count || 0);
  const maxRetries = getMaxRetries(source);

  // Check if rate limit has cleared
  const rateLimitStatus = await checkRateLimitStatus(source);

  // If rate limit cleared and no recent retries, mark as resolved
  if (rateLimitStatus === "cleared" && retryCount < maxRetries) {
    const now = new Date().toISOString();

    await supabase
      .from("sync_errors")
      .update({
        resolved_at: now,
        error_details: {
          ...error.error_details,
          rate_limit_cleared: true,
          cleared_at: now,
        },
      })
      .eq("id", error.id);

    return {
      error_id: error.id as string,
      source,
      resolution_type: "rate_limit_cleared",
      retry_count: retryCount,
      max_retries: maxRetries,
      backoff_ms: 0,
      next_retry_at: null,
      rate_limit_status: "cleared",
      recommendation: "Rate limit cleared, error resolved",
    };
  }

  // Check if max retries exceeded
  if (retryCount >= maxRetries) {
    return {
      error_id: error.id as string,
      source,
      resolution_type: "max_retries_exceeded",
      retry_count: retryCount,
      max_retries: maxRetries,
      backoff_ms: 0,
      next_retry_at: null,
      rate_limit_status: rateLimitStatus,
      recommendation: `Max retries (${maxRetries}) exceeded. Manual intervention required or request quota increase from ${source}.`,
    };
  }

  // Schedule backoff retry
  const backoffMs = getBackoffMs(source, retryCount);
  const nextRetryAt = new Date(Date.now() + backoffMs);

  await supabase
    .from("sync_errors")
    .update({
      retry_count: retryCount + 1,
      next_retry_at: nextRetryAt.toISOString(),
      error_details: {
        ...error.error_details,
        rate_limit_handler: {
          handled_at: new Date().toISOString(),
          backoff_ms: backoffMs,
          retry_count: retryCount + 1,
        },
      },
    })
    .eq("id", error.id);

  return {
    error_id: error.id as string,
    source,
    resolution_type: "backoff_scheduled",
    retry_count: retryCount + 1,
    max_retries: maxRetries,
    backoff_ms: backoffMs,
    next_retry_at: nextRetryAt.toISOString(),
    rate_limit_status: rateLimitStatus,
    recommendation: `Retry scheduled in ${Math.round(backoffMs / 1000)}s (attempt ${retryCount + 1}/${maxRetries})`,
  };
}

async function calculateStats(): Promise<RateLimitStats[]> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: errors, error } = await supabase
    .from("sync_errors")
    .select("source, retry_count, max_retries, created_at, resolved_at")
    .eq("error_type", "rate_limit")
    .gte("created_at", dayAgo);

  if (error || !errors) return [];

  const statsBySource = new Map<string, { active: number; total: number; totalBackoff: number; maxRetriesHit: number }>();

  for (const err of errors) {
    const source = String(err.source || "unknown").toLowerCase();
    if (!statsBySource.has(source)) {
      statsBySource.set(source, { active: 0, total: 0, totalBackoff: 0, maxRetriesHit: 0 });
    }

    const stats = statsBySource.get(source)!;
    stats.total++;

    if (!err.resolved_at) {
      stats.active++;
    }

    const retryCount = Number(err.retry_count || 0);
    const maxRetries = Number(err.max_retries || getMaxRetries(source));

    if (retryCount >= maxRetries) {
      stats.maxRetriesHit++;
    }

    // Estimate total backoff time
    stats.totalBackoff += getBackoffMs(source, retryCount);
  }

  return Array.from(statsBySource.entries()).map(([source, stats]) => ({
    source,
    active_rate_limits: stats.active,
    total_24h: stats.total,
    avg_backoff_ms: stats.total > 0 ? Math.round(stats.totalBackoff / stats.total) : 0,
    max_retries_hit: stats.maxRetriesHit,
  }));
}

function generateRecommendations(stats: RateLimitStats[]): string[] {
  const recommendations: string[] = [];

  for (const stat of stats) {
    if (stat.active_rate_limits > 5) {
      recommendations.push(`${stat.source}: High rate limit activity (${stat.active_rate_limits} active). Consider reducing request frequency.`);
    }

    if (stat.max_retries_hit > 0) {
      recommendations.push(`${stat.source}: ${stat.max_retries_hit} errors exceeded max retries. Request quota increase.`);
    }

    if (stat.total_24h > 20) {
      recommendations.push(`${stat.source}: ${stat.total_24h} rate limits in 24h. Implement request batching.`);
    }
  }

  if (recommendations.length === 0) {
    recommendations.push("Rate limiting is under control. No immediate action required.");
  }

  return recommendations;
}

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  const startTime = Date.now();

  try {
    if (!envCheck.valid) {
      throw new Error(`Missing required environment variables: ${envCheck.missing.join(", ")}`);
    }

    console.log("[API Rate Limit Handler] Starting rate limit handling...");

    // Fetch all rate limit errors
    const { data: errors, error: fetchError } = await supabase
      .from("sync_errors")
      .select("*")
      .eq("error_type", "rate_limit")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (fetchError) {
      throw new Error(`Failed to fetch errors: ${fetchError.message}`);
    }

    const resolutions: RateLimitResolution[] = [];
    let backoffsScheduled = 0;
    let rateLimitsCleared = 0;
    let maxRetriesExceeded = 0;

    for (const error of errors || []) {
      const resolution = await processRateLimitError(error);
      resolutions.push(resolution);

      switch (resolution.resolution_type) {
        case "backoff_scheduled":
          backoffsScheduled++;
          break;
        case "rate_limit_cleared":
          rateLimitsCleared++;
          break;
        case "max_retries_exceeded":
          maxRetriesExceeded++;
          break;
      }
    }

    // Calculate statistics
    const stats = await calculateStats();
    const recommendations = generateRecommendations(stats);

    const report: HandlerReport = {
      timestamp: new Date().toISOString(),
      errors_processed: (errors || []).length,
      backoffs_scheduled: backoffsScheduled,
      rate_limits_cleared: rateLimitsCleared,
      max_retries_exceeded: maxRetriesExceeded,
      resolutions,
      stats_by_source: stats,
      recommendations,
    };

    // Alert if significant rate limiting issues
    if (maxRetriesExceeded > 0) {
      await supabase.from("proactive_insights").upsert({
        insight_type: "rate_limit_exceeded",
        priority: "high",
        title: `Rate Limits: ${maxRetriesExceeded} errors exceeded max retries`,
        content: recommendations.join(" "),
        action_items: [
          "Review API usage patterns",
          "Request quota increases",
          "Implement request batching",
        ],
        affected_entities: { exceeded_count: maxRetriesExceeded, stats },
        source_agent: "api_rate_limit_handler",
        dedup_key: `rate_limit_exceeded_${new Date().toISOString().split("T")[0]}`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "dedup_key", ignoreDuplicates: true });
    }

    const duration = Date.now() - startTime;
    console.log(`[API Rate Limit Handler] Complete in ${duration}ms - Scheduled: ${backoffsScheduled}, Cleared: ${rateLimitsCleared}, Exceeded: ${maxRetriesExceeded}`);

    return apiError("INTERNAL_ERROR", JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: unknown) {
    console.error("[API Rate Limit Handler] Error:", error);
    return apiSuccess({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
