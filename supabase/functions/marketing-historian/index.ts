import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";

/**
 * Marketing Historian Agent
 *
 * Skills applied:
 * - agent-memory-systems: Long-term memory, temporal scoring, weighted retrieval
 * - autonomous-agents: Single responsibility — ONLY builds historical baselines
 * - analytics-tracking: Decision-grade historical data
 *
 * Modes:
 * - "daily" — Updates 30/60/90d rolling baselines (runs every day at 03:45)
 * - "bootstrap" — First-time scan of ALL historical data for instant recommendations
 *
 * Reads: facebook_ads_insights, events, contacts, deals, attribution_events
 * Writes: historical_baselines
 * Cannot: Modify budgets, call Meta API, approve actions
 */

interface Baseline {
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
  best_week_start: string | null;
  best_week_roas: number | null;
  worst_week_start: string | null;
  worst_week_roas: number | null;
  patterns: Array<{ type: string; description: string; confidence: number }>;
}

serve(async (req) => {
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

    const { mode = "daily" } = await req.json().catch(() => ({}));
    const baselines: Baseline[] = [];
    const periods = [30, 60, 90];

    for (const days of periods) {
      const cutoff = new Date(Date.now() - days * 86400000).toISOString();
      const midpoint = new Date(
        Date.now() - (days / 2) * 86400000,
      ).toISOString();

      // ── Overall baselines ──
      const { data: spendData } = await supabase
        .from("facebook_ads_insights")
        .select("spend, impressions, clicks, date_start, campaign_name, ad_id")
        .gte("date_start", cutoff.split("T")[0]);

      const { data: leadEvents } = await supabase
        .from("events")
        .select("event_name, event_time, custom, source")
        .in("event_name", ["Lead", "lead_created", "Purchase"])
        .gte("event_time", cutoff);

      const { data: deals } = await supabase
        .from("deals")
        .select("stage, deal_value, hubspot_contact_id, created_at, updated_at")
        .gte("created_at", cutoff);

      const { data: contacts } = await supabase
        .from("contacts")
        .select("email, lifecycle_stage, owner_name, created_at")
        .gte("created_at", cutoff);

      const totalSpend = (spendData || []).reduce(
        (s: number, r: Record<string, unknown>) => s + (Number(r.spend) || 0),
        0,
      );

      const leads = (leadEvents || []).filter(
        (e: Record<string, unknown>) =>
          e.event_name === "Lead" || e.event_name === "lead_created",
      );
      const purchases = (leadEvents || []).filter(
        (e: Record<string, unknown>) => e.event_name === "Purchase",
      );

      const totalRevenue = purchases.reduce(
        (s: number, e: Record<string, unknown>) => {
          const custom = e.custom as Record<string, unknown> | null;
          return s + (Number(custom?.value) || 0);
        },
        0,
      );

      const assessments = (deals || []).filter(
        (d: Record<string, unknown>) => d.stage === "122237276",
      );
      const closedWon = (deals || []).filter(
        (d: Record<string, unknown>) => d.stage === "closedwon",
      );

      const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
      const avgCpl = leads.length > 0 ? totalSpend / leads.length : 0;
      const avgCpa = closedWon.length > 0 ? totalSpend / closedWon.length : 0;
      const ghostRate =
        assessments.length > 0
          ? 100 -
            (assessments.length /
              Math.max(
                (deals || []).filter(
                  (d: Record<string, unknown>) => d.stage === "122237508",
                ).length,
                assessments.length,
              )) *
              100
          : 0;
      const closeRate =
        assessments.length > 0
          ? (closedWon.length / assessments.length) * 100
          : 0;

      // ── Trend: compare first half vs second half ──
      const firstHalfSpend = (spendData || [])
        .filter(
          (r: Record<string, unknown>) =>
            String(r.date_start) < midpoint.split("T")[0],
        )
        .reduce(
          (s: number, r: Record<string, unknown>) => s + (Number(r.spend) || 0),
          0,
        );

      const secondHalfSpend = (spendData || [])
        .filter(
          (r: Record<string, unknown>) =>
            String(r.date_start) >= midpoint.split("T")[0],
        )
        .reduce(
          (s: number, r: Record<string, unknown>) => s + (Number(r.spend) || 0),
          0,
        );

      const firstHalfRevenue = purchases
        .filter((e: Record<string, unknown>) => String(e.event_time) < midpoint)
        .reduce((s: number, e: Record<string, unknown>) => {
          const custom = e.custom as Record<string, unknown> | null;
          return s + (Number(custom?.value) || 0);
        }, 0);

      const secondHalfRevenue = purchases
        .filter(
          (e: Record<string, unknown>) => String(e.event_time) >= midpoint,
        )
        .reduce((s: number, e: Record<string, unknown>) => {
          const custom = e.custom as Record<string, unknown> | null;
          return s + (Number(custom?.value) || 0);
        }, 0);

      const firstRoas =
        firstHalfSpend > 0 ? firstHalfRevenue / firstHalfSpend : 0;
      const secondRoas =
        secondHalfSpend > 0 ? secondHalfRevenue / secondHalfSpend : 0;
      const trendPct =
        firstRoas > 0 ? ((secondRoas - firstRoas) / firstRoas) * 100 : 0;
      const trendDirection =
        trendPct > 10 ? "improving" : trendPct < -10 ? "declining" : "stable";

      // ── Weekly ROAS for best/worst identification ──
      const weeklyMap: Record<string, { spend: number; revenue: number }> = {};
      for (const r of (spendData || []) as Array<Record<string, unknown>>) {
        const d = new Date(String(r.date_start));
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toISOString().split("T")[0];
        if (!weeklyMap[key]) weeklyMap[key] = { spend: 0, revenue: 0 };
        weeklyMap[key].spend += Number(r.spend) || 0;
      }
      for (const e of purchases as Array<Record<string, unknown>>) {
        const d = new Date(String(e.event_time));
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toISOString().split("T")[0];
        if (weeklyMap[key]) {
          const custom = e.custom as Record<string, unknown> | null;
          weeklyMap[key].revenue += Number(custom?.value) || 0;
        }
      }

      let bestWeek: { start: string; roas: number } | null = null;
      let worstWeek: { start: string; roas: number } | null = null;
      for (const [week, data] of Object.entries(weeklyMap)) {
        if (data.spend === 0) continue;
        const weekRoas = data.revenue / data.spend;
        if (!bestWeek || weekRoas > bestWeek.roas)
          bestWeek = { start: week, roas: weekRoas };
        if (!worstWeek || weekRoas < worstWeek.roas)
          worstWeek = { start: week, roas: weekRoas };
      }

      // ── Pattern detection ──
      const patterns: Array<{
        type: string;
        description: string;
        confidence: number;
      }> = [];

      if (ghostRate > 35) {
        patterns.push({
          type: "high_ghost_rate",
          description: `Ghost rate ${ghostRate.toFixed(1)}% over ${days}d — above 35% threshold`,
          confidence: 85,
        });
      }
      if (closeRate < 20) {
        patterns.push({
          type: "low_close_rate",
          description: `Close rate ${closeRate.toFixed(1)}% over ${days}d — below 25% benchmark`,
          confidence: 80,
        });
      }
      if (trendDirection === "declining") {
        patterns.push({
          type: "declining_roas",
          description: `ROAS declining ${Math.abs(trendPct).toFixed(1)}% in second half of ${days}d period`,
          confidence: 75,
        });
      }

      baselines.push({
        dimension_type: "overall",
        dimension_value: "all",
        period_days: days,
        avg_roas: Math.round(avgRoas * 100) / 100,
        avg_cpl: Math.round(avgCpl * 100) / 100,
        avg_cpa: Math.round(avgCpa * 100) / 100,
        avg_ghost_rate: Math.round(ghostRate * 100) / 100,
        avg_close_rate: Math.round(closeRate * 100) / 100,
        total_spend: Math.round(totalSpend * 100) / 100,
        total_leads: leads.length,
        total_assessments: assessments.length,
        total_purchases: closedWon.length,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        trend_direction: trendDirection,
        trend_pct: Math.round(trendPct * 100) / 100,
        best_week_start: bestWeek?.start || null,
        best_week_roas: bestWeek ? Math.round(bestWeek.roas * 100) / 100 : null,
        worst_week_start: worstWeek?.start || null,
        worst_week_roas: worstWeek
          ? Math.round(worstWeek.roas * 100) / 100
          : null,
        patterns,
      });

      // ── Per-coach baselines ──
      const coachMap: Record<
        string,
        { leads: number; won: number; assessments: number }
      > = {};
      for (const c of (contacts || []) as Array<Record<string, unknown>>) {
        const coach = String(c.owner_name || "unassigned");
        if (!coachMap[coach])
          coachMap[coach] = { leads: 0, won: 0, assessments: 0 };
        coachMap[coach].leads++;
      }
      for (const d of (deals || []) as Array<Record<string, unknown>>) {
        // Find contact for this deal to get coach
        const contact = (contacts || []).find(
          (c: Record<string, unknown>) => c.email && d.hubspot_contact_id,
        ) as Record<string, unknown> | undefined;
        const coach = String(contact?.owner_name || "unassigned");
        if (!coachMap[coach])
          coachMap[coach] = { leads: 0, won: 0, assessments: 0 };
        if (d.stage === "122237276") coachMap[coach].assessments++;
        if (d.stage === "closedwon") coachMap[coach].won++;
      }

      for (const [coach, data] of Object.entries(coachMap)) {
        if (coach === "unassigned" || data.leads < 3) continue;
        const coachCloseRate =
          data.assessments > 0 ? (data.won / data.assessments) * 100 : 0;
        baselines.push({
          dimension_type: "coach",
          dimension_value: coach,
          period_days: days,
          avg_roas: 0, // Coach doesn't affect ad-level ROAS
          avg_cpl: 0,
          avg_cpa: 0,
          avg_ghost_rate: 0,
          avg_close_rate: Math.round(coachCloseRate * 100) / 100,
          total_spend: 0,
          total_leads: data.leads,
          total_assessments: data.assessments,
          total_purchases: data.won,
          total_revenue: 0,
          trend_direction: "stable",
          trend_pct: 0,
          best_week_start: null,
          best_week_roas: null,
          worst_week_start: null,
          worst_week_roas: null,
          patterns:
            coachCloseRate < 20
              ? [
                  {
                    type: "low_coach_close_rate",
                    description: `${coach} closes at ${coachCloseRate.toFixed(1)}% — below 25% benchmark`,
                    confidence: 80,
                  },
                ]
              : [],
        });
      }
    }

    // ── Upsert all baselines ──
    for (const b of baselines) {
      await supabase
        .from("historical_baselines")
        .upsert(
          { ...b, computed_at: new Date().toISOString() },
          { onConflict: "dimension_type,dimension_value,period_days" },
        );
    }

    // Log
    await supabase.from("sync_logs").insert({
      platform: "marketing_historian",
      sync_type: "baseline_computation",
      status: "success",
      records_processed: baselines.length,
      message: `Historian (${mode}): Computed ${baselines.length} baselines across ${periods.join("/")}d periods`,
    });

    return apiSuccess({
      success: true,
      mode,
      baselines_computed: baselines.length,
      periods,
      dimensions: {
        overall: baselines.filter((b) => b.dimension_type === "overall").length,
        coach: baselines.filter((b) => b.dimension_type === "coach").length,
      },
    });
  } catch (error: unknown) {
    return handleError(error, "marketing-historian", {
      supabase: createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ),
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  }
});
