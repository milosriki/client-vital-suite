import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// ERROR RETRY ORCHESTRATOR AGENT
// Manages retry logic with intelligent backoff
// Coordinates retry attempts across all error types
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
  console.error("[Error Retry Orchestrator] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterPercent: number;
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 300000, // 5 minutes
  backoffMultiplier: 2,
  jitterPercent: 0.2,
};

// Source-specific retry configurations
const sourceConfigs: Record<string, Partial<RetryConfig>> = {
  stripe: { maxRetries: 4, baseDelayMs: 1000, maxDelayMs: 60000 },
  hubspot: { maxRetries: 5, baseDelayMs: 1000, maxDelayMs: 60000 },
  meta: { maxRetries: 3, baseDelayMs: 60000, maxDelayMs: 3600000 },
  facebook: { maxRetries: 3, baseDelayMs: 60000, maxDelayMs: 3600000 },
  callgear: { maxRetries: 5, baseDelayMs: 2000, maxDelayMs: 120000 },
};

// Error type-specific configurations
const typeConfigs: Record<string, Partial<RetryConfig>> = {
  rate_limit: { baseDelayMs: 30000, maxDelayMs: 600000 },
  auth: { maxRetries: 2, baseDelayMs: 5000 },
  timeout: { maxRetries: 4, baseDelayMs: 5000 },
  network: { maxRetries: 5, baseDelayMs: 2000 },
  server: { maxRetries: 4, baseDelayMs: 10000 },
};

interface RetryDecision {
  error_id: string;
  should_retry: boolean;
  retry_count: number;
  max_retries: number;
  delay_ms: number;
  next_retry_at: string | null;
  reason: string;
  strategy: string;
}

interface OrchestratorReport {
  timestamp: string;
  errors_evaluated: number;
  retries_scheduled: number;
  retries_exhausted: number;
  retries_blocked: number;
  decisions: RetryDecision[];
  retry_queue_status: {
    pending: number;
    overdue: number;
    next_retry_in_ms: number | null;
  };
}

function getRetryConfig(source: string, errorType: string): RetryConfig {
  const config = { ...defaultRetryConfig };

  // Apply source-specific config
  if (sourceConfigs[source.toLowerCase()]) {
    Object.assign(config, sourceConfigs[source.toLowerCase()]);
  }

  // Apply error type-specific config (overrides source config)
  if (typeConfigs[errorType.toLowerCase()]) {
    Object.assign(config, typeConfigs[errorType.toLowerCase()]);
  }

  return config;
}

function calculateDelay(retryCount: number, config: RetryConfig): number {
  // Exponential backoff with jitter
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, retryCount);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter
  const jitter = cappedDelay * config.jitterPercent * (Math.random() * 2 - 1);

  return Math.round(cappedDelay + jitter);
}

function shouldRetry(error: Record<string, unknown>, config: RetryConfig): { should: boolean; reason: string } {
  const retryCount = Number(error.retry_count || 0);

  // Check max retries
  if (retryCount >= config.maxRetries) {
    return { should: false, reason: `Max retries (${config.maxRetries}) exceeded` };
  }

  // Check error type - some errors shouldn't be retried
  const errorType = String(error.error_type || "").toLowerCase();
  const message = String(error.error_message || "").toLowerCase();

  // Don't retry authentication errors without intervention
  if (errorType === "auth" && retryCount > 1) {
    return { should: false, reason: "Auth error requires manual intervention" };
  }

  // Don't retry validation errors - they'll keep failing
  if (errorType === "validation" && !message.includes("transient")) {
    return { should: false, reason: "Validation error - fix data before retry" };
  }

  // Don't retry if explicitly marked as non-retryable
  if (error.error_details && (error.error_details as Record<string, unknown>).non_retryable) {
    return { should: false, reason: "Error marked as non-retryable" };
  }

  return { should: true, reason: "Eligible for retry" };
}

async function evaluateError(error: Record<string, unknown>): Promise<RetryDecision> {
  const source = String(error.source || "unknown");
  const errorType = String(error.error_type || "unknown");
  const config = getRetryConfig(source, errorType);

  const { should, reason } = shouldRetry(error, config);
  const retryCount = Number(error.retry_count || 0);

  if (!should) {
    return {
      error_id: error.id as string,
      should_retry: false,
      retry_count: retryCount,
      max_retries: config.maxRetries,
      delay_ms: 0,
      next_retry_at: null,
      reason,
      strategy: "blocked",
    };
  }

  const delayMs = calculateDelay(retryCount, config);
  const nextRetryAt = new Date(Date.now() + delayMs);

  // Update error with retry info
  await supabase
    .from("sync_errors")
    .update({
      retry_count: retryCount + 1,
      max_retries: config.maxRetries,
      next_retry_at: nextRetryAt.toISOString(),
      error_details: {
        ...error.error_details,
        retry_orchestrator: {
          scheduled_at: new Date().toISOString(),
          delay_ms: delayMs,
          attempt: retryCount + 1,
          strategy: `exponential_backoff_${config.backoffMultiplier}x`,
        },
      },
    })
    .eq("id", error.id);

  return {
    error_id: error.id as string,
    should_retry: true,
    retry_count: retryCount + 1,
    max_retries: config.maxRetries,
    delay_ms: delayMs,
    next_retry_at: nextRetryAt.toISOString(),
    reason: `Retry ${retryCount + 1}/${config.maxRetries} scheduled`,
    strategy: `exponential_backoff_${config.backoffMultiplier}x`,
  };
}

async function getRetryQueueStatus(): Promise<OrchestratorReport["retry_queue_status"]> {
  const now = new Date().toISOString();

  // Count pending retries
  const { count: pending } = await supabase
    .from("sync_errors")
    .select("*", { count: "exact", head: true })
    .is("resolved_at", null)
    .not("next_retry_at", "is", null);

  // Count overdue retries
  const { count: overdue } = await supabase
    .from("sync_errors")
    .select("*", { count: "exact", head: true })
    .is("resolved_at", null)
    .not("next_retry_at", "is", null)
    .lt("next_retry_at", now);

  // Get next retry time
  const { data: nextRetry } = await supabase
    .from("sync_errors")
    .select("next_retry_at")
    .is("resolved_at", null)
    .not("next_retry_at", "is", null)
    .gt("next_retry_at", now)
    .order("next_retry_at", { ascending: true })
    .limit(1)
    .single();

  const nextRetryInMs = nextRetry
    ? new Date(nextRetry.next_retry_at).getTime() - Date.now()
    : null;

  return {
    pending: pending || 0,
    overdue: overdue || 0,
    next_retry_in_ms: nextRetryInMs,
  };
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

    console.log("[Error Retry Orchestrator] Starting retry orchestration...");

    // Fetch errors that need retry evaluation
    // Focus on errors without scheduled retries or with overdue retries
    const { data: errors, error: fetchError } = await supabase
      .from("sync_errors")
      .select("*")
      .is("resolved_at", null)
      .or(`next_retry_at.is.null,next_retry_at.lt.${new Date().toISOString()}`)
      .order("created_at", { ascending: true })
      .limit(100);

    if (fetchError) {
      throw new Error(`Failed to fetch errors: ${fetchError.message}`);
    }

    const decisions: RetryDecision[] = [];
    let retriesScheduled = 0;
    let retriesExhausted = 0;
    let retriesBlocked = 0;

    for (const error of errors || []) {
      const decision = await evaluateError(error);
      decisions.push(decision);

      if (decision.should_retry) {
        retriesScheduled++;
      } else if (decision.retry_count >= decision.max_retries) {
        retriesExhausted++;
      } else {
        retriesBlocked++;
      }
    }

    // Get current queue status
    const queueStatus = await getRetryQueueStatus();

    const report: OrchestratorReport = {
      timestamp: new Date().toISOString(),
      errors_evaluated: (errors || []).length,
      retries_scheduled: retriesScheduled,
      retries_exhausted: retriesExhausted,
      retries_blocked: retriesBlocked,
      decisions,
      retry_queue_status: queueStatus,
    };

    // Alert if many retries exhausted
    if (retriesExhausted > 5) {
      await supabase.from("proactive_insights").upsert({
        insight_type: "retry_exhaustion",
        priority: "high",
        title: `Retry Orchestrator: ${retriesExhausted} errors exhausted retries`,
        content: `${retriesExhausted} errors have exceeded max retry attempts and require manual intervention.`,
        action_items: [
          "Review exhausted errors",
          "Check for systemic issues",
          "Consider increasing retry limits",
        ],
        affected_entities: { exhausted_count: retriesExhausted },
        source_agent: "error_retry_orchestrator",
        dedup_key: `retry_exhaustion_${new Date().toISOString().split("T")[0]}`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "dedup_key", ignoreDuplicates: true });
    }

    const duration = Date.now() - startTime;
    console.log(`[Error Retry Orchestrator] Complete in ${duration}ms - Scheduled: ${retriesScheduled}, Exhausted: ${retriesExhausted}`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[Error Retry Orchestrator] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
