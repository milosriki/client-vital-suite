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
import { SyncButton } from "@/components/SyncButton";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useExecutiveData } from "@/hooks/useExecutiveData";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/config/queryKeys";

export default function ExecutiveOverview() {
  const [dateRange, setDateRange] = useState("last_30_days");
  const queryClient = useQueryClient();

  // Fetch real data from Supabase
  const { data, isLoading, error } = useExecutiveData({ dateRange });

  const handleRefresh = async () => {
    // Invalidate and refetch all executive dashboard queries
    await queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.dashboard.batch({ executive: true, dateRange }),
    });
  };

  // Extract data with fallbacks
  const northStarMetric = data?.northStarMetric || {
    value: "AED 0",
    label: "Monthly Revenue",
    delta: { value: 0, type: "positive" as const },
  };

  const kpiMetrics = data?.kpiMetrics || [];
  const fullChainData = data?.fullChainData || [];
  const revenueTrendData = data?.revenueTrendData || [];
  const liveActivityData = data?.liveActivityData || [];

  // Add icons to KPI metrics
  const kpiIcons = [DollarSign, TrendingUp, Users, Target, AlertCircle, Activity, TrendingUp, Phone];
  const kpiMetricsWithIcons = kpiMetrics.map((metric, index) => ({
    ...metric,
    icon: kpiIcons[index] || DollarSign,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <DashboardHeader
        title="Executive Overview"
        description="Your command center for all critical business metrics"
        actions={
          <>
            <SyncButton />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
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
        {isLoading ? (
          <Skeleton className="h-32 bg-slate-800/50" />
        ) : (
          <MetricCard
            label={northStarMetric.label}
            value={northStarMetric.value}
            delta={northStarMetric.delta}
            icon={DollarSign}
            className="lg:col-span-1"
          />
        )}

        {isLoading ? (
          <Skeleton className="h-32 bg-slate-800/50" />
        ) : (
          <InsightPanel
            content={
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-red-400">⚠️</span>
                  <span><strong className="text-white">{data?.healthDistribution?.red || 0}</strong> <span className="text-slate-300">at-risk clients need intervention</span></span>
                </li>
                <li className="flex items-start gap-2">
                  <span>{northStarMetric.delta.value >= 0 ? "📈" : "📉"}</span>
                  <span className="text-slate-300">Revenue <strong className={northStarMetric.delta.value >= 0 ? "text-emerald-400" : "text-red-400"}>{northStarMetric.delta.value >= 0 ? "+" : ""}{Number(northStarMetric?.delta?.value ?? 0).toFixed(1)}%</strong> vs previous period</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400">🔴</span>
                  <span><strong className="text-white">{data?.raw?.deals.filter(d => !d.close_date && Date.now() - new Date(d.created_at || "").getTime() > 30 * 24 * 60 * 60 * 1000).length || 0}</strong> <span className="text-slate-300">deals stuck &gt;30 days — review pipeline</span></span>
                </li>
                {(data?.staleLeads?.length || 0) > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400">🔔</span>
                    <span><strong className="text-white">{data?.staleLeads?.length}</strong> <span className="text-slate-300">leads need follow-up (48h+ silent)</span></span>
                  </li>
                )}
              </ul>
            }
            action={{
              label: "View All Alerts →",
              onClick: () => window.location.href = "/lead-follow-up",
            }}
          />
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-slate-800/50" />
          ))
        ) : (
          kpiMetricsWithIcons.map((metric, index) => (
            <MetricCard
              key={index}
              label={metric.label}
              value={metric.value}
              delta={metric.delta}
              icon={metric.icon}
            />
          ))
        )}
      </div>

      {/* Full-Chain Funnel */}
      {isLoading ? (
        <Skeleton className="h-80 bg-slate-800/50" />
      ) : (
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
      )}

      {/* Revenue Trend + AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-dashboard-gap">
        {isLoading ? (
          <Skeleton className="h-80 bg-slate-800/50" />
        ) : (
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
        )}

        {isLoading ? (
          <Skeleton className="h-80 bg-slate-800/50" />
        ) : (
          <InsightPanel
            content={
              <>
                <p className="mb-3">
                  🧠 Revenue trending {northStarMetric.delta.value >= 0 ? "+" : ""}{Number(northStarMetric?.delta?.value ?? 0).toFixed(1)}% vs previous period.
                  {northStarMetric.delta.value > 10 && " Consider increasing ad spend by 20% to capitalize on momentum."}
                </p>
                <p>
                  🎯 {data?.raw?.leads.filter(l => Date.now() - new Date(l.created_at || "").getTime() < 24 * 60 * 60 * 1000).length || 0} new leads need follow-up within 24h
                </p>
              </>
            }
            action={{
              label: "Generate Report →",
              onClick: () => window.location.href = "/setter-command-center",
            }}
          />
        )}
      </div>

      {/* Live Activity Feed */}
      {isLoading ? (
        <Skeleton className="h-80 bg-slate-800/50" />
      ) : (
        <DataTableCard
          title="Live Activity Feed (Real-time)"
          data={liveActivityData}
          columns={[
            {
              key: "time",
              label: "Time",
              render: (item) => <span className="text-slate-300">{item.time}</span>,
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
      )}

      {/* Bottom Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-dashboard-gap">
        {isLoading ? (
          <>
            <Skeleton className="h-64 bg-slate-800/50" />
            <Skeleton className="h-64 bg-slate-800/50" />
            <Skeleton className="h-64 bg-slate-800/50" />
          </>
        ) : (
          <>
            <Card className="bg-[#0A0A0A] border-[#1F2937]">
              <CardHeader>
                <CardTitle className="text-lg">Top Performers (Today)</CardTitle>
              </CardHeader>
              <CardContent>
                {data?.topPerformers && data.topPerformers.length > 0 ? (
                  <ul className="space-y-2">
                    {data.topPerformers.map((p, i) => (
                      <li key={i} className="flex justify-between items-center">
                        <span className="text-white">{i + 1}. {p.name}</span>
                        <div className="flex gap-2 items-center">
                          <span className="text-slate-300">{p.calls} 📞</span>
                          {p.booked > 0 && <span className="text-emerald-400 text-sm">{p.booked} 📅</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-300 text-sm">No calls recorded today yet</p>
                )}
                <div className="flex gap-2 mt-4">
                  <Button variant="link" className="p-0 h-auto text-primary" onClick={() => window.location.href = "/leaderboard"}>
                    Leaderboard →
                  </Button>
                  <Button variant="link" className="p-0 h-auto text-primary" onClick={() => window.location.href = "/setter-command-center"}>
                    Setter Control →
                  </Button>
                </div>
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
                    <span className="text-emerald-400">{data?.healthDistribution?.green || 0}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>🟡 At-Risk:</span>
                    <span className="text-amber-400">{data?.healthDistribution?.yellow || 0}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>🔴 Critical:</span>
                    <span className="text-red-400">{data?.healthDistribution?.red || 0}</span>
                  </li>
                </ul>
                <Button variant="link" className="mt-4 p-0 h-auto text-primary">
                  View Details →
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-[#0A0A0A] border-[#1F2937]">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  🚨 Leads Need Follow-Up
                  {data?.staleLeads && data.staleLeads.length > 0 && (
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{data.staleLeads.length}</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data?.staleLeads && data.staleLeads.length > 0 ? (
                  <ul className="space-y-2">
                    {data.staleLeads.slice(0, 5).map((lead, i) => (
                      <li key={i} className="flex justify-between items-center">
                        <div className="truncate max-w-[60%]">
                          <span className="text-white text-sm">{lead.name}</span>
                          <span className="text-slate-300 text-xs ml-1">({lead.stage})</span>
                        </div>
                        <span className={`text-xs ${lead.daysSinceActivity > 7 ? 'text-red-400' : 'text-amber-400'}`}>
                          {lead.daysSinceActivity}d silent
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-emerald-400 text-sm">✅ All leads followed up</p>
                )}
                <div className="flex gap-2 mt-4">
                  <Button variant="link" className="p-0 h-auto text-primary" onClick={() => window.location.href = "/lead-follow-up"}>
                    Follow-Up Queue →
                  </Button>
                  <Button variant="link" className="p-0 h-auto text-primary" onClick={() => window.location.href = "/command-center"}>
                    All Leads →
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
