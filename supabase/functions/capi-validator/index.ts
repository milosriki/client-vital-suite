import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// CAPI VALIDATOR AGENT
// Validates events before sending to Meta
// Catches errors BEFORE they fail in production
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface ValidationResult {
  event_id: string;
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  emq_estimate: number;
  recommendations: string[];
}

interface ValidationSummary {
  total_checked: number;
  valid_count: number;
  invalid_count: number;
  warning_count: number;
  common_errors: Record<string, number>;
  avg_emq_estimate: number;
}

// Valid Meta event names
const VALID_EVENT_NAMES = [
  "Lead", "ViewContent", "InitiateCheckout", "AddPaymentInfo",
  "Purchase", "CompleteRegistration", "Schedule", "Contact",
  "SubmitApplication", "Subscribe", "StartTrial"
];

// UAE phone regex
const UAE_PHONE_REGEX = /^971\d{9}$/;

function validateEmail(email: string | null): { valid: boolean; error?: string } {
  if (!email) return { valid: false, error: "Email is required for high EMQ" };
  if (!email.includes("@")) return { valid: false, error: "Invalid email format" };
  if (email.includes(" ")) return { valid: false, error: "Email contains spaces" };
  return { valid: true };
}

function validatePhone(phone: string | null): { valid: boolean; error?: string; warning?: string } {
  if (!phone) return { valid: true, warning: "No phone - reduces EMQ score" };

  // Normalize
  const digits = phone.replace(/\D/g, "");

  // Check UAE format
  if (!UAE_PHONE_REGEX.test(digits) && !digits.startsWith("971")) {
    return {
      valid: true,
      warning: `Phone not in UAE format (971XXXXXXXXX): ${phone}`
    };
  }

  return { valid: true };
}

function validateEventName(name: string | null): { valid: boolean; error?: string } {
  if (!name) return { valid: false, error: "Event name is required" };
  if (!VALID_EVENT_NAMES.includes(name)) {
    return {
      valid: false,
      error: `Invalid event name: ${name}. Valid: ${VALID_EVENT_NAMES.join(", ")}`
    };
  }
  return { valid: true };
}

function validateEventTime(time: string | null): { valid: boolean; error?: string; warning?: string } {
  if (!time) return { valid: false, error: "Event time is required" };

  const eventDate = new Date(time);

  // Check for invalid date FIRST
  if (isNaN(eventDate.getTime())) {
    return { valid: false, error: `Invalid date format: ${time}` };
  }

  const now = new Date();
  const daysDiff = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff > 7) {
    return {
      valid: true,
      warning: `Event is ${Math.round(daysDiff)} days old - may have lower attribution value`
    };
  }

  if (eventDate > now) {
    return { valid: false, error: "Event time is in the future" };
  }

  return { valid: true };
}

function validateValue(value: number | null, eventName: string): { valid: boolean; warning?: string } {
  if (eventName === "Purchase") {
    if (!value || value <= 0) {
      return { valid: true, warning: "Purchase event without value reduces data quality" };
    }
  }
  return { valid: true };
}

function validateFbpFbc(fbp: string | null, fbc: string | null): { warnings: string[] } {
  const warnings: string[] = [];

  if (!fbp && !fbc) {
    warnings.push("No fbp or fbc - will rely solely on PII matching (lower match rate)");
  }

  if (fbp && !fbp.startsWith("fb.")) {
    warnings.push(`fbp format looks incorrect: ${fbp.substring(0, 20)}...`);
  }

  if (fbc && !fbc.startsWith("fb.")) {
    warnings.push(`fbc format looks incorrect: ${fbc.substring(0, 20)}...`);
  }

  return { warnings };
}

function estimateEMQ(event: any): number {
  let score = 0;

  // Email contributes ~40%
  if (event.email && event.email.includes("@")) score += 40;

  // Phone contributes ~30%
  if (event.phone) {
    const digits = event.phone.replace(/\D/g, "");
    if (UAE_PHONE_REGEX.test(digits)) score += 30;
    else score += 15; // Partial credit for non-UAE format
  }

  // fbp/fbc contribute ~20%
  if (event.fbp) score += 10;
  if (event.fbc) score += 10;

  // Name contributes ~10%
  if (event.first_name) score += 5;
  if (event.last_name) score += 5;

  return Math.min(100, score);
}

function validateEvent(event: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Required validations
  const emailCheck = validateEmail(event.email);
  if (!emailCheck.valid && emailCheck.error) errors.push(emailCheck.error);

  const phoneCheck = validatePhone(event.phone);
  if (!phoneCheck.valid && phoneCheck.error) errors.push(phoneCheck.error);
  if (phoneCheck.warning) warnings.push(phoneCheck.warning);

  const eventNameCheck = validateEventName(event.event_name);
  if (!eventNameCheck.valid && eventNameCheck.error) errors.push(eventNameCheck.error);

  const timeCheck = validateEventTime(event.event_time);
  if (!timeCheck.valid && timeCheck.error) errors.push(timeCheck.error);
  if (timeCheck.warning) warnings.push(timeCheck.warning);

  const valueCheck = validateValue(event.value, event.event_name);
  if (valueCheck.warning) warnings.push(valueCheck.warning);

  const browserCheck = validateFbpFbc(event.fbp, event.fbc);
  warnings.push(...browserCheck.warnings);

  // EMQ estimate
  const emq = estimateEMQ(event);

  // Generate recommendations
  if (emq < 50) {
    recommendations.push("Add more user data (email, phone, fbp) to improve match rate");
  }
  if (!event.fbp && !event.fbc) {
    recommendations.push("Implement Meta Pixel for browser identifiers (fbp/fbc)");
  }
  if (errors.length > 0) {
    recommendations.push("Fix errors before sending to prevent API failures");
  }

  return {
    event_id: event.event_id || event.id || "unknown",
    is_valid: errors.length === 0,
    errors,
    warnings,
    emq_estimate: emq,
    recommendations
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const {
      validate_pending = true,
      event_ids = [],
      limit = 100,
      fix_issues = false
    } = await req.json().catch(() => ({}));

    console.log("[CAPI Validator] Starting validation...");

    // Build query
    let query = supabase
      .from("capi_events_enriched")
      .select("*")
      .limit(limit);

    if (event_ids.length > 0) {
      query = query.in("event_id", event_ids);
    } else if (validate_pending) {
      query = query.eq("send_status", "pending");
    }

    const { data: events, error } = await query;
    if (error) throw error;

    const results: ValidationResult[] = [];
    const errorCounts: Record<string, number> = {};
    let totalEmq = 0;

    for (const event of events || []) {
      const result = validateEvent(event);
      results.push(result);
      totalEmq += result.emq_estimate;

      // Count errors
      for (const err of result.errors) {
        const key = err.split(":")[0];
        errorCounts[key] = (errorCounts[key] || 0) + 1;
      }

      // Fix issues if requested
      if (fix_issues && !result.is_valid) {
        await supabase
          .from("capi_events_enriched")
          .update({
            send_status: "validation_failed",
            validation_errors: result.errors
          })
          .eq("id", event.id);
      }
    }

    const summary: ValidationSummary = {
      total_checked: results.length,
      valid_count: results.filter(r => r.is_valid).length,
      invalid_count: results.filter(r => !r.is_valid).length,
      warning_count: results.filter(r => r.warnings.length > 0).length,
      common_errors: errorCounts,
      avg_emq_estimate: results.length > 0 ? Math.round(totalEmq / results.length) : 0
    };

    // Log validation run
    await supabase.from("sync_logs").insert({
      platform: "capi_validator",
      sync_type: "validation",
      status: summary.invalid_count === 0 ? "success" : "completed_with_errors",
      records_processed: summary.total_checked,
      records_failed: summary.invalid_count,
      error_details: summary.common_errors,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime
    });

    const duration = Date.now() - startTime;
    console.log(`[CAPI Validator] Complete in ${duration}ms:`, summary);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      summary,
      results: results.slice(0, 50) // Limit response size
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error("[CAPI Validator] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
