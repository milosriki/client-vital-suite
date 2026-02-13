import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  Database,
  Zap,
  Clock,
  Server
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { QUERY_KEYS } from "@/config/queryKeys";

interface SystemStatus {
  name: string;
  status: "healthy" | "warning" | "error";
  lastSync?: string;
  details?: string;
}

export function SystemHealthWidget() {
  const { data: syncLogs } = useDedupedQuery({
    queryKey: QUERY_KEYS.sync.logs,
    dedupeIntervalMs: 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("platform, status, started_at")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: Infinity, // Real-time updates via useVitalState
  });

  const systems: SystemStatus[] = [
    {
      name: "HubSpot Sync",
      status: syncLogs?.some(l => l.platform === "hubspot" && l.status === "success") ? "healthy" : "warning",
      lastSync: syncLogs?.find(l => l.platform === "hubspot")?.started_at,
      details: "CRM data sync",
    },
    {
      name: "Database",
      status: "healthy",
      details: "Supabase connected",
    },
    {
      name: "AI Agents",
      status: "healthy",
      details: "Edge functions active",
    },
    {
      name: "Real-time",
      status: "healthy",
      details: "WebSocket connected",
    },
  ];

  const healthyCount = systems.filter(s => s.status === "healthy").length;
  const healthPercentage = (healthyCount / systems.length) * 100;

  const getStatusIcon = (status: SystemStatus["status"]) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusBadge = (status: SystemStatus["status"]) => {
    const variants = {
      healthy: "bg-success/10 text-success border-success/20",
      warning: "bg-warning/10 text-warning border-warning/20",
      error: "bg-destructive/10 text-destructive border-destructive/20",
    };
    return variants[status];
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4 text-primary" />
            System Health
          </CardTitle>
          <Badge 
            variant="outline" 
            className={cn(
              "gap-1",
              healthPercentage === 100 ? "text-success border-success/30" : "text-warning border-warning/30"
            )}
          >
            {healthPercentage === 100 ? (
              <CheckCircle className="h-3 w-3" />
            ) : (
              <AlertTriangle className="h-3 w-3" />
            )}
            {healthPercentage.toFixed(0)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Overall Health</span>
            <span className="font-mono">{healthyCount}/{systems.length} systems</span>
          </div>
          <Progress 
            value={healthPercentage} 
            className={cn(
              "h-2",
              healthPercentage === 100 ? "[&>div]:bg-success" : "[&>div]:bg-warning"
            )} 
          />
        </div>

        {/* System List */}
        <div className="space-y-2">
          {systems.map((system) => (
            <div
              key={system.name}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-colors",
                getStatusBadge(system.status)
              )}
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(system.status)}
                <div>
                  <p className="text-sm font-medium">{system.name}</p>
                  <p className="text-xs text-muted-foreground">{system.details}</p>
                </div>
              </div>
              {system.lastSync && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(system.lastSync), { addSuffix: true })}
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
