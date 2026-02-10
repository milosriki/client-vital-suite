import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  Activity,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subHours } from "date-fns";
import { getBusinessDate } from "@/lib/date-utils";
import { EmptyState } from "@/components/ui/empty-state";
import { useAnnounce } from "@/lib/accessibility";

interface AIMetric {
  id: string;
  correlation_id: string;
  function_name: string;
  provider: string | null;
  model: string | null;
  latency_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd_est: number | null;
  status: string;
  error_message: string | null;
  created_at: string | null;
  tags: string[] | null;
}

interface AggregatedStats {
  totalCalls: number;
  successRate: number;
  avgLatency: number;
  totalCost: number;
  byFunction: Record<
    string,
    { count: number; errors: number; avgLatency: number; cost: number }
  >;
  byProvider: Record<string, { count: number; tokens: number; cost: number }>;
}

export default function Observability() {
  const [metrics, setMetrics] = useState<AIMetric[]>([]);
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d">("24h");

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const hoursAgo = timeRange === "1h" ? 1 : timeRange === "24h" ? 24 : 168;
      const since = new Date(
        Date.now() - hoursAgo * 60 * 60 * 1000,
      ).toISOString();

      const { data, error } = await supabase
        .from("ai_execution_metrics")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      setMetrics(data || []);
      calculateStats(data || []);
    } catch (err) {
      console.error("Failed to fetch metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: AIMetric[]) => {
    const byFunction: Record<
      string,
      {
        count: number;
        errors: number;
        avgLatency: number;
        cost: number;
        totalLatency: number;
      }
    > = {};
    const byProvider: Record<
      string,
      { count: number; tokens: number; cost: number }
    > = {};

    let totalLatency = 0;
    let latencyCount = 0;
    let totalCost = 0;
    let successCount = 0;

    data.forEach((m) => {
      // By function
      if (!byFunction[m.function_name]) {
        byFunction[m.function_name] = {
          count: 0,
          errors: 0,
          avgLatency: 0,
          cost: 0,
          totalLatency: 0,
        };
      }
      byFunction[m.function_name].count++;
      if (m.status === "error") byFunction[m.function_name].errors++;
      if (m.latency_ms) {
        byFunction[m.function_name].totalLatency += m.latency_ms;
        totalLatency += m.latency_ms;
        latencyCount++;
      }
      if (m.cost_usd_est) {
        byFunction[m.function_name].cost += Number(m.cost_usd_est);
        totalCost += Number(m.cost_usd_est);
      }

      // By provider
      if (m.provider) {
        if (!byProvider[m.provider]) {
          byProvider[m.provider] = { count: 0, tokens: 0, cost: 0 };
        }
        byProvider[m.provider].count++;
        byProvider[m.provider].tokens +=
          (m.tokens_in || 0) + (m.tokens_out || 0);
        if (m.cost_usd_est)
          byProvider[m.provider].cost += Number(m.cost_usd_est);
      }

      if (m.status === "success") successCount++;
    });

    // Calculate averages
    Object.keys(byFunction).forEach((fn) => {
      byFunction[fn].avgLatency =
        byFunction[fn].count > 0
          ? byFunction[fn].totalLatency / byFunction[fn].count
          : 0;
    });

    setStats({
      totalCalls: data.length,
      successRate: data.length > 0 ? (successCount / data.length) * 100 : 0,
      avgLatency: latencyCount > 0 ? totalLatency / latencyCount : 0,
      totalCost,
      byFunction,
      byProvider,
    });
  };

  useEffect(() => {
    fetchMetrics();
  }, [timeRange]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Success
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      case "timeout":
        return (
          <Badge className="bg-yellow-500">
            <Clock className="w-3 h-3 mr-1" />
            Timeout
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">AI Observability</h1>
          <p className="text-muted-foreground">
            Monitor AI function executions, costs, and performance
          </p>
        </div>
        <div className="flex gap-2">
          <Tabs
            value={timeRange}
            onValueChange={(v) => setTimeRange(v as typeof timeRange)}
          >
            <TabsList>
              <TabsTrigger value="1h">1h</TabsTrigger>
              <TabsTrigger value="24h">24h</TabsTrigger>
              <TabsTrigger value="7d">7d</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={fetchMetrics} variant="outline" size="sm">
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://smith.langchain.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              LangSmith
            </a>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Total Executions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCalls || 0}</div>
            <p className="text-xs text-muted-foreground">in last {timeRange}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.successRate || 0).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats
                ? `${Math.round((stats.totalCalls * stats.successRate) / 100)} successful`
                : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Avg Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.avgLatency || 0).toFixed(0)}ms
            </div>
            <p className="text-xs text-muted-foreground">response time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(stats?.totalCost || 0).toFixed(4)}
            </div>
            <p className="text-xs text-muted-foreground">estimated AI spend</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Function */}
        <Card>
          <CardHeader>
            <CardTitle>By Function</CardTitle>
            <CardDescription>Execution stats per edge function</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {stats?.byFunction &&
                Object.entries(stats.byFunction)
                  .sort((a, b) => b[1].count - a[1].count)
                  .slice(0, 15)
                  .map(([fn, data]) => (
                    <div
                      key={fn}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded"
                    >
                      <div className="flex-1">
                        <code className="text-sm font-mono">{fn}</code>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>{data.count} calls</span>
                          <span>•</span>
                          <span
                            className={data.errors > 0 ? "text-red-500" : ""}
                          >
                            {data.errors} errors
                          </span>
                          <span>•</span>
                          <span>{data.avgLatency.toFixed(0)}ms avg</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium">
                          ${data.cost.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  ))}
              {(!stats?.byFunction ||
                Object.keys(stats.byFunction).length === 0) && (
                <p className="text-muted-foreground text-center py-4">
                  No data yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* By Provider */}
        <Card>
          <CardHeader>
            <CardTitle>By AI Provider</CardTitle>
            <CardDescription>Usage breakdown by provider</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.byProvider &&
                Object.entries(stats.byProvider)
                  .sort((a, b) => b[1].cost - a[1].cost)
                  .map(([provider, data]) => (
                    <div key={provider} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium capitalize">
                          {provider}
                        </span>
                        <span className="text-sm">${data.cost.toFixed(4)}</span>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>{data.count} calls</span>
                        <span>{data.tokens.toLocaleString()} tokens</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${stats.totalCost > 0 ? (data.cost / stats.totalCost) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
              {(!stats?.byProvider ||
                Object.keys(stats.byProvider).length === 0) && (
                <p className="text-muted-foreground text-center py-4">
                  No provider data yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Executions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Executions</CardTitle>
          <CardDescription>Last 50 AI function calls</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {metrics.slice(0, 50).map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition"
              >
                {getStatusBadge(m.status)}
                <div className="flex-1 min-w-0">
                  <code className="text-sm font-mono truncate block">
                    {m.function_name}
                  </code>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {m.provider && (
                      <span className="capitalize">{m.provider}</span>
                    )}
                    {m.model && <span>• {m.model}</span>}
                    {m.latency_ms && <span>• {m.latency_ms}ms</span>}
                    {m.tokens_in && m.tokens_out && (
                      <span>
                        • {m.tokens_in}/{m.tokens_out} tokens
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {m.cost_usd_est && (
                    <div>${Number(m.cost_usd_est).toFixed(6)}</div>
                  )}
                  <div>{new Date(m.created_at).toLocaleTimeString()}</div>
                </div>
                {m.error_message && (
                  <AlertTriangle
                    className="w-4 h-4 text-red-500"
                    title={m.error_message}
                  />
                )}
              </div>
            ))}
            {metrics.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No executions recorded yet</p>
                <p className="text-sm">
                  AI functions will appear here once they run
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
