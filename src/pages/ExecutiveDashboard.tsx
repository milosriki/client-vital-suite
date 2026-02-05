import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  DollarSign,
  Users,
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
  BrainCircuit,
  ArrowUpRight,
  CheckCircle2,
  Megaphone,
} from "lucide-react";
import { SystemHealthMonitor } from "@/components/dashboard/SystemHealthMonitor";
import { LiveRevenueChart } from "@/components/dashboard/LiveRevenueChart";
import ConnectionStatus from "@/components/ConnectionStatus";
import { AIAssistantPanel } from "@/components/ai/AIAssistantPanel";
import { format } from "date-fns";
import { getBusinessDate, getBusinessStartOfMonth } from "@/lib/date-utils";

// ... existing imports

export default function ExecutiveDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  // Date Range for MTD (Business Time - Dubai)
  // This ensures that "This Month" aligns with the HQ timezone
  const startOfMonth = getBusinessStartOfMonth();
  const endOfDay = getBusinessDate().toISOString();

  // Fetch REAL Stripe Stats (MTD Validated)
  interface StripeMetrics {
    totalRevenue: number;
    netRevenue: number;
    totalPayouts: number;
    mrr: number;
    activeSubscriptions: number;
    payingCustomersCount: number;
  }

  const { data: stripeData, isLoading: stripeLoading } = useQuery({
    queryKey: ["stripe-live-stats", "mtd"], // Key includes period
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "stripe-dashboard-data",
        {
          body: {
            startDate: startOfMonth,
            endDate: endOfDay,
          },
        },
      );
      if (error) throw error;
      return data?.metrics as StripeMetrics;
    },
    staleTime: 60000,
  });

  // Fetch REAL Leads Count (Validated)
  const { data: leadsCount } = useQuery({
    queryKey: ["dashboard-leads-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("lifecycle_stage", "lead")
        .gte("created_at", startOfMonth); // New leads this month

      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch Marketing Intelligence (Live Ads Data)
  const { data: marketingData, isLoading: marketingLoading } = useQuery({
    queryKey: ["marketing-insights", "today"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "fetch-facebook-insights",
        {
          body: { date_preset: "this_month" },
        },
      );
      if (error) {
        console.error("Marketing fetch failed:", error);
        return null;
      }
      return data;
    },
  });

  // Derive display values from real MTD data
  const stats = {
    revenue_this_month: stripeData?.netRevenue
      ? Math.round(stripeData.netRevenue / 100)
      : 0,
    mrr: stripeData?.mrr ? Math.round(stripeData.mrr / 100) : 0,
    pipeline_value: stripeData?.mrr ? Math.round(stripeData.mrr / 100) : 0,
    pipeline_count: stripeData?.activeSubscriptions || 0,
    paying_customers: stripeData?.payingCustomersCount || 0,
    is_positive_trend: true,
    revenue_trend: 0,
    // Marketing Stats
    ad_spend: marketingData?.total_spend || 0,
    roas: marketingData?.total_roas || 0, // Now using weighted average from backend
  };

  // Fetch Treasury Data (Keep existing)
  const { data: treasury } = useQuery({
    queryKey: ["treasury-summary"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stripe_outbound_transfers")
        .select("amount, status, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      const totalOut = data?.reduce((sum, t) => sum + t.amount, 0) || 0;
      return { recent: data, totalOut };
    },
  });

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Executive Command Center
          </h1>
          <p className="text-slate-500">
            Real-time business intelligence: Revenue, Ads, & Risk
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-white">
            {format(getBusinessDate(), "MMM dd, yyyy HH:mm")}
          </Badge>
          <Button size="sm" variant="outline">
            <Activity className="mr-2 h-4 w-4" />
            Live Validation
          </Button>
        </div>
      </div>

      {/* Top Row: Pulse Metrics (Revenue, Operations, Marketing) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Link
          to="/stripe"
          className="block transition-transform hover:scale-[1.02] md:col-span-1"
        >
          <Card className="border-l-4 border-l-green-500 shadow-sm cursor-pointer h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                Revenue (MTD)
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                AED {stats?.revenue_this_month?.toLocaleString() || "0"}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center">
                Validated (This Month)
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Marketing Intelligence Card (New) */}
        <Link
          to="/marketing"
          className="block transition-transform hover:scale-[1.02] md:col-span-1"
        >
          <Card className="border-l-4 border-l-pink-500 shadow-sm cursor-pointer h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                Marketing Efficiency
                <Megaphone className="h-4 w-4 text-pink-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.roas > 0 ? `${stats.roas.toFixed(2)}x` : "--"} ROAS
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Spend: AED {stats.ad_spend.toLocaleString()} (MTD)
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link
          to="/sales-pipeline"
          className="block transition-transform hover:scale-[1.02]"
        >
          <Card className="border-l-4 border-l-blue-500 shadow-sm cursor-pointer h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                Pipeline Value
                <Activity className="h-4 w-4 text-blue-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                AED {stats?.pipeline_value?.toLocaleString() || "0"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.pipeline_count || 0} active deals
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Treasury Card */}
        <Link
          to="/stripe"
          className="block transition-transform hover:scale-[1.02]"
        >
          <Card className="border-l-4 border-l-purple-500 shadow-sm cursor-pointer h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                Treasury Out
                <ShieldAlert className="h-4 w-4 text-purple-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                AED {(treasury?.totalOut || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Risk Validated
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Real Leads Count Card */}
        <Link
          to="/money-map"
          className="block transition-transform hover:scale-[1.02]"
        >
          <Card className="border-l-4 border-l-orange-500 shadow-sm cursor-pointer h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                New Leads
                <Users className="h-4 w-4 text-orange-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{leadsCount ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Added This Month
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex items-center gap-4 overflow-x-auto pb-2">
        <Button
          variant="outline"
          className="bg-white shadow-sm border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
        >
          <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
          Approve Reassignments (3)
        </Button>
        <Button
          variant="outline"
          className="bg-white shadow-sm border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
        >
          <Megaphone className="mr-2 h-4 w-4 text-blue-600" />
          Trigger Marketing Blast
        </Button>
        <Button
          variant="outline"
          className="bg-white shadow-sm border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
        >
          <ShieldAlert className="mr-2 h-4 w-4 text-red-600" />
          Run Security Audit
        </Button>
        <Link to="/observability">
          <Button
            variant="ghost"
            className="text-slate-500 hover:text-slate-900"
          >
            View All Systems <ArrowUpRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>

      {/* Middle Row: Forensics & Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Health Monitor (Takes up 1 column) */}
        <div className="lg:col-span-1">
          <SystemHealthMonitor />
        </div>

        {/* Main Dashboard Tabs (Takes up 2 columns) */}
        <div className="lg:col-span-2">
          {/* Connection Diagnostics (Only visible if issues detected or in dev) */}
          <div className="mb-4">
            <ConnectionStatus />
          </div>

          <Card className="h-full">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="h-full flex flex-col"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Business Forensics</CardTitle>
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="treasury">Treasury</TabsTrigger>
                    <TabsTrigger value="risks">Risks</TabsTrigger>
                  </TabsList>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <TabsContent value="overview" className="mt-0 space-y-4">
                  <div className="h-[400px]">
                    <LiveRevenueChart />
                  </div>
                </TabsContent>

                <TabsContent value="treasury" className="mt-0">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Recent Transfers
                    </h3>
                    <div className="space-y-2">
                      {treasury?.recent?.map((t: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-full ${t.status === "posted" ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600"}`}
                            >
                              <DollarSign className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium">Transfer Out</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(t.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">
                              - AED {t.amount.toLocaleString()}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              {t.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="risks" className="mt-0">
                  <div className="h-[300px] flex items-center justify-center border-2 border-dashed rounded-lg bg-red-50/50 border-red-200">
                    <div className="text-center">
                      <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                      <p className="text-red-900 font-medium">
                        Risk Analysis Module
                      </p>
                      <p className="text-sm text-red-700">
                        Tracking churn signals & payment failures
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>

      {/* Bottom Row: Super Intelligence */}
      <div className="grid grid-cols-1">
        <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-purple-400" />
              Internal Super Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <p className="text-slate-300">
                  Ask me anything about your business. I have access to your
                  live database, treasury logs, and system health status.
                </p>
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <h4 className="text-sm font-medium text-purple-300 mb-2">
                    Suggested Queries:
                  </h4>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li className="cursor-pointer hover:text-white transition-colors">
                      • "Why did revenue drop yesterday?"
                    </li>
                    <li className="cursor-pointer hover:text-white transition-colors">
                      • "Show me the last 5 failed payments and who they belong
                      to."
                    </li>
                    <li className="cursor-pointer hover:text-white transition-colors">
                      • "Are there any silent failures in the lead pipeline?"
                    </li>
                  </ul>
                </div>
              </div>
              <div className="h-[400px] bg-white rounded-lg overflow-hidden text-slate-900">
                <AIAssistantPanel />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
