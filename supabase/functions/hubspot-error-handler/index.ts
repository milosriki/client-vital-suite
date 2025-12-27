import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// HUBSPOT ERROR HANDLER AGENT
// Specialized handler for HubSpot integration errors
// Implements HubSpot-specific recovery strategies
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
  console.error("[HubSpot Error Handler] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");

interface HubSpotErrorResolution {
  error_id: string;
  error_category: "auth" | "rate_limit" | "validation" | "not_found" | "server" | "unknown";
  resolution_attempted: boolean;
  resolution_success: boolean;
  resolution_action: string;
  details: Record<string, unknown>;
  next_steps: string[];
}

interface HandlerReport {
  timestamp: string;
  errors_processed: number;
  resolutions_attempted: number;
  resolutions_successful: number;
  resolutions: HubSpotErrorResolution[];
  hubspot_api_status: "healthy" | "degraded" | "down" | "unknown";
}

async function checkHubSpotApiHealth(): Promise<"healthy" | "degraded" | "down" | "unknown"> {
  if (!HUBSPOT_API_KEY) {
    return "unknown";
  }

  try {
    const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
      headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` },
    });

    if (response.status === 200) return "healthy";
    if (response.status === 429) return "degraded";
    if (response.status >= 500) return "down";
    return "degraded";
  } catch {
    return "down";
  }
}

function categorizeHubSpotError(error: Record<string, unknown>): HubSpotErrorResolution["error_category"] {
  const errorType = String(error.error_type || "").toLowerCase();
  const message = String(error.error_message || "").toLowerCase();
  const statusCode = Number(error.error_details?.status_code || error.error_details?.statusCode || 0);

  if (errorType === "auth" || statusCode === 401 || message.includes("unauthorized") || message.includes("invalid token")) {
    return "auth";
  }
  if (errorType === "rate_limit" || statusCode === 429 || message.includes("rate limit") || message.includes("too many")) {
    return "rate_limit";
  }
  if (errorType === "validation" || statusCode === 400 || message.includes("invalid") || message.includes("validation")) {
    return "validation";
  }
  if (statusCode === 404 || message.includes("not found")) {
    return "not_found";
  }
  if (statusCode >= 500) {
    return "server";
  }
  return "unknown";
}

async function handleAuthError(error: Record<string, unknown>): Promise<HubSpotErrorResolution> {
  const resolution: HubSpotErrorResolution = {
    error_id: error.id as string,
    error_category: "auth",
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Checking API key validity",
    details: {},
    next_steps: [],
  };

  // Check if API key is configured
  if (!HUBSPOT_API_KEY) {
    resolution.resolution_action = "No HubSpot API key configured";
    resolution.next_steps = [
      "Configure HUBSPOT_API_KEY environment variable",
      "Generate new API key from HubSpot settings",
      "Verify key has required scopes",
    ];
    return resolution;
  }

  // Test API key
  try {
    const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
      headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` },
    });

    if (response.status === 200) {
      resolution.resolution_success = true;
      resolution.resolution_action = "API key is valid - marking error as resolved";
      resolution.details = { api_key_valid: true };
      resolution.next_steps = ["Error may have been transient", "Monitor for recurrence"];

      // Mark error as resolved
      await supabase
        .from("sync_errors")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", error.id);
    } else {
      resolution.details = { status: response.status, api_key_valid: false };
      resolution.next_steps = [
        "Regenerate HubSpot API key",
        "Check API key permissions",
        "Verify HubSpot account status",
      ];
    }
  } catch (e) {
    resolution.details = { test_error: e instanceof Error ? e.message : "Unknown" };
    resolution.next_steps = ["Check network connectivity", "Verify HubSpot API availability"];
  }

  return resolution;
}

async function handleRateLimitError(error: Record<string, unknown>): Promise<HubSpotErrorResolution> {
  const resolution: HubSpotErrorResolution = {
    error_id: error.id as string,
    error_category: "rate_limit",
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Implementing backoff strategy",
    details: {},
    next_steps: [],
  };

  const retryCount = Number(error.retry_count || 0);
  const maxRetries = Number(error.max_retries || 5);

  if (retryCount < maxRetries) {
    // Calculate backoff time (exponential)
    const backoffMs = Math.min(Math.pow(2, retryCount) * 1000, 60000);
    const nextRetryAt = new Date(Date.now() + backoffMs);

    await supabase
      .from("sync_errors")
      .update({
        retry_count: retryCount + 1,
        next_retry_at: nextRetryAt.toISOString(),
        error_details: {
          ...error.error_details,
          backoff_ms: backoffMs,
          rate_limit_handled: true,
        },
      })
      .eq("id", error.id);

    resolution.resolution_success = true;
    resolution.resolution_action = `Scheduled retry in ${backoffMs / 1000} seconds`;
    resolution.details = { backoff_ms: backoffMs, retry_count: retryCount + 1 };
    resolution.next_steps = ["Retry will be attempted automatically", "Monitor rate limit frequency"];
  } else {
    resolution.resolution_action = "Max retries exceeded";
    resolution.details = { retry_count: retryCount, max_retries: maxRetries };
    resolution.next_steps = [
      "Request HubSpot rate limit increase",
      "Reduce API call frequency",
      "Implement request batching",
      "Manual intervention required",
    ];
  }

  return resolution;
}

async function handleValidationError(error: Record<string, unknown>): Promise<HubSpotErrorResolution> {
  const resolution: HubSpotErrorResolution = {
    error_id: error.id as string,
    error_category: "validation",
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Analyzing validation failure",
    details: {},
    next_steps: [],
  };

  const message = String(error.error_message || "");
  const payload = error.request_payload as Record<string, unknown> | undefined;

  // Try to identify the problematic field
  const fieldMatch = message.match(/(?:field|property)\s*['":]?\s*(\w+)/i);
  const problematicField = fieldMatch ? fieldMatch[1] : null;

  if (problematicField) {
    resolution.details = { problematic_field: problematicField };
    resolution.next_steps = [
      `Review field mapping for "${problematicField}"`,
      "Check HubSpot property definition",
      "Validate data format and type",
    ];
  }

  if (payload) {
    resolution.details = { ...resolution.details, payload_keys: Object.keys(payload) };
  }

  // Log for manual review
  resolution.resolution_action = "Validation error requires manual review";
  resolution.next_steps.push("Review request payload", "Check HubSpot property requirements");

  return resolution;
}

async function handleNotFoundError(error: Record<string, unknown>): Promise<HubSpotErrorResolution> {
  const resolution: HubSpotErrorResolution = {
    error_id: error.id as string,
    error_category: "not_found",
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Resource not found in HubSpot",
    details: {},
    next_steps: [],
  };

  const message = String(error.error_message || "");

  // Try to identify what wasn't found
  const idMatch = message.match(/(?:id|record)\s*['":]?\s*(\d+)/i);
  const resourceId = idMatch ? idMatch[1] : null;

  if (resourceId) {
    resolution.details = { missing_resource_id: resourceId };
    resolution.next_steps = [
      `Verify resource ${resourceId} exists in HubSpot`,
      "Check if resource was deleted",
      "Update local reference to valid resource",
    ];
  } else {
    resolution.next_steps = [
      "Verify HubSpot resource exists",
      "Check for sync issues",
      "Update local data to match HubSpot",
    ];
  }

  return resolution;
}

async function handleServerError(error: Record<string, unknown>): Promise<HubSpotErrorResolution> {
  const resolution: HubSpotErrorResolution = {
    error_id: error.id as string,
    error_category: "server",
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "HubSpot server error detected",
    details: {},
    next_steps: [],
  };

  // Schedule retry with longer backoff for server errors
  const retryCount = Number(error.retry_count || 0);
  const backoffMs = Math.min(Math.pow(2, retryCount + 2) * 1000, 300000); // Longer backoff for server errors
  const nextRetryAt = new Date(Date.now() + backoffMs);

  await supabase
    .from("sync_errors")
    .update({
      retry_count: retryCount + 1,
      next_retry_at: nextRetryAt.toISOString(),
    })
    .eq("id", error.id);

  resolution.resolution_success = true;
  resolution.resolution_action = `Scheduled retry in ${backoffMs / 1000} seconds (server error)`;
  resolution.details = { backoff_ms: backoffMs };
  resolution.next_steps = [
    "Check HubSpot status page",
    "Monitor for HubSpot service recovery",
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
      throw new Error(`Missing required environment variables: ${envCheck.missing.join(", ")}`);
    }

    console.log("[HubSpot Error Handler] Starting error handling...");

    // Check HubSpot API health
    const apiStatus = await checkHubSpotApiHealth();
    console.log(`[HubSpot Error Handler] API Status: ${apiStatus}`);

    // Fetch HubSpot-related errors
    const { data: errors, error: fetchError } = await supabase
      .from("sync_errors")
      .select("*")
      .is("resolved_at", null)
      .eq("source", "hubspot")
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch errors: ${fetchError.message}`);
    }

    const resolutions: HubSpotErrorResolution[] = [];
    let resolutionsSuccessful = 0;

    for (const error of errors || []) {
      const category = categorizeHubSpotError(error);
      let resolution: HubSpotErrorResolution;

      switch (category) {
        case "auth":
          resolution = await handleAuthError(error);
          break;
        case "rate_limit":
          resolution = await handleRateLimitError(error);
          break;
        case "validation":
          resolution = await handleValidationError(error);
          break;
        case "not_found":
          resolution = await handleNotFoundError(error);
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
            resolution_action: "No automatic resolution available",
            details: {},
            next_steps: ["Manual investigation required", "Check error logs"],
          };
      }

      resolutions.push(resolution);
      if (resolution.resolution_success) {
        resolutionsSuccessful++;
      }
    }

    const report: HandlerReport = {
      timestamp: new Date().toISOString(),
      errors_processed: (errors || []).length,
      resolutions_attempted: resolutions.filter(r => r.resolution_attempted).length,
      resolutions_successful: resolutionsSuccessful,
      resolutions,
      hubspot_api_status: apiStatus,
    };

    const duration = Date.now() - startTime;
    console.log(`[HubSpot Error Handler] Complete in ${duration}ms - ${resolutionsSuccessful}/${(errors || []).length} resolved`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[HubSpot Error Handler] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
