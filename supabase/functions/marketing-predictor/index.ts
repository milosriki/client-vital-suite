import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";

/**
 * Marketing Predictor Agent 🔮
 *
 * Job: Forward-looking projections and fatigue detection.
 * Runs: Daily at 06:00 UAE (after Allocator)
 *
 * Reads: facebook_ads_insights (7-day trend), revenue_genome_7d, historical_baselines
 * Writes: marketing_fatigue_alerts
 *
 * Produces:
 * 1. Creative fatigue warnings (CTR declining for 3+ days)
 * 2. 30/60/90-day revenue projections (weighted with historical baselines)
 * 3. Trend reversal detection (positive or negative)
 * 4. Historical context in every recommendation
 */

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

    const alerts: Array<{
      ad_id: string;
      ad_name: string | null;
      ctr_today: number;
      ctr_3d_avg: number;
      ctr_delta_pct: number;
      projected_revenue_30d: number;
      projected_spend_30d: number;
      projected_roas_30d: number;
      projected_revenue_60d: number;
      projected_revenue_90d: number;
      historical_avg_roas: number;
      alert_type: "fatigue" | "opportunity" | "trend_reversal";
      recommendation: string;
    }> = [];

    // 0. Get historical baselines for weighted projections
    const { data: baselines } = await supabase
      .from("historical_baselines")
      .select(
        "period_days, avg_roas, avg_cpl, total_spend, total_revenue, trend_direction, trend_pct, best_week_roas, worst_week_roas",
      )
      .eq("dimension_type", "overall")
      .eq("dimension_value", "all");

    const baseline30 = (baselines || []).find(
      (b: Record<string, unknown>) => b.period_days === 30,
    );
    const baseline60 = (baselines || []).find(
      (b: Record<string, unknown>) => b.period_days === 60,
    );
    const baseline90 = (baselines || []).find(
      (b: Record<string, unknown>) => b.period_days === 90,
    );
    const historicalAvgRoas = Number(
      baseline90?.avg_roas || baseline60?.avg_roas || baseline30?.avg_roas || 0,
    );
    const historicalTrend = String(baseline30?.trend_direction || "stable");
    const historicalTrendPct = Number(baseline30?.trend_pct || 0);

    // 1. Get daily CTR data for last 7 days
    const { data: dailyData } = await supabase
      .from("facebook_ads_insights")
      .select("ad_id, ad_name, ctr, spend, date")
      .gte(
        "date",
        new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0],
      )
      .order("date", { ascending: true });

    // Group by ad_id
    const adTrends: Record<
      string,
      {
        ad_name: string;
        daily: { date: string; ctr: number; spend: number }[];
      }
    > = {};

    (dailyData || []).forEach((row: Record<string, unknown>) => {
      const adId = String(row.ad_id);
      if (!adTrends[adId]) {
        adTrends[adId] = { ad_name: String(row.ad_name || ""), daily: [] };
      }
      adTrends[adId].daily.push({
        date: String(row.date),
        ctr: Number(row.ctr) || 0,
        spend: Number(row.spend) || 0,
      });
    });

    // 2. Get revenue genome for 30-day projections
    const { data: genome } = await supabase
      .from("revenue_genome_7d")
      .select("*");

    const genomeMap: Record<string, Record<string, unknown>> = {};
    (genome || []).forEach((row: Record<string, unknown>) => {
      genomeMap[String(row.ad_id)] = row;
    });

    // 3. Analyze each creative
    for (const [adId, data] of Object.entries(adTrends)) {
      const sorted = data.daily.sort((a, b) => a.date.localeCompare(b.date));
      if (sorted.length < 3) continue;

      const last3 = sorted.slice(-3);
      const ctrToday = sorted[sorted.length - 1].ctr;
      const ctr3dAvg = last3.reduce((sum, d) => sum + d.ctr, 0) / last3.length;
      const ctrDelta =
        ctr3dAvg > 0 ? ((ctrToday - ctr3dAvg) / ctr3dAvg) * 100 : 0;

      // Get genome data for revenue projections
      const gRow = genomeMap[adId];
      const spend7d = gRow
        ? Number(gRow.spend_7d) || 0
        : sorted.reduce((sum, d) => sum + d.spend, 0);
      const revenue7d = gRow ? Number(gRow.revenue_7d) || 0 : 0;
      const roas7d = gRow ? Number(gRow.roas_7d) || 0 : 0;

      // Weighted projections: blend 7d pace with historical baselines
      // Weight: 60% current pace, 40% historical baseline (if available)
      const currentDailySpend = spend7d / 7;
      const currentDailyRevenue = revenue7d / 7;

      const histDailyRevenue = baseline30
        ? Number(baseline30.total_revenue) / 30
        : currentDailyRevenue;

      const blendedDailyRevenue =
        historicalAvgRoas > 0
          ? currentDailyRevenue * 0.6 + histDailyRevenue * 0.4
          : currentDailyRevenue;

      const projectedSpend30d = Math.round(currentDailySpend * 30);
      const projectedRevenue30d = Math.round(blendedDailyRevenue * 30);
      const projectedRevenue60d = Math.round(blendedDailyRevenue * 60);
      const projectedRevenue90d = Math.round(blendedDailyRevenue * 90);
      const projectedRoas30d =
        projectedSpend30d > 0
          ? Math.round((projectedRevenue30d / projectedSpend30d) * 100) / 100
          : 0;

      const histContext =
        historicalAvgRoas > 0
          ? ` (90d avg ROAS: ${historicalAvgRoas.toFixed(1)}x, trend: ${historicalTrend} ${historicalTrendPct > 0 ? "+" : ""}${historicalTrendPct.toFixed(1)}%)`
          : "";

      // Fatigue detection: CTR declining 3 consecutive days
      const declining =
        last3[0].ctr > last3[1].ctr && last3[1].ctr > last3[2].ctr;
      if (declining && ctrDelta < -15) {
        alerts.push({
          ad_id: adId,
          ad_name: data.ad_name,
          ctr_today: Math.round(ctrToday * 1000) / 1000,
          ctr_3d_avg: Math.round(ctr3dAvg * 1000) / 1000,
          ctr_delta_pct: Math.round(ctrDelta * 100) / 100,
          projected_revenue_30d: projectedRevenue30d,
          projected_spend_30d: projectedSpend30d,
          projected_roas_30d: projectedRoas30d,
          alert_type: "fatigue",
          projected_revenue_60d: projectedRevenue60d,
          projected_revenue_90d: projectedRevenue90d,
          historical_avg_roas: historicalAvgRoas,
          recommendation: `Creative fatigue detected (CTR: ${ctrToday.toFixed(2)}% ↓ from ${ctr3dAvg.toFixed(2)}%). Refresh by Day ${Math.min(sorted.length + 3, 10)} or expect ${Math.abs(Math.round(ctrDelta))}% further drop. 30d: AED ${projectedRevenue30d.toLocaleString()}, 90d: AED ${projectedRevenue90d.toLocaleString()}${histContext}. ${projectedRoas30d > 2 ? "Still profitable — prioritize refresh over kill." : "Low projected ROAS — consider pausing."}`,
        });
      }

      // Opportunity detection: CTR increasing 3 consecutive days
      const increasing =
        last3[0].ctr < last3[1].ctr && last3[1].ctr < last3[2].ctr;
      if (increasing && ctrDelta > 15) {
        alerts.push({
          ad_id: adId,
          ad_name: data.ad_name,
          ctr_today: Math.round(ctrToday * 1000) / 1000,
          ctr_3d_avg: Math.round(ctr3dAvg * 1000) / 1000,
          ctr_delta_pct: Math.round(ctrDelta * 100) / 100,
          projected_revenue_30d: projectedRevenue30d,
          projected_spend_30d: projectedSpend30d,
          projected_roas_30d: projectedRoas30d,
          alert_type: "opportunity",
          projected_revenue_60d: projectedRevenue60d,
          projected_revenue_90d: projectedRevenue90d,
          historical_avg_roas: historicalAvgRoas,
          recommendation: `Rising CTR (${ctr3dAvg.toFixed(2)}% → ${ctrToday.toFixed(2)}%). Projections: 30d AED ${projectedRevenue30d.toLocaleString()}, 60d AED ${projectedRevenue60d.toLocaleString()}, 90d AED ${projectedRevenue90d.toLocaleString()}${histContext}. Scale budget if trend holds 2 more days.`,
        });
      }

      // Trend reversal: Was declining, now recovering
      if (sorted.length >= 5) {
        const prev2 = sorted.slice(-5, -3);
        const wasDeclining = prev2.length >= 2 && prev2[0].ctr > prev2[1].ctr;
        const nowRecovering = last3[last3.length - 1].ctr > last3[0].ctr;

        if (wasDeclining && nowRecovering && Math.abs(ctrDelta) > 10) {
          alerts.push({
            ad_id: adId,
            ad_name: data.ad_name,
            ctr_today: Math.round(ctrToday * 1000) / 1000,
            ctr_3d_avg: Math.round(ctr3dAvg * 1000) / 1000,
            ctr_delta_pct: Math.round(ctrDelta * 100) / 100,
            projected_revenue_30d: projectedRevenue30d,
            projected_spend_30d: projectedSpend30d,
            projected_roas_30d: projectedRoas30d,
            alert_type: "trend_reversal",
            projected_revenue_60d: projectedRevenue60d,
            projected_revenue_90d: projectedRevenue90d,
            historical_avg_roas: historicalAvgRoas,
            recommendation: `Trend reversal: was declining, now recovering (CTR ${ctrToday.toFixed(2)}%). 30d: AED ${projectedRevenue30d.toLocaleString()}, 90d: AED ${projectedRevenue90d.toLocaleString()}${histContext}. Monitor 2 more days before scaling.`,
          });
        }
      }
    }

    // 4. Insert alerts
    if (alerts.length > 0) {
      const { error: insertErr } = await supabase
        .from("marketing_fatigue_alerts")
        .insert(alerts);

      if (insertErr) {
        console.error("[predictor] Failed to insert alerts:", insertErr);
      }
    }

    const typeCounts = {
      fatigue: alerts.filter((a) => a.alert_type === "fatigue").length,
      opportunity: alerts.filter((a) => a.alert_type === "opportunity").length,
      trend_reversal: alerts.filter((a) => a.alert_type === "trend_reversal")
        .length,
    };

    structuredLog("marketing-predictor", "info", "Predictor run complete", {
      total_alerts: alerts.length,
      ...typeCounts,
    });

    return apiSuccess({
      success: true,
      alerts_generated: alerts.length,
      breakdown: typeCounts,
      alerts,
    });
  } catch (error: unknown) {
    return handleError(error, "marketing-predictor", {
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
    functionName: "marketing-predictor",
    runType: "chain",
    tags: ["marketing", "agent", "predictor"],
  }),
);
