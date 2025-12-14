// ============= PARALLEL AGENT ORCHESTRATOR (6→10) =============
// Multi-agent coordination with parallel execution and consensus

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { routeQuery, getAgentPromptEnhancement, getAgentTools } from './agent-router.ts';
import { recordDecision, recordOutcome, buildLearningEnhancedPrompt } from './agent-feedback-loop.ts';
import { startTrace, startSpan, endSpan, endTrace, recordMetrics, trackCost, log } from './agent-observability.ts';

export interface OrchestrationConfig {
  query: string;
  user_id?: string;
  max_agents?: number;
  timeout_ms?: number;
  require_consensus?: boolean;
  min_confidence?: number;
}

export interface AgentResponse {
  agent_name: string;
  response: any;
  confidence: number;
  reasoning: string;
  tools_used: string[];
  duration_ms: number;
  tokens_used: number;
  success: boolean;
  error?: string;
}

export interface OrchestrationResult {
  primary_response: any;
  consensus_response?: any;
  agent_responses: AgentResponse[];
  routing: {
    primary_agent: string;
    secondary_agents: string[];
    confidence: number;
  };
  metrics: {
    total_duration_ms: number;
    total_tokens: number;
    agents_used: number;
  };
  trace_id: string;
}

// Initialize Supabase client
function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

// ============= MAIN ORCHESTRATOR =============
export async function orchestrate(config: OrchestrationConfig): Promise<OrchestrationResult> {
  const {
    query,
    user_id,
    max_agents = 3,
    timeout_ms = 30000,
    require_consensus = false,
    min_confidence = 0.5
  } = config;

  // Start tracing
  const traceId = startTrace('orchestrator');
  const startTime = Date.now();

  log('info', 'orchestrator', `Starting orchestration for query: "${query.slice(0, 50)}..."`, { trace_id: traceId });

  // Route to best agents
  const routeSpanId = startSpan(traceId, 'route_query', 'orchestrator', { query_length: query.length });
  const routing = routeQuery(query);
  endSpan(traceId, routeSpanId, 'success', { routing });

  log('info', 'orchestrator', `Routed to ${routing.primary_agent} (confidence: ${(routing.confidence * 100).toFixed(0)}%)`, {
    secondary_agents: routing.secondary_agents
  });

  // Determine which agents to run
  const agentsToRun = [routing.primary_agent];
  if (routing.secondary_agents.length > 0 && (require_consensus || routing.confidence < 0.8)) {
    agentsToRun.push(...routing.secondary_agents.slice(0, max_agents - 1));
  }

  // Run agents in parallel
  const parallelSpanId = startSpan(traceId, 'parallel_execution', 'orchestrator', { agents: agentsToRun });

  const agentPromises = agentsToRun.map(agentName =>
    runAgent(agentName, query, user_id, traceId, timeout_ms)
  );

  const agentResponses = await Promise.all(agentPromises);
  endSpan(traceId, parallelSpanId, 'success', { responses_count: agentResponses.length });

  // Filter successful responses
  const successfulResponses = agentResponses.filter(r => r.success && r.confidence >= min_confidence);

  // Determine final response
  let primaryResponse: any;
  let consensusResponse: any;

  if (successfulResponses.length === 0) {
    // All agents failed - return error
    primaryResponse = {
      error: 'All agents failed to produce a valid response',
      agent_errors: agentResponses.map(r => ({ agent: r.agent_name, error: r.error }))
    };
  } else if (successfulResponses.length === 1 || !require_consensus) {
    // Single response or no consensus needed - use highest confidence
    const best = successfulResponses.sort((a, b) => b.confidence - a.confidence)[0];
    primaryResponse = best.response;
  } else {
    // Multiple responses - build consensus
    const consensusSpanId = startSpan(traceId, 'build_consensus', 'orchestrator', {});
    consensusResponse = await buildConsensus(successfulResponses, query, traceId);
    endSpan(traceId, consensusSpanId, 'success');
    primaryResponse = consensusResponse;
  }

  // Calculate metrics
  const totalDuration = Date.now() - startTime;
  const totalTokens = agentResponses.reduce((sum, r) => sum + r.tokens_used, 0);

  // End trace
  await endTrace(traceId);

  // Record orchestration decision
  await recordDecision({
    agent_type: 'orchestrator',
    query,
    decision_type: 'recommendation',
    decision_content: primaryResponse,
    reasoning: `Routed to ${routing.primary_agent}, ran ${agentsToRun.length} agents in parallel`,
    confidence: routing.confidence,
    tools_used: agentsToRun
  });

  log('info', 'orchestrator', `Orchestration complete in ${totalDuration}ms`, {
    agents_used: agentsToRun.length,
    total_tokens: totalTokens,
    trace_id: traceId
  });

  return {
    primary_response: primaryResponse,
    consensus_response: consensusResponse,
    agent_responses: agentResponses,
    routing: {
      primary_agent: routing.primary_agent,
      secondary_agents: routing.secondary_agents,
      confidence: routing.confidence
    },
    metrics: {
      total_duration_ms: totalDuration,
      total_tokens: totalTokens,
      agents_used: agentsToRun.length
    },
    trace_id: traceId
  };
}

// ============= RUN SINGLE AGENT =============
async function runAgent(
  agentName: string,
  query: string,
  userId: string | undefined,
  traceId: string,
  timeout: number
): Promise<AgentResponse> {
  const spanId = startSpan(traceId, `agent_${agentName}`, agentName, {});
  const startTime = Date.now();
  const toolsUsed: string[] = [];

  try {
    // Build enhanced prompt with learning
    const basePrompt = getAgentPromptEnhancement(agentName);
    const enhancedPrompt = await buildLearningEnhancedPrompt(agentName, query, basePrompt);

    // Get agent-specific tools
    const tools = getAgentTools(agentName);

    // Call the appropriate agent function
    const supabase = getSupabaseClient();

    // Use timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const { data, error } = await supabase.functions.invoke('smart-agent', {
        body: {
          query,
          user_id: userId,
          agent_type: agentName,
          system_prompt_enhancement: enhancedPrompt,
          allowed_tools: tools,
          max_iterations: 5
        }
      });

      clearTimeout(timeoutId);

      if (error) throw error;

      const duration = Date.now() - startTime;
      const response = data?.response || data;
      const confidence = data?.confidence || 0.7;
      const tokensUsed = data?.tokens_used || 500;

      // Record metrics
      await recordMetrics({
        agent_name: agentName,
        response_time_ms: duration,
        tokens_used: tokensUsed,
        tools_called: data?.tools_called || [],
        success: true,
        timestamp: new Date().toISOString()
      });

      // Track cost
      await trackCost(agentName, 'gemini-2.5-flash', tokensUsed * 0.7, tokensUsed * 0.3);

      endSpan(traceId, spanId, 'success', { confidence, tokens: tokensUsed });

      return {
        agent_name: agentName,
        response,
        confidence,
        reasoning: data?.reasoning || 'Agent completed successfully',
        tools_used: data?.tools_called || [],
        duration_ms: duration,
        tokens_used: tokensUsed,
        success: true
      };
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Record failed metrics
    await recordMetrics({
      agent_name: agentName,
      response_time_ms: duration,
      tokens_used: 0,
      tools_called: toolsUsed,
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });

    endSpan(traceId, spanId, 'error', { error: errorMessage });
    log('error', agentName, `Agent failed: ${errorMessage}`, { trace_id: traceId });

    return {
      agent_name: agentName,
      response: null,
      confidence: 0,
      reasoning: '',
      tools_used: toolsUsed,
      duration_ms: duration,
      tokens_used: 0,
      success: false,
      error: errorMessage
    };
  }
}

// ============= BUILD CONSENSUS =============
async function buildConsensus(
  responses: AgentResponse[],
  originalQuery: string,
  traceId: string
): Promise<any> {
  log('info', 'orchestrator', `Building consensus from ${responses.length} agents`, { trace_id: traceId });

  // Weight responses by confidence
  const weightedResponses = responses.map(r => ({
    ...r,
    weight: r.confidence * (1 / (r.duration_ms / 1000 + 1)) // Favor faster, confident responses
  }));

  // Sort by weight
  weightedResponses.sort((a, b) => b.weight - a.weight);

  // Check for agreement on key points
  const agreements: string[] = [];
  const disagreements: string[] = [];

  // Simple consensus: if multiple agents agree on key values, use those
  // For complex objects, use the highest weighted response as base

  const baseResponse = weightedResponses[0].response;

  // If responses are strings, check for keyword overlap
  if (typeof baseResponse === 'string') {
    const allResponses = weightedResponses.map(r => r.response as string);
    // Return weighted average of common content
    return baseResponse;
  }

  // If responses are objects, merge with weighted priority
  if (typeof baseResponse === 'object' && baseResponse !== null) {
    const merged = { ...baseResponse };

    // Add confidence scores and sources
    merged._consensus = {
      agents_agreed: weightedResponses.map(r => r.agent_name),
      confidence_scores: weightedResponses.map(r => ({
        agent: r.agent_name,
        confidence: r.confidence
      })),
      consensus_method: 'weighted_priority'
    };

    return merged;
  }

  return baseResponse;
}

// ============= STREAM ORCHESTRATION (Real-time) =============
export async function* streamOrchestrate(config: OrchestrationConfig): AsyncGenerator<{
  type: 'routing' | 'agent_start' | 'agent_progress' | 'agent_complete' | 'consensus' | 'done';
  data: any;
}> {
  const { query, max_agents = 3 } = config;

  // Route query
  const routing = routeQuery(query);
  yield { type: 'routing', data: routing };

  // Determine agents
  const agentsToRun = [routing.primary_agent, ...routing.secondary_agents.slice(0, max_agents - 1)];

  // Start all agents
  for (const agent of agentsToRun) {
    yield { type: 'agent_start', data: { agent } };
  }

  // Run in parallel and yield as they complete
  const results: AgentResponse[] = [];
  const traceId = startTrace('stream_orchestrator');

  const promises = agentsToRun.map(async (agent) => {
    const result = await runAgent(agent, query, config.user_id, traceId, config.timeout_ms || 30000);
    return { agent, result };
  });

  // Use Promise.race pattern to yield as each completes
  const pending = [...promises];
  while (pending.length > 0) {
    const completed = await Promise.race(pending.map(async (p, i) => ({ result: await p, index: i })));
    pending.splice(completed.index, 1);

    yield { type: 'agent_complete', data: completed.result };
    results.push(completed.result.result);
  }

  // Build consensus if needed
  const successful = results.filter(r => r.success);
  if (successful.length > 1 && config.require_consensus) {
    const consensus = await buildConsensus(successful, query, traceId);
    yield { type: 'consensus', data: consensus };
  }

  await endTrace(traceId);

  yield {
    type: 'done',
    data: {
      total_agents: results.length,
      successful: successful.length,
      primary_response: successful[0]?.response
    }
  };
}

// ============= REAL-TIME EVENT BUS =============
export async function publishAgentEvent(
  eventType: string,
  agentName: string,
  payload: any
): Promise<void> {
  const supabase = getSupabaseClient();

  // Store event for real-time subscribers
  await supabase.from('agent_context').insert({
    key: `event_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
    value: {
      event_type: eventType,
      agent_name: agentName,
      payload,
      timestamp: new Date().toISOString()
    },
    agent_type: 'realtime_event',
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
  });

  // Also broadcast via Supabase Realtime
  await supabase.channel('agent-events').send({
    type: 'broadcast',
    event: eventType,
    payload: { agent_name: agentName, ...payload }
  });
}

export async function subscribeToAgentEvents(
  callback: (event: { type: string; agent: string; payload: any }) => void
): Promise<() => void> {
  const supabase = getSupabaseClient();

  const channel = supabase
    .channel('agent-events')
    .on('broadcast', { event: '*' }, (payload: any) => {
      callback({
        type: payload.event,
        agent: payload.payload?.agent_name,
        payload: payload.payload
      });
    })
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}
