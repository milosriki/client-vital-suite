import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useAdvancedBI = () => {
  return useQuery({
    queryKey: ["advanced-bi"],
    queryFn: async () => {
      console.log("🧠 Fetching Advanced Business Intelligence...");

      // Parallel Fetching for Speed
      const [financials, customers, strategy] = await Promise.all([
        supabase.functions.invoke("financial-analytics", {
          body: { thinkingLevel: "high" },
        }),
        supabase.functions.invoke("customer-insights", {
          body: { thinkingLevel: "high" },
        }),
        supabase.functions.invoke("strategic-kpi", {
          body: { thinkingLevel: "high" },
        }),
      ]);

      if (financials.error)
        console.error("BI Error (Financials):", financials.error);
      if (customers.error)
        console.error("BI Error (Customers):", customers.error);
      if (strategy.error) console.error("BI Error (Strategy):", strategy.error);

      return {
        financials: financials.data || null,
        customers: customers.data || null,
        strategy: strategy.data || null,
        lastUpdated: new Date().toISOString(),
      };
    },
    refetchInterval: 1000 * 60 * 60, // Refresh every hour
    staleTime: 1000 * 60 * 30, // Fresh for 30 mins
  });
};
