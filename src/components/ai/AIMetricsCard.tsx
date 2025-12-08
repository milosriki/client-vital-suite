import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, DollarSign, Clock, Brain } from "lucide-react";

interface AgentMetric {
  id: string;
  date: string;
  agent_type: string;
  queries_count: number;
  tokens_input: number;
  tokens_output: number;
  avg_response_time_ms: number | null;
  decisions_made: number;
  successful_decisions: number;
  helpful_responses: number;
  estimated_cost_usd: number;
  created_at: string;
}

export function AIMetricsCard() {
  // Fetch today's metrics
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["agent-metrics-today"],
    queryFn: async (): Promise<AgentMetric[]> => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const { data, error } = await (supabase as any)
          .from("agent_metrics")
          .select("*")
          .eq("date", today);

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.info("agent_metrics table not yet created");
            return [];
          }
          throw error;
        }

        return (data || []) as AgentMetric[];
      } catch (e) {
        console.error("Error fetching metrics:", e);
        return [];
      }
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Calculate aggregated metrics
  const totalQueries = metrics?.reduce((acc, m) => acc + m.queries_count, 0) || 0;
  const totalTokensInput = metrics?.reduce((acc, m) => acc + m.tokens_input, 0) || 0;
  const totalTokensOutput = metrics?.reduce((acc, m) => acc + m.tokens_output, 0) || 0;
  const totalDecisions = metrics?.reduce((acc, m) => acc + m.decisions_made, 0) || 0;
  const totalSuccessful = metrics?.reduce((acc, m) => acc + m.successful_decisions, 0) || 0;
  const totalCost = metrics?.reduce((acc, m) => acc + m.estimated_cost_usd, 0) || 0;
  const avgResponseTime =
    metrics && metrics.length > 0
      ? metrics
          .filter((m) => m.avg_response_time_ms !== null)
          .reduce((acc, m) => acc + (m.avg_response_time_ms || 0), 0) / metrics.length
      : 0;
  const successRate =
    totalDecisions > 0 ? ((totalSuccessful / totalDecisions) * 100).toFixed(1) : "0.0";

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-purple-500/5 to-background">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          AI Performance Today
        </CardTitle>
        <CardDescription>
          Real-time metrics from AI agents
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Query Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-600" />
              <p className="text-xs text-muted-foreground">Queries</p>
            </div>
            <p className="text-2xl font-bold">{totalQueries}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <p className="text-xs text-muted-foreground">Success Rate</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{successRate}%</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <p className="text-xs text-muted-foreground">Avg Response</p>
            </div>
            <p className="text-2xl font-bold">
              {avgResponseTime > 0 ? `${avgResponseTime.toFixed(0)}ms` : "N/A"}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-orange-600" />
              <p className="text-xs text-muted-foreground">Cost</p>
            </div>
            <p className="text-2xl font-bold">
              ${totalCost.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Token Usage */}
        <div className="pt-4 border-t">
          <p className="text-sm font-semibold mb-2">Token Usage</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Input Tokens:</p>
              <p className="font-semibold">{totalTokensInput.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Output Tokens:</p>
              <p className="font-semibold">{totalTokensOutput.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Agent Breakdown */}
        {metrics && metrics.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-semibold mb-2">Active Agents</p>
            <div className="flex flex-wrap gap-2">
              {metrics.map((metric) => (
                <Badge key={metric.id} variant="outline">
                  {metric.agent_type}: {metric.queries_count} queries
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!metrics || metrics.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No AI activity recorded today</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
