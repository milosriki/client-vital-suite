# PTD SUPERINTELLIGENT AGENT SYSTEM - CLAUDE CODE IMPLEMENTATION GUIDE

## CURRENT STATE ANALYSIS

You have 30+ Edge Functions in `/supabase/functions/` including:
- `ptd-agent-gemini` - Main agent with RAG + 16 tools
- `smart-agent` - Tool-calling with 7 control modules  
- `super-agent-orchestrator` - Coordinates all functions
- `business-intelligence`, `churn-predictor`, `anomaly-detector`, etc.

### PROBLEM: Agents don't THINK, they just CALL APIs
- No reasoning before acting
- No agent-to-agent communication
- Memory is fragmented (agent_context, agent_memory separate)
- No planning/deliberation step

---

## TASK: Transform into THINKING MULTI-AGENT SYSTEM

### ARCHITECTURE TO IMPLEMENT

```
┌─────────────────────────────────────────────────────────────────┐
│                    THINKING COORDINATOR                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. DELIBERATE: What is the user really asking?          │   │
│  │ 2. PLAN: What steps do I need? Which agents?            │   │
│  │ 3. RECALL: What do I already know? (RAG memory)         │   │
│  │ 4. EXECUTE: Run the plan, adapt if needed               │   │
│  │ 5. REFLECT: Did it work? What did I learn?              │   │
│  │ 6. LEARN: Store insights for next time                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    Supabase Realtime
                    (agent_messages channel)
                             │
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
  ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
  │ ANALYST │          │ EXECUTOR│          │ MONITOR │
  │  Agent  │◄────────►│  Agent  │◄────────►│  Agent  │
  │         │          │         │          │         │
  │ Reasons │          │  Acts   │          │ Watches │
  │ about   │          │  on     │          │ for     │
  │ data    │          │ systems │          │ issues  │
  └────┬────┘          └────┬────┘          └────┬────┘
       │                    │                    │
       └────────────────────┴────────────────────┘
                            │
                   ┌────────▼────────┐
                   │  UNIFIED BRAIN  │
                   │                 │
                   │ • agent_memory  │
                   │ • user_memory   │
                   │ • agent_patterns│
                   │ • pgvector RAG  │
                   └─────────────────┘
```

---

## IMPLEMENTATION STEPS

### STEP 1: Create the ReAct Reasoning Module

File: `/supabase/functions/_shared/reasoning-engine.ts`

```typescript
/**
 * ReAct Reasoning Engine
 * Makes agents THINK before acting
 */

export interface ThinkingStep {
  thought: string;      // What I'm thinking
  reasoning: string;    // Why I think this
  action?: string;      // What tool/agent to call
  observation?: string; // What I learned
}

export interface ReasoningState {
  goal: string;
  plan: string[];
  steps: ThinkingStep[];
  memories_used: string[];
  current_step: number;
  status: 'thinking' | 'acting' | 'reflecting' | 'complete';
}

export async function deliberate(
  query: string,
  context: string,
  llm: (prompt: string) => Promise<string>
): Promise<{ plan: string[]; reasoning: string }> {
  const deliberationPrompt = `
You are the THINKING module of a superintelligent business AI.
Before taking ANY action, you must DELIBERATE.

USER QUERY: ${query}

CONTEXT FROM MEMORY:
${context}

DELIBERATION PROCESS:
1. What is the user REALLY asking? (not surface level)
2. What information do I need to answer this well?
3. What could go wrong? What assumptions am I making?
4. What's my step-by-step plan?

Respond in this exact format:
UNDERSTANDING: [what user really wants]
INFORMATION_NEEDED: [list of data/insights needed]
RISKS: [what could go wrong]
PLAN:
1. [first step]
2. [second step]
...
REASONING: [why this plan is best]
`;

  const response = await llm(deliberationPrompt);
  return parseDeliberation(response);
}

export async function executeWithReflection(
  plan: string[],
  executeStep: (step: string) => Promise<any>,
  reflect: (result: any, step: string) => Promise<{ success: boolean; learning: string }>
): Promise<{ results: any[]; learnings: string[] }> {
  const results = [];
  const learnings = [];
  
  for (const step of plan) {
    // Execute
    const result = await executeStep(step);
    results.push(result);
    
    // Reflect
    const reflection = await reflect(result, step);
    learnings.push(reflection.learning);
    
    // Adapt plan if needed
    if (!reflection.success) {
      // Agent can modify remaining steps based on what it learned
      // This is where true intelligence emerges
    }
  }
  
  return { results, learnings };
}
```

### STEP 2: Agent Communication via Supabase Realtime

File: `/supabase/functions/_shared/agent-communication.ts`

```typescript
/**
 * Agent-to-Agent Communication
 * Agents talk to each other, share insights, request help
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface AgentMessage {
  from_agent: string;
  to_agent: string | 'broadcast';
  message_type: 'request' | 'response' | 'insight' | 'alert';
  payload: any;
  correlation_id: string;
  timestamp: string;
}

export class AgentCommunicator {
  private supabase: any;
  private agentId: string;
  private channel: any;
  private handlers: Map<string, (msg: AgentMessage) => Promise<void>>;

  constructor(agentId: string) {
    this.agentId = agentId;
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    this.handlers = new Map();
  }

  async connect() {
    this.channel = this.supabase.channel('agent_coordination');
    
    this.channel
      .on('broadcast', { event: 'agent_message' }, (payload: any) => {
        const msg = payload.payload as AgentMessage;
        
        // Only process messages for this agent or broadcasts
        if (msg.to_agent === this.agentId || msg.to_agent === 'broadcast') {
          this.handleMessage(msg);
        }
      })
      .subscribe();
  }

  async sendMessage(msg: Omit<AgentMessage, 'from_agent' | 'timestamp'>) {
    const fullMsg: AgentMessage = {
      ...msg,
      from_agent: this.agentId,
      timestamp: new Date().toISOString(),
    };

    // Persist for history
    await this.supabase.from('agent_messages').insert(fullMsg);

    // Broadcast
    await this.channel.send({
      type: 'broadcast',
      event: 'agent_message',
      payload: fullMsg,
    });
  }

  // Request help from another agent
  async askAgent(
    targetAgent: string,
    question: string,
    context: any = {}
  ): Promise<any> {
    const correlationId = crypto.randomUUID();
    
    return new Promise((resolve, reject) => {
      // Set up response handler
      const timeout = setTimeout(() => reject(new Error('Agent timeout')), 30000);
      
      this.handlers.set(correlationId, async (response) => {
        clearTimeout(timeout);
        resolve(response.payload);
      });

      // Send request
      this.sendMessage({
        to_agent: targetAgent,
        message_type: 'request',
        payload: { question, context },
        correlation_id: correlationId,
      });
    });
  }

  // Share an insight with all agents
  async broadcastInsight(insight: string, data: any = {}) {
    await this.sendMessage({
      to_agent: 'broadcast',
      message_type: 'insight',
      payload: { insight, data },
      correlation_id: crypto.randomUUID(),
    });
  }
}
```

### STEP 3: Upgrade Unified Brain with Full RAG

Update: `/supabase/functions/_shared/unified-brain.ts`

```typescript
// Add to existing unified-brain.ts

/**
 * FULL CONTEXT BUILDER
 * Builds intelligent context for any agent request
 */
export async function buildIntelligentContext(
  query: string,
  options: {
    includeRecentConversations?: boolean;
    includePatterns?: boolean;
    includeFacts?: boolean;
    includeAgentInsights?: boolean;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const parts: string[] = [];
  const {
    includeRecentConversations = true,
    includePatterns = true,
    includeFacts = true,
    includeAgentInsights = true,
    maxTokens = 4000
  } = options;

  // 1. RAG Search for relevant memories
  const relevantMemories = await this.recall(query, { limit: 5, threshold: 0.75 });
  if (relevantMemories.length > 0) {
    parts.push('## RELEVANT PAST INTERACTIONS:');
    for (const mem of relevantMemories) {
      parts.push(`- Q: ${mem.query.slice(0, 100)}...`);
      parts.push(`  A: ${mem.response.slice(0, 200)}...`);
      parts.push(`  Similarity: ${(mem.similarity || 0).toFixed(2)}`);
    }
  }

  // 2. Recent conversations (last 5)
  if (includeRecentConversations) {
    const recent = await this.getRecent(5);
    if (recent.length > 0) {
      parts.push('\n## RECENT CONTEXT:');
      for (const r of recent) {
        parts.push(`- ${r.query.slice(0, 100)}...`);
      }
    }
  }

  // 3. Known facts about the business
  if (includeFacts) {
    const facts = await this.getAllFacts();
    const factKeys = Object.keys(facts);
    if (factKeys.length > 0) {
      parts.push('\n## KNOWN FACTS:');
      for (const key of factKeys.slice(0, 15)) {
        parts.push(`- ${key}: ${JSON.stringify(facts[key]).slice(0, 100)}`);
      }
    }
  }

  // 4. Learned patterns
  if (includePatterns) {
    const patterns = await this.getTopPatterns(5);
    if (patterns.length > 0) {
      parts.push('\n## LEARNED PATTERNS:');
      for (const p of patterns) {
        parts.push(`- ${p.pattern_name} (confidence: ${p.confidence})`);
        parts.push(`  ${p.description}`);
      }
    }
  }

  // 5. Recent insights from other agents
  if (includeAgentInsights) {
    const { data: insights } = await this.supabase
      .from('agent_messages')
      .select('*')
      .eq('message_type', 'insight')
      .order('timestamp', { ascending: false })
      .limit(5);
    
    if (insights?.length > 0) {
      parts.push('\n## RECENT AGENT INSIGHTS:');
      for (const i of insights) {
        parts.push(`- [${i.from_agent}]: ${i.payload.insight}`);
      }
    }
  }

  return parts.join('\n').slice(0, maxTokens * 4); // ~4 chars per token
}
```

### STEP 4: Create the Thinking Coordinator Agent

File: `/supabase/functions/thinking-coordinator/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { brain } from "../_shared/unified-brain.ts";
import { deliberate, executeWithReflection } from "../_shared/reasoning-engine.ts";
import { AgentCommunicator } from "../_shared/agent-communication.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Agent registry - which agents handle what
const AGENT_CAPABILITIES = {
  'analyst': ['analyze', 'report', 'insights', 'patterns', 'trends'],
  'executor': ['create', 'update', 'send', 'sync', 'delete'],
  'monitor': ['watch', 'alert', 'detect', 'anomaly', 'fraud'],
  'customer': ['client', 'health', 'churn', 'retention'],
  'sales': ['lead', 'deal', 'pipeline', 'revenue'],
  'finance': ['stripe', 'payment', 'invoice', 'refund'],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { query, thread_id, user_context } = await req.json();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const comm = new AgentCommunicator('coordinator');
  await comm.connect();

  try {
    // ========================================
    // PHASE 1: RECALL - What do I already know?
    // ========================================
    console.log('[COORDINATOR] Phase 1: Recalling relevant context...');
    const context = await brain.buildIntelligentContext(query, {
      includeRecentConversations: true,
      includePatterns: true,
      includeFacts: true,
      includeAgentInsights: true,
    });

    // ========================================
    // PHASE 2: DELIBERATE - Think before acting
    // ========================================
    console.log('[COORDINATOR] Phase 2: Deliberating...');
    const { plan, reasoning } = await deliberate(query, context, async (prompt) => {
      // Use Claude for deliberation
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await response.json();
      return data.content[0].text;
    });

    console.log('[COORDINATOR] Plan:', plan);
    console.log('[COORDINATOR] Reasoning:', reasoning);

    // ========================================
    // PHASE 3: EXECUTE - Run the plan
    // ========================================
    console.log('[COORDINATOR] Phase 3: Executing plan...');
    const results = [];

    for (const step of plan) {
      // Determine which agent should handle this step
      const agent = selectAgentForStep(step);
      
      if (agent === 'self') {
        // Coordinator handles directly
        const result = await executeDirectly(step, supabase, context);
        results.push({ step, agent: 'coordinator', result });
      } else {
        // Delegate to specialized agent
        const result = await comm.askAgent(agent, step, { context, query });
        results.push({ step, agent, result });
      }
    }

    // ========================================
    // PHASE 4: SYNTHESIZE - Create final response
    // ========================================
    console.log('[COORDINATOR] Phase 4: Synthesizing response...');
    const synthesis = await synthesizeResponse(query, results, context);

    // ========================================
    // PHASE 5: REFLECT & LEARN
    // ========================================
    console.log('[COORDINATOR] Phase 5: Learning from interaction...');
    
    // Store the interaction
    await brain.learn({
      query,
      response: synthesis.answer,
      source: 'thinking-coordinator',
      thread_id: thread_id || `coord_${Date.now()}`,
      knowledge: {
        plan_used: plan,
        agents_involved: results.map(r => r.agent),
        success: synthesis.confidence > 0.7,
      },
    });

    // If we learned something new, record it as a pattern
    if (synthesis.newInsight) {
      await brain.recordPattern(
        synthesis.newInsight.name,
        synthesis.newInsight.description,
        { query, response: synthesis.answer },
        0.6
      );

      // Broadcast insight to other agents
      await comm.broadcastInsight(synthesis.newInsight.description, {
        pattern: synthesis.newInsight.name,
        source: 'coordinator',
      });
    }

    return new Response(JSON.stringify({
      answer: synthesis.answer,
      reasoning: reasoning,
      plan: plan,
      agents_used: results.map(r => r.agent),
      confidence: synthesis.confidence,
      thread_id: thread_id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[COORDINATOR] Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      fallback: 'I encountered an issue while thinking. Let me try a simpler approach...',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function selectAgentForStep(step: string): string {
  const stepLower = step.toLowerCase();
  
  for (const [agent, keywords] of Object.entries(AGENT_CAPABILITIES)) {
    for (const keyword of keywords) {
      if (stepLower.includes(keyword)) {
        return agent;
      }
    }
  }
  
  return 'self'; // Coordinator handles unknown steps
}

async function executeDirectly(step: string, supabase: any, context: string): Promise<any> {
  // Direct execution for simple steps
  // This would call existing Edge Functions
  return { executed: step, status: 'complete' };
}

async function synthesizeResponse(
  query: string,
  results: any[],
  context: string
): Promise<{ answer: string; confidence: number; newInsight?: any }> {
  // Combine all results into coherent response
  // Use LLM to synthesize
  return {
    answer: 'Synthesized response based on all agent results',
    confidence: 0.85,
    newInsight: null,
  };
}
```

### STEP 5: Database Tables for Agent Communication

```sql
-- Run in Supabase SQL Editor

-- Agent messages for communication
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  message_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  correlation_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_agent_messages_to ON agent_messages(to_agent, timestamp DESC);
CREATE INDEX idx_agent_messages_correlation ON agent_messages(correlation_id);

-- Agent state (for long-running tasks)
CREATE TABLE IF NOT EXISTS agent_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  state JSONB NOT NULL,
  step_completed INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, task_id)
);

-- Reasoning traces (for debugging and learning)
CREATE TABLE IF NOT EXISTS reasoning_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  deliberation JSONB,
  plan JSONB,
  execution_results JSONB,
  synthesis JSONB,
  learnings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE reasoning_traces ENABLE ROW LEVEL SECURITY;

-- Deny direct access (service_role only)
CREATE POLICY "deny_agent_messages" ON agent_messages FOR ALL USING (false);
CREATE POLICY "deny_agent_state" ON agent_state FOR ALL USING (false);
CREATE POLICY "deny_reasoning_traces" ON reasoning_traces FOR ALL USING (false);
```

---

## WHAT THIS GIVES YOU

### Before (Current State):
```
User: "Why is revenue down?"
Agent: SELECT * FROM deals... → "Here's the data"
```

### After (Thinking System):
```
User: "Why is revenue down?"

[DELIBERATE]
Thinking: User wants to understand revenue decline. This requires:
- Comparing periods
- Identifying contributing factors
- Looking at leading indicators (leads, conversion, churn)
- Understanding if this is seasonal or a real problem

[PLAN]
1. Get revenue data for last 3 months vs previous
2. Check lead volume and quality trends
3. Analyze churn rate changes
4. Look at deal sizes and close rates
5. Check for any anomalies or one-time events

[RECALL]
Memory: Last month I learned that Q4 is typically slow for fitness
Memory: Ahmed's clients have higher churn lately
Pattern: Revenue dips often follow marketing spend reductions

[EXECUTE]
Analyst Agent → Revenue comparison shows 15% decline
Sales Agent → Lead volume down 20%, conversion stable
Customer Agent → Churn up from 5% to 8%
Monitor Agent → No anomalies detected

[SYNTHESIZE]
"Revenue is down 15% primarily due to two factors:
1. Lead volume dropped 20% - likely from reduced ad spend
2. Churn increased to 8% - I noticed Ahmed's clients are struggling

Recommendation: Increase ad spend and have Ahmed review his 
at-risk clients. Based on past patterns, this should recover 
in 4-6 weeks."

[LEARN]
New pattern recorded: "Revenue decline + churn increase = 
focus on retention before acquisition"
```

---

## IMPLEMENTATION ORDER

1. **First**: Create `unified-brain.ts` updates (I already started this)
2. **Second**: Create `reasoning-engine.ts` 
3. **Third**: Create `agent-communication.ts`
4. **Fourth**: Create `thinking-coordinator` Edge Function
5. **Fifth**: Run SQL to create new tables
6. **Sixth**: Update existing agents to use unified brain
7. **Last**: Connect frontend to new coordinator endpoint

---

## TESTING THE SYSTEM

```bash
# Test the thinking coordinator
curl -X POST https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/thinking-coordinator \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Why is client retention dropping and what should we do?",
    "thread_id": "test_001"
  }'
```

Expected response shows: deliberation, plan, agent coordination, and synthesized answer with reasoning.
