import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { HubSpotManager, HubSpotContact } from "../_shared/hubspot-manager.ts";
import { buildSmartPrompt, InternalThought } from "../_shared/smart-prompt.ts";
import { parseAIResponse } from "../_shared/response-parser.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { executeSharedTool } from "../_shared/tool-executor.ts";
import { tools, LISA_SAFE_TOOLS } from "../_shared/tool-definitions.ts";
import { contentFilter } from "../_shared/content-filter.ts";
import { AntiRobot } from "../_shared/anti-robot.ts";
import { calculateSmartPause } from "../_shared/smart-pause.ts";
import { splitMessage } from "../_shared/message-splitter.ts";
import { RepairEngine } from "../_shared/repair-engine.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import { calculateLeadScore } from "../_shared/lead-scorer.ts";
import { SentimentTriage } from "../_shared/sentiment.ts";
import { getSocialProof, formatSocialProof } from "../_shared/social-proof.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const AISENSY_API_KEY = Deno.env.get("AISENSY_API_KEY")!;
const AISENSY_WEBHOOK_SECRET = Deno.env.get("AISENSY_WEBHOOK_SECRET")!;
const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const hubspot = new HubSpotManager(
  HUBSPOT_API_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

Deno.serve(async (req) => {
  try {
    verifyAuth(req);
  } catch {
    throw new UnauthorizedError();
  } // Security Hardening
  const startTime = Date.now();
  console.log("🚀 [AISensy-Orchestrator] Received request");

  try {
    // 1. Verify Signature (Security First)
    const signature = req.headers.get("x-aisensy-signature");
    const bodyText = await req.text();

    if (!(await verifySignature(bodyText, signature, AISENSY_WEBHOOK_SECRET))) {
      console.error("❌ Invalid signature");
      return errorToResponse(new UnauthorizedError());
    }

    const payload = JSON.parse(bodyText);
    let incomingText = payload.message?.payload?.text;
    const mediaUrl =
      payload.message?.payload?.url || payload.message?.payload?.mediaUrl;
    const messageType = payload.message?.type; // 'text', 'audio', 'voice', 'image'
    const phone = payload.destinationNumber;

    // [SKILL: VOICE-TO-VALUE] - Handle Audio Transcription
    let voiceTone = "";
    if ((messageType === "audio" || messageType === "voice") && mediaUrl) {
      console.log(`🎤 Audio detected: ${mediaUrl}. Transcribing...`);
      const audioResult = await unifiedAI.transcribeAudio(mediaUrl);
      incomingText = audioResult.text;
      voiceTone = audioResult.tone;
      console.log(`📝 Transcribed: "${incomingText}" | Tone: ${voiceTone}`);
    }

    if (!incomingText && messageType !== "image") {
      return apiSuccess({
        status: "skipped",
        message: "No text or audio found",
      });
    }

    // 2. Parallel Context Retrieval (Speed Pillar)
    // [BRAIN TRANSPLANT] Now fetching Long Term Memory (conversation_intelligence)
    const [hubspotContext, chatHistory, aiMemoryRes] = await Promise.all([
      hubspot.searchContactByPhone(phone),
      getChatHistory(phone),
      supabase
        .from("conversation_intelligence")
        .select("*")
        .eq("phone", phone)
        .maybeSingle(),
      // 2.1 Social Proof REMOVED per User Instruction ("No Social Proof on New Leads")
      // getSocialProof(supabase, ...) -> Skipped.
    ]);

    const aiMemory = aiMemoryRes.data;
    // const relevantProof = ...; -> Skipped.
    // Correction: promise array index access for proof. The signature of getSocialProof returns SocialProof[].
    // Let's adjust the Promise.all structure more cleanly.

    // [BRAIN TRANSPLANT] Initialize Memory if new
    if (!aiMemory) {
      await supabase.from("conversation_intelligence").insert({
        phone: phone,
        lead_score: 10,
        conversation_phase: "hook",
      });
    }

    console.log(`🧠 Context retrieved in ${Date.now() - startTime}ms`);

    // [SKILL: DUAL MODE] - Check if Bot is Paused
    if (
      hubspotContext?.properties?.bot_paused === "true" ||
      hubspotContext?.properties?.bot_paused === true
    ) {
      console.log("⏸️ BOT PAUSED for this contact. Skipping AI response.");
      return apiSuccess({ status: "skipped_bot_paused" });
    }

    // 3. AI Intelligence (Lisa 9.2 Brain)
    // [BRAIN TRANSPLANT] Calculate Memory Horizon
    const daysSinceLastReply = aiMemory?.last_lead_message_at
      ? (Date.now() - new Date(aiMemory.last_lead_message_at).getTime()) /
        86400000
      : 0;

    // [BRAIN TRANSPLANT] Sentiment Analysis
    const sentiment = SentimentTriage.analyze(incomingText);

    let systemPrompt = buildSmartPrompt({
      name: hubspotContext?.properties?.firstname || "Friend",
      phone: phone,
      goal:
        hubspotContext?.properties?.fitness_goal ||
        aiMemory?.desired_outcome ||
        null,
      area: hubspotContext?.properties?.city || null,
      housing_type: hubspotContext?.properties?.housing_type || null,
      history_summary:
        aiMemory?.conversation_summary ||
        chatHistory
          .map((h: any) => `User: ${h.message_text}\nLisa: ${h.response_text}`)
          .join("\n"),
      message_count: (aiMemory?.message_count || chatHistory.length) + 1,
      last_message: incomingText,
      lead_score:
        aiMemory?.lead_score ||
        parseInt(hubspotContext?.properties?.lead_score || "10"),
      dominant_pain:
        aiMemory?.dominant_pain ||
        hubspotContext?.properties?.biggest_challenge_ ||
        null,
      psychological_profile:
        aiMemory?.psychological_profile ||
        hubspotContext?.properties?.lead_maturity ||
        "casual",
      days_since_last_reply: daysSinceLastReply,
      referral_source: null,
      voice_mood: voiceTone,
      // social_proof: ... REMOVED
    });

    if (sentiment.sentiment === "RISK") {
      console.log(
        "⚠️ Sentiment RISK detected. Switching to De-escalation Prompt.",
      );
      systemPrompt =
        "You are Lisa, a helpful support agent. The user is upset. De-escalate. No selling. Be human.";
    }

    // Safe Tools for WhatsApp
    const agentTools = tools.filter((t) => LISA_SAFE_TOOLS.has(t.name));

    let aiResponse = await unifiedAI.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: incomingText },
      ],
      {
        temperature: 0.7,
        tools: agentTools,
      },
    );

    // [SKILL: RE-ACT LITE] — Handle Tool Calls (1-Turn Loop for Speed)
    if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
      console.log(`🛠️ Tool Call Detected: ${aiResponse.tool_calls[0].name}`);
      const toolResults = [];

      for (const call of aiResponse.tool_calls) {
        try {
          const result = await executeSharedTool(
            supabase,
            call.name,
            call.input,
          );
          toolResults.push(`Tool '${call.name}' Output: ${result}`);
        } catch (e) {
          toolResults.push(`Tool '${call.name}' Failed: ${e.message}`);
        }
      }

      // Re-prompt with tool results
      console.log("🔄 Re-prompting with tool results...");
      const toolMsg = `\n\n[TOOL RESULTS]\n${toolResults.join("\n\n")}\n\n(Based on these results, give the final helpful answer to the user)`;

      aiResponse = await unifiedAI.chat(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: incomingText },
          { role: "assistant", content: aiResponse.content || "Thinking..." }, // Preserve thought context if needed, though gemini handles history differently usually.
          // Ideally passing the function call history properly, but simpler to just append results for now as user info.
          { role: "user", content: toolMsg },
        ],
        { temperature: 0.7, tools: agentTools },
      );
    }

    let finalRawResponse = aiResponse.content;
    const parsed = parseAIResponse(finalRawResponse);
    finalRawResponse = parsed.reply;

    // [SKILL: SUPER INTELLIGENCE - LOOP REPAIR]
    // Check if we are about to say the same thing as before
    const lastAiResponse = chatHistory[0]?.response_text || "";

    if (RepairEngine.detectLoop(lastAiResponse, finalRawResponse)) {
      console.log(
        "🔄 LOOP DETECTED. Engaging Repair Engine (Deep Reasoning)...",
      );

      const repairPrompt = RepairEngine.generateRepairPrompt(
        incomingText,
        chatHistory,
      );

      const repairResponse = await unifiedAI.chat(
        [
          { role: "system", content: repairPrompt },
          { role: "user", content: incomingText },
        ],
        { temperature: 0.8 },
      ); // Higher temp for creative solution

      finalRawResponse = repairResponse.content;
      console.log("✅ Repair Complete. New Response:", finalRawResponse);
    }

    const sanitized = contentFilter.sanitize(finalRawResponse);

    // [SAFETY] Leak Pattern Guard — blocks system prompt / template leakage
    const LEAK_PATTERNS = [
      "TEMPLATE 1:",
      "Templates for reaching out",
      "THOUGHT_START",
      "THOUGHT_END",
      "REPLY_START",
      "REPLY_END",
      "SYSTEM PROMPT",
      "INTERNAL MONOLOGUE",
      "=== IDENTITY ===",
      "=== THE EXPERT RULES",
      "=== CONVERSATION FLOW",
      "=== CURRENT CONTEXT ===",
      "buildSmartPrompt",
      "fitness_intent",
      "is_warmed_up",
      "recommended_lead_score",
    ];

    if (LEAK_PATTERNS.some((p) => sanitized.includes(p))) {
      console.error("🚨 BLOCKED LEAKED RESPONSE:", sanitized.slice(0, 200));
      const fallback =
        "That sounds like a great goal! I'd love to help you build a plan for that. Quick question - have you tried personal training before, or would this be your first time?";
      return apiSuccess({
        action: "reply",
        text: fallback,
      });
    }

    let finalResponse = contentFilter.toWhatsAppFormat(sanitized);

    // [SKILL: ANTI-ROBOT SYNTAX + MESSAGE SPLITTER]
    // Split into 1-4 WhatsApp bubbles, humanize each independently
    const userName = hubspotContext?.properties?.firstname || undefined;
    const bubbles = splitMessage(finalResponse);
    const humanizedBubbles = bubbles.map((b) => ({
      ...b,
      text: AntiRobot.humanize(b.text, {
        mood: "CASUAL",
        userName,
      }),
    }));

    // Keep full text for logging (pre-humanized is fine for summaries)
    finalResponse = humanizedBubbles.map((b) => b.text).join("\n");

    // [SKILL: SMART PAUSE] — initial typing delay before first bubble
    const delay = calculateSmartPause(incomingText, humanizedBubbles[0].text);
    console.log(`⏳ Smart Pause: Waiting ${delay}ms to simulate typing...`);
    await new Promise((resolve) => setTimeout(resolve, delay));

    // 4. Immediate Delivery — Multi-Bubble Send Loop
    console.log(`💬 Sending ${humanizedBubbles.length} bubble(s) to ${phone}`);
    const deliveryPromise = (async () => {
      for (let i = 0; i < humanizedBubbles.length; i++) {
        const bubble = humanizedBubbles[i];
        // Inter-bubble delay (first bubble delay is 0 from splitter)
        if (bubble.delayMs > 0) {
          console.log(`⏳ Inter-bubble pause: ${bubble.delayMs}ms`);
          await new Promise((r) => setTimeout(r, bubble.delayMs));
        }
        await sendToAISensy(phone, bubble.text);
        console.log(`✅ Bubble ${i + 1}/${humanizedBubbles.length} sent`);
      }
    })();

    // 5. Background Sync (Reliability Pillar)
    // [BRAIN TRANSPLANT] Parse Thought for Intelligence
    // The 'parsed' object now contains the 'thought' (Internal Monologue)

    // 5. Update & Sync (The "Memory Write" Step)
    const finalScore = Math.round(
      (parsed.thought?.recommended_lead_score || aiMemory?.lead_score || 10) *
        0.6 +
        10 * 0.4,
    );

    const updateData = {
      phone: phone,
      lead_score: finalScore,
      message_count: (aiMemory?.message_count || 0) + 1,
      last_lead_message_at: new Date().toISOString(),
      conversation_phase:
        parsed.thought?.conversation_phase ||
        aiMemory?.conversation_phase ||
        "hook",
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
        `\nUser: ${incomingText}\nLisa: ${finalResponse}`
      )
        .split("\n")
        .slice(-10) // Keep last 10 turns in summary, but DB holds the structured facts forever
        .join("\n"),
    };

    // Parallel Write-Back
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          await Promise.allSettled([
            deliveryPromise,
            // 1. Sync to HubSpot (Visuals for Humans)
            syncToHubSpot(
              phone,
              incomingText,
              finalResponse,
              hubspotContext,
              updateData.conversation_phase, // Use Phase as "Stage-like" info
              voiceTone,
              finalScore,
              parsed.thought,
            ),
            // 2. Sync to Supabase Intelligence (Brain for AI)
            supabase
              .from("conversation_intelligence")
              .upsert(updateData, { onConflict: "phone" }),
            // 3. Log Raw Interaction
            logInteraction(phone, incomingText, finalResponse),
            // 4. BOOKING NOTIFICATION — Alert team when lead reaches close/post_close
            notifyTeamOnBooking(
              phone,
              updateData.conversation_phase,
              aiMemory?.conversation_phase,
              hubspotContext,
              finalResponse,
              parsed.thought,
            ),
          ]);
          console.log(
            `✅ [AISensy-Orchestrator] Full cycle + Memory Save complete in ${Date.now() - startTime}ms`,
          );
        } catch (e) {
          console.error("❌ Background sync failed", e);
        }
      })(),
    );

    return apiSuccess({ status: "processing" });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    console.error("💥 Orchestrator Error:", error);
    return errorToResponse(
      error instanceof Error ? error : new Error(errorMessage),
    );
  }
});

// --- HELPER FUNCTIONS ---

async function verifySignature(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  if (!secret) {
    console.error(
      "🚨 AISENSY_WEBHOOK_SECRET not set. Rejecting unsigned request.",
    );
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const data = encoder.encode(body);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    // AISensy signature is usually a hex string
    const hexToBuffer = (hex: string): Uint8Array => {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
      }
      return bytes;
    };

    const signatureBuffer = hexToBuffer(signature);
    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBuffer.buffer as any,
      data,
    );
  } catch (error: unknown) {
    console.error("❌ Signature verification error:", error);
    return false;
  }
}

async function getChatHistory(phone: string) {
  const { data } = await supabase
    .from("whatsapp_interactions")
    .select("message_text, response_text")
    .eq("phone_number", phone)
    .order("created_at", { ascending: false })
    .limit(10);
  return data || [];
}

async function sendToAISensy(phone: string, text: string, retries = 2) {
  const url = `https://backend.aisensy.com/devapi/v1/project/default/messages`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AISENSY_API_KEY}`,
        },
        body: JSON.stringify({
          apiKey: AISENSY_API_KEY,
          campaignName: "direct_reply",
          destinationNumber: phone,
          message: {
            type: "text",
            payload: { text },
          },
        }),
      });
      if (response.ok) return;
      const body = await response.text();
      if (attempt === retries)
        throw new Error(
          `AISensy Send Failed after ${retries + 1} attempts: ${body}`,
        );
      console.warn(
        `⚠️ AISensy attempt ${attempt + 1} failed (${response.status}). Retrying...`,
      );
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    } catch (e) {
      if (attempt === retries) throw e;
      console.warn(`⚠️ AISensy attempt ${attempt + 1} error. Retrying...`);
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

async function syncToHubSpot(
  phone: string,
  incoming: string,
  outgoing: string,
  context: HubSpotContact | null,
  stage?: string,
  voiceTone?: string,
  score?: number,
  thought?: any, // Keeping 'thought' as any for now as logic is dynamic JSON
) {
  try {
    let contactId = context?.id;

    // 1. Create contact if context is empty
    if (!contactId) {
      // Search first to avoid duplicates (double check)
      const existing = await hubspot.searchContactByPhone(phone);
      if (existing) {
        contactId = existing.id;
      } else {
        const email = `${phone.replace("+", "")}@whatsapp.placeholder.com`;
        const createProp: Record<string, string> = {
          phone,
          email,
          firstname: "WhatsApp",
          lastname: "Lead",
          hs_lead_status: "NEW",
        };
        const created = await hubspot.createContact(createProp);
        contactId = created.id;
        console.log(`🆕 [Sync] Created new contact ${contactId}`);
      }
    }

    // 2. Log Message as Note (Engagement) with INTELLIGENCE
    const toneLine = voiceTone ? `\n🎭 **Detected Mood**: ${voiceTone}` : "";

    // Construct the "High-Status Intelligence Brief"
    const intelligenceBrief = thought
      ? `
--- 🕵️ AI STRATEGIST BRIEF ---
🌡️ Temperature: ${thought.lead_temperature?.toUpperCase() || "UNKNOWN"}
🎯 Phase: ${stage?.toUpperCase() || "UNKNOWN"}
${toneLine}💔 Pain identified: ${thought.current_state || "Not yet identified"}
✨ Desired outcome: ${thought.desired_state || "Not yet identified"}
🛑 Primary blocker: ${thought.blocker || "Not yet identified"}
🧠 Psych Profile: ${thought.psychological_profile || "Not yet assessed"}
⚖️ Gap Size: ${thought.gap_size?.toUpperCase() || "UNKNOWN"}
---------------------------
`
      : "";

    const noteBody = `📲 **WhatsApp Chat (Lisa AI Strategist)**\n${intelligenceBrief}\n**User**: ${incoming}\n**Lisa**: ${outgoing}`;
    const noteProm = hubspot.createNote(contactId, noteBody);

    // 3. Update Contact Props (Score, Maturity, etc)
    const contactUpdates: Record<string, string> = {
      whatsapp_last_message: incoming,
      whatsapp_last_reply: outgoing,
    };

    if (stage) contactUpdates.whatsapp_stage = stage;
    if (score) contactUpdates.lead_score = score.toString();
    if (thought?.lead_status)
      contactUpdates.lead_maturity = thought.lead_status;
    if (thought?.hubspot_summary)
      contactUpdates.whatsapp_summary = thought.hubspot_summary;
    if (thought?.current_state)
      contactUpdates.fitness_goal = thought.current_state;
    if (thought?.blocker) contactUpdates.biggest_challenge_ = thought.blocker;

    const updateProm = hubspot.updateContact(contactId, contactUpdates);

    await Promise.all([noteProm, updateProm]);

    console.log(`🚀 [Sync] Updated HubSpot Note & Properties for ${phone}`);
    console.log(`✅ [Sync] HubSpot updated for ${phone}`);
  } catch (e) {
    console.error("❌ [Sync] HubSpot sync failed:", e);
  }
}

async function logInteraction(
  phone: string,
  incoming: string,
  outgoing: string,
) {
  await supabase.from("whatsapp_interactions").insert({
    phone_number: phone,
    message_text: incoming,
    response_text: outgoing,
    status: "delivered",
  });
}

/**
 * BOOKING NOTIFICATION — Alerts the team when a lead reaches close/post_close.
 * Prevents leads from being ghosted after booking.
 */
async function notifyTeamOnBooking(
  phone: string,
  newPhase: string,
  oldPhase: string | undefined,
  hubspotContext: HubSpotContact | null,
  lastResponse: string,
  thought: InternalThought | null | undefined,
) {
  // Only fire when transitioning INTO close or post_close
  const bookingPhases = ["close", "post_close"];
  const wasNotBooking = !bookingPhases.includes(oldPhase || "");
  const isNowBooking = bookingPhases.includes(newPhase);

  if (!wasNotBooking || !isNowBooking) return;

  const leadName = hubspotContext?.properties?.firstname || "Unknown";
  const leadGoal =
    (thought?.desired_state as string) ||
    hubspotContext?.properties?.fitness_goal ||
    "Not identified";
  const leadArea = hubspotContext?.properties?.city || "Area unknown";

  console.log(
    `🔔 [BOOKING ALERT] Lead ${leadName} (${phone}) reached phase: ${newPhase}`,
  );

  try {
    // 1. Log to Supabase booking_notifications table
    await supabase.from("booking_notifications").insert({
      phone,
      lead_name: leadName,
      lead_goal: leadGoal,
      lead_area: leadArea,
      phase: newPhase,
      lisa_last_message: lastResponse.slice(0, 500),
      status: "pending",
      created_at: new Date().toISOString(),
    });

    // 2. Create urgent HubSpot note so the team sees it immediately
    if (hubspotContext?.id) {
      const urgentNote = `🚨 **BOOKING ALERT — HUMAN FOLLOW-UP REQUIRED**
📱 Phone: ${phone}
👤 Name: ${leadName}
🎯 Goal: ${leadGoal}
📍 Area: ${leadArea}
🤖 Lisa's last message: "${lastResponse.slice(0, 200)}"

⚡ ACTION: Create WhatsApp group and assign coach. DO NOT let this lead go cold.`;

      await hubspot.createNote(hubspotContext.id, urgentNote);
    }

    console.log(`✅ [BOOKING ALERT] Notification sent for ${phone}`);
  } catch (e) {
    console.error(`❌ [BOOKING ALERT] Failed to notify team for ${phone}:`, e);
  }
}
