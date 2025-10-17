import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MetricCard } from "@/components/MetricCard";
import { HealthChart } from "@/components/HealthChart";
import { InterventionTracker } from "@/components/InterventionTracker";
import { WeeklyAnalytics } from "@/components/WeeklyAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Users, Heart, AlertTriangle, DollarSign, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRealtimeHealthScores } from "@/hooks/useRealtimeHealthScores";
import type { DailySummary, ClientHealthScore, CoachPerformance } from "@/types/database";

const Overview = () => {
  // Enable real-time updates
  useRealtimeHealthScores();

  // Fetch daily summary
  const { data: summary, isLoading: summaryLoading, error: summaryError, refetch: refetchSummary } = useQuery<DailySummary | null>({
    queryKey: ['daily-summary'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await (supabase as any)
        .from('daily_summary')
        .select('*')
        .eq('summary_date', today)
        .maybeSingle();
      
      if (error) throw error;
      return data as DailySummary | null;
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch critical clients (RED zone)
  const { data: criticalClients, refetch: refetchCritical } = useQuery<ClientHealthScore[]>({
    queryKey: ['critical-clients'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await (supabase as any)
        .from('client_health_scores')
        .select('*')
        .eq('health_zone', 'RED')
        .eq('calculated_at::date', today)
        .order('health_score', { ascending: true })
        .limit(10);

      if (error) throw error;
      return (data as ClientHealthScore[]) || [];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch coach performance
  const { data: coaches, refetch: refetchCoaches } = useQuery<CoachPerformance[]>({
    queryKey: ['coach-performance'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await (supabase as any)
        .from('coach_performance')
        .select('*')
        .eq('report_date', today)
        .order('avg_client_health', { ascending: false });

      if (error) throw error;
      return (data as CoachPerformance[]) || [];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch interventions
  const { data: interventions = [], refetch: refetchInterventions } = useQuery({
    queryKey: ['interventions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intervention_log')
        .select('*')
        .order('intervention_date', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch weekly patterns
  const { data: weeklyPatterns = [], refetch: refetchWeekly } = useQuery({
    queryKey: ['weekly-patterns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_patterns')
        .select('*')
        .order('week_start_date', { ascending: false })
        .limit(4);
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const handleRefresh = () => {
    refetchSummary();
    refetchCritical();
    refetchCoaches();
    refetchInterventions();
    refetchWeekly();
  };

  const getHealthColor = (zone: string) => {
    switch (zone) {
      case 'RED': return 'bg-[#ef4444] text-white';
      case 'YELLOW': return 'bg-[#eab308] text-white';
      case 'GREEN': return 'bg-[#22c55e] text-white';
      case 'PURPLE': return 'bg-[#a855f7] text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  if (summaryLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
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
            <p className="text-destructive mb-4">Failed to load dashboard data</p>
            <Button onClick={handleRefresh}>Try Again</Button>
          </Card>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-2">No data yet</p>
            <p className="text-sm text-muted-foreground">Run your n8n workflow to populate the database.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">PTD Fitness Dashboard</h1>
            <p className="text-muted-foreground">Client Health Score Overview</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              Export Report
            </Button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Active Clients"
            value={summary?.total_active_clients ?? 0}
            icon={Users}
            iconColor="text-blue-600"
            iconBg="bg-blue-100"
          />
          <MetricCard
            title="Average Health Score"
            value={(summary?.avg_health_score ?? 0).toFixed(1)}
            icon={Heart}
            iconColor={(summary?.avg_health_score ?? 0) >= 70 ? 'text-green-600' : (summary?.avg_health_score ?? 0) >= 50 ? 'text-yellow-600' : 'text-red-600'}
            iconBg={(summary?.avg_health_score ?? 0) >= 70 ? 'bg-green-100' : (summary?.avg_health_score ?? 0) >= 50 ? 'bg-yellow-100' : 'bg-red-100'}
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
            value={`AED ${(summary?.at_risk_revenue ?? 0).toLocaleString()}`}
            icon={DollarSign}
            iconColor="text-orange-600"
            iconBg="bg-orange-100"
          />
        </div>

        {/* Middle Section */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Health Distribution Chart */}
          <div className="lg:col-span-3">
            <HealthChart
              data={{
                red: summary?.red_clients ?? 0,
                yellow: summary?.yellow_clients ?? 0,
                green: summary?.green_clients ?? 0,
                purple: summary?.purple_clients ?? 0,
              }}
              total={summary?.total_active_clients ?? 0}
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
                    <div key={client.id} className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold">{client.client_name}</p>
                          <p className="text-sm text-muted-foreground">{client.client_email}</p>
                        </div>
                        <Badge className={getHealthColor(client.health_zone)}>
                          {client.health_score.toFixed(0)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {client.days_since_last_session ? `${client.days_since_last_session} days since last session` : 'No recent sessions'}
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
          <InterventionTracker interventions={interventions} />
          <WeeklyAnalytics patterns={weeklyPatterns} />
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
                    <tr key={coach.id} className="border-b hover:bg-accent/50 transition-colors">
                      <td className="py-3 px-4 font-medium">{coach.coach_name}</td>
                      <td className="text-center py-3 px-4">{coach.total_clients}</td>
                      <td className={`text-center py-3 px-4 font-semibold ${getScoreColor(coach.avg_client_health)}`}>
                        {coach.avg_client_health?.toFixed(1)}
                      </td>
                      <td className="text-center py-3 px-4 text-red-500 font-semibold">{coach.red_clients}</td>
                      <td className="text-center py-3 px-4 text-yellow-500 font-semibold">{coach.yellow_clients}</td>
                      <td className="text-center py-3 px-4 text-green-500 font-semibold">{coach.green_clients}</td>
                      <td className="text-center py-3 px-4 text-purple-500 font-semibold">{coach.purple_clients}</td>
                      <td className="text-center py-3 px-4">
                        <div className="flex justify-center">
                          {getTrendIcon(coach.trend)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!coaches || coaches.length === 0) && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground">
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
