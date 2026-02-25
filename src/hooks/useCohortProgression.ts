import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FunnelStage {
  name: string;
  count: number;
  conversionToNext: number;
  dropOff: number;
}

export interface CohortProgressionData {
  stages: FunnelStage[];
  bottleneckStage: string | null;
  overallConversion: number;
  monthlyTrend: {
    metric_date: string;
    leads_created: number | null;
    assessments_booked: number | null;
    assessments_held: number | null;
    closed_won: number | null;
    closed_lost: number | null;
    overall_lead_to_customer_pct: number | null;
  }[];
  stageDistribution: Record<string, number>;
  date: string;
}

/**
 * Hook to fetch cohort progression / funnel waterfall data.
 * Queries funnel_metrics for the latest snapshot + 6-month trend,
 * and deals for stage distribution.
 */
export function useCohortProgression() {
  return useQuery({
    queryKey: ["cohort-progression"],
    queryFn: async (): Promise<CohortProgressionData | null> => {
      // Get latest funnel snapshot
      const { data: funnel, error: fErr } = await supabase
        .from("funnel_metrics")
        .select("*")
        .eq("dimension_type", "overall")
        .order("metric_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fErr) throw fErr;

      // Get last 6 months of funnel data for trend
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const { data: trend } = await supabase
        .from("funnel_metrics")
        .select(
          "metric_date, leads_created, assessments_booked, assessments_held, closed_won, closed_lost, overall_lead_to_customer_pct"
        )
        .eq("dimension_type", "overall")
        .gte("metric_date", sixMonthsAgo.toISOString().split("T")[0])
        .order("metric_date", { ascending: true });

      // Get deal stage distribution
      const { data: stages } = await supabase
        .from("deals")
        .select("stage")
        .not("stage", "is", null);

      if (!funnel) return null;

      const stageDistribution = (stages || []).reduce<Record<string, number>>(
        (acc, d) => {
          acc[d.stage!] = (acc[d.stage!] || 0) + 1;
          return acc;
        },
        {}
      );

      // Build waterfall stages
      const funnelStages: FunnelStage[] = [
        {
          name: "Leads",
          count: funnel.leads_created || 0,
          conversionToNext: funnel.lead_to_booked_pct || 0,
          dropOff: 100 - (funnel.lead_to_booked_pct || 0),
        },
        {
          name: "Booked",
          count: funnel.assessments_booked || 0,
          conversionToNext: funnel.booked_to_held_pct || 0,
          dropOff: 100 - (funnel.booked_to_held_pct || 0),
        },
        {
          name: "Held",
          count: funnel.assessments_held || 0,
          conversionToNext: funnel.held_to_deal_pct || 0,
          dropOff: 100 - (funnel.held_to_deal_pct || 0),
        },
        {
          name: "Deal",
          count: (funnel.closed_won || 0) + (funnel.closed_lost || 0),
          conversionToNext:
            funnel.deal_to_payment_pct || funnel.payment_to_won_pct || 0,
          dropOff:
            100 -
            (funnel.deal_to_payment_pct || funnel.payment_to_won_pct || 0),
        },
        {
          name: "Won",
          count: funnel.closed_won || 0,
          conversionToNext: 100,
          dropOff: 0,
        },
      ];

      // Find bottleneck (lowest conversion rate, excluding Won)
      const activeFunnel = funnelStages.slice(0, -1);
      const bottleneckIdx = activeFunnel.reduce(
        (minIdx, stage, idx, arr) =>
          stage.conversionToNext < arr[minIdx].conversionToNext ? idx : minIdx,
        0
      );

      return {
        stages: funnelStages,
        bottleneckStage: activeFunnel[bottleneckIdx]?.name || null,
        overallConversion: funnel.overall_lead_to_customer_pct || 0,
        monthlyTrend: trend || [],
        stageDistribution,
        date: funnel.metric_date,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - daily aggregated data
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}
