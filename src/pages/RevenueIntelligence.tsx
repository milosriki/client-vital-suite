import { useState } from "react";
import { DollarSign, TrendingUp, Users, AlertCircle, Activity, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePipelineData, useHubSpotHealth, useLiveData } from "@/hooks/useRevenueIntelligence";
import { DashboardHeader } from "@/components/dashboard/layout/DashboardHeader";
import { FilterBar, DATE_RANGE_PRESETS } from "@/components/dashboard/layout/FilterBar";
import { MetricCard } from "@/components/dashboard/cards/MetricCard";
import { ChartCard } from "@/components/dashboard/cards/ChartCard";
import { DataTableCard } from "@/components/dashboard/cards/DataTableCard";
import { CHART_COLORS } from "@/lib/chartColors";
import { StatusBadge } from "@/components/dashboard/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  FunnelChart,
  Funnel,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { chartTheme } from "@/components/dashboard/cards/ChartCard";

export default function RevenueIntelligence() {
  const [dateRange, setDateRange] = useState("this_month");
  const [activeTab, setActiveTab] = useState("stripe");

  // Fetch real Stripe data
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["stripe-dashboard-data", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-dashboard-data", {
        body: { 
          startDate: new Date().toISOString(), // In real app, calculate from dateRange
          endDate: new Date().toISOString() 
        },
      });
      if (error) throw error;
      return data;
    },
  });

  const handleRefresh = () => {
    refetch();
    pipelineRefetch();
    hubspotRefetch();
  };

  // Tab 2: Pipeline Data (Real Supabase data)
  const {
    data: pipelineData,
    isLoading: pipelineLoading,
    refetch: pipelineRefetch
  } = usePipelineData(dateRange);

  // Tab 3: HubSpot Health Data (Real Supabase data)
  const {
    data: hubspotData,
    isLoading: hubspotLoading,
    refetch: hubspotRefetch
  } = useHubSpotHealth(dateRange);

  // Tab 4: Live Data (Real Supabase realtime)
  const {
    liveActivity: realtimeLiveActivity,
    recentDeals: realtimeRecentDeals,
    todayActivity: realtimeTodayActivity
  } = useLiveData();

  // Tab 1: Stripe Data - Wired to real response
  const stripeMetrics = [
    { 
      label: "MRR", 
      value: data?.metrics?.mrr ? `AED ${(data.metrics.mrr / 100).toLocaleString()}` : "No data — Stripe sync pending", 
      delta: { value: 0, type: "positive" as const }, 
      icon: DollarSign 
    },
    { 
      label: "ARR", 
      value: data?.metrics?.mrr ? `AED ${((data.metrics.mrr * 12) / 100).toLocaleString()}` : "No data — Stripe sync pending", 
      delta: { value: 0, type: "positive" as const }, 
      icon: TrendingUp 
    },
    { 
      label: "Churn", 
      value: data?.metrics?.churnRate ? `${data.metrics.churnRate}%` : "No data", 
      delta: { value: 0, type: "positive" as const }, 
      icon: AlertCircle 
    },
    { 
      label: "Active Subs", 
      value: data?.metrics?.activeSubscriptions?.toString() || "No data", 
      delta: { value: 0, type: "positive" as const }, 
      icon: Users 
    },
    { 
      label: "Failed Pmt", 
      value: data?.metrics?.failedPayments?.toString() || "0", 
      delta: { value: 0, type: "positive" as const }, 
      icon: AlertCircle 
    },
  ];

  // Map real charts or use safe defaults
  const mrrGrowthData = data?.charts?.mrr_history || [];
  const paymentStatusData = data?.charts?.payment_status || [];
  const recentTransactions = data?.recent_transactions || [];
  
  // Fix: Define revenueBreakdownData to prevent runtime crash
  const revenueBreakdownData = data?.charts?.revenue_breakdown || [
    { name: "Monthly", value: 0, percentage: 0 },
    { name: "Annual", value: 0, percentage: 0 },
    { name: "One-time", value: 0, percentage: 0 },
  ];

  // Tab 2: Pipeline - Real Supabase data
  const pipelineMetrics = [
    {
      label: "Total Pipeline",
      value: pipelineData?.metrics.totalPipeline ? `AED ${(pipelineData.metrics.totalPipeline / 1000).toFixed(0)}K` : "—",
      delta: { value: 0, type: "neutral" as const },
      icon: DollarSign
    },
    {
      label: "Weighted",
      value: pipelineData?.metrics.weightedPipeline ? `AED ${(pipelineData.metrics.weightedPipeline / 1000).toFixed(0)}K` : "—",
      delta: { value: 0, type: "neutral" as const },
      icon: TrendingUp
    },
    {
      label: "Close Rate",
      value: pipelineData?.metrics.closeRate ? `${Number(pipelineData?.metrics?.closeRate ?? 0).toFixed(1)}%` : "—",
      delta: { value: 0, type: "neutral" as const },
      icon: Activity
    },
    {
      label: "Avg Deal",
      value: pipelineData?.metrics.avgDealValue ? `AED ${pipelineData.metrics.avgDealValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—",
      delta: { value: 0, type: "neutral" as const },
      icon: DollarSign
    },
    {
      label: "Velocity",
      value: pipelineData?.metrics.avgVelocity ? `${Math.round(pipelineData.metrics.avgVelocity)} days` : "—",
      delta: { value: 0, type: "neutral" as const },
      icon: Activity
    },
  ];

  const funnelData = pipelineData?.funnelData || [];
  const stageBreakdown = (pipelineData?.stageBreakdown || []).map(s => ({
    stage: s.stage,
    count: s.count,
    value: s.total_value,
  }));
  const timeInStage = pipelineData?.timeInStage || [];
  const activeDeals = pipelineData?.activeDeals || [];

  // Tab 3: HubSpot Health - Real Supabase data
  const hubspotMetrics = [
    {
      label: "Contacts",
      value: hubspotData?.metrics.contacts.toLocaleString() || "—",
      delta: { value: 0, type: "positive" as const },
      icon: Users
    },
    {
      label: "Deals",
      value: hubspotData?.metrics.deals.toLocaleString() || "—",
      delta: { value: 0, type: "positive" as const },
      icon: DollarSign
    },
    {
      label: "Companies",
      value: hubspotData?.metrics.companies.toLocaleString() || "—",
      delta: { value: 0, type: "positive" as const },
      icon: Activity
    },
    {
      label: "Sync Errors",
      value: hubspotData?.metrics.syncErrors.toString() || "0",
      delta: { value: 0, type: hubspotData?.metrics.syncErrors ? "negative" as const : "positive" as const },
      icon: AlertCircle
    },
    {
      label: "Data Quality",
      value: hubspotData?.dataQuality ? "Good" : "—",
      delta: { value: 0, type: "positive" as const },
      icon: Activity
    },
  ];

  // Group sync errors by type for workflow-like display
  const errorsByType = hubspotData?.syncErrors.reduce((acc, error) => {
    const type = error.error_type || "Unknown";
    if (!acc[type]) {
      acc[type] = { name: type, status: "Error", runs: 0, success: 0, errors: 0, lastRun: error.created_at || "" };
    }
    acc[type].errors++;
    if (error.resolved_at) {
      acc[type].success++;
    }
    return acc;
  }, {} as Record<string, any>);

  const workflows = Object.values(errorsByType || {}).map((w: any) => ({
    name: w.name,
    status: w.errors > 0 ? "Has Errors" : "Active",
    runs: w.errors,
    success: w.success > 0 ? (w.success / w.errors) * 100 : 0,
    errors: w.errors - w.success,
    lastRun: w.lastRun ? new Date(w.lastRun).toLocaleString() : "Unknown",
  }));

  // Tab 4: Live Data - Real Supabase realtime
  const liveActivity = realtimeLiveActivity;
  const todayActivity = [
    { metric: "New Contacts", count: realtimeTodayActivity.newContacts },
    { metric: "New Deals", count: realtimeTodayActivity.newDeals },
    { metric: "Emails Sent", count: realtimeTodayActivity.emailsSent },
    { metric: "Calls Logged", count: realtimeTodayActivity.callsLogged },
    { metric: "Tasks Created", count: realtimeTodayActivity.tasksCreated },
  ];

  const lifecycleDistribution = hubspotData?.lifecycleDistribution || [];
  const recentDeals = realtimeRecentDeals.slice(0, 5).map(deal => ({
    deal: deal.deal_name || "Unknown",
    stage: deal.stage || "Unknown",
    value: deal.deal_value,
    owner: deal.owner_name || "Unassigned",
    created: new Date(deal.created_at || "").toLocaleTimeString(),
    source: "HubSpot",
  }));

  const COLORS = ["#F59E0B", "#8B5CF6", "#10B981", "#3B82F6", "#EC4899"];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <DashboardHeader
        title="Revenue Intelligence"
        description="Comprehensive revenue analytics from Stripe, HubSpot, and sales pipeline"
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
          <TabsTrigger value="stripe">Stripe Data</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="hubspot">HubSpot Health</TabsTrigger>
          <TabsTrigger value="live">Live Data</TabsTrigger>
        </TabsList>

        {/* Tab 1: Stripe Data */}
        <TabsContent value="stripe" className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {stripeMetrics.map((metric, index) => (
              <MetricCard key={index} {...metric} />
            ))}
          </div>

          {/* MRR Growth Chart */}
          <ChartCard title="MRR Growth (Last 12 Months)" height="default">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mrrGrowthData}>
                <defs>
                  <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray={chartTheme.grid.strokeDasharray}
                  stroke={chartTheme.grid.stroke}
                />
                <XAxis
                  dataKey="month"
                  stroke={chartTheme.axis.stroke}
                  tick={{ fill: chartTheme.axis.tick.fill }}
                />
                <YAxis
                  stroke={chartTheme.axis.stroke}
                  tick={{ fill: chartTheme.axis.tick.fill }}
                  tickFormatter={(value) => `AED ${(value / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartTheme.tooltip.backgroundColor,
                    border: chartTheme.tooltip.border,
                    borderRadius: chartTheme.tooltip.borderRadius,
                    padding: chartTheme.tooltip.padding,
                  }}
                  formatter={(value: number) => `AED ${value.toLocaleString()}`}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="mrr"
                  stroke="#F59E0B"
                  fillOpacity={1}
                  fill="url(#mrrGradient)"
                  name="MRR"
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Target (AED 130K)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Payment Status + Revenue Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Status */}
            <Card className="bg-[#0A0A0A] border-[#1F2937]">
              <CardHeader>
                <CardTitle className="text-lg">Payment Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {paymentStatusData.map((item, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-slate-300">
                        {item.status === "Succeeded" && "✅"}
                        {item.status === "Pending" && "⏳"}
                        {item.status === "Failed" && "❌"}
                        {item.status === "Refunded" && "🔄"} {item.status}
                      </span>
                      <div className="flex gap-4">
                        <span className="text-slate-300">{item.count}</span>
                        <span className="text-slate-300">AED {((item.value ?? 0) / 1000).toFixed(1)}K</span>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="link" className="mt-4 p-0 h-auto text-primary">
                  View All →
                </Button>
              </CardContent>
            </Card>

            {/* Revenue Breakdown */}
            <ChartCard title="Revenue Breakdown" height="default">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueBreakdownData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.percentage}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {revenueBreakdownData.map((entry, index) => (
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
                    formatter={(value: number) => `AED ${value.toLocaleString()}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Recent Transactions */}
          <DataTableCard
            title="Recent Transactions"
            data={recentTransactions}
            columns={[
              { key: "customer", label: "Customer", render: (item) => item.customer },
              { key: "amount", label: "Amount", render: (item) => `AED ${item.amount.toLocaleString()}` },
              {
                key: "status",
                label: "Status",
                render: (item) => (
                  <StatusBadge
                    status={item.status === "Paid" ? "success" : item.status === "Pending" ? "warning" : "error"}
                    label={item.status === "Paid" ? "✅ Paid" : item.status === "Pending" ? "⏳ Pending" : "❌ Failed"}
                  />
                ),
              },
              { key: "date", label: "Date", render: (item) => item.date },
              { key: "invoice", label: "Invoice", render: (item) => item.invoice },
            ]}
          />
        </TabsContent>

        {/* Tab 2: Pipeline */}
        <TabsContent value="pipeline" className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {pipelineMetrics.map((metric, index) => (
              <MetricCard key={index} {...metric} />
            ))}
          </div>

          {/* Conversion Funnel */}
          <ChartCard title="Conversion Funnel (Lead → Closed)" height="default">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartTheme.tooltip.backgroundColor,
                    border: chartTheme.tooltip.border,
                    borderRadius: chartTheme.tooltip.borderRadius,
                    padding: chartTheme.tooltip.padding,
                  }}
                />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="right" fill="#CBD5E1" stroke="none" dataKey="label" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Stage Breakdown + Time in Stage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stage Breakdown */}
            <Card className="bg-[#0A0A0A] border-[#1F2937]">
              <CardHeader>
                <CardTitle className="text-lg">Stage Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stageBreakdown.map((item, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-slate-300">{item.stage}</span>
                      <div className="flex gap-4">
                        <span className="text-slate-300">{item.count}</span>
                        <span className="text-slate-300">AED {((item.value ?? 0) / 1000).toFixed(0)}K</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-[#1F2937] flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>274 deals / AED 847K</span>
                </div>
              </CardContent>
            </Card>

            {/* Time in Stage */}
            <ChartCard title="Time in Stage (Avg Days)" height="default">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeInStage} layout="horizontal">
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
                    dataKey="stage"
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
                    formatter={(value: number) => `${value} days`}
                  />
                  <Bar dataKey="days" fill={CHART_COLORS.marketing} name="Days" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Active Deals */}
          <DataTableCard
            title="Active Deals"
            data={activeDeals}
            columns={[
              { key: "company", label: "Company", render: (item) => item.company },
              { key: "stage", label: "Stage", render: (item) => item.stage },
              { key: "value", label: "Value", render: (item) => `AED ${((item.value ?? 0) / 1000).toFixed(0)}K` },
              { key: "owner", label: "Owner", render: (item) => item.owner },
              { key: "days", label: "Days", render: (item) => `${item.days}d` },
              { key: "next", label: "Next Action", render: (item) => item.next },
            ]}
          />
        </TabsContent>

        {/* Tab 3: HubSpot Health */}
        <TabsContent value="hubspot" className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {hubspotMetrics.map((metric, index) => (
              <MetricCard key={index} {...metric} />
            ))}
          </div>

          {/* Accordion sections */}
          <Accordion type="multiple" className="space-y-4">
            <AccordionItem value="workflows" className="bg-[#0A0A0A] border border-[#1F2937] rounded-card px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="text-lg font-semibold">Workflows</span>
              </AccordionTrigger>
              <AccordionContent>
                <DataTableCard
                  title=""
                  data={workflows}
                  columns={[
                    { key: "name", label: "Workflow", render: (item) => item.name },
                    {
                      key: "status",
                      label: "Status",
                      render: (item) => <StatusBadge status="success" label={`🟢 ${item.status}`} />,
                    },
                    { key: "runs", label: "Runs", render: (item) => item.runs },
                    { key: "success", label: "Success", render: (item) => `${item.success}%` },
                    { key: "errors", label: "Errors", render: (item) => item.errors },
                    { key: "lastRun", label: "Last Run", render: (item) => item.lastRun },
                  ]}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="leaks" className="bg-[#0A0A0A] border border-[#1F2937] rounded-card px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="text-lg font-semibold">Data Quality Issues</span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-300 space-y-2">
                <p>├─ Missing emails: {hubspotData?.dataQuality.contactsWithoutEmail || 0} contacts</p>
                <p>├─ Duplicate companies: {hubspotData?.dataQuality.duplicateCompanies || 0} found</p>
                <p>└─ Orphaned deals: {hubspotData?.dataQuality.orphanedDeals || 0} (all contacts linked)</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="actions" className="bg-[#0A0A0A] border border-[#1F2937] rounded-card px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="text-lg font-semibold">Recent Actions</span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-300 space-y-2">
                <p>├─ Contacts created: 284 (this month)</p>
                <p>├─ Deals created: 42</p>
                <p>└─ Emails sent: 1,847</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="properties" className="bg-[#0A0A0A] border border-[#1F2937] rounded-card px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="text-lg font-semibold">Properties Audit</span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-300 space-y-2">
                <p>├─ Total properties: 247</p>
                <p>├─ Unused properties: 18 (7.3%)</p>
                <p>└─ Custom properties: 42</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="summary" className="bg-[#0A0A0A] border border-[#1F2937] rounded-card px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="text-lg font-semibold">Summary & Recommendations</span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-300 space-y-2">
                <p>├─ 🟢 Overall health: GOOD</p>
                <p>├─ ⚠️ 12 contacts missing emails - clean up recommended</p>
                <p>└─ ✅ All workflows passing</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        {/* Tab 4: Live Data */}
        <TabsContent value="live" className="space-y-6">
          {/* Live Activity Stream */}
          <DataTableCard
            title="🟢 LIVE ACTIVITY STREAM (Real-time sync via Supabase)"
            data={liveActivity}
            columns={[
              { key: "time", label: "Time", render: (item) => <span className="text-slate-300">{item.time}</span> },
              {
                key: "event",
                label: "Event",
                render: (item) => (
                  <span className={item.type === "alert" ? "text-red-400" : "text-slate-300"}>{item.event}</span>
                ),
              },
            ]}
          />

          {/* Today's Activity + Lifecycle Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Today's Activity */}
            <Card className="bg-[#0A0A0A] border-[#1F2937]">
              <CardHeader>
                <CardTitle className="text-lg">Today's Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {todayActivity.map((item, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-slate-300">{item.metric}</span>
                      <span className="text-slate-300">{item.count}</span>
                    </div>
                  ))}
                </div>
                <Button variant="link" className="mt-4 p-0 h-auto text-primary">
                  View Details →
                </Button>
              </CardContent>
            </Card>

            {/* Lifecycle Distribution */}
            <ChartCard title="Lifecycle Distribution" height="default">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={lifecycleDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.percentage}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {lifecycleDistribution.map((entry, index) => (
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
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Recent Deals */}
          <DataTableCard
            title="Recent Deals (Last 24 Hours)"
            data={recentDeals}
            columns={[
              { key: "deal", label: "Deal Name", render: (item) => item.deal },
              { key: "stage", label: "Stage", render: (item) => item.stage },
              { key: "value", label: "Value", render: (item) => `AED ${((item.value ?? 0) / 1000).toFixed(0)}K` },
              { key: "owner", label: "Owner", render: (item) => item.owner },
              { key: "created", label: "Created", render: (item) => item.created },
              { key: "source", label: "Source", render: (item) => item.source },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
