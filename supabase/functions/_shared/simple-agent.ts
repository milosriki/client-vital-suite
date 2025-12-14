// ============= SIMPLE SUPER AGENT =============
// 1 Brain + 3 Specialists = Maximum effectiveness with minimum complexity
// This replaces the over-engineered 10-agent system

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============= ONLY 4 AGENTS =============
export const AGENTS = {
  brain: {
    name: 'Main Brain',
    description: 'Handles everything - your default intelligent assistant',
    triggers: [], // Default - catches all
    model: 'gemini-2.5-flash'
  },
  money: {
    name: 'Money Guardian',
    description: 'Stripe fraud, payments, refunds, revenue leaks',
    triggers: ['fraud', 'stripe', 'payment', 'refund', 'chargeback', 'payout', 'suspicious'],
    model: 'gemini-2.5-flash'
  },
  risk: {
    name: 'Risk Detector',
    description: 'Churn prediction, health scores, at-risk clients',
    triggers: ['churn', 'risk', 'red zone', 'yellow zone', 'health', 'leaving', 'cancel', 'inactive'],
    model: 'gemini-2.5-flash'
  },
  ops: {
    name: 'Ops Manager',
    description: 'HubSpot sync, data quality, system health',
    triggers: ['sync', 'hubspot', 'error', 'workflow', 'data quality', 'missing'],
    model: 'gemini-2.5-flash'
  }
};

type AgentType = keyof typeof AGENTS;

// ============= SIMPLE ROUTING =============
export function routeToAgent(query: string): AgentType {
  const q = query.toLowerCase();

  // Check specialists first (order matters - most specific first)
  for (const [agentKey, agent] of Object.entries(AGENTS)) {
    if (agentKey === 'brain') continue; // Skip brain, it's default

    for (const trigger of agent.triggers) {
      if (q.includes(trigger)) {
        return agentKey as AgentType;
      }
    }
  }

  // Default to brain
  return 'brain';
}

// ============= SIMPLE PROMPT BUILDER =============
export function buildPrompt(agentType: AgentType, query: string): string {
  const baseRules = `
You are PTD Fitness AI Assistant. Be direct, data-driven, and actionable.

RULES:
1. Query LIVE data only - never guess
2. Cite sources: "X clients (source: client_health_scores)"
3. Quantify impact in AED when possible
4. Give specific recommendations, not vague advice
`;

  const agentPrompts: Record<AgentType, string> = {
    brain: `
${baseRules}
You are the main intelligence. Handle any question about:
- Client health and performance
- Sales pipeline and deals
- Coach performance
- Lead management
- General analytics

Use all available tools. Think step by step.
`,
    money: `
${baseRules}
FOCUS: Financial & Fraud Analysis

You specialize in:
- Stripe fraud detection (unknown cards, suspicious refunds)
- Payment pattern analysis
- Revenue leak identification
- Payout anomalies

Always check:
1. Recent refunds and chargebacks
2. Unusual payment patterns
3. Revenue trends vs expectations

Flag anything suspicious with confidence level.
`,
    risk: `
${baseRules}
FOCUS: Risk & Retention

You specialize in:
- Churn prediction and prevention
- Health score analysis
- At-risk client identification
- Intervention recommendations

Always check:
1. Red/Yellow zone clients
2. Engagement decline patterns
3. Days since last activity
4. Previous intervention success

Prioritize by revenue impact (high LTV clients first).
`,
    ops: `
${baseRules}
FOCUS: Operations & Data Quality

You specialize in:
- HubSpot sync health
- Data quality issues
- Workflow problems
- System integration status

Always check:
1. Recent sync errors
2. Data freshness
3. Missing fields or records
4. Workflow execution status

Provide specific fixes, not general advice.
`
  };

  return agentPrompts[agentType];
}

// ============= MAIN FUNCTION =============
interface QueryResult {
  response: any;
  agent_used: string;
  confidence: number;
  duration_ms: number;
}

export async function query(
  userQuery: string,
  options?: {
    force_agent?: AgentType;
    user_id?: string;
  }
): Promise<QueryResult> {
  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Route to best agent
  const agentType = options?.force_agent || routeToAgent(userQuery);
  const agent = AGENTS[agentType];

  console.log(`🧠 Using ${agent.name} for: "${userQuery.slice(0, 50)}..."`);

  // Build prompt
  const systemPrompt = buildPrompt(agentType, userQuery);

  // Call the agent
  const { data, error } = await supabase.functions.invoke('smart-agent', {
    body: {
      query: userQuery,
      user_id: options?.user_id,
      system_prompt: systemPrompt,
      model: agent.model
    }
  });

  if (error) throw error;

  const duration = Date.now() - startTime;

  // Simple learning: record what worked
  await recordQuery(supabase, agentType, userQuery, data?.response, duration);

  return {
    response: data?.response || data,
    agent_used: agent.name,
    confidence: data?.confidence || 0.8,
    duration_ms: duration
  };
}

// ============= SIMPLE LEARNING =============
async function recordQuery(
  supabase: any,
  agentType: string,
  query: string,
  response: any,
  durationMs: number
): Promise<void> {
  try {
    await supabase.from('agent_memory').insert({
      thread_id: `simple_${Date.now()}`,
      role: 'assistant',
      content: JSON.stringify({ query, response }),
      context: { agent: agentType, duration_ms: durationMs }
    });
  } catch (e) {
    console.warn('Failed to record query:', e);
  }
}

// ============= QUICK HELPERS =============

// Ask about money/fraud
export async function askMoney(query: string): Promise<any> {
  const result = await query(query, { force_agent: 'money' });
  return result.response;
}

// Ask about risk/churn
export async function askRisk(query: string): Promise<any> {
  const result = await query(query, { force_agent: 'risk' });
  return result.response;
}

// Ask about ops/sync
export async function askOps(query: string): Promise<any> {
  const result = await query(query, { force_agent: 'ops' });
  return result.response;
}

// Let the system decide
export async function ask(userQuery: string): Promise<any> {
  const result = await query(userQuery);
  return result.response;
}
