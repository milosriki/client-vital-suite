import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    console.log("[Ultimate Fix] Starting System-Wide Healing...");

    // 1. Trigger the Brain (Super Orchestrator)
    console.log("[Ultimate Fix] Step 1: Invoking Super Agent Orchestrator...");
    const { data: orchestratorResult, error: orchError } = await supabase.functions.invoke("super-agent-orchestrator", {
      body: { mode: "full", trigger_healing: true }
    });

    if (orchError) throw new Error(`Orchestrator failed: ${orchError.message}`);

    const runId = orchestratorResult.run_id;
    console.log(`[Ultimate Fix] Orchestrator Run ID: ${runId}`);

    // 2. Check for triggered triage
    // The orchestrator triggers triage asynchronously, so we check if any insights were created
    const { data: insights } = await supabase
      .from("proactive_insights")
      .select("id")
      .eq("insight_type", "error_triage")
      .gt("created_at", new Date(Date.now() - 60000).toISOString()); // Last minute

    const criticalIssues = insights?.length || 0;
    console.log(`[Ultimate Fix] Step 2: Found ${criticalIssues} critical issues triaged.`);

    // 3. Check for dispatched actions
    // We check if any prepared actions were created by ptd-self-developer
    const { data: actions } = await supabase
      .from("prepared_actions")
      .select("id")
      .gt("created_at", new Date(Date.now() - 60000).toISOString());

    const actionsPrepared = actions?.length || 0;
    console.log(`[Ultimate Fix] Step 3: ${actionsPrepared} fix actions prepared.`);

    return apiSuccess({
      success: true,
      message: "Ultimate Self-Healing Loop Triggered",
      details: {
        orchestrator_status: orchestratorResult.status,
        issues_found: criticalIssues,
        actions_prepared: actionsPrepared,
        next_steps: actionsPrepared > 0 ? "Review and approve prepared actions in Dashboard" : "System is healthy"
      }
    });

  } catch (error: unknown) {
    console.error("[Ultimate Fix] Failed:", error);
    return apiError("INTERNAL_ERROR", JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), 500);
  }
});
