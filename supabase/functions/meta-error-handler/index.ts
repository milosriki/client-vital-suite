import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// META ERROR HANDLER AGENT
// Specialized handler for Facebook/Meta API errors
// Handles Conversions API and Marketing API issues
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
  console.error("[Meta Error Handler] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN") || Deno.env.get("FACEBOOK_ACCESS_TOKEN");

interface MetaErrorResolution {
  error_id: string;
  error_category: "auth" | "rate_limit" | "validation" | "permissions" | "capi" | "pixel" | "server" | "unknown";
  meta_error_code: number | null;
  resolution_attempted: boolean;
  resolution_success: boolean;
  resolution_action: string;
  affects_attribution: boolean;
  details: Record<string, unknown>;
  next_steps: string[];
}

interface HandlerReport {
  timestamp: string;
  errors_processed: number;
  resolutions_attempted: number;
  resolutions_successful: number;
  resolutions: MetaErrorResolution[];
  meta_api_status: "healthy" | "degraded" | "down" | "unknown";
  attribution_impact: boolean;
}

async function checkMetaApiHealth(): Promise<"healthy" | "degraded" | "down" | "unknown"> {
  if (!META_ACCESS_TOKEN) {
    return "unknown";
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${META_ACCESS_TOKEN}`
    );

    if (response.status === 200) return "healthy";
    if (response.status === 429) return "degraded";
    if (response.status >= 500) return "down";
    return "degraded";
  } catch {
    return "down";
  }
}

function categorizeMetaError(error: Record<string, unknown>): { category: MetaErrorResolution["error_category"]; code: number | null } {
  const errorType = String(error.error_type || "").toLowerCase();
  const message = String(error.error_message || "").toLowerCase();
  const errorCode = Number(error.error_details?.code || error.error_details?.error_code || 0);

  // Meta-specific error codes
  // 190: Invalid OAuth access token
  // 100: Invalid parameter
  // 4: Application request limit reached
  // 17: User request limit reached
  // 803: Permissions error

  if (errorCode === 190 || errorType === "auth" || message.includes("access token")) {
    return { category: "auth", code: errorCode || 190 };
  }
  if (errorCode === 4 || errorCode === 17 || message.includes("rate limit") || message.includes("limit reached")) {
    return { category: "rate_limit", code: errorCode || 4 };
  }
  if (errorCode === 803 || message.includes("permission")) {
    return { category: "permissions", code: errorCode || 803 };
  }
  if (message.includes("capi") || message.includes("conversion") || message.includes("event")) {
    return { category: "capi", code: errorCode };
  }
  if (message.includes("pixel")) {
    return { category: "pixel", code: errorCode };
  }
  if (errorCode === 100 || message.includes("invalid") || message.includes("parameter")) {
    return { category: "validation", code: errorCode || 100 };
  }
  if (errorCode >= 500 || message.includes("server")) {
    return { category: "server", code: errorCode };
  }
  return { category: "unknown", code: errorCode || null };
}

async function handleAuthError(error: Record<string, unknown>): Promise<MetaErrorResolution> {
  const resolution: MetaErrorResolution = {
    error_id: error.id as string,
    error_category: "auth",
    meta_error_code: 190,
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Checking Meta access token",
    affects_attribution: true,
    details: {},
    next_steps: [],
  };

  if (!META_ACCESS_TOKEN) {
    resolution.resolution_action = "No Meta access token configured";
    resolution.next_steps = [
      "Generate new access token in Meta Business Suite",
      "Configure META_ACCESS_TOKEN or FACEBOOK_ACCESS_TOKEN",
      "Ensure token has required permissions",
    ];
    return resolution;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${META_ACCESS_TOKEN}`
    );

    if (response.status === 200) {
      resolution.resolution_success = true;
      resolution.resolution_action = "Token is valid - marking error as resolved";
      await supabase
        .from("sync_errors")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", error.id);
    } else {
      const errorData = await response.json();
      resolution.details = { api_response: errorData };
      resolution.next_steps = [
        "Token is invalid or expired",
        "Generate new long-lived access token",
        "Check token permissions in Meta Business Suite",
      ];
    }
  } catch (e) {
    resolution.details = { test_error: e instanceof Error ? e.message : "Unknown" };
  }

  return resolution;
}

async function handleRateLimitError(error: Record<string, unknown>): Promise<MetaErrorResolution> {
  const resolution: MetaErrorResolution = {
    error_id: error.id as string,
    error_category: "rate_limit",
    meta_error_code: 4,
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Implementing Meta rate limit backoff",
    affects_attribution: true,
    details: {},
    next_steps: [],
  };

  const retryCount = Number(error.retry_count || 0);
  // Meta recommends waiting at least 1 hour for rate limits
  const backoffMs = Math.min(Math.pow(2, retryCount) * 60000, 3600000); // Max 1 hour
  const nextRetryAt = new Date(Date.now() + backoffMs);

  await supabase
    .from("sync_errors")
    .update({
      retry_count: retryCount + 1,
      next_retry_at: nextRetryAt.toISOString(),
    })
    .eq("id", error.id);

  resolution.resolution_success = true;
  resolution.resolution_action = `Scheduled retry in ${Math.round(backoffMs / 60000)} minutes`;
  resolution.details = { backoff_minutes: Math.round(backoffMs / 60000) };
  resolution.next_steps = [
    "Reduce API call frequency",
    "Batch events where possible",
    "Check API usage in Meta Business Suite",
  ];

  return resolution;
}

async function handleCapiError(error: Record<string, unknown>): Promise<MetaErrorResolution> {
  const resolution: MetaErrorResolution = {
    error_id: error.id as string,
    error_category: "capi",
    meta_error_code: null,
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Analyzing Conversions API error",
    affects_attribution: true,
    details: {},
    next_steps: [],
  };

  const message = String(error.error_message || "").toLowerCase();
  const payload = error.request_payload as Record<string, unknown> | undefined;

  // Common CAPI issues
  if (message.includes("event_name")) {
    resolution.details = { issue: "Invalid event name" };
    resolution.next_steps = [
      "Use standard event names (Purchase, Lead, etc.)",
      "Check event name spelling",
      "Review Meta CAPI documentation",
    ];
  } else if (message.includes("user_data")) {
    resolution.details = { issue: "Invalid user data" };
    resolution.next_steps = [
      "Ensure user data is properly hashed (SHA256)",
      "Include at least one identifier (email, phone, etc.)",
      "Validate user data format",
    ];
  } else if (message.includes("action_source")) {
    resolution.details = { issue: "Invalid action source" };
    resolution.next_steps = [
      "Use valid action_source values",
      "Valid: website, app, email, phone_call, etc.",
    ];
  } else {
    resolution.next_steps = [
      "Review CAPI event payload",
      "Check event_time format (Unix timestamp)",
      "Validate all required fields",
    ];
  }

  if (payload) {
    resolution.details = { ...resolution.details, payload_fields: Object.keys(payload) };
  }

  return resolution;
}

async function handlePermissionsError(error: Record<string, unknown>): Promise<MetaErrorResolution> {
  const resolution: MetaErrorResolution = {
    error_id: error.id as string,
    error_category: "permissions",
    meta_error_code: 803,
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Checking Meta permissions",
    affects_attribution: true,
    details: {},
    next_steps: [
      "Review token permissions in Meta Business Suite",
      "Ensure ads_management or ads_read permission",
      "Check pixel and dataset access",
      "Verify Business Manager access",
    ],
  };

  return resolution;
}

async function handleValidationError(error: Record<string, unknown>): Promise<MetaErrorResolution> {
  const resolution: MetaErrorResolution = {
    error_id: error.id as string,
    error_category: "validation",
    meta_error_code: 100,
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Analyzing validation error",
    affects_attribution: false,
    details: {},
    next_steps: [],
  };

  const message = String(error.error_message || "");
  // Try to extract parameter name
  const paramMatch = message.match(/parameter\s*['":]?\s*(\w+)/i);
  if (paramMatch) {
    resolution.details = { invalid_parameter: paramMatch[1] };
    resolution.next_steps = [
      `Review parameter "${paramMatch[1]}"`,
      "Check parameter type and format",
      "Consult Meta Graph API documentation",
    ];
  } else {
    resolution.next_steps = [
      "Review request parameters",
      "Check field types and formats",
      "Validate required fields",
    ];
  }

  return resolution;
}

async function handleServerError(error: Record<string, unknown>): Promise<MetaErrorResolution> {
  const resolution: MetaErrorResolution = {
    error_id: error.id as string,
    error_category: "server",
    meta_error_code: null,
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Meta server error - scheduling retry",
    affects_attribution: true,
    details: {},
    next_steps: [],
  };

  const retryCount = Number(error.retry_count || 0);
  const backoffMs = Math.min(Math.pow(2, retryCount + 1) * 60000, 1800000); // Max 30 min
  const nextRetryAt = new Date(Date.now() + backoffMs);

  await supabase
    .from("sync_errors")
    .update({
      retry_count: retryCount + 1,
      next_retry_at: nextRetryAt.toISOString(),
    })
    .eq("id", error.id);

  resolution.resolution_success = true;
  resolution.resolution_action = `Scheduled retry in ${Math.round(backoffMs / 60000)} minutes`;
  resolution.next_steps = [
    "Check Meta Platform Status",
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
      throw new Error(`Missing required environment variables: ${envCheck.missing.join(", ")}`);
    }

    console.log("[Meta Error Handler] Starting error handling...");

    const apiStatus = await checkMetaApiHealth();
    console.log(`[Meta Error Handler] API Status: ${apiStatus}`);

    // Fetch Meta/Facebook-related errors
    const { data: errors, error: fetchError } = await supabase
      .from("sync_errors")
      .select("*")
      .is("resolved_at", null)
      .or("source.eq.meta,source.eq.facebook")
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch errors: ${fetchError.message}`);
    }

    const resolutions: MetaErrorResolution[] = [];
    let resolutionsSuccessful = 0;
    let attributionImpact = false;

    for (const error of errors || []) {
      const { category, code } = categorizeMetaError(error);
      let resolution: MetaErrorResolution;

      switch (category) {
        case "auth":
          resolution = await handleAuthError(error);
          break;
        case "rate_limit":
          resolution = await handleRateLimitError(error);
          break;
        case "capi":
          resolution = await handleCapiError(error);
          break;
        case "permissions":
          resolution = await handlePermissionsError(error);
          break;
        case "validation":
          resolution = await handleValidationError(error);
          break;
        case "server":
          resolution = await handleServerError(error);
          break;
        default:
          resolution = {
            error_id: error.id,
            error_category: "unknown",
            meta_error_code: code,
            resolution_attempted: false,
            resolution_success: false,
            resolution_action: "Manual investigation required",
            affects_attribution: true,
            details: {},
            next_steps: ["Review Meta API documentation", "Check error details"],
          };
      }

      resolution.meta_error_code = code;
      resolutions.push(resolution);
      if (resolution.resolution_success) resolutionsSuccessful++;
      if (resolution.affects_attribution) attributionImpact = true;
    }

    // Alert on attribution impact
    if (attributionImpact && resolutions.length > 0) {
      await supabase.from("proactive_insights").upsert({
        insight_type: "meta_attribution_impact",
        priority: "high",
        title: `Meta CAPI: ${resolutions.length} errors affecting attribution`,
        content: `API Status: ${apiStatus}. ${resolutionsSuccessful} resolved automatically.`,
        action_items: resolutions
          .filter(r => !r.resolution_success)
          .flatMap(r => r.next_steps)
          .slice(0, 5),
        affected_entities: { error_count: resolutions.length },
        source_agent: "meta_error_handler",
        dedup_key: `meta_attribution_${new Date().toISOString().split("T")[0]}`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "dedup_key", ignoreDuplicates: true });
    }

    const report: HandlerReport = {
      timestamp: new Date().toISOString(),
      errors_processed: (errors || []).length,
      resolutions_attempted: resolutions.filter(r => r.resolution_attempted).length,
      resolutions_successful: resolutionsSuccessful,
      resolutions,
      meta_api_status: apiStatus,
      attribution_impact: attributionImpact,
    };

    const duration = Date.now() - startTime;
    console.log(`[Meta Error Handler] Complete in ${duration}ms - ${resolutionsSuccessful}/${(errors || []).length} resolved`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[Meta Error Handler] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
