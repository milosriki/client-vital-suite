import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// ERROR SEVERITY CLASSIFIER AGENT
// Automatically determines error severity levels
// Uses multi-factor analysis for accurate classification
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
  console.error("[Error Severity Classifier] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

interface SeverityFactors {
  business_impact: number;      // 0-10: Impact on business operations
  data_integrity: number;       // 0-10: Risk to data accuracy
  customer_impact: number;      // 0-10: Direct customer impact
  recovery_complexity: number;  // 0-10: Difficulty to recover
  escalation_risk: number;      // 0-10: Likelihood to escalate
  recurrence_risk: number;      // 0-10: Likelihood to recur
}

interface ClassifiedError {
  id: string;
  original_severity: string | null;
  calculated_severity: "critical" | "high" | "medium" | "low";
  severity_score: number;
  factors: SeverityFactors;
  justification: string;
  requires_immediate_action: boolean;
}

interface ClassificationReport {
  timestamp: string;
  errors_classified: number;
  severity_changes: number;
  classified_errors: ClassifiedError[];
  severity_distribution: Record<string, number>;
}

// Source impact weights
const sourceWeights: Record<string, number> = {
  stripe: 10,      // Financial - highest impact
  hubspot: 7,      // CRM - high impact
  meta: 6,         // Marketing - moderate-high
  facebook: 6,
  callgear: 5,     // Communications
  anytrack: 4,     // Attribution
  internal: 3,     // Internal systems
  unknown: 2,
};

// Error type impact weights
const typeWeights: Record<string, number> = {
  auth: 9,           // Authentication failures
  rate_limit: 5,     // Rate limiting
  validation: 4,     // Data validation
  field_mapping: 4,  // Field mapping issues
  timeout: 6,        // Timeouts
  network: 7,        // Network failures
  unknown: 3,
};

function calculateBusinessImpact(error: Record<string, unknown>): number {
  const source = String(error.source || error.platform || "unknown").toLowerCase();
  const baseWeight = sourceWeights[source] || sourceWeights.unknown;

  // Adjust for time of day (business hours more critical)
  const hour = new Date().getHours();
  const businessHoursMultiplier = (hour >= 9 && hour <= 18) ? 1.2 : 1.0;

  return Math.min(10, Math.round(baseWeight * businessHoursMultiplier));
}

function calculateDataIntegrityRisk(error: Record<string, unknown>): number {
  const errorType = String(error.error_type || "unknown").toLowerCase();
  const message = String(error.error_message || "").toLowerCase();

  let risk = typeWeights[errorType] || typeWeights.unknown;

  // Increase for data-related keywords
  if (message.includes("corrupt") || message.includes("invalid")) risk += 2;
  if (message.includes("duplicate") || message.includes("missing")) risk += 1;
  if (message.includes("sync") || message.includes("data")) risk += 1;

  return Math.min(10, risk);
}

function calculateCustomerImpact(error: Record<string, unknown>): number {
  const source = String(error.source || "unknown").toLowerCase();
  const message = String(error.error_message || "").toLowerCase();

  let impact = 0;

  // Direct customer-facing systems
  if (source === "stripe") impact += 8;  // Payment issues
  if (source === "hubspot") impact += 5; // CRM visibility
  if (source === "callgear") impact += 6; // Communication

  // Customer-related keywords
  if (message.includes("customer") || message.includes("client")) impact += 2;
  if (message.includes("payment") || message.includes("billing")) impact += 3;
  if (message.includes("email") || message.includes("notification")) impact += 2;

  return Math.min(10, impact);
}

function calculateRecoveryComplexity(error: Record<string, unknown>): number {
  const retryCount = Number(error.retry_count || 0);
  const maxRetries = Number(error.max_retries || 3);
  const errorType = String(error.error_type || "unknown").toLowerCase();

  let complexity = 3; // Base complexity

  // Increase based on retry attempts
  complexity += retryCount * 2;

  // Complex error types
  if (errorType === "auth") complexity += 3;
  if (errorType === "field_mapping") complexity += 2;
  if (errorType === "network") complexity += 1;

  // Near max retries = high complexity
  if (retryCount >= maxRetries - 1) complexity += 2;

  return Math.min(10, complexity);
}

function calculateEscalationRisk(error: Record<string, unknown>): number {
  const retryCount = Number(error.retry_count || 0);
  const createdAt = new Date(String(error.created_at || new Date().toISOString()));
  const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

  let risk = 2; // Base risk

  // Long-standing errors escalate
  if (ageHours > 24) risk += 4;
  else if (ageHours > 12) risk += 3;
  else if (ageHours > 4) risk += 2;
  else if (ageHours > 1) risk += 1;

  // Multiple retries = escalation likely
  risk += retryCount;

  return Math.min(10, risk);
}

function calculateRecurrenceRisk(error: Record<string, unknown>, recentErrors: Record<string, unknown>[]): number {
  const source = String(error.source || "unknown");
  const errorType = String(error.error_type || "unknown");

  // Count similar recent errors
  const similarErrors = recentErrors.filter(e =>
    e.source === source && e.error_type === errorType
  ).length;

  if (similarErrors >= 10) return 10;
  if (similarErrors >= 5) return 7;
  if (similarErrors >= 3) return 5;
  if (similarErrors >= 2) return 3;
  return 1;
}

function calculateOverallSeverity(factors: SeverityFactors): { severity: ClassifiedError["calculated_severity"]; score: number } {
  // Weighted average
  const weights = {
    business_impact: 0.25,
    data_integrity: 0.15,
    customer_impact: 0.20,
    recovery_complexity: 0.15,
    escalation_risk: 0.15,
    recurrence_risk: 0.10,
  };

  const score =
    factors.business_impact * weights.business_impact +
    factors.data_integrity * weights.data_integrity +
    factors.customer_impact * weights.customer_impact +
    factors.recovery_complexity * weights.recovery_complexity +
    factors.escalation_risk * weights.escalation_risk +
    factors.recurrence_risk * weights.recurrence_risk;

  let severity: ClassifiedError["calculated_severity"];
  if (score >= 7.5) severity = "critical";
  else if (score >= 5.5) severity = "high";
  else if (score >= 3.5) severity = "medium";
  else severity = "low";

  return { severity, score: Math.round(score * 10) / 10 };
}

function generateJustification(factors: SeverityFactors, severity: string): string {
  const highFactors: string[] = [];

  if (factors.business_impact >= 7) highFactors.push("high business impact");
  if (factors.data_integrity >= 7) highFactors.push("data integrity at risk");
  if (factors.customer_impact >= 7) highFactors.push("direct customer impact");
  if (factors.recovery_complexity >= 7) highFactors.push("complex recovery required");
  if (factors.escalation_risk >= 7) highFactors.push("high escalation risk");
  if (factors.recurrence_risk >= 7) highFactors.push("likely to recur");

  if (highFactors.length === 0) {
    return `Classified as ${severity} based on overall factor analysis`;
  }

  return `Classified as ${severity} due to: ${highFactors.join(", ")}`;
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

    console.log("[Error Severity Classifier] Starting severity classification...");

    // Fetch unresolved errors
    const { data: errors, error: fetchError } = await supabase
      .from("sync_errors")
      .select("*")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (fetchError) {
      throw new Error(`Failed to fetch errors: ${fetchError.message}`);
    }

    const errorList = errors || [];
    const classifiedErrors: ClassifiedError[] = [];
    let severityChanges = 0;
    const severityDistribution: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };

    for (const error of errorList) {
      const factors: SeverityFactors = {
        business_impact: calculateBusinessImpact(error),
        data_integrity: calculateDataIntegrityRisk(error),
        customer_impact: calculateCustomerImpact(error),
        recovery_complexity: calculateRecoveryComplexity(error),
        escalation_risk: calculateEscalationRisk(error),
        recurrence_risk: calculateRecurrenceRisk(error, errorList),
      };

      const { severity, score } = calculateOverallSeverity(factors);
      const justification = generateJustification(factors, severity);

      const existingSeverity = error.error_details?.triage?.priority || error.error_details?.severity;
      if (existingSeverity && existingSeverity !== severity) {
        severityChanges++;
      }

      const classified: ClassifiedError = {
        id: error.id,
        original_severity: existingSeverity || null,
        calculated_severity: severity,
        severity_score: score,
        factors,
        justification,
        requires_immediate_action: severity === "critical" || (severity === "high" && factors.customer_impact >= 7),
      };

      classifiedErrors.push(classified);
      severityDistribution[severity]++;

      // Update error with classification
      await supabase
        .from("sync_errors")
        .update({
          error_details: {
            ...error.error_details,
            severity_classification: {
              severity,
              score,
              factors,
              justification,
              classified_at: new Date().toISOString(),
            },
          },
        })
        .eq("id", error.id);
    }

    const report: ClassificationReport = {
      timestamp: new Date().toISOString(),
      errors_classified: classifiedErrors.length,
      severity_changes: severityChanges,
      classified_errors: classifiedErrors,
      severity_distribution: severityDistribution,
    };

    // Alert on errors requiring immediate action
    const immediateAction = classifiedErrors.filter(e => e.requires_immediate_action);
    for (const error of immediateAction) {
      await supabase.from("proactive_insights").upsert({
        insight_type: "severity_alert",
        priority: "critical",
        title: `Immediate Action Required: Error ${error.id.substring(0, 8)}`,
        content: error.justification,
        action_items: ["Review error immediately", "Assess customer impact", "Initiate recovery procedure"],
        affected_entities: { error_id: error.id, score: error.severity_score, factors: error.factors },
        source_agent: "error_severity_classifier",
        dedup_key: `severity_${error.id}`,
        expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
      }, { onConflict: "dedup_key", ignoreDuplicates: true });
    }

    const duration = Date.now() - startTime;
    console.log(`[Error Severity Classifier] Complete in ${duration}ms - Classified ${classifiedErrors.length} errors`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[Error Severity Classifier] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
