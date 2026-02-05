import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";
import { AGENT_ROLES } from "../_shared/unified-prompts.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

Deno.serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, context = {} } = await req.json();

    if (!query) {
      throw new Error("Missing 'query' in request body");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. CLASSIFY INTENT (The Brain)
    const classification = await classifyIntent(query);
    console.log(
      `🧠 Intent Classified: ${classification.intent} (${classification.confidence * 100}%)`,
    );

    // 2. ROUTE TO SPECIALIST
    let targetFunction = "ptd-agent-gemini"; // Default Generalist
    let systemInstruction = "";

    switch (classification.intent) {
      case "SALES_QUERY":
        targetFunction = "ptd-agent-gemini";
        systemInstruction = `Act as ${AGENT_ROLES.SMART_AGENT.name}. ${AGENT_ROLES.SMART_AGENT.persona}.`;
        break;
      case "REVENUE_ANALYSIS":
        targetFunction = "ptd-agent-gemini"; // Or specialized function if exists
        systemInstruction = `Act as ${AGENT_ROLES.STRIPE_PAYOUTS_AI.name}. ${AGENT_ROLES.STRIPE_PAYOUTS_AI.persona}.`;
        break;
      case "FRAUD_CHECK":
        targetFunction = "stripe-forensics";
        break;
      case "HUBSPOT_CONTROL":
        targetFunction = "hubspot-command-center"; // If exists, otherwise Gemini with tools
        break;
      case "WHATSAPP_CHAT":
        targetFunction = "ptd-agent-gemini";
        systemInstruction = `Act as Mark. Persona: Friendly, Dubai-based, Personal Trainer. Tone: Casual but professional.`;
        break;
      default:
        targetFunction = "ptd-agent-gemini";
    }

    // 3. EXECUTE OR DELEGATE
    // For now, we wrap everything back to Gemini but with specific instructions
    // In future, this calls independent services

    // If it's pure chat/agent work:
    const { data, error } = await supabase.functions.invoke(targetFunction, {
      body: {
        message: query,
        systemInstruction: systemInstruction || undefined,
        context: { ...context, source_function: "agent-manager" },
      },
    });

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleError(error, "agent-manager", {
      supabase: createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ),
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  }
});

async function classifyIntent(
  query: string,
): Promise<{ intent: string; confidence: number }> {
  // Simple Keyword Classifier for MVP (Replace with LLM later)
  const q = query.toLowerCase();

  if (
    q.includes("revenue") ||
    q.includes("stripe") ||
    q.includes("payout") ||
    q.includes("money")
  ) {
    return { intent: "REVENUE_ANALYSIS", confidence: 0.9 };
  }
  if (q.includes("fraud") || q.includes("suspicious") || q.includes("leak")) {
    return { intent: "FRAUD_CHECK", confidence: 0.95 };
  }
  if (
    q.includes("lead") ||
    q.includes("deal") ||
    q.includes("contact") ||
    q.includes("pipeline")
  ) {
    return { intent: "SALES_QUERY", confidence: 0.85 };
  }
  if (q.includes("whatsapp") || q.includes("chat") || q.includes("reply")) {
    return { intent: "WHATSAPP_CHAT", confidence: 0.8 };
  }

  return { intent: "GENERAL_QUERY", confidence: 0.5 };
}
