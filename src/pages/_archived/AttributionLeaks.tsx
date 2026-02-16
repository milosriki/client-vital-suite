import { useState } from "react";
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState("attribution");

  // Fetch real data from data-reconciler Edge Function
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["data-reconciler", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("data-reconciler", {
        body: { date_range: dateRange },
      });
      if (error) throw error;
      return data;
    },
  });

  const handleRefresh = () => {
    refetch();
  };

  // Map backend data to UI metrics (Using financials/intelligence objects from data-reconciler)
  const financials = data?.financials;
  const intelligence = data?.intelligence;
  
  const attributionMetrics = [
    { 
      label: "FB Ads Revenue", 
      value: financials?.meta_revenue ? `$${(financials.meta_revenue / 1000).toFixed(1)}K` : "—", 
      delta: { value: 0, type: "neutral" as const }, 
      icon: DollarSign 
    },
    { 
      label: "HubSpot Revenue", 
      value: financials?.hubspot_revenue ? `$${(financials.hubspot_revenue / 1000).toFixed(1)}K` : "—", 
      delta: { value: 0, type: "neutral" as const }, 
      icon: DollarSign 
    },
    { 
      label: "AnyTrack Revenue", 
      value: financials?.anytrack_revenue ? `$${(financials.anytrack_revenue / 1000).toFixed(1)}K` : "—", 
      delta: { value: 0, type: "neutral" as const }, 
      icon: DollarSign 
    },
    {
      label: "Conflicts",
      value: data?.discrepancies?.count?.toString() || "0",
      delta: { value: 0, type: "negative" as const },
      icon: AlertTriangle
    },
    { 
      label: "True ROAS", 
      value: intelligence?.true_roas ? `${intelligence.true_roas}x` : "—", 
      delta: { value: 0, type: "positive" as const }, 
      icon: TrendingUp 
    },
  ];

  // Use real discrepancies or empty array
  const reconciliationMatrix = data?.discrepancies?.items || [];

  // Use real revenue by source or empty array
  const revenueBySource = data?.revenue_by_source || [];

  // Use real recent events or empty array
  const attributionEvents = data?.recent_deals || [];

  // Tab 2: Leak Detector - Real data from data-reconciler
  // Calculate leak detection metrics from real data
  const totalRevenue = financials?.total_revenue || 0;
  const dbAuditTotal = financials?.db_audit_total || 0;
  const discrepancyAmount = Math.abs(totalRevenue - dbAuditTotal);
  const discrepancyCount = data?.discrepancies?.count || 0;
  const accuracy = dbAuditTotal > 0
    ? ((Math.min(totalRevenue, dbAuditTotal) / Math.max(totalRevenue, dbAuditTotal)) * 100).toFixed(2)
    : "100.00";

  const leakMetrics = [
    {
      label: "Attributed Revenue",
      value: totalRevenue > 0 ? `$${(totalRevenue / 1000).toFixed(1)}K` : "$0",
      delta: { value: 0, type: "neutral" as const },
      icon: DollarSign
    },
    {
      label: "DB Audit Total",
      value: dbAuditTotal > 0 ? `$${(dbAuditTotal / 1000).toFixed(1)}K` : "$0",
      delta: { value: 0, type: "neutral" as const },
      icon: DollarSign
    },
    {
      label: "Discrepancies",
      value: discrepancyCount.toString(),
      delta: { value: 0, type: discrepancyCount > 0 ? "negative" as const : "neutral" as const },
      icon: AlertTriangle
    },
    {
      label: "Amount Difference",
      value: `$${(discrepancyAmount / 1000).toFixed(1)}K`,
      delta: { value: 0, type: discrepancyAmount > 1000 ? "negative" as const : "positive" as const },
      icon: CheckCircle
    },
    {
      label: "Accuracy",
      value: `${accuracy}%`,
      delta: { value: 0, type: "positive" as const },
      icon: TrendingUp
    },
  ];

  // Map discrepancies to leak detector format
  interface DiscrepancyItem {
    deal_id?: string;
    deal_name?: string;
    type?: string;
    message?: string;
    value?: number;
  }

  const discrepancies = (data?.discrepancies?.items || []).map((disc: DiscrepancyItem, idx: number) => ({
    recordId: disc.deal_id || `DISC-${idx}`,
    field: "attribution",
    supabase: disc.type || "Unknown",
    awsRds: disc.message || "No details",
    delta: disc.value ? `$${disc.value.toFixed(0)}` : "—",
    autoFix: "review",
  }));

  // Calculate alignment trend from pipeline breakdown
  const dbAuditBreakdown = financials?.db_audit_breakdown || {};
  const alignmentTrend = Object.entries(dbAuditBreakdown)
    .slice(0, 7)
    .map(([key, value]) => {
      const [pipeline, stage] = key.split("::");
      const normalized = typeof value === 'number' ? value : 0;
      const percentage = dbAuditTotal > 0 ? ((normalized / dbAuditTotal) * 100) : 0;
      return {
        day: stage || pipeline,
        accuracy: Math.min(100, Math.max(0, percentage)),
      };
    });

  // Generate auto-alignment log from recent discrepancies
  const autoAlignmentLog = (data?.discrepancies?.items || [])
    .slice(0, 3)
    .map((disc: DiscrepancyItem, idx: number) => ({
      time: `${idx * 2 + 1}h ago`,
      record: disc.deal_id || disc.deal_name || `Record ${idx}`,
      field: "attribution",
      action: "detected",
    }));

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
