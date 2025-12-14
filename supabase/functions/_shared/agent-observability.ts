// ============= AGENT OBSERVABILITY (3→10) =============
// Complete metrics, tracing, and monitoring for all agents

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AgentMetrics {
  agent_name: string;
  response_time_ms: number;
  tokens_used: number;
  tools_called: string[];
  success: boolean;
  error?: string;
  timestamp: string;
}

export interface TraceSpan {
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  operation: string;
  agent_name: string;
  start_time: number;
  end_time?: number;
  duration_ms?: number;
  metadata: Record<string, any>;
  status: 'running' | 'success' | 'error';
}

// In-memory trace storage for current request
const activeTraces = new Map<string, TraceSpan[]>();

// Initialize Supabase client
function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

// ============= TRACE MANAGEMENT =============
export function startTrace(agentName: string): string {
  const traceId = crypto.randomUUID();
  activeTraces.set(traceId, []);

  // Start root span
  startSpan(traceId, 'agent_execution', agentName, { type: 'root' });

  return traceId;
}

export function startSpan(
  traceId: string,
  operation: string,
  agentName: string,
  metadata: Record<string, any> = {},
  parentSpanId?: string
): string {
  const spanId = crypto.randomUUID();
  const spans = activeTraces.get(traceId) || [];

  spans.push({
    trace_id: traceId,
    span_id: spanId,
    parent_span_id: parentSpanId,
    operation,
    agent_name: agentName,
    start_time: Date.now(),
    metadata,
    status: 'running'
  });

  activeTraces.set(traceId, spans);
  return spanId;
}

export function endSpan(traceId: string, spanId: string, status: 'success' | 'error', metadata?: Record<string, any>): void {
  const spans = activeTraces.get(traceId);
  if (!spans) return;

  const span = spans.find(s => s.span_id === spanId);
  if (!span) return;

  span.end_time = Date.now();
  span.duration_ms = span.end_time - span.start_time;
  span.status = status;
  if (metadata) {
    span.metadata = { ...span.metadata, ...metadata };
  }
}

export async function endTrace(traceId: string): Promise<TraceSpan[]> {
  const spans = activeTraces.get(traceId) || [];

  // End any running spans
  for (const span of spans) {
    if (span.status === 'running') {
      span.end_time = Date.now();
      span.duration_ms = span.end_time - span.start_time;
      span.status = 'success';
    }
  }

  // Store trace in database
  await storeTrace(traceId, spans);

  // Clean up
  activeTraces.delete(traceId);

  return spans;
}

async function storeTrace(traceId: string, spans: TraceSpan[]): Promise<void> {
  const supabase = getSupabaseClient();

  const totalDuration = spans.reduce((sum, s) => sum + (s.duration_ms || 0), 0);
  const rootSpan = spans.find(s => !s.parent_span_id);

  await supabase.from('agent_context').insert({
    key: `trace_${traceId}`,
    value: {
      trace_id: traceId,
      agent_name: rootSpan?.agent_name,
      spans,
      total_duration_ms: totalDuration,
      span_count: spans.length,
      created_at: new Date().toISOString()
    },
    agent_type: 'trace',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
  });
}

// ============= METRICS RECORDING =============
export async function recordMetrics(metrics: AgentMetrics): Promise<void> {
  const supabase = getSupabaseClient();

  // Update rolling metrics
  const metricsKey = `metrics_${metrics.agent_name}_${new Date().toISOString().split('T')[0]}`;

  const { data: existing } = await supabase
    .from('agent_context')
    .select('value')
    .eq('key', metricsKey)
    .single();

  const currentMetrics = existing?.value as any || {
    agent_name: metrics.agent_name,
    date: new Date().toISOString().split('T')[0],
    total_requests: 0,
    successful_requests: 0,
    failed_requests: 0,
    total_response_time_ms: 0,
    total_tokens: 0,
    avg_response_time_ms: 0,
    p95_response_time_ms: 0,
    response_times: [],
    tools_usage: {},
    errors: []
  };

  // Update aggregates
  currentMetrics.total_requests += 1;
  if (metrics.success) {
    currentMetrics.successful_requests += 1;
  } else {
    currentMetrics.failed_requests += 1;
    if (metrics.error) {
      currentMetrics.errors.push({
        error: metrics.error.slice(0, 200),
        timestamp: metrics.timestamp
      });
      currentMetrics.errors = currentMetrics.errors.slice(-20); // Keep last 20 errors
    }
  }

  currentMetrics.total_response_time_ms += metrics.response_time_ms;
  currentMetrics.total_tokens += metrics.tokens_used;
  currentMetrics.avg_response_time_ms = currentMetrics.total_response_time_ms / currentMetrics.total_requests;

  // Track response times for percentiles
  currentMetrics.response_times.push(metrics.response_time_ms);
  currentMetrics.response_times = currentMetrics.response_times.slice(-100); // Keep last 100

  // Calculate p95
  const sorted = [...currentMetrics.response_times].sort((a, b) => a - b);
  const p95Index = Math.floor(sorted.length * 0.95);
  currentMetrics.p95_response_time_ms = sorted[p95Index] || 0;

  // Track tool usage
  for (const tool of metrics.tools_called) {
    currentMetrics.tools_usage[tool] = (currentMetrics.tools_usage[tool] || 0) + 1;
  }

  // Upsert metrics
  await supabase.from('agent_context').upsert({
    key: metricsKey,
    value: currentMetrics,
    agent_type: 'daily_metrics',
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
  }, { onConflict: 'key' });
}

// ============= REAL-TIME DASHBOARD DATA =============
export async function getDashboardMetrics(): Promise<{
  agents: Record<string, any>;
  global: any;
  alerts: string[];
}> {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  // Get today's metrics for all agents
  const { data: metricsData } = await supabase
    .from('agent_context')
    .select('key, value')
    .like('key', `metrics_%_${today}`)
    .eq('agent_type', 'daily_metrics');

  const agents: Record<string, any> = {};
  let globalRequests = 0;
  let globalSuccessful = 0;
  let globalTokens = 0;
  let globalResponseTime = 0;
  const alerts: string[] = [];

  for (const m of metricsData || []) {
    const value = m.value as any;
    agents[value.agent_name] = {
      requests: value.total_requests,
      success_rate: value.total_requests > 0
        ? ((value.successful_requests / value.total_requests) * 100).toFixed(1) + '%'
        : 'N/A',
      avg_response_ms: Math.round(value.avg_response_time_ms),
      p95_response_ms: Math.round(value.p95_response_time_ms),
      tokens: value.total_tokens,
      top_tools: Object.entries(value.tools_usage || {})
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 3)
        .map(([tool, count]) => `${tool}(${count})`),
      error_count: value.failed_requests
    };

    globalRequests += value.total_requests;
    globalSuccessful += value.successful_requests;
    globalTokens += value.total_tokens;
    globalResponseTime += value.total_response_time_ms;

    // Generate alerts
    const successRate = value.successful_requests / value.total_requests;
    if (successRate < 0.8 && value.total_requests > 5) {
      alerts.push(`⚠️ ${value.agent_name}: Low success rate (${(successRate * 100).toFixed(0)}%)`);
    }
    if (value.p95_response_time_ms > 10000) {
      alerts.push(`🐢 ${value.agent_name}: High latency (p95: ${Math.round(value.p95_response_time_ms / 1000)}s)`);
    }
  }

  return {
    agents,
    global: {
      total_requests: globalRequests,
      success_rate: globalRequests > 0
        ? ((globalSuccessful / globalRequests) * 100).toFixed(1) + '%'
        : 'N/A',
      avg_response_ms: globalRequests > 0
        ? Math.round(globalResponseTime / globalRequests)
        : 0,
      total_tokens: globalTokens,
      active_agents: Object.keys(agents).length
    },
    alerts
  };
}

// ============= COST TRACKING =============
export async function trackCost(
  agentName: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const supabase = getSupabaseClient();

  // Cost per 1M tokens (approximate)
  const costs: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4': { input: 3, output: 15 },
    'claude-opus-4': { input: 15, output: 75 },
    'gemini-2.0-flash': { input: 0.075, output: 0.3 },
    'gemini-2.5-flash': { input: 0.15, output: 0.6 },
    'gemini-2.5-pro': { input: 1.25, output: 5 },
    'gpt-4o': { input: 2.5, output: 10 },
    'text-embedding-3-small': { input: 0.02, output: 0 }
  };

  const modelCost = costs[model] || { input: 1, output: 3 };
  const costUSD = (inputTokens / 1_000_000 * modelCost.input) +
                  (outputTokens / 1_000_000 * modelCost.output);

  const costKey = `cost_${new Date().toISOString().split('T')[0]}`;

  const { data: existing } = await supabase
    .from('agent_context')
    .select('value')
    .eq('key', costKey)
    .single();

  const currentCosts = existing?.value as any || {
    date: new Date().toISOString().split('T')[0],
    total_usd: 0,
    by_agent: {},
    by_model: {},
    total_input_tokens: 0,
    total_output_tokens: 0
  };

  currentCosts.total_usd += costUSD;
  currentCosts.by_agent[agentName] = (currentCosts.by_agent[agentName] || 0) + costUSD;
  currentCosts.by_model[model] = (currentCosts.by_model[model] || 0) + costUSD;
  currentCosts.total_input_tokens += inputTokens;
  currentCosts.total_output_tokens += outputTokens;

  await supabase.from('agent_context').upsert({
    key: costKey,
    value: currentCosts,
    agent_type: 'cost_tracking',
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days
  }, { onConflict: 'key' });
}

// ============= HEALTH CHECK =============
export async function agentHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, { status: string; message: string }>;
}> {
  const supabase = getSupabaseClient();
  const checks: Record<string, { status: string; message: string }> = {};
  let unhealthyCount = 0;

  // Check database connectivity
  try {
    const start = Date.now();
    await supabase.from('agent_context').select('key').limit(1);
    const latency = Date.now() - start;
    checks['database'] = {
      status: latency < 500 ? 'healthy' : 'degraded',
      message: `Latency: ${latency}ms`
    };
    if (latency > 500) unhealthyCount++;
  } catch (e) {
    checks['database'] = { status: 'unhealthy', message: String(e) };
    unhealthyCount += 2;
  }

  // Check recent agent activity
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentDecisions } = await supabase
    .from('agent_decisions')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo);

  checks['agent_activity'] = {
    status: (recentDecisions || 0) > 0 ? 'healthy' : 'degraded',
    message: `${recentDecisions || 0} decisions in last hour`
  };

  // Check error rate
  const { data: recentErrors } = await supabase
    .from('agent_decisions')
    .select('outcome')
    .gte('created_at', oneHourAgo);

  const errorRate = recentErrors
    ? recentErrors.filter(d => d.outcome === 'failure').length / Math.max(recentErrors.length, 1)
    : 0;

  checks['error_rate'] = {
    status: errorRate < 0.2 ? 'healthy' : errorRate < 0.5 ? 'degraded' : 'unhealthy',
    message: `${(errorRate * 100).toFixed(1)}% error rate`
  };
  if (errorRate >= 0.2) unhealthyCount++;
  if (errorRate >= 0.5) unhealthyCount++;

  // Check memory usage (patterns count)
  const { count: patternsCount } = await supabase
    .from('agent_patterns')
    .select('*', { count: 'exact', head: true });

  checks['patterns_learned'] = {
    status: (patternsCount || 0) > 10 ? 'healthy' : 'degraded',
    message: `${patternsCount || 0} patterns learned`
  };

  return {
    status: unhealthyCount === 0 ? 'healthy' : unhealthyCount < 3 ? 'degraded' : 'unhealthy',
    checks
  };
}

// ============= STRUCTURED LOGGING =============
export function log(
  level: 'debug' | 'info' | 'warn' | 'error',
  agentName: string,
  message: string,
  metadata?: Record<string, any>
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    agent: agentName,
    message,
    ...metadata
  };

  // Output structured JSON for log aggregation
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    JSON.stringify(logEntry)
  );
}
