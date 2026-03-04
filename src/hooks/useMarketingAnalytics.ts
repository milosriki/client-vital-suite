import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type FacebookAdsInsight = Database["public"]["Tables"]["facebook_ads_insights"]["Row"];
type Deal = Database["public"]["Tables"]["deals"]["Row"];
type StripeTransaction = Database["public"]["Tables"]["stripe_transactions"]["Row"];

// Safe toFixed helper - returns "—" for null/undefined/non-finite values
const toFixedSafe = (value: unknown, digits = 2): string => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
};

/**
 * Date range helper to calculate start/end dates based on preset
 */
const getDateRangeFromPreset = (preset: string): { startDate: string; endDate: string } => {
  const now = new Date();
  const endDate = now.toISOString().split("T")[0];
  let startDate: Date;

  switch (preset) {
    case "today":
      startDate = new Date(now);
      break;
    case "yesterday":
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 1);
      break;
    case "this_week":
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "last_week":
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 14);
      break;
    case "this_month":
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      break;
    case "last_month":
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 60);
      break;
    case "this_quarter":
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case "last_quarter":
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 6);
      break;
    case "this_year":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
  }

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate,
  };
};

/**
 * Hook for Tab 2 (Deep Analysis) - Historical baseline comparison using facebook_ads_insights
 */
export const useDeepAnalysis = (dateRange: string) => {
  return useQuery({
    queryKey: ["marketing-deep-analysis", dateRange],
    queryFn: async () => {
      const { startDate, endDate } = getDateRangeFromPreset(dateRange);

      // Fetch current period data
      const { data: currentData, error: currentError } = await supabase
        .from("facebook_ads_insights")
        .select("spend, leads, clicks, impressions, conversions, frequency, date, campaign_name, purchase_value")
        .gte("date", startDate)
        .lte("date", endDate);

      if (currentError) throw currentError;

      // Fetch baseline (12 months ago) data
      const baselineStart = new Date(startDate);
      baselineStart.setFullYear(baselineStart.getFullYear() - 1);
      const baselineEnd = new Date(endDate);
      baselineEnd.setFullYear(baselineEnd.getFullYear() - 1);

      const { data: baselineData, error: baselineError } = await supabase
        .from("facebook_ads_insights")
        .select("spend, leads, clicks, impressions, conversions, frequency, date, campaign_name, purchase_value")
        .gte("date", baselineStart.toISOString().split("T")[0])
        .lte("date", baselineEnd.toISOString().split("T")[0]);

      if (baselineError) throw baselineError;

      // Calculate aggregated metrics
      const calculateMetrics = (data: FacebookAdsInsight[]) => {
        const totalSpend = data.reduce((sum, row) => sum + (Number(row.spend) || 0), 0);
        const totalLeads = data.reduce((sum, row) => sum + (row.leads || 0), 0);
        const totalClicks = data.reduce((sum, row) => sum + (row.clicks || 0), 0);
        const totalImpressions = data.reduce((sum, row) => sum + (row.impressions || 0), 0);
        const totalConversions = data.reduce((sum, row) => sum + (row.conversions || 0), 0);
        const avgFrequency = data.length > 0
          ? data.reduce((sum, row) => sum + (row.frequency || 0), 0) / data.length
          : 0;

        const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
        const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
        const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

        return { cpl, conversionRate, ctr, avgFrequency, avgCpc };
      };

      const currentMetrics = calculateMetrics(currentData || []);
      const baselineMetrics = calculateMetrics(baselineData || []);

      // Calculate variance
      const calculateVariance = (current: number, baseline: number) => {
        if (baseline === 0) return 0;
        return ((current - baseline) / baseline) * 100;
      };

      const baselineComparison = [
        {
          metric: "CPL",
          current: currentMetrics.cpl,
          baseline: baselineMetrics.cpl,
          variance: calculateVariance(currentMetrics.cpl, baselineMetrics.cpl),
          status: currentMetrics.cpl < baselineMetrics.cpl ? "improving" : "declining",
        },
        {
          metric: "Conversion Rate",
          current: currentMetrics.conversionRate,
          baseline: baselineMetrics.conversionRate,
          variance: calculateVariance(currentMetrics.conversionRate, baselineMetrics.conversionRate),
          status: currentMetrics.conversionRate > baselineMetrics.conversionRate ? "improving" : "declining",
        },
        {
          metric: "CTR",
          current: currentMetrics.ctr,
          baseline: baselineMetrics.ctr,
          variance: calculateVariance(currentMetrics.ctr, baselineMetrics.ctr),
          status: currentMetrics.ctr > baselineMetrics.ctr ? "improving" : "declining",
        },
        {
          metric: "Ad Frequency",
          current: currentMetrics.avgFrequency,
          baseline: baselineMetrics.avgFrequency,
          variance: calculateVariance(currentMetrics.avgFrequency, baselineMetrics.avgFrequency),
          status: currentMetrics.avgFrequency < baselineMetrics.avgFrequency ? "improving" : "declining",
        },
        {
          metric: "CPC",
          current: currentMetrics.avgCpc,
          baseline: baselineMetrics.avgCpc,
          variance: calculateVariance(currentMetrics.avgCpc, baselineMetrics.avgCpc),
          status: currentMetrics.avgCpc < baselineMetrics.avgCpc ? "improving" : "declining",
        },
      ];

      // Cohort analysis - group by month
      type CohortAnalysisEntry = {
        month: string;
        leads: number;
        conv: number;
        revenue: number;
        roas: number;
        cac: number;
        trend: string;
      };
      const cohortData: { roas: number; month: string; leads: number; conv: number; revenue: number; cac: number }[] = [];
      for (let i = 0; i < 5; i++) {
        const monthStart = new Date(endDate);
        monthStart.setMonth(monthStart.getMonth() - i);
        monthStart.setDate(1);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        monthEnd.setDate(0);

        const { data: monthData } = await supabase
          .from("facebook_ads_insights")
          .select("spend, leads, clicks, impressions, conversions, frequency, date, campaign_name, purchase_value")
          .gte("date", monthStart.toISOString().split("T")[0])
          .lte("date", monthEnd.toISOString().split("T")[0]);

        if (monthData) {
          const metrics = calculateMetrics(monthData);
          const totalSpend = monthData.reduce((sum, row) => sum + (Number(row.spend) || 0), 0);
          const totalLeads = monthData.reduce((sum, row) => sum + (row.leads || 0), 0);
          const revenue = monthData.reduce((sum, row) => sum + (row.purchase_value || 0), 0);
          const roas = totalSpend > 0 ? revenue / totalSpend : 0;

          cohortData.push({
            month: monthStart.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
            leads: totalLeads,
            conv: metrics.conversionRate,
            revenue,
            roas,
            cac: metrics.cpl,
          });
        }
      }

      // Reverse so oldest month is first (index 0), newest is last
      cohortData.reverse();

      const cohortAnalysis: CohortAnalysisEntry[] = cohortData.map((m, i) => {
        const prevMonthData = i > 0 ? cohortData[i - 1] : null;
        const trend = prevMonthData && prevMonthData.roas > 0
          ? `${toFixedSafe((m.roas - prevMonthData.roas) / prevMonthData.roas * 100, 1)}%`
          : "—";
        return { ...m, trend };
      });

      return {
        baselineComparison,
        cohortAnalysis,
        rawData: currentData,
      };
    },
  });
};

/**
 * Hook for Tab 3 (Meta Ads) - Campaign/adset metrics from facebook_ads_insights
 */
export const useMetaAds = (dateRange: string) => {
  return useQuery({
    queryKey: ["marketing-meta-ads", dateRange],
    queryFn: async () => {
      const { startDate: since, endDate } = getDateRangeFromPreset(dateRange);

      // Fetch campaign-level ROAS from the funnel view
      const { data: funnelData } = await supabase
        .from("campaign_full_funnel")
        .select("campaign, roas, revenue, spend");
      const funnelMap = new Map((funnelData || []).map(f => [f.campaign, f]));

      const { data, error } = await supabase
        .from("facebook_ads_insights")
        .select("spend, leads, clicks, impressions, frequency, ctr, date, campaign_name")
        .gte("date", since)
        .lte("date", endDate);

      if (error) throw error;

      // Aggregate metrics
      const totalImpressions = data.reduce((sum, row) => sum + (row.impressions || 0), 0);
      const totalClicks = data.reduce((sum, row) => sum + (row.clicks || 0), 0);
      const totalSpend = data.reduce((sum, row) => sum + (Number(row.spend) || 0), 0);
      const totalLeads = data.reduce((sum, row) => sum + (row.leads || 0), 0);
      const avgFrequency = data.length > 0
        ? data.reduce((sum, row) => sum + (row.frequency || 0), 0) / data.length
        : 0;
      const avgCtr = data.length > 0
        ? data.reduce((sum, row) => sum + (row.ctr || 0), 0) / data.length
        : 0;
      const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

      // Compute prior period for real deltas
      const presetToDays: Record<string, number> = {
        today: 1, yesterday: 1, this_week: 7, last_week: 14,
        this_month: 30, last_month: 60, this_quarter: 90, last_quarter: 180, this_year: 365,
      };
      const periodDays = presetToDays[dateRange] || 30;
      const priorEnd = since;
      const priorStartDate = new Date(since);
      priorStartDate.setDate(priorStartDate.getDate() - periodDays);
      const priorStart = priorStartDate.toISOString().split("T")[0];

      const { data: priorRaw } = await supabase
        .from("facebook_ads_insights")
        .select("spend, impressions, clicks, leads, frequency, ctr")
        .gte("date", priorStart)
        .lt("date", priorEnd);

      const prior = (priorRaw || []).reduce((a, r) => ({
        spend: a.spend + Number(r.spend || 0),
        impressions: a.impressions + Number(r.impressions || 0),
        clicks: a.clicks + Number(r.clicks || 0),
        leads: a.leads + Number(r.leads || 0),
        frequency: a.frequency + Number(r.frequency || 0),
        ctr: a.ctr + Number(r.ctr || 0),
        count: a.count + 1,
      }), { spend: 0, impressions: 0, clicks: 0, leads: 0, frequency: 0, ctr: 0, count: 0 });

      const priorAvgFrequency = prior.count > 0 ? prior.frequency / prior.count : 0;
      const priorAvgCtr = prior.count > 0 ? prior.ctr / prior.count : 0;
      const priorAvgCpc = prior.clicks > 0 ? prior.spend / prior.clicks : 0;

      const calcDelta = (current: number, priorVal: number) => {
        if (priorVal === 0) return { value: 0, type: "neutral" as const };
        const pct = Math.round(((current - priorVal) / priorVal) * 100);
        return { value: Math.abs(pct), type: pct >= 0 ? "positive" as const : "negative" as const };
      };

      const metrics = [
        {
          label: "Impressions",
          value: totalImpressions >= 1000000
            ? `${toFixedSafe(totalImpressions / 1000000, 1)}M`
            : totalImpressions.toLocaleString(),
          delta: calcDelta(totalImpressions, prior.impressions),
          icon: "BarChart3"
        },
        {
          label: "Clicks",
          value: totalClicks.toLocaleString(),
          delta: calcDelta(totalClicks, prior.clicks),
          icon: "Target"
        },
        {
          label: "CTR",
          value: `${toFixedSafe(avgCtr, 2)}%`,
          delta: calcDelta(avgCtr, priorAvgCtr),
          icon: "TrendingUp"
        },
        {
          label: "CPC",
          value: `AED ${toFixedSafe(avgCpc, 0)}`,
          delta: calcDelta(avgCpc, priorAvgCpc),
          icon: "DollarSign"
        },
        {
          label: "Frequency",
          value: toFixedSafe(avgFrequency, 1),
          delta: calcDelta(avgFrequency, priorAvgFrequency),
          icon: "BarChart3"
        },
      ];

      // Group by campaign
      const campaignMap = new Map<string, {
        campaign: string;
        status: string;
        spend: number;
        leads: number;
        cpl: number;
        roas: number;
      }>();

      data.forEach((row) => {
        const campaignName = row.campaign_name || "Unknown Campaign";
        const existing = campaignMap.get(campaignName);

        if (existing) {
          existing.spend += Number(row.spend) || 0;
          existing.leads += row.leads || 0;
        } else {
          campaignMap.set(campaignName, {
            campaign: campaignName,
            status: Number(row.spend) > 0 ? "Active" : "Paused",
            spend: Number(row.spend) || 0,
            leads: row.leads || 0,
            cpl: 0,
            roas: 0,
          });
        }
      });

      // Calculate CPL and ROAS for each campaign using real funnel data
      const campaigns = Array.from(campaignMap.values()).map((c) => ({
        ...c,
        status: c.spend > 0 ? "Active" : "Paused",
        cpl: c.leads > 0 ? c.spend / c.leads : 0,
        roas: funnelMap.get(c.campaign)?.roas || 0,
      }));

      return {
        metrics,
        campaigns: campaigns.sort((a, b) => b.spend - a.spend).slice(0, 10),
        rawData: data,
      };
    },
  });
};

/**
 * Hook for Tab 4 (Money Map) - ROI calc using deals + facebook_ads_insights + stripe_transactions
 */
export const useMoneyMap = (dateRange: string) => {
  return useQuery({
    queryKey: ["marketing-money-map", dateRange],
    queryFn: async () => {
      const { startDate, endDate } = getDateRangeFromPreset(dateRange);

      // Fetch ad spend data
      const { data: adsData, error: adsError } = await supabase
        .from("facebook_ads_insights")
        .select("spend, leads, clicks, date, campaign_name")
        .gte("date", startDate)
        .lte("date", endDate);

      if (adsError) throw adsError;

      // Fetch closed-won deals (real revenue source — deal_value is in AED)
      const { data: dealsData, error: dealsError } = await supabase
        .from("deals")
        .select("deal_value, amount, stage, created_at")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (dealsError) throw dealsError;

      // Fetch stripe transactions (may be empty until backfill runs)
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("stripe_transactions")
        .select("amount, status, created_at")
        .eq("status", "succeeded")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (transactionsError) throw transactionsError;

      // Calculate totals
      const totalSpend = adsData.reduce((sum, row) => sum + (Number(row.spend) || 0), 0);
      const totalLeads = adsData.reduce((sum, row) => sum + (row.leads || 0), 0);

      // Closed won deals — revenue in AED (not cents)
      const wonStages = ["closedwon", "1070353735"];
      const closedDeals = dealsData.filter((d) => wonStages.includes(d.stage || ""));
      const totalDealValue = closedDeals.reduce((sum, d) => sum + (Number(d.deal_value) || Number(d.amount) || 0), 0);

      // Stripe revenue (amounts already in AED for this account)
      const totalStripeRevenue = transactionsData.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

      // Use stripe revenue if available, otherwise use deal value
      const actualRevenue = totalStripeRevenue > 0 ? totalStripeRevenue : totalDealValue;
      const totalROI = totalSpend > 0 ? actualRevenue / totalSpend : 0;
      const trueCac = totalLeads > 0 ? totalSpend / totalLeads : 0;
      const ltv = closedDeals.length > 0 ? actualRevenue / closedDeals.length : 0;
      const ltvCacRatio = trueCac > 0 ? ltv / trueCac : 0;

      // Real payback calculation: months to recoup CAC from monthly LTV
      const payback = trueCac > 0 && ltv > 0
        ? `${toFixedSafe(trueCac / (ltv / 12), 1)} mo`
        : "—";

      // Compute prior period for real deltas
      const presetToDays: Record<string, number> = {
        today: 1, yesterday: 1, this_week: 7, last_week: 14,
        this_month: 30, last_month: 60, this_quarter: 90, last_quarter: 180, this_year: 365,
      };
      const periodDays = presetToDays[dateRange] || 30;
      const priorEnd = startDate;
      const priorStartDate = new Date(startDate);
      priorStartDate.setDate(priorStartDate.getDate() - periodDays);
      const priorStart = priorStartDate.toISOString().split("T")[0];

      // Prior period ads
      const { data: priorAdsRaw } = await supabase
        .from("facebook_ads_insights")
        .select("spend, leads")
        .gte("date", priorStart)
        .lt("date", priorEnd);
      const priorTotalSpend = (priorAdsRaw || []).reduce((s, r) => s + Number(r.spend || 0), 0);
      const priorTotalLeads = (priorAdsRaw || []).reduce((s, r) => s + Number(r.leads || 0), 0);

      // Prior period deals
      const { data: priorDealsRaw } = await supabase
        .from("deals")
        .select("deal_value, amount, stage, created_at")
        .gte("created_at", priorStart)
        .lt("created_at", priorEnd);
      const priorClosedDeals = (priorDealsRaw || []).filter((d) => wonStages.includes(d.stage || ""));
      const priorDealValue = priorClosedDeals.reduce((s, d) => s + (Number(d.deal_value) || Number(d.amount) || 0), 0);

      // Prior period stripe
      const { data: priorStripeRaw } = await supabase
        .from("stripe_transactions")
        .select("amount, status, created_at")
        .eq("status", "succeeded")
        .gte("created_at", priorStart)
        .lt("created_at", priorEnd);
      const priorStripeRevenue = (priorStripeRaw || []).reduce((s, r) => s + Number(r.amount || 0), 0);

      const priorRevenue = priorStripeRevenue > 0 ? priorStripeRevenue : priorDealValue;
      const priorROI = priorTotalSpend > 0 ? priorRevenue / priorTotalSpend : 0;
      const priorCac = priorTotalLeads > 0 ? priorTotalSpend / priorTotalLeads : 0;
      const priorLtv = priorClosedDeals.length > 0 ? priorRevenue / priorClosedDeals.length : 0;
      const priorLtvCacRatio = priorCac > 0 ? priorLtv / priorCac : 0;
      const priorPaybackVal = priorCac > 0 && priorLtv > 0 ? priorCac / (priorLtv / 12) : 0;
      const currentPaybackVal = trueCac > 0 && ltv > 0 ? trueCac / (ltv / 12) : 0;

      const calcDelta = (current: number, priorVal: number) => {
        if (priorVal === 0) return { value: 0, type: "neutral" as const };
        const pct = Math.round(((current - priorVal) / priorVal) * 100);
        return { value: Math.abs(pct), type: pct >= 0 ? "positive" as const : "negative" as const };
      };

      const metrics = [
        {
          label: "Total ROI",
          value: `${toFixedSafe(totalROI, 1)}x`,
          delta: calcDelta(totalROI, priorROI),
          icon: "TrendingUp"
        },
        {
          label: "True CAC",
          value: `AED ${toFixedSafe(trueCac, 0)}`,
          delta: calcDelta(trueCac, priorCac),
          icon: "DollarSign"
        },
        {
          label: "LTV",
          value: `AED ${toFixedSafe(ltv, 0)}`,
          delta: calcDelta(ltv, priorLtv),
          icon: "DollarSign"
        },
        {
          label: "LTV:CAC",
          value: `${toFixedSafe(ltvCacRatio, 1)}:1`,
          delta: calcDelta(ltvCacRatio, priorLtvCacRatio),
          icon: "Target"
        },
        {
          label: "Payback",
          value: payback,
          delta: calcDelta(currentPaybackVal, priorPaybackVal),
          icon: "BarChart3"
        },
      ];

      // Group by campaign for ROI breakdown
      const campaignROIMap = new Map<string, {
        campaign: string;
        spend: number;
        leads: number;
        revenue: number;
      }>();

      adsData.forEach((row) => {
        const campaignName = row.campaign_name || "Unknown Campaign";
        const existing = campaignROIMap.get(campaignName);

        if (existing) {
          existing.spend += Number(row.spend) || 0;
          existing.leads += row.leads || 0;
        } else {
          campaignROIMap.set(campaignName, {
            campaign: campaignName,
            spend: Number(row.spend) || 0,
            leads: row.leads || 0,
            revenue: 0,
          });
        }
      });

      // Distribute revenue proportionally based on leads
      campaignROIMap.forEach((campaign) => {
        campaign.revenue = totalLeads > 0 ? (campaign.leads / totalLeads) * actualRevenue : 0;
      });

      const campaignROI = Array.from(campaignROIMap.values())
        .map((c) => ({
          campaign: c.campaign,
          spend: c.spend,
          revenue: c.revenue,
          roi: c.spend > 0 ? c.revenue / c.spend : 0,
          cac: c.leads > 0 ? c.spend / c.leads : 0,
          ltv: c.revenue > 0 ? c.revenue / Math.max(1, c.leads * 0.1) : 0, // Assume 10% conversion
          margin: c.revenue - c.spend,
        }))
        .sort((a, b) => b.roi - a.roi)
        .slice(0, 10);

      return {
        metrics,
        campaignROI,
        totalSpend,
        totalRevenue: actualRevenue,
        totalROI,
      };
    },
  });
};
