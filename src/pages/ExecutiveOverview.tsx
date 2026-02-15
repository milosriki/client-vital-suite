import { useState } from "react";
import { DollarSign, TrendingUp, Users, Phone, Target, AlertCircle, Activity } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/layout/DashboardHeader";
import { FilterBar, DATE_RANGE_PRESETS } from "@/components/dashboard/layout/FilterBar";
import { MetricCard } from "@/components/dashboard/cards/MetricCard";
import { ChartCard } from "@/components/dashboard/cards/ChartCard";
import { InsightPanel } from "@/components/dashboard/cards/InsightPanel";
import { DataTableCard } from "@/components/dashboard/cards/DataTableCard";
import { StatusBadge } from "@/components/dashboard/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  FunnelChart,
  Funnel,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { chartTheme } from "@/components/dashboard/cards/ChartCard";

export default function ExecutiveOverview() {
  const [dateRange, setDateRange] = useState("last_30_days");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // TODO: Call edge functions to refresh data
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Mock data - TODO: Replace with real edge function calls
  const northStarMetric = {
    value: "$847,320",
    label: "Monthly Revenue",
    delta: { value: 15.2, type: "positive" as const },
  };

  const kpiMetrics = [
    { label: "MRR", value: "$127K", delta: { value: 12, type: "positive" as const }, icon: DollarSign },
    { label: "ARR", value: "$1.5M", delta: { value: 18, type: "positive" as const }, icon: TrendingUp },
    { label: "LTV", value: "$8.2K", delta: { value: 5, type: "positive" as const }, icon: Users },
    { label: "CAC", value: "$1.8K", delta: { value: -3, type: "positive" as const }, icon: Target },
    { label: "Churn", value: "4.2%", delta: { value: -0.5, type: "positive" as const }, icon: AlertCircle },
    { label: "Health", value: "87/100", delta: { value: 2, type: "positive" as const }, icon: Activity },
    { label: "Deals", value: "42", delta: { value: 8, type: "positive" as const }, icon: TrendingUp },
    { label: "Calls", value: "284", delta: { value: 15, type: "positive" as const }, icon: Phone },
  ];

  const fullChainData = [
    { name: "Ad Spend", value: 12450, label: "$12,450" },
    { name: "Leads", value: 847, label: "847 (6.8%)" },
    { name: "Calls", value: 284, label: "284 (33.5%)" },
    { name: "Booked", value: 42, label: "42 (14.8%)" },
    { name: "Closed", value: 12, label: "12 (28.6%)" },
  ];

  const revenueTrendData = [
    { date: "1", mrr: 600000, target: 650000 },
    { date: "7", mrr: 680000, target: 700000 },
    { date: "14", mrr: 720000, target: 750000 },
    { date: "21", mrr: 780000, target: 800000 },
    { date: "28", mrr: 847320, target: 850000 },
  ];

  const liveActivityData = [
    { id: 1, type: "deal", time: "2m ago", message: 'Deal "Acme Corp" moved to Closed Won ($18,500)', status: "success" },
    { id: 2, type: "health", time: "5m ago", message: 'Client "John Smith" health score dropped to 65 (was 82)', status: "warning" },
    { id: 3, type: "lead", time: "8m ago", message: 'New lead "Sarah Johnson" from Facebook Ad Campaign #47', status: "info" },
    { id: 4, type: "call", time: "12m ago", message: 'Call completed: 42 min with "Global Tech" (positive)', status: "success" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <DashboardHeader
        title="Executive Overview"
        description="Your command center for all critical business metrics"
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

      {/* North Star Metric + AI Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-dashboard-gap">
        <MetricCard
          label={northStarMetric.label}
          value={northStarMetric.value}
          delta={northStarMetric.delta}
          icon={DollarSign}
          className="lg:col-span-1"
        />

        <InsightPanel
          content={
            <ul className="space-y-2 text-sm">
              <li>⚠️ 3 At-Risk Clients (&gt;20pt drop)</li>
              <li>📉 Revenue -8.2% vs forecast</li>
              <li>🔴 5 Stuck Deals (&gt;30 days)</li>
            </ul>
          }
          action={{
            label: "View All Alerts →",
            onClick: () => console.log("View alerts"),
          }}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiMetrics.map((metric, index) => (
          <MetricCard
            key={index}
            label={metric.label}
            value={metric.value}
            delta={metric.delta}
            icon={metric.icon}
          />
        ))}
      </div>

      {/* Full-Chain Funnel */}
      <ChartCard title="Full-Chain Visibility (Ad → Lead → Call → Book → Close)" height="default">
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
            <Funnel dataKey="value" data={fullChainData} isAnimationActive>
              <LabelList position="right" fill="#CBD5E1" stroke="none" dataKey="label" />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Revenue Trend + AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-dashboard-gap">
        <ChartCard title="Revenue Trend (30d)" height="default">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueTrendData}>
              <CartesianGrid
                strokeDasharray={chartTheme.grid.strokeDasharray}
                stroke={chartTheme.grid.stroke}
              />
              <XAxis
                dataKey="date"
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
                dataKey="mrr"
                stroke="#F59E0B"
                strokeWidth={2}
                name="MRR"
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

        <InsightPanel
          content={
            <>
              <p className="mb-3">
                🧠 Revenue trending 15.2% above forecast. Consider increasing ad spend by 20% to capitalize on momentum.
              </p>
              <p>
                🎯 5 high-value leads need follow-up within 24h (avg deal: $15K)
              </p>
            </>
          }
          action={{
            label: "Generate Report →",
            onClick: () => console.log("Generate report"),
          }}
        />
      </div>

      {/* Live Activity Feed */}
      <DataTableCard
        title="Live Activity Feed (Real-time)"
        data={liveActivityData}
        columns={[
          {
            key: "time",
            label: "Time",
            render: (item) => <span className="text-slate-400">{item.time}</span>,
          },
          {
            key: "message",
            label: "Activity",
            render: (item) => item.message,
          },
          {
            key: "status",
            label: "Status",
            render: (item) => (
              <StatusBadge
                status={item.status as "success" | "warning" | "info"}
                label={item.status.toUpperCase()}
              />
            ),
          },
        ]}
      />

      {/* Bottom Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-dashboard-gap">
        <Card className="bg-[#0A0A0A] border-[#1F2937]">
          <CardHeader>
            <CardTitle className="text-lg">Top Coaches (Today)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex justify-between">
                <span>1. Mike</span>
                <span className="text-slate-400">12 📞</span>
              </li>
              <li className="flex justify-between">
                <span>2. Sarah</span>
                <span className="text-slate-400">10 📞</span>
              </li>
              <li className="flex justify-between">
                <span>3. Alex</span>
                <span className="text-slate-400">9 📞</span>
              </li>
            </ul>
            <Button variant="link" className="mt-4 p-0 h-auto text-primary">
              View All →
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#0A0A0A] border-[#1F2937]">
          <CardHeader>
            <CardTitle className="text-lg">Client Health Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex justify-between">
                <span>🟢 Healthy:</span>
                <span className="text-emerald-400">87</span>
              </li>
              <li className="flex justify-between">
                <span>🟡 At-Risk:</span>
                <span className="text-amber-400">13</span>
              </li>
              <li className="flex justify-between">
                <span>🔴 Critical:</span>
                <span className="text-red-400">5</span>
              </li>
            </ul>
            <Button variant="link" className="mt-4 p-0 h-auto text-primary">
              View Details →
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#0A0A0A] border-[#1F2937]">
          <CardHeader>
            <CardTitle className="text-lg">Pipeline Stages</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex justify-between">
                <span>Lead:</span>
                <span className="text-slate-400">124</span>
              </li>
              <li className="flex justify-between">
                <span>Qualified:</span>
                <span className="text-slate-400">68</span>
              </li>
              <li className="flex justify-between">
                <span>Demo:</span>
                <span className="text-slate-400">42</span>
              </li>
              <li className="flex justify-between">
                <span>Proposal:</span>
                <span className="text-slate-400">28</span>
              </li>
              <li className="flex justify-between">
                <span>Closed:</span>
                <span className="text-emerald-400">12</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
