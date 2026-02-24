import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface BaselineEntry {
  dimension_type: string;
  dimension_value: string;
  period_days: number;
  avg_roas: number;
  avg_cpl: number;
  avg_cpa: number;
  avg_ghost_rate: number;
  avg_close_rate: number;
  total_spend: number;
  total_leads: number;
  total_assessments: number;
  total_purchases: number;
  total_revenue: number;
  trend_direction: string;
  trend_pct: number;
  computed_at: string;
  created_at: string;
}

function round(n: number, decimals = 2): number {
  return Number(n.toFixed(decimals));
}

function computeTrend(current: number, previous: number): { direction: string; pct: number } {
  if (previous === 0) return { direction: "stable", pct: 0 };
  const pct = ((current - previous) / previous) * 100;
  if (pct > 5) return { direction: "up", pct: round(pct) };
  if (pct < -5) return { direction: "down", pct: round(pct) };
  return { direction: "stable", pct: round(pct) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const periods = [30, 60, 90];
    const entries: BaselineEntry[] = [];

    // ─── Helper: compute baselines for a set of fb insights + deals ───────────
    function computeBaseline(
      dimensionType: string,
      dimensionValue: string,
      periodDays: number,
      insights: Array<{ spend: number | null; impressions: number | null; clicks: number | null; leads: number | null }>,
      deals: Array<{ stage: string | null; amount: number | null; value_aed: number | null }>
    ): BaselineEntry {
      const totalSpend = insights.reduce((s, r) => s + (Number(r.spend) || 0), 0);
      const totalLeads = insights.reduce((s, r) => s + (Number(r.leads) || 0), 0);
      const totalClicks = insights.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
      const totalImpressions = insights.reduce((s, r) => s + (Number(r.impressions) || 0), 0);

      const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
      const _avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      const totalDeals = deals.length;
      const wonDeals = deals.filter((d) => ["closedwon", "closed_won"].includes(d.stage || ""));
      const totalRevenue = wonDeals.reduce((s, d) => s + (Number(d.value_aed) || Number(d.amount) || 0), 0);
      const closeRate = totalDeals > 0 ? wonDeals.length / totalDeals : 0;
      const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

      return {
        dimension_type: dimensionType,
        dimension_value: dimensionValue,
        period_days: periodDays,
        avg_roas: round(avgRoas, 4),
        avg_cpl: round(avgCpl, 2),
        avg_cpa: 0,
        avg_ghost_rate: 0,
        avg_close_rate: round(closeRate, 4),
        total_spend: round(totalSpend, 2),
        total_leads: totalLeads,
        total_assessments: 0,
        total_purchases: wonDeals.length,
        total_revenue: round(totalRevenue, 2),
        trend_direction: "stable",
        trend_pct: 0,
        computed_at: now.toISOString(),
        created_at: now.toISOString(),
      };
    }

    // ─── Load all FB insights (full history, needed for per-campaign) ──────────
    const { data: allInsights, error: insightErr } = await supabase
      .from("facebook_ads_insights")
      .select("spend, impressions, clicks, leads, campaign_id, campaign_name, date")
      .order("date", { ascending: false });

    if (insightErr) throw insightErr;

    // ─── Load all deals ────────────────────────────────────────────────────────
    const { data: allDeals, error: dealErr } = await supabase
      .from("deals")
      .select("stage, amount, value_aed, close_date, pipeline, owner_name");

    if (dealErr) throw dealErr;

    // ─── Load contacts per period for lead counts ──────────────────────────────
    // (used for overall new-lead baseline)

    for (const days of periods) {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
      const startStr = startDate.toISOString().split("T")[0];
      const endStr = now.toISOString().split("T")[0];

      const periodInsights = (allInsights || []).filter(
        (r) => r.date >= startStr && r.date <= endStr
      );
      const periodDeals = (allDeals || []).filter(
        (d) => d.close_date && d.close_date >= startStr && d.close_date <= endStr
      );

      if (periodInsights.length === 0 && periodDeals.length === 0) continue;

      // 1. OVERALL baseline
      entries.push(
        computeBaseline("overall", "all_campaigns", days, periodInsights, periodDeals)
      );

      // 2. Per-CAMPAIGN baselines (group by campaign_id)
      const campaignIds = [...new Set(periodInsights.map((r) => r.campaign_id).filter(Boolean))];
      for (const campaignId of campaignIds) {
        const campInsights = periodInsights.filter((r) => r.campaign_id === campaignId);
        // Use campaign_name for readability, fall back to ID
        const campaignName = campInsights[0]?.campaign_name || campaignId;
        entries.push(
          computeBaseline("campaign", String(campaignName), days, campInsights, periodDeals)
        );
      }

      // 3. Per-PIPELINE baselines (group deals by pipeline)
      const pipelines = [...new Set((periodDeals || []).map((d) => d.pipeline).filter(Boolean))];
      for (const pipeline of pipelines) {
        const pipelineDeals = periodDeals.filter((d) => d.pipeline === pipeline);
        entries.push(
          computeBaseline("pipeline", String(pipeline), days, [], pipelineDeals)
        );
      }
    }

    // ─── Compute trend_direction using 30d vs 60d comparison ──────────────────
    const overall30 = entries.find((e) => e.dimension_type === "overall" && e.period_days === 30);
    const overall60 = entries.find((e) => e.dimension_type === "overall" && e.period_days === 60);
    if (overall30 && overall60) {
      const trend = computeTrend(overall30.avg_roas, overall60.avg_roas);
      overall30.trend_direction = trend.direction;
      overall30.trend_pct = trend.pct;
    }

    if (entries.length === 0) {
      return new Response(
        JSON.stringify({ message: "No data to compute baselines", inserted: 0 }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Upsert all entries (conflict on unique key)
    const { error: insertError } = await supabase
      .from("historical_baselines")
      .upsert(entries, {
        onConflict: "dimension_type,dimension_value,period_days",
        ignoreDuplicates: false,
      });

    if (insertError) throw insertError;

    const summary = {
      total: entries.length,
      overall: entries.filter((e) => e.dimension_type === "overall").length,
      campaign: entries.filter((e) => e.dimension_type === "campaign").length,
      pipeline: entries.filter((e) => e.dimension_type === "pipeline").length,
    };

    return new Response(
      JSON.stringify({
        message: `Computed ${entries.length} baseline rows across ${periods.join("/")} day periods`,
        inserted: entries.length,
        breakdown: summary,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
