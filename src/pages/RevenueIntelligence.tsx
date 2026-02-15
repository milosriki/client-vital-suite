import { useState } from "react";
import { DollarSign, TrendingUp, Users, AlertCircle, Activity, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/dashboard/layout/DashboardHeader";
import { FilterBar, DATE_RANGE_PRESETS } from "@/components/dashboard/layout/FilterBar";
import { MetricCard } from "@/components/dashboard/cards/MetricCard";
import { ChartCard } from "@/components/dashboard/cards/ChartCard";
import { DataTableCard } from "@/components/dashboard/cards/DataTableCard";
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
  };

  // Tab 1: Stripe Data - Wired to real response
  const stripeMetrics = [
    { 
      label: "MRR", 
      value: data?.metrics?.mrr ? `$${(data.metrics.mrr / 100).toLocaleString()}` : "—", 
      delta: { value: 0, type: "positive" as const }, 
      icon: DollarSign 
    },
    { 
      label: "ARR", 
      value: data?.metrics?.mrr ? `$${((data.metrics.mrr * 12) / 100).toLocaleString()}` : "—", 
      delta: { value: 0, type: "positive" as const }, 
      icon: TrendingUp 
    },
    { 
      label: "Churn", 
      value: data?.metrics?.churnRate ? `${data.metrics.churnRate}%` : "—", 
      delta: { value: 0, type: "positive" as const }, 
      icon: AlertCircle 
    },
    { 
      label: "Active Subs", 
      value: data?.metrics?.activeSubscriptions?.toString() || "—", 
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

  // Tab 2: Pipeline - Mock data preserved (not covered by stripe-dashboard-data)
  const pipelineMetrics = [
    { label: "Total Pipeline", value: "$847K", delta: { value: 42, type: "neutral" as const }, icon: DollarSign },
    { label: "Weighted", value: "$324K", delta: { value: 0, type: "neutral" as const }, icon: TrendingUp },
    { label: "Close Rate", value: "28.6%", delta: { value: 0, type: "neutral" as const }, icon: Activity },
    { label: "Avg Deal", value: "$18,450", delta: { value: 0, type: "neutral" as const }, icon: DollarSign },
    { label: "Velocity", value: "24 days", delta: { value: 0, type: "neutral" as const }, icon: Activity },
  ];

  const funnelData = [
    { name: "Lead", value: 847, label: "847 (100%)" },
    { name: "Qualified", value: 284, label: "284 (33.5%)" },
    { name: "Demo", value: 124, label: "124 (14.6%)" },
    { name: "Proposal", value: 42, label: "42 (5.0%)" },
    { name: "Closed Won", value: 12, label: "12 (1.4%)" },
  ];

  const stageBreakdown = [
    { stage: "Lead", count: 124, value: 248000 },
    { stage: "Qualified", count: 68, value: 204000 },
    { stage: "Demo", count: 42, value: 189000 },
    { stage: "Proposal", count: 28, value: 154000 },
    { stage: "Closed Won", count: 12, value: 52000 },
  ];

  const timeInStage = [
    { stage: "Lead", days: 5 },
    { stage: "Qualified", days: 8 },
    { stage: "Demo", days: 12 },
    { stage: "Proposal", days: 18 },
    { stage: "Closed", days: 24 },
  ];

  const activeDeals = [
    { company: "Acme Corp", stage: "Proposal", value: 25000, owner: "Mike", days: 42, next: "🔴 Follow-up" },
    { company: "Global Tech", stage: "Demo", value: 18000, owner: "Sarah", days: 12, next: "✅ Send deck" },
    { company: "Startup Inc", stage: "Qualified", value: 12000, owner: "Alex", days: 8, next: "✅ Schedule call" },
    { company: "Enterprise Co", stage: "Proposal", value: 45000, owner: "Mike", days: 18, next: "🟡 Contract" },
    { company: "Small Biz LLC", stage: "Demo", value: 8000, owner: "Sarah", days: 5, next: "✅ Quote ready" },
  ];

  // Tab 3: HubSpot Health - Mock data
  const hubspotMetrics = [
    { label: "Contacts", value: "12,847", delta: { value: 284, type: "positive" as const }, icon: Users },
    { label: "Deals", value: "847", delta: { value: 42, type: "positive" as const }, icon: DollarSign },
    { label: "Companies", value: "3,245", delta: { value: 18, type: "positive" as const }, icon: Activity },
    { label: "Tasks Open", value: "142", delta: { value: 8, type: "positive" as const }, icon: AlertCircle },
    { label: "Workflows", value: "12 active", delta: { value: 0, type: "positive" as const }, icon: Activity },
  ];

  const workflows = [
    { name: "Lead Nurture", status: "Active", runs: 1247, success: 99.2, errors: 10, lastRun: "2h ago" },
    { name: "Deal Stage Notif", status: "Active", runs: 847, success: 100, errors: 0, lastRun: "5m ago" },
    { name: "Client Onboarding", status: "Active", runs: 42, success: 97.6, errors: 1, lastRun: "1d ago" },
  ];

  // Tab 4: Live Data - Mock data
  const liveActivity = [
    { time: "12s ago", event: "New contact: Sarah Wilson (FB Ad: Summer Sale 2026)", type: "contact" },
    { time: "45s ago", event: 'Deal "Enterprise Co" moved to Closed Won ($45,000)', type: "deal" },
    { time: "1m ago", event: "Contact \"Mike Johnson\" lifecycle: Lead → MQL", type: "lifecycle" },
    { time: "2m ago", event: 'Deal "Global Tech" stuck in Demo for 32 days (alert)', type: "alert" },
    { time: "3m ago", event: "New contact: Alex Chen (Organic Search)", type: "contact" },
    { time: "5m ago", event: 'Deal "Acme Corp" value updated: $20K → $25K', type: "deal" },
    { time: "8m ago", event: 'Contact "Jane Smith" opened email "Summer Sale Promo"', type: "email" },
    { time: "12m ago", event: "New contact: David Lee (Google Ads)", type: "contact" },
  ];

  const todayActivity = [
    { metric: "New Contacts", count: 42 },
    { metric: "New Deals", count: 8 },
    { metric: "Emails Sent", count: 284 },
    { metric: "Calls Logged", count: 124 },
    { metric: "Tasks Created", count: 68 },
  ];

  const lifecycleDistribution = [
    { name: "Subscriber", value: 2847, percentage: 22 },
    { name: "Lead", value: 4124, percentage: 32 },
    { name: "MQL", value: 3245, percentage: 25 },
    { name: "SQL", value: 1847, percentage: 14 },
    { name: "Customer", value: 784, percentage: 6 },
  ];

  const recentDeals = [
    { deal: "Enterprise Co", stage: "Proposal", value: 45000, owner: "Mike", created: "2h ago", source: "FB Ads" },
    { deal: "Tech Startup", stage: "Demo", value: 18000, owner: "Sarah", created: "5h ago", source: "Organic" },
    { deal: "Small Business", stage: "Qualified", value: 12000, owner: "Alex", created: "8h ago", source: "LinkedIn" },
    { deal: "Global Corp", stage: "Lead", value: 28000, owner: "Mike", created: "12h ago", source: "Referral" },
    { deal: "Local Store", stage: "Qualified", value: 8000, owner: "Sarah", created: "18h ago", source: "Google" },
  ];

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
                  name="Target ($130K)"
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
                        <span className="text-slate-400">{item.count}</span>
                        <span className="text-slate-400">${(item.value / 1000).toFixed(1)}K</span>
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
                    formatter={(value: number) => `$${value.toLocaleString()}`}
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
              { key: "amount", label: "Amount", render: (item) => `$${item.amount.toLocaleString()}` },
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
                        <span className="text-slate-400">{item.count}</span>
                        <span className="text-slate-400">${(item.value / 1000).toFixed(0)}K</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-[#1F2937] flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>274 deals / $847K</span>
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
                  <Bar dataKey="days" fill="#8B5CF6" name="Days" />
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
              { key: "value", label: "Value", render: (item) => `$${(item.value / 1000).toFixed(0)}K` },
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
                <span className="text-lg font-semibold">Data Leaks</span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-400 space-y-2">
                <p>├─ Missing emails: 12 contacts (0.09%)</p>
                <p>├─ Duplicate companies: 3 found</p>
                <p>└─ Orphaned deals: 0 (all contacts linked)</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="actions" className="bg-[#0A0A0A] border border-[#1F2937] rounded-card px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="text-lg font-semibold">Recent Actions</span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-400 space-y-2">
                <p>├─ Contacts created: 284 (this month)</p>
                <p>├─ Deals created: 42</p>
                <p>└─ Emails sent: 1,847</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="properties" className="bg-[#0A0A0A] border border-[#1F2937] rounded-card px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="text-lg font-semibold">Properties Audit</span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-400 space-y-2">
                <p>├─ Total properties: 247</p>
                <p>├─ Unused properties: 18 (7.3%)</p>
                <p>└─ Custom properties: 42</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="summary" className="bg-[#0A0A0A] border border-[#1F2937] rounded-card px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="text-lg font-semibold">Summary & Recommendations</span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-400 space-y-2">
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
              { key: "time", label: "Time", render: (item) => <span className="text-slate-400">{item.time}</span> },
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
                      <span className="text-slate-400">{item.count}</span>
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
              { key: "value", label: "Value", render: (item) => `$${(item.value / 1000).toFixed(0)}K` },
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
