import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "@/components/MetricCard";
import { ZoneDistributionBar } from "@/components/ZoneDistributionBar";
import { EnhancedInterventionTracker } from "@/components/dashboard/EnhancedInterventionTracker";
import { WeeklyAnalytics } from "@/components/WeeklyAnalytics";
// import { TestDataAlert } from "@/components/dashboard/TestDataAlert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Heart,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Download,
} from "lucide-react";
import { useRealtimeHealthScores } from "@/hooks/useRealtimeHealthScores";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import type {
  DailySummary,
  ClientHealthScore,
  CoachPerformance,
} from "@/types/database";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { QUERY_KEYS } from "@/config/queryKeys";
import { getBusinessTodayString, getBusinessDate } from "@/lib/date-utils";

const Overview = () => {
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupStatus, setSetupStatus] = useState("");
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [zoneFilter, setZoneFilter] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Enable real-time updates
  useRealtimeHealthScores();

  // Fetch daily summary - try today first, fallback to latest available
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useDedupedQuery<DailySummary | null>({
    queryKey: QUERY_KEYS.summaries.daily,
    queryFn: async () => {
      const today = getBusinessTodayString(); // Dubai Time

      // Try today first
      const { data: todayData, error: todayError } = await (supabase as any)
        .from("daily_summary")
        .select("*")
        .eq("summary_date", today)
        .maybeSingle();

      if (todayData) {
        return todayData as DailySummary;
      }

      // Fallback to latest available summary
      const { data: latestData, error: latestError } = await (supabase as any)
        .from("daily_summary")
        .select("*")
        .order("summary_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestError) throw latestError;
      return latestData as DailySummary | null;
    },
    staleTime: Infinity, // Real-time updates via useRealtimeHealthScores
  });

  // Fetch critical clients (RED zone) - use latest available date
  const { data: criticalClients, refetch: refetchCritical } = useDedupedQuery<
    ClientHealthScore[]
  >({
    queryKey: QUERY_KEYS.clients.critical,
    queryFn: async () => {
      // Get latest calculated_on date first
      const { data: latestDateRows } = await (supabase as any)
        .from("client_health_scores")
        .select("calculated_on")
        .order("calculated_on", { ascending: false })
        .limit(1);

      const latestDate = latestDateRows?.[0]?.calculated_on;
      if (!latestDate) return [];

      const { data, error } = await (supabase as any)
        .from("client_health_scores")
        .select("*")
        .eq("health_zone", "RED")
        .eq("calculated_on", latestDate)
        .order("health_score", { ascending: true })
        .limit(10);

      if (error) throw error;
      return (data as ClientHealthScore[]) || [];
    },
    staleTime: Infinity, // Real-time updates via useRealtimeHealthScores
  });

  // Fetch coach performance - use latest available date
  const { data: coaches, refetch: refetchCoaches } = useDedupedQuery<
    CoachPerformance[]
  >({
    queryKey: QUERY_KEYS.coaches.performance,
    queryFn: async () => {
      // Try today first
      const today = getBusinessTodayString();
      const { data: todayData } = await (supabase as any)
        .from("coach_performance")
        .select("*")
        .eq("report_date", today)
        .order("avg_client_health", { ascending: false });

      if (todayData && todayData.length > 0) {
        return todayData as CoachPerformance[];
      }

      // Fallback to latest available
      const { data, error } = await (supabase as any)
        .from("coach_performance")
        .select("*")
        .order("report_date", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data as CoachPerformance[]) || [];
    },
    staleTime: Infinity, // Real-time updates via useRealtimeHealthScores
  });

  // Fetch interventions
  const {
    data: interventions = [],
    isLoading: interventionsLoading,
    refetch: refetchInterventions,
  } = useDedupedQuery({
    queryKey: QUERY_KEYS.interventions.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intervention_log")
        .select("*")
        .order("intervention_date", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    staleTime: Infinity, // Real-time updates via useRealtimeHealthScores
  });

  // Fetch weekly health summary (aggregated from daily_summary)
  const { data: weeklyPatterns = [], refetch: refetchWeekly } = useDedupedQuery(
    {
      queryKey: QUERY_KEYS.patterns.weekly,
      queryFn: async () => {
        const { data, error } = await (supabase as any)
          .from("weekly_health_summary")
          .select("*")
          .order("week_start", { ascending: false })
          .limit(4);

        if (error) throw error;
        return data || [];
      },
      staleTime: Infinity, // Real-time updates via useRealtimeHealthScores
    },
  );

  const handleRefresh = () => {
    refetchSummary();
    refetchCritical();
    refetchCoaches();
    refetchInterventions();
    refetchWeekly();
  };

  const handleSetupWorkflows = async () => {
    setSetupLoading(true);
    setErrorDetails(null);

    try {
      
      setSetupStatus("Checking database connection...");
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Simply refresh the data from Supabase
      setSetupStatus("Fetching latest data...");
      await refetchSummary();
      await refetchCritical();
      await refetchCoaches();
      await refetchInterventions();
      await refetchWeekly();

      setSetupStatus("Success! Dashboard ready.");
      toast({
        title: "Data Refreshed",
        description: "Dashboard data has been refreshed from the database.",
      });

      await new Promise((resolve) => setTimeout(resolve, 500));
      setSetupStatus("");
    } catch (error) {
      console.error("Refresh error:", error);

      setErrorDetails({
        type: "Data Refresh Error",
        message: error instanceof Error ? error.message : "Unknown error",
        error,
        timestamp: getBusinessDate().toISOString(),
      });

      toast({
        title: "Refresh Failed",
        description:
          error instanceof Error ? error.message : "Failed to refresh data",
        variant: "destructive",
      });
      setSetupStatus("");
    } finally {
      setSetupLoading(false);
    }
  };

  const getHealthColor = (zone: string) => {
    switch (zone) {
      case "RED":
        return "bg-[#ef4444] text-white";
      case "YELLOW":
        return "bg-[#eab308] text-white";
      case "GREEN":
        return "bg-[#22c55e] text-white";
      case "PURPLE":
        return "bg-[#a855f7] text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case "improving":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleExportReport = () => {
    if (!summary) {
      toast({
        title: "No data to export",
        description: "Please wait for the dashboard data to load.",
        variant: "destructive",
      });
      return;
    }

    const reportData = {
      generatedAt: format(new Date(), "PPpp"),
      summary: {
        totalActiveClients: summary.total_clients,
        avgHealthScore: summary.avg_health_score?.toFixed(1),
        criticalInterventions: summary.critical_interventions,
        atRiskRevenue: summary.at_risk_revenue_aed,
        redClients: summary.clients_red,
        yellowClients: summary.clients_yellow,
        greenClients: summary.clients_green,
        purpleClients: summary.clients_purple,
      },
      criticalClients:
        criticalClients?.map((c) => ({
          name: `${c.firstname || ""} ${c.lastname || ""}`.trim(),
          email: c.email,
          healthScore: c.health_score,
          healthZone: c.health_zone,
          daysSinceLastSession: c.days_since_last_session,
        })) || [],
      coachPerformance:
        coaches?.map((c) => ({
          coachName: c.coach_name,
          totalClients: c.total_clients,
          avgHealth: c.avg_client_health?.toFixed(1),
          redClients: c.clients_red,
          yellowClients: c.clients_yellow,
          greenClients: c.clients_green,
          purpleClients: c.clients_purple,
        })) || [],
    };

    const csvContent = [
      "PTD Client Health Score Report",
      `Generated: ${reportData.generatedAt}`,
      "",
      "Summary",
      `Total Active Clients,${reportData.summary.totalActiveClients}`,
      `Average Health Score,${reportData.summary.avgHealthScore}`,
      `Critical Interventions,${reportData.summary.criticalInterventions}`,
      `At-Risk Revenue (AED),${reportData.summary.atRiskRevenue}`,
      `Red Zone Clients,${reportData.summary.redClients}`,
      `Yellow Zone Clients,${reportData.summary.yellowClients}`,
      `Green Zone Clients,${reportData.summary.greenClients}`,
      `Purple Zone Clients,${reportData.summary.purpleClients}`,
      "",
      "Critical Clients",
      "Name,Email,Health Score,Zone,Days Since Last Session",
      ...reportData.criticalClients.map(
        (c) =>
          `${c.name},${c.email},${c.healthScore},${c.healthZone},${c.daysSinceLastSession || "N/A"}`,
      ),
      "",
      "Coach Performance",
      "Coach Name,Total Clients,Avg Health,Red,Yellow,Green,Purple",
      ...reportData.coachPerformance.map(
        (c) =>
          `${c.coachName},${c.totalClients},${c.avgHealth},${c.redClients},${c.yellowClients},${c.greenClients},${c.purpleClients}`,
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ptd-health-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast({
      title: "Report exported",
      description: "The health score report has been downloaded as CSV.",
    });
  };

  if (summaryLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (summaryError) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="p-12 text-center">
            <p className="text-destructive mb-4">
              Failed to load dashboard data
            </p>
            <Button onClick={handleRefresh}>Try Again</Button>
          </Card>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[80vh]">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <RefreshCw className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>No Data Available</CardTitle>
              <CardDescription>
                No daily summary found for today. Data may need to be synced
                from HubSpot.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {setupStatus && (
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">{setupStatus}</p>
                </div>
              )}
              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={handleSetupWorkflows}
                  disabled={setupLoading}
                >
                  {setupLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh Data
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/hubspot-live")}
                >
                  Go to HubSpot Live
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Details Modal */}
        {showErrorModal && errorDetails && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowErrorModal(false)}
          >
            <Card
              className="max-w-3xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader>
                <CardTitle>Error Details</CardTitle>
                <CardDescription>
                  {errorDetails.type} - {errorDetails.timestamp}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 overflow-y-auto max-h-[60vh]">
                <div>
                  <h3 className="font-semibold mb-2">Error Message</h3>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                    {errorDetails.message}
                  </pre>
                </div>

                {errorDetails.executionError && (
                  <div>
                    <h3 className="font-semibold mb-2">Execution Details</h3>
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                      {JSON.stringify(errorDetails.executionError, null, 2)}
                    </pre>
                  </div>
                )}

                {errorDetails.workflowErrors &&
                  errorDetails.workflowErrors.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Workflow Errors</h3>
                      <div className="space-y-2">
                        {errorDetails.workflowErrors.map(
                          (w: any, i: number) => (
                            <div key={i} className="bg-muted p-3 rounded-lg">
                              <p className="font-medium">{w.workflow}</p>
                              <p className="text-sm text-muted-foreground">
                                {w.message}
                              </p>
                              {w.details && (
                                <pre className="mt-2 text-xs overflow-x-auto">
                                  {w.details}
                                </pre>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                <div>
                  <h3 className="font-semibold mb-2">Full Response</h3>
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(
                      errorDetails.fullResponse || errorDetails,
                      null,
                      2,
                    )}
                  </pre>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setShowErrorModal(false)}>
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify(errorDetails, null, 2),
                      );
                      toast({ title: "Copied to clipboard" });
                    }}
                  >
                    Copy Error
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              PTD Client Health Score Dashboard
            </h1>
            <div className="flex items-center gap-4 text-muted-foreground">
              <p>Client Health Score Overview</p>
              <span>•</span>
              <p className="text-sm">
                Last updated: {format(new Date(), "PPp")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportReport}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Active Clients"
            value={summary?.total_clients ?? 0}
            icon={Users}
            iconColor="text-blue-600"
            iconBg="bg-blue-100"
          />
          <MetricCard
            title="Average Health Score"
            value={(summary?.avg_health_score ?? 0).toFixed(1)}
            icon={Heart}
            iconColor={
              (summary?.avg_health_score ?? 0) >= 70
                ? "text-green-600"
                : (summary?.avg_health_score ?? 0) >= 50
                  ? "text-yellow-600"
                  : "text-red-600"
            }
            iconBg={
              (summary?.avg_health_score ?? 0) >= 70
                ? "bg-green-100"
                : (summary?.avg_health_score ?? 0) >= 50
                  ? "bg-yellow-100"
                  : "bg-red-100"
            }
          />
          <MetricCard
            title="Critical Interventions"
            value={summary?.critical_interventions ?? 0}
            icon={AlertTriangle}
            iconColor="text-red-600"
            iconBg="bg-red-100"
          />
          <MetricCard
            title="At-Risk Revenue"
            value={`AED ${(summary?.at_risk_revenue_aed ?? 0).toLocaleString()}`}
            icon={DollarSign}
            iconColor="text-orange-600"
            iconBg="bg-orange-100"
          />
        </div>

        {/* Middle Section */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Health Distribution Chart */}
          <div className="lg:col-span-3">
            <ZoneDistributionBar
              data={{
                RED: summary?.clients_red ?? 0,
                YELLOW: summary?.clients_yellow ?? 0,
                GREEN: summary?.clients_green ?? 0,
                PURPLE: summary?.clients_purple ?? 0,
              }}
              total={summary?.total_clients ?? 0}
              onZoneClick={(zone) => {
                setZoneFilter(zone);
                navigate("/clients");
              }}
            />
          </div>

          {/* Critical Interventions List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Critical Interventions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {criticalClients?.map((client) => (
                    <div
                      key={client.id}
                      className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold">
                            {`${client.firstname || ""} ${client.lastname || ""}`.trim() ||
                              "Unknown Client"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {client.email}
                          </p>
                        </div>
                        <Badge className={getHealthColor(client.health_zone)}>
                          {client.health_score.toFixed(0)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {client.days_since_last_session
                          ? `${client.days_since_last_session} days since last session`
                          : "No recent sessions"}
                      </p>
                      <Button variant="outline" size="sm" className="w-full">
                        View Details
                      </Button>
                    </div>
                  ))}
                  {(!criticalClients || criticalClients.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">
                      No critical interventions at this time
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Interventions & Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EnhancedInterventionTracker
            interventions={interventions as any}
            isLoading={interventionsLoading}
          />
          <WeeklyAnalytics patterns={weeklyPatterns as any} />
        </div>

        {/* Coach Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Coach Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Coach Name</th>
                    <th className="text-center py-3 px-4">Total Clients</th>
                    <th className="text-center py-3 px-4">Avg Health</th>
                    <th className="text-center py-3 px-4">RED</th>
                    <th className="text-center py-3 px-4">YELLOW</th>
                    <th className="text-center py-3 px-4">GREEN</th>
                    <th className="text-center py-3 px-4">PURPLE</th>
                    <th className="text-center py-3 px-4">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {coaches?.map((coach) => (
                    <tr
                      key={coach.id}
                      className="border-b hover:bg-accent/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium">
                        {coach.coach_name}
                      </td>
                      <td className="text-center py-3 px-4">
                        {coach.total_clients}
                      </td>
                      <td
                        className={`text-center py-3 px-4 font-semibold ${getScoreColor(coach.avg_client_health ?? 0)}`}
                      >
                        {coach.avg_client_health?.toFixed(1)}
                      </td>
                      <td className="text-center py-3 px-4 text-red-500 font-semibold">
                        {coach.clients_red}
                      </td>
                      <td className="text-center py-3 px-4 text-yellow-500 font-semibold">
                        {coach.clients_yellow}
                      </td>
                      <td className="text-center py-3 px-4 text-green-500 font-semibold">
                        {coach.clients_green}
                      </td>
                      <td className="text-center py-3 px-4 text-purple-500 font-semibold">
                        {coach.clients_purple}
                      </td>
                      <td className="text-center py-3 px-4">
                        <div className="flex justify-center">
                          {getTrendIcon(coach.health_trend)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!coaches || coaches.length === 0) && (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No coach data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Overview;
