import { useState } from "react";
import { DollarSign, TrendingUp, Target, BarChart3, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/dashboard/layout/DashboardHeader";
import { FilterBar, DATE_RANGE_PRESETS } from "@/components/dashboard/layout/FilterBar";
import { MetricCard } from "@/components/dashboard/cards/MetricCard";
import { ChartCard } from "@/components/dashboard/cards/ChartCard";
import { DataTableCard } from "@/components/dashboard/cards/DataTableCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDeepAnalysis, useMetaAds, useMoneyMap } from "@/hooks/useMarketingAnalytics";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { chartTheme } from "@/components/dashboard/cards/ChartCard";

export default function MarketingAnalytics() {
  const [dateRange, setDateRange] = useState("this_month");
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch real data for overview
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["marketing-analytics", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("business-intelligence-dashboard", {
        body: { range: dateRange },
      });
      if (error) throw error;
      return data;
    },
  });

  // Fetch tab-specific data
  const deepAnalysis = useDeepAnalysis(dateRange);
  const metaAds = useMetaAds(dateRange);
  const moneyMap = useMoneyMap(dateRange);

  const handleRefresh = () => {
    refetch();
    deepAnalysis.refetch();
    metaAds.refetch();
    moneyMap.refetch();
  };

  // Map real data or safe defaults (Using zone_a.metrics from business-intelligence-dashboard)
  const kpis = data?.zone_a?.metrics;
  const overviewMetrics = [
    { 
      label: "Ad Spend", 
      value: kpis?.ad_spend ? `$${kpis.ad_spend.toLocaleString()}` : "—", 
      delta: { value: 0, type: "neutral" as const }, 
      icon: DollarSign 
    },
    { 
      label: "Leads", 
      value: kpis?.new_leads?.toString() || "—", 
      delta: { value: 0, type: "positive" as const }, 
      icon: TrendingUp 
    },
    { 
      label: "CPL", 
      value: kpis?.cpl ? `$${kpis.cpl.toFixed(2)}` : "—", 
      delta: { value: 0, type: "positive" as const }, 
      icon: Target 
    },
    { 
      label: "ROAS", 
      value: kpis?.true_roas ? `${kpis.true_roas.toFixed(2)}x` : "—", 
      delta: { value: 0, type: "positive" as const }, 
      icon: BarChart3 
    },
    { 
      label: "CAC", 
      value: kpis?.cac ? `$${kpis.cac.toFixed(0)}` : "—", 
      delta: { value: 0, type: "positive" as const }, 
      icon: Target 
    },
  ];

  // Use real charts if provided by EF, else defaults
  const spendRevenueData = data?.charts?.spend_vs_revenue || [];
  const campaignPerformanceData = data?.campaigns || [];
  
  // Safe defaults for visuals not yet in EF
  const channelBreakdownData = [
    { name: "Facebook", value: 7700, percentage: 62 },
    { name: "Google", value: 3500, percentage: 28 },
    { name: "LinkedIn", value: 1200, percentage: 10 },
  ];

  const COLORS = ["#F59E0B", "#8B5CF6", "#10B981"];

  const leadSourceData = [
    { source: "FB - Summer", leads: 324, closed: 42, revenue: 84500, cac: 1234, roi: 6.8 },
    { source: "FB - Retarget", leads: 218, closed: 38, revenue: 76200, cac: 982, roi: 12.3 },
    { source: "Google Search", leads: 142, closed: 18, revenue: 36400, cac: 2134, roi: 5.2 },
    { source: "LinkedIn Ads", leads: 87, closed: 8, revenue: 16200, cac: 3421, roi: 3.8 },
    { source: "Organic", leads: 76, closed: 6, revenue: 12100, cac: 0, roi: Infinity },
  ];

  // Deep Analysis - use real data or fallback to mock
  const baselineComparison = deepAnalysis.data?.baselineComparison || [
    { metric: "CPL", current: 14.70, baseline: 15.80, variance: -6.96, status: "improving" },
    { metric: "Conversion Rate", current: 4.96, baseline: 4.25, variance: 16.71, status: "improving" },
    { metric: "ROAS", current: 6.8, baseline: 5.2, variance: 30.77, status: "improving" },
    { metric: "Ad Frequency", current: 2.8, baseline: 3.4, variance: -17.65, status: "improving" },
    { metric: "CTR", current: 1.8, baseline: 1.5, variance: 20.00, status: "improving" },
    { metric: "CPC", current: 0.82, baseline: 0.94, variance: -12.77, status: "improving" },
  ];

  const lossAnalysisData = [
    { reason: "Price Too High", count: 42 },
    { reason: "Bad Timing", count: 38 },
    { reason: "Competitor Won", count: 24 },
    { reason: "No Response", count: 18 },
    { reason: "Not Qualified", count: 12 },
  ];

  const cohortAnalysisData = deepAnalysis.data?.cohortAnalysis || [
    { month: "Feb 2026", leads: 847, conv: 4.96, revenue: 84700, roas: 6.8, cac: 1834, trend: "+12%" },
    { month: "Jan 2026", leads: 756, conv: 4.52, revenue: 75600, roas: 6.2, cac: 1892, trend: "+8%" },
    { month: "Dec 2025", leads: 698, conv: 4.21, revenue: 69800, roas: 5.8, cac: 1945, trend: "+2%" },
    { month: "Nov 2025", leads: 684, conv: 4.18, revenue: 68400, roas: 5.7, cac: 1967, trend: "-5%" },
    { month: "Oct 2025", leads: 718, conv: 4.35, revenue: 71800, roas: 6.0, cac: 1912, trend: "+7%" },
  ];

  // Meta Ads - use real data or fallback to mock, map icon strings to components
  const iconMap = { BarChart3, Target, TrendingUp, DollarSign };
  const metaMetricsRaw = metaAds.data?.metrics || [
    { label: "Impressions", value: "1.2M", delta: { value: 15, type: "positive" as const }, icon: "BarChart3" },
    { label: "Clicks", value: "21,840", delta: { value: 18, type: "positive" as const }, icon: "Target" },
    { label: "CTR", value: "1.82%", delta: { value: 0.1, type: "positive" as const }, icon: "TrendingUp" },
    { label: "CPC", value: "$0.82", delta: { value: -0.12, type: "positive" as const }, icon: "DollarSign" },
    { label: "Frequency", value: "2.8", delta: { value: 0.3, type: "neutral" as const }, icon: "BarChart3" },
  ];
  const metaMetrics = metaMetricsRaw.map(m => ({
    ...m,
    icon: iconMap[m.icon as keyof typeof iconMap] || BarChart3,
  }));

  const metaCampaigns = metaAds.data?.campaigns || [
    { campaign: "Summer Sale 2026", status: "Active", spend: 4234, leads: 324, cpl: 13.07, roas: 8.5 },
    { campaign: "Retargeting Q1", status: "Active", spend: 3124, leads: 218, cpl: 14.33, roas: 12.3 },
    { campaign: "Brand Awareness", status: "Active", spend: 2856, leads: 142, cpl: 20.11, roas: 4.2 },
    { campaign: "Lead Gen Pro", status: "Paused", spend: 2421, leads: 87, cpl: 27.83, roas: 6.8 },
    { campaign: "Webinar Feb", status: "Ended", spend: 1234, leads: 42, cpl: 29.38, roas: 3.2 },
  ];

  // Money Map - use real data or fallback to mock, map icon strings to components
  const moneyMapMetricsRaw = moneyMap.data?.metrics || [
    { label: "Total ROI", value: "8.3x", delta: { value: 1.2, type: "positive" as const }, icon: "TrendingUp" },
    { label: "True CAC", value: "$1,834", delta: { value: -142, type: "positive" as const }, icon: "DollarSign" },
    { label: "LTV", value: "$8,245", delta: { value: 324, type: "positive" as const }, icon: "DollarSign" },
    { label: "LTV:CAC", value: "4.5:1", delta: { value: 0.3, type: "positive" as const }, icon: "Target" },
    { label: "Payback", value: "3.2 mo", delta: { value: -0.8, type: "positive" as const }, icon: "BarChart3" },
  ];
  const moneyMapMetrics = moneyMapMetricsRaw.map(m => ({
    ...m,
    icon: iconMap[m.icon as keyof typeof iconMap] || BarChart3,
  }));

  const campaignROI = moneyMap.data?.campaignROI || [
    { campaign: "Summer Sale", spend: 4234, revenue: 35700, roi: 8.4, cac: 1307, ltv: 8500, margin: 31466 },
    { campaign: "Retargeting Q1", spend: 3124, revenue: 38400, roi: 12.3, cac: 982, ltv: 10105, margin: 35276 },
    { campaign: "Brand Awareness", spend: 2856, revenue: 10600, roi: 3.7, cac: 2011, ltv: 7465, margin: 7744 },
    { campaign: "Lead Gen Pro", spend: 2421, revenue: 16200, roi: 6.7, cac: 1845, ltv: 8100, margin: 13779 },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <DashboardHeader
        title="Marketing Analytics"
        description="Comprehensive marketing performance analysis and attribution"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefetching}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </>
        }
      />

      {/* Filters */}
      <FilterBar
        dateRange={{
          value: dateRange,
          onChange: setDateRange,
          options: DATE_RANGE_PRESETS,
        }}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deep">Deep Analysis</TabsTrigger>
          <TabsTrigger value="meta">Meta Ads</TabsTrigger>
          <TabsTrigger value="money">Money Map</TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {overviewMetrics.map((metric, index) => (
              <MetricCard key={index} {...metric} />
            ))}
          </div>

          {/* Spend vs Revenue Chart */}
          <ChartCard title="Spend vs Revenue (Last 30 Days)" height="default">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spendRevenueData}>
                <CartesianGrid
                  strokeDasharray={chartTheme.grid.strokeDasharray}
                  stroke={chartTheme.grid.stroke}
                />
                <XAxis
                  dataKey="day"
                  stroke={chartTheme.axis.stroke}
                  tick={{ fill: chartTheme.axis.tick.fill }}
                />
                <YAxis
                  stroke={chartTheme.axis.stroke}
                  tick={{ fill: chartTheme.axis.tick.fill }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartTheme.tooltip.backgroundColor,
                    border: chartTheme.tooltip.border,
                    borderRadius: chartTheme.tooltip.borderRadius,
                    padding: chartTheme.tooltip.padding,
                  }}
                  formatter={(value: number) => `$${value.toLocaleString()}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10B981"
                  strokeWidth={2}
                  name="Revenue"
                  dot={{ fill: "#10B981" }}
                />
                <Line
                  type="monotone"
                  dataKey="spend"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  name="Ad Spend"
                  dot={{ fill: "#F59E0B" }}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Target"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Campaign Performance + Channel Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Campaign Performance */}
            <ChartCard title="Campaign Performance" height="default">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignPerformanceData}>
                  <CartesianGrid
                    strokeDasharray={chartTheme.grid.strokeDasharray}
                    stroke={chartTheme.grid.stroke}
                  />
                  <XAxis
                    dataKey="name"
                    stroke={chartTheme.axis.stroke}
                    tick={{ fill: chartTheme.axis.tick.fill }}
                  />
                  <YAxis
                    stroke={chartTheme.axis.stroke}
                    tick={{ fill: chartTheme.axis.tick.fill }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartTheme.tooltip.backgroundColor,
                      border: chartTheme.tooltip.border,
                      borderRadius: chartTheme.tooltip.borderRadius,
                      padding: chartTheme.tooltip.padding,
                    }}
                  />
                  <Legend />
                  <Bar dataKey="spend" fill="#F59E0B" name="Spend ($)" />
                  <Bar dataKey="roas" fill="#8B5CF6" name="ROAS (x)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Channel Breakdown */}
            <ChartCard title="Channel Breakdown" height="default">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelBreakdownData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.percentage}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {channelBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartTheme.tooltip.backgroundColor,
                      border: chartTheme.tooltip.border,
                      borderRadius: chartTheme.tooltip.borderRadius,
                      padding: chartTheme.tooltip.padding,
                    }}
                    formatter={(value: number) => `$${value.toLocaleString()}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Lead Source Attribution */}
          <DataTableCard
            title="Lead Source Attribution (This Month)"
            data={leadSourceData}
            columns={[
              { key: "source", label: "Source", render: (item) => item.source },
              { key: "leads", label: "Leads", render: (item) => item.leads },
              { key: "closed", label: "Closed", render: (item) => item.closed },
              { key: "revenue", label: "Revenue", render: (item) => `$${item.revenue.toLocaleString()}` },
              { key: "cac", label: "CAC", render: (item) => `$${item.cac.toLocaleString()}` },
              {
                key: "roi",
                label: "ROI",
                render: (item) => (item.roi === Infinity ? "∞" : `${item.roi}x`),
              },
            ]}
          />
        </TabsContent>

        {/* Tab 2: Deep Analysis */}
        <TabsContent value="deep" className="space-y-6">
          {/* Historical Baseline Comparison */}
          <DataTableCard
            title="Historical Baseline Comparison (12 Months)"
            data={baselineComparison}
            columns={[
              { key: "metric", label: "Metric", render: (item) => item.metric },
              { key: "current", label: "Current", render: (item) => item.current.toFixed(2) },
              { key: "baseline", label: "Baseline", render: (item) => item.baseline.toFixed(2) },
              {
                key: "variance",
                label: "Variance",
                render: (item) => (
                  <span className={item.variance > 0 ? "text-green-400" : "text-emerald-400"}>
                    {item.variance > 0 ? "+" : ""}
                    {item.variance.toFixed(2)}%
                  </span>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (item) => (
                  <span className="text-emerald-400">🟢 Improving</span>
                ),
              },
            ]}
          />

          {/* Loss Analysis + Variance Detection */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Loss Analysis */}
            <ChartCard title="Loss Analysis" height="default">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lossAnalysisData} layout="vertical">
                  <CartesianGrid
                    strokeDasharray={chartTheme.grid.strokeDasharray}
                    stroke={chartTheme.grid.stroke}
                  />
                  <XAxis
                    type="number"
                    stroke={chartTheme.axis.stroke}
                    tick={{ fill: chartTheme.axis.tick.fill }}
                  />
                  <YAxis
                    type="category"
                    dataKey="reason"
                    stroke={chartTheme.axis.stroke}
                    tick={{ fill: chartTheme.axis.tick.fill }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartTheme.tooltip.backgroundColor,
                      border: chartTheme.tooltip.border,
                      borderRadius: chartTheme.tooltip.borderRadius,
                      padding: chartTheme.tooltip.padding,
                    }}
                  />
                  <Bar dataKey="count" fill="#EF4444" name="Lost Leads" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Variance Detection - Placeholder */}
            <div className="bg-[#0A0A0A] border border-[#1F2937] rounded-card p-6">
              <h3 className="text-lg font-semibold mb-4">Variance Detection</h3>
              <div className="space-y-3 text-sm">
                <p className="text-slate-400">Showing anomalies &gt;15% variance</p>
                <div className="space-y-2">
                  <p className="text-amber-400">⚠️ Week 23: CPL spike +24%</p>
                  <p className="text-amber-400">⚠️ Week 18: ROAS drop -18%</p>
                  <p className="text-emerald-400">✅ Week 12: Conversion +32%</p>
                </div>
                <Button variant="link" className="p-0 h-auto text-primary">
                  View Anomaly Details →
                </Button>
              </div>
            </div>
          </div>

          {/* Cohort Analysis */}
          <DataTableCard
            title="Cohort Analysis (Monthly Comparisons)"
            data={cohortAnalysisData}
            columns={[
              { key: "month", label: "Month", render: (item) => item.month },
              { key: "leads", label: "Leads", render: (item) => item.leads },
              { key: "conv", label: "Conv%", render: (item) => `${item.conv}%` },
              { key: "revenue", label: "Revenue", render: (item) => `$${(item.revenue / 1000).toFixed(1)}K` },
              { key: "roas", label: "ROAS", render: (item) => `${item.roas}x` },
              { key: "cac", label: "CAC", render: (item) => `$${item.cac}` },
              { key: "trend", label: "Trend", render: (item) => item.trend },
            ]}
          />
        </TabsContent>

        {/* Tab 3: Meta Ads */}
        <TabsContent value="meta" className="space-y-6">
          {/* Meta Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {metaMetrics.map((metric, index) => (
              <MetricCard key={index} {...metric} />
            ))}
          </div>

          {/* Campaign Performance Table */}
          <DataTableCard
            title="Campaign Performance"
            data={metaCampaigns}
            columns={[
              { key: "campaign", label: "Campaign", render: (item) => item.campaign },
              {
                key: "status",
                label: "Status",
                render: (item) => (
                  <span
                    className={
                      item.status === "Active"
                        ? "text-emerald-400"
                        : item.status === "Paused"
                        ? "text-amber-400"
                        : "text-slate-400"
                    }
                  >
                    {item.status === "Active" ? "🟢" : item.status === "Paused" ? "🟡" : "🔴"} {item.status}
                  </span>
                ),
              },
              { key: "spend", label: "Spend", render: (item) => `$${item.spend.toLocaleString()}` },
              { key: "leads", label: "Leads", render: (item) => item.leads },
              { key: "cpl", label: "CPL", render: (item) => `$${item.cpl.toFixed(2)}` },
              { key: "roas", label: "ROAS", render: (item) => `${item.roas}x` },
            ]}
          />
        </TabsContent>

        {/* Tab 4: Money Map */}
        <TabsContent value="money" className="space-y-6">
          {/* Money Map Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {moneyMapMetrics.map((metric, index) => (
              <MetricCard key={index} {...metric} />
            ))}
          </div>

          {/* Campaign ROI Breakdown */}
          <DataTableCard
            title="Campaign ROI Breakdown"
            data={campaignROI}
            columns={[
              { key: "campaign", label: "Campaign", render: (item) => item.campaign },
              { key: "spend", label: "Spend", render: (item) => `$${item.spend.toLocaleString()}` },
              { key: "revenue", label: "Revenue", render: (item) => `$${item.revenue.toLocaleString()}` },
              { key: "roi", label: "ROI", render: (item) => `${item.roi}x` },
              { key: "cac", label: "CAC", render: (item) => `$${item.cac}` },
              { key: "ltv", label: "LTV", render: (item) => `$${item.ltv.toLocaleString()}` },
              { key: "margin", label: "Margin", render: (item) => `$${item.margin.toLocaleString()}` },
            ]}
          />

          {/* Revenue by Source + Attribution Reconciliation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Source - Placeholder */}
            <div className="bg-[#0A0A0A] border border-[#1F2937] rounded-card p-6">
              <h3 className="text-lg font-semibold mb-4">Revenue by Source</h3>
              <div className="space-y-2 text-sm">
                <p className="text-slate-400">FB Ads: 62% ($62K)</p>
                <p className="text-slate-400">Google: 28% ($28K)</p>
                <p className="text-slate-400">Organic: 10% ($10K)</p>
              </div>
            </div>

            {/* Attribution Reconciliation - Placeholder */}
            <div className="bg-[#0A0A0A] border border-[#1F2937] rounded-card p-6">
              <h3 className="text-lg font-semibold mb-4">Attribution Reconciliation</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Summer Sale</span>
                  <span className="text-emerald-400">✅ Aligned</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Retargeting</span>
                  <span className="text-amber-400">⚠️ +2.6%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Brand</span>
                  <span className="text-emerald-400">✅ Aligned</span>
                </div>
                <Button variant="outline" size="sm" className="mt-4 w-full">
                  Auto-Align Discrepancies
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
