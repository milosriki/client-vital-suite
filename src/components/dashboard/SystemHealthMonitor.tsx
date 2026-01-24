import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  RefreshCw,
  Server,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SystemHealth {
  status: "healthy" | "degraded" | "critical";
  sync_errors: number;
  api_latency: number;
  last_sync: string;
  active_alerts: Alert[];
}

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: string;
  source: string;
}

export function SystemHealthMonitor() {
  const { data: health } = useQuery({
    queryKey: ["system-health"],
    queryFn: async (): Promise<SystemHealth> => {
      // 1. Check sync errors
      const { count: errorCount } = await supabase
        .from("sync_errors")
        .select("*", { count: "exact", head: true })
        .eq("resolved", false);

      // 2. Check recent API logs for latency (simulated for now)
      const latency = Math.floor(Math.random() * 100) + 50; // ms

      // 3. Generate alerts based on real data
      const alerts: Alert[] = [];

      if ((errorCount || 0) > 5) {
        alerts.push({
          id: "sync-1",
          severity: "critical",
          message: `${errorCount} unresolved sync errors detected`,
          timestamp: new Date().toISOString(),
          source: "HubSpot Sync",
        });
      }

      // Check for "Silent Failures" (e.g. no leads in 24h)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { count: recentLeads } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .gte("created_at", yesterday.toISOString());

      if (recentLeads === 0) {
        alerts.push({
          id: "leads-1",
          severity: "warning",
          message: "No new leads received in last 24 hours",
          timestamp: new Date().toISOString(),
          source: "Lead Pipeline",
        });
      }

      // Determine overall status
      let status: SystemHealth["status"] = "healthy";
      if (alerts.some((a) => a.severity === "critical")) status = "critical";
      else if (alerts.some((a) => a.severity === "warning"))
        status = "degraded";

      return {
        status,
        sync_errors: errorCount || 0,
        api_latency: latency,
        last_sync: new Date().toISOString(), // In a real app, query the last sync log
        active_alerts: alerts,
      };
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  if (!health)
    return (
      <div className="h-[300px] flex items-center justify-center">
        Loading system health...
      </div>
    );

  return (
    <Card className="h-full border-l-4 border-l-primary">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" />
            System Health Monitor
          </CardTitle>
          <Badge
            variant={health.status === "healthy" ? "outline" : "destructive"}
            className={
              health.status === "healthy"
                ? "text-green-600 border-green-600"
                : ""
            }
          >
            {health.status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <XCircle className="h-3 w-3" /> Sync Errors
            </span>
            <p className="text-2xl font-bold">{health.sync_errors}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="h-3 w-3" /> Latency
            </span>
            <p className="text-2xl font-bold">{health.api_latency}ms</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Last Sync
            </span>
            <p className="text-sm font-medium">Just now</p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Active Alerts
          </h4>
          <ScrollArea className="h-[150px]">
            {health.active_alerts.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-600 p-2 bg-green-50 rounded-md">
                <CheckCircle className="h-4 w-4" />
                All systems operational
              </div>
            ) : (
              <div className="space-y-2">
                {health.active_alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-2 rounded-md border text-sm flex items-start gap-2 ${
                      alert.severity === "critical"
                        ? "bg-red-50 border-red-200 text-red-800"
                        : "bg-yellow-50 border-yellow-200 text-yellow-800"
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">{alert.message}</p>
                      <p className="text-xs opacity-80">
                        {alert.source} •{" "}
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
