import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { supabase } from "@/integrations/supabase/client";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export const useStripeMetrics = (
  dateRange: DateRange,
  statusFilter: string,
) => {
  // Fetch Stripe dashboard data with date range
  const {
    data: stripeData,
    isLoading,
    refetch,
    isRefetching,
  } = useDedupedQuery({
    queryKey: [
      "stripe-dashboard-data",
      dateRange.from?.toISOString(),
      dateRange.to?.toISOString(),
      statusFilter,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "stripe-dashboard-data",
        {
          body: {
            startDate: dateRange.from?.toISOString(),
            endDate: dateRange.to?.toISOString(),
            status: statusFilter !== "all" ? statusFilter : undefined,
            limit: 100,
          },
        },
      );
      if (error) throw error;
      return data;
    },
    staleTime: 60000,
  });

  // Fetch forensic data
  const { data: forensicData, isLoading: forensicLoading } = useDedupedQuery({
    queryKey: ["stripe-forensics"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "stripe-forensics",
        {
          body: { action: "complete-intelligence", days: 30 },
        },
      );
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
    enabled: false, // Disable auto-fetch
  });

  return {
    stripeData,
    isLoading,
    refetch,
    isRefetching,
    forensicData,
    forensicLoading,
  };
};
