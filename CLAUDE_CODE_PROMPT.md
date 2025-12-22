# CLAUDE CODE PROMPT: WIRE PTD SUPERINTELLIGENT AGENT SYSTEM

## CONTEXT
You are working on PTD Client Vital Suite - a Supabase Edge Functions project with 69 agents.
Path: `/Users/milosvukovic/client-vital-suite`

**Current State:**
- 69 Edge Functions in `/supabase/functions/`
- Unified Brain exists at `/_shared/unified-brain.ts` (RAG + memory)
- Personas defined in `ptd-ultimate-intelligence` (ATLAS, SHERLOCK, REVENUE)
- Tools defined in `smart-agent` and `ptd-agent-gemini`
- NO agent-to-agent communication
- NO reasoning/thinking before acting
- NO learning from mistakes

**Goal:** Transform into SUPERINTELLIGENT system where agents:
1. THINK before acting (ReAct pattern)
2. TALK to each other (Pub/Sub via Realtime)
3. SHARE one brain (unified-brain.ts)
4. LEARN from every interaction
5. COORDINATE on complex tasks

---

## TASK 1: Create Reasoning Engine
Create `/supabase/functions/_shared/reasoning-engine.ts`:

```typescript
/**
 * ReAct Reasoning Engine - Makes agents THINK before ACTING
 */

export interface ThoughtStep {
  thought: string;
  action?: string;
  observation?: string;
  reflection?: string;
}

export interface ReasoningPlan {
  goal: string;
  understanding: string;
  information_needed: string[];
  risks: string[];
  steps: string[];
  reasoning: string;
}

export async function deliberate(
  query: string,
  context: string,
  llm: (prompt: string) => Promise<string>
): Promise<ReasoningPlan> {
  const prompt = `You are the THINKING module of a superintelligent business AI.
Before taking ANY action, you must DELIBERATE carefully.

USER QUERY: ${query}

CONTEXT FROM MEMORY:
${context}

Think through this step by step:
1. What is the user REALLY asking? (deeper intent, not surface level)
2. What information do I need to answer this comprehensively?
3. What could go wrong? What assumptions might be incorrect?
4. What's the optimal sequence of steps?

Respond in this EXACT JSON format:
{
  "goal": "one sentence summary of what we need to accomplish",
  "understanding": "what the user really wants (deeper intent)",
  "information_needed": ["data point 1", "data point 2", ...],
  "risks": ["potential issue 1", "potential issue 2", ...],
  "steps": ["step 1", "step 2", "step 3", ...],
  "reasoning": "why this plan is optimal"
}`;

  const response = await llm(prompt);
  
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('[REASONING] Parse error:', e);
  }
  
  // Fallback
  return {
    goal: query,
    understanding: query,
    information_needed: [],
    risks: [],
    steps: [query],
    reasoning: 'Direct execution'
  };
}

export async function reflect(
  action: string,
  result: any,
  llm: (prompt: string) => Promise<string>
): Promise<{ success: boolean; learning: string; shouldRetry: boolean }> {
  const prompt = `You are the REFLECTION module. Analyze what just happened.

ACTION TAKEN: ${action}
RESULT: ${JSON.stringify(result).slice(0, 2000)}

Answer these questions:
1. Was the action successful? (true/false)
2. What did we learn from this?
3. Should we retry with a different approach? (true/false)

Respond in JSON format:
{
  "success": true/false,
  "learning": "what we learned",
  "shouldRetry": true/false
}`;

  const response = await llm(prompt);
  
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('[REFLECTION] Parse error:', e);
  }
  
  return { success: true, learning: '', shouldRetry: false };
}

export async function synthesize(
  query: string,
  results: Array<{ step: string; agent: string; result: any }>,
  context: string,
  llm: (prompt: string) => Promise<string>
): Promise<{ answer: string; confidence: number; insights: string[] }> {
  const prompt = `You are the SYNTHESIS module. Create a comprehensive answer.

ORIGINAL QUESTION: ${query}

EXECUTION RESULTS:
${results.map(r => `[${r.agent}] ${r.step}: ${JSON.stringify(r.result).slice(0, 500)}`).join('\n\n')}

CONTEXT:
${context.slice(0, 1000)}

Create a comprehensive, insightful answer that:
1. Directly addresses what the user asked
2. Synthesizes all the information gathered
3. Provides actionable insights
4. Notes any limitations or uncertainties

Respond in JSON:
{
  "answer": "your comprehensive answer here",
  "confidence": 0.0-1.0,
  "insights": ["insight 1", "insight 2", ...]
}`;

  const response = await llm(prompt);
  
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('[SYNTHESIS] Parse error:', e);
  }
  
  return {
    answer: results.map(r => JSON.stringify(r.result)).join('\n'),
    confidence: 0.5,
    insights: []
  };
}
```

---

## TASK 2: Create Agent Communication System
Create `/supabase/functions/_shared/agent-comms.ts`:

```typescript
/**
 * Agent-to-Agent Communication via Supabase Realtime
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AgentMessage {
  id: string;
  from_agent: string;
  to_agent: string;  // or 'broadcast' for all agents
  message_type: 'request' | 'response' | 'insight' | 'alert';
  payload: any;
  correlation_id: string;
  created_at: string;
}

export class AgentComms {
  private supabase: any;
  private agentId: string;
  private channel: any;
  private messageHandlers: Map<string, (msg: AgentMessage) => void> = new Map();

  constructor(agentId: string) {
    this.agentId = agentId;
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
  }

  async connect(): Promise<void> {
    this.channel = this.supabase.channel('agent_network', {
      config: { broadcast: { self: false } }
    });

    this.channel
      .on('broadcast', { event: 'agent_message' }, ({ payload }: any) => {
        const msg = payload as AgentMessage;
        if (msg.to_agent === this.agentId || msg.to_agent === 'broadcast') {
          const handler = this.messageHandlers.get(msg.correlation_id);
          if (handler) {
            handler(msg);
            this.messageHandlers.delete(msg.correlation_id);
          }
        }
      })
      .subscribe();
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
    }
  }

  async send(msg: Omit<AgentMessage, 'id' | 'from_agent' | 'created_at'>): Promise<void> {
    const fullMsg: AgentMessage = {
      ...msg,
      id: crypto.randomUUID(),
      from_agent: this.agentId,
      created_at: new Date().toISOString(),
    };

    // Persist to database for history
    await this.supabase.from('agent_messages').insert(fullMsg);

    // Broadcast to channel
    await this.channel.send({
      type: 'broadcast',
      event: 'agent_message',
      payload: fullMsg,
    });
  }

  // Request help from another agent and wait for response
  async askAgent(targetAgent: string, question: string, context: any = {}, timeoutMs = 30000): Promise<any> {
    const correlationId = crypto.randomUUID();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(correlationId);
        reject(new Error(`Agent ${targetAgent} timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.messageHandlers.set(correlationId, (response) => {
        clearTimeout(timeout);
        resolve(response.payload);
      });

      this.send({
        to_agent: targetAgent,
        message_type: 'request',
        payload: { question, context },
        correlation_id: correlationId,
      });
    });
  }

  // Share insight with all agents
  async broadcastInsight(insight: string, data: any = {}): Promise<void> {
    await this.send({
      to_agent: 'broadcast',
      message_type: 'insight',
      payload: { insight, data, source: this.agentId },
      correlation_id: crypto.randomUUID(),
    });

    // Also store in unified brain patterns
    const brain = await import('./unified-brain.ts');
    await brain.brain.recordPattern(
      `insight_${Date.now()}`,
      insight,
      data,
      0.7
    );
  }

  // Get recent messages
  async getRecentMessages(limit = 20): Promise<AgentMessage[]> {
    const { data } = await this.supabase
      .from('agent_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  }
}

// Singleton instances for each agent type
const instances: Map<string, AgentComms> = new Map();

export function getAgentComms(agentId: string): AgentComms {
  if (!instances.has(agentId)) {
    instances.set(agentId, new AgentComms(agentId));
  }
  return instances.get(agentId)!;
}
```

---

## TASK 3: Create the Thinking Coordinator
Create `/supabase/functions/thinking-coordinator/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { brain } from "../_shared/unified-brain.ts";
import { deliberate, reflect, synthesize } from "../_shared/reasoning-engine.ts";
import { getAgentComms } from "../_shared/agent-comms.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Which agent handles which type of task
const AGENT_ROUTER: Record<string, string[]> = {
  'analyst-agent':    ['analyze', 'report', 'insight', 'pattern', 'trend', 'compare'],
  'customer-agent':   ['client', 'health', 'churn', 'retention', 'coach', 'session'],
  'sales-agent':      ['lead', 'deal', 'pipeline', 'conversion', 'revenue', 'close'],
  'finance-agent':    ['stripe', 'payment', 'invoice', 'refund', 'fraud', 'payout'],
  'monitor-agent':    ['alert', 'anomaly', 'detect', 'watch', 'threshold', 'warning'],
  'hubspot-agent':    ['hubspot', 'contact', 'lifecycle', 'sync', 'crm', 'property'],
};

// LLM caller
async function callLLM(prompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await response.json();
  return data.content[0].text;
}

// Route step to appropriate agent
function routeToAgent(step: string): string {
  const stepLower = step.toLowerCase();
  for (const [agent, keywords] of Object.entries(AGENT_ROUTER)) {
    if (keywords.some(kw => stepLower.includes(kw))) {
      return agent;
    }
  }
  return 'self';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const { query, thread_id, user_id } = await req.json();
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const comms = getAgentComms('coordinator');
  await comms.connect();

  const trace: any = {
    query,
    thread_id: thread_id || `coord_${Date.now()}`,
    phases: {},
  };

  try {
    // ═══════════════════════════════════════════════════════════════
    // PHASE 1: RECALL - What do I already know?
    // ═══════════════════════════════════════════════════════════════
    console.log('[COORDINATOR] 🧠 Phase 1: Recalling...');
    
    const memories = await brain.recall(query, { limit: 5, threshold: 0.7 });
    const facts = await brain.getAllFacts();
    const patterns = await brain.getTopPatterns(3);
    
    const context = `
## RELEVANT MEMORIES (${memories.length} found):
${memories.map(m => `- Q: ${m.query.slice(0,100)}... → A: ${m.response.slice(0,150)}...`).join('\n')}

## KNOWN FACTS:
${Object.entries(facts).slice(0,10).map(([k,v]) => `- ${k}: ${JSON.stringify(v).slice(0,100)}`).join('\n')}

## LEARNED PATTERNS:
${patterns.map(p => `- ${p.pattern_name}: ${p.description}`).join('\n')}
    `.trim();
    
    trace.phases.recall = { memories: memories.length, facts: Object.keys(facts).length, patterns: patterns.length };

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: DELIBERATE - Think before acting
    // ═══════════════════════════════════════════════════════════════
    console.log('[COORDINATOR] 🤔 Phase 2: Deliberating...');
    
    const plan = await deliberate(query, context, callLLM);
    console.log('[COORDINATOR] Plan:', plan.steps);
    
    trace.phases.deliberate = plan;

    // ═══════════════════════════════════════════════════════════════
    // PHASE 3: EXECUTE - Run the plan with specialized agents
    // ═══════════════════════════════════════════════════════════════
    console.log('[COORDINATOR] ⚡ Phase 3: Executing...');
    
    const results: Array<{ step: string; agent: string; result: any }> = [];
    
    for (const step of plan.steps) {
      const targetAgent = routeToAgent(step);
      console.log(`[COORDINATOR] Step: "${step}" → Agent: ${targetAgent}`);
      
      let result: any;
      
      if (targetAgent === 'self') {
        // Execute directly using existing functions
        result = await executeDirectly(step, supabase, context);
      } else {
        // Delegate to specialized agent
        try {
          // For now, invoke Edge Functions directly
          // Later: use agent-comms for full pub/sub
          const { data, error } = await supabase.functions.invoke(
            targetAgent.replace('-agent', ''),
            { body: { query: step, context } }
          );
          result = error ? { error: error.message } : data;
        } catch (e) {
          result = { error: e.message };
        }
      }
      
      results.push({ step, agent: targetAgent, result });
      
      // Reflect on each step
      const reflection = await reflect(step, result, callLLM);
      if (!reflection.success && reflection.shouldRetry) {
        console.log(`[COORDINATOR] Step failed, learning: ${reflection.learning}`);
        // Could implement retry logic here
      }
    }
    
    trace.phases.execute = results;

    // ═══════════════════════════════════════════════════════════════
    // PHASE 4: SYNTHESIZE - Create comprehensive answer
    // ═══════════════════════════════════════════════════════════════
    console.log('[COORDINATOR] 📝 Phase 4: Synthesizing...');
    
    const synthesis = await synthesize(query, results, context, callLLM);
    
    trace.phases.synthesize = synthesis;

    // ═══════════════════════════════════════════════════════════════
    // PHASE 5: LEARN - Store knowledge for next time
    // ═══════════════════════════════════════════════════════════════
    console.log('[COORDINATOR] 💾 Phase 5: Learning...');
    
    await brain.learn({
      query,
      response: synthesis.answer,
      source: 'thinking-coordinator',
      thread_id: trace.thread_id,
      knowledge: {
        plan: plan.steps,
        agents_used: results.map(r => r.agent),
        confidence: synthesis.confidence,
        insights: synthesis.insights,
      },
    });

    // If we discovered new insights, broadcast to all agents
    for (const insight of synthesis.insights) {
      await comms.broadcastInsight(insight, { query, source: 'coordinator' });
    }

    // Store reasoning trace for debugging
    await supabase.from('reasoning_traces').insert({
      query,
      thread_id: trace.thread_id,
      deliberation: plan,
      execution_results: results,
      synthesis,
      duration_ms: Date.now() - startTime,
    });

    trace.phases.learn = { stored: true, insights_broadcast: synthesis.insights.length };

    // ═══════════════════════════════════════════════════════════════
    // RETURN INTELLIGENT RESPONSE
    // ═══════════════════════════════════════════════════════════════
    
    await comms.disconnect();
    
    return new Response(JSON.stringify({
      answer: synthesis.answer,
      confidence: synthesis.confidence,
      insights: synthesis.insights,
      reasoning: {
        understanding: plan.understanding,
        plan: plan.steps,
        agents_used: [...new Set(results.map(r => r.agent))],
      },
      thread_id: trace.thread_id,
      duration_ms: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[COORDINATOR] Error:', error);
    await comms.disconnect();
    
    return new Response(JSON.stringify({
      error: error.message,
      trace,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function executeDirectly(step: string, supabase: any, context: string): Promise<any> {
  // Direct database queries for simple steps
  const stepLower = step.toLowerCase();
  
  if (stepLower.includes('health') && stepLower.includes('score')) {
    const { data } = await supabase
      .from('client_health_scores')
      .select('*')
      .order('calculated_at', { ascending: false })
      .limit(10);
    return { health_scores: data };
  }
  
  if (stepLower.includes('revenue') || stepLower.includes('deal')) {
    const { data } = await supabase
      .from('deals')
      .select('*')
      .order('close_date', { ascending: false })
      .limit(20);
    return { deals: data };
  }
  
  if (stepLower.includes('lead')) {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('lifecycle_stage', 'lead')
      .limit(20);
    return { leads: data };
  }
  
  return { executed: step, status: 'completed' };
}
```

---

## TASK 4: Create Database Tables
Run in Supabase SQL Editor:

```sql
-- Agent communication messages
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('request', 'response', 'insight', 'alert')),
  payload JSONB NOT NULL,
  correlation_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_messages_to ON agent_messages(to_agent, created_at DESC);
CREATE INDEX idx_agent_messages_corr ON agent_messages(correlation_id);

-- Reasoning traces for debugging
CREATE TABLE IF NOT EXISTS reasoning_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  thread_id TEXT,
  deliberation JSONB,
  execution_results JSONB,
  synthesis JSONB,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reasoning_traces_thread ON reasoning_traces(thread_id);

-- Agent patterns (learned behaviors)
CREATE TABLE IF NOT EXISTS agent_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name TEXT UNIQUE NOT NULL,
  description TEXT,
  examples JSONB DEFAULT '[]',
  confidence FLOAT DEFAULT 0.5,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reasoning_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_patterns ENABLE ROW LEVEL SECURITY;

-- Service role only
CREATE POLICY "service_only_agent_messages" ON agent_messages FOR ALL USING (false);
CREATE POLICY "service_only_reasoning_traces" ON reasoning_traces FOR ALL USING (false);
CREATE POLICY "service_only_agent_patterns" ON agent_patterns FOR ALL USING (false);
```

---

## TASK 5: Update unified-brain.ts
Add these methods to `/supabase/functions/_shared/unified-brain.ts`:

```typescript
// Add to the UnifiedBrain class:

  // ==========================================================================
  // PATTERNS - LEARNED BEHAVIORS
  // ==========================================================================

  async recordPattern(
    name: string,
    description: string,
    example: any,
    confidence = 0.6
  ): Promise<void> {
    const { data: existing } = await this.supabase
      .from('agent_patterns')
      .select('*')
      .eq('pattern_name', name)
      .single();

    if (existing) {
      // Update existing pattern
      const examples = [...(existing.examples || []), example].slice(-10);
      await this.supabase
        .from('agent_patterns')
        .update({
          examples,
          confidence: Math.min(1, existing.confidence + 0.05),
          usage_count: existing.usage_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('pattern_name', name);
    } else {
      // Create new pattern
      await this.supabase
        .from('agent_patterns')
        .insert({
          pattern_name: name,
          description,
          examples: [example],
          confidence,
          usage_count: 1,
        });
    }
  }

  async getTopPatterns(limit = 5): Promise<any[]> {
    const { data } = await this.supabase
      .from('agent_patterns')
      .select('*')
      .order('confidence', { ascending: false })
      .order('usage_count', { ascending: false })
      .limit(limit);
    return data || [];
  }

  // ==========================================================================
  // FACTS - PERMANENT KNOWLEDGE
  // ==========================================================================

  async storeFact(key: string, value: any, source = 'system'): Promise<void> {
    await this.supabase
      .from('user_memory')
      .upsert({
        user_key: 'ptd_brain',
        memory_key: `fact_${key}`,
        memory_value: { value, source, stored_at: new Date().toISOString() },
        memory_type: 'fact',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_key,memory_key' });
  }

  async getFact(key: string): Promise<any> {
    const { data } = await this.supabase
      .from('user_memory')
      .select('memory_value')
      .eq('user_key', 'ptd_brain')
      .eq('memory_key', `fact_${key}`)
      .single();
    return data?.memory_value?.value || null;
  }

  async getAllFacts(): Promise<Record<string, any>> {
    const { data } = await this.supabase
      .from('user_memory')
      .select('memory_key, memory_value')
      .eq('user_key', 'ptd_brain')
      .eq('memory_type', 'fact');
    
    const facts: Record<string, any> = {};
    for (const row of data || []) {
      const key = row.memory_key.replace('fact_', '');
      facts[key] = row.memory_value?.value;
    }
    return facts;
  }
```

---

## TASK 6: Deploy and Test

```bash
# Deploy the new function
cd /Users/milosvukovic/client-vital-suite
supabase functions deploy thinking-coordinator

# Test it
curl -X POST https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/thinking-coordinator \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Why is client retention dropping and what should we do about it?",
    "thread_id": "test_001"
  }'
```

---

## EXPECTED OUTPUT AFTER IMPLEMENTATION

**Before (dumb agent):**
```
User: "Why is retention dropping?"
Agent: SELECT * FROM client_health_scores → "Here's the data..."
```

**After (thinking agent):**
```
User: "Why is retention dropping?"

[RECALL] Found 3 relevant memories about retention
[DELIBERATE] 
  Understanding: User wants to understand AND fix retention decline
  Plan: 1. Get retention metrics, 2. Compare to benchmark, 3. Identify causes, 4. Recommend actions

[EXECUTE]
  analyst-agent → Retention down 12% vs last quarter
  customer-agent → Churn concentrated in Yellow zone clients
  hubspot-agent → 23 clients haven't had contact in 14+ days

[SYNTHESIZE]
  "Retention dropped 12% primarily because Yellow zone clients 
  (health scores 50-69) are churning before intervention. 
  
  ROOT CAUSE: Average intervention time is 8 days after entering 
  Yellow - but 60% churn within 5 days.
  
  RECOMMENDATION: 
  1. Reduce intervention trigger to 3 days in Yellow
  2. Focus on coaches Ahmed and Sara who have highest Yellow churn
  3. Expected impact: Recover 8-10 clients = ~AED 35,000/month
  
  Confidence: 0.87"

[LEARN] Stored pattern: "Yellow zone churn correlates with intervention delay"
```

---

## FILES TO CREATE

1. `/supabase/functions/_shared/reasoning-engine.ts` - Thinking module
2. `/supabase/functions/_shared/agent-comms.ts` - Communication module  
3. `/supabase/functions/thinking-coordinator/index.ts` - Main coordinator
4. Run SQL for new tables
5. Update `/supabase/functions/_shared/unified-brain.ts` with new methods

## IMPLEMENTATION ORDER

1. Run SQL to create tables first
2. Update unified-brain.ts with pattern/fact methods
3. Create reasoning-engine.ts
4. Create agent-comms.ts
5. Create thinking-coordinator
6. Deploy and test
