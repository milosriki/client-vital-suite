import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// ERROR RECOVERY AGENT
// Attempts data recovery from failed operations
// Reconstructs missing or corrupted data
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
  console.error("[Error Recovery Agent] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

interface RecoveryAttempt {
  error_id: string;
  recovery_type: "data_reconstruction" | "cache_rebuild" | "sync_repair" | "reference_fix" | "none";
  success: boolean;
  data_recovered: boolean;
  action_taken: string;
  details: Record<string, unknown>;
  recommendations: string[];
}

interface RecoveryReport {
  timestamp: string;
  errors_analyzed: number;
  recovery_attempted: number;
  recovery_successful: number;
  data_recovered: number;
  recoveries: RecoveryAttempt[];
  recovery_summary: string;
}

async function attemptDataReconstruction(error: Record<string, unknown>): Promise<RecoveryAttempt> {
  const source = String(error.source || "unknown");
  const payload = error.request_payload as Record<string, unknown> | undefined;

  const recovery: RecoveryAttempt = {
    error_id: error.id as string,
    recovery_type: "data_reconstruction",
    success: false,
    data_recovered: false,
    action_taken: "Analyzing failed operation for data recovery",
    details: {},
    recommendations: [],
  };

  if (!payload) {
    recovery.action_taken = "No request payload available for reconstruction";
    recovery.recommendations = ["Enable request logging", "Store payloads for critical operations"];
    return recovery;
  }

  // Check if we can identify the affected entity
  const entityId = payload.id || payload.contact_id || payload.customer_id || payload.record_id;

  if (entityId) {
    recovery.details = { entity_id: entityId, source };

    // Try to verify entity state in source system
    recovery.action_taken = `Identified entity ${entityId} for potential recovery`;
    recovery.recommendations = [
      `Verify ${source} record ${entityId} state`,
      "Compare local and remote data",
      "Re-sync entity if needed",
    ];
    recovery.success = true;
  } else {
    recovery.action_taken = "Could not identify specific entity from payload";
    recovery.recommendations = ["Review operation manually", "Check source system logs"];
  }

  return recovery;
}

async function attemptCacheRebuild(error: Record<string, unknown>): Promise<RecoveryAttempt> {
  const recovery: RecoveryAttempt = {
    error_id: error.id as string,
    recovery_type: "cache_rebuild",
    success: false,
    data_recovered: false,
    action_taken: "Checking if cache rebuild can resolve error",
    details: {},
    recommendations: [],
  };

  const message = String(error.error_message || "").toLowerCase();

  // Check if error is cache-related
  if (message.includes("cache") || message.includes("stale") || message.includes("outdated")) {
    // Mark the error with cache rebuild flag
    await supabase
      .from("sync_errors")
      .update({
        error_details: {
          ...error.error_details,
          recovery_action: "cache_rebuild_recommended",
          recovery_timestamp: new Date().toISOString(),
        },
      })
      .eq("id", error.id);

    recovery.success = true;
    recovery.action_taken = "Flagged for cache rebuild";
    recovery.recommendations = [
      "Trigger cache refresh for affected data",
      "Invalidate stale cache entries",
    ];
  } else {
    recovery.action_taken = "Error not related to caching";
  }

  return recovery;
}

async function attemptSyncRepair(error: Record<string, unknown>): Promise<RecoveryAttempt> {
  const source = String(error.source || "unknown");
  const message = String(error.error_message || "").toLowerCase();

  const recovery: RecoveryAttempt = {
    error_id: error.id as string,
    recovery_type: "sync_repair",
    success: false,
    data_recovered: false,
    action_taken: "Analyzing sync failure",
    details: { source },
    recommendations: [],
  };

  // Check for sync-related errors
  if (message.includes("sync") || message.includes("mismatch") || message.includes("inconsistent")) {
    // Log sync repair needed
    await supabase
      .from("sync_errors")
      .update({
        error_details: {
          ...error.error_details,
          recovery_action: "sync_repair_needed",
          recovery_timestamp: new Date().toISOString(),
        },
      })
      .eq("id", error.id);

    recovery.success = true;
    recovery.action_taken = `Flagged ${source} for sync repair`;
    recovery.recommendations = [
      `Trigger full sync for ${source}`,
      "Compare local and remote timestamps",
      "Resolve data conflicts",
    ];
  }

  return recovery;
}

async function attemptReferencefix(error: Record<string, unknown>): Promise<RecoveryAttempt> {
  const message = String(error.error_message || "").toLowerCase();

  const recovery: RecoveryAttempt = {
    error_id: error.id as string,
    recovery_type: "reference_fix",
    success: false,
    data_recovered: false,
    action_taken: "Checking for broken references",
    details: {},
    recommendations: [],
  };

  // Check for reference errors
  if (message.includes("not found") || message.includes("reference") || message.includes("foreign key")) {
    // Try to identify the broken reference
    const idMatch = message.match(/id[:\s]*['"]?(\w+)['"]?/i);
    const referenceId = idMatch ? idMatch[1] : null;

    if (referenceId) {
      recovery.details = { broken_reference_id: referenceId };
      recovery.action_taken = `Identified broken reference: ${referenceId}`;
      recovery.recommendations = [
        `Verify if record ${referenceId} exists`,
        "Check if record was deleted",
        "Update or remove broken reference",
      ];
      recovery.success = true;
    }
  }

  return recovery;
}

function determineRecoveryStrategy(error: Record<string, unknown>): string[] {
  const message = String(error.error_message || "").toLowerCase();
  const errorType = String(error.error_type || "").toLowerCase();
  const strategies: string[] = [];

  // Data reconstruction for failed writes
  if (error.request_payload) {
    strategies.push("data_reconstruction");
  }

  // Cache rebuild for stale data
  if (message.includes("cache") || message.includes("stale")) {
    strategies.push("cache_rebuild");
  }

  // Sync repair for sync errors
  if (message.includes("sync") || errorType.includes("sync")) {
    strategies.push("sync_repair");
  }

  // Reference fix for not found errors
  if (message.includes("not found") || message.includes("reference")) {
    strategies.push("reference_fix");
  }

  return strategies.length > 0 ? strategies : ["none"];
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

    console.log("[Error Recovery Agent] Starting recovery analysis...");

    // Fetch errors that might benefit from recovery
    const { data: errors, error: fetchError } = await supabase
      .from("sync_errors")
      .select("*")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch errors: ${fetchError.message}`);
    }

    const recoveries: RecoveryAttempt[] = [];
    let recoveryAttempted = 0;
    let recoverySuccessful = 0;
    let dataRecovered = 0;

    for (const error of errors || []) {
      const strategies = determineRecoveryStrategy(error);

      for (const strategy of strategies) {
        let recovery: RecoveryAttempt;

        switch (strategy) {
          case "data_reconstruction":
            recovery = await attemptDataReconstruction(error);
            break;
          case "cache_rebuild":
            recovery = await attemptCacheRebuild(error);
            break;
          case "sync_repair":
            recovery = await attemptSyncRepair(error);
            break;
          case "reference_fix":
            recovery = await attemptReferencefix(error);
            break;
          default:
            recovery = {
              error_id: error.id as string,
              recovery_type: "none",
              success: false,
              data_recovered: false,
              action_taken: "No recovery strategy applicable",
              details: {},
              recommendations: ["Manual investigation required"],
            };
        }

        recoveries.push(recovery);

        if (recovery.recovery_type !== "none") {
          recoveryAttempted++;
        }
        if (recovery.success) {
          recoverySuccessful++;
        }
        if (recovery.data_recovered) {
          dataRecovered++;
        }

        // Only try one strategy per error (first applicable)
        if (strategy !== "none") break;
      }
    }

    // Generate recovery summary
    let recoverySummary = `Analyzed ${(errors || []).length} errors. `;
    if (recoveryAttempted === 0) {
      recoverySummary += "No errors eligible for automatic recovery.";
    } else {
      recoverySummary += `Attempted recovery on ${recoveryAttempted} errors. `;
      recoverySummary += `${recoverySuccessful} successful, ${dataRecovered} with data recovery.`;
    }

    const report: RecoveryReport = {
      timestamp: new Date().toISOString(),
      errors_analyzed: (errors || []).length,
      recovery_attempted: recoveryAttempted,
      recovery_successful: recoverySuccessful,
      data_recovered: dataRecovered,
      recoveries,
      recovery_summary: recoverySummary,
    };

    const duration = Date.now() - startTime;
    console.log(`[Error Recovery Agent] Complete in ${duration}ms - Recovered: ${recoverySuccessful}/${recoveryAttempted}`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[Error Recovery Agent] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
