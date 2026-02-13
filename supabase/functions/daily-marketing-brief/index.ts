import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";

/**
 * Daily Marketing Brief 📊
 *
 * The CEO's morning intelligence report.
 * Aggregates all agent outputs + deep intelligence into a single briefing.
 * Runs: Daily at 08:30 UAE (after all agents complete)
 *
 * Reads: All agent output tables + revenue_genome_7d + daily_business_metrics
 *         + historical_baselines + funnel_metrics + loss_analysis + source_discrepancy_matrix
 * Writes: daily_marketing_briefs
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

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0];

    // 1. Yesterday's numbers (from daily_business_metrics)
    const { data: yesterdayMetrics } = await supabase
      .from("daily_business_metrics")
      .select("total_assessments_completed, total_leads_new, total_deals_closed, total_revenue_booked, ad_spend_facebook, roas_daily, cost_per_lead")
      .eq("metric_date", yesterday)
      .single();

    // Yesterday's ad spend (from facebook_ads_insights)
    const { data: yesterdayAds } = await supabase
      .from("facebook_ads_insights")
      .select("spend, clicks, impressions")
      .eq("date", yesterday);

    const yesterdaySpend = (yesterdayAds || []).reduce(
      (sum: number, r: Record<string, unknown>) => sum + (Number(r.spend) || 0),
      0,
    );

    // Yesterday's leads (from events)
    const { data: yesterdayLeads } = await supabase
      .from("events")
      .select("event_id")
      .in("event_name", ["Lead", "lead_created"])
      .gte("event_time", `${yesterday}T00:00:00`)
      .lt("event_time", `${today}T00:00:00`);

    const yesterdayLeadCount = (yesterdayLeads || []).length;
    const yesterdayCpl =
      yesterdayLeadCount > 0 ? yesterdaySpend / yesterdayLeadCount : 0;

    // Yesterday's assessments
    const yesterdayAssessments =
      yesterdayMetrics?.total_assessments_completed || 0;
    const yesterdayTrueCpa =
      yesterdayAssessments > 0 ? yesterdaySpend / yesterdayAssessments : 0;

    // 2. 7-Day rolling (from revenue genome)
    const { data: genome } = await supabase
      .from("revenue_genome_7d")
      .select("*");

    const rolling7d = {
      spend: (genome || []).reduce(
        (sum: number, r: Record<string, unknown>) =>
          sum + (Number(r.spend_7d) || 0),
        0,
      ),
      revenue: (genome || []).reduce(
        (sum: number, r: Record<string, unknown>) =>
          sum + (Number(r.revenue_7d) || 0),
        0,
      ),
      roas: 0 as number,
      avgHealth:
        (genome || []).length > 0
          ? (genome || []).reduce(
              (sum: number, r: Record<string, unknown>) =>
                sum + (Number(r.avg_health_7d) || 0),
              0,
            ) / (genome || []).length
          : 0,
      ghostRate:
        (genome || []).length > 0
          ? (genome || []).reduce(
              (sum: number, r: Record<string, unknown>) =>
                sum + (Number(r.ghost_rate_pct) || 0),
              0,
            ) / (genome || []).length
          : 0,
    };
    rolling7d.roas =
      rolling7d.spend > 0
        ? Math.round((rolling7d.revenue / rolling7d.spend) * 100) / 100
        : 0;

    // 3. Actions required (from Analyst — pending recommendations)
    const { data: actions } = await supabase
      .from("marketing_recommendations")
      .select("id, ad_id, ad_name, action, confidence, reasoning, metrics, status, created_at")
      .gte("created_at", `${today}T00:00:00`)
      .in("action", ["SCALE", "KILL", "REFRESH"])
      .eq("status", "pending")
      .order("confidence", { ascending: false })
      .limit(5);

    // 4. Budget proposals (from Allocator)
    const { data: budgetProposals } = await supabase
      .from("marketing_budget_proposals")
      .select("id, ad_id, ad_name, current_daily_budget, proposed_daily_budget, change_pct, action, status, created_at")
      .gte("created_at", `${today}T00:00:00`)
      .eq("status", "pending_approval")
      .limit(10);

    // 5. Fatigue alerts (from Predictor)
    const { data: fatigueAlerts } = await supabase
      .from("marketing_fatigue_alerts")
      .select("id, ad_id, ad_name, ctr_today, ctr_3d_avg, ctr_delta_pct, projected_roas_30d, alert_type, recommendation, created_at")
      .gte("created_at", `${today}T00:00:00`)
      .limit(5);

    // 6. New copy pending (from Copywriter)
    const { data: pendingCopy, count: copyCount } = await supabase
      .from("creative_library")
      .select("id", { count: "exact" })
      .eq("status", "pending_approval");

    // 7. Historical context (from Historian baselines)
    const { data: baselines } = await supabase
      .from("historical_baselines")
      .select(
        "period_days, avg_roas, avg_cpl, avg_cpa, avg_ghost_rate, avg_close_rate, trend_direction, trend_pct, best_week_start, best_week_roas",
      )
      .eq("dimension_type", "overall")
      .eq("dimension_value", "all");

    const b30 = (baselines || []).find(
      (b: Record<string, unknown>) => b.period_days === 30,
    );
    const b90 = (baselines || []).find(
      (b: Record<string, unknown>) => b.period_days === 90,
    );

    const historicalContext = {
      avg_roas_90d: Number(b90?.avg_roas || 0),
      avg_cpl_90d: Number(b90?.avg_cpl || 0),
      avg_ghost_rate_90d: Number(b90?.avg_ghost_rate || 0),
      trend_30d: String(b30?.trend_direction || "unknown"),
      trend_pct_30d: Number(b30?.trend_pct || 0),
      best_week: b90?.best_week_start
        ? { date: b90.best_week_start, roas: b90.best_week_roas }
        : null,
      roas_vs_avg:
        rolling7d.roas > 0 && Number(b90?.avg_roas) > 0
          ? `${Math.round(((rolling7d.roas - Number(b90.avg_roas)) / Number(b90.avg_roas)) * 100)}%`
          : "N/A",
    };

    // 8. Funnel health (from Funnel Stage Tracker)
    const { data: funnelData } = await supabase
      .from("funnel_metrics")
      .select("lead_to_booked_pct, booked_to_held_pct, held_to_deal_pct, deal_to_payment_pct, overall_lead_to_customer_pct, marketing_health, sales_health, coach_health, ops_health")
      .eq("dimension_type", "overall")
      .eq("dimension_value", "all")
      .order("metric_date", { ascending: false })
      .limit(1)
      .single();

    const funnelHealth = funnelData
      ? {
          lead_to_booked: `${funnelData.lead_to_booked_pct}%`,
          booked_to_held: `${funnelData.booked_to_held_pct}%`,
          held_to_deal: `${funnelData.held_to_deal_pct}%`,
          deal_to_payment: `${funnelData.deal_to_payment_pct}%`,
          overall: `${funnelData.overall_lead_to_customer_pct}%`,
          marketing_health: funnelData.marketing_health,
          sales_health: funnelData.sales_health,
          coach_health: funnelData.coach_health,
          ops_health: funnelData.ops_health,
        }
      : null;

    // 9. Loss analysis (from Loss Analyst — recent losses)
    const { data: recentLosses } = await supabase
      .from("loss_analysis")
      .select(
        "contact_email, primary_loss_reason, reasoning, confidence_pct, coach_name, response_time_minutes",
      )
      .order("analyzed_at", { ascending: false })
      .limit(5);

    const lossReasonCounts: Record<string, number> = {};
    for (const l of (recentLosses || []) as Array<Record<string, unknown>>) {
      const reason = String(l.primary_loss_reason);
      lossReasonCounts[reason] = (lossReasonCounts[reason] || 0) + 1;
    }

    // 10. Source alignment (from discrepancy matrix)
    const { data: discrepancies } = await supabase
      .from("source_discrepancy_matrix")
      .select("*")
      .order("report_date", { ascending: false })
      .limit(7);

    const brokenSources = (discrepancies || []).filter(
      (d: Record<string, unknown>) => d.trust_verdict === "BROKEN",
    );
    const driftingSources = (discrepancies || []).filter(
      (d: Record<string, unknown>) => d.trust_verdict === "DRIFTING",
    );

    const sourceAlignment = {
      days_checked: (discrepancies || []).length,
      broken_count: brokenSources.length,
      drifting_count: driftingSources.length,
      overall_verdict:
        brokenSources.length > 0
          ? "BROKEN"
          : driftingSources.length > 2
            ? "DRIFTING"
            : "ALIGNED",
    };

    // 11. Projections (weighted with historical baselines)
    const dailyRevenue = rolling7d.revenue / 7;
    const histDailyRevenue = b30
      ? Number(b30.avg_roas || 0) * (rolling7d.spend / 7)
      : dailyRevenue;
    const blended = b90
      ? dailyRevenue * 0.6 + histDailyRevenue * 0.4
      : dailyRevenue;

    const projectedRevenue30d = Math.round(blended * 30);
    const projectedRevenue60d = Math.round(blended * 60);
    const projectedRevenue90d = Math.round(blended * 90);
    const projectedSpend30d = Math.round((rolling7d.spend / 7) * 30);

    // 12. Assemble and save brief
    const projectedRoas30d =
      projectedSpend30d > 0
        ? Math.round((projectedRevenue30d / projectedSpend30d) * 100) / 100
        : 0;

    const brief = {
      brief_date: today,
      // Yesterday
      yesterday_spend: Math.round(yesterdaySpend),
      yesterday_leads: yesterdayLeadCount,
      yesterday_cpl: Math.round(yesterdayCpl),
      yesterday_assessments: yesterdayAssessments,
      yesterday_true_cpa: Math.round(yesterdayTrueCpa),
      // 7-day rolling
      rolling_7d_spend: Math.round(rolling7d.spend),
      rolling_7d_revenue: Math.round(rolling7d.revenue),
      rolling_7d_roas: rolling7d.roas,
      rolling_7d_avg_health: Math.round(rolling7d.avgHealth),
      rolling_7d_ghost_rate: Math.round(rolling7d.ghostRate * 10) / 10,
      // Agent outputs
      actions_required: actions || [],
      budget_proposals: budgetProposals || [],
      fatigue_alerts: fatigueAlerts || [],
      new_copy_pending: copyCount || 0,
      // Deep intelligence
      historical_context: historicalContext,
      funnel_health: funnelHealth,
      loss_analysis: {
        recent_losses: (recentLosses || []).map(
          (l: Record<string, unknown>) => ({
            email: l.contact_email,
            reason: l.primary_loss_reason,
            reasoning: l.reasoning,
            confidence: l.confidence_pct,
            coach: l.coach_name,
          }),
        ),
        reason_counts: lossReasonCounts,
      },
      source_alignment: sourceAlignment,
      // Projections (weighted)
      projections: {
        revenue_30d: projectedRevenue30d,
        revenue_60d: projectedRevenue60d,
        revenue_90d: projectedRevenue90d,
        spend_30d: projectedSpend30d,
        roas_30d: projectedRoas30d,
      },
    };

    // Upsert (in case it's run multiple times today)
    const { error: upsertErr } = await supabase
      .from("daily_marketing_briefs")
      .upsert(brief, { onConflict: "brief_date" });

    if (upsertErr) {
      console.error("[daily-brief] Failed to save brief:", upsertErr);
    }

    structuredLog("daily-marketing-brief", "info", "Daily brief generated", {
      brief_date: today,
      actions_count: (actions || []).length,
      proposals_count: (budgetProposals || []).length,
      fatigue_count: (fatigueAlerts || []).length,
      copy_pending: copyCount || 0,
    });

    return apiSuccess({
      success: true,
      brief,
    });
  } catch (error: unknown) {
    return handleError(error, "daily-marketing-brief", {
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
    functionName: "daily-marketing-brief",
    runType: "chain",
    tags: ["marketing", "agent", "brief", "ceo"],
  }),
);
