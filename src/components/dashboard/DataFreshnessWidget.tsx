/**
 * Data Freshness SLO Widget
 * Per observability-engineer skill: "SLI/SLO management, executive dashboards"
 *
 * Displays real-time data freshness status for all integrated platforms
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

interface PlatformFreshness {
  platform: string;
  lastSyncAt: string | null;
  ageMinutes: number;
  sloMinutes: number;
  status: "fresh" | "stale" | "critical" | "unknown";
}

const SLO_DEFINITIONS: Record<string, number> = {
  hubspot: 240,
  stripe: 360,
  callgear: 480,
  facebook: 1440,
  anytrack: 720,
};

const STATUS_CONFIG = {
  fresh: {
    icon: CheckCircle2,
    color: "text-green-500",
    badge: "bg-green-500/10 text-green-500",
  },
  stale: {
    icon: AlertTriangle,
    color: "text-yellow-500",
    badge: "bg-yellow-500/10 text-yellow-500",
  },
  critical: {
    icon: XCircle,
    color: "text-red-500",
    badge: "bg-red-500/10 text-red-500",
  },
  unknown: {
    icon: Clock,
    color: "text-muted-foreground",
    badge: "bg-muted text-muted-foreground",
  },
};

function useDataFreshness() {
  return useQuery({
    queryKey: ["data-freshness-slo"],
    queryFn: async (): Promise<PlatformFreshness[]> => {
      const results: PlatformFreshness[] = [];

      for (const [platform, sloMinutes] of Object.entries(SLO_DEFINITIONS)) {
        const { data: syncLog } = await supabase
          .from("sync_logs")
          .select("started_at, status")
          .eq("platform", platform)
          .eq("status", "success")
          .order("started_at", { ascending: false })
          .limit(1);

        const lastSync = syncLog?.[0]?.started_at || null;
        const ageMinutes = lastSync
          ? Math.floor((Date.now() - new Date(lastSync).getTime()) / 60000)
          : -1;

        const status: PlatformFreshness["status"] = !lastSync
          ? "unknown"
          : ageMinutes <= sloMinutes
            ? "fresh"
            : ageMinutes <= sloMinutes * 2
              ? "stale"
              : "critical";

        results.push({
          platform,
          lastSyncAt: lastSync,
          ageMinutes,
          sloMinutes,
          status,
        });
      }

      return results;
    },
    refetchInterval: 60000, // Re-check every minute
  });
}

function formatAge(minutes: number): string {
  if (minutes < 0) return "Never";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

export function DataFreshnessWidget() {
  const { data: platforms, isLoading } = useDataFreshness();

  const breached = platforms?.filter((p) => p.status !== "fresh").length || 0;
  const total = platforms?.length || 0;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Data Freshness SLO
          </CardTitle>
          <Badge
            variant="outline"
            className={
              breached > 0
                ? "bg-red-500/10 text-red-500"
                : "bg-green-500/10 text-green-500"
            }
          >
            {breached === 0 ? "All Fresh" : `${breached}/${total} breached`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && !platforms ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {platforms?.map((p) => {
              const config = STATUS_CONFIG[p.status];
              const StatusIcon = config.icon;

              return (
                <div
                  key={p.platform}
                  className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`h-3.5 w-3.5 ${config.color}`} />
                    <span className="text-sm capitalize font-medium">
                      {p.platform}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatAge(p.ageMinutes)}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${config.badge}`}
                    >
                      SLO:{" "}
                      {p.sloMinutes < 60
                        ? `${p.sloMinutes}m`
                        : `${p.sloMinutes / 60}h`}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DataFreshnessWidget;
