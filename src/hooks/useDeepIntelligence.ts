import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HistoricalBaseline {
  dimension_type: string;
  dimension_value: string;
  period_days: number;
  avg_roas: number;
  avg_cpl: number;
  avg_ghost_rate: number;
  avg_close_rate: number;
  total_spend: number;
  total_leads: number;
  total_revenue: number;
  trend_direction: string;
  trend_pct: number;
  best_week_start: string;
  best_week_roas: number;
  worst_week_start: string;
  worst_week_roas: number;
}

export interface FunnelMetric {
  metric_date: string;
  dimension_type: string;
  leads_created: number;
  assessments_booked: number;
  assessments_held: number;
  deals_created: number;
  packages_selected: number;
  payments_pending: number;
  closed_won: number;
  closed_lost: number;
  lead_to_booked_pct: number;
  booked_to_held_pct: number;
  held_to_deal_pct: number;
  deal_to_payment_pct: number;
  payment_to_won_pct: number;
  overall_lead_to_customer_pct: number;
  marketing_health: string;
  sales_health: string;
  coach_health: string;
  ops_health: string;
}

export interface LossAnalysisRow {
  primary_loss_reason: string;
  count: number;
  avg_confidence: number;
}

export interface SourceDiscrepancy {
  report_date: string;
  campaign_name: string;
  fb_reported_leads: number;
  anytrack_leads: number;
  supabase_contacts: number;
  max_discrepancy_pct: number;
  trust_verdict: string;
}

export interface AssessmentTruth {
  email: string;
  first_name: string;
  last_name: string;
  coach: string;
  hubspot_stage_name: string;
  hubspot_says_completed: boolean;
  aws_confirms_attended: boolean;
  truth_status: string;
  attribution_source: string;
  health_score: number;
  health_zone: string;
}

export interface CeoBrief {
  brief_date: string;
  yesterday_spend: number;
  yesterday_leads: number;
  yesterday_cpl: number;
  yesterday_assessments: number;
  yesterday_true_cpa: number;
  rolling_7d_spend: number;
  rolling_7d_revenue: number;
  rolling_7d_roas: number;
  rolling_7d_ghost_rate: number;
  actions_required: Record<string, unknown>[];
  budget_proposals: Record<string, unknown>[];
  fatigue_alerts: Record<string, unknown>[];
  new_copy_pending: number;
  historical_context: Record<string, unknown>;
  funnel_health: Record<string, unknown> | null;
  loss_analysis: Record<string, unknown>;
  source_alignment: Record<string, unknown>;
  projections: {
    revenue_30d: number;
    revenue_60d: number;
    revenue_90d: number;
    spend_30d: number;
    roas_30d: number;
  };
}

export function useDeepIntelligence() {
  return useQuery({
    queryKey: ["deep-intelligence"],
    queryFn: async () => {
      const [
        baselinesRes,
        funnelRes,
        lossRes,
        sourceRes,
        projectionsRes,
        truthRes,
        briefRes,
      ] = await Promise.all([
        // 1. Historical baselines (overall, 90d)
        supabase
          .from("historical_baselines" as any)
          .select("*")
          .eq("dimension_type", "overall")
          .order("period_days", { ascending: true }),

        // 2. Latest funnel metrics (overall)
        supabase
          .from("funnel_metrics" as any)
          .select("*")
          .eq("dimension_type", "overall")
          .order("metric_date", { ascending: false })
          .limit(1),

        // 3. Loss analysis — aggregate by reason
        supabase
          .from("loss_analysis" as any)
          .select("primary_loss_reason, confidence_pct")
          .order("analyzed_at", { ascending: false })
          .limit(200),

        // 4. Source discrepancy — last 7 days
        supabase
          .from("source_discrepancy_matrix" as any)
          .select("*")
          .order("report_date", { ascending: false })
          .limit(30),

        // 5. Projections from marketing-predictor
        supabase.functions.invoke("marketing-predictor", {
          body: {},
          method: "POST",
        }),

        // 6. Assessment truth matrix — HubSpot vs AWS
        supabase
          .from("assessment_truth_matrix" as any)
          .select("*")
          .order("stage_updated_at", { ascending: false })
          .limit(50),

        // 7. Latest CEO morning brief
        supabase
          .from("daily_marketing_briefs" as any)
          .select("*")
          .order("brief_date", { ascending: false })
          .limit(1),
      ]);

      // Aggregate loss reasons client-side
      const lossData = (lossRes.data || []) as any[];
      const lossMap = new Map<
        string,
        { count: number; totalConfidence: number }
      >();
      lossData.forEach((row: any) => {
        const reason = row.primary_loss_reason || "unknown";
        const existing = lossMap.get(reason) || {
          count: 0,
          totalConfidence: 0,
        };
        lossMap.set(reason, {
          count: existing.count + 1,
          totalConfidence:
            existing.totalConfidence + (row.confidence_pct || 50),
        });
      });
      const lossReasons: LossAnalysisRow[] = Array.from(lossMap.entries())
        .map(([reason, data]) => ({
          primary_loss_reason: reason,
          count: data.count,
          avg_confidence: Math.round(data.totalConfidence / data.count),
        }))
        .sort((a, b) => b.count - a.count);

      // Aggregate source discrepancies
      const sourceData = (sourceRes.data || []) as any[];
      const verdictCounts = { ALIGNED: 0, DRIFTING: 0, BROKEN: 0, NO_DATA: 0 };
      let totalGap = 0;
      sourceData.forEach((row: any) => {
        const verdict = row.trust_verdict || "NO_DATA";
        if (verdict in verdictCounts)
          verdictCounts[verdict as keyof typeof verdictCounts]++;
        totalGap += Number(row.max_discrepancy_pct) || 0;
      });
      const avgGap = sourceData.length
        ? Math.round(totalGap / sourceData.length)
        : 0;
      const overallVerdict =
        verdictCounts.BROKEN > 0
          ? "BROKEN"
          : verdictCounts.DRIFTING > verdictCounts.ALIGNED
            ? "DRIFTING"
            : "ALIGNED";

      // Warnings for alert bar
      const alerts: {
        level: "critical" | "warning" | "info";
        message: string;
      }[] = [];
      const funnel = (funnelRes.data?.[0] as any) || null;
      if (funnel) {
        if (funnel.coach_health === "critical")
          alerts.push({
            level: "critical",
            message: "Coach conversion rate is critically low",
          });
        if (funnel.sales_health === "critical")
          alerts.push({
            level: "critical",
            message: "Assessment show rate is critically low (ghost rate high)",
          });
        if (funnel.marketing_health === "warning")
          alerts.push({
            level: "warning",
            message: "Lead-to-booked rate below target",
          });
      }
      if (overallVerdict === "BROKEN")
        alerts.push({
          level: "critical",
          message: "Source data alignment is BROKEN — FB vs DB mismatch >25%",
        });

      // Aggregate assessment truth statuses
      const truthData = (truthRes.data || []) as any[];
      const truthCounts = {
        CONFIRMED_ATTENDED: 0,
        HUBSPOT_ONLY_NO_AWS_PROOF: 0,
        BOOKED_NOT_ATTENDED: 0,
        ATTENDED_BUT_HUBSPOT_NOT_UPDATED: 0,
        UNKNOWN: 0,
        PAST_ASSESSMENT_STAGE: 0,
      };
      truthData.forEach((row: any) => {
        const status = row.truth_status || "UNKNOWN";
        if (status in truthCounts)
          truthCounts[status as keyof typeof truthCounts]++;
      });
      const totalTruth = Object.values(truthCounts).reduce((s, v) => s + v, 0);
      const truthAccuracy =
        totalTruth > 0
          ? Math.round(
              ((truthCounts.CONFIRMED_ATTENDED +
                truthCounts.PAST_ASSESSMENT_STAGE) /
                totalTruth) *
                100,
            )
          : 0;

      // Get latest CEO brief
      const latestBrief = (briefRes.data?.[0] as any) || null;

      return {
        baselines: (baselinesRes.data || []) as unknown as HistoricalBaseline[],
        funnel: funnel as FunnelMetric | null,
        lossReasons,
        sourceAlignment: {
          verdictCounts,
          avgGap,
          overallVerdict,
          details: sourceData.slice(0, 7) as SourceDiscrepancy[],
        },
        projections: projectionsRes.data || null,
        assessmentTruth: {
          counts: truthCounts,
          total: totalTruth,
          accuracy: truthAccuracy,
          recent: truthData.slice(0, 10) as AssessmentTruth[],
        },
        ceoBrief: latestBrief as CeoBrief | null,
        alerts,
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
