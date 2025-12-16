import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// STRIPE ERROR HANDLER AGENT
// Specialized handler for Stripe payment errors
// Critical priority - handles financial operations
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
  console.error("[Stripe Error Handler] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

interface StripeErrorResolution {
  error_id: string;
  error_category: "auth" | "card" | "rate_limit" | "validation" | "idempotency" | "webhook" | "server" | "unknown";
  severity: "critical" | "high" | "medium" | "low";
  resolution_attempted: boolean;
  resolution_success: boolean;
  resolution_action: string;
  financial_impact: boolean;
  customer_affected: boolean;
  details: Record<string, unknown>;
  next_steps: string[];
  escalation_required: boolean;
}

interface HandlerReport {
  timestamp: string;
  errors_processed: number;
  critical_errors: number;
  resolutions_attempted: number;
  resolutions_successful: number;
  resolutions: StripeErrorResolution[];
  stripe_api_status: "healthy" | "degraded" | "down" | "unknown";
  financial_impact_detected: boolean;
}

async function checkStripeApiHealth(): Promise<"healthy" | "degraded" | "down" | "unknown"> {
  if (!STRIPE_SECRET_KEY) {
    return "unknown";
  }

  try {
    const response = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });

    if (response.status === 200) return "healthy";
    if (response.status === 429) return "degraded";
    if (response.status >= 500) return "down";
    return "degraded";
  } catch {
    return "down";
  }
}

function categorizeStripeError(error: Record<string, unknown>): StripeErrorResolution["error_category"] {
  const errorType = String(error.error_type || "").toLowerCase();
  const message = String(error.error_message || "").toLowerCase();
  const stripeCode = String(error.error_details?.code || error.error_details?.stripe_code || "").toLowerCase();

  // Card-related errors
  if (stripeCode.includes("card_") || message.includes("card") || message.includes("payment_method")) {
    return "card";
  }
  // Authentication errors
  if (errorType === "auth" || message.includes("unauthorized") || stripeCode === "authentication_required") {
    return "auth";
  }
  // Rate limiting
  if (errorType === "rate_limit" || message.includes("rate limit") || stripeCode === "rate_limit") {
    return "rate_limit";
  }
  // Idempotency issues
  if (stripeCode.includes("idempotent") || message.includes("idempotency")) {
    return "idempotency";
  }
  // Webhook errors
  if (message.includes("webhook") || message.includes("signature")) {
    return "webhook";
  }
  // Validation errors
  if (errorType === "validation" || stripeCode === "parameter_invalid" || message.includes("invalid")) {
    return "validation";
  }
  // Server errors
  if (message.includes("server") || stripeCode.includes("api_error")) {
    return "server";
  }
  return "unknown";
}

function determineSeverity(category: string, error: Record<string, unknown>): StripeErrorResolution["severity"] {
  const message = String(error.error_message || "").toLowerCase();

  // Critical: Payment failures, authentication issues
  if (category === "card" && (message.includes("declined") || message.includes("failed"))) {
    return "critical";
  }
  if (category === "auth") {
    return "critical";
  }
  // High: Webhook failures, idempotency issues
  if (category === "webhook" || category === "idempotency") {
    return "high";
  }
  // Medium: Rate limiting, validation
  if (category === "rate_limit" || category === "validation") {
    return "medium";
  }
  // Low: Everything else
  return "low";
}

async function handleCardError(error: Record<string, unknown>): Promise<StripeErrorResolution> {
  const message = String(error.error_message || "").toLowerCase();
  const stripeCode = String(error.error_details?.code || "");

  const resolution: StripeErrorResolution = {
    error_id: error.id as string,
    error_category: "card",
    severity: determineSeverity("card", error),
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Analyzing card error",
    financial_impact: true,
    customer_affected: true,
    details: { stripe_code: stripeCode },
    next_steps: [],
    escalation_required: false,
  };

  // Different handling based on card error type
  if (message.includes("declined") || stripeCode.includes("declined")) {
    resolution.resolution_action = "Card declined - no automatic resolution";
    resolution.next_steps = [
      "Notify customer to update payment method",
      "Check for fraud indicators",
      "Consider alternative payment methods",
    ];
    resolution.escalation_required = false; // Customer action needed
  } else if (message.includes("expired")) {
    resolution.resolution_action = "Card expired - customer notification required";
    resolution.next_steps = [
      "Send card update reminder to customer",
      "Check subscription status",
      "Queue for dunning process",
    ];
  } else if (message.includes("insufficient_funds")) {
    resolution.resolution_action = "Insufficient funds - retry scheduled";
    // Schedule retry in 3 days
    await supabase
      .from("sync_errors")
      .update({
        next_retry_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        error_details: { ...error.error_details, retry_reason: "insufficient_funds" },
      })
      .eq("id", error.id);
    resolution.resolution_success = true;
    resolution.next_steps = ["Automatic retry scheduled in 3 days", "Monitor for successful charge"];
  }

  return resolution;
}

async function handleAuthError(error: Record<string, unknown>): Promise<StripeErrorResolution> {
  const resolution: StripeErrorResolution = {
    error_id: error.id as string,
    error_category: "auth",
    severity: "critical",
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Checking Stripe API key",
    financial_impact: true,
    customer_affected: true,
    details: {},
    next_steps: [],
    escalation_required: true,
  };

  if (!STRIPE_SECRET_KEY) {
    resolution.resolution_action = "No Stripe API key configured";
    resolution.next_steps = [
      "URGENT: Configure STRIPE_SECRET_KEY",
      "Check Stripe dashboard for API keys",
      "Verify environment variables",
    ];
    return resolution;
  }

  // Test API key
  try {
    const response = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });

    if (response.status === 200) {
      resolution.resolution_success = true;
      resolution.resolution_action = "API key is valid - error may be transient";
      resolution.escalation_required = false;

      await supabase
        .from("sync_errors")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", error.id);
    } else {
      resolution.details = { status: response.status };
      resolution.next_steps = [
        "URGENT: Regenerate Stripe API key",
        "Check Stripe account status",
        "Verify key permissions",
      ];
    }
  } catch (e) {
    resolution.details = { test_error: e instanceof Error ? e.message : "Unknown" };
  }

  return resolution;
}

async function handleRateLimitError(error: Record<string, unknown>): Promise<StripeErrorResolution> {
  const resolution: StripeErrorResolution = {
    error_id: error.id as string,
    error_category: "rate_limit",
    severity: "medium",
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Implementing Stripe rate limit backoff",
    financial_impact: false,
    customer_affected: false,
    details: {},
    next_steps: [],
    escalation_required: false,
  };

  const retryCount = Number(error.retry_count || 0);
  // Stripe recommends exponential backoff starting at 1 second
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
  resolution.resolution_action = `Scheduled retry in ${backoffMs / 1000}s`;
  resolution.details = { backoff_ms: backoffMs, retry_count: retryCount + 1 };
  resolution.next_steps = ["Automatic retry scheduled", "Consider batching requests"];

  return resolution;
}

async function handleWebhookError(error: Record<string, unknown>): Promise<StripeErrorResolution> {
  const resolution: StripeErrorResolution = {
    error_id: error.id as string,
    error_category: "webhook",
    severity: "high",
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Analyzing webhook error",
    financial_impact: true, // Webhook failures can cause missed events
    customer_affected: true,
    details: {},
    next_steps: [],
    escalation_required: true,
  };

  const message = String(error.error_message || "").toLowerCase();

  if (message.includes("signature")) {
    resolution.resolution_action = "Webhook signature verification failed";
    resolution.next_steps = [
      "URGENT: Check webhook signing secret",
      "Verify webhook endpoint configuration",
      "Check for webhook secret rotation",
    ];
  } else {
    resolution.next_steps = [
      "Review Stripe webhook logs",
      "Check webhook endpoint health",
      "Verify event processing logic",
    ];
  }

  return resolution;
}

async function handleIdempotencyError(error: Record<string, unknown>): Promise<StripeErrorResolution> {
  const resolution: StripeErrorResolution = {
    error_id: error.id as string,
    error_category: "idempotency",
    severity: "high",
    resolution_attempted: true,
    resolution_success: false,
    resolution_action: "Idempotency conflict detected",
    financial_impact: true,
    customer_affected: true,
    details: {},
    next_steps: [
      "Check for duplicate charge attempts",
      "Verify idempotency key generation",
      "Review charge history for duplicates",
    ],
    escalation_required: true,
  };

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

    console.log("[Stripe Error Handler] Starting error handling...");

    const apiStatus = await checkStripeApiHealth();
    console.log(`[Stripe Error Handler] API Status: ${apiStatus}`);

    // Fetch Stripe-related errors
    const { data: errors, error: fetchError } = await supabase
      .from("sync_errors")
      .select("*")
      .is("resolved_at", null)
      .eq("source", "stripe")
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch errors: ${fetchError.message}`);
    }

    const resolutions: StripeErrorResolution[] = [];
    let resolutionsSuccessful = 0;
    let financialImpactDetected = false;

    for (const error of errors || []) {
      const category = categorizeStripeError(error);
      let resolution: StripeErrorResolution;

      switch (category) {
        case "card":
          resolution = await handleCardError(error);
          break;
        case "auth":
          resolution = await handleAuthError(error);
          break;
        case "rate_limit":
          resolution = await handleRateLimitError(error);
          break;
        case "webhook":
          resolution = await handleWebhookError(error);
          break;
        case "idempotency":
          resolution = await handleIdempotencyError(error);
          break;
        default:
          resolution = {
            error_id: error.id,
            error_category: "unknown",
            severity: "medium",
            resolution_attempted: false,
            resolution_success: false,
            resolution_action: "Manual investigation required",
            financial_impact: true, // Assume financial impact for unknown Stripe errors
            customer_affected: true,
            details: {},
            next_steps: ["Review Stripe dashboard", "Check error logs"],
            escalation_required: true,
          };
      }

      resolutions.push(resolution);
      if (resolution.resolution_success) resolutionsSuccessful++;
      if (resolution.financial_impact) financialImpactDetected = true;
    }

    const criticalErrors = resolutions.filter(r => r.severity === "critical").length;

    // Alert on critical errors
    if (criticalErrors > 0 || financialImpactDetected) {
      await supabase.from("proactive_insights").upsert({
        insight_type: "stripe_critical_error",
        priority: "critical",
        title: `Stripe Critical: ${criticalErrors} critical errors detected`,
        content: `Financial impact: ${financialImpactDetected}. API Status: ${apiStatus}`,
        action_items: resolutions
          .filter(r => r.severity === "critical")
          .flatMap(r => r.next_steps)
          .slice(0, 5),
        affected_entities: { error_count: criticalErrors },
        source_agent: "stripe_error_handler",
        dedup_key: `stripe_critical_${new Date().toISOString().split("T")[0]}`,
        expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "dedup_key", ignoreDuplicates: true });
    }

    const report: HandlerReport = {
      timestamp: new Date().toISOString(),
      errors_processed: (errors || []).length,
      critical_errors: criticalErrors,
      resolutions_attempted: resolutions.filter(r => r.resolution_attempted).length,
      resolutions_successful: resolutionsSuccessful,
      resolutions,
      stripe_api_status: apiStatus,
      financial_impact_detected: financialImpactDetected,
    };

    const duration = Date.now() - startTime;
    console.log(`[Stripe Error Handler] Complete in ${duration}ms - ${resolutionsSuccessful}/${(errors || []).length} resolved`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[Stripe Error Handler] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
