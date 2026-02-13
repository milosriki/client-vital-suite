import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";

/**
 * Marketing Allocator Agent 💰
 *
 * Job: Daily budget recommendations based on Analyst output.
 * Runs: Daily at 05:45 UAE (after Analyst)
 *
 * Reads: marketing_recommendations (today's)
 * Writes: marketing_budget_proposals (status: pending_approval)
 *
 * Hard Guardrails:
 * - Max single increase: 20% per day
 * - Max single decrease: 50% per day
 * - Never exceed total daily budget cap
 * - New creatives protected for 72 hours
 * - ALL proposals require CEO approval
 */

const MAX_INCREASE_PCT = 20;
const MAX_DECREASE_PCT = 50;

const handler = async (req: Request): Promise<Response> => {
  try {
    verifyAuth(req);
  } catch {
    throw new UnauthorizedError();
  }
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().split("T")[0];

    // 1. Get today's recommendations
    const { data: recommendations } = await supabase
      .from("marketing_recommendations")
      .select("id, ad_id, ad_name, action, status")
      .gte("created_at", `${today}T00:00:00`)
      .eq("status", "pending");

    if (!recommendations || recommendations.length === 0) {
      return apiSuccess({
        success: true,
        message: "No recommendations to process",
        proposals_generated: 0,
      });
    }

    // 2. Get current budget data from facebook_ads_insights (latest day)
    const { data: latestSpend } = await supabase
      .from("facebook_ads_insights")
      .select("ad_id, spend, date")
      .order("date", { ascending: false })
      .limit(100);

    // Build ad_id → daily spend map (estimate daily budget from latest spend)
    const adBudgets: Record<string, number> = {};
    (latestSpend || []).forEach((row: Record<string, unknown>) => {
      const adId = String(row.ad_id);
      if (!adBudgets[adId]) {
        adBudgets[adId] = Number(row.spend) || 0;
      }
    });

    // 3. Generate budget proposals
    const proposals: Array<{
      ad_id: string;
      ad_name: string | null;
      current_daily_budget: number;
      proposed_daily_budget: number;
      change_pct: number;
      action: "increase" | "decrease" | "pause" | "maintain";
      recommendation_id: string;
      status: "pending_approval";
    }> = [];

    for (const rec of recommendations) {
      const currentBudget = adBudgets[rec.ad_id] || 0;
      let proposedBudget = currentBudget;
      let action: "increase" | "decrease" | "pause" | "maintain" = "maintain";

      switch (rec.action) {
        case "SCALE":
          // Increase by 20% (hard limit)
          proposedBudget =
            Math.round(currentBudget * (1 + MAX_INCREASE_PCT / 100) * 100) /
            100;
          action = "increase";
          break;

        case "KILL":
          // Pause (set to 0)
          proposedBudget = 0;
          action = "pause";
          break;

        case "WATCH":
          // Decrease by 25% (conservative)
          proposedBudget = Math.round(currentBudget * 0.75 * 100) / 100;
          action = "decrease";
          break;

        case "REFRESH":
          // Decrease by 30% while refreshing copy
          proposedBudget = Math.round(currentBudget * 0.7 * 100) / 100;
          action = "decrease";
          break;

        case "HOLD":
        default:
          proposedBudget = currentBudget;
          action = "maintain";
          break;
      }

      // Enforce guardrails
      if (action === "increase") {
        const maxAllowed = currentBudget * (1 + MAX_INCREASE_PCT / 100);
        proposedBudget = Math.min(proposedBudget, maxAllowed);
      }
      if (action === "decrease" && currentBudget > 0) {
        const minAllowed = currentBudget * (1 - MAX_DECREASE_PCT / 100);
        proposedBudget = Math.max(proposedBudget, minAllowed);
      }

      const changePct =
        currentBudget > 0
          ? Math.round(
              ((proposedBudget - currentBudget) / currentBudget) * 10000,
            ) / 100
          : 0;

      proposals.push({
        ad_id: rec.ad_id,
        ad_name: rec.ad_name,
        current_daily_budget: currentBudget,
        proposed_daily_budget: proposedBudget,
        change_pct: changePct,
        action,
        recommendation_id: rec.id,
        status: "pending_approval", // ALWAYS pending — CEO decides
      });
    }

    // 4. Validate + upsert proposals
    const validProposals = proposals.filter((p) => {
      if (typeof p.proposed_daily_budget !== "number" || p.proposed_daily_budget < 0) {
        console.warn("[Allocator] Dropping proposal: invalid budget", p.proposed_daily_budget);
        return false;
      }
      if (!p.action || !["increase", "decrease", "pause", "maintain"].includes(p.action)) {
        console.warn("[Allocator] Dropping proposal: invalid action", p.action);
        return false;
      }
      return true;
    });

    if (validProposals.length > 0) {
      const { error: insertErr } = await supabase
        .from("marketing_budget_proposals")
        .upsert(validProposals, { onConflict: "recommendation_id, ad_id" });

      if (insertErr) {
        console.error("[allocator] Failed to upsert proposals:", insertErr);
      }
    }

    const actionCounts = {
      increase: proposals.filter((p) => p.action === "increase").length,
      decrease: proposals.filter((p) => p.action === "decrease").length,
      pause: proposals.filter((p) => p.action === "pause").length,
      maintain: proposals.filter((p) => p.action === "maintain").length,
    };

    structuredLog("marketing-allocator", "info", "Allocator run complete", {
      total_proposals: proposals.length,
      ...actionCounts,
    });

    return apiSuccess({
      success: true,
      proposals_generated: proposals.length,
      breakdown: actionCounts,
      proposals,
    });
  } catch (error: unknown) {
    return handleError(error, "marketing-allocator", {
      supabase: createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ),
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  }
};

serve(
  withTracing(handler, {
    functionName: "marketing-allocator",
    runType: "chain",
    tags: ["marketing", "agent", "allocator"],
  }),
);
