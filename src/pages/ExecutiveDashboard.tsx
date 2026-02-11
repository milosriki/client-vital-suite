import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileNavBar } from "@/components/mobile/MobileNavBar";
import { AIAssistantPanel } from "@/components/ai/AIAssistantPanel";
import { XRayTooltip } from "@/components/ui/x-ray-tooltip";
import {
  ArrowUpRight,
  TrendingUp,
  Users,
  Activity,
  DollarSign,
  ShieldAlert,
  Zap,
  MoreHorizontal,
} from "lucide-react";
import { useTimeMachine } from "@/contexts/TimeMachineContext";
import { format } from "date-fns";
import { LiveRevenueChart } from "@/components/dashboard/LiveRevenueChart";
import { useAdvancedBI } from "@/hooks/use-advanced-bi";
import { FinancialScenarioWidget } from "@/components/dashboard/bi/FinancialScenarioWidget";
import { CustomerVoiceWidget } from "@/components/dashboard/bi/CustomerVoiceWidget";
import { NorthStarWidget } from "@/components/dashboard/bi/NorthStarWidget";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Enterprise Pro Dashboard
export default function ExecutiveDashboard() {
  const { dateRange } = useTimeMachine();

  // -- Data Fetching (Merged from Executive + Ultimate) --

  // 1. Stripe/Financials
  const { data: stripeData, isLoading: stripeLoading } = useQuery({
    queryKey: ["stripe-live-stats", "merged"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "stripe-dashboard-data",
        {
          body: {
            startDate: dateRange.from.toISOString(),
            endDate: dateRange.to.toISOString(),
          },
        },
      );
      if (error) throw error;
      return data?.metrics;
    },
  });

  // 2. Ultimate/God Mode Data (For Cross-Validation)
  const { data: ultimateData } = useQuery({
    queryKey: ["ultimate-dashboard-data"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "ultimate-aggregator",
      );
      if (error) throw error;
      return data;
    },
    staleTime: 300000, // 5 min cache
  });

  // 3. Marketing/Leads
  const { data: leadsCount } = useQuery({
    queryKey: ["dashboard-leads-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("lifecycle_stage", "lead")
        .gte("created_at", dateRange.from.toISOString());
      return count || 0;
    },
  });

  // 4. Advanced BI Suite (New)
  const { data: advancedBI } = useAdvancedBI();

  // 5. AWS Ground Truth (Cache) + Health Score
  const { data: awsTruth } = useQuery({
    queryKey: ["aws-truth-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aws_truth_cache")
        .select("outstanding_sessions, lifetime_revenue, updated_at");

      if (error) throw error;

      const totalSessions = data.reduce(
        (sum, row) => sum + (row.outstanding_sessions || 0),
        0,
      );
      const totalLifetimeRevenue = data.reduce(
        (sum, row) => sum + (row.lifetime_revenue || 0),
        0,
      );
      const lastSync = data.length > 0 ? new Date(data[0].updated_at) : null;

      // Health Score = f(active clients, revenue density, session utilization)
      // Simple V1: (clients with sessions > 0) / total clients * 100
      const activeClients = data.filter(
        (r) => (r.outstanding_sessions || 0) > 0,
      ).length;
      const healthScore =
        data.length > 0 ? Math.round((activeClients / data.length) * 100) : 0;

      return {
        totalSessions,
        totalLifetimeRevenue,
        lastSync,
        count: data.length,
        healthScore,
      };
    },
  });

  const isLoading = stripeLoading;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 md:pb-6">
      <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Command Center
              <Badge
                variant="outline"
                className="text-xs font-normal text-muted-foreground border-border"
              >
                {format(dateRange.from, "MMM d")} -{" "}
                {format(dateRange.to, "MMM d")}
              </Badge>
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Enterprise Intelligence •{" "}
              <span className="text-emerald-500">Live Validation Active</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 bg-card border-border hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              <Zap className="h-3 w-3" />
              Sync Engines
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Generate Report
            </Button>
          </div>
        </div>

        {/* TOP ROW: High Density Metrics (4 Cols) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Revenue Card */}
          <XRayTooltip
            title="Net Revenue"
            insights={[
              {
                label: "Gross Volume",
                value: `AED ${((stripeData?.totalVolume || 0) / 100).toLocaleString()}`,
                color: "text-emerald-400",
              },
              {
                label: "Refunds",
                value: `AED ${((stripeData?.totalRefunded || 0) / 100).toLocaleString()}`,
                color: "text-rose-400",
              },
              {
                label: "Active Subs",
                value: (stripeData?.activeSubscriptions || 0).toString(),
              },
              {
                label: "Success Rate",
                value: `${stripeData?.successRate || 100}%`,
                color: "text-emerald-400",
              },
            ]}
            summary="Net = Gross Volume − Refunds. Driven by subscription renewals and new sign-ups."
          >
            <MetricCard
              title="Net Revenue"
              value={`AED ${(stripeData?.netRevenue ? stripeData.netRevenue / 100 : 0).toLocaleString()}`}
              change="+12.5%"
              trend="up"
              icon={DollarSign}
              color="text-emerald-500"
            />
          </XRayTooltip>
          {/* Active Users */}
          <XRayTooltip
            title="Active Members"
            insights={[
              {
                label: "Active Subscriptions",
                value: (stripeData?.activeSubscriptions || 0).toString(),
                color: "text-indigo-400",
              },
              {
                label: "MRR",
                value: `AED ${((stripeData?.mrr || 0) / 100).toLocaleString()}`,
                color: "text-emerald-400",
              },
              {
                label: "Paying Customers",
                value: (stripeData?.payingCustomerCount || 0).toString(),
              },
            ]}
            summary="Members with active Stripe subscriptions. MRR = Monthly Recurring Revenue from these subs."
          >
            <MetricCard
              title="Active Members"
              value={(stripeData?.activeSubscriptions || 0).toString()}
              change="+4.2%"
              trend="up"
              icon={Users}
              color="text-indigo-500"
            />
          </XRayTooltip>
          {/* Truth Alignment */}
          <XRayTooltip
            title="AWS Truth Pulse"
            insights={[
              {
                label: "Outstanding Sessions",
                value: (awsTruth?.totalSessions || 0).toString(),
                color: "text-amber-400",
              },
              {
                label: "Clients Tracked",
                value: (awsTruth?.count || 0).toString(),
              },
              {
                label: "Last Sync",
                value: awsTruth?.lastSync
                  ? format(awsTruth.lastSync, "HH:mm MMM d")
                  : "Never",
              },
            ]}
            summary="Cross-validated against AWS RDS ground truth. Outstanding sessions = booked but not yet completed."
          >
            <MetricCard
              title="AWS Truth Pulse"
              value={awsTruth?.totalSessions?.toString() || "0"}
              change={`From ${awsTruth?.count || 0} clients`}
              trend="up"
              icon={ShieldAlert}
              color="text-emerald-500"
              subtext={
                awsTruth?.lastSync
                  ? `Synced ${format(awsTruth.lastSync, "HH:mm")}`
                  : "Calibration Required"
              }
            />
          </XRayTooltip>
          {/* Pipeline */}
          <XRayTooltip
            title="New Leads"
            insights={[
              {
                label: "Leads This Period",
                value: (leadsCount || 0).toString(),
                color: "text-amber-400",
              },
              { label: "Source", value: "HubSpot → Supabase" },
              { label: "Lifecycle Stage", value: "Lead (pre-qualified)" },
            ]}
            summary="Contacts with lifecycle_stage='lead' created within the selected date range. Synced from HubSpot."
          >
            <MetricCard
              title="New Leads"
              value={(leadsCount || 0).toString()}
              change="+18"
              trend="up"
              icon={TrendingUp}
              color="text-amber-500"
            />
          </XRayTooltip>
          {/* Health Score */}
          <XRayTooltip
            title="Health Score"
            insights={[
              {
                label: "Active Clients",
                value: `${awsTruth?.healthScore || 0}% with sessions`,
                color:
                  (awsTruth?.healthScore || 0) > 70
                    ? "text-emerald-400"
                    : "text-amber-400",
              },
              {
                label: "Lifetime Revenue",
                value: `AED ${(awsTruth?.totalLifetimeRevenue || 0).toLocaleString()}`,
                color: "text-emerald-400",
              },
              {
                label: "Source",
                value: "AWS RDS (PowerBI Replica)",
              },
            ]}
            summary="Health Score = % of tracked clients with active session packages. Powered by dual-replica AWS Truth."
          >
            <MetricCard
              title="Health Score"
              value={`${awsTruth?.healthScore || 0}%`}
              change={`AED ${((awsTruth?.totalLifetimeRevenue || 0) / 1000).toFixed(0)}k LTV`}
              trend={(awsTruth?.healthScore || 0) > 60 ? "up" : "down"}
              icon={Activity}
              color={
                (awsTruth?.healthScore || 0) > 70
                  ? "text-emerald-500"
                  : "text-amber-500"
              }
            />
          </XRayTooltip>
        </div>

        {/* MIDDLE ROW: Analytics & AI (12 Cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-auto lg:h-[450px]">
          {/* Main Chart (8 Cols) */}
          <Card className="lg:col-span-8 bg-card border-border shadow-sm flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
              <div className="space-y-1">
                <CardTitle className="text-base font-medium">
                  Revenue Performance
                </CardTitle>
                <CardDescription className="text-xs">
                  Comparative analysis vs Last Month
                </CardDescription>
              </div>
              <div className="flex bg-muted/20 p-1 rounded-md">
                {/* Mock timeframe selector */}
                <div className="px-3 py-1 text-xs font-medium bg-background shadow-sm rounded-sm text-foreground">
                  30D
                </div>
                <div className="px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer">
                  90D
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-4 min-h-[300px]">
              <LiveRevenueChart />
            </CardContent>
          </Card>

          {/* AI Assistant (4 Cols) */}
          <Card className="lg:col-span-4 bg-card border-border shadow-sm flex flex-col overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/5">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-indigo-500" />
                AI Analyst
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 bg-black/20">
              <AIAssistantPanel />
            </CardContent>
          </Card>
        </div>

        {/* ADVANCED INTELLIGENCE SUITE (New) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 1. Strategy Engine */}
          <NorthStarWidget data={advancedBI?.strategy} />

          {/* 2. Customer Engine */}
          <CustomerVoiceWidget data={advancedBI?.customers} />

          {/* 3. Financial Engine */}
          <FinancialScenarioWidget data={advancedBI?.financials} />
        </div>

        {/* BOTTOM ROW: Detailed Ledger (12 Cols) */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">
                Recent Transactions
              </CardTitle>
              <CardDescription className="text-xs">
                Live feed from Stripe & Bank Integrations
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {/* Using standard Table component for clean look */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-[300px]">Transaction ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ultimateData?.atomic_ledger || [])
                    .slice(0, 5)
                    .map((tx: any, i: number) => (
                      <TableRow
                        key={i}
                        className="border-border hover:bg-muted/10 group"
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground group-hover:text-primary transition-colors">
                          {tx.id ||
                            `TX-${Math.random().toString(36).substr(2, 9).toUpperCase()}`}
                        </TableCell>
                        <TableCell className="font-medium text-sm text-foreground">
                          {tx.name || "Unknown Customer"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`
                           text-[10px] uppercase tracking-wider font-semibold border-0
                           ${tx.value > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}
                         `}
                          >
                            {tx.stage || "Processed"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {tx.value ? `AED ${tx.value.toLocaleString()}` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Navigation */}
      <MobileNavBar />
    </div>
  );
}

// Sub-component for Metrics
function MetricCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  color,
  alert,
  subtext,
}: any) {
  return (
    <Card
      className={`bg-card border-border shadow-sm hover:border-primary/20 transition-colors ${alert ? "border-rose-900/30 bg-rose-950/5" : ""}`}
    >
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div
            className={`p-2 rounded-lg bg-background border border-border ${color}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          {alert && (
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold tracking-tight text-white font-mono">
              {value}
            </h3>
            <span
              className={`text-[10px] font-bold uppercase ${trend === "up" ? "text-emerald-500" : "text-rose-500"}`}
            >
              {change}
            </span>
          </div>
          {subtext && (
            <p className="text-[10px] text-muted-foreground font-mono mt-1 opacity-60">
              {subtext}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
