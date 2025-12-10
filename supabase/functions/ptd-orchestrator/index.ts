import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= TYPE DEFINITIONS =============

type QueryIntent =
  | 'sales'
  | 'health'
  | 'fraud'
  | 'support'
  | 'analytics'
  | 'general'
  | 'coach_performance'
  | 'churn_risk'
  | 'lead_management';

interface AgentCapability {
  name: string;
  functionName: string;
  intents: QueryIntent[];
  description: string;
  priority: number; // Higher = preferred for this intent
  requiredEnvVars?: string[];
}

interface ClassificationResult {
  intent: QueryIntent;
  confidence: number;
  suggestedAgents: string[];
  requiresMultiAgent: boolean;
  keywords: string[];
}

interface AgentResult {
  agentName: string;
  success: boolean;
  data: any;
  error?: string;
  executionTime: number;
}

interface OrchestratorResponse {
  intent: QueryIntent;
  confidence: number;
  agentsInvoked: string[];
  results: AgentResult[];
  synthesizedResponse: string;
  totalExecutionTime: number;
  metadata: {
    parallel: boolean;
    cached: boolean;
  };
}

// ============= AGENT REGISTRY =============

const AGENT_REGISTRY: AgentCapability[] = [
  {
    name: "Sales Agent",
    functionName: "ptd-agent-gemini",
    intents: ["sales", "lead_management", "general"],
    description: "Handles sales queries, lead management, pipeline tracking, and general business questions",
    priority: 9,
    requiredEnvVars: ["LOVABLE_API_KEY"],
  },
  {
    name: "Health Agent",
    functionName: "health-calculator",
    intents: ["health", "churn_risk"],
    description: "Calculates client health scores, identifies at-risk clients",
    priority: 10,
  },
  {
    name: "Fraud Agent",
    functionName: "stripe-forensics",
    intents: ["fraud"],
    description: "Detects payment fraud, analyzes Stripe transactions for anomalies",
    priority: 10,
    requiredEnvVars: ["STRIPE_SECRET_KEY"],
  },
  {
    name: "Business Intelligence Agent",
    functionName: "business-intelligence",
    intents: ["analytics", "general"],
    description: "Provides business analytics, operational metrics, revenue insights",
    priority: 8,
    requiredEnvVars: ["LOVABLE_API_KEY"],
  },
  {
    name: "Churn Predictor Agent",
    functionName: "churn-predictor",
    intents: ["churn_risk", "health"],
    description: "Predicts client churn risk using ML models",
    priority: 9,
  },
  {
    name: "Coach Performance Agent",
    functionName: "coach-analyzer",
    intents: ["coach_performance", "analytics"],
    description: "Analyzes coach performance, client satisfaction, training effectiveness",
    priority: 9,
  },
  {
    name: "Intervention Agent",
    functionName: "intervention-recommender",
    intents: ["health", "churn_risk", "support"],
    description: "Recommends interventions for at-risk clients",
    priority: 8,
  },
  {
    name: "General Agent",
    functionName: "ptd-agent-gemini",
    intents: ["general", "support"],
    description: "Fallback agent for general queries and support",
    priority: 5,
    requiredEnvVars: ["LOVABLE_API_KEY"],
  },
];

// ============= SEMANTIC ROUTER =============

/**
 * Analyzes query intent using keyword matching and semantic patterns
 */
function classifyQuery(query: string): ClassificationResult {
  const queryLower = query.toLowerCase();

  // Define intent patterns with keywords and confidence weights
  const intentPatterns: Record<QueryIntent, { keywords: string[]; weight: number }> = {
    sales: {
      keywords: ["lead", "deal", "pipeline", "prospect", "conversion", "close", "revenue", "sale", "opportunity", "quote"],
      weight: 1.0,
    },
    health: {
      keywords: ["health", "score", "wellness", "client status", "engagement", "active", "session", "workout"],
      weight: 1.0,
    },
    fraud: {
      keywords: ["fraud", "suspicious", "payment", "stripe", "transaction", "chargeback", "dispute", "anomaly", "unusual payment"],
      weight: 1.0,
    },
    support: {
      keywords: ["help", "issue", "problem", "support", "question", "how to", "why", "what is"],
      weight: 0.7,
    },
    analytics: {
      keywords: ["report", "dashboard", "analytics", "metrics", "kpi", "performance", "trend", "summary", "business intelligence"],
      weight: 0.9,
    },
    coach_performance: {
      keywords: ["coach", "trainer", "instructor", "staff performance", "coach stats", "trainer metrics"],
      weight: 1.0,
    },
    churn_risk: {
      keywords: ["churn", "at risk", "leaving", "cancel", "retention", "inactive", "red zone", "yellow zone"],
      weight: 1.0,
    },
    lead_management: {
      keywords: ["new lead", "follow up", "contact lead", "lead response", "lead quality", "lead score"],
      weight: 0.9,
    },
    general: {
      keywords: ["show", "get", "find", "search", "list", "tell me", "what", "who"],
      weight: 0.5,
    },
  };

  // Score each intent
  const scores: Record<QueryIntent, number> = {
    sales: 0,
    health: 0,
    fraud: 0,
    support: 0,
    analytics: 0,
    general: 0,
    coach_performance: 0,
    churn_risk: 0,
    lead_management: 0,
  };

  const matchedKeywords: string[] = [];

  // Calculate scores based on keyword matches
  for (const [intent, pattern] of Object.entries(intentPatterns)) {
    for (const keyword of pattern.keywords) {
      if (queryLower.includes(keyword)) {
        scores[intent as QueryIntent] += pattern.weight;
        matchedKeywords.push(keyword);
      }
    }
  }

  // Find highest scoring intent
  let maxScore = 0;
  let primaryIntent: QueryIntent = "general";

  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      primaryIntent = intent as QueryIntent;
    }
  }

  // Determine if multiple agents are needed
  const requiresMultiAgent =
    (scores.health > 0 && scores.analytics > 0) ||
    (scores.churn_risk > 0 && scores.health > 0) ||
    (scores.coach_performance > 0 && scores.analytics > 0) ||
    queryLower.includes("comprehensive") ||
    queryLower.includes("full report") ||
    queryLower.includes("complete analysis");

  // Get suggested agents based on intent
  const suggestedAgents = AGENT_REGISTRY
    .filter(agent => agent.intents.includes(primaryIntent))
    .sort((a, b) => b.priority - a.priority)
    .map(agent => agent.functionName);

  // Calculate confidence (normalized score)
  const confidence = Math.min(maxScore / 3, 1.0); // Normalize to 0-1 range

  return {
    intent: primaryIntent,
    confidence,
    suggestedAgents: [...new Set(suggestedAgents)], // Remove duplicates
    requiresMultiAgent,
    keywords: [...new Set(matchedKeywords)],
  };
}

/**
 * Select agents to invoke based on classification
 */
function selectAgents(classification: ClassificationResult): AgentCapability[] {
  const selectedAgents: AgentCapability[] = [];

  if (classification.requiresMultiAgent) {
    // Multi-agent scenario: select top 2-3 relevant agents
    const relevantAgents = AGENT_REGISTRY
      .filter(agent => {
        // Check if agent handles the primary intent or related intents
        const keywords = classification.keywords;
        const agentIntents = agent.intents;

        return agentIntents.includes(classification.intent) ||
          keywords.some(kw => agent.description.toLowerCase().includes(kw));
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);

    selectedAgents.push(...relevantAgents);
  } else {
    // Single agent scenario: select best match
    const bestAgent = AGENT_REGISTRY
      .filter(agent => agent.intents.includes(classification.intent))
      .sort((a, b) => b.priority - a.priority)[0];

    if (bestAgent) {
      selectedAgents.push(bestAgent);
    }
  }

  // Fallback to general agent if no agents selected
  if (selectedAgents.length === 0) {
    const fallback = AGENT_REGISTRY.find(a => a.functionName === "ptd-agent-gemini");
    if (fallback) selectedAgents.push(fallback);
  }

  return selectedAgents;
}

// ============= AGENT EXECUTION =============

/**
 * Execute a single agent function
 */
async function executeAgent(
  supabase: any,
  agent: AgentCapability,
  query: string,
  context: any = {}
): Promise<AgentResult> {
  const startTime = Date.now();

  console.log(`[Orchestrator] Executing agent: ${agent.name} (${agent.functionName})`);

  try {
    // Check required environment variables
    if (agent.requiredEnvVars) {
      for (const envVar of agent.requiredEnvVars) {
        if (!Deno.env.get(envVar)) {
          console.warn(`[Orchestrator] Missing env var ${envVar} for ${agent.name}`);
          return {
            agentName: agent.name,
            success: false,
            data: null,
            error: `Missing required configuration: ${envVar}`,
            executionTime: Date.now() - startTime,
          };
        }
      }
    }

    // Prepare request body based on agent type
    let requestBody: any = {};

    if (agent.functionName === "ptd-agent-gemini") {
      requestBody = {
        message: query,
        thread_id: context.threadId || `orchestrator_${Date.now()}`,
      };
    } else if (agent.functionName === "stripe-forensics") {
      requestBody = { action: "full-audit", days_back: 30 };
    } else if (agent.functionName === "health-calculator") {
      requestBody = { mode: "calculate" };
    } else if (agent.functionName === "business-intelligence") {
      requestBody = {};
    } else {
      requestBody = { query, context };
    }

    // Invoke the agent function
    const { data, error } = await supabase.functions.invoke(agent.functionName, {
      body: requestBody,
    });

    if (error) {
      console.error(`[Orchestrator] Agent ${agent.name} error:`, error);
      return {
        agentName: agent.name,
        success: false,
        data: null,
        error: error.message || String(error),
        executionTime: Date.now() - startTime,
      };
    }

    return {
      agentName: agent.name,
      success: true,
      data,
      executionTime: Date.now() - startTime,
    };

  } catch (error) {
    console.error(`[Orchestrator] Exception in ${agent.name}:`, error);
    return {
      agentName: agent.name,
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Execute multiple agents in parallel
 */
async function executeAgentsParallel(
  supabase: any,
  agents: AgentCapability[],
  query: string,
  context: any = {}
): Promise<AgentResult[]> {
  console.log(`[Orchestrator] Executing ${agents.length} agents in parallel`);

  const promises = agents.map(agent => executeAgent(supabase, agent, query, context));
  const results = await Promise.all(promises);

  return results;
}

// ============= RESPONSE SYNTHESIS =============

/**
 * Synthesize final response from multiple agent results using AI
 */
async function synthesizeResponse(
  classification: ClassificationResult,
  results: AgentResult[],
  originalQuery: string
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!LOVABLE_API_KEY) {
    // Fallback: simple text synthesis
    return synthesizeResponseSimple(classification, results);
  }

  try {
    // Prepare context for AI synthesis
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    const contextText = `
Original Query: "${originalQuery}"
Detected Intent: ${classification.intent} (confidence: ${(classification.confidence * 100).toFixed(1)}%)
Keywords: ${classification.keywords.join(", ")}

Agent Results (${successfulResults.length} successful, ${failedResults.length} failed):

${successfulResults.map(r => `
--- ${r.agentName} (${r.executionTime}ms) ---
${JSON.stringify(r.data, null, 2)}
`).join("\n")}

${failedResults.length > 0 ? `
Failed Agents:
${failedResults.map(r => `- ${r.agentName}: ${r.error}`).join("\n")}
` : ""}
`;

    // Call AI to synthesize response
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a PTD Fitness orchestration synthesizer. Your job is to combine results from multiple AI agents into a single, coherent, actionable response.

CRITICAL RULES:
1. Remove duplicate information from different agents
2. Prioritize most relevant information based on the original query
3. Present data in a clear, structured format
4. If agents contradict, note the discrepancy
5. Include specific numbers, names, and actionable insights
6. Be concise but comprehensive
7. If some agents failed, work with available data and mention what's missing

FORMAT YOUR RESPONSE:
🎯 **Summary** - Key findings in 1-2 sentences
📊 **Data** - Relevant metrics and insights
💡 **Recommendations** - Actionable next steps (if applicable)
⚠️ **Issues** - Any problems or missing data (if applicable)`,
          },
          {
            role: "user",
            content: contextText,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error(`[Orchestrator] AI synthesis failed: ${response.status}`);
      return synthesizeResponseSimple(classification, results);
    }

    const data = await response.json();
    const synthesized = data.choices?.[0]?.message?.content || "";

    if (synthesized) {
      return synthesized;
    }

    return synthesizeResponseSimple(classification, results);

  } catch (error) {
    console.error("[Orchestrator] Synthesis error:", error);
    return synthesizeResponseSimple(classification, results);
  }
}

/**
 * Simple text-based synthesis (fallback)
 */
function synthesizeResponseSimple(
  classification: ClassificationResult,
  results: AgentResult[]
): string {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  let response = `🎯 **Intent Detected**: ${classification.intent} (${(classification.confidence * 100).toFixed(0)}% confidence)\n\n`;

  if (successful.length > 0) {
    response += `📊 **Results from ${successful.length} agent(s):**\n\n`;

    successful.forEach(result => {
      response += `**${result.agentName}** (${result.executionTime}ms):\n`;

      // Try to extract key information
      if (result.data) {
        if (typeof result.data === 'string') {
          response += result.data.slice(0, 500);
        } else if (result.data.response) {
          response += result.data.response.slice(0, 500);
        } else if (result.data.analysis) {
          response += JSON.stringify(result.data.analysis, null, 2).slice(0, 500);
        } else {
          response += JSON.stringify(result.data, null, 2).slice(0, 500);
        }
      }

      response += "\n\n";
    });
  }

  if (failed.length > 0) {
    response += `⚠️ **${failed.length} agent(s) encountered issues:**\n`;
    failed.forEach(result => {
      response += `- ${result.agentName}: ${result.error}\n`;
    });
  }

  return response;
}

// ============= CACHING LAYER =============

interface CacheEntry {
  query: string;
  response: OrchestratorResponse;
  timestamp: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(query: string): string {
  return query.toLowerCase().trim();
}

function getCachedResponse(query: string): OrchestratorResponse | null {
  const key = getCacheKey(query);
  const entry = responseCache.get(key);

  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL) {
    responseCache.delete(key);
    return null;
  }

  console.log(`[Orchestrator] Cache hit for query: "${query}" (age: ${Math.round(age / 1000)}s)`);
  return entry.response;
}

function setCachedResponse(query: string, response: OrchestratorResponse): void {
  const key = getCacheKey(query);
  responseCache.set(key, {
    query,
    response,
    timestamp: Date.now(),
  });

  // Cleanup old entries (keep max 100)
  if (responseCache.size > 100) {
    const entries = Array.from(responseCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    responseCache.delete(entries[0][0]);
  }
}

// ============= MAIN ORCHESTRATOR =============

async function orchestrate(
  supabase: any,
  query: string,
  options: {
    forceRefresh?: boolean;
    maxAgents?: number;
    threadId?: string;
  } = {}
): Promise<OrchestratorResponse> {
  const startTime = Date.now();

  console.log(`[Orchestrator] Processing query: "${query}"`);

  // Check cache
  if (!options.forceRefresh) {
    const cached = getCachedResponse(query);
    if (cached) {
      cached.metadata.cached = true;
      return cached;
    }
  }

  // Step 1: Classify query intent
  const classification = classifyQuery(query);
  console.log(`[Orchestrator] Classification:`, classification);

  // Step 2: Select agents
  let selectedAgents = selectAgents(classification);

  // Apply max agents limit
  if (options.maxAgents && selectedAgents.length > options.maxAgents) {
    selectedAgents = selectedAgents.slice(0, options.maxAgents);
  }

  console.log(`[Orchestrator] Selected ${selectedAgents.length} agent(s):`, selectedAgents.map(a => a.name));

  // Step 3: Execute agents (parallel or sequential)
  const results = await executeAgentsParallel(supabase, selectedAgents, query, {
    threadId: options.threadId,
  });

  // Step 4: Synthesize response
  const synthesizedResponse = await synthesizeResponse(classification, results, query);

  // Step 5: Build final response
  const totalExecutionTime = Date.now() - startTime;

  const response: OrchestratorResponse = {
    intent: classification.intent,
    confidence: classification.confidence,
    agentsInvoked: results.map(r => r.agentName),
    results,
    synthesizedResponse,
    totalExecutionTime,
    metadata: {
      parallel: selectedAgents.length > 1,
      cached: false,
    },
  };

  // Cache the response
  setCachedResponse(query, response);

  // Log orchestration run
  await supabase.from("sync_logs").insert({
    platform: "ptd-orchestrator",
    sync_type: "orchestration",
    status: "success",
    records_synced: selectedAgents.length,
    started_at: new Date(startTime).toISOString(),
  });

  return response;
}

// ============= HTTP HANDLER =============

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      query,
      message,
      forceRefresh = false,
      maxAgents = 3,
      threadId,
      mode = "auto"
    } = body;

    const userQuery = query || message;

    if (!userQuery) {
      return new Response(
        JSON.stringify({
          error: "No query provided",
          hint: "Provide 'query' or 'message' in request body",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`[Orchestrator] Starting orchestration for: "${userQuery}"`);

    const result = await orchestrate(supabase, userQuery, {
      forceRefresh,
      maxAgents,
      threadId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("[Orchestrator] Error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        hint: "Check function logs for details",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
