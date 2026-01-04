import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, TrendingUp, Settings, AlertTriangle, TrendingDown, Users, RefreshCw, Eye, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

interface DashboardTabProps {
  mode: "test" | "live";
}

export default function DashboardTab({ mode }: DashboardTabProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch daily summary
  const { data: summary, refetch: refetchSummary } = useDedupedQuery({
    queryKey: ["daily-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_summary")
        .select("*")
        .order("summary_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch client health scores for quick stats
  const { data: healthStats } = useDedupedQuery({
    queryKey: ["health-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_health_scores")
        .select("health_zone, health_score, health_trend");
      
      if (error) throw error;
      
      const stats = {
        total: data?.length || 0,
        avgScore: data?.length ? data.reduce((acc, c) => acc + (c.health_score || 0), 0) / data.length : 0,
        red: data?.filter(c => c.health_zone === 'red').length || 0,
        yellow: data?.filter(c => c.health_zone === 'yellow').length || 0,
        green: data?.filter(c => c.health_zone === 'green').length || 0,
        purple: data?.filter(c => c.health_zone === 'purple').length || 0,
        improving: data?.filter(c => c.health_trend === 'improving').length || 0,
        declining: data?.filter(c => c.health_trend === 'declining').length || 0,
      };
      return stats;
    },
    dedupeIntervalMs: 1000,
  });

  // PTD Watcher - Run real-time monitoring
  const runPTDWatcher = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ptd-watcher', {
        body: { mode, action: 'watch' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "PTD Watcher", description: data?.message || "Monitoring cycle complete" });
      refetchSummary();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to run PTD watcher", variant: "destructive" });
    }
  });

  // Sync HubSpot Data to Database
  const fetchHubSpotLive = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-hubspot-to-supabase', {
        body: { mode, sync_type: 'all', incremental: true }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ 
        title: "HubSpot Sync Complete", 
        description: `${data?.contacts_synced || 0} contacts, ${data?.deals_synced || 0} deals synced to database` 
      });
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message || "Failed to sync HubSpot data", variant: "destructive" });
    }
  });

  // Run Daily Report
  const runDailyReport = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('daily-report', {
        body: { mode, action: 'generate' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Daily Report Generated", description: data?.message || "Report complete" });
      refetchSummary();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" });
    }
  });

  const stats = healthStats || { total: 0, avgScore: 0, red: 0, yellow: 0, green: 0, purple: 0, improving: 0, declining: 0 };

  return (
    <div className="space-y-6">
      {/* Quick Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow border-primary/20" onClick={() => runPTDWatcher.mutate()}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Run PTD Watcher</p>
                <p className="text-xs text-muted-foreground">Real-time monitoring cycle</p>
              </div>
              {runPTDWatcher.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow border-orange-500/20" onClick={() => fetchHubSpotLive.mutate()}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Zap className="h-5 w-5 text-orange-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Fetch HubSpot Live</p>
                <p className="text-xs text-muted-foreground">Sync latest CRM data</p>
              </div>
              {fetchHubSpotLive.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow border-green-500/20" onClick={() => runDailyReport.mutate()}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Activity className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Generate Daily Report</p>
                <p className="text-xs text-muted-foreground">Create summary report</p>
              </div>
              {runDailyReport.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Company-Wide KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground">Avg Score</p>
            </div>
            <div className="text-3xl font-bold">{stats.avgScore.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total} total clients
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <p className="text-xs font-medium text-muted-foreground">Green Zone</p>
            </div>
            <div className="text-3xl font-bold text-green-500">{stats.green}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <p className="text-xs font-medium text-muted-foreground">Yellow Zone</p>
            </div>
            <div className="text-3xl font-bold text-yellow-500">{stats.yellow}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <p className="text-xs font-medium text-muted-foreground">Red Zone</p>
            </div>
            <div className="text-3xl font-bold text-red-500">{stats.red}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? ((stats.red / stats.total) * 100).toFixed(1) : 0}% at risk
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-purple-500" />
              <p className="text-xs font-medium text-muted-foreground">Trends</p>
            </div>
            <div className="flex gap-2">
              <div>
                <div className="text-xl font-bold text-green-500">↑{stats.improving}</div>
                <p className="text-[10px] text-muted-foreground">Improving</p>
              </div>
              <div>
                <div className="text-xl font-bold text-red-500">↓{stats.declining}</div>
                <p className="text-[10px] text-muted-foreground">Declining</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/analytics')}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Ad Performance (CAPI)</CardTitle>
            </div>
            <CardDescription>View conversion tracking & Meta events</CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/dashboard')}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Activity className="h-5 w-5 text-green-500" />
              </div>
              <CardTitle className="text-lg">Health Intelligence</CardTitle>
            </div>
            <CardDescription>Client health scores & risk analysis</CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/hubspot-live')}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Zap className="h-5 w-5 text-orange-500" />
              </div>
              <CardTitle className="text-lg">HubSpot Live</CardTitle>
            </div>
            <CardDescription>Real-time CRM data & formulas</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Danger Zone (Dev Only) */}
      {mode === "test" && (
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </div>
            <CardDescription>These actions are only available in test mode</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div>
                <p className="font-medium">Pause all sends</p>
                <p className="text-sm text-muted-foreground">Stop all automated workflows</p>
              </div>
              <Button variant="destructive" size="sm">Pause</Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div>
                <p className="font-medium">Flush dev data</p>
                <p className="text-sm text-muted-foreground">Clear all test events and logs</p>
              </div>
              <Button variant="destructive" size="sm">Flush</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}