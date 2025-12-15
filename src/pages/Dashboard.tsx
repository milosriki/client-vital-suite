import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MissionControlHeader } from "@/components/dashboard/MissionControlHeader";
import { KPIGrid } from "@/components/dashboard/KPIGrid";
import { ExecutiveBriefing } from "@/components/dashboard/ExecutiveBriefing";
import { PredictiveAlerts } from "@/components/dashboard/PredictiveAlerts";
import { LiveHealthDistribution } from "@/components/dashboard/LiveHealthDistribution";
import { CoachLeaderboard } from "@/components/dashboard/CoachLeaderboard";
import { LiveActivityFeed } from "@/components/dashboard/LiveActivityFeed";
import { LiveRevenueChart } from "@/components/dashboard/LiveRevenueChart";
import { ClientRiskMatrix } from "@/components/dashboard/ClientRiskMatrix";
import { DashboardInterventionTracker } from "@/components/dashboard/DashboardInterventionTracker";
import { TickerFeed } from "@/components/hubspot/TickerFeed";
import { TrafficLightBadge } from "@/components/ui/traffic-light-badge";
import { useRealtimeHealthScores } from "@/hooks/useRealtimeHealthScores";
import { useNotifications } from "@/hooks/useNotifications";
import { toast } from "@/hooks/use-toast";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { 
  Calendar, 
  TrendingUp, 
  Users, 
  Zap, 
  CreditCard,
  Activity,
  LayoutGrid,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  useRealtimeHealthScores();
  useNotifications();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("today");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch clients
  const { data: clients, isLoading: clientsLoading, refetch: refetchClients } = useQuery({
    queryKey: ["client-health-scores-dashboard"],
    queryFn: async () => {
      const { data: latestDateRows } = await supabase
        .from("client_health_scores")
        .select("calculated_on")
        .order("calculated_on", { ascending: false })
        .limit(1);

      const latestDate = latestDateRows?.[0]?.calculated_on;
      let query = supabase
        .from("client_health_scores")
        .select("*")
        .order("health_score", { ascending: true });

      if (latestDate) {
        query = query.eq("calculated_on", latestDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  // Fetch daily summary
  const { data: dailySummary } = useQuery({
    queryKey: ["daily-summary-briefing"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("daily_summary")
        .select("*")
        .eq("summary_date", today)
        .single();
      if (error) return null;
      return data;
    },
    refetchInterval: 300000,
  });

  // Fetch revenue
  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ["monthly-revenue"],
    queryFn: async () => {
      const now = new Date();
      const thisMonthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const thisMonthEnd = format(endOfMonth(now), "yyyy-MM-dd");
      const lastMonthStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
      const lastMonthEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");

      const [thisMonth, lastMonth] = await Promise.all([
        (supabase as any).from("deals").select("deal_value").eq("status", "closed").gte("close_date", thisMonthStart).lte("close_date", thisMonthEnd),
        (supabase as any).from("deals").select("deal_value").eq("status", "closed").gte("close_date", lastMonthStart).lte("close_date", lastMonthEnd),
      ]);

      const thisTotal = thisMonth.data?.reduce((s: number, d: any) => s + (d.deal_value || 0), 0) || 0;
      const lastTotal = lastMonth.data?.reduce((s: number, d: any) => s + (d.deal_value || 0), 0) || 0;
      const trend = lastTotal > 0 ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100) : 0;
      return { total: thisTotal, trend, isPositive: trend >= 0 };
    },
    refetchInterval: 120000,
  });

  // Fetch pipeline
  const { data: pipelineData } = useQuery({
    queryKey: ["pipeline-value"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("deals").select("deal_value").not("status", "in", '("closed","lost")');
      if (error) return { total: 0, count: 0 };
      const total = data?.reduce((s: number, d: any) => s + (d.deal_value || 0), 0) || 0;
      return { total, count: data?.length || 0 };
    },
  });

  // Fetch today's leads
  const { data: leadsToday } = useQuery({
    queryKey: ["leads-today"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { count, error } = await supabase.from("contacts").select("*", { count: "exact", head: true }).gte("created_at", today);
      return count || 0;
    },
  });

  // Fetch today's calls
  const { data: callsToday } = useQuery({
    queryKey: ["calls-today"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { count, error } = await supabase.from("call_records").select("*", { count: "exact", head: true }).gte("created_at", today);
      return count || 0;
    },
  });

  // Computed stats
  const stats = useMemo(() => {
    const allClients = clients || [];
    const atRisk = allClients.filter((c) => c.health_zone === "RED" || c.health_zone === "YELLOW").length;
    return { totalClients: allClients.length, atRiskClients: atRisk };
  }, [clients]);

  // KPI Data
  const kpiData = {
    revenue: { value: revenueData?.total || 0, trend: revenueData?.trend },
    clients: { total: stats.totalClients, atRisk: stats.atRiskClients },
    pipeline: { value: pipelineData?.total || 0, count: pipelineData?.count || 0 },
    leads: leadsToday || 0,
    calls: callsToday || 0,
    appointments: dailySummary?.interventions_recommended || 0,
    criticalAlerts: dailySummary?.critical_interventions || 0,
  };

  // Executive summary
  const executiveSummary = useMemo(() => {
    const atRiskRevenue = (clients || [])
      .filter((c) => c.health_zone === "RED" || c.health_zone === "YELLOW")
      .reduce((sum, c) => sum + (c.package_value_aed || 0), 0);

    return {
      executive_briefing: dailySummary?.patterns_detected
        ? `${stats.totalClients} active clients tracked. ${stats.atRiskClients} require immediate attention with AED ${atRiskRevenue.toLocaleString()} at risk.`
        : `Monitoring ${stats.totalClients} clients. ${stats.atRiskClients} in warning/critical zones.`,
      max_utilization_rate: stats.totalClients > 0 ? Math.round(((stats.totalClients - stats.atRiskClients) / stats.totalClients) * 100) : 0,
      system_health_status: stats.atRiskClients > 10 ? "Attention Required" : "Healthy",
      action_plan: stats.atRiskClients > 0 ? [`Review ${stats.atRiskClients} at-risk clients`, "Schedule intervention calls", "Update client engagement scores"] : [],
      sla_breach_count: dailySummary?.critical_interventions || 0,
    };
  }, [clients, dailySummary, stats]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetchClients();
      setLastUpdated(new Date());
      toast({ title: "Data refreshed", description: "Dashboard updated with latest data" });
    } catch (error) {
      toast({ title: "Refresh failed", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMetricClick = (metric: string) => {
    const routes: Record<string, string> = {
      revenue: "/analytics",
      clients: "/clients",
      attention: "/clients?zone=RED",
      pipeline: "/sales-pipeline",
      leads: "/clients",
      calls: "/call-tracking",
      appointments: "/interventions",
      alerts: "/interventions",
    };
    if (routes[metric]) navigate(routes[metric]);
  };

  const isLoading = clientsLoading || revenueLoading;

  return (
    <div className="min-h-screen bg-background">
      {/* Live Ticker at the top */}
      <TickerFeed />
      
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <MissionControlHeader
          title="Executive Dashboard"
          subtitle="Real-time business intelligence at your fingertips"
          isConnected={true}
          lastUpdated={lastUpdated}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 lg:w-auto lg:inline-grid bg-muted/30 p-1 rounded-xl">
            <TabsTrigger value="today" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Calendar className="h-4 w-4 hidden sm:block" />
              <span>Today</span>
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <TrendingUp className="h-4 w-4 hidden sm:block" />
              <span>Sales</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Users className="h-4 w-4 hidden sm:block" />
              <span>Clients</span>
            </TabsTrigger>
            <TabsTrigger value="hubspot" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Zap className="h-4 w-4 hidden sm:block" />
              <span>HubSpot</span>
            </TabsTrigger>
            <TabsTrigger value="revenue" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <CreditCard className="h-4 w-4 hidden sm:block" />
              <span>Revenue</span>
            </TabsTrigger>
          </TabsList>

          {/* Today Tab - Daily Pulse */}
          <TabsContent value="today" className="space-y-6 mt-0">
            <ExecutiveBriefing summary={executiveSummary} />
            <KPIGrid data={kpiData} isLoading={isLoading} onMetricClick={handleMetricClick} />
            <PredictiveAlerts clients={clients || []} summary={dailySummary} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <ClientRiskMatrix clients={clients || []} isLoading={clientsLoading} />
                <DashboardInterventionTracker />
              </div>
              <div className="space-y-6">
                <CoachLeaderboard />
                <LiveActivityFeed />
              </div>
            </div>
          </TabsContent>

          {/* Sales Tab */}
          <TabsContent value="sales" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="border-border/50 bg-card/80">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Sales Pipeline
                    </CardTitle>
                    <CardDescription>Track deals through your sales funnel</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <p>Pipeline visualization loading...</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div>
                <Card className="border-border/50 bg-card/80">
                  <CardHeader>
                    <CardTitle>Quick Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <span className="text-sm text-muted-foreground">Open Deals</span>
                      <span className="font-mono font-bold">{pipelineData?.count || 0}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <span className="text-sm text-muted-foreground">Pipeline Value</span>
                      <span className="font-mono font-bold text-success">AED {(pipelineData?.total || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-muted-foreground">Closed MTD</span>
                      <span className="font-mono font-bold text-success">AED {(revenueData?.total || 0).toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Clients Tab - Enhanced with Traffic Light badges */}
          <TabsContent value="clients" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <LiveHealthDistribution clients={clients || []} isLoading={clientsLoading} />
              </div>
              <div>
                <Card className="border-border/50 bg-card/80">
                  <CardHeader>
                    <CardTitle>Health Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(["GREEN", "YELLOW", "RED", "PURPLE"] as const).map((zone) => {
                      const count = (clients || []).filter((c) => c.health_zone === zone).length;
                      const labels: Record<string, string> = {
                        GREEN: "Healthy",
                        YELLOW: "Warning",
                        RED: "Critical",
                        PURPLE: "VIP",
                      };
                      return (
                        <div key={zone} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                          <div className="flex items-center gap-3">
                            <TrafficLightBadge zone={zone} size="lg" pulsing={zone === "RED" && count > 0} />
                            <span className="font-medium">{labels[zone]}</span>
                          </div>
                          <span className="font-mono font-bold text-lg">{count}</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* HubSpot Tab - Enhanced with live log */}
          <TabsContent value="hubspot" className="space-y-6 mt-0">
            <Card className="border-border/50 bg-card/80">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    HubSpot Live Activity
                  </CardTitle>
                  <CardDescription>Real-time activity from HubSpot CRM</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                  </span>
                  <span className="text-xs font-medium text-success">Connected</span>
                </div>
              </CardHeader>
              <CardContent>
                <LiveActivityFeed />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6 mt-0">
            <LiveRevenueChart />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
