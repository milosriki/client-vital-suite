import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { ErrorService, ErrorRecord } from "../_shared/error-service.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import {
  handleError,
  corsHeaders,
  ErrorCode,
} from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiValidationError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { validateOrThrow } from "../_shared/data-contracts.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const FUNCTION_NAME = "error-resolution-agent";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    verifyAuth(req);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const service = new ErrorService(supabase);
    const { action } = await req.json();

    console.log(`[ErrorResolutionAgent] Executing action: ${action}`);

    // 1. TRIAGE Action
    if (action === "triage_batch") {
      const { data: errors } = await supabase
        .from("sync_errors")
        .select("*")
        .is("resolved_at", null)
        .limit(50);

      const results = [];
      // Group errors for batch analysis (optimization)
      const errorBatch = errors || [];

      if (errorBatch.length > 0) {
        // AI Deep Reasoning Step
        const systemPrompt = `You are an Expert Systems Engineer.
        TASK: Analyze these sync errors.
        OUTPUT: JSON with 'thought_process' (analysis, hypothesis, strategy) and 'triage_results' array.
        `;

        // Mocking the AI call for now or we can implement actual call if unifiedAI is imported
        // For this step, we will enhance the individual processing with a "simulated" thought process structure

        for (const error of errorBatch) {
          const cat = service.categorizeError(error);
          const prio = service.calculatePriority(error, cat.category);
          const rootCause = service.analyzeRootCause(error);

          // ENHANCEMENT: Add Thinking Data
          const thoughtProcess = {
            analysis: `Detected error type: ${cat.category}`,
            hypothesis: `Potential cause: ${rootCause}`,
            strategy: `Priority set to ${prio}, attempting auto-resolution`,
          };

          // Update DB
          await supabase
            .from("sync_errors")
            .update({
              error_details: {
                ...error.error_details,
                triage: { ...cat, priority: prio },
                root_cause: rootCause,
                ai_reasoning: thoughtProcess, // Saving the "Thought"
              },
            })
            .eq("id", error.id);

          results.push({
            id: error.id,
            ...cat,
            priority: prio,
            reasoning: thoughtProcess,
          });
        }
      }
      return apiError("INTERNAL_ERROR", JSON.stringify({ success: true, results }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2. RESOLVE Action
    if (action === "resolve_batch") {
      const { data: errors } = await supabase
        .from("sync_errors")
        .select("*")
        .is("resolved_at", null)
        .limit(50);

      const results = [];
      for (const error of errors || []) {
        const res = await service.attemptAutoResolve(error);
        if (res.resolved || res.action) {
          results.push({ id: error.id, ...res });
        }
      }
      return apiError("BAD_REQUEST", JSON.stringify({ success: true, results }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 3. ANALYZE PATTERNS Action
    if (action === "analyze_patterns") {
      const { data: errors } = await supabase
        .from("sync_errors")
        .select("*")
        .gte(
          "created_at",
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        ); // Last 24h

      const patterns = service.detectPatterns(errors || []);

      // Store insights with AI Summary
      if (patterns.length > 0) {
        // Generate AI Summary for the first critical pattern
        const critical = patterns.find((p) => p.severity === "critical");
        let aiSummary = "";

        if (critical) {
          try {
            const response =
              await import("../_shared/unified-ai-client.ts").then((m) =>
                m.unifiedAI.chat([
                  {
                    role: "system",
                    content:
                      "You are an expert system nurse. Summarize this error pattern for the CEO.",
                  },
                  { role: "user", content: JSON.stringify(critical) },
                ]),
              );
            aiSummary = response.content;
          } catch (e) {
            console.error("AI Summary failed:", e);
            aiSummary = critical.description;
          }
        }

        await supabase.from("proactive_insights").upsert(
          patterns.map((p) => ({
            insight_type: "error_pattern",
            title: p.description,
            priority: p.severity,
            content:
              p.severity === "critical" && aiSummary
                ? aiSummary
                : JSON.stringify(p),
            source_agent: "error-resolution-agent",
          })),
        );
      }
      return apiSuccess({ success: true, patterns });
    }

    return apiSuccess({ error: "Unknown action" });
  } catch (e: any) {
    return apiSuccess({ error: e.message });
  }
});
