# Smart RAG Agent Architecture for PTD Dashboard

## Overview

This document outlines how to add **intelligent AI agents** to your dashboard using:
- **Claude** (analysis, reasoning, recommendations)
- **Gemini** (fast queries, embeddings, multi-modal)
- **Supabase** (vector memory, conversation history, knowledge base)

---

## Architecture Options

### Option A: Single Unified Agent (Recommended for Start)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PTD INTELLIGENCE AGENT                        │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐         │
│  │   MEMORY     │   │   CONTEXT    │   │   ACTIONS    │         │
│  │  (Supabase)  │   │    (RAG)     │   │  (Functions) │         │
│  └──────────────┘   └──────────────┘   └──────────────┘         │
│         │                  │                  │                  │
│         └─────────────────┼──────────────────┘                  │
│                           │                                      │
│                    ┌──────▼──────┐                              │
│                    │   CLAUDE    │                              │
│                    │  (Sonnet)   │                              │
│                    └─────────────┘                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Best for:** Getting started quickly, lower cost, simpler maintenance

---

### Option B: Multi-Agent System (3 Specialized Agents)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AGENT ORCHESTRATOR                           │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  ANALYST AGENT  │  │  ADVISOR AGENT  │  │  WATCHER AGENT  │     │
│  │    (Claude)     │  │    (Claude)     │  │    (Gemini)     │     │
│  │                 │  │                 │  │                 │     │
│  │ • Risk Analysis │  │ • Interventions │  │ • Pattern Watch │     │
│  │ • Score Explain │  │ • Coach Tips    │  │ • Anomaly Alert │     │
│  │ • Trend Predict │  │ • Client Comms  │  │ • Real-time Mon │     │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘     │
│           │                    │                    │               │
│           └────────────────────┼────────────────────┘               │
│                                │                                    │
│                    ┌───────────▼───────────┐                       │
│                    │   SHARED MEMORY       │                       │
│                    │     (Supabase)        │                       │
│                    │  • Vector Store       │                       │
│                    │  • Conversation Log   │                       │
│                    │  • Agent Decisions    │                       │
│                    └───────────────────────┘                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Best for:** Complex use cases, parallel processing, specialized expertise

---

## Supabase Memory Architecture

### Required Tables

```sql
-- 1. VECTOR KNOWLEDGE BASE (for RAG)
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  content_type TEXT NOT NULL, -- 'client_insight', 'intervention_outcome', 'pattern', 'coach_tip'
  metadata JSONB DEFAULT '{}',
  embedding VECTOR(1536), -- For similarity search
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable vector search
CREATE INDEX ON knowledge_base USING ivfflat (embedding vector_cosine_ops);

-- 2. CONVERSATION MEMORY (per user/session)
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id TEXT,
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  agent_type TEXT, -- 'analyst', 'advisor', 'watcher'
  context JSONB DEFAULT '{}', -- Additional context (client_id, etc)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_session ON agent_conversations(session_id, created_at);

-- 3. AGENT DECISIONS LOG (for learning)
CREATE TABLE agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL,
  decision_type TEXT NOT NULL, -- 'intervention', 'alert', 'recommendation'
  input_context JSONB NOT NULL,
  decision JSONB NOT NULL,
  confidence FLOAT,
  outcome TEXT, -- 'pending', 'successful', 'failed'
  outcome_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  outcome_recorded_at TIMESTAMPTZ
);

-- 4. PROACTIVE INSIGHTS QUEUE
CREATE TABLE proactive_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type TEXT NOT NULL, -- 'alert', 'recommendation', 'pattern', 'prediction'
  priority TEXT NOT NULL, -- 'critical', 'high', 'medium', 'low'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  action_items JSONB DEFAULT '[]',
  affected_entities JSONB DEFAULT '{}', -- { clients: [], coaches: [] }
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- 5. AGENT CONTEXT CACHE (fast retrieval)
CREATE TABLE agent_context (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  agent_type TEXT,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Agent Implementation

### 1. Analyst Agent (Claude Sonnet)

**Purpose:** Deep analysis of client health, risk prediction, trend explanation

```typescript
// supabase/functions/agent-analyst/index.ts

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic();
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface AnalystQuery {
  query: string;
  context?: {
    client_id?: string;
    coach_id?: string;
    date_range?: { start: string; end: string };
  };
  session_id: string;
}

// Get relevant context from vector store
async function getRAGContext(query: string): Promise<string> {
  // Generate embedding for query (use Gemini for speed)
  const embedding = await generateEmbedding(query);

  // Search similar content
  const { data } = await supabase.rpc("match_knowledge", {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: 5
  });

  return data?.map((d: any) => d.content).join("\n\n") || "";
}

// Get conversation history
async function getConversationHistory(sessionId: string): Promise<string> {
  const { data } = await supabase
    .from("agent_conversations")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(10);

  return data?.map(m => `${m.role}: ${m.content}`).join("\n") || "";
}

// Get live dashboard data
async function getDashboardContext(context: any): Promise<string> {
  const queries = [];

  // Get zone distribution
  queries.push(
    supabase.rpc("get_zone_distribution", {
      target_date: new Date().toISOString().split("T")[0]
    })
  );

  // Get at-risk clients
  queries.push(
    supabase.from("client_health_scores")
      .select("*")
      .in("health_zone", ["RED", "YELLOW"])
      .order("predictive_risk_score", { ascending: false })
      .limit(10)
  );

  // Get recent interventions
  queries.push(
    supabase.from("intervention_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5)
  );

  const [zones, atRisk, interventions] = await Promise.all(queries);

  return `
## Current Dashboard State
Zone Distribution: ${JSON.stringify(zones.data)}
Top At-Risk Clients: ${JSON.stringify(atRisk.data)}
Recent Interventions: ${JSON.stringify(interventions.data)}
`;
}

export async function analyzeWithAgent(input: AnalystQuery): Promise<string> {
  // 1. Get RAG context
  const ragContext = await getRAGContext(input.query);

  // 2. Get conversation history
  const history = await getConversationHistory(input.session_id);

  // 3. Get live data
  const dashboardData = await getDashboardContext(input.context);

  // 4. Build system prompt
  const systemPrompt = `You are the PTD Fitness Intelligence Analyst Agent. Your role is to:
- Analyze client health data and predict churn risks
- Explain trends and patterns in client behavior
- Provide data-driven insights for retention strategies
- Answer questions about specific clients or coaches

You have access to:
1. Historical knowledge base (patterns, past interventions, outcomes)
2. Current dashboard data (real-time metrics)
3. Conversation history with the user

Always cite specific data points. Be proactive in surfacing insights.

## Knowledge Base Context
${ragContext}

## Current Dashboard Data
${dashboardData}

## Conversation History
${history}`;

  // 5. Call Claude
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: input.query }]
  });

  const answer = response.content[0].type === "text"
    ? response.content[0].text
    : "";

  // 6. Save to conversation history
  await supabase.from("agent_conversations").insert([
    {
      session_id: input.session_id,
      role: "user",
      content: input.query,
      agent_type: "analyst"
    },
    {
      session_id: input.session_id,
      role: "assistant",
      content: answer,
      agent_type: "analyst"
    }
  ]);

  return answer;
}
```

---

### 2. Advisor Agent (Claude Sonnet)

**Purpose:** Generate intervention strategies, communication templates, coach recommendations

```typescript
// supabase/functions/agent-advisor/index.ts

interface AdvisorRequest {
  request_type: "intervention" | "communication" | "coach_tip";
  client_id?: string;
  coach_id?: string;
  situation: string;
  session_id: string;
}

export async function getAdvice(input: AdvisorRequest): Promise<any> {
  // Get client/coach context
  const context = await getEntityContext(input);

  // Get past successful interventions
  const successfulInterventions = await supabase
    .from("agent_decisions")
    .select("*")
    .eq("decision_type", "intervention")
    .eq("outcome", "successful")
    .limit(5);

  const systemPrompt = `You are the PTD Fitness Client Advisor Agent. Your role is to:
- Design personalized intervention strategies
- Write compelling client communications
- Provide coaching tips for trainers
- Learn from past successful interventions

## Past Successful Interventions
${JSON.stringify(successfulInterventions.data)}

## Client/Coach Context
${JSON.stringify(context)}

Always provide:
1. Specific, actionable recommendations
2. Communication templates ready to use
3. Success probability estimate
4. Follow-up timeline

Output as JSON:
{
  "recommendation": "string",
  "communication_template": "string (personalized message)",
  "action_steps": ["step1", "step2"],
  "success_probability": 0.0-1.0,
  "follow_up_days": number,
  "reasoning": "string"
}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{
      role: "user",
      content: `Request: ${input.request_type}\nSituation: ${input.situation}`
    }]
  });

  // Parse and save decision
  const advice = parseJSON(response.content[0]);

  await supabase.from("agent_decisions").insert({
    agent_type: "advisor",
    decision_type: input.request_type,
    input_context: input,
    decision: advice,
    confidence: advice.success_probability
  });

  return advice;
}
```

---

### 3. Watcher Agent (Gemini - Fast, Real-time)

**Purpose:** Continuous monitoring, anomaly detection, instant alerts

```typescript
// supabase/functions/agent-watcher/index.ts

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!);

interface WatcherAlert {
  type: "anomaly" | "threshold" | "pattern" | "prediction";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  details: string;
  affected_clients: string[];
  recommended_action: string;
}

// Run every 5 minutes via Supabase cron
export async function watchDashboard(): Promise<WatcherAlert[]> {
  const alerts: WatcherAlert[] = [];

  // 1. Check for sudden health score drops
  const { data: recentScores } = await supabase
    .from("client_health_scores")
    .select("email, health_score, health_zone, calculated_at")
    .gte("calculated_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("calculated_at", { ascending: false });

  // 2. Check for RED zone threshold
  const redZoneClients = recentScores?.filter(c => c.health_zone === "RED") || [];
  if (redZoneClients.length > 5) {
    alerts.push({
      type: "threshold",
      severity: "critical",
      title: "RED Zone Surge Detected",
      details: `${redZoneClients.length} clients now in RED zone (threshold: 5)`,
      affected_clients: redZoneClients.map(c => c.email),
      recommended_action: "Review all RED zone clients immediately"
    });
  }

  // 3. Use Gemini for fast pattern analysis
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Analyze this client health data for anomalies.
Data: ${JSON.stringify(recentScores?.slice(0, 50))}

Output JSON array of anomalies found:
[{
  "type": "anomaly|pattern",
  "severity": "critical|high|medium",
  "description": "what you found",
  "affected_clients": ["email1", "email2"]
}]

Only output if you find real anomalies. Empty array [] if none.`;

  const result = await model.generateContent(prompt);
  const geminiAlerts = parseJSON(result.response.text());

  // 4. Combine and dedupe alerts
  for (const ga of geminiAlerts) {
    alerts.push({
      type: ga.type,
      severity: ga.severity,
      title: ga.description.split(".")[0],
      details: ga.description,
      affected_clients: ga.affected_clients,
      recommended_action: "Review flagged clients"
    });
  }

  // 5. Save to proactive insights
  if (alerts.length > 0) {
    await supabase.from("proactive_insights").insert(
      alerts.map(a => ({
        insight_type: "alert",
        priority: a.severity,
        title: a.title,
        content: a.details,
        action_items: [a.recommended_action],
        affected_entities: { clients: a.affected_clients }
      }))
    );
  }

  return alerts;
}
```

---

## Proactive Dashboard Integration

### React Component: AI Assistant Panel

```tsx
// src/components/ai/AIAssistantPanel.tsx

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, AlertTriangle, Lightbulb, TrendingUp } from "lucide-react";

export function AIAssistantPanel() {
  const [query, setQuery] = useState("");
  const [sessionId] = useState(() => crypto.randomUUID());

  // Fetch proactive insights
  const { data: insights } = useQuery({
    queryKey: ["proactive-insights"],
    queryFn: async () => {
      const { data } = await supabase
        .from("proactive_insights")
        .select("*")
        .eq("is_dismissed", false)
        .order("created_at", { ascending: false })
        .limit(5);
      return data;
    },
    refetchInterval: 30000 // Check every 30 seconds
  });

  // Fetch conversation history
  const { data: messages } = useQuery({
    queryKey: ["agent-messages", sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_conversations")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      return data;
    }
  });

  // Send message to agent
  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const { data } = await supabase.functions.invoke("agent-analyst", {
        body: { query: message, session_id: sessionId }
      });
      return data;
    }
  });

  return (
    <Card className="h-[600px] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <span className="font-semibold">PTD Intelligence Assistant</span>
        {insights?.length > 0 && (
          <Badge variant="destructive">{insights.length} alerts</Badge>
        )}
      </div>

      {/* Proactive Insights */}
      {insights?.length > 0 && (
        <div className="p-3 bg-yellow-50 border-b">
          <div className="text-sm font-medium mb-2 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            Proactive Insights
          </div>
          {insights.slice(0, 3).map(insight => (
            <div
              key={insight.id}
              className="text-sm p-2 bg-white rounded mb-1 cursor-pointer hover:bg-gray-50"
              onClick={() => setQuery(`Tell me more about: ${insight.title}`)}
            >
              <Badge
                variant={insight.priority === "critical" ? "destructive" : "secondary"}
                className="mr-2"
              >
                {insight.priority}
              </Badge>
              {insight.title}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages?.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[80%] p-3 rounded-lg ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {sendMessage.isPending && (
          <div className="flex justify-start">
            <div className="bg-muted p-3 rounded-lg">
              <span className="animate-pulse">Analyzing...</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-2 border-t flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuery("What clients need immediate attention today?")}
        >
          <AlertTriangle className="h-3 w-3 mr-1" />
          At-Risk Today
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuery("Which coaches have declining client health?")}
        >
          <TrendingUp className="h-3 w-3 mr-1" />
          Coach Trends
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuery("What patterns did you notice this week?")}
        >
          <Lightbulb className="h-3 w-3 mr-1" />
          Weekly Insights
        </Button>
      </div>

      {/* Input */}
      <div className="p-4 border-t flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about clients, coaches, trends..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              sendMessage.mutate(query);
              setQuery("");
            }
          }}
        />
        <Button
          onClick={() => {
            if (query.trim()) {
              sendMessage.mutate(query);
              setQuery("");
            }
          }}
          disabled={sendMessage.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
```

---

## Example Queries Your Agent Can Answer

### Analyst Agent (Claude)
```
"Why did John's health score drop 20 points this week?"
"Which clients are most likely to churn next month?"
"Compare Coach A vs Coach B client retention"
"What's causing the spike in RED zone clients?"
"Show me the pattern for clients who churned last quarter"
```

### Advisor Agent (Claude)
```
"Write a re-engagement message for Sarah who hasn't visited in 3 weeks"
"What intervention should I use for a client with 2 sessions left?"
"Give me coaching tips for handling declining clients"
"Create a win-back campaign for RED zone clients"
```

### Watcher Agent (Gemini)
```
[Automatic Alerts]
⚠️ "5 GREEN clients dropped to YELLOW in last 24 hours"
🚨 "Coach Mike has 80% of clients in RED/YELLOW"
📉 "Unusual pattern: Monday bookings down 40% vs average"
💡 "Opportunity: 12 clients nearing package end with high health"
```

---

## Cost Estimates

| Component | Model | Usage | Monthly Cost |
|-----------|-------|-------|--------------|
| Analyst | Claude Sonnet | ~500 queries/day | ~$15-30 |
| Advisor | Claude Sonnet | ~100 interventions/day | ~$5-10 |
| Watcher | Gemini Flash | ~300 checks/day | ~$2-5 |
| Embeddings | Gemini | ~1000/day | ~$1-2 |
| **Total** | | | **~$25-50/month** |

---

## Implementation Roadmap

### Week 1: Foundation
- [ ] Create Supabase tables (knowledge_base, conversations, decisions)
- [ ] Set up vector embeddings with pgvector
- [ ] Create basic analyst agent edge function

### Week 2: Core Agents
- [ ] Build advisor agent with intervention templates
- [ ] Build watcher agent with anomaly detection
- [ ] Create proactive insights queue

### Week 3: Dashboard Integration
- [ ] Add AI Assistant Panel component
- [ ] Integrate proactive alerts into dashboard header
- [ ] Add "Ask AI" buttons on client/coach cards

### Week 4: Learning & Refinement
- [ ] Implement feedback loop (mark recommendations as helpful/not)
- [ ] Populate knowledge base with historical data
- [ ] Fine-tune prompts based on usage

---

## Quick Start: Minimal Setup (Single Agent)

If you want to start with the **simplest possible setup**:

```typescript
// supabase/functions/ptd-assistant/index.ts

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic();
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const { query, session_id } = await req.json();

  // Get current dashboard state
  const [
    { data: zones },
    { data: atRisk },
    { data: summary }
  ] = await Promise.all([
    supabase.rpc("get_zone_distribution", {
      target_date: new Date().toISOString().split("T")[0]
    }),
    supabase.from("client_health_scores")
      .select("*")
      .in("health_zone", ["RED", "YELLOW"])
      .limit(20),
    supabase.from("daily_summary")
      .select("*")
      .order("date", { ascending: false })
      .limit(1)
  ]);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: `You are PTD Fitness AI Assistant. Help analyze client health data.

Current State:
- Zone Distribution: ${JSON.stringify(zones)}
- At-Risk Clients: ${JSON.stringify(atRisk)}
- Daily Summary: ${JSON.stringify(summary)}

Be specific, cite data, give actionable advice.`,
    messages: [{ role: "user", content: query }]
  });

  return new Response(JSON.stringify({
    answer: response.content[0].text
  }));
});
```

This gives you a **working AI assistant in ~50 lines** that can:
- Answer questions about your dashboard
- Has access to live data
- Provides specific, data-driven answers

You can expand from here!
