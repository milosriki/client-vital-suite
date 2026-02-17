import { useState } from "react";
import { Activity, Cpu, ShieldCheck, Code, RefreshCw, AlertCircle, Database } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/layout/DashboardHeader";
import { MetricCard } from "@/components/dashboard/cards/MetricCard";
import { useSystemObservability } from "@/hooks/enterprise/useSystemObservability";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type TimeRange = '1h' | '24h' | '7d';

export default function SystemObservability() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const { functions, globalStats, isLoading } = useSystemObservability(timeRange);

  if (isLoading) {
    return (
      <div className="p-6 space-y-8 bg-background min-h-screen">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-background min-h-screen text-foreground">
      <div className="flex justify-between items-center">
        <DashboardHeader title="System Observability" description="Monitoring 143 Edge Functions and the Revenue Genome" />
        <div className="flex gap-2">
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <TabsList>
              <TabsTrigger value="1h">1h</TabsTrigger>
              <TabsTrigger value="24h">24h</TabsTrigger>
              <TabsTrigger value="7d">7d</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Success Rate" value={`${globalStats.successRate}%`} icon={ShieldCheck} />
        <MetricCard label="Avg Latency" value={`${globalStats.avgLatency}ms`} icon={Activity} />
        <MetricCard label="Total Calls" value={globalStats.totalCalls.toLocaleString()} icon={Cpu} />
        <MetricCard label="Total Cost" value={`AED ${Number(globalStats?.totalCost ?? 0).toFixed(4)}`} icon={Database} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Function Registry */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-border bg-card">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Code className="w-4 h-4 text-primary" /> Edge Function Registry
            </h3>
          </div>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {(functions.data ?? []).slice(0, 20).map(fn => (
              <div key={fn.function_name} className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/50 hover:border-border transition-all">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    fn.status === 'healthy' ? "bg-emerald-500" : fn.status === 'warning' ? "bg-amber-500" : "bg-destructive"
                  )} />
                  <div>
                    <div className="text-sm font-bold font-mono">{fn.function_name}</div>
                    <div className="text-xs text-muted-foreground">{fn.total_calls} calls &middot; {fn.error_count} errors</div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <div className="text-xs font-bold font-mono">{fn.avg_latency_ms}ms</div>
                    <div className="text-xs text-muted-foreground">Latency</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold font-mono">${Number(fn?.total_cost ?? 0).toFixed(4)}</div>
                    <div className="text-xs text-muted-foreground">Cost</div>
                  </div>
                </div>
              </div>
            ))}
            {(functions.data ?? []).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No executions recorded in this window</p>
              </div>
            )}
          </div>
        </div>

        {/* Sync Cycle Monitor */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-border bg-card">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6">Materialized Truth Sync</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-xs uppercase font-bold text-muted-foreground">
                  <span>Refresh Cycle</span>
                  <span>Every 15m</span>
                </div>
                <Progress value={80} className="h-1 bg-muted" />
              </div>
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 text-primary mb-2">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span className="text-xs font-bold uppercase">pg_cron Active</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  mv_enterprise_truth_genome refreshes every 15 minutes via REFRESH CONCURRENTLY
                </p>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="p-6 rounded-2xl border border-destructive/20 bg-destructive/5">
            <h3 className="text-sm font-bold text-destructive uppercase tracking-widest mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Critical Alerts
            </h3>
            <div className="space-y-3">
              {(functions.data ?? []).filter(f => f.status === 'error').length > 0 ? (
                (functions.data ?? []).filter(f => f.status === 'error').slice(0, 3).map(fn => (
                  <p key={fn.function_name} className="text-xs text-muted-foreground leading-relaxed font-mono">
                    <span className="text-destructive font-bold">ERROR:</span> {fn.function_name} &mdash; {fn.error_count} failures
                  </p>
                ))
              ) : (
                <p className="text-xs text-emerald-400">All systems operational</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
