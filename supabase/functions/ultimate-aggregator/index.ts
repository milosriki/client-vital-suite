import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";

// Real Data Aggregator for "God Mode" — 3-Layer Architecture
// Layer 1: Executive Truth (spend vs revenue vs ROAS)
// Layer 2: Performance Matrix (per-creative from ad_creative_funnel)
// Layer 3: Atomic Ledger (per-lead from lead_full_journey)

serve(async (req) => {
  try { verifyAuth(req); } catch { throw new UnauthorizedError(); }
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Executive Truth — Real spend, revenue, ROAS from attribution views
    const { data: creativeFunnel } = await supabase
      .from("ad_creative_funnel")
      .select("spend, revenue, stripe_revenue, db_leads, closed_won, roas, true_roas");

    const totalSpend = creativeFunnel?.reduce((s, c) => s + (c.spend || 0), 0) || 0;
    const totalDealRevenue = creativeFunnel?.reduce((s, c) => s + (c.revenue || 0), 0) || 0;
    const totalStripeRevenue = creativeFunnel?.reduce((s, c) => s + (c.stripe_revenue || 0), 0) || 0;
    const bestRevenue = Math.max(totalDealRevenue, totalStripeRevenue);
    const trueRoas = totalSpend > 0 ? Math.round((bestRevenue / totalSpend) * 100) / 100 : 0;

    const executiveTruth = {
      meta_spend: totalSpend,
      hubspot_revenue: totalDealRevenue,
      stripe_revenue: totalStripeRevenue,
      true_roas: trueRoas,
      discrepancy_count: creativeFunnel?.filter(
        (c) => c.revenue > 0 && c.stripe_revenue > 0 && Math.abs(c.revenue - c.stripe_revenue) / c.revenue > 0.2
      ).length || 0,
    };

    // 2. Performance Matrix — Real creatives from ad_creative_funnel
    const { data: creativeRows } = await supabase
      .from("ad_creative_funnel")
      .select("*")
      .order("spend", { ascending: false })
      .limit(20);

    const creatives = (creativeRows || []).map((c: any) => ({
      id: c.ad_id,
      name: c.ad_name || c.ad_id,
      campaign: c.campaign_name,
      adset: c.adset_name,
      spend: c.spend || 0,
      impressions: c.impressions || 0,
      clicks: c.clicks || 0,
      leads: c.db_leads || 0,
      deals: c.closed_won || 0,
      revenue: c.revenue || 0,
      stripe_revenue: c.stripe_revenue || 0,
      roas: c.roas || 0,
      true_roas: c.true_roas || 0,
      cpl: c.cpl || 0,
      cpo: c.cpo || 0,
      status: c.creative_verdict === "WINNER" ? "winner"
        : c.creative_verdict === "PROFITABLE" ? "active"
        : c.creative_verdict === "UNPROFITABLE" ? "warning"
        : "active",
      optimization: {
        status: c.creative_verdict === "WINNER" ? "optimized"
          : c.creative_verdict === "UNPROFITABLE" ? "critical"
          : "monitoring",
        action: c.creative_verdict === "WINNER" ? "SCALE"
          : c.creative_verdict === "UNPROFITABLE" ? "KILL"
          : c.creative_verdict === "LOW_VOLUME" ? "MONITOR"
          : "HOLD",
        reason: c.creative_verdict === "WINNER"
          ? `High ROAS (${c.roas}x). Consider increasing budget.`
          : c.creative_verdict === "UNPROFITABLE"
            ? `ROAS below 1.0 (${c.roas}x). Stop or refresh.`
            : c.creative_verdict === "LOW_VOLUME"
              ? `Only ${c.db_leads} leads — need more data.`
              : `ROAS ${c.roas}x — monitoring.`,
      },
      quality: {
        quality_ranking: c.quality_ranking,
        engagement_ranking: c.engagement_rate_ranking,
        conversion_ranking: c.conversion_rate_ranking,
        video_completion_pct: c.video_completion_pct,
      },
    }));

    // 3. Adset performance
    const { data: adsetRows } = await supabase
      .from("adset_full_funnel")
      .select("*")
      .order("spend", { ascending: false })
      .limit(20);

    // 4. Atomic Ledger — Real leads from lead_full_journey (latest 50)
    const { data: journeyRows } = await supabase
      .from("lead_full_journey")
      .select("*")
      .order("last_updated_at", { ascending: false })
      .limit(50);

    const atomicLedger = (journeyRows || []).map((l: any) => ({
      id: l.contact_id,
      name: [l.first_name, l.last_name].filter(Boolean).join(" ") || "Unknown",
      email: l.email,
      source: l.attribution_source || "direct",
      campaign: l.fb_campaign_name,
      ad: l.fb_ad_name,
      creative_id: l.fb_ad_id,
      stage: l.deal_stage_label || "No Deal",
      value: l.deal_value || 0,
      health_score: l.health_score,
      health_zone: l.health_zone,
      total_calls: l.total_calls || 0,
      last_call: l.latest_call_date,
      days_in_stage: l.days_in_current_stage ? Math.round(l.days_in_current_stage) : null,
      lead_created: l.lead_created_at,
      last_active: l.last_updated_at,
    }));

    return apiSuccess({
      executive_truth: executiveTruth,
      performance_matrix: {
        creatives,
        ad_sets: adsetRows || [],
      },
      atomic_ledger: atomicLedger,
    });
  } catch (error: unknown) {
    return handleError(error, "ultimate-aggregator", {
      errorCode: ErrorCode.INTERNAL_ERROR,
      context: { function: "ultimate-aggregator" },
    });
  }
});
