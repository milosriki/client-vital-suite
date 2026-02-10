import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";
import { AGENT_ROLES } from "../_shared/unified-prompts.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";

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

    // 1. CLASSIFY INTENT (Super Intelligence)
    const classification = await classifyIntentWithLLM(query);
    console.log(
      `🧠 Intent Classified: ${classification.intent} (${classification.confidence * 100}%)`,
    );

    // 2. ROUTE TO SPECIALIST
    let targetFunction = "ptd-agent-gemini"; // Default Generalist
    let systemInstruction = "";

    switch (classification.intent) {
      case "SALES_QUERY":
        targetFunction = "ptd-agent-gemini";
        systemInstruction = `Act as ${AGENT_ROLES.SMART_AGENT.name}. ${AGENT_ROLES.SMART_AGENT.persona}. Focus on conversion.`;
        break;
      case "REVENUE_ANALYSIS":
        targetFunction = "ptd-agent-gemini"; 
        systemInstruction = `Act as ${AGENT_ROLES.STRIPE_PAYOUTS_AI.name}. ${AGENT_ROLES.STRIPE_PAYOUTS_AI.persona}. Use revenue tools.`;
        break;
      case "FRAUD_CHECK":
        targetFunction = "stripe-forensics";
        break;
      case "WHATSAPP_CHAT":
        targetFunction = "ptd-agent-gemini";
        // Prompt will be handled inside ptd-agent-gemini based on context.source === 'whatsapp'
        break;
      default:
        targetFunction = "ptd-agent-gemini";
    }

    // 3. EXECUTE OR DELEGATE
    const { data, error } = await supabase.functions.invoke(targetFunction, {
      body: {
        message: query,
        systemInstruction: systemInstruction || undefined,
        context: { ...context, source_function: "agent-manager", intent: classification.intent },
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

async function classifyIntentWithLLM(
  query: string,
): Promise<{ intent: string; confidence: number }> {
  try {
    const prompt = `
      Classify the user intent for a fitness business CRM.
      Possible Intents:
      - REVENUE_ANALYSIS: Questions about money, payouts, sales numbers, Stripe data.
      - FRAUD_CHECK: Questions about suspicious payments, leaks, or security.
      - SALES_QUERY: Questions about leads, deals, pipelines, or general CRM work.
      - WHATSAPP_CHAT: Customer messages asking about training, price, booking, or chat-like interaction.
      - PARTNERSHIP_QUERY: Questions about business partnerships, collaborations, or joint ventures.
      - GENERAL_QUERY: Anything else.

      Return ONLY a JSON object: {"intent": "THE_INTENT", "confidence": 0.XX}
      Query: "${query}"
    `;

    const response = await unifiedAI.chat([
      { role: "system", content: "You are an intent classifier for a fitness CRM." },
      { role: "user", content: prompt }
    ], { jsonMode: true, temperature: 0 });

    return JSON.parse(response.content);
  } catch (e) {
    console.error("LLM Classification failed, falling back to keywords:", e);
    return classifyIntentFallback(query);
  }
}

function classifyIntentFallback(
  query: string,
): { intent: string; confidence: number } {
  const q = query.toLowerCase();
  if (q.includes("revenue") || q.includes("payout") || q.includes("money")) return { intent: "REVENUE_ANALYSIS", confidence: 0.7 };
  if (q.includes("fraud") || q.includes("suspicious")) return { intent: "FRAUD_CHECK", confidence: 0.7 };
  if (q.includes("lead") || q.includes("deal") || q.includes("pipeline")) return { intent: "SALES_QUERY", confidence: 0.7 };
  if (q.includes("whatsapp") || q.includes("chat")) return { intent: "WHATSAPP_CHAT", confidence: 0.7 };
  if (q.includes("partner") || q.includes("collaborate") || q.includes("joint venture")) return { intent: "PARTNERSHIP_QUERY", confidence: 0.7 };
  return { intent: "GENERAL_QUERY", confidence: 0.5 };
}

