import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TruthTriangleData {
  month: string;
  meta_ad_spend: number;
  hubspot_deal_value: number;
  stripe_gross_revenue: number;
  meta_reported_revenue: number;
  hubspot_deal_count: number;
  gap_stripe_hubspot: number;
  true_roas_cash: number;
  pipeline_roas_booked: number;
}

/**
 * Hook to fetch the latest Truth Triangle data from view_truth_triangle
 * This view aggregates monthly data from Meta Ads, HubSpot, and Stripe
 * to provide a reconciled view of revenue across all three sources.
 */
export function useTruthTriangle() {
  return useQuery({
    queryKey: ["truth-triangle"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_truth_triangle")
        .select("*")
        .order("month", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return {
        month: data.month || "",
        meta_ad_spend: data.meta_ad_spend || 0,
        hubspot_deal_value: data.hubspot_deal_value || 0,
        stripe_gross_revenue: data.stripe_gross_revenue || 0,
        meta_reported_revenue: data.meta_reported_revenue || 0,
        hubspot_deal_count: data.hubspot_deal_count || 0,
        gap_stripe_hubspot: data.gap_stripe_hubspot || 0,
        true_roas_cash: data.true_roas_cash || 0,
        pipeline_roas_booked: data.pipeline_roas_booked || 0,
      } as TruthTriangleData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - this is monthly aggregated data
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });
}
