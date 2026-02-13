import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const useWarRoomData = () => {
  const [manualAdSpend, setAdSpend] = useState<number | null>(null);
  const [autoPilotEnabled, setAutoPilotEnabled] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [isSendingBreakup, setIsSendingBreakup] = useState(false);
  const queryClient = useQueryClient();

  // Fetch live ad spend
  const { data: liveAdSpendData, isLoading: spendLoading } = useDedupedQuery({
    queryKey: ["war-room-spend"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("daily_business_metrics" as any)
        .select("ad_spend_facebook, ad_spend_google")
        .gte("date", thirtyDaysAgo.toISOString().split("T")[0]);

      if (error) throw error;

      return (
        data?.reduce(
          (sum: number, row: any) =>
            sum +
            (Number(row.ad_spend_facebook) || 0) +
            (Number(row.ad_spend_google) || 0),
          0,
        ) || 0
      );
    },
  });

  const adSpend = manualAdSpend ?? (liveAdSpendData || 0);

  // Fetch deals for forecasting
  const {
    data: deals,
    isLoading: dealsLoading,
    error: dealsError,
  } = useDedupedQuery({
    queryKey: ["war-room-deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, status, deal_value, cash_collected, created_at, updated_at, close_date, stage, owner_name")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    retry: 2,
  });

  // Fetch leads for leakage detection
  const {
    data: leads,
    isLoading: leadsLoading,
    error: leadsError,
  } = useDedupedQuery({
    queryKey: ["war-room-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enhanced_leads")
        .select("id, email, first_name, last_name, created_at, conversion_status")
        .not("email", "ilike", "%@example.com")
        .not("email", "ilike", "%@test.com")
        .not("email", "ilike", "%@email.com")
        .not("email", "ilike", "%@fake.com")
        .not("email", "ilike", "test%@%")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    retry: 2,
  });

  // Fetch client health for LTV calculation
  const {
    data: clients,
    isLoading: clientsLoading,
    error: clientsError,
  } = useDedupedQuery({
    queryKey: ["war-room-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_health_scores")
        .select("*")
        .not("email", "ilike", "%@example.com")
        .not("email", "ilike", "%@test.com")
        .not("email", "ilike", "%@email.com")
        .not("email", "ilike", "%@fake.com")
        .not("email", "ilike", "%@dummy.com")
        .not("email", "ilike", "test%@%");
      if (error) throw error;
      return data || [];
    },
    retry: 2,
  });

  // Calculate Unit Economics
  const newCustomersThisMonth =
    clients?.filter((c) => {
      const created = new Date(c.created_at || "");
      const now = new Date();
      return (
        created.getMonth() === now.getMonth() &&
        created.getFullYear() === now.getFullYear()
      );
    }).length || 1;

  const totalRevenue =
    deals
      ?.filter((d) => d.status === "closed")
      .reduce((sum, d) => sum + (d.deal_value || 0), 0) || 0;
  const avgRevenuePerUser = clients?.length ? totalRevenue / clients.length : 0;

  const avgRetentionMonths = clients?.length
    ? Math.round(
        clients.reduce((sum, c) => {
          const created = new Date(c.created_at || "");
          const now = new Date();
          const months =
            (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30);
          return sum + Math.max(1, months);
        }, 0) / clients.length,
      )
    : 6;

  const cac = adSpend / Math.max(newCustomersThisMonth, 1);
  const ltv = avgRevenuePerUser * avgRetentionMonths;
  const ltvCacRatio = cac > 0 ? ltv / cac : 0;

  const monthlyBurn = adSpend * 1.5;
  const thisMonthDeals =
    deals?.filter((d) => {
      const created = new Date(d.created_at || "");
      const now = new Date();
      return (
        created.getMonth() === now.getMonth() &&
        created.getFullYear() === now.getFullYear() &&
        (d.status === "closed" || (d.status as string) === "won")
      );
    }) || [];
  const netNewArr = thisMonthDeals.reduce(
    (sum, d) => sum + (d.deal_value || 0),
    0,
  );
  const burnMultiple = netNewArr > 0 ? monthlyBurn / netNewArr : 0;

  // Calculate Leakage
  const buriedLeads =
    leads?.filter((l) => {
      const created = new Date(l.created_at || "");
      const daysSince =
        (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
      return (
        daysSince > 7 && (!l.conversion_status || l.conversion_status === "new")
      );
    }) || [];

  const stalledDeals =
    deals?.filter((d) => {
      const updated = new Date(d.updated_at || d.created_at || "");
      const daysSince =
        (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 14 && d.status !== "closed" && d.status !== "lost";
    }) || [];

  const discountedDeals =
    deals?.filter((d) => {
      const dealValue = d.deal_value || 0;
      const cashCollected = d.cash_collected || dealValue;
      return dealValue > 0 && cashCollected < dealValue * 0.9;
    }) || [];

  // Generate forecast data
  const getHistoricalRevenue = () => {
    const now = new Date();
    const closedDeals =
      deals?.filter(
        (d) => d.status === "closed" || (d.status as string) === "won",
      ) || [];

    const revenueByMonth: number[] = [];
    for (let i = 2; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthRevenue = closedDeals
        .filter((d) => {
          const closeDate = new Date(d.close_date || d.created_at || "");
          return closeDate >= monthStart && closeDate <= monthEnd;
        })
        .reduce((sum, d) => sum + (d.deal_value || 0), 0);

      revenueByMonth.push(monthRevenue);
    }

    return revenueByMonth;
  };

  const generateForecastData = () => {
    const now = new Date();
    const months: string[] = [];

    for (let i = -2; i <= 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(date.toLocaleString("default", { month: "short" }));
    }

    const actualRevenue = getHistoricalRevenue();

    const contractDeals =
      deals?.filter((d) => d.stage === "Contract Sent") || [];
    const proposalDeals = deals?.filter((d) => d.stage === "Proposal") || [];
    const activeDeals =
      deals?.filter(
        (d) =>
          d.status !== "closed" &&
          d.status !== "lost" &&
          (d.status as string) !== "won",
      ) || [];

    const commitValue = contractDeals.reduce(
      (sum, d) => sum + (d.deal_value || 0) * 0.9,
      0,
    );
    const likelyValue = proposalDeals.reduce(
      (sum, d) => sum + (d.deal_value || 0) * 0.6,
      0,
    );
    const bestCaseValue = activeDeals.reduce(
      (sum, d) => sum + (d.deal_value || 0) * 0.3,
      0,
    );

    const baselineRevenue =
      actualRevenue[2] || actualRevenue.reduce((a, b) => a + b, 0) / 3 || 50000;

    return months.map((month, i) => ({
      month,
      actual: i < 3 ? actualRevenue[i] : null,
      commit: i >= 3 ? commitValue / 3 + baselineRevenue * 0.9 : null,
      likely: i >= 3 ? likelyValue / 3 + baselineRevenue * 0.85 : null,
      bestCase: i >= 3 ? bestCaseValue / 3 + baselineRevenue * 1.1 : null,
      target: 100000,
    }));
  };

  const forecastData = generateForecastData();
  const quarterlyTarget = 300000;
  const projectedRevenue = forecastData
    .slice(3)
    .reduce((sum, d) => sum + (d.commit || 0), 0);
  const gapToTarget = quarterlyTarget - projectedRevenue;

  const isLoading =
    dealsLoading || leadsLoading || clientsLoading || spendLoading;

  return {
    adSpend,
    setAdSpend,
    autoPilotEnabled,
    setAutoPilotEnabled,
    isReassigning,
    setIsReassigning,
    isSendingBreakup,
    setIsSendingBreakup,
    queryClient,
    cac,
    ltv,
    ltvCacRatio,
    burnMultiple,
    buriedLeads,
    stalledDeals,
    discountedDeals,
    forecastData,
    gapToTarget,
    isLoading,
    dealsError,
    leadsError,
    clientsError,
  };
};
