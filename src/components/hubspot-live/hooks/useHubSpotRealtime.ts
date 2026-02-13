import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  subMonths,
  subDays,
} from "date-fns";

// KPI Formulas
const calculateConversionRate = (converted: number, total: number) =>
  total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";

const calculateConnectRate = (answered: number, total: number) =>
  total > 0 ? ((answered / total) * 100).toFixed(1) : "0.0";

const calculateAvgDealValue = (totalValue: number, dealCount: number) =>
  dealCount > 0 ? (totalValue / dealCount).toFixed(0) : "0";

const calculateRevenuePerLead = (revenue: number, leads: number) =>
  leads > 0 ? (revenue / leads).toFixed(0) : "0";

// Map HubSpot contact lifecycle to lead status
const mapContactToLeadStatus = (contact: any): string => {
  const lifecycle = contact.lifecycle_stage?.toLowerCase();
  const leadStatus = contact.lead_status?.toLowerCase();

  if (lifecycle === "customer" || leadStatus === "closed_won") return "closed";
  if (
    leadStatus === "appointment_scheduled" ||
    leadStatus === "appointment_set"
  )
    return "appointment_set";
  if (leadStatus === "no_show") return "no_show";
  if (lifecycle === "opportunity" || lifecycle === "salesqualifiedlead")
    return "pitch_given";
  if (leadStatus === "in_progress" || leadStatus === "contacted")
    return "follow_up";
  return "new";
};

export const useHubSpotRealtime = (timeframe: string) => {
  // Calculate date range
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end = endOfDay(now);

    switch (timeframe) {
      case "today":
        start = startOfDay(now);
        break;
      case "yesterday":
        start = startOfDay(subDays(now, 1));
        end = endOfDay(subDays(now, 1));
        break;
      case "this_month":
        start = startOfMonth(now);
        break;
      case "last_month":
        start = startOfMonth(subMonths(now, 1));
        end = endOfDay(subDays(startOfMonth(now), 1));
        break;
      case "last_7_days":
        start = startOfDay(subDays(now, 7));
        break;
      case "all_time":
      default:
        start = new Date(2020, 0, 1); // Far back in time to get all data
    }
    return { start, end };
  }, [timeframe]);

  // Fetch leads from Supabase
  const {
    data: leadsData,
    isLoading: loadingLeads,
    refetch: refetchLeads,
  } = useDedupedQuery({
    queryKey: ["db-leads", timeframe],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, lifecycle_stage, lead_status, latest_traffic_source, first_touch_source, total_value, created_at, hubspot_contact_id")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((contact) => ({
        ...contact,
        name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
        status: mapContactToLeadStatus(contact),
        source:
          contact.latest_traffic_source ||
          contact.first_touch_source ||
          "direct",
        score: contact.total_value
          ? Math.min(100, Math.round(contact.total_value / 100))
          : 50,
      }));
    },
  });

  // Fetch enhanced leads
  const {
    data: enhancedLeadsData,
    isLoading: loadingEnhanced,
    refetch: refetchEnhanced,
  } = useDedupedQuery({
    queryKey: ["db-enhanced-leads", timeframe],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enhanced_leads")
        .select("id, first_name, last_name, email, phone, created_at, lead_quality, conversion_status, source")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch deals
  const {
    data: dealsData,
    isLoading: loadingDeals,
    refetch: refetchDeals,
  } = useDedupedQuery({
    queryKey: ["db-deals", timeframe],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, deal_name, deal_value, cash_collected, status, closer_id, created_at")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch monthly deals (for revenue calculation)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthStart = useMemo(() => startOfMonth(new Date()), []);
  const { data: monthlyDealsData, refetch: refetchMonthlyDeals } =
    useDedupedQuery({
      queryKey: ["db-deals-monthly", currentMonth, currentYear],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("deals")
          .select("id, deal_value, cash_collected, status, created_at")
          .gte("created_at", monthStart.toISOString())
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data || [];
      },
    });

  // Fetch call records
  const {
    data: callsData,
    isLoading: loadingCalls,
    refetch: refetchCalls,
  } = useDedupedQuery({
    queryKey: ["db-calls", timeframe],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_records")
        .select("id, call_direction, caller_number, call_status, duration_seconds, call_score, appointment_set, created_at")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch staff
  const { data: staffData } = useDedupedQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name");
      if (error) throw error;
      return data || [];
    },
  });

  // All leads combined
  const allLeads = useMemo(() => {
    return [
      ...(leadsData || []).map((l) => ({
        ...l,
        source_type: "leads",
        display_name:
          l.name ||
          `${l.first_name || ""} ${l.last_name || ""}`.trim() ||
          "Unknown",
        lead_quality: l.score
          ? l.score > 70
            ? "high"
            : l.score > 40
              ? "medium"
              : "low"
          : "pending",
      })),
      ...(enhancedLeadsData || []).map((l) => ({
        ...l,
        source_type: "enhanced",
        display_name:
          `${l.first_name || ""} ${l.last_name || ""}`.trim() || "Unknown",
      })),
    ];
  }, [leadsData, enhancedLeadsData]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const leads = allLeads;
    const deals = dealsData || [];
    const calls = callsData || [];
    const monthlyDeals = monthlyDealsData || [];

    // Lead stats
    const totalLeads = leads.length;
    const newLeads = leads.filter((l: any) => l.status === "new").length;
    const appointmentSet = leads.filter(
      (l: any) => l.status === "appointment_set",
    ).length;
    const closedLeads = leads.filter((l: any) => l.status === "closed").length;
    const highQualityLeads = leads.filter(
      (l: any) => l.lead_quality === "high" || l.lead_quality === "premium",
    ).length;

    // Deal stats
    const totalDeals = deals.length;
    const closedDeals = deals.filter((d) => d.status === "closed").length;
    const totalDealValue = deals.reduce(
      (sum, d) => sum + (Number(d.deal_value) || 0),
      0,
    );

    // Revenue from monthly deals
    const monthlyClosedDealValue = monthlyDeals
      .filter((d) => d.status === "closed")
      .reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0);
    const monthlyCashCollected = monthlyDeals.reduce(
      (sum, d) => sum + (Number(d.cash_collected) || 0),
      0,
    );

    // Call stats
    const totalCalls = calls.length;
    const completedCalls = calls.filter(
      (c) => c.call_status === "completed",
    ).length;
    const totalDuration = calls.reduce(
      (sum, c) => sum + (c.duration_seconds || 0),
      0,
    );
    const avgDuration =
      totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
    const appointmentsFromCalls = calls.filter((c) => c.appointment_set).length;

    return {
      totalLeads,
      newLeads,
      appointmentSet,
      closedLeads,
      highQualityLeads,
      totalDeals,
      closedDeals,
      totalDealValue,
      closedDealValue: monthlyClosedDealValue,
      cashCollected: monthlyCashCollected,
      totalCalls,
      completedCalls,
      totalDuration,
      avgDuration,
      appointmentsFromCalls,
      conversionRate: calculateConversionRate(closedLeads, totalLeads),
      connectRate: calculateConnectRate(completedCalls, totalCalls),
      avgDealValue: calculateAvgDealValue(
        monthlyClosedDealValue,
        monthlyDeals.filter((d) => d.status === "closed").length,
      ),
      revenuePerLead: calculateRevenuePerLead(
        monthlyClosedDealValue,
        totalLeads,
      ),
      appointmentRate: calculateConversionRate(appointmentSet, totalLeads),
      closeRate: calculateConversionRate(closedDeals, totalDeals),
    };
  }, [allLeads, dealsData, callsData, monthlyDealsData]);

  const isLoading =
    loadingLeads || loadingEnhanced || loadingDeals || loadingCalls;

  const refreshData = async () => {
    await Promise.all([
      refetchLeads(),
      refetchEnhanced(),
      refetchDeals(),
      refetchCalls(),
      refetchMonthlyDeals(),
    ]);
  };

  return {
    kpis,
    allLeads,
    dealsData,
    callsData,
    staffData,
    isLoading,
    refreshData,
    dateRange,
  };
};
