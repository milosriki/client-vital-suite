import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DailyMetricItem {
  key: string;
  label: string;
  format: "number" | "aed" | "ratio";
  yesterday: number;
  avg7d: number;
  avg30d: number;
  delta7d: number;
  status: "good" | "warning";
}

export interface DailyOptimizationData {
  yesterday: Record<string, unknown>;
  metrics: DailyMetricItem[];
  date: string;
}

/**
 * Hook to fetch and compute daily business optimization metrics.
 * Queries last 30 days from daily_business_metrics, computes
 * yesterday vs 7d/30d averages with delta signals.
 */
export function useDailyOptimization() {
  return useQuery({
    queryKey: ["daily-optimization"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("daily_business_metrics")
        .select("*")
        .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("date", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const yesterday = data[0]; // Most recent
      const last7 = data.slice(0, 7);
      const last30 = data;

      const avg = (arr: typeof data, field: string) => {
        const vals = arr.map(
          (r) => Number((r as Record<string, unknown>)[field]) || 0,
        );
        return vals.length > 0
          ? vals.reduce((a, b) => a + b, 0) / vals.length
          : 0;
      };

      const metrics: Array<{
        key: string;
        label: string;
        format: "number" | "aed" | "ratio";
      }> = [
        { key: "total_leads_new", label: "New Leads", format: "number" },
        { key: "total_calls_made", label: "Calls Made", format: "number" },
        {
          key: "total_appointments_set",
          label: "Assessments Set",
          format: "number",
        },
        {
          key: "total_appointments_held",
          label: "Assessments Held",
          format: "number",
        },
        {
          key: "total_revenue_booked",
          label: "Revenue Booked",
          format: "aed",
        },
        {
          key: "total_cash_collected",
          label: "Cash Collected",
          format: "aed",
        },
        { key: "total_deals_closed", label: "Deals Closed", format: "number" },
        { key: "roas_daily", label: "ROAS", format: "ratio" },
        { key: "cost_per_lead", label: "CPL", format: "aed" },
      ];

      return {
        yesterday: yesterday as unknown as Record<string, unknown>,
        metrics: metrics.map((m) => {
          const yVal =
            Number((yesterday as Record<string, unknown>)[m.key]) || 0;
          const avg7 = avg(last7, m.key);
          const avg30 = avg(last30, m.key);
          const delta7 = avg7 > 0 ? ((yVal - avg7) / avg7) * 100 : 0;
          return {
            ...m,
            yesterday: yVal,
            avg7d: avg7,
            avg30d: avg30,
            delta7d: delta7,
            status:
              Math.abs(delta7) < 10
                ? ("good" as const)
                : delta7 > 0
                  ? ("good" as const)
                  : ("warning" as const),
          };
        }),
        date: yesterday.date,
      } as DailyOptimizationData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}
