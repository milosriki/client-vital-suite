import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_1MIN = 60_000;

// ── View Hooks ──

export function useDealStripeRevenue() {
  return useQuery({
    queryKey: ["deal-stripe-revenue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_stripe_revenue" as never)
        .select("*");
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    staleTime: STALE_1MIN,
  });
}

export function useCallAttribution() {
  return useQuery({
    queryKey: ["call-attribution"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_attribution" as never)
        .select("*");
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    staleTime: STALE_1MIN,
  });
}

export function useFullAttribution() {
  return useQuery({
    queryKey: ["full-attribution"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_full_attribution" as never)
        .select("*");
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    staleTime: STALE_1MIN,
  });
}

export function useCustomerJourney(email: string) {
  return useQuery({
    queryKey: ["customer-journey", email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_journey_view" as never)
        .select("*")
        .eq("email", email);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    enabled: !!email,
    staleTime: STALE_1MIN,
  });
}

export function useContact360(email: string) {
  return useQuery({
    queryKey: ["contact-360", email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_contact_360" as never)
        .select("*")
        .eq("email", email);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    enabled: !!email,
    staleTime: STALE_1MIN,
  });
}

export function useCreativePerformance() {
  return useQuery({
    queryKey: ["creative-performance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creative_performance" as never)
        .select("*");
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    staleTime: STALE_1MIN,
  });
}

export function useAgentCostSummary() {
  return useQuery({
    queryKey: ["agent-cost-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_agent_cost_summary" as never)
        .select("*");
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    staleTime: STALE_1MIN,
  });
}

export function useDailyMarketingBrief() {
  return useQuery({
    queryKey: ["daily-marketing-brief"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_daily_marketing_brief" as never)
        .select("*")
        .limit(1);
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[])[0] ?? null;
    },
    staleTime: STALE_1MIN,
  });
}

// ── Table Hooks ──

export function useMarketingRecommendations() {
  return useQuery({
    queryKey: ["marketing-recommendations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_recommendations" as never)
        .select("*")
        .eq("status", "active")
        .order("confidence", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    staleTime: STALE_1MIN,
  });
}

export function useCreativeLibrary() {
  return useQuery({
    queryKey: ["creative-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creative_library" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    staleTime: STALE_1MIN,
  });
}

export function useMarketingSignals() {
  return useQuery({
    queryKey: ["marketing-signals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_agent_signals" as never)
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    staleTime: STALE_1MIN,
  });
}

export function useTokenUsageMetrics() {
  return useQuery({
    queryKey: ["token-usage-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("token_usage_metrics" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    staleTime: STALE_1MIN,
  });
}
