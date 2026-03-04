import { supabase } from "@/integrations/supabase/client";
import { QUERY_KEYS } from "@/config/queryKeys";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { computeCAC } from "@/lib/metrics-calculator";

// Safe toFixed helper - returns "—" for null/undefined/non-finite values
const toFixedSafe = (value: unknown, digits = 2): string => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
};

/**
 * Executive Overview Data Hook
 *
 * Consolidates all executive dashboard metrics into a single batched query.
 * Replaces hardcoded mock data with real-time Supabase queries.
 *
 * Data Sources:
 * - Revenue: deals table (closed won deals)
 * - Leads: contacts table (filtered by lifecycle stage)
 * - Calls: call_records table (with date filtering)
 * - Ad Spend: facebook_ads_insights table (aggregated)
 * - Health: client_health_daily table
 * - Activity: Recent deal/contact/call changes
 *
 * Usage:
 * const { data, isLoading } = useExecutiveData({ dateRange: "last_30_days" });
 */

interface ExecutiveFilters {
  dateRange: string;
}

// Helper to convert date range preset to SQL date filter
function getDateFilter(dateRange: string): Date {
  const now = new Date();
  const daysMap: Record<string, number> = {
    last_7_days: 7,
    last_30_days: 30,
    last_90_days: 90,
    last_180_days: 180,
    last_365_days: 365,
  };

  const days = daysMap[dateRange] || 30;
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date;
}

export function useExecutiveData(filters: ExecutiveFilters) {
  const dateFilter = getDateFilter(filters.dateRange);
  const dateFilterISO = dateFilter.toISOString();

  // Calculate previous period dates (same duration, shifted back)
  const periodDuration = Date.now() - dateFilter.getTime();
  const previousPeriodStart = new Date(dateFilter.getTime() - periodDuration);
  const previousPeriodStartISO = previousPeriodStart.toISOString();

  return useDedupedQuery({
    queryKey: QUERY_KEYS.dashboard.batch({ executive: true, ...filters }),
    dedupeIntervalMs: 1000,
    queryFn: async () => {
      // Execute all queries in parallel for optimal performance
      const [
        revenueResult,
        dealsResult,
        leadsResult,
        callsResult,
        adSpendResult,
        healthResult,
        healthDistributionResult,
        pipelineStagesResult,
        recentActivityResult,
        topPerformersResult,
        staleLeadsResult,
        // Previous period queries for delta calculation
        prevRevenueResult,
        prevDealsResult,
        prevCallsResult,
        prevHealthResult,
        prevAdSpendResult,
        prevLeadsResult,
      ] = await Promise.all([
        // Query 1: Monthly Revenue (closed won deals in period)
        supabase
          .from("deals")
          .select("deal_value, amount, close_date, created_at, stage_label")
          .eq("stage", "closedwon")
          .gte("close_date", dateFilterISO)
          .order("close_date", { ascending: false }),

        // Query 2: All Deals (for counts and stage breakdown)
        supabase
          .from("deals")
          .select("id, deal_value, amount, stage, stage_label, status, created_at, close_date")
          .gte("created_at", dateFilterISO)
          .order("created_at", { ascending: false }),

        // Query 3: Leads (contacts in lead/prospect stages)
        supabase
          .from("contacts")
          .select("id, email, created_at, lifecycle_stage, attributed_campaign_id")
          .gte("created_at", dateFilterISO)
          .order("created_at", { ascending: false }),

        // Query 4: Calls (call records with outcomes)
        supabase
          .from("call_records")
          .select("id, duration_seconds, call_outcome, appointment_set, started_at, created_at")
          .gte("created_at", dateFilterISO)
          .order("created_at", { ascending: false }),

        // Query 5: Facebook Ad Spend (aggregated by date)
        supabase
          .from("facebook_ads_insights")
          .select("spend, clicks, leads, conversions, date, campaign_name")
          .gte("date", dateFilterISO)
          .order("date", { ascending: false }),

        // Query 6: Client Health Scores (latest calculated scores)
        supabase
          .from("client_health_daily")
          .select("id, health_score, health_zone, churn_risk_score, calculated_on")
          .order("calculated_on", { ascending: false })
          .limit(200),

        // Query 7: Health Distribution (group by zone)
        supabase
          .from("client_health_daily")
          .select("health_zone")
          .order("calculated_on", { ascending: false }),

        // Query 8: Pipeline Stages (deals by stage, excluding closed)
        supabase
          .from("deals")
          .select("stage, stage_label, deal_value, amount")
          .eq("status", "pending")
          .not("stage", "in", '("closedwon","closedlost")'),

        // Query 9: Recent Activity (for live feed)
        supabase
          .from("deals")
          .select("id, deal_name, deal_value, amount, stage, stage_label, status, updated_at, created_at")
          .order("updated_at", { ascending: false })
          .limit(10),

        // Query 10: Top Performers (staff with most calls today)
        supabase
          .from("call_records")
          .select("owner_name, call_outcome, appointment_set")
          .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),

        // Query 11: Stale leads needing follow-up (created >48h ago, no deal, not customer)
        supabase
          .from("contacts")
          .select("id, first_name, last_name, email, phone, lifecycle_stage, created_at, last_activity_date, lead_status, owner_name, speed_to_lead_minutes")
          .in("lifecycle_stage", ["lead", "subscriber", "marketingqualifiedlead", "salesqualifiedlead"])
          .order("created_at", { ascending: false })
          .limit(50),

        // Previous period queries for delta calculations
        // Query 12: Previous period revenue
        supabase
          .from("deals")
          .select("deal_value, amount, close_date, created_at, stage_label")
          .eq("stage", "closedwon")
          .gte("close_date", previousPeriodStartISO)
          .lt("close_date", dateFilterISO)
          .order("close_date", { ascending: false }),

        // Query 13: Previous period deals
        supabase
          .from("deals")
          .select("id, deal_value, amount, stage, stage_label, status, created_at, close_date")
          .gte("created_at", previousPeriodStartISO)
          .lt("created_at", dateFilterISO)
          .order("created_at", { ascending: false }),

        // Query 14: Previous period calls
        supabase
          .from("call_records")
          .select("id, duration_seconds, call_outcome, appointment_set, started_at, created_at")
          .gte("created_at", previousPeriodStartISO)
          .lt("created_at", dateFilterISO)
          .order("created_at", { ascending: false }),

        // Query 15: Previous period health scores
        supabase
          .from("client_health_daily")
          .select("id, health_score, health_zone, churn_risk_score, calculated_on")
          .order("calculated_on", { ascending: false })
          .limit(200),

        // Query 16: Previous period ad spend
        supabase
          .from("facebook_ads_insights")
          .select("spend, clicks, leads, conversions, date, campaign_name")
          .gte("date", previousPeriodStartISO.split('T')[0])
          .lt("date", dateFilterISO.split('T')[0])
          .order("date", { ascending: false }),

        // Query 17: Previous period leads
        supabase
          .from("contacts")
          .select("id, email, created_at, lifecycle_stage, attributed_campaign_id")
          .gte("created_at", previousPeriodStartISO)
          .lt("created_at", dateFilterISO)
          .order("created_at", { ascending: false }),
      ]);

      // Handle errors (throw critical ones, warn on optional)
      if (revenueResult.error) throw revenueResult.error;
      if (dealsResult.error) throw dealsResult.error;
      if (leadsResult.error) throw leadsResult.error;
      if (callsResult.error) throw callsResult.error;
      if (adSpendResult.error) console.warn("Ad spend query error:", adSpendResult.error);
      if (healthResult.error) throw healthResult.error;
      if (healthDistributionResult.error) throw healthDistributionResult.error;
      if (pipelineStagesResult.error) throw pipelineStagesResult.error;
      if (recentActivityResult.error) console.warn("Recent activity error:", recentActivityResult.error);
      if (topPerformersResult.error) console.warn("Top performers error:", topPerformersResult.error);
      if (staleLeadsResult.error) console.warn("Stale leads error:", staleLeadsResult.error);
      // Previous period errors
      if (prevRevenueResult.error) console.warn("Previous revenue query error:", prevRevenueResult.error);
      if (prevDealsResult.error) console.warn("Previous deals query error:", prevDealsResult.error);
      if (prevCallsResult.error) console.warn("Previous calls query error:", prevCallsResult.error);
      if (prevHealthResult.error) console.warn("Previous health query error:", prevHealthResult.error);
      if (prevAdSpendResult.error) console.warn("Previous ad spend query error:", prevAdSpendResult.error);
      if (prevLeadsResult.error) console.warn("Previous leads query error:", prevLeadsResult.error);

      // Calculate aggregated metrics
      const deals = dealsResult.data || [];
      const closedDeals = revenueResult.data || [];
      const leads = leadsResult.data || [];
      const calls = callsResult.data || [];
      const adInsights = adSpendResult.data || [];
      const healthScores = healthResult.data || [];
      const healthDistribution = healthDistributionResult.data || [];
      const pipelineStages = pipelineStagesResult.data || [];
      const recentActivities = recentActivityResult.data || [];
      const todayCalls = topPerformersResult.data || [];
      const staleLeadsRaw = staleLeadsResult.data || [];

      // Previous period data
      const prevClosedDeals = prevRevenueResult.data || [];
      const prevDeals = prevDealsResult.data || [];
      const prevCalls = prevCallsResult.data || [];
      const prevHealthScores = prevHealthResult.data || [];
      const prevAdInsights = prevAdSpendResult.data || [];
      const prevLeads = prevLeadsResult.data || [];

      // Top performers: aggregate calls by owner
      const performerMap = new Map<string, { calls: number; booked: number }>();
      todayCalls.forEach(call => {
        const owner = call.owner_name || "Unknown";
        const current = performerMap.get(owner) || { calls: 0, booked: 0 };
        current.calls++;
        if (call.appointment_set) current.booked++;
        performerMap.set(owner, current);
      });
      const topPerformers = Array.from(performerMap.entries())
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 5);

      // Stale leads: leads with no activity in 48h+ or speed_to_lead > 60min
      const now = Date.now();
      const staleLeads = staleLeadsRaw
        .filter(l => {
          const lastActivity = l.last_activity_date ? new Date(l.last_activity_date).getTime() : l.created_at ? new Date(l.created_at).getTime() : 0;
          const hoursSinceActivity = (now - lastActivity) / (1000 * 60 * 60);
          return hoursSinceActivity > 48;
        })
        .slice(0, 10)
        .map(l => ({
          name: `${l.first_name || ""} ${l.last_name || ""}`.trim() || l.email || "Unknown",
          email: l.email,
          stage: l.lifecycle_stage || "lead",
          owner: l.owner_name || "Unassigned",
          daysSinceActivity: Math.round((now - new Date(l.last_activity_date || l.created_at || "").getTime()) / (1000 * 60 * 60 * 24)),
          speedToLead: l.speed_to_lead_minutes,
        }));

      // Revenue calculations
      const totalRevenue = closedDeals.reduce((sum, deal) => sum + (deal.deal_value || Number(deal.amount) || 0), 0);
      const monthlyRevenue = totalRevenue; // Already filtered by date range

      // Calculate previous period revenue for delta
      const midPoint = new Date(dateFilter);
      midPoint.setDate(midPoint.getDate() + Math.floor((Date.now() - dateFilter.getTime()) / (2 * 24 * 60 * 60 * 1000)));
      const previousPeriodRevenue = closedDeals
        .filter(deal => new Date(deal.close_date || deal.created_at || "") < midPoint)
        .reduce((sum, deal) => sum + (deal.deal_value || Number(deal.amount) || 0), 0);
      const currentPeriodRevenue = closedDeals
        .filter(deal => new Date(deal.close_date || deal.created_at || "") >= midPoint)
        .reduce((sum, deal) => sum + (deal.deal_value || Number(deal.amount) || 0), 0);
      const revenueDelta = previousPeriodRevenue > 0
        ? ((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
        : 0;

      // KPI metrics
      const totalDeals = deals.length;
      const closedWonCount = closedDeals.length;
      const totalCalls = calls.length;
      const avgHealthScore = healthScores.length > 0
        ? Math.round(healthScores.reduce((sum, h) => sum + (h.health_score || 0), 0) / healthScores.length)
        : 0;

      // Calculate previous period metrics for delta calculations
      const prevTotalRevenue = prevClosedDeals.reduce((sum, deal) => sum + (deal.deal_value || Number(deal.amount) || 0), 0);
      const prevTotalDeals = prevDeals.length;
      const prevTotalCalls = prevCalls.length;
      const prevAvgHealthScore = prevHealthScores.length > 0
        ? Math.round(prevHealthScores.reduce((sum, h) => sum + (h.health_score || 0), 0) / prevHealthScores.length)
        : 0;
      const prevTotalAdSpend = prevAdInsights.reduce((sum, ad) => sum + (Number(ad.spend) || 0), 0);
      const prevTotalLeads = prevLeads.length;
      const prevAvgDealValue = prevClosedDeals.length > 0
        ? prevClosedDeals.reduce((sum, d) => sum + (d.deal_value || Number(d.amount) || 0), 0) / prevClosedDeals.length
        : 0;
      const prevCac = computeCAC(prevTotalAdSpend, prevTotalLeads) ?? 0;
      const prevAtRiskCount = prevHealthScores.filter(h => h.health_zone === "red" || h.churn_risk_score > 0.7).length;
      const prevTotalClients = prevHealthScores.length;
      const prevChurnRate = prevTotalClients > 0 ? (prevAtRiskCount / prevTotalClients) * 100 : 0;

      // Calculate deltas (period-over-period)
      const ltvDelta = prevAvgDealValue > 0 ? ((avgDealValue - prevAvgDealValue) / prevAvgDealValue) * 100 : 0;
      const cacDelta = prevCac > 0 ? ((cac - prevCac) / prevCac) * 100 : 0;
      const churnDelta = prevChurnRate > 0 ? ((churnRate - prevChurnRate) / prevChurnRate) * 100 : 0;
      const healthDelta = prevAvgHealthScore > 0 ? ((avgHealthScore - prevAvgHealthScore) / prevAvgHealthScore) * 100 : 0;
      const dealsDelta = prevTotalDeals > 0 ? ((totalDeals - prevTotalDeals) / prevTotalDeals) * 100 : 0;
      const callsDelta = prevTotalCalls > 0 ? ((totalCalls - prevTotalCalls) / prevTotalCalls) * 100 : 0;

      // LTV calculation (simplified: avg deal value)
      const avgDealValue = closedDeals.length > 0
        ? closedDeals.reduce((sum, d) => sum + (d.deal_value || Number(d.amount) || 0), 0) / closedDeals.length
        : 0;

      // CAC calculation (ad spend / leads)
      const totalAdSpend = adInsights.reduce((sum, ad) => sum + (Number(ad.spend) || 0), 0);
      const totalLeads = leads.length;
      const cac = computeCAC(totalAdSpend, totalLeads) ?? 0;

      // Churn calculation (based on at-risk clients)
      const atRiskCount = healthScores.filter(h => h.health_zone === "red" || h.churn_risk_score > 0.7).length;
      const totalClients = healthScores.length;
      const churnRate = totalClients > 0 ? (atRiskCount / totalClients) * 100 : 0;

      // MRR & ARR estimation (simplified)
      const mrr = monthlyRevenue;
      const arr = mrr * 12;

      // Full-chain funnel data
      const totalClicks = adInsights.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
      const bookedDeals = deals.filter(d => d.stage === "appointmentscheduled" || d.stage === "booked").length;
      const closedWon = closedWonCount;

      // Conversion rates
      const clickToLeadRate = totalClicks > 0 ? (totalLeads / totalClicks) * 100 : 0;
      const leadToCallRate = totalLeads > 0 ? (totalCalls / totalLeads) * 100 : 0;
      const callToBookedRate = totalCalls > 0 ? (bookedDeals / totalCalls) * 100 : 0;
      const bookedToClosedRate = bookedDeals > 0 ? (closedWon / bookedDeals) * 100 : 0;

      // Revenue trend data (split by weeks)
      const revenueTrend = generateRevenueTrend(closedDeals, dateFilter);

      // Health distribution
      const greenCount = healthDistribution.filter(h => h.health_zone === "green").length;
      const yellowCount = healthDistribution.filter(h => h.health_zone === "yellow").length;
      const redCount = healthDistribution.filter(h => h.health_zone === "red").length;

      // Pipeline stages distribution
      const stageDistribution = aggregatePipelineStages(pipelineStages);

      // Live activity feed
      const activityFeed = formatActivityFeed(recentActivities);

      return {
        // North Star Metric
        northStarMetric: {
          value: formatCurrency(monthlyRevenue),
          label: "Monthly Revenue",
          delta: {
            value: Math.round(revenueDelta * 10) / 10,
            type: revenueDelta >= 0 ? "positive" : "negative",
          },
        },

        // KPI Metrics
        kpiMetrics: [
          {
            label: "MRR",
            value: formatCurrency(mrr / 1000) + "K",
            delta: { value: Math.round(revenueDelta * 10) / 10, type: revenueDelta >= 0 ? "positive" : "negative" },
          },
          {
            label: "ARR",
            value: formatCurrency(arr / 1000000, 1) + "M",
            delta: { value: Math.round(revenueDelta * 10) / 10, type: revenueDelta >= 0 ? "positive" : "negative" },
          },
          {
            label: "LTV",
            value: formatCurrency(avgDealValue / 1000, 1) + "K",
            delta: { value: Math.round(ltvDelta * 10) / 10, type: ltvDelta >= 0 ? "positive" : "negative" },
          },
          {
            label: "CAC",
            value: formatCurrency(cac / 1000, 1) + "K",
            delta: { value: Math.round(cacDelta * 10) / 10, type: cacDelta <= 0 ? "positive" : "negative" },
          },
          {
            label: "Churn",
            value: toFixedSafe(churnRate, 1) + "%",
            delta: { value: Math.round(churnDelta * 10) / 10, type: churnDelta <= 0 ? "positive" : "negative" },
          },
          {
            label: "Health",
            value: `${avgHealthScore}/100`,
            delta: { value: Math.round(healthDelta * 10) / 10, type: healthDelta >= 0 ? "positive" : "negative" },
          },
          {
            label: "Deals",
            value: totalDeals.toString(),
            delta: { value: Math.round(dealsDelta * 10) / 10, type: dealsDelta >= 0 ? "positive" : "negative" },
          },
          {
            label: "Calls",
            value: totalCalls.toString(),
            delta: { value: Math.round(callsDelta * 10) / 10, type: callsDelta >= 0 ? "positive" : "negative" },
          },
        ],

        // Full-chain funnel
        fullChainData: [
          { name: "Ad Spend", value: totalAdSpend, label: formatCurrency(totalAdSpend) },
          { name: "Leads", value: totalLeads, label: `${totalLeads} (${clickToLeadRate.toFixed(1)}%)` },
          { name: "Calls", value: totalCalls, label: `${totalCalls} (${leadToCallRate.toFixed(1)}%)` },
          { name: "Booked", value: bookedDeals, label: `${bookedDeals} (${callToBookedRate.toFixed(1)}%)` },
          { name: "Closed", value: closedWon, label: `${closedWon} (${bookedToClosedRate.toFixed(1)}%)` },
        ],

        // Revenue trend
        revenueTrendData: revenueTrend,

        // Health distribution
        healthDistribution: {
          green: greenCount,
          yellow: yellowCount,
          red: redCount,
        },

        // Pipeline stages
        pipelineStages: stageDistribution,

        // Live activity feed
        liveActivityData: activityFeed,

        // Top performers today
        topPerformers,

        // Stale leads needing follow-up
        staleLeads,

        // Raw data for custom processing
        raw: {
          deals,
          closedDeals,
          leads,
          calls,
          adInsights,
          healthScores,
        },
      };
    },
    staleTime: 60000, // Cache for 1 minute (executive dashboard needs fresher data)
  });
}

// Helper functions
function formatCurrency(value: number, decimals = 0): string {
  return `AED ${value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

interface DealData {
  deal_value?: number;
  amount?: number;
  close_date?: string;
  created_at?: string;
  [key: string]: unknown;
}

function generateRevenueTrend(deals: DealData[], startDate: Date) {
  const now = new Date();
  const daysDiff = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const weeks = Math.min(Math.ceil(daysDiff / 7), 5);

  const trend = [];
  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekRevenue = deals
      .filter(d => {
        const closeDate = new Date(d.close_date || d.created_at || "");
        return closeDate >= weekStart && closeDate < weekEnd;
      })
      .reduce((sum, d) => sum + (d.deal_value || Number(d.amount) || 0), 0);

    trend.push({
      date: (i * 7 + 7).toString(),
      mrr: weekRevenue,
      target: weekRevenue * 1.1, // 10% stretch target
    });
  }

  return trend;
}

interface PipelineStageData {
  stage?: string;
  status?: string;
  [key: string]: unknown;
}

function aggregatePipelineStages(deals: PipelineStageData[]) {
  const stages: Record<string, number> = {
    Lead: 0,
    Qualified: 0,
    Demo: 0,
    Proposal: 0,
    Closed: 0,
  };

  deals.forEach(deal => {
    const stage = deal.stage?.toLowerCase() || "";
    if (stage.includes("lead") || stage.includes("new")) stages.Lead++;
    else if (stage.includes("qualified") || stage.includes("contacted")) stages.Qualified++;
    else if (stage.includes("demo") || stage.includes("meeting")) stages.Demo++;
    else if (stage.includes("proposal") || stage.includes("negotiation")) stages.Proposal++;
    else if (stage.includes("closedwon") || stage.includes("closed won") || deal.stage === "closedwon") stages.Closed++;
  });

  return stages;
}

interface ActivityData {
  deal_name?: string;
  deal_value?: number;
  stage?: string;
  status?: string;
  updated_at?: string;
  created_at?: string;
  [key: string]: unknown;
}

function formatActivityFeed(activities: ActivityData[]) {
  return activities.slice(0, 4).map((activity, index) => {
    const minutesAgo = Math.floor((Date.now() - new Date(activity.updated_at || activity.created_at).getTime()) / 60000);
    const timeStr = minutesAgo < 60 ? `${minutesAgo}m ago` : `${Math.floor(minutesAgo / 60)}h ago`;

    let message = "";
    let status: "success" | "warning" | "info" = "info";

    if (activity.stage === "closedwon") {
      message = `Deal "${activity.deal_name || 'Unnamed'}" moved to Closed Won (${formatCurrency(Number(activity.deal_value || activity.amount) || 0)})`;
      status = "success";
    } else if (activity.stage) {
      message = `Deal "${activity.deal_name || 'Unnamed'}" updated to ${activity.stage_label || activity.stage}`;
      status = "info";
    } else {
      message = `New activity: ${activity.deal_name || 'Deal update'}`;
      status = "info";
    }

    return {
      id: index + 1,
      type: "deal",
      time: timeStr,
      message,
      status,
    };
  });
}
