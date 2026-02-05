import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";

// ============================================
// ERROR ROLLBACK AGENT
// Safely rolls back partial or failed operations
// Maintains data consistency after failures
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
  console.error("[Error Rollback Agent] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

interface RollbackCandidate {
  error_id: string;
  source: string;
  operation_type: "create" | "update" | "delete" | "batch" | "unknown";
  rollback_possible: boolean;
  rollback_risk: "low" | "medium" | "high" | "critical";
  rollback_action: string;
  affected_entities: string[];
  prerequisites: string[];
  estimated_impact: string;
}

interface RollbackReport {
  timestamp: string;
  errors_analyzed: number;
  rollback_candidates: number;
  low_risk_rollbacks: number;
  high_risk_rollbacks: number;
  candidates: RollbackCandidate[];
  rollback_recommendations: string[];
}

function identifyOperationType(error: Record<string, unknown>): RollbackCandidate["operation_type"] {
  const message = String(error.error_message || "").toLowerCase();
  const payload = error.request_payload as Record<string, unknown> | undefined;
  const method = String(error.error_details?.method || payload?.method || "").toUpperCase();

  if (method === "POST" || message.includes("create") || message.includes("insert")) {
    return "create";
  }
  if (method === "PUT" || method === "PATCH" || message.includes("update")) {
    return "update";
  }
  if (method === "DELETE" || message.includes("delete") || message.includes("remove")) {
    return "delete";
  }
  if (message.includes("batch") || message.includes("bulk")) {
    return "batch";
  }
  return "unknown";
}

function assessRollbackRisk(operationType: string, source: string, error: Record<string, unknown>): RollbackCandidate["rollback_risk"] {
  // Financial operations are always high risk
  if (source === "stripe") {
    return "critical";
  }

  // Delete operations are high risk
  if (operationType === "delete") {
    return "high";
  }

  // Batch operations are medium-high risk
  if (operationType === "batch") {
    return "high";
  }

  // Create operations with possible duplicates
  if (operationType === "create") {
    const message = String(error.error_message || "").toLowerCase();
    if (message.includes("duplicate") || message.includes("already exists")) {
      return "low"; // Safe to skip/ignore
    }
    return "medium";
  }

  // Update operations
  if (operationType === "update") {
    return "medium";
  }

  return "medium";
}

function identifyAffectedEntities(error: Record<string, unknown>): string[] {
  const entities: string[] = [];
  const payload = error.request_payload as Record<string, unknown> | undefined;

  // Check payload for IDs
  if (payload) {
    if (payload.id) entities.push(`id:${payload.id}`);
    if (payload.contact_id) entities.push(`contact:${payload.contact_id}`);
    if (payload.customer_id) entities.push(`customer:${payload.customer_id}`);
    if (payload.email) entities.push(`email:${payload.email}`);

    // Check for batch operations
    if (Array.isArray(payload.items)) {
      entities.push(`batch:${payload.items.length} items`);
    }
  }

  // Check error message for entity references
  const message = String(error.error_message || "");
  const idMatches = message.match(/\b[0-9a-f]{8,}\b/gi);
  if (idMatches) {
    entities.push(...idMatches.slice(0, 3).map(id => `ref:${id}`));
  }

  return entities.length > 0 ? entities : ["unknown"];
}

function generateRollbackAction(operationType: string, source: string, error: Record<string, unknown>): string {
  const message = String(error.error_message || "").toLowerCase();

  switch (operationType) {
    case "create":
      if (message.includes("duplicate") || message.includes("already exists")) {
        return "No rollback needed - record already exists";
      }
      if (message.includes("partial") || message.includes("incomplete")) {
        return `Delete partially created record in ${source}`;
      }
      return "Verify record was not created, cleanup if needed";

    case "update":
      if (error.error_details && (error.error_details as Record<string, unknown>).previous_state) {
        return `Restore previous state from error details`;
      }
      return "Query current state and verify consistency";

    case "delete":
      return "Verify record still exists, no action if found";

    case "batch":
      return "Identify successfully processed items, retry or rollback failed items";

    default:
      return "Manual verification required";
  }
}

function generatePrerequisites(operationType: string, rollbackRisk: string): string[] {
  const prerequisites: string[] = [];

  prerequisites.push("Verify error has not been retried successfully");
  prerequisites.push("Check if operation was partially completed");

  if (rollbackRisk === "high" || rollbackRisk === "critical") {
    prerequisites.push("Get approval before rollback");
    prerequisites.push("Create backup of current state");
  }

  if (operationType === "batch") {
    prerequisites.push("Identify individual item statuses");
  }

  if (operationType === "update") {
    prerequisites.push("Verify previous state is available");
  }

  return prerequisites;
}

function generateImpactEstimate(operationType: string, entities: string[], source: string): string {
  const entityCount = entities.length;

  if (source === "stripe") {
    return "CRITICAL: Financial data - requires careful review";
  }

  if (entityCount > 10) {
    return `HIGH: Affects ${entityCount}+ entities`;
  }

  if (operationType === "delete") {
    return "MEDIUM: Deleted data may be unrecoverable";
  }

  if (operationType === "batch") {
    return "MEDIUM: Batch operation may have partial completion";
  }

  return "LOW: Limited impact expected";
}

function canRollback(operationType: string, error: Record<string, unknown>): boolean {
  // Can't rollback unknown operations
  if (operationType === "unknown") {
    return false;
  }

  // Check if error details indicate non-rollbackable state
  const details = error.error_details as Record<string, unknown> | undefined;
  if (details?.non_rollbackable || details?.completed) {
    return false;
  }

  // Can't rollback if no identifying information
  const entities = identifyAffectedEntities(error);
  if (entities.length === 1 && entities[0] === "unknown") {
    return false;
  }

  return true;
}

serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    if (!envCheck.valid) {
      throw new Error(`Missing required environment variables: ${envCheck.missing.join(", ")}`);
    }

    console.log("[Error Rollback Agent] Starting rollback analysis...");

    // Fetch recent errors that might need rollback
    const { data: errors, error: fetchError } = await supabase
      .from("sync_errors")
      .select("*")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch errors: ${fetchError.message}`);
    }

    const candidates: RollbackCandidate[] = [];
    let lowRiskCount = 0;
    let highRiskCount = 0;

    for (const error of errors || []) {
      const source = String(error.source || "unknown");
      const operationType = identifyOperationType(error);
      const rollbackRisk = assessRollbackRisk(operationType, source, error);
      const rollbackPossible = canRollback(operationType, error);
      const affectedEntities = identifyAffectedEntities(error);

      const candidate: RollbackCandidate = {
        error_id: error.id as string,
        source,
        operation_type: operationType,
        rollback_possible: rollbackPossible,
        rollback_risk: rollbackRisk,
        rollback_action: generateRollbackAction(operationType, source, error),
        affected_entities: affectedEntities,
        prerequisites: generatePrerequisites(operationType, rollbackRisk),
        estimated_impact: generateImpactEstimate(operationType, affectedEntities, source),
      };

      candidates.push(candidate);

      if (rollbackPossible) {
        if (rollbackRisk === "low") lowRiskCount++;
        if (rollbackRisk === "high" || rollbackRisk === "critical") highRiskCount++;
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];

    const rollbackCandidates = candidates.filter(c => c.rollback_possible);
    if (rollbackCandidates.length === 0) {
      recommendations.push("No errors currently eligible for rollback");
    } else {
      recommendations.push(`${rollbackCandidates.length} errors may benefit from rollback`);

      if (lowRiskCount > 0) {
        recommendations.push(`${lowRiskCount} low-risk rollbacks can be executed automatically`);
      }

      if (highRiskCount > 0) {
        recommendations.push(`${highRiskCount} high-risk rollbacks require manual review`);
      }
    }

    const criticalCandidates = candidates.filter(c => c.rollback_risk === "critical");
    if (criticalCandidates.length > 0) {
      recommendations.push("ALERT: Critical rollback candidates detected - review immediately");
    }

    const report: RollbackReport = {
      timestamp: new Date().toISOString(),
      errors_analyzed: (errors || []).length,
      rollback_candidates: rollbackCandidates.length,
      low_risk_rollbacks: lowRiskCount,
      high_risk_rollbacks: highRiskCount,
      candidates,
      rollback_recommendations: recommendations,
    };

    // Alert on critical rollback needs
    if (criticalCandidates.length > 0) {
      await supabase.from("proactive_insights").upsert({
        insight_type: "rollback_critical",
        priority: "critical",
        title: `Rollback Alert: ${criticalCandidates.length} critical operations may need rollback`,
        content: `Critical operations (likely financial) have failed and may need manual rollback.`,
        action_items: [
          "Review critical errors immediately",
          "Verify data consistency",
          "Execute rollback if needed",
        ],
        affected_entities: { critical_errors: criticalCandidates.map(c => c.error_id) },
        source_agent: "error_rollback_agent",
        dedup_key: `rollback_critical_${new Date().toISOString().split("T")[0]}`,
        expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "dedup_key", ignoreDuplicates: true });
    }

    const duration = Date.now() - startTime;
    console.log(`[Error Rollback Agent] Complete in ${duration}ms - Candidates: ${rollbackCandidates.length} (${highRiskCount} high risk)`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[Error Rollback Agent] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
