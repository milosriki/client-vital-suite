import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildSmartPrompt } from "../_shared/smart-prompt.ts";
import { parseAIResponse } from "../_shared/response-parser.ts";
import { calculateLeadScore } from "../_shared/lead-scorer.ts";
import { HubSpotManager } from "../_shared/hubspot-manager.ts";
import { SentimentTriage } from "../_shared/sentiment.ts";
import { RepairEngine } from "../_shared/repair-engine.ts";
import { AntiRobot } from "../_shared/anti-robot.ts";
import { DubaiContext, AvatarLogic } from "../_shared/avatar-logic.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import {
  handleError,
  ErrorCode,
  corsHeaders as defaultCorsHeaders,
} from "../_shared/error-handler.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limiter.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import {
  UnauthorizedError,
  RateLimitError,
  ExternalServiceError,
  errorToResponse,
} from "../_shared/app-errors.ts";
import { getConstitutionalSystemMessage } from "../_shared/constitutional-framing.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const hubspotKey = Deno.env.get("HUBSPOT_API_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseKey);
const hubspot = new HubSpotManager(hubspotKey, supabaseUrl, supabaseKey);

// @ts-ignore
Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  try {
    // Webhook endpoint — Dialogflow sends fulfillment requests (verify_jwt=false)
    // Rate limit — per api-patterns/rate-limiting.md
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const rateCheck = checkRateLimit(req, RATE_LIMITS.chat);
    if (!rateCheck.allowed) throw new RateLimitError();

    const body = await req.json();
    let userMessage = body.queryResult?.queryText || "";
    const userPhone =
      body.originalDetectIntentRequest?.payload?.phone || "";
    const intentName = body.queryResult?.intent?.displayName || "Unknown";

    // [SKILL: VOICE-TO-VALUE] - Handle Audio URL in message
    let voiceTone = "";
    if (
      userMessage.startsWith("https://") &&
      (userMessage.includes("/audio/") || userMessage.includes("/voice/"))
    ) {
      console.log(
        `🎤 Audio URL detected in Dialogflow: ${userMessage}. Transcribing...`,
      );
      const audioResult = await unifiedAI.transcribeAudio(userMessage);
      userMessage = audioResult.text;
      voiceTone = audioResult.tone;
      console.log(`📝 Transcribed: "${userMessage}" | Tone: ${voiceTone}`);
    }

    // 2. Parallel Context
    const [leadRes, aiMemoryRes, hubspotContext] = await Promise.all([
      supabase.from("leads").select("*").eq("phone", userPhone).maybeSingle(),
      supabase
        .from("conversation_intelligence")
        .select("*")
        .eq("phone", userPhone)
        .maybeSingle(),
      hubspot.searchContactByPhone(userPhone),
    ]);

    const lead = leadRes.data;
    const aiMemory = aiMemoryRes.data;

    // Dual Mode — bot paused: return empty per api-patterns envelope
    if (hubspotContext?.properties?.bot_paused === "true") {
      structuredLog("info", "dialogflow-fulfillment: bot paused", {
        phone: userPhone,
      });
      return apiSuccess({ fulfillmentText: "" });
    }

    if (!aiMemory) {
      await supabase.from("conversation_intelligence").insert({
        phone: userPhone,
        lead_score: 10,
        conversation_phase: "hook",
      });
    }

    // 3. Sentiment & Persona
    const sentiment = SentimentTriage.analyze(userMessage);
    let systemPrompt = buildSmartPrompt({
      name: hubspotContext?.properties?.firstname || lead?.name || "Friend",
      phone: userPhone,
      goal:
        hubspotContext?.properties?.fitness_goal ||
        lead?.goal ||
        aiMemory?.desired_outcome ||
        null,
      area: hubspotContext?.properties?.city || lead?.area || null,
      housing_type: lead?.housing_type || null,
      history_summary: aiMemory?.conversation_summary || "New conversation.",
      message_count: (aiMemory?.message_count || 0) + 1,
      last_message: userMessage,
      lead_score: aiMemory?.lead_score || 10,
      dominant_pain: aiMemory?.dominant_pain || null,
      psychological_profile: aiMemory?.psychological_profile || null,
      days_since_last_reply: aiMemory?.last_lead_message_at
        ? (Date.now() - new Date(aiMemory.last_lead_message_at).getTime()) /
          86400000
        : 0,
      referral_source: lead?.source || null,
    });

    // Prepend constitutional framing to system prompt
    const constitutionalPrefix = getConstitutionalSystemMessage();
    systemPrompt = `${constitutionalPrefix}\n\n${systemPrompt}`;

    if (sentiment.sentiment === "RISK") {
      systemPrompt =
        `${constitutionalPrefix}\n\nYou are Lisa, a helpful support agent. The user is upset. De-escalate. No selling. Be human.`;
    }

    // 4. AI Call (With ATLAS Handoff Tool)
    const askAtlasTool = {
      name: "ask_atlas",
      description:
        "Use this tool for questions about PAYMENTS, REFUNDS, STRIPE, or BUSINESS STRATEGY. Do not guess.",
      input_schema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The specific question about finance/strategy",
          },
          urgency: {
            type: "string",
            enum: ["low", "high"],
            description: "Urgency of the request",
          },
        },
        required: ["query"],
      },
    };

    const aiResponse = await unifiedAI.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      {
        tools: [askAtlasTool],
        temperature: 0.3, // Lower temp for precise tool usage
      },
    );

    // Check for Tool Execution (Handoff)
    if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
      const call = aiResponse.tool_calls.find((c) => c.name === "ask_atlas");
      if (call) {
        const { query, urgency } = call.input;
        console.log(`🦄 ATLAS HANDOFF TRIGGERED: ${query}`);

        // Create Async Task
        await supabase.from("agent_tasks").insert({
          requestor: "dialogflow-fulfillment",
          task_type: "finance_query",
          payload: {
            query,
            phone: userPhone,
            user_message: userMessage,
            context: hubspotContext,
          },
          priority: urgency === "high" ? "high" : "normal",
          status: "pending",
        });

        const reply =
          "I'm checking that with our finance team right now. I'll send you an update shortly!";

        // Log interaction as usual
        await supabase.from("whatsapp_interactions").insert({
          phone_number: userPhone,
          message_text: userMessage,
          response_text: reply,
          metadata: { handoff: "atlas" },
        });

        return apiSuccess({ fulfillmentText: reply });
      }
    }

    let parsed = parseAIResponse(aiResponse.content);

    // Loop Repair
    const prevSummary = aiMemory?.conversation_summary || "";
    const summaryLines = prevSummary.split("\n").filter(Boolean);
    const lastLisaResponse =
      [...summaryLines]
        .reverse()
        .find((l) => l.startsWith("Lisa:"))
        ?.replace(/^Lisa:\s*/, "") || "";
    if (RepairEngine.detectLoop(lastLisaResponse, parsed.reply)) {
      const chatHistory = summaryLines
        .slice(-6)
        .map((line) => {
          if (line.startsWith("User:"))
            return { role: "user" as const, content: line.replace(/^User:\s*/, "") };
          return { role: "assistant" as const, content: line.replace(/^Lisa:\s*/, "") };
        });
      const repairRes = await unifiedAI.chat([
        {
          role: "system",
          content: RepairEngine.generateRepairPrompt(userMessage, chatHistory),
        },
        { role: "user", content: userMessage },
      ]);
      parsed = parseAIResponse(repairRes.content);
    }

    // Humanize
    parsed.reply = AntiRobot.humanize(parsed.reply, "PROFESSIONAL");

    // 5. Update & Sync
    const finalScore = Math.round(
      (parsed.thought?.recommended_lead_score || 10) * 0.6 + 10 * 0.4,
    );
    const updateData = {
      phone: userPhone,
      lead_score: finalScore,
      message_count: (aiMemory?.message_count || 0) + 1,
      last_lead_message_at: new Date().toISOString(),
      conversation_phase: parsed.thought?.conversation_phase || "hook",
      psychological_profile:
        parsed.thought?.psychological_profile ||
        aiMemory?.psychological_profile,
      dominant_pain: parsed.thought?.current_state || aiMemory?.dominant_pain,
      desired_outcome:
        parsed.thought?.desired_state || aiMemory?.desired_outcome,
      primary_blocker: parsed.thought?.blocker || aiMemory?.primary_blocker,
      last_internal_thought: parsed.thought,
      conversation_summary: (
        (aiMemory?.conversation_summary || "") +
        `\nUser: ${userMessage}\nLisa: ${parsed.reply}`
      )
        .split("\n")
        .slice(-10)
        .join("\n"),
    };

    const logInteractionPromise = supabase
      .from("whatsapp_interactions")
      .insert({
        phone_number: userPhone,
        message_text: userMessage,
        response_text: parsed.reply,
      });
    const hubspotPromise = syncToHubSpot(
      userPhone,
      userMessage,
      parsed.reply,
      hubspotContext,
      intentName,
      updateData.conversation_phase,
      finalScore,
      parsed.thought,
      voiceTone,
    );
    const intelligencePromise = supabase
      .from("conversation_intelligence")
      .upsert(updateData, { onConflict: "phone" });

    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined") {
      // @ts-ignore
      EdgeRuntime.waitUntil(
        Promise.allSettled([
          logInteractionPromise,
          hubspotPromise,
          intelligencePromise,
        ]),
      );
    } else {
      await Promise.all([
        logInteractionPromise,
        hubspotPromise,
        intelligencePromise,
      ]);
    }

    // Success — per api-patterns/response.md
    structuredLog("info", "dialogflow-fulfillment: success", {
      phone: userPhone,
      intent: intentName,
      score: finalScore,
      latency_ms: Date.now() - startTime,
    });
    return apiSuccess({ fulfillmentText: parsed.reply });
  } catch (error: unknown) {
    // Enterprise error handling — per error-handling-patterns skill
    structuredLog("error", "dialogflow-fulfillment: failed", {
      error: error instanceof Error ? error.message : String(error),
      latency_ms: Date.now() - startTime,
    });
    // For Dialogflow: always return 200 with fallback text so the bot doesn't break
    if (error instanceof UnauthorizedError || error instanceof RateLimitError) {
      return errorToResponse(error);
    }
    return apiSuccess({
      fulfillmentText: "Hey, tech hiccup. Can you send that again?",
    });
  }
});

async function syncToHubSpot(
  phone: string,
  incoming: string,
  outgoing: string,
  contact: any,
  intent: string,
  stage: string,
  score: number,
  thought: any,
  voiceTone?: string,
) {
  try {
    let contactId = contact?.id;
    if (!contactId) {
      const existing = await hubspot.searchContactByPhone(phone);
      if (existing) contactId = existing.id;
      else {
        const res = await hubspot.createContact({
          phone,
          email: `${phone.replace("+", "")}@whatsapp.com`,
          firstname: "WhatsApp",
          lastname: "Lead",
        });
        contactId = res?.id;
      }
    }
    if (contactId) {
      // Construct a "High-Status Intelligence Brief" for the Human Coach
      const toneLine = voiceTone ? `🎭 Mood: ${voiceTone}\n` : "";
      const intelligenceBrief = thought
        ? `
--- 🕵️ AI STRATEGIST BRIEF ---
🌡️ Temperature: ${thought.lead_temperature?.toUpperCase() || "UNKNOWN"}
🎯 Stage: ${stage.toUpperCase()}
${toneLine}💔 Pain identified: ${thought.current_state || "Not yet identified"}
✨ Desired outcome: ${thought.desired_state || "Not yet identified"}
🛑 Primary blocker: ${thought.blocker || "Not yet identified"}
🧠 Psych Profile: ${thought.psychological_profile || "Not yet assessed"}
⚖️ Gap Size: ${thought.gap_size?.toUpperCase() || "UNKNOWN"}
---------------------------
`
        : "";

      const noteBody = `📲 **WhatsApp Interaction (Lisa AI Strategist)**\n${intelligenceBrief}\n**User**: ${incoming}\n**Lisa**: ${outgoing}`;

      const updates: Record<string, string> = {
        whatsapp_stage: stage,
        lead_score: score.toString(),
        whatsapp_intent: intent,
        whatsapp_last_message: incoming,
        whatsapp_last_reply: outgoing,
        whatsapp_summary: thought?.hubspot_summary || "",
        lead_maturity: thought?.lead_status || "casual",
      };

      // Map intelligence to existing HubSpot fields if they match
      if (thought?.current_state) updates.fitness_goal = thought.current_state;
      if (thought?.blocker) updates.biggest_challenge_ = thought.blocker;

      await Promise.all([
        hubspot.createNote(contactId, noteBody),
        hubspot.updateContact(contactId, updates),
      ]);
      console.log(
        `✅ Antigravity CRM Sync: Intelligence logged for contact ${contactId}`,
      );
    }
  } catch (e) {
    console.error("HS Sync Fail:", e);
  }
}
