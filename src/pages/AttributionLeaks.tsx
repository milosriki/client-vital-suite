import { useState } from "react";
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/layout/DashboardHeader";
import { FilterBar, DATE_RANGE_PRESETS } from "@/components/dashboard/layout/FilterBar";
import { MetricCard } from "@/components/dashboard/cards/MetricCard";
import { ChartCard } from "@/components/dashboard/cards/ChartCard";
import { DataTableCard } from "@/components/dashboard/cards/DataTableCard";
import { StatusBadge } from "@/components/dashboard/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { chartTheme } from "@/components/dashboard/cards/ChartCard";

export default function AttributionLeaks() {
  const [dateRange, setDateRange] = useState("this_month");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("attribution");

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // TODO: Call edge functions to refresh data
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Tab 1: Attribution - Mock data
  const attributionMetrics = [
    { label: "FB Ads Revenue", value: "$84.7K", delta: { value: 0, type: "neutral" as const }, icon: DollarSign },
    { label: "HubSpot Revenue", value: "$87.2K", delta: { value: 0, type: "neutral" as const }, icon: DollarSign },
    { label: "AnyTrack Revenue", value: "$85.1K", delta: { value: 0, type: "neutral" as const }, icon: DollarSign },
    { label: "Conflicts", value: "3", delta: { value: 0, type: "warning" as const }, icon: AlertTriangle },
    { label: "True ROAS", value: "6.8x", delta: { value: 0, type: "positive" as const }, icon: TrendingUp },
  ];

  const reconciliationMatrix = [
    { campaign: "Summer Sale", fbAds: 35700, hubspot: 36200, anytrack: 35900, deltaMax: 1.4, status: "aligned" },
    { campaign: "Retargeting Q1", fbAds: 38400, hubspot: 39800, anytrack: 38700, deltaMax: 3.5, status: "check" },
    { campaign: "Brand Awareness", fbAds: 10600, hubspot: 11200, anytrack: 10500, deltaMax: 6.2, status: "conflict" },
  ];

  const revenueBySource = [
    { source: "Summer Sale", fb: 35700, hs: 36200, at: 35900 },
    { source: "Retargeting Q1", fb: 38400, hs: 39800, at: 38700 },
    { source: "Brand Awareness", fb: 10600, hs: 11200, at: 10500 },
  ];

  const attributionEvents = [
    { event: "fb_ad_click", source: "FB Ads", value: "-", contact: "Sarah Wilson", time: "2h ago", status: "success" },
    { event: "lead_created", source: "HubSpot", value: "-", contact: "Sarah Wilson", time: "2h ago", status: "success" },
    { event: "deal_created", source: "HubSpot", value: "$18K", contact: "Sarah Wilson", time: "2h ago", status: "success" },
    { event: "payment_recv", source: "AnyTrack", value: "$18K", contact: "Sarah Wilson", time: "2h ago", status: "success" },
    { event: "stripe_success", source: "Stripe", value: "$18K", contact: "Sarah Wilson", time: "2h ago", status: "success" },
  ];

  // Tab 2: Leak Detector - Mock data
  const leakMetrics = [
    { label: "Supabase", value: "12,847", delta: { value: 0, type: "neutral" as const }, icon: DollarSign },
    { label: "AWS RDS", value: "12,851", delta: { value: 0, type: "neutral" as const }, icon: DollarSign },
    { label: "Discrepancies", value: "4", delta: { value: 0, type: "warning" as const }, icon: AlertTriangle },
    { label: "Auto-Fixed", value: "2", delta: { value: 2, type: "positive" as const }, icon: CheckCircle },
    { label: "Accuracy", value: "99.97%", delta: { value: 0, type: "positive" as const }, icon: TrendingUp },
  ];

  const discrepancies = [
    { recordId: "C-12847", field: "email", supabase: "s@w.com", awsRds: "sarah@...", delta: "diff", autoFix: "manual" },
    { recordId: "C-12842", field: "phone", supabase: "+1234...", awsRds: "+1235...", delta: "diff", autoFix: "fixed" },
    { recordId: "C-12838", field: "company", supabase: "Acme", awsRds: "Acme Corp", delta: "diff", autoFix: "fixed" },
    { recordId: "C-12801", field: "lifecycle", supabase: "MQL", awsRds: "SQL", delta: "diff", autoFix: "review" },
  ];

  const alignmentTrend = [
    { day: "Mon", accuracy: 97 },
    { day: "Tue", accuracy: 98 },
    { day: "Wed", accuracy: 99 },
    { day: "Thu", accuracy: 99.5 },
    { day: "Fri", accuracy: 99.97 },
  ];

  const autoAlignmentLog = [
    { time: "2h ago", record: "C-12842", field: "phone", action: "fixed" },
    { time: "5h ago", record: "C-12838", field: "company", action: "fixed" },
    { time: "1d ago", record: "C-12801", field: "email", action: "fixed" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <DashboardHeader
        title="Attribution & Leaks"
        description="3-source attribution reconciliation and data integrity monitoring"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
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
          <TabsTrigger value="attribution">Attribution</TabsTrigger>
          <TabsTrigger value="leaks">Leak Detector</TabsTrigger>
        </TabsList>

        {/* Tab 1: Attribution (3-Source Reconciliation) */}
        <TabsContent value="attribution" className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {attributionMetrics.map((metric, index) => (
              <MetricCard key={index} {...metric} />
            ))}
          </div>

          {/* 3-Source Reconciliation Matrix */}
          <DataTableCard
            title="🔍 3-Source Reconciliation Matrix"
            data={reconciliationMatrix}
            columns={[
              { key: "campaign", label: "Campaign", render: (item) => item.campaign },
              { key: "fbAds", label: "FB Ads", render: (item) => `$${(item.fbAds / 1000).toFixed(1)}K` },
              { key: "hubspot", label: "HubSpot", render: (item) => `$${(item.hubspot / 1000).toFixed(1)}K` },
              { key: "anytrack", label: "AnyTrack", render: (item) => `$${(item.anytrack / 1000).toFixed(1)}K` },
              { key: "deltaMax", label: "Δ Max", render: (item) => `${item.deltaMax}%` },
              {
                key: "status",
                label: "Status",
                render: (item) => (
                  <StatusBadge
                    status={item.status === "aligned" ? "success" : item.status === "check" ? "warning" : "error"}
                    label={
                      item.status === "aligned"
                        ? "✅ Aligned"
                        : item.status === "check"
                        ? "⚠️ Check"
                        : "🔴 Conflict"
                    }
                  />
                ),
              },
            ]}
          />

          {/* Revenue by Source + Auto-Reconciliation Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Source */}
            <ChartCard title="Revenue by Source" height="default">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueBySource}>
                  <CartesianGrid
                    strokeDasharray={chartTheme.grid.strokeDasharray}
                    stroke={chartTheme.grid.stroke}
                  />
                  <XAxis
                    dataKey="source"
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
                  <Bar dataKey="fb" fill="#F59E0B" name="FB Ads" />
                  <Bar dataKey="hs" fill="#8B5CF6" name="HubSpot" />
                  <Bar dataKey="at" fill="#10B981" name="AnyTrack" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Auto-Reconciliation Actions */}
            <Card className="bg-[#0A0A0A] border-[#1F2937]">
              <CardHeader>
                <CardTitle className="text-lg">Auto-Reconciliation Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Align Brand Awareness</span>
                    <StatusBadge status="warning" label="🟡 Pending" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Sync Retargeting</span>
                    <StatusBadge status="success" label="✅ Complete" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Verify Summer Sale</span>
                    <StatusBadge status="success" label="✅ Verified" />
                  </div>
                  <Button className="mt-4 w-full">Run Auto-Align</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Attribution Events */}
          <DataTableCard
            title="🎯 Attribution Events (Last 100)"
            data={attributionEvents}
            columns={[
              { key: "event", label: "Event", render: (item) => item.event },
              { key: "source", label: "Source", render: (item) => item.source },
              { key: "value", label: "Value", render: (item) => item.value },
              { key: "contact", label: "Contact", render: (item) => item.contact },
              { key: "time", label: "Time", render: (item) => item.time },
              {
                key: "status",
                label: "Status",
                render: (item) => <StatusBadge status="success" label="✅" />,
              },
            ]}
          />
        </TabsContent>

        {/* Tab 2: Leak Detector (AWS Truth Alignment) */}
        <TabsContent value="leaks" className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {leakMetrics.map((metric, index) => (
              <MetricCard key={index} {...metric} />
            ))}
          </div>

          {/* Discrepancy Detection */}
          <DataTableCard
            title="🔍 Discrepancy Detection (Supabase ↔ AWS RDS)"
            data={discrepancies}
            columns={[
              { key: "recordId", label: "Record ID", render: (item) => item.recordId },
              { key: "field", label: "Field", render: (item) => item.field },
              { key: "supabase", label: "Supabase", render: (item) => item.supabase },
              { key: "awsRds", label: "AWS RDS", render: (item) => item.awsRds },
              { key: "delta", label: "Δ", render: (item) => item.delta },
              {
                key: "autoFix",
                label: "Auto-Fix",
                render: (item) => (
                  <StatusBadge
                    status={item.autoFix === "fixed" ? "success" : item.autoFix === "manual" ? "warning" : "error"}
                    label={
                      item.autoFix === "fixed" ? "✅ Fixed" : item.autoFix === "manual" ? "🟡 Manual" : "🔴 Review"
                    }
                  />
                ),
              },
            ]}
          />

          {/* Alignment Trend + Auto-Alignment Log */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Alignment Trend */}
            <ChartCard title="Alignment Trend (7d)" height="default">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={alignmentTrend}>
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
                    domain={[95, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartTheme.tooltip.backgroundColor,
                      border: chartTheme.tooltip.border,
                      borderRadius: chartTheme.tooltip.borderRadius,
                      padding: chartTheme.tooltip.padding,
                    }}
                    formatter={(value: number) => `${value}%`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#10B981"
                    strokeWidth={2}
                    name="Accuracy %"
                    dot={{ fill: "#10B981" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Auto-Alignment Log */}
            <Card className="bg-[#0A0A0A] border-[#1F2937]">
              <CardHeader>
                <CardTitle className="text-lg">Auto-Alignment Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {autoAlignmentLog.map((log, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <div className="flex flex-col">
                        <span className="text-slate-300">{log.record}</span>
                        <span className="text-slate-500">{log.field}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <StatusBadge status="success" label="✅ Fix" />
                        <span className="text-slate-500">{log.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="link" className="mt-4 p-0 h-auto text-primary">
                  View All Logs →
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Leak Detector Configuration */}
          <Card className="bg-[#0A0A0A] border-[#1F2937]">
            <CardHeader>
              <CardTitle className="text-lg">⚙️ Leak Detector Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Auto-alignment</span>
                  <div className="flex gap-2 items-center">
                    <StatusBadge status="success" label="✅ Enabled" />
                    <Button variant="outline" size="sm">
                      Disable
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Sync frequency</span>
                  <div className="flex gap-2 items-center">
                    <span className="text-slate-400">Every 5 min</span>
                    <Button variant="outline" size="sm">
                      Change
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Conflict resolution</span>
                  <div className="flex gap-2 items-center">
                    <span className="text-slate-400">Manual</span>
                    <Button variant="outline" size="sm">
                      Auto/Manual
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Alert on discrepancy &gt;</span>
                  <div className="flex gap-2 items-center">
                    <span className="text-slate-400">0.1%</span>
                    <Button variant="outline" size="sm">
                      Change
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">AWS RDS connection</span>
                  <div className="flex gap-2 items-center">
                    <StatusBadge status="success" label="🟢 Connected" />
                    <Button variant="outline" size="sm">
                      Test
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
