// ============= SUPER INTELLIGENCE INTEGRATION =============
// Master module that combines all agent capabilities into one unified system
// This is the SINGLE ENTRY POINT for all AI agent operations

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Import all modules
import { routeQuery, getAgentPromptEnhancement, getAgentTools, RouteResult } from './agent-router.ts';
import { recordDecision, recordOutcome, buildLearningEnhancedPrompt, getAgentPerformance, generateLearningReport } from './agent-feedback-loop.ts';
import { startTrace, endTrace, recordMetrics, trackCost, getDashboardMetrics, agentHealthCheck, log } from './agent-observability.ts';
import { orchestrate, streamOrchestrate, publishAgentEvent, OrchestrationConfig, OrchestrationResult } from './agent-parallel-orchestrator.ts';
import { generateReasoningPrompt, validateResponse, scoreReasoning, ReasoningScoreCard } from './agent-chain-of-thought.ts';
import { buildUnifiedPromptForEdgeFunction } from './unified-prompts.ts';

// ============= SUPER INTELLIGENCE CONFIG =============
export interface SuperIntelligenceConfig {
  // Query configuration
  query: string;
  user_id?: string;
  conversation_id?: string;

  // Agent selection
  force_agent?: string;          // Force specific agent (skip routing)
  enable_multi_agent?: boolean;  // Enable parallel multi-agent (default: true)
  max_agents?: number;           // Max parallel agents (default: 3)

  // Reasoning & validation
  enforce_reasoning?: boolean;   // Require structured reasoning (default: true)
  min_reasoning_score?: number;  // Minimum reasoning quality (default: 70)

  // Learning
  enable_learning?: boolean;     // Use learned patterns (default: true)
  record_for_learning?: boolean; // Record this decision (default: true)

  // Performance
  timeout_ms?: number;           // Request timeout (default: 30000)
  fast_mode?: boolean;           // Skip secondary agents (default: false)

  // Context
  additional_context?: string;   // Extra context for agents
  business_context?: {
    include_lifecycle?: boolean;
    include_roi?: boolean;
    include_workflows?: boolean;
    include_truth?: boolean;
  };
}

// ============= SUPER INTELLIGENCE RESPONSE =============
export interface SuperIntelligenceResponse {
  // Main response
  response: any;
  reasoning: string;

  // Quality metrics
  quality: {
    reasoning_score: ReasoningScoreCard;
    confidence: number;
    validated: boolean;
  };

  // Routing info
  routing: RouteResult;

  // Observability
  metrics: {
    duration_ms: number;
    tokens_used: number;
    agents_used: string[];
    tools_called: string[];
    cost_usd: number;
  };

  // Learning
  decision_id?: string;

  // Trace for debugging
  trace_id: string;
}

// Initialize Supabase
function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

// ============= MAIN ENTRY POINT =============
export async function superIntelligence(config: SuperIntelligenceConfig): Promise<SuperIntelligenceResponse> {
  const startTime = Date.now();
  const traceId = startTrace('super_intelligence');

  log('info', 'super_intelligence', `Processing query: "${config.query.slice(0, 50)}..."`, { trace_id: traceId });

  try {
    // 1. Route query to best agent(s)
    const routing = config.force_agent
      ? { primary_agent: config.force_agent, secondary_agents: [], confidence: 1.0, detected_intents: [], reasoning: 'Forced agent' }
      : routeQuery(config.query);

    log('info', 'super_intelligence', `Routed to ${routing.primary_agent}`, { confidence: routing.confidence });

    // 2. Build enhanced prompt
    const basePrompt = buildUnifiedPromptForEdgeFunction({
      includeLifecycle: config.business_context?.include_lifecycle ?? true,
      includeUltimateTruth: config.business_context?.include_truth ?? true,
      includeROI: config.business_context?.include_roi ?? true,
      includeWorkflows: config.business_context?.include_workflows ?? true
    });

    // Add reasoning requirements
    const reasoningPrompt = config.enforce_reasoning !== false ? generateReasoningPrompt() : '';

    // Add agent-specific enhancements
    const agentEnhancement = getAgentPromptEnhancement(routing.primary_agent);

    // Add learning if enabled
    let enhancedPrompt = basePrompt + reasoningPrompt + agentEnhancement;
    if (config.enable_learning !== false) {
      enhancedPrompt = await buildLearningEnhancedPrompt(
        routing.primary_agent,
        config.query,
        enhancedPrompt
      );
    }

    // Add any additional context
    if (config.additional_context) {
      enhancedPrompt += `\n\n=== ADDITIONAL CONTEXT ===\n${config.additional_context}`;
    }

    // 3. Execute agent(s)
    let result: OrchestrationResult;

    if (config.fast_mode || config.enable_multi_agent === false) {
      // Single agent mode
      result = await orchestrate({
        query: config.query,
        user_id: config.user_id,
        max_agents: 1,
        timeout_ms: config.timeout_ms || 30000,
        require_consensus: false
      });
    } else {
      // Multi-agent mode
      result = await orchestrate({
        query: config.query,
        user_id: config.user_id,
        max_agents: config.max_agents || 3,
        timeout_ms: config.timeout_ms || 30000,
        require_consensus: routing.confidence < 0.7
      });
    }

    // 4. Validate response quality
    const toolsUsed = result.agent_responses.flatMap(r => r.tools_used);
    const responseText = typeof result.primary_response === 'string'
      ? result.primary_response
      : JSON.stringify(result.primary_response);

    const reasoningScore = scoreReasoning(responseText, toolsUsed);
    const validation = validateResponse(responseText, toolsUsed);

    // 5. Record for learning if enabled
    let decisionId: string | undefined;
    if (config.record_for_learning !== false) {
      decisionId = await recordDecision({
        agent_type: routing.primary_agent,
        query: config.query,
        decision_type: 'recommendation',
        decision_content: result.primary_response,
        reasoning: result.agent_responses[0]?.reasoning || '',
        confidence: result.routing.confidence,
        tools_used: toolsUsed
      });
    }

    // 6. Calculate metrics
    const duration = Date.now() - startTime;
    const totalTokens = result.metrics.total_tokens;
    const estimatedCost = totalTokens * 0.0001; // Rough estimate

    // Track cost
    await trackCost('super_intelligence', 'gemini-2.5-flash', totalTokens * 0.7, totalTokens * 0.3);

    // Record metrics
    await recordMetrics({
      agent_name: 'super_intelligence',
      response_time_ms: duration,
      tokens_used: totalTokens,
      tools_called: toolsUsed,
      success: validation.valid,
      timestamp: new Date().toISOString()
    });

    await endTrace(traceId);

    log('info', 'super_intelligence', `Completed in ${duration}ms`, {
      reasoning_score: reasoningScore.overall_score,
      validated: validation.valid
    });

    return {
      response: result.primary_response,
      reasoning: result.agent_responses[0]?.reasoning || '',
      quality: {
        reasoning_score: reasoningScore,
        confidence: result.routing.confidence,
        validated: validation.valid && reasoningScore.overall_score >= (config.min_reasoning_score || 70)
      },
      routing,
      metrics: {
        duration_ms: duration,
        tokens_used: totalTokens,
        agents_used: result.agent_responses.map(r => r.agent_name),
        tools_called: toolsUsed,
        cost_usd: estimatedCost
      },
      decision_id: decisionId,
      trace_id: traceId
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', 'super_intelligence', `Failed: ${errorMessage}`, { trace_id: traceId });

    await endTrace(traceId);

    throw error;
  }
}

// ============= STREAMING VERSION =============
export async function* streamSuperIntelligence(config: SuperIntelligenceConfig): AsyncGenerator<{
  type: 'status' | 'routing' | 'agent_update' | 'response' | 'quality' | 'done';
  data: any;
}> {
  yield { type: 'status', data: { message: 'Starting super intelligence...' } };

  // Route query
  const routing = config.force_agent
    ? { primary_agent: config.force_agent, secondary_agents: [], confidence: 1.0, detected_intents: [], reasoning: 'Forced' }
    : routeQuery(config.query);

  yield { type: 'routing', data: routing };

  // Stream from orchestrator
  const orchestratorStream = streamOrchestrate({
    query: config.query,
    user_id: config.user_id,
    max_agents: config.max_agents || 3,
    timeout_ms: config.timeout_ms || 30000,
    require_consensus: routing.confidence < 0.7
  });

  let finalResponse: any;
  let toolsUsed: string[] = [];

  for await (const event of orchestratorStream) {
    yield { type: 'agent_update', data: event };

    if (event.type === 'agent_complete') {
      toolsUsed.push(...(event.data.result.tools_used || []));
    }
    if (event.type === 'done') {
      finalResponse = event.data.primary_response;
    }
  }

  yield { type: 'response', data: finalResponse };

  // Score quality
  const responseText = typeof finalResponse === 'string' ? finalResponse : JSON.stringify(finalResponse);
  const reasoningScore = scoreReasoning(responseText, toolsUsed);

  yield { type: 'quality', data: reasoningScore };

  yield { type: 'done', data: { success: true } };
}

// ============= QUICK HELPERS =============

// Quick query with defaults
export async function quickQuery(query: string, userId?: string): Promise<any> {
  const result = await superIntelligence({
    query,
    user_id: userId,
    fast_mode: true,
    enforce_reasoning: false
  });
  return result.response;
}

// High-quality query with full validation
export async function qualityQuery(query: string, userId?: string): Promise<SuperIntelligenceResponse> {
  return superIntelligence({
    query,
    user_id: userId,
    enable_multi_agent: true,
    enforce_reasoning: true,
    min_reasoning_score: 80,
    max_agents: 3
  });
}

// Force specific specialist
export async function specialistQuery(
  query: string,
  specialist: string,
  userId?: string
): Promise<SuperIntelligenceResponse> {
  return superIntelligence({
    query,
    user_id: userId,
    force_agent: specialist,
    enable_multi_agent: false
  });
}

// ============= SYSTEM STATUS =============
export async function getSystemStatus(): Promise<{
  health: Awaited<ReturnType<typeof agentHealthCheck>>;
  metrics: Awaited<ReturnType<typeof getDashboardMetrics>>;
  performance: Record<string, any>;
  learning_report: string;
}> {
  const [health, metrics, performance, learningReport] = await Promise.all([
    agentHealthCheck(),
    getDashboardMetrics(),
    getAgentPerformance(),
    generateLearningReport()
  ]);

  return {
    health,
    metrics,
    performance,
    learning_report: learningReport
  };
}

// ============= RECORD FEEDBACK =============
export async function recordUserFeedback(
  decisionId: string,
  outcome: 'success' | 'failure' | 'partial',
  feedback?: string
): Promise<void> {
  await recordOutcome({
    decision_id: decisionId,
    outcome,
    metrics: {},
    feedback,
    recorded_at: new Date().toISOString()
  });

  log('info', 'super_intelligence', `Feedback recorded for decision ${decisionId}`, { outcome });
}

// ============= EXPORT ALL =============
export {
  // Router
  routeQuery,
  getAgentPromptEnhancement,
  getAgentTools,

  // Feedback
  recordDecision,
  recordOutcome,
  buildLearningEnhancedPrompt,
  getAgentPerformance,
  generateLearningReport,

  // Observability
  startTrace,
  endTrace,
  recordMetrics,
  trackCost,
  getDashboardMetrics,
  agentHealthCheck,
  log,

  // Orchestration
  orchestrate,
  streamOrchestrate,
  publishAgentEvent,

  // Reasoning
  generateReasoningPrompt,
  validateResponse,
  scoreReasoning
};
