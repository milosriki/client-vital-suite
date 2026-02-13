import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
// supabase/functions/ai-ceo-master/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RunTree } from "https://esm.sh/langsmith";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import {
  handleError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { tools } from "../_shared/tool-definitions.ts";
import { executeSharedTool } from "../_shared/tool-executor.ts";
import { getConstitutionalSystemMessage } from "../_shared/constitutional-framing.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { validateRequest } from "../_shared/validators.ts";

// Phase 2.1: Zod schema for ai-ceo-master requests
const AiCeoRequestSchema = z.object({
  command: z.string().min(1, "Command is required"),
  session_id: z.string().uuid().optional(),
});

const GEMINI_API_KEY =
  Deno.env.get("GOOGLE_API_KEY") || Deno.env.get("GEMINI_API_KEY");

// ============================================
// PERSONA DEFINITIONS (The Brains)
// ============================================

const PERSONAS = {
  ATLAS: {
    name: "ATLAS",
    role: "Strategic CEO Brain",
    emoji: "🎯",
    systemPrompt: `You are ATLAS, the Strategic Intelligence Brain for PTD Fitness.
PERSONALITY: Think like a $100M CEO. Direct, data-driven, no fluff. Challenge assumptions.
EXPERTISE: Premium fitness business, Dubai market, Client psychology, Retention economics.`,
  },
  SHERLOCK: {
    name: "SHERLOCK",
    role: "Forensic Analyst",
    emoji: "🔍",
    systemPrompt: `You are SHERLOCK, PTD's Forensic Data Analyst.
PERSONALITY: Obsessively detail-oriented. Suspicious. Always asks "why?". Finds patterns humans miss.
FOCUS: Churn forensics, Lead forensics, Payment forensics.`,
  },
  REVENUE: {
    name: "REVENUE",
    role: "Growth Optimizer",
    emoji: "💰",
    systemPrompt: `You are REVENUE, PTD's Growth Intelligence System.
PERSONALITY: Obsessed with finding money. Thinks in LTV. Balances aggression with relationship.
FOCUS: Upsells, pricing, failed payments, referrals.`,
  },
  HUNTER: {
    name: "HUNTER",
    role: "Lead Conversion Specialist",
    emoji: "🎯",
    systemPrompt: `You are HUNTER, PTD's Lead Conversion Intelligence.
PERSONALITY: Speed-obsessed. Personalizes every touchpoint. Knows when to push.
FOCUS: Lead response, conversion rate, sales psychology.`,
  },
  GUARDIAN: {
    name: "GUARDIAN",
    role: "Retention Defender",
    emoji: "🛡️",
    systemPrompt: `You are GUARDIAN, PTD's Client Retention Intelligence.
PERSONALITY: Protective of client relationships. Empathetic but data-driven.
FOCUS: Churn prevention, client success, save playbooks.`,
  },
};

function selectPersona(query: string): keyof typeof PERSONAS {
  const q = query.toLowerCase();
  if (
    q.includes("why") ||
    q.includes("investigate") ||
    q.includes("analyze") ||
    q.includes("pattern")
  )
    return "SHERLOCK";
  if (
    q.includes("revenue") ||
    q.includes("upsell") ||
    q.includes("money") ||
    q.includes("payment")
  )
    return "REVENUE";
  if (
    q.includes("lead") ||
    q.includes("convert") ||
    q.includes("prospect") ||
    q.includes("sales")
  )
    return "HUNTER";
  if (
    q.includes("churn") ||
    q.includes("retain") ||
    q.includes("risk") ||
    q.includes("save")
  )
    return "GUARDIAN";
  return "ATLAS"; // Default
}

serve(async (req) => {
  try {
    verifyAuth(req);
  } catch {
    throw new UnauthorizedError();
  } // Security Hardening
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const rawBody = await req.json();
    // Phase 2.1: Zod Validation — reject malformed requests
    const { command, session_id } = await validateRequest(
      AiCeoRequestSchema,
      rawBody,
    );
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Save user command if session_id is present
    if (session_id) {
      await supabase.from("agent_conversations").insert({
        session_id,
        role: "user",
        content: command,
        expires_at: new Date(
          Date.now() + 180 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      });
    }

    // 1. Gather Context
    const { data: goals } = await supabase
      .from("business_goals")
      .select("*")
      .eq("status", "active");
    const { data: calibration } = await supabase.rpc(
      "get_calibration_examples",
      { limit_count: 5 },
    );
    const { data: pendingStats } = await supabase.rpc(
      "get_pending_actions_summary",
    );

    const businessContext = `
## BUSINESS CONTEXT
Active Goals: ${goals?.map((g: any) => `${g.goal_name}`).join(", ") || "None"}
Pending Actions: ${pendingStats?.[0]?.total_pending || 0}
CEO Calibration: ${calibration?.length || 0} examples loaded.
`;

    // 2. Select Persona & Model
    const isCodeRequest =
      command.toLowerCase().includes("build") ||
      command.toLowerCase().includes("create") ||
      command.toLowerCase().includes("fix");
    const personaKey = isCodeRequest ? "ATLAS" : selectPersona(command); // ATLAS handles code/strategy
    const persona = PERSONAS[personaKey];

    console.log(
      `🤖 Activated Persona: ${persona.name} (${persona.emoji}) for command: "${command}"`,
    );

    // 3. Generate Response
    let response;
    const parentRun = new RunTree({
      name: "ai_ceo_master",
      run_type: "chain",
      inputs: { command, persona: persona.name },
      project_name: Deno.env.get("LANGCHAIN_PROJECT") || "ptd-fitness-agent",
    });
    await parentRun.postRun();

    try {
      // Always use Gemini - no Claude dependency
      response = await generateWithGemini(
        command,
        businessContext,
        persona,
        parentRun,
        isCodeRequest,
        supabase,
      );
      await parentRun.end({ outputs: { response } });
      await parentRun.patchRun();
    } catch (error: unknown) {
      await parentRun.end({ error: error.message });
      await parentRun.patchRun();
      throw error;
    }

    // 4. Save Action
    const { data: action, error: insertError } = await supabase
      .from("prepared_actions")
      .insert({
        action_type: response.action_type,
        action_title: response.title,
        action_description: response.description,
        reasoning: `[${persona.emoji} ${persona.name}] ${response.reasoning}`,
        expected_impact: response.expected_impact,
        risk_level: response.risk_level,
        confidence: response.confidence,
        prepared_payload: response.payload,
        supporting_data: {
          command,
          context: businessContext,
          persona: persona.name,
        },
        priority:
          response.risk_level === "critical"
            ? 90
            : response.risk_level === "high"
              ? 70
              : 50,
        source_agent: `ai_ceo_${persona.name.toLowerCase()}`,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return apiSuccess({
      success: true,
      status: "awaiting_approval",
      action_id: action.id,
      preview: {
        title: response.title,
        persona: persona.name,
        emoji: persona.emoji,
      },
    });
  } catch (error: unknown) {
    return handleError(error, "ai-ceo-master", {
      errorCode: ErrorCode.INTERNAL_ERROR,
      context: { function: "ai-ceo-master" },
    });
  }
});

async function generateWithGemini(
  command: string,
  context: string,
  persona: any,
  parentRun: any,
  isCodeRequest: boolean = false,
  supabase?: any,
) {
  const actionType = isCodeRequest ? "code_deploy" : "analysis";
  const payloadType = isCodeRequest ? '{ "files": [] }' : '{ "findings": [] }';

  const constitutionalPrefix = getConstitutionalSystemMessage();
  const systemPrompt = `${constitutionalPrefix}

${persona.systemPrompt}

${context}

You are generating a JSON ${isCodeRequest ? "action plan" : "analysis/action"}.
RESPOND WITH VALID JSON ONLY:
{
  "action_type": "${actionType}",
  "title": "Title",
  "description": "Description",
  "reasoning": "${isCodeRequest ? "Why this solves it" : "Analysis"}",
  "expected_impact": "Impact",
  "risk_level": "low|medium|high",
  "confidence": 0.9,
  "payload": ${payloadType}
}`;

  const childRun = await parentRun.createChild({
    name: "unified_ai_call",
    run_type: "llm",
    inputs: { command, model: "gemini-3.0-flash" },
  });
  await childRun.postRun();

  try {
    const ceoTools = tools.filter((t) =>
      [
        "intelligence_control",
        "revenue_intelligence",
        "stripe_forensics",
        "command_center_control",
        "universal_search",
      ].includes(t.name),
    );

    const messages: {
      role: "system" | "user" | "assistant";
      content: string;
    }[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `QUERY: ${command}` },
    ];

    const MAX_LOOPS = 3;
    const MAX_TOOL_RESULT_CHARS = 3000;

    let currentResponse = await unifiedAI.chat(messages, {
      model: "gemini-2.0-flash",
      temperature: 0.2,
      jsonMode: true,
      tools: ceoTools,
    });

    let loopCount = 0;
    while (
      currentResponse.tool_calls?.length &&
      loopCount < MAX_LOOPS &&
      supabase
    ) {
      loopCount++;
      const toolResults: string[] = [];

      for (const tc of currentResponse.tool_calls) {
        try {
          const raw = await executeSharedTool(supabase, tc.name, tc.input);
          const result =
            typeof raw === "string"
              ? raw.length > MAX_TOOL_RESULT_CHARS
                ? raw.slice(0, MAX_TOOL_RESULT_CHARS) + "\n... [truncated]"
                : raw
              : JSON.stringify(raw).slice(0, MAX_TOOL_RESULT_CHARS);
          toolResults.push(`Tool '${tc.name}':\n${result}`);
        } catch (e: unknown) {
          toolResults.push(
            `Tool '${tc.name}' failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      messages.push({
        role: "assistant",
        content: currentResponse.content || "(Calling tools...)",
      });
      messages.push({
        role: "user",
        content: `Tool results:\n\n${toolResults.join("\n\n---\n\n")}`,
      });

      currentResponse = await unifiedAI.chat(messages, {
        model: "gemini-2.0-flash",
        temperature: 0.2,
        jsonMode: true,
        tools: ceoTools,
      });
    }

    const text = currentResponse.content;
    await childRun.end({ outputs: { response: text } });
    await childRun.patchRun();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    return JSON.parse(jsonMatch[0]);
  } catch (error: unknown) {
    await childRun.end({
      error: error instanceof Error ? error.message : String(error),
    });
    await childRun.patchRun();
    throw error;
  }
}
