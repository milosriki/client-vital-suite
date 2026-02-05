import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { buildUnifiedPromptForEdgeFunction } from "../_shared/unified-prompts.ts";
import { PTD_STATIC_KNOWLEDGE } from "../_shared/static-knowledge.ts";
import { executeSharedTool } from "../_shared/tool-executor.ts";
import {
  unifiedAI,
  ChatMessage,
  ToolDefinition,
} from "../_shared/unified-ai-client.ts";
import { brain } from "../_shared/unified-brain.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";

import {
  handleError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============= PTD KNOWLEDGE BASE =============
const PTD_SYSTEM_KNOWLEDGE = PTD_STATIC_KNOWLEDGE;

// Define tools for the agent (Unified format)
const tools: ToolDefinition[] = [
  {
    name: "client_control",
    description:
      "Get full client data - health scores, calls, deals, activities. Use for any client-related queries.",
    input_schema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Client email address" },
        action: {
          type: "string",
          enum: [
            "get_all",
            "get_health",
            "get_calls",
            "get_deals",
            "get_activities",
          ],
          description: "Action to perform",
        },
      },
      required: ["email", "action"],
    },
  },
  {
    name: "lead_control",
    description:
      "Manage leads - get all leads, search leads, get enhanced lead data with scores",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get_all", "search", "get_enhanced", "get_by_status"],
          description: "Action to perform",
        },
        query: {
          type: "string",
          description: "Search query for lead name/email/phone",
        },
        status: { type: "string", description: "Lead status filter" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: ["action"],
    },
  },
  {
    name: "sales_flow_control",
    description:
      "Track sales pipeline - get deals, appointments, pipeline stages, recent closes",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "get_pipeline",
            "get_deals",
            "get_appointments",
            "get_recent_closes",
          ],
          description: "Action to perform",
        },
        stage: {
          type: "string",
          description: "Optional: filter by pipeline stage",
        },
        days: { type: "number", description: "Days back to look (default 30)" },
      },
      required: ["action"],
    },
  },
  {
    name: "stripe_control",
    description:
      "Stripe intelligence - fraud scan, payment history, transaction analysis, deleted wallets/bank accounts history",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "fraud_scan",
            "get_summary",
            "get_events",
            "analyze",
            "get_deleted_wallets",
          ],
          description:
            "Action to perform. Use get_deleted_wallets for history of deleted bank accounts, cards, and wallets.",
        },
        days: {
          type: "number",
          description: "Days back to analyze (default 90)",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "hubspot_control",
    description:
      "HubSpot operations - sync data, get contacts, track activities, lifecycle stages",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "sync_now",
            "get_contacts",
            "get_activities",
            "get_lifecycle_stages",
          ],
          description: "Action to perform",
        },
        limit: { type: "number", description: "Max results" },
      },
      required: ["action"],
    },
  },
  {
    name: "call_control",
    description:
      "Call records - get transcripts, analytics, find conversation patterns",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "get_all",
            "get_transcripts",
            "get_analytics",
            "find_patterns",
          ],
          description: "Action to perform",
        },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: ["action"],
    },
  },
  {
    name: "analytics_control",
    description:
      "Get dashboards - health zones, revenue, coaches, interventions, campaigns",
    input_schema: {
      type: "object",
      properties: {
        dashboard: {
          type: "string",
          enum: ["health", "revenue", "coaches", "interventions", "campaigns"],
          description: "Dashboard to retrieve",
        },
      },
      required: ["dashboard"],
    },
  },
  {
    name: "get_at_risk_clients",
    description: "Get clients at risk of churning (red or yellow health zones)",
    input_schema: {
      type: "object",
      properties: {
        zone: {
          type: "string",
          enum: ["red", "yellow", "all"],
          description: "Filter by zone",
        },
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "intelligence_control",
    description:
      "Run AI intelligence functions - churn predictor, anomaly detector, etc.",
    input_schema: {
      type: "object",
      properties: {
        functions: {
          type: "array",
          items: { type: "string" },
          description:
            "Functions to run: churn-predictor, anomaly-detector, intervention-recommender, coach-analyzer, business-intelligence",
        },
      },
    },
  },
];

// Main agent function with agentic loop + learning + RAG
async function runAgent(
  supabase: any,
  userMessage: string,
  threadId: string = "default",
): Promise<string> {
  // Token budgets
  const MAX_SYSTEM_TOKENS = 120000;

  // ============= PERSISTENT MEMORY + RAG MIDDLEWARE: Before =============
  // Use the unified brain to build context
  const context = await brain.buildContext(userMessage, {
    includeMemories: true,
    includeFacts: true,
    includePatterns: true,
    memoryLimit: 5,
  });

  console.log(`🧠 Context built via Unified Brain`);

  const messages: ChatMessage[] = [{ role: "user", content: userMessage }];

  // Build COMPACT unified prompt
  const basePrompt = buildUnifiedPromptForEdgeFunction({
    includeLifecycle: false,
    includeUltimateTruth: false,
    includeWorkflows: false,
    includeROI: true,
    knowledge: context, // Inject brain context here
    memory: "", // Handled by context above
  });

  // Build compact system prompt
  const systemPrompt = `${basePrompt}

=== PTD QUICK REFERENCE ===
TABLES: client_health_scores, contacts, deals, call_records, coach_performance, intervention_log, campaign_performance
HEALTH ZONES: Purple(85-100)=Champion, Green(70-84)=Healthy, Yellow(50-69)=AtRisk, Red(0-49)=Critical
STAGES: lead→mql→sql→opportunity→customer

=== CAPABILITIES ===
✅ Client/Lead/Sales/Stripe/HubSpot/Calls/Dashboards/AI functions

=== RULES ===
1. Use tools to get LIVE data - never guess
2. Be concise but accurate
3. For fraud: stripe_control(fraud_scan)
4. For at-risk: client_control or dashboard_control`;

  // Add system message
  messages.unshift({ role: "system", content: systemPrompt });

  let iterations = 0;
  const maxIterations = 8;
  let finalResponse = "";

  while (iterations < maxIterations) {
    iterations++;
    console.log(`Agent iteration ${iterations}`);

    // Call Unified AI Client
    const response = await unifiedAI.chat(messages, {
      max_tokens: 4096,
      tools: tools,
    });

    console.log(
      `Provider used: ${response.provider}, Model: ${response.model}`,
    );

    // Check if done (no tool calls)
    if (!response.tool_calls || response.tool_calls.length === 0) {
      finalResponse = response.content;
      break;
    }

    // Add assistant response to messages (with tool calls)
    messages.push({ role: "assistant", content: response.content });

    // Execute tools in parallel
    const toolResults = await Promise.all(
      response.tool_calls.map(async (toolCall) => {
        try {
          const result = await executeSharedTool(
            supabase,
            toolCall.name,
            toolCall.input,
          );
          return {
            role: "user" as const, // OpenAI/Claude handle tool results differently, but user role with context works for both in this simple loop
            content: `Tool '${toolCall.name}' result: ${result}`,
            name: toolCall.name,
          };
        } catch (toolError) {
          console.error(`Tool execution failed: ${toolCall.name}`, toolError);
          const errMsg =
            toolError instanceof Error ? toolError.message : String(toolError);
          return {
            role: "user" as const,
            content: `Tool '${toolCall.name}' failed: ${errMsg}`,
            name: toolCall.name,
          };
        }
      }),
    );

    // Add tool results to messages
    messages.push(...toolResults);
  }

  if (!finalResponse) {
    finalResponse = "Max iterations reached. Please try a more specific query.";
  }

  // ============= PERSISTENT MEMORY: Save After Response =============
  // Use unified brain to learn
  await brain.learn({
    query: userMessage,
    response: finalResponse,
    source: "ptd-agent",
    thread_id: threadId,
  });

  return finalResponse;
}

// HTTP Handler
serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json().catch(() => null);

    if (!payload || typeof payload !== "object") {
      return jsonResponse({ error: "Invalid request payload" }, 400);
    }

    const {
      message,
      messages: chatHistory,
      thread_id,
    } = payload as Record<string, any>;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Missing Supabase configuration" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const derivedMessage =
      typeof message === "string" && message.trim().length > 0
        ? message
        : Array.isArray(chatHistory)
          ? chatHistory[chatHistory.length - 1]?.content
          : undefined;
    const userMessage =
      typeof derivedMessage === "string" ? derivedMessage : null;
    const threadId =
      typeof thread_id === "string" && thread_id.length > 0
        ? thread_id
        : `default_${Date.now()}`;

    if (!userMessage) {
      return jsonResponse({ error: "A 'message' string is required" }, 400);
    }

    console.log(`🧠 Running agent with thread: ${threadId}`);
    const response = await runAgent(supabase, userMessage, threadId);

    return jsonResponse({ response });
  } catch (error: unknown) {
    return handleError(error, "ptd-agent-claude", {
      supabase: createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      ),
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  }
});
