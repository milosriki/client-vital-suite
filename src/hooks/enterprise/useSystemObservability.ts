import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { QUERY_KEYS } from "@/config/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import type { FunctionHealthRecord } from "@/types/enterprise";

export function useSystemObservability(timeRange: '1h' | '24h' | '7d' = '24h') {
  const hoursAgo = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : 168;
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

  const functions = useDedupedQuery({
    queryKey: QUERY_KEYS.systemObservability.functions(timeRange),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_execution_metrics")
        .select("id, function_name, provider, model, latency_ms, tokens_in, tokens_out, cost_usd_est, status, error_message, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      // Aggregate by function
      const byFunction = new Map<string, FunctionHealthRecord>();
      (data || []).forEach(m => {
        const existing = byFunction.get(m.function_name) || {
          function_name: m.function_name,
          status: 'healthy' as const,
          avg_latency_ms: 0,
          last_run: m.created_at || '',
          total_calls: 0,
          error_count: 0,
          total_cost: 0,
        };
        existing.total_calls++;
        if (m.status === 'error') existing.error_count++;
        if (m.latency_ms) existing.avg_latency_ms += m.latency_ms;
        if (m.cost_usd_est) existing.total_cost += Number(m.cost_usd_est);
        byFunction.set(m.function_name, existing);
      });

      // Calculate averages and status
      return Array.from(byFunction.values()).map(fn => ({
        ...fn,
        avg_latency_ms: fn.total_calls > 0 ? Math.round(fn.avg_latency_ms / fn.total_calls) : 0,
        status: fn.error_count > fn.total_calls * 0.1 ? 'error' : fn.error_count > 0 ? 'warning' : 'healthy',
      })).sort((a, b) => b.total_calls - a.total_calls) as FunctionHealthRecord[];
    },
  });

  const globalStats = {
    totalCalls: (functions.data || []).reduce((sum, f) => sum + f.total_calls, 0),
    successRate: (() => {
      const fns = functions.data || [];
      const total = fns.reduce((sum, f) => sum + f.total_calls, 0);
      const errors = fns.reduce((sum, f) => sum + f.error_count, 0);
      return total > 0 ? ((total - errors) / total * 100).toFixed(1) : '0';
    })(),
    avgLatency: (() => {
      const fns = functions.data || [];
      const total = fns.reduce((sum, f) => sum + f.avg_latency_ms * f.total_calls, 0);
      const count = fns.reduce((sum, f) => sum + f.total_calls, 0);
      return count > 0 ? Math.round(total / count) : 0;
    })(),
    totalCost: (functions.data || []).reduce((sum, f) => sum + f.total_cost, 0),
    totalTokens: 0, // Would need tokens_in + tokens_out from raw data
  };

  return { functions, globalStats, isLoading: functions.isLoading };
}
