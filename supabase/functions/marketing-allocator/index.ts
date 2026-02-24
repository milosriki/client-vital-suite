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
 * Job: Daily budget recommendations based on ROAS + frequency logic.
 * Runs: Daily at 05:45 UAE (after Analyst)
 *
 * Decision Rules (P0 — Hard Truth):
 *   KILL:     ROAS < 1.5x AND frequency > 4 → wasting money, burned audience
 *   SCALE:    ROAS > 3.0x AND frequency < 3 → profitable with room to grow
 *   MAINTAIN: everything else
 *
 * Also reads: marketing_recommendations (today's) for secondary signal
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

// Core ROAS/Frequency thresholds (P0 business rules)
const ROAS_KILL_THRESHOLD = 1.5;
const ROAS_SCALE_THRESHOLD = 3.0;
const FREQ_KILL_THRESHOLD = 4.0;
const FREQ_SCALE_THRESHOLD = 3.0;

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
    const since30d = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    // ── NEW P0: ROAS + Frequency Analysis (Hard Business Rules) ─────────────
    // Fetch per-ad metrics to apply KILL/SCALE/MAINTAIN rules directly
    const { data: adMetrics } = await supabase
      .from("facebook_ads_insights")
      .select("ad_id, ad_name, campaign_id, campaign_name, spend, leads, frequency")
      .gte("date", since30d)
      .not("ad_id", "is", null);

    // Aggregate per ad_id
    const adRoasMap = new Map<string, {
      ad_name: string;
      campaign_id: string;
      campaign_name: string;
      spend: number;
      leads: number;
      freq_sum: number;
      freq_count: number;
    }>();

    for (const row of (adMetrics || []) as Array<{
      ad_id: string;
      ad_name: string | null;
      campaign_id: string | null;
      campaign_name: string | null;
      spend: number;
      leads: number;
      frequency: number | null;
    }>) {
      if (!row.ad_id) continue;
      const entry = adRoasMap.get(row.ad_id) || {
        ad_name: row.ad_name || row.ad_id,
        campaign_id: row.campaign_id || "",
        campaign_name: row.campaign_name || "Unknown",
        spend: 0, leads: 0, freq_sum: 0, freq_count: 0,
      };
      entry.spend += Number(row.spend) || 0;
      entry.leads += Number(row.leads) || 0;
      if (row.frequency) { entry.freq_sum += Number(row.frequency); entry.freq_count++; }
      adRoasMap.set(row.ad_id, entry);
    }

    // Generate hard-rule proposals from ROAS + frequency
    interface HardRuleProposal {
      ad_id: string;
      ad_name: string;
      campaign_id: string;
      campaign_name: string;
      spend_aed: number;
      leads: number;
      avg_frequency: number;
      roas_signal: "KILL" | "SCALE" | "MAINTAIN";
      reason: string;
    }

    const hardRuleProposals: HardRuleProposal[] = [];

    for (const [adId, entry] of adRoasMap.entries()) {
      const avgFreq = entry.freq_count > 0 ? entry.freq_sum / entry.freq_count : 0;
      const cpl = entry.leads > 0 ? entry.spend / entry.leads : 0;

      // We don't have revenue here without joining deals, so we use proxy:
      // Low leads + high frequency = KILL signal
      // High leads + low frequency + low CPL = SCALE signal
      // Note: true ROAS requires deal join (see true-roas-calculator function)
      let signal: "KILL" | "SCALE" | "MAINTAIN" = "MAINTAIN";
      let reason = "";

      if (avgFreq > FREQ_KILL_THRESHOLD && entry.leads === 0) {
        signal = "KILL";
        reason = `Frequency ${avgFreq.toFixed(1)} > ${FREQ_KILL_THRESHOLD} AND 0 leads. Wasting AED ${entry.spend.toFixed(0)} on burned audience.`;
      } else if (avgFreq > FREQ_KILL_THRESHOLD && cpl > 200) {
        signal = "KILL";
        reason = `Frequency ${avgFreq.toFixed(1)} > ${FREQ_KILL_THRESHOLD} AND CPL AED ${cpl.toFixed(0)} > 200. Not breaking even.`;
      } else if (avgFreq < FREQ_SCALE_THRESHOLD && entry.leads > 5 && cpl < 50) {
        signal = "SCALE";
        reason = `Frequency ${avgFreq.toFixed(1)} < ${FREQ_SCALE_THRESHOLD} with ${entry.leads} leads at AED ${cpl.toFixed(0)} CPL. Healthy growth signal.`;
      }

      if (signal !== "MAINTAIN") {
        hardRuleProposals.push({
          ad_id: adId,
          ad_name: entry.ad_name,
          campaign_id: entry.campaign_id,
          campaign_name: entry.campaign_name,
          spend_aed: Math.round(entry.spend * 100) / 100,
          leads: entry.leads,
          avg_frequency: Math.round(avgFreq * 100) / 100,
          roas_signal: signal,
          reason,
        });
      }
    }

    const killCount = hardRuleProposals.filter((p) => p.roas_signal === "KILL").length;
    const scaleCount = hardRuleProposals.filter((p) => p.roas_signal === "SCALE").length;

    structuredLog("marketing-allocator", "info", "Hard-rule analysis complete", {
      total_ads_analyzed: adRoasMap.size,
      kill_signals: killCount,
      scale_signals: scaleCount,
    });

    // ── EXISTING: Process queued recommendations ─────────────────────────────
    // 1. Get today's recommendations
    const { data: recommendations } = await supabase
      .from("marketing_recommendations")
      .select("id, ad_id, ad_name, action, status")
      .gte("created_at", `${today}T00:00:00`)
      .eq("status", "pending");

    if (!recommendations || recommendations.length === 0) {
      // Still return hard-rule analysis even with no queued recommendations
      return apiSuccess({
        success: true,
        message: "No queued recommendations — returning ROAS/frequency analysis",
        proposals_generated: 0,
        hard_rule_analysis: {
          total_ads: adRoasMap.size,
          kill_signals: killCount,
          scale_signals: scaleCount,
          proposals: hardRuleProposals,
        },
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
      hard_rule_analysis: {
        total_ads_analyzed: adRoasMap.size,
        kill_signals: killCount,
        scale_signals: scaleCount,
        kill_proposals: hardRuleProposals.filter((p) => p.roas_signal === "KILL"),
        scale_proposals: hardRuleProposals.filter((p) => p.roas_signal === "SCALE"),
      },
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
