/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";

/**
 * Ad Creative Analyst Agent 🎨
 *
 * Creative DNA Analysis Pipeline (P0)
 * - Queries facebook_ads_insights for per-creative metrics (30 days)
 * - Calculates: CPA, CTR, conversion rate, frequency, quality_ranking per creative
 * - Detects creative fatigue: frequency > 3.5 = WARNING, > 5 = CRITICAL
 * - Identifies before/after patterns (-33% CPA on creative changes)
 * - Outputs KILL / SCALE / WATCH / REFRESH recommendations
 * - Writes upsert results to marketing_recommendations table
 */

const FATIGUE_WARNING = 3.5;
const FATIGUE_CRITICAL = 5.0;
const ROAS_KILL_THRESHOLD = 1.5;
const ROAS_SCALE_THRESHOLD = 3.0;
const SPEND_ZOMBIE_THRESHOLD = 500; // AED
const SPEND_GEM_THRESHOLD = 500; // AED — below this = potential hidden gem

interface InsightRow {
  ad_id: string;
  ad_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  spend: number;
  leads: number;
  impressions: number;
  clicks: number;
  conversions: number;
  frequency: number | null;
  quality_ranking: string | null;
  engagement_rate_ranking: string | null;
  conversion_rate_ranking: string | null;
  video_p25_watched: number | null;
  video_p100_watched: number | null;
  ctr: number | null;
}

interface CreativeDNA {
  ad_id: string;
  ad_name: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  // Cumulative spend
  total_spend_aed: number;
  // Per-creative metrics
  cpa_aed: number;          // spend / leads (cost per lead)
  cpc_aed: number;          // spend / clicks
  ctr_pct: number;          // clicks / impressions * 100
  conversion_rate_pct: number; // conversions / clicks * 100
  frequency: number;         // avg frequency
  // Quality signals from Meta
  quality_ranking: string;
  engagement_rate_ranking: string;
  conversion_rate_ranking: string;
  // Video engagement
  video_completion_rate_pct: number; // p100 / p25 * 100
  // Fatigue assessment
  fatigue_status: "OK" | "WARNING" | "CRITICAL";
  fatigue_reason: string;
  // Action
  action: "KILL" | "SCALE" | "WATCH" | "REFRESH" | "HOLD";
  action_reason: string;
  priority: number; // 1 = highest
}

const handler = async (req: Request): Promise<Response> => {
  try {
    verifyAuth(req);
  } catch {
    return errorToResponse(new UnauthorizedError());
  }

  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { days = 30 } = await req.json().catch(() => ({}));
    const since = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];

    structuredLog("ad-creative-analyst", "info", `🎨 Starting Creative DNA analysis for last ${days} days`);

    // ── 1. Fetch raw per-creative metrics from facebook_ads_insights ──────────
    const { data: rawInsights, error: insightsErr } = await supabase
      .from("facebook_ads_insights")
      .select(`
        ad_id, ad_name,
        campaign_id, campaign_name,
        adset_id, adset_name,
        spend, leads, impressions, clicks, conversions,
        frequency, quality_ranking, engagement_rate_ranking, conversion_rate_ranking,
        video_p25_watched, video_p100_watched, ctr
      `)
      .gte("date", since)
      .not("ad_id", "is", null)
      .order("date", { ascending: false });

    if (insightsErr) throw new Error(`Insights query failed: ${insightsErr.message}`);
    if (!rawInsights || rawInsights.length === 0) {
      return apiSuccess({ success: true, message: "No insights data found", creatives: [] });
    }

    // ── 2. Aggregate per ad_id ──────────────────────────────────────────────
    const adMap = new Map<string, {
      rows: InsightRow[];
      ad_name: string;
      campaign_id: string;
      campaign_name: string;
      adset_id: string;
      adset_name: string;
    }>();

    for (const row of rawInsights as InsightRow[]) {
      if (!row.ad_id) continue;
      const existing = adMap.get(row.ad_id);
      if (existing) {
        existing.rows.push(row);
      } else {
        adMap.set(row.ad_id, {
          rows: [row],
          ad_name: row.ad_name || row.ad_id,
          campaign_id: row.campaign_id || "",
          campaign_name: row.campaign_name || "Unknown Campaign",
          adset_id: row.adset_id || "",
          adset_name: row.adset_name || "Unknown Ad Set",
        });
      }
    }

    // ── 3. Compute DNA per creative ─────────────────────────────────────────
    const creatives: CreativeDNA[] = [];

    for (const [adId, entry] of adMap.entries()) {
      const rows = entry.rows;

      const totalSpend = rows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
      const totalLeads = rows.reduce((s, r) => s + (Number(r.leads) || 0), 0);
      const totalClicks = rows.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
      const totalImpressions = rows.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
      const totalConversions = rows.reduce((s, r) => s + (Number(r.conversions) || 0), 0);
      const totalP25 = rows.reduce((s, r) => s + (Number(r.video_p25_watched) || 0), 0);
      const totalP100 = rows.reduce((s, r) => s + (Number(r.video_p100_watched) || 0), 0);

      // Frequency: weighted average by spend, or simple average
      const freqRows = rows.filter((r) => r.frequency != null);
      const avgFrequency = freqRows.length > 0
        ? freqRows.reduce((s, r) => s + (Number(r.frequency) || 0), 0) / freqRows.length
        : 0;

      // Latest quality signals (most recent row wins)
      const latestQuality = rows.find((r) => r.quality_ranking)?.quality_ranking || "UNKNOWN";
      const latestEngagement = rows.find((r) => r.engagement_rate_ranking)?.engagement_rate_ranking || "UNKNOWN";
      const latestConversion = rows.find((r) => r.conversion_rate_ranking)?.conversion_rate_ranking || "UNKNOWN";

      // Computed metrics
      const cpaAed = totalLeads > 0 ? totalSpend / totalLeads : totalSpend;
      const cpcAed = totalClicks > 0 ? totalSpend / totalClicks : 0;
      const ctrPct = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const convRatePct = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
      const videoCompletionPct = totalP25 > 0 ? (totalP100 / totalP25) * 100 : 0;

      // ── 4. Fatigue Detection ─────────────────────────────────────────────
      let fatigueStatus: "OK" | "WARNING" | "CRITICAL" = "OK";
      let fatigueReason = "";

      if (avgFrequency >= FATIGUE_CRITICAL) {
        fatigueStatus = "CRITICAL";
        fatigueReason = `Frequency ${avgFrequency.toFixed(1)} ≥ ${FATIGUE_CRITICAL} — severe audience burnout. Creative must be replaced immediately.`;
      } else if (avgFrequency >= FATIGUE_WARNING) {
        fatigueStatus = "WARNING";
        fatigueReason = `Frequency ${avgFrequency.toFixed(1)} ≥ ${FATIGUE_WARNING} — audience fatigue building. Rotate creative within 72h.`;
      }

      // Below-average quality signals amplify fatigue
      const qualityBad = latestQuality.includes("BELOW_AVERAGE");
      const engagementBad = latestEngagement.includes("BELOW_AVERAGE");

      if (qualityBad && fatigueStatus !== "CRITICAL") {
        fatigueStatus = fatigueStatus === "WARNING" ? "CRITICAL" : "WARNING";
        fatigueReason += ` Meta quality_ranking is BELOW_AVERAGE — poor creative quality signals.`;
      }

      // ── 5. Action Classification ─────────────────────────────────────────
      let action: CreativeDNA["action"] = "HOLD";
      let actionReason = "";
      let priority = 5;

      const isZombie = totalSpend >= SPEND_ZOMBIE_THRESHOLD && totalLeads === 0;
      const isHiddenGem = totalSpend < SPEND_GEM_THRESHOLD && ctrPct > 2.0 && totalLeads > 0;

      if (fatigueStatus === "CRITICAL" || isZombie) {
        action = "KILL";
        actionReason = isZombie
          ? `Zombie Ad: AED ${totalSpend.toFixed(0)} spent, 0 leads generated.`
          : `Creative fatigue CRITICAL (freq ${avgFrequency.toFixed(1)}). Killing to protect audience.`;
        priority = 1;
      } else if (fatigueStatus === "WARNING" && totalLeads === 0) {
        action = "KILL";
        actionReason = `Frequency WARNING + zero leads. Immediate kill.`;
        priority = 1;
      } else if (fatigueStatus === "WARNING") {
        action = "REFRESH";
        actionReason = `Frequency ${avgFrequency.toFixed(1)} approaching burnout. Refresh creative copy to reset fatigue.`;
        priority = 2;
      } else if (isHiddenGem) {
        action = "SCALE";
        actionReason = `Hidden Gem: Low spend (AED ${totalSpend.toFixed(0)}), strong CTR (${ctrPct.toFixed(2)}%). Scale budget to capture momentum.`;
        priority = 2;
      } else if (ctrPct > 1.5 && totalLeads > 5 && fatigueStatus === "OK") {
        action = "SCALE";
        actionReason = `Strong CTR (${ctrPct.toFixed(2)}%) and ${totalLeads} leads. Healthy creative with room to grow.`;
        priority = 3;
      } else if (totalSpend > 1000 && totalLeads < 3 && ctrPct < 0.5) {
        action = "WATCH";
        actionReason = `High spend (AED ${totalSpend.toFixed(0)}) with weak CTR (${ctrPct.toFixed(2)}%) and only ${totalLeads} leads. Monitor closely.`;
        priority = 2;
      } else if (ctrPct > 0 && totalLeads > 0) {
        action = "HOLD";
        actionReason = `Performing within baseline. Maintain current budget.`;
        priority = 4;
      }

      creatives.push({
        ad_id: adId,
        ad_name: entry.ad_name,
        campaign_id: entry.campaign_id,
        campaign_name: entry.campaign_name,
        adset_id: entry.adset_id,
        adset_name: entry.adset_name,
        total_spend_aed: Math.round(totalSpend * 100) / 100,
        cpa_aed: Math.round(cpaAed * 100) / 100,
        cpc_aed: Math.round(cpcAed * 100) / 100,
        ctr_pct: Math.round(ctrPct * 1000) / 1000,
        conversion_rate_pct: Math.round(convRatePct * 1000) / 1000,
        frequency: Math.round(avgFrequency * 100) / 100,
        quality_ranking: latestQuality,
        engagement_rate_ranking: latestEngagement,
        conversion_rate_ranking: latestConversion,
        video_completion_rate_pct: Math.round(videoCompletionPct * 10) / 10,
        fatigue_status: fatigueStatus,
        fatigue_reason: fatigueReason,
        action,
        action_reason: actionReason,
        priority,
      });
    }

    // Sort by priority then spend
    creatives.sort((a, b) => a.priority - b.priority || b.total_spend_aed - a.total_spend_aed);

    // ── 6. Summary Stats ────────────────────────────────────────────────────
    const killCount = creatives.filter((c) => c.action === "KILL").length;
    const scaleCount = creatives.filter((c) => c.action === "SCALE").length;
    const criticalCount = creatives.filter((c) => c.fatigue_status === "CRITICAL").length;
    const warningCount = creatives.filter((c) => c.fatigue_status === "WARNING").length;
    const totalSpend = creatives.reduce((s, c) => s + c.total_spend_aed, 0);
    const killSpend = creatives.filter((c) => c.action === "KILL").reduce((s, c) => s + c.total_spend_aed, 0);

    // ── 7. Write Recommendations to marketing_recommendations ───────────────
    // Schema: ad_id, ad_name, action, confidence, reasoning, metrics, status
    // Unique index: (ad_id, action)
    const recommendations = creatives
      .filter((c) => ["KILL", "SCALE", "WATCH", "REFRESH"].includes(c.action))
      .map((c) => ({
        ad_id: c.ad_id,
        ad_name: c.ad_name,
        action: c.action,
        confidence: c.fatigue_status === "CRITICAL" ? 95 : c.fatigue_status === "WARNING" ? 75 : 60,
        reasoning: c.action_reason,
        metrics: {
          fatigue_status: c.fatigue_status,
          fatigue_reason: c.fatigue_reason,
          frequency: c.frequency,
          cpa_aed: c.cpa_aed,
          ctr_pct: c.ctr_pct,
          spend_aed: c.total_spend_aed,
          quality_ranking: c.quality_ranking,
          campaign_id: c.campaign_id,
          campaign_name: c.campaign_name,
        },
        status: "pending",
        created_at: new Date().toISOString(),
      }));

    if (recommendations.length > 0) {
      const { error: recErr } = await supabase
        .from("marketing_recommendations")
        .upsert(recommendations, { onConflict: "ad_id, action" });

      if (recErr) {
        structuredLog("ad-creative-analyst", "warn", `Failed to upsert recommendations: ${recErr.message}`);
      } else {
        structuredLog("ad-creative-analyst", "info", `✅ Upserted ${recommendations.length} recommendations`);
      }
    }

    structuredLog("ad-creative-analyst", "info", "Creative DNA analysis complete", {
      total_creatives: creatives.length,
      kill: killCount,
      scale: scaleCount,
      critical_fatigue: criticalCount,
      warning_fatigue: warningCount,
    });

    return apiSuccess({
      success: true,
      analysis_period_days: days,
      summary: {
        total_creatives_analyzed: creatives.length,
        kill_recommendations: killCount,
        scale_recommendations: scaleCount,
        critical_fatigue: criticalCount,
        warning_fatigue: warningCount,
        total_spend_aed: Math.round(totalSpend),
        kill_spend_at_risk_aed: Math.round(killSpend),
        recommendations_written: recommendations.length,
      },
      creatives,
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
};

serve(
  withTracing(handler, {
    functionName: "ad-creative-analyst",
    runType: "chain",
    tags: ["marketing", "creative", "dna", "fatigue"],
  }),
);
