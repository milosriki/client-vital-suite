import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// CALLGEAR ERROR HANDLER AGENT
// Specialized handler for Callgear integration errors
// Handles call tracking and communication issues
// ============================================

import {
  handleError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";

function validateEnv(): { valid: boolean; missing: string[] } {
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter((key) => !Deno.env.get(key));
  return { valid: missing.length === 0, missing };
}

const envCheck = validateEnv();
if (!envCheck.valid) {
  console.error(
    "[Callgear Error Handler] Missing required environment variables:",
    envCheck.missing,
  );
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
);

const CALLGEAR_API_KEY = Deno.env.get("CALLGEAR_API_KEY");

interface CallgearErrorResolution {
  error_id: string;
  error_category:
    | "auth"
    | "rate_limit"
    | "webhook"
    | "data_sync"
    | "call_tracking"
    | "server"
    | "unknown";
  resolution_attempted: boolean;
  resolution_success: boolean;
  resolution_action: string;
  affects_call_tracking: boolean;
  details: Record<string, unknown>;
  next_steps: string[];
}

interface HandlerReport {
  timestamp: string;
  errors_processed: number;
  resolutions_attempted: number;
  resolutions_successful: number;
  resolutions: CallgearErrorResolution[];
  callgear_api_status: "healthy" | "degraded" | "down" | "unknown";
  call_tracking_impact: boolean;
}

async function checkCallgearApiHealth(): Promise<
  "healthy" | "degraded" | "down" | "unknown"
> {
  if (!CALLGEAR_API_KEY) {
    return "unknown";
  }

  try {
    // Simple health check - adjust endpoint as needed
    const response = await fetch("https://api.callgear.com/v1/health", {
      headers: { Authorization: `Bearer ${CALLGEAR_API_KEY}` },
    });

    if (response.status === 200) return "healthy";
    if (response.status === 429) return "degraded";
    if (response.status >= 500) return "down";
    if (response.status === 401 || response.status === 403) return "degraded";
    return "unknown";
  } catch {
    // API endpoint may not exist, return unknown
    return "unknown";
  }
}

function categorizeCallgearError(
  error: Record<string, unknown>,
): CallgearErrorResolution["error_category"] {
  const errorType = String(error.error_type || "").toLowerCase();
  const message = String(error.error_message || "").toLowerCase();

  if (
    errorType === "auth" ||
    message.includes("unauthorized") ||
    message.includes("api key") ||
    message.includes("401")
  ) {
    return "auth";
  }
  if (
    errorType === "rate_limit" ||
    message.includes("rate limit") ||
    message.includes("429")
  ) {
    return "rate_limit";
  }
  if (message.includes("webhook") || message.includes("callback")) {
    return "webhook";
  }
  if (message.includes("sync") || message.includes("data")) {
    return "data_sync";
  }
  if (
    message.includes("call") ||
    message.includes("tracking") ||
    message.includes("recording")
  ) {
    return "call_tracking";
  }
  if (
    message.includes("server") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503")
  ) {
    return "server";
  }
  return "unknown";
}

async function handleAuthError(
  error: Record<string, unknown>,
): Promise<CallgearErrorResolution> {
  const resolution: CallgearErrorResolution = {
    error_id: error.id as string,
    error_category: "auth",
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Checking Callgear API key",
    affects_call_tracking: true,
    details: {},
    next_steps: [],
  };

  if (!CALLGEAR_API_KEY) {
    resolution.resolution_action = "No Callgear API key configured";
    resolution.next_steps = [
      "Configure CALLGEAR_API_KEY environment variable",
      "Generate API key in Callgear dashboard",
      "Verify key permissions",
    ];
  } else {
    resolution.next_steps = [
      "Verify API key in Callgear dashboard",
      "Check if key has been rotated",
      "Ensure key has required permissions",
    ];
  }

  return resolution;
}

async function handleRateLimitError(
  error: Record<string, unknown>,
): Promise<CallgearErrorResolution> {
  const resolution: CallgearErrorResolution = {
    error_id: error.id as string,
    error_category: "rate_limit",
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Implementing rate limit backoff",
    affects_call_tracking: true,
    details: {},
    next_steps: [],
  };

  const retryCount = Number(error.retry_count || 0);
  const backoffMs = Math.min(Math.pow(2, retryCount) * 1000, 60000);
  const nextRetryAt = new Date(Date.now() + backoffMs);

  await supabase
    .from("sync_errors")
    .update({
      retry_count: retryCount + 1,
      next_retry_at: nextRetryAt.toISOString(),
    })
    .eq("id", error.id);

  resolution.resolution_success = true;
  resolution.resolution_action = `Scheduled retry in ${backoffMs / 1000} seconds`;
  resolution.details = { backoff_ms: backoffMs };
  resolution.next_steps = [
    "Automatic retry scheduled",
    "Consider reducing poll frequency",
    "Batch requests where possible",
  ];

  return resolution;
}

async function handleWebhookError(
  error: Record<string, unknown>,
): Promise<CallgearErrorResolution> {
  const resolution: CallgearErrorResolution = {
    error_id: error.id as string,
    error_category: "webhook",
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Analyzing webhook error",
    affects_call_tracking: true,
    details: {},
    next_steps: [],
  };

  const message = String(error.error_message || "").toLowerCase();

  if (message.includes("signature") || message.includes("verification")) {
    resolution.next_steps = [
      "Verify webhook signing secret",
      "Check Callgear webhook configuration",
      "Ensure endpoint is correctly configured",
    ];
  } else if (message.includes("timeout")) {
    resolution.next_steps = [
      "Optimize webhook handler performance",
      "Increase timeout threshold",
      "Check for blocking operations",
    ];
  } else {
    resolution.next_steps = [
      "Review webhook payload format",
      "Check endpoint availability",
      "Verify Callgear webhook settings",
    ];
  }

  return resolution;
}

async function handleDataSyncError(
  error: Record<string, unknown>,
): Promise<CallgearErrorResolution> {
  const resolution: CallgearErrorResolution = {
    error_id: error.id as string,
    error_category: "data_sync",
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Analyzing data sync error",
    affects_call_tracking: false,
    details: {},
    next_steps: [],
  };

  const message = String(error.error_message || "").toLowerCase();

  if (message.includes("duplicate")) {
    resolution.next_steps = [
      "Check for duplicate call records",
      "Review deduplication logic",
      "Verify unique identifiers",
    ];
  } else if (message.includes("missing") || message.includes("required")) {
    resolution.next_steps = [
      "Check required fields in Callgear data",
      "Update field mapping",
      "Add default values for missing fields",
    ];
  } else {
    resolution.next_steps = [
      "Review data transformation logic",
      "Check Callgear API response format",
      "Verify database schema compatibility",
    ];
  }

  return resolution;
}

async function handleCallTrackingError(
  error: Record<string, unknown>,
): Promise<CallgearErrorResolution> {
  const resolution: CallgearErrorResolution = {
    error_id: error.id as string,
    error_category: "call_tracking",
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Analyzing call tracking error",
    affects_call_tracking: true,
    details: {},
    next_steps: [],
  };

  const message = String(error.error_message || "").toLowerCase();

  if (message.includes("recording")) {
    resolution.next_steps = [
      "Check call recording settings",
      "Verify storage permissions",
      "Review recording retrieval logic",
    ];
  } else if (message.includes("number") || message.includes("phone")) {
    resolution.next_steps = [
      "Validate phone number formats",
      "Check tracking number configuration",
      "Verify number pool availability",
    ];
  } else {
    resolution.next_steps = [
      "Review Callgear tracking configuration",
      "Check call routing settings",
      "Verify integration setup",
    ];
  }

  return resolution;
}

async function handleServerError(
  error: Record<string, unknown>,
): Promise<CallgearErrorResolution> {
  const resolution: CallgearErrorResolution = {
    error_id: error.id as string,
    error_category: "server",
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Callgear server error - scheduling retry",
    affects_call_tracking: true,
    details: {},
    next_steps: [],
  };

  const retryCount = Number(error.retry_count || 0);
  const backoffMs = Math.min(Math.pow(2, retryCount + 1) * 1000, 300000);
  const nextRetryAt = new Date(Date.now() + backoffMs);

  await supabase
    .from("sync_errors")
    .update({
      retry_count: retryCount + 1,
      next_retry_at: nextRetryAt.toISOString(),
    })
    .eq("id", error.id);

  resolution.resolution_success = true;
  resolution.resolution_action = `Scheduled retry in ${Math.round(backoffMs / 1000)} seconds`;
  resolution.next_steps = [
    "Check Callgear status page",
    "Monitor for service recovery",
    "Retry will be attempted automatically",
  ];

  return resolution;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    if (!envCheck.valid) {
      throw new Error(
        `Missing required environment variables: ${envCheck.missing.join(", ")}`,
      );
    }

    console.log("[Callgear Error Handler] Starting error handling...");

    const apiStatus = await checkCallgearApiHealth();
    console.log(`[Callgear Error Handler] API Status: ${apiStatus}`);

    // Fetch Callgear-related errors
    const { data: errors, error: fetchError } = await supabase
      .from("sync_errors")
      .select("*")
      .is("resolved_at", null)
      .eq("source", "callgear")
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch errors: ${fetchError.message}`);
    }

    const resolutions: CallgearErrorResolution[] = [];
    let resolutionsSuccessful = 0;
    let callTrackingImpact = false;

    for (const error of errors || []) {
      const category = categorizeCallgearError(error);
      let resolution: CallgearErrorResolution;

      switch (category) {
        case "auth":
          resolution = await handleAuthError(error);
          break;
        case "rate_limit":
          resolution = await handleRateLimitError(error);
          break;
        case "webhook":
          resolution = await handleWebhookError(error);
          break;
        case "data_sync":
          resolution = await handleDataSyncError(error);
          break;
        case "call_tracking":
          resolution = await handleCallTrackingError(error);
          break;
        case "server":
          resolution = await handleServerError(error);
          break;
        default:
          resolution = {
            error_id: error.id,
            error_category: "unknown",
            resolution_attempted: false,
            resolution_success: false,
            resolution_action: "Manual investigation required",
            affects_call_tracking: true,
            details: {},
            next_steps: [
              "Review error details",
              "Check Callgear documentation",
            ],
          };
      }

      resolutions.push(resolution);
      if (resolution.resolution_success) resolutionsSuccessful++;
      if (resolution.affects_call_tracking) callTrackingImpact = true;
    }

    const report: HandlerReport = {
      timestamp: new Date().toISOString(),
      errors_processed: (errors || []).length,
      resolutions_attempted: resolutions.filter((r) => r.resolution_attempted)
        .length,
      resolutions_successful: resolutionsSuccessful,
      resolutions,
      callgear_api_status: apiStatus,
      call_tracking_impact: callTrackingImpact,
    };

    const duration = Date.now() - startTime;
    console.log(
      `[Callgear Error Handler] Complete in ${duration}ms - ${resolutionsSuccessful}/${(errors || []).length} resolved`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: duration,
        report,
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error) {
    console.error("[Callgear Error Handler] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});
