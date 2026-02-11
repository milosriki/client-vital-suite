import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTimeMachine } from "@/contexts/TimeMachineContext";

export interface PeriodDelta {
  current: number;
  prior: number;
  delta: number; // percentage change
  trend: "up" | "down" | "neutral";
  label: string; // formatted string like "+12.5%" or "−3.2%"
}

interface DailyMetricsRow {
  date: string;
  roas_daily: number | null;
  ad_spend_facebook: number | null;
  total_leads_new: number | null;
  total_revenue_booked: number | null;
}

function computeDelta(current: number, prior: number): PeriodDelta {
  if (prior === 0 && current === 0) {
    return { current, prior, delta: 0, trend: "neutral", label: "No change" };
  }
  if (prior === 0) {
    return { current, prior, delta: 100, trend: "up", label: "New" };
  }
  const delta = ((current - prior) / prior) * 100;
  const trend: PeriodDelta["trend"] =
    delta > 0.5 ? "up" : delta < -0.5 ? "down" : "neutral";
  const sign = delta > 0 ? "+" : "";
  const label =
    Math.abs(delta) >= 1
      ? `${sign}${delta.toFixed(1)}%`
      : Math.abs(current - prior) >= 1
        ? `${sign}${Math.round(current - prior)}`
        : "No change";
  return { current, prior, delta, trend, label };
}

/**
 * Computes real period-over-period deltas for Executive Dashboard metrics.
 * Current period = dateRange.from → dateRange.to
 * Prior period = same duration shifted backwards.
 */
export function usePeriodComparison() {
  const { dateRange } = useTimeMachine();

  return useQuery({
    queryKey: [
      "period-comparison",
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
    ],
    queryFn: async () => {
      const currentFrom = dateRange.from;
      const currentTo = dateRange.to;
      const durationMs = currentTo.getTime() - currentFrom.getTime();
      const priorFrom = new Date(currentFrom.getTime() - durationMs);
      const priorTo = new Date(currentFrom.getTime() - 1); // 1ms before current starts

      const currentFromISO = currentFrom.toISOString();
      const currentToISO = currentTo.toISOString();
      const priorFromISO = priorFrom.toISOString();
      const priorToISO = priorTo.toISOString();

      // ── Parallel queries for current + prior period ──
      const [
        currentLeads,
        priorLeads,
        currentMembers,
        priorMembers,
        currentStripe,
        priorStripe,
        recentMetrics,
        priorMetrics,
      ] = await Promise.all([
        // 1. Leads (current)
        supabase
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .eq("lifecycle_stage", "lead")
          .gte("created_at", currentFromISO)
          .lte("created_at", currentToISO),

        // 2. Leads (prior)
        supabase
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .eq("lifecycle_stage", "lead")
          .gte("created_at", priorFromISO)
          .lte("created_at", priorToISO),

        // 3. Active members (current) — contacts with any active status
        supabase
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .in("lifecycle_stage", ["customer", "subscriber", "opportunity"])
          .gte("created_at", currentFromISO),

        // 4. Active members (prior)
        supabase
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .in("lifecycle_stage", ["customer", "subscriber", "opportunity"])
          .gte("created_at", priorFromISO)
          .lte("created_at", priorToISO),

        // 5. Stripe revenue (current period)
        supabase.functions.invoke("stripe-dashboard-data", {
          body: {
            startDate: currentFromISO,
            endDate: currentToISO,
          },
        }),

        // 6. Stripe revenue (prior period)
        supabase.functions.invoke("stripe-dashboard-data", {
          body: {
            startDate: priorFromISO,
            endDate: priorToISO,
          },
        }),

        // 7. Daily business metrics (recent 7d for ROAS trend)
        supabase
          .from("daily_business_metrics" as any)
          .select(
            "date, roas_daily, ad_spend_facebook, total_leads_new, total_revenue_booked",
          )
          .gte(
            "date",
            new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0],
          )
          .order("date", { ascending: false }),

        // 8. Daily business metrics (prior 7d for ROAS comparison)
        supabase
          .from("daily_business_metrics" as any)
          .select(
            "date, roas_daily, ad_spend_facebook, total_leads_new, total_revenue_booked",
          )
          .gte(
            "date",
            new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0],
          )
          .lt(
            "date",
            new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0],
          )
          .order("date", { ascending: false }),
      ]);

      // ── Compute deltas ──

      // Revenue
      const currentRev = currentStripe.data?.metrics?.netRevenue || 0;
      const priorRev = priorStripe.data?.metrics?.netRevenue || 0;
      const revenue = computeDelta(currentRev / 100, priorRev / 100); // cents → AED

      // Leads
      const leads = computeDelta(
        currentLeads.count || 0,
        priorLeads.count || 0,
      );

      // Members
      const currentMemberCount =
        currentStripe.data?.metrics?.activeSubscriptions || 0;
      const priorMemberCount =
        priorStripe.data?.metrics?.activeSubscriptions || 0;
      // For members, active subscriptions is a snapshot, so compare current to prior period's count
      const members = computeDelta(
        currentMemberCount || currentMembers.count || 0,
        priorMemberCount || priorMembers.count || 0,
      );

      // ROAS (7d rolling comparison)
      const recent7d = (recentMetrics.data ||
        []) as unknown as DailyMetricsRow[];
      const prior7d = (priorMetrics.data || []) as unknown as DailyMetricsRow[];
      const avgRecentRoas = recent7d.length
        ? recent7d.reduce(
            (s: number, r) => s + (Number(r.roas_daily) || 0),
            0,
          ) / recent7d.length
        : 0;
      const avgPriorRoas = prior7d.length
        ? prior7d.reduce((s: number, r) => s + (Number(r.roas_daily) || 0), 0) /
          prior7d.length
        : 0;
      const roas = computeDelta(avgRecentRoas, avgPriorRoas);

      // Ad Spend (7d comparison)
      const recentSpend = recent7d.reduce(
        (s: number, r) => s + (Number(r.ad_spend_facebook) || 0),
        0,
      );
      const priorSpend = prior7d.reduce(
        (s: number, r) => s + (Number(r.ad_spend_facebook) || 0),
        0,
      );
      const adSpend = computeDelta(recentSpend, priorSpend);

      return { revenue, leads, members, roas, adSpend };
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
    retry: 1,
  });
}
