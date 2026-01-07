import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// ERROR TRIAGE AGENT
// Classifies and routes errors to appropriate handlers
// First responder for all system errors
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
  console.error("[Error Triage Agent] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

interface TriagedError {
  id: string;
  category: "integration" | "data" | "system" | "business" | "security";
  priority: "critical" | "high" | "medium" | "low";
  assigned_handler: string;
  original_error: Record<string, unknown>;
  triage_reason: string;
  estimated_resolution_time: string;
}

interface TriageReport {
  timestamp: string;
  errors_processed: number;
  triaged_errors: TriagedError[];
  category_breakdown: Record<string, number>;
  priority_breakdown: Record<string, number>;
}

function categorizeError(error: Record<string, unknown>): { category: TriagedError["category"]; handler: string } {
  const errorType = String(error.error_type || "").toLowerCase();
  const source = String(error.source || error.platform || "").toLowerCase();
  const message = String(error.error_message || "").toLowerCase();

  // Integration errors
  if (["hubspot", "stripe", "meta", "facebook", "callgear", "anytrack"].includes(source)) {
    return { category: "integration", handler: `${source}-error-handler` };
  }

  // Rate limiting
  if (errorType === "rate_limit" || message.includes("rate limit") || message.includes("429")) {
    return { category: "integration", handler: "api-rate-limit-handler" };
  }

  // Authentication/Security
  if (errorType === "auth" || message.includes("unauthorized") || message.includes("forbidden") || message.includes("401") || message.includes("403")) {
    return { category: "security", handler: "error-notification-agent" };
  }

  // Data validation
  if (errorType === "validation" || errorType === "field_mapping" || message.includes("invalid") || message.includes("schema")) {
    return { category: "data", handler: "error-auto-resolver" };
  }

  // Network/Timeout
  if (errorType === "timeout" || errorType === "network" || message.includes("timeout") || message.includes("connection")) {
    return { category: "system", handler: "error-retry-orchestrator" };
  }

  // Business logic errors
  if (message.includes("business") || message.includes("workflow") || message.includes("process")) {
    return { category: "business", handler: "error-root-cause-analyzer" };
  }

  // Default to system error
  return { category: "system", handler: "error-pattern-analyzer" };
}

function calculatePriority(error: Record<string, unknown>, category: string): TriagedError["priority"] {
  const retryCount = Number(error.retry_count || 0);
  const maxRetries = Number(error.max_retries || 3);
  const source = String(error.source || error.platform || "").toLowerCase();

  // Critical: Payment/financial errors or max retries reached
  if (source === "stripe" || retryCount >= maxRetries) {
    return "critical";
  }

  // Critical: Security errors
  if (category === "security") {
    return "critical";
  }

  // High: Core integration failures
  if (category === "integration" && ["hubspot", "meta"].includes(source)) {
    return "high";
  }

  // High: Errors with multiple retry attempts
  if (retryCount > 1) {
    return "high";
  }

  // Medium: Data errors
  if (category === "data") {
    return "medium";
  }

  // Default: Low
  return "low";
}

function estimateResolutionTime(priority: string, category: string): string {
  const estimates: Record<string, Record<string, string>> = {
    critical: { integration: "15 minutes", security: "immediate", system: "30 minutes", data: "1 hour", business: "2 hours" },
    high: { integration: "1 hour", security: "30 minutes", system: "2 hours", data: "4 hours", business: "4 hours" },
    medium: { integration: "4 hours", security: "2 hours", system: "8 hours", data: "24 hours", business: "24 hours" },
    low: { integration: "24 hours", security: "8 hours", system: "48 hours", data: "72 hours", business: "72 hours" },
  };
  return estimates[priority]?.[category] || "24 hours";
}

// ============================================
// DISPATCHER LOGIC
// ============================================

async function dispatchToSpecialist(
  supabase: any, 
  error: TriagedError
): Promise<{ dispatched: boolean; agent: string; action_id?: string }> {
  
  // 1. CODE/LOGIC ERRORS -> PTD SELF DEVELOPER
  if (error.category === "business" || error.category === "data" || error.category === "system") {
    console.log(`[Dispatcher] Routing ${error.id} to PTD Self-Developer`);
    
    // Create a command for the developer
    const command = `Fix ${error.priority} priority error in ${error.original_error.source || 'system'}: ${error.original_error.error_message}. 
    Context: ${JSON.stringify(error.original_error)}`;

    // Invoke PTD Self-Developer
    const { data, error: invokeError } = await supabase.functions.invoke("ptd-self-developer", {
      body: { 
        command, 
        context: { error_id: error.id, triage_info: error } 
      }
    });

    if (!invokeError && data?.success) {
      return { dispatched: true, agent: "ptd-self-developer", action_id: data.action_id };
    }
  }

  // 2. OPS/INTEGRATION ERRORS -> PTD EXECUTE ACTION
  if (error.category === "integration" || error.category === "security") {
    console.log(`[Dispatcher] Routing ${error.id} to PTD Execute Action`);
    
    // Determine action based on error
    let action = "send_alert"; // Default
    let params: any = { 
      title: `Integration Failure: ${error.original_error.source}`,
      message: error.original_error.error_message,
      priority: "high"
    };

    if (error.category === "integration" && error.priority === "critical") {
      // For critical integration errors, maybe trigger a sync retry?
      action = "trigger_sync";
      params = { platform: error.original_error.source || "hubspot" };
    }

    const { data, error: invokeError } = await supabase.functions.invoke("ptd-execute-action", {
      body: { action, params }
    });

    if (!invokeError && data?.success) {
      return { dispatched: true, agent: "ptd-execute-action" };
    }
  }

  return { dispatched: false, agent: "none" };
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

    console.log("[Error Triage Agent] Starting error triage...");

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

    const triagedErrors: TriagedError[] = [];
    const categoryBreakdown: Record<string, number> = {};
    const priorityBreakdown: Record<string, number> = {};

    for (const error of errors || []) {
      const { category, handler } = categorizeError(error);
      const priority = calculatePriority(error, category);
      const estimatedTime = estimateResolutionTime(priority, category);

      const triaged: TriagedError = {
        id: error.id,
        category,
        priority,
        assigned_handler: handler,
        original_error: error,
        triage_reason: `Categorized as ${category} error based on source (${error.source || "unknown"}) and type (${error.error_type || "unknown"})`,
        estimated_resolution_time: estimatedTime,
      };

      triagedErrors.push(triaged);

      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
      priorityBreakdown[priority] = (priorityBreakdown[priority] || 0) + 1;

      // Update error with triage info
      await supabase
        .from("sync_errors")
        .update({
          error_details: {
            ...error.error_details,
            triage: {
              category,
              priority,
              assigned_handler: handler,
              triaged_at: new Date().toISOString(),
            },
          },
        })
        .eq("id", error.id);
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    triagedErrors.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    const report: TriageReport = {
      timestamp: new Date().toISOString(),
      errors_processed: triagedErrors.length,
      triaged_errors: triagedErrors,
      category_breakdown: categoryBreakdown,
      priority_breakdown: priorityBreakdown,
    };

    // Log critical errors as proactive insights AND DISPATCH
    const criticalErrors = triagedErrors.filter(e => e.priority === "critical" || e.priority === "high");
    
    for (const error of criticalErrors) {
      // 1. Create Insight
      await supabase.from("proactive_insights").upsert({
        insight_type: "error_triage",
        priority: error.priority,
        title: `Critical Error: ${error.category} - ${error.assigned_handler}`,
        content: `Triaged critical error requiring immediate attention. ${error.triage_reason}`,
        action_items: [`Route to ${error.assigned_handler}`, `Estimated resolution: ${error.estimated_resolution_time}`],
        affected_entities: { error_id: error.id, category: error.category },
        source_agent: "error_triage_agent",
        dedup_key: `triage_${error.id}`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "dedup_key", ignoreDuplicates: true });

      // 2. DISPATCH TO SPECIALIST (The "Active" Part)
      const dispatchResult = await dispatchToSpecialist(supabase, error);
      
      if (dispatchResult.dispatched) {
        console.log(`✅ Auto-dispatched error ${error.id} to ${dispatchResult.agent}`);
        
        // Update error status to indicate it's being handled
        await supabase.from("sync_errors").update({
          error_details: {
            ...error.original_error.error_details,
            dispatch: {
              agent: dispatchResult.agent,
              action_id: dispatchResult.action_id,
              dispatched_at: new Date().toISOString()
            }
          }
        }).eq("id", error.id);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Error Triage Agent] Complete in ${duration}ms - Triaged ${triagedErrors.length} errors`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[Error Triage Agent] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
