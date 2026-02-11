/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildAgentPrompt } from "../_shared/unified-prompts.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import {
  corsHeaders,
  handleError,
  ErrorCode,
} from "../_shared/error-handler.ts";

serve(async (req) => {
  try {
    verifyAuth(req);
  } catch (e) {
    return errorToResponse(new UnauthorizedError());
  } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { date_range = "last_30d" } = await req.json().catch(() => ({}));

    // 1. Fetch The Truth (Data Reconciliation)
    // We call the internal function to get the reconciled data
    console.log(`🔍 Ad Creative Analyst: Fetching Truth for ${date_range}...`);

    // Parallel Fetch: Truth Engine + AI Learning Rules
    let truthRes;
    let learningRules = [];

    try {
      const [truthResponse, learningRulesRes] = await Promise.all([
        fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/data-reconciler`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ date_range }),
        }),
        supabase
          .from("ai_learning_rules")
          .select("*")
          .eq("is_active", true)
          .gte("confidence_score", 0.6)
          .order("success_count", { ascending: false })
          .limit(10),
      ]);
      truthRes = truthResponse;

      if (
        learningRulesRes.error &&
        learningRulesRes.error.code !== "PGRST116"
      ) {
        console.error("Error fetching learning rules:", learningRulesRes.error);
      } else {
        learningRules = learningRulesRes.data || [];
      }
    } catch (e) {
      console.warn("Parallel fetch failed, falling back to sequential:", e);
      // Fallback or re-throw if critical
      truthRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/data-reconciler`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ date_range }),
        },
      );
    }

    if (!truthRes.ok) {
      throw new Error(
        `Failed to fetch Truth Engine data: ${await truthRes.text()}`,
      );
    }

    const truthData = await truthRes.json();
    const learningRules = learningRulesRes.data || [];

    // Format Learning Context
    const learningContext =
      learningRules.length > 0
        ? learningRules
            .map(
              (r: any) =>
                `- Pattern: ${JSON.stringify(r.condition_pattern)} => Action: ${JSON.stringify(r.action_pattern)} (Confidence: ${r.confidence_score})`,
            )
            .join("\n")
        : "No historical patterns learned yet.";

    // 2. Build the Analyst Persona
    // We inject the World Knowledge manually here if needed, or rely on defaults
    const systemPrompt = buildAgentPrompt("AD_CREATIVE_ANALYST", {
      includeROI: true,
      worldKnowledge: {
        time: new Date().toISOString(),
        businessHours: "N/A (Analyst Mode)",
      },
    });

    // 3. Construct the Analysis Request
    const userPrompt = `
      HERE IS THE TRUTH ENGINE DATA FOR ${date_range.toUpperCase()}:
      
      HISTORICAL LEARNINGS (APPLY THESE):
      ${learningContext}
      
      FINANCIALS:
      - Ad Spend: ${truthData.financials.ad_spend}
      - Attributed Revenue: ${truthData.financials.attributed_revenue}
      - TRUE ROAS: ${truthData.intelligence.true_roas.toFixed(2)}
      - Reported ROAS (FB): ${truthData.intelligence.reported_roas.toFixed(2)}
      
      DISCREPANCIES DETECTED: ${truthData.discrepancies.count}
      
      CAMPAIGN PERFORMANCE (Top 20):
      ${JSON.stringify(truthData.intelligence.winning_campaigns.slice(0, 20), null, 2)}
      
      YOUR TASK:
      1. Analyze the creative performance based on TRUE ROAS.
      2. Identify "Zombie Ads" (High Spend > $500, ROAS < 1.5).
      3. Identify "Hidden Gems" (Low Spend < $500, ROAS > 3.0).
      4. Provide a bulleted "Kill/Scale" strategy.
      
      OUTPUT FORMAT:
      Return a JSON object with:
      {
        "executive_summary": "...",
        "true_roas_analysis": "...",
        "actions": [
          { "type": "KILL", "campaign": "...", "reason": "..." },
          { "type": "SCALE", "campaign": "...", "reason": "..." }
        ]
      }
    `;

    // 4. Execute AI Analysis
    console.log("🧠 Executing Ad Creative Analysis...");
    const aiResponse = await unifiedAI.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        jsonMode: true,
        temperature: 0.2, // Low temp for analytical precision
      },
    );

    let analysis = aiResponse.content;
    try {
      // Try to parse if it's a string, ensuring we return object
      analysis = JSON.parse(analysis);
    } catch (e) {
      // use raw string if parsing fails
    }

    return apiSuccess({
        success: true,
        data_source: "Truth Engine (HubSpot + AnyTrack + Meta)",
        analysis: analysis,
        raw_metrics: {
          spend: truthData.financials.ad_spend,
          true_roas: truthData.intelligence.true_roas,
        },
      });
  } catch (error: unknown) {
    return handleError(error, "ad-creative-analyst", {
      supabase: createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ),
      errorCode: ErrorCode.INTERNAL_ERROR,
      context: { function: "ad-creative-analyst" },
    });
  }
});
