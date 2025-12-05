import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, TrendingUp, Settings, AlertTriangle, TrendingDown, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface DashboardTabProps {
  mode: "test" | "live";
}

export default function DashboardTab({ mode }: DashboardTabProps) {
  const navigate = useNavigate();

  // Fetch company-wide KPIs from aggregates view
  const { data: kpis } = useQuery({
    queryKey: ["company-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_health_aggregates")
        .select("*")
        .single();
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  return (
    <div className="space-y-6">
      {/* Company-Wide KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground">Avg Score</p>
            </div>
            <div className="text-3xl font-bold">{kpis?.company_avg_score?.toFixed(1) || "N/A"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Median: {kpis?.median_health_score?.toFixed(1) || "N/A"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <p className="text-xs font-medium text-muted-foreground">Green Zone</p>
            </div>
            <div className="text-3xl font-bold text-green-500">{kpis?.green_count || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <p className="text-xs font-medium text-muted-foreground">Yellow Zone</p>
            </div>
            <div className="text-3xl font-bold text-yellow-500">{kpis?.yellow_count || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <p className="text-xs font-medium text-muted-foreground">Red Zone</p>
            </div>
            <div className="text-3xl font-bold text-red-500">{kpis?.red_count || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis?.red_pct?.toFixed(1)}% at risk
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
                <div className="text-xl font-bold text-green-500">
                  ↑{kpis?.clients_improving || 0}
                </div>
                <p className="text-[10px] text-muted-foreground">Improving</p>
              </div>
              <div>
                <div className="text-xl font-bold text-red-500">
                  ↓{kpis?.clients_declining || 0}
                </div>
                <p className="text-[10px] text-muted-foreground">Declining</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
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

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Settings className="h-5 w-5 text-blue-500" />
              </div>
              <CardTitle className="text-lg">Automation</CardTitle>
            </div>
            <CardDescription>Workflows & scheduled tasks</CardDescription>
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
            <CardDescription>
              These actions are only available in test mode
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div>
                <p className="font-medium">Pause all sends</p>
                <p className="text-sm text-muted-foreground">
                  Stop all automated workflows
                </p>
              </div>
              <Button variant="destructive" size="sm">
                Pause
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div>
                <p className="font-medium">Flush dev data</p>
                <p className="text-sm text-muted-foreground">
                  Clear all test events and logs
                </p>
              </div>
              <Button variant="destructive" size="sm">
                Flush
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
