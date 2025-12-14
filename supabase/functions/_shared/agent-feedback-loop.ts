// ============= AGENT FEEDBACK LOOP (5→10) =============
// Complete learning cycle: Decision → Outcome → Learn → Improve

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface Decision {
  id: string;
  agent_type: string;
  query: string;
  decision_type: 'recommendation' | 'action' | 'alert' | 'prediction';
  decision_content: any;
  reasoning: string;
  confidence: number;
  tools_used: string[];
  created_at: string;
}

export interface Outcome {
  decision_id: string;
  outcome: 'success' | 'failure' | 'partial' | 'unknown';
  metrics: Record<string, number>;
  feedback?: string;
  recorded_at: string;
}

export interface LearningUpdate {
  pattern_name: string;
  confidence_delta: number;
  new_examples: any[];
  agent_type: string;
}

// Initialize Supabase client for edge functions
function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

// ============= RECORD DECISION =============
export async function recordDecision(decision: Omit<Decision, 'id' | 'created_at'>): Promise<string> {
  const supabase = getSupabaseClient();
  const decisionId = crypto.randomUUID();

  const { error } = await supabase.from('agent_decisions').insert({
    id: decisionId,
    agent_name: decision.agent_type,
    decision_type: decision.decision_type,
    input_context: {
      query: decision.query,
      tools_used: decision.tools_used
    },
    decision: decision.decision_content,
    reasoning: decision.reasoning,
    confidence: decision.confidence,
    outcome: 'pending',
    created_at: new Date().toISOString()
  });

  if (error) {
    console.error('Failed to record decision:', error);
    throw error;
  }

  console.log(`📝 Decision recorded: ${decisionId}`);
  return decisionId;
}

// ============= RECORD OUTCOME =============
export async function recordOutcome(outcome: Outcome): Promise<void> {
  const supabase = getSupabaseClient();

  // Update the decision with outcome
  const { error: updateError } = await supabase
    .from('agent_decisions')
    .update({
      outcome: outcome.outcome,
      outcome_metrics: outcome.metrics,
      outcome_notes: outcome.feedback,
      was_helpful: outcome.outcome === 'success',
      updated_at: new Date().toISOString()
    })
    .eq('id', outcome.decision_id);

  if (updateError) {
    console.error('Failed to record outcome:', updateError);
    throw updateError;
  }

  // Trigger learning based on outcome
  await learnFromOutcome(outcome);

  console.log(`✅ Outcome recorded for decision: ${outcome.decision_id}`);
}

// ============= LEARN FROM OUTCOME =============
async function learnFromOutcome(outcome: Outcome): Promise<void> {
  const supabase = getSupabaseClient();

  // Get the original decision
  const { data: decision } = await supabase
    .from('agent_decisions')
    .select('*')
    .eq('id', outcome.decision_id)
    .single();

  if (!decision) return;

  // Calculate confidence adjustment
  const confidenceDelta = outcome.outcome === 'success' ? 0.05 : -0.1;
  const patternName = `${decision.agent_name}_${decision.decision_type}`;

  // Update or create pattern
  const { data: existingPattern } = await supabase
    .from('agent_patterns')
    .select('*')
    .eq('pattern_name', patternName)
    .single();

  if (existingPattern) {
    // Update existing pattern
    const newConfidence = Math.max(0.1, Math.min(0.99,
      existingPattern.confidence + confidenceDelta
    ));
    const newUsageCount = existingPattern.usage_count + 1;

    // Add to examples (keep last 10)
    const examples = existingPattern.examples || [];
    examples.push({
      query: decision.input_context?.query,
      decision: decision.decision,
      outcome: outcome.outcome,
      timestamp: new Date().toISOString()
    });
    const trimmedExamples = examples.slice(-10);

    await supabase
      .from('agent_patterns')
      .update({
        confidence: newConfidence,
        usage_count: newUsageCount,
        examples: trimmedExamples,
        last_used_at: new Date().toISOString()
      })
      .eq('pattern_name', patternName);

    console.log(`📈 Pattern updated: ${patternName} (confidence: ${(newConfidence * 100).toFixed(0)}%)`);
  } else {
    // Create new pattern
    await supabase.from('agent_patterns').insert({
      pattern_name: patternName,
      description: `Pattern for ${decision.agent_name} ${decision.decision_type} decisions`,
      confidence: outcome.outcome === 'success' ? 0.6 : 0.4,
      examples: [{
        query: decision.input_context?.query,
        decision: decision.decision,
        outcome: outcome.outcome,
        timestamp: new Date().toISOString()
      }],
      usage_count: 1,
      last_used_at: new Date().toISOString()
    });

    console.log(`🆕 New pattern created: ${patternName}`);
  }

  // Update agent-specific metrics
  await updateAgentMetrics(decision.agent_name, outcome);
}

// ============= UPDATE AGENT METRICS =============
async function updateAgentMetrics(agentName: string, outcome: Outcome): Promise<void> {
  const supabase = getSupabaseClient();
  const metricsKey = `agent_metrics_${agentName}`;

  // Get existing metrics
  const { data: existing } = await supabase
    .from('agent_context')
    .select('value')
    .eq('key', metricsKey)
    .single();

  const currentMetrics = existing?.value as any || {
    total_decisions: 0,
    successful: 0,
    failed: 0,
    partial: 0,
    success_rate: 0,
    avg_confidence: 0,
    last_updated: null
  };

  // Update metrics
  currentMetrics.total_decisions += 1;
  if (outcome.outcome === 'success') currentMetrics.successful += 1;
  else if (outcome.outcome === 'failure') currentMetrics.failed += 1;
  else if (outcome.outcome === 'partial') currentMetrics.partial += 1;

  currentMetrics.success_rate = currentMetrics.successful / currentMetrics.total_decisions;
  currentMetrics.last_updated = new Date().toISOString();

  // Upsert metrics
  await supabase.from('agent_context').upsert({
    key: metricsKey,
    value: currentMetrics,
    agent_type: 'metrics',
    expires_at: null // Never expire
  }, { onConflict: 'key' });
}

// ============= GET SIMILAR SUCCESSFUL DECISIONS =============
export async function getSimilarSuccessfulDecisions(
  agentType: string,
  query: string,
  limit: number = 3
): Promise<any[]> {
  const supabase = getSupabaseClient();

  // Get successful decisions from this agent type
  const { data: decisions } = await supabase
    .from('agent_decisions')
    .select('*')
    .eq('agent_name', agentType)
    .eq('outcome', 'success')
    .order('confidence', { ascending: false })
    .limit(50);

  if (!decisions || decisions.length === 0) return [];

  // Simple keyword matching for similarity (can upgrade to embeddings)
  const queryWords = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 3));

  const scored = decisions.map(d => {
    const decisionWords = new Set(
      (d.input_context?.query || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
    );
    const overlap = [...queryWords].filter(w => decisionWords.has(w)).length;
    return { decision: d, score: overlap };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.decision);
}

// ============= GET AGENT PERFORMANCE =============
export async function getAgentPerformance(agentName?: string): Promise<Record<string, any>> {
  const supabase = getSupabaseClient();

  if (agentName) {
    const { data } = await supabase
      .from('agent_context')
      .select('value')
      .eq('key', `agent_metrics_${agentName}`)
      .single();
    return data?.value as Record<string, any> || {};
  }

  // Get all agent metrics
  const { data: allMetrics } = await supabase
    .from('agent_context')
    .select('key, value')
    .like('key', 'agent_metrics_%');

  const performance: Record<string, any> = {};
  for (const metric of allMetrics || []) {
    const agentName = metric.key.replace('agent_metrics_', '');
    performance[agentName] = metric.value;
  }

  return performance;
}

// ============= INJECT LEARNING INTO PROMPT =============
export async function buildLearningEnhancedPrompt(
  agentType: string,
  query: string,
  basePrompt: string
): Promise<string> {
  const supabase = getSupabaseClient();

  // Get agent's successful patterns
  const { data: patterns } = await supabase
    .from('agent_patterns')
    .select('*')
    .like('pattern_name', `${agentType}_%`)
    .gte('confidence', 0.6)
    .order('confidence', { ascending: false })
    .limit(5);

  // Get similar successful decisions
  const similarDecisions = await getSimilarSuccessfulDecisions(agentType, query, 3);

  // Get agent metrics
  const metrics = await getAgentPerformance(agentType);

  // Build learning context
  let learningContext = '\n\n=== LEARNING FROM PAST DECISIONS ===\n';

  if (patterns && patterns.length > 0) {
    learningContext += '\nHIGH-CONFIDENCE PATTERNS:\n';
    for (const p of patterns) {
      learningContext += `- ${p.pattern_name}: ${(p.confidence * 100).toFixed(0)}% confidence (${p.usage_count} uses)\n`;
    }
  }

  if (similarDecisions.length > 0) {
    learningContext += '\nSIMILAR SUCCESSFUL DECISIONS:\n';
    for (const d of similarDecisions) {
      learningContext += `- Query: "${d.input_context?.query?.slice(0, 50)}..."\n`;
      learningContext += `  Action: ${JSON.stringify(d.decision).slice(0, 100)}...\n`;
    }
  }

  if (metrics && metrics.success_rate) {
    learningContext += `\nAGENT PERFORMANCE: ${(metrics.success_rate * 100).toFixed(0)}% success rate (${metrics.total_decisions} decisions)\n`;
  }

  learningContext += '\nUSE THESE LEARNINGS to improve your response quality.\n';

  return basePrompt + learningContext;
}

// ============= AUTO-FEEDBACK FROM METRICS =============
export async function checkMetricsForFeedback(): Promise<void> {
  const supabase = getSupabaseClient();

  // Get recent decisions without outcomes (older than 1 hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: pendingDecisions } = await supabase
    .from('agent_decisions')
    .select('*')
    .eq('outcome', 'pending')
    .lt('created_at', oneHourAgo)
    .limit(50);

  for (const decision of pendingDecisions || []) {
    // Try to infer outcome from related data
    const inferredOutcome = await inferOutcome(decision);

    if (inferredOutcome) {
      await recordOutcome({
        decision_id: decision.id,
        outcome: inferredOutcome.outcome,
        metrics: inferredOutcome.metrics,
        feedback: 'Auto-inferred from system metrics',
        recorded_at: new Date().toISOString()
      });
    }
  }
}

// ============= INFER OUTCOME FROM DATA =============
async function inferOutcome(decision: any): Promise<{ outcome: 'success' | 'failure' | 'partial'; metrics: Record<string, number> } | null> {
  const supabase = getSupabaseClient();

  // Different inference logic based on decision type
  switch (decision.decision_type) {
    case 'recommendation':
      // Check if recommendation was acted upon
      const { data: actions } = await supabase
        .from('proactive_insights')
        .select('*')
        .eq('source_agent', decision.agent_name)
        .gte('created_at', decision.created_at)
        .eq('status', 'completed');

      if (actions && actions.length > 0) {
        return { outcome: 'success', metrics: { actions_completed: actions.length } };
      }
      break;

    case 'prediction':
      // Check if prediction came true
      // This would need specific logic based on what was predicted
      break;

    case 'alert':
      // Check if alert was acknowledged
      const { data: alerts } = await supabase
        .from('proactive_insights')
        .select('*')
        .eq('insight_type', 'urgent_alert')
        .gte('created_at', decision.created_at)
        .neq('status', 'new');

      if (alerts && alerts.length > 0) {
        return { outcome: 'success', metrics: { alerts_handled: alerts.length } };
      }
      break;
  }

  return null;
}

// ============= LEARNING REPORT =============
export async function generateLearningReport(): Promise<string> {
  const performance = await getAgentPerformance();
  const supabase = getSupabaseClient();

  // Get pattern stats
  const { data: patterns } = await supabase
    .from('agent_patterns')
    .select('pattern_name, confidence, usage_count')
    .order('usage_count', { ascending: false })
    .limit(20);

  // Get recent decisions
  const { data: recentDecisions } = await supabase
    .from('agent_decisions')
    .select('agent_name, outcome')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  let report = '=== AGENT LEARNING REPORT ===\n\n';

  report += 'AGENT PERFORMANCE (All Time):\n';
  for (const [agent, metrics] of Object.entries(performance)) {
    const m = metrics as any;
    report += `  ${agent}: ${(m.success_rate * 100).toFixed(0)}% success (${m.total_decisions} decisions)\n`;
  }

  report += '\nTOP PATTERNS BY USAGE:\n';
  for (const p of (patterns || []).slice(0, 10)) {
    report += `  ${p.pattern_name}: ${p.usage_count} uses, ${(p.confidence * 100).toFixed(0)}% confidence\n`;
  }

  report += '\nLAST 24H DECISIONS:\n';
  const byAgent: Record<string, { total: number; success: number }> = {};
  for (const d of recentDecisions || []) {
    if (!byAgent[d.agent_name]) byAgent[d.agent_name] = { total: 0, success: 0 };
    byAgent[d.agent_name].total++;
    if (d.outcome === 'success') byAgent[d.agent_name].success++;
  }
  for (const [agent, stats] of Object.entries(byAgent)) {
    report += `  ${agent}: ${stats.success}/${stats.total} successful\n`;
  }

  return report;
}
