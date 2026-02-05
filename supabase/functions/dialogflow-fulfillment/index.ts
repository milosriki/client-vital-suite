import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { HubSpotManager } from "../_shared/hubspot-manager.ts";
import { WHATSAPP_SALES_PERSONA } from "../_shared/whatsapp-sales-prompts.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { contentFilter } from "../_shared/content-filter.ts";
import { StageDetector, type SalesStage } from "../_shared/stage-detection.ts";
import { AvatarLogic } from "../_shared/avatar-logic.ts";
import { SentimentTriage } from "../_shared/sentiment.ts";
import { AntiRobot } from "../_shared/anti-robot.ts";
import { SalesStrategy } from "../_shared/sales-strategy.ts";
import { RepairEngine } from "../_shared/repair-engine.ts";
import { DubaiContext } from "../_shared/avatar-logic.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";

const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const hubspot = new HubSpotManager(
  HUBSPOT_API_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

const DIALOGFLOW_AUTH_TOKEN = Deno.env.get("DIALOGFLOW_AUTH_TOKEN");

Deno.serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  const startTime = Date.now();
  console.log("🤖 [Dialogflow-Fulfillment] Received request");

  // [SECURITY] Auth Check
  if (DIALOGFLOW_AUTH_TOKEN) {
    const authHeader = req.headers.get("x-auth-token");
    if (authHeader !== DIALOGFLOW_AUTH_TOKEN) {
      console.error("🚨 Unauthorized Access Attempt");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }
  } else {
    console.warn(
      "⚠️ SECURITY WARNING: DIALOGFLOW_AUTH_TOKEN not set. Endpoint is public.",
    );
  }

  try {
    const data = await req.json();
    const queryResult = data.queryResult;
    const intent = queryResult?.intent?.displayName;
    const incomingText = queryResult?.queryText; // User's message
    const originalFulfillmentText = queryResult?.fulfillmentText;

    const session = data.session;
    const originalDetectIntentRequest = data.originalDetectIntentRequest;

    let phone: string | null = null;

    // --- PHONE EXTRACTION (Multi-Provider Support) ---
    if (originalDetectIntentRequest?.payload?.data?.From) {
      phone = originalDetectIntentRequest.payload.data.From;
    } else if (originalDetectIntentRequest?.payload?.waNumber) {
      phone = originalDetectIntentRequest.payload.waNumber;
    } else if (originalDetectIntentRequest?.payload?.destinationNumber) {
      phone = originalDetectIntentRequest.payload.destinationNumber;
    }

    if (!incomingText || !phone) {
      console.warn("⚠️ Missing incoming text or phone number", {
        incomingText,
        phone,
      });
      return new Response(
        JSON.stringify({
          fulfillmentText:
            originalFulfillmentText || "I'm sorry, I couldn't process that.",
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // --- PAUSE CHECK (Human Takeover) ---
    const isPaused = await checkBotPaused(phone);
    if (isPaused && intent !== "RESUME_BOT") {
      console.log(`⏸️ Bot is PAUSED for ${phone}. Skipping response.`);
      return new Response(JSON.stringify({ fulfillmentText: "" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // --- DETERMINISTIC LANES (Hypothesis 3) ---
    if (intent === "STOP" || intent === "OPT_OUT") {
      return new Response(
        JSON.stringify({
          fulfillmentText:
            "You have been opted out. You will not receive further messages.",
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    if (intent === "BOOKING") {
      return new Response(
        JSON.stringify({
          fulfillmentText:
            "Great! You can book your consultation here: https://ptd-fitness.com/book",
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    if (intent === "HUMAN_HANDOFF") {
      await setBotPaused(phone, true);
      // Sync to HubSpot
      EdgeRuntime.waitUntil(hubspot.updateBotStatus(hubspotContext?.id, true));

      return new Response(
        JSON.stringify({
          fulfillmentText:
            "I've flagged this for a human coach. They will be with you shortly.",
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // --- RESUME LANE ---
    if (intent === "RESUME_BOT") {
      await setBotPaused(phone, false);
      EdgeRuntime.waitUntil(hubspot.updateBotStatus(hubspotContext?.id, false));
      return new Response(
        JSON.stringify({ fulfillmentText: "I'm back online! How can I help?" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // --- 1. CONTEXT RETRIEVAL (Dual-Layer: DB + Dialogflow Context) ---
    const outputContexts = queryResult?.outputContexts || [];
    const ptdSessionContext = outputContexts.find((c: any) =>
      c.name.endsWith("/contexts/ptd.session"),
    );

    // Fallback Code (Dialogflow Memory)
    const sessionParams = ptdSessionContext?.parameters || {};

    // Try to get DB history, fallback to empty if fails (don't crash)
    let chatHistory: any[] = [];
    let hubspotContext: any = null;

    try {
      const [hsResult, dbResult] = await Promise.allSettled([
        hubspot.searchContactByPhone(phone),
        getChatHistory(phone),
      ]);

      hubspotContext = hsResult.status === "fulfilled" ? hsResult.value : null;
      chatHistory = dbResult.status === "fulfilled" ? dbResult.value : [];

      if (hsResult.status === "rejected")
        console.error("⚠️ HubSpot Lookup Failed", hsResult.reason);
      if (dbResult.status === "rejected")
        console.error(
          "⚠️ Database History Lookup Failed (Using Context Fallback)",
          dbResult.reason,
        );
    } catch (err) {
      console.error("⚠️ Critical Context Error", err);
    }

    console.log(
      `🧠 Context retrieved. History Size: ${chatHistory.length}. Session Params: ${Object.keys(sessionParams).length}`,
    );

    // --- 2. AI INTELLIGENCE ---
    const currentStage =
      (hubspotContext?.properties?.whatsapp_stage as SalesStage) ||
      sessionParams.stage || // Fallback to session
      "1_CONNECTION";

    const stageResult = StageDetector.detect(currentStage, incomingText);

    // [SKILL: SENTIMENT TRIAGE]
    const sentiment = SentimentTriage.analyze(incomingText);
    let personaPrompt = "";

    // [RAG] Fetch Dynamic Knowledge
    const kbContext = await getKnowledgeBase(incomingText);

    if (sentiment === "RISK") {
      console.log("⚠️ RISK DETECTED - Switching to De-escalation Mode");
      personaPrompt = `
      You are Mark, a helpful support agent.
      The user seems upset. Your goal is to DE-ESCALATE.
      Do NOT sell. Do NOT be pushy.
      Simply apologize if needed, validate their feelings, and ask how you can help fix it.
      Keep it short and human.
      `;
    } else {
      // Merge Hubspot Context with Session Context for the AI
      const mergedContext = { ...hubspotContext, ...sessionParams };
      personaPrompt = buildDynamicPersona(
        mergedContext,
        chatHistory,
        stageResult.promptGoal,
        kbContext, // Injected here
      );
    }

    const aiResponse = await unifiedAI.chat(
      [
        { role: "system", content: personaPrompt },
        { role: "user", content: incomingText },
      ],
      {
        temperature: 0.7,
      },
    );

    let finalRawResponse = aiResponse.content;

    // [SKILL: SUPER INTELLIGENCE - LOOP REPAIR]
    const lastAiResponse = chatHistory[0]?.response_text || "";
    if (RepairEngine.detectLoop(lastAiResponse, finalRawResponse)) {
      console.log("🔄 LOOP DETECTED. Engaging Repair Engine...");
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
      );
      finalRawResponse = repairResponse.content;
    }

    const sanitized = contentFilter.sanitize(finalRawResponse);

    // [SAFETY] Guard against leaked templates
    if (
      sanitized.includes("TEMPLATE 1:") ||
      sanitized.includes("Templates for reaching out") ||
      sanitized.length > 500
    ) {
      console.error("🚨 BLOCKED LEAKED/LONG RESPONSE", sanitized);
      return new Response(
        JSON.stringify({
          fulfillmentText:
            "That sounds like a great goal! I'd love to help you build a plan for that. Quick question - have you tried personal training before, or would this be your first time?",
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    let finalResponse = contentFilter.toWhatsAppFormat(sanitized);

    // [SKILL: ANTI-ROBOT SYNTAX]
    finalResponse = AntiRobot.humanize(finalResponse, "PROFESSIONAL");

    // --- 3. BACKGROUND SYNC (Robust Error Handling) ---
    // @ts-expect-error: EdgeRuntime is available in Supabase
    EdgeRuntime.waitUntil(
      (async () => {
        const results = await Promise.allSettled([
          syncToHubSpot(
            phone,
            incomingText,
            finalResponse,
            hubspotContext,
            stageResult.hasChanged ? stageResult.stage : undefined,
            intent,
          ),
          logInteraction(phone, incomingText, finalResponse),
        ]);

        results.forEach((result, index) => {
          if (result.status === "rejected") {
            const jobName = index === 0 ? "HubSpot Sync" : "DB Log";
            console.error(
              `❌ [Critical Fail] ${jobName} failed:`,
              result.reason,
            );
            // TODO: Write to 'error_logs' table if available
          }
        });

        if (results.every((r) => r.status === "fulfilled")) {
          console.log(
            `✅ [Fulfillment] Full cycle complete in ${Date.now() - startTime}ms`,
          );
        }
      })(),
    );

    // --- 4. RESPONSE TO DIALOGFLOW (With Context Update) ---
    // Persist memory in Dialogflow Context (Lifespan 50)
    const sessionName = `${session}/contexts/ptd.session`;
    const updatedContexts = [
      {
        name: sessionName,
        lifespanCount: 50,
        parameters: {
          ...sessionParams,
          last_stage: currentStage,
          last_interaction: new Date().toISOString(),
        },
      },
    ];

    return new Response(
      JSON.stringify({
        fulfillmentText: finalResponse,
        outputContexts: updatedContexts,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("❌ Fulfillment Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// --- HELPER FUNCTIONS ---

async function getChatHistory(phone: string) {
  const { data } = await supabase
    .from("whatsapp_interactions")
    .select("message_text, response_text")
    .eq("phone_number", phone)
    .order("created_at", { ascending: false })
    .limit(5);
  return data || [];
}

function buildDynamicPersona(
  hubspotData: any,
  history: any[],
  currentGoal: string,
  kbContext: string = "",
) {
  const contactName = hubspotData?.properties?.firstname || "Friend";
  const stage = hubspotData?.properties?.whatsapp_stage || "Discovery";

  let historySummary = "";
  if (history.length > 0) {
    historySummary =
      "\nRecent Conversation:\n" +
      history
        .map((h) => `User: ${h.message_text}\nAI: ${h.response_text}`)
        .join("\n");
  }

  const avatarType = AvatarLogic.identify(hubspotData);
  const avatarInstruction = AvatarLogic.getInstruction(avatarType);
  const locationContext = DubaiContext.getContext(
    hubspotData?.properties?.city,
  );
  const salesStrategy = SalesStrategy.getStrategy(stage, hubspotData);

  return `
${WHATSAPP_SALES_PERSONA}

=== DYNAMIC KNOWLEDGE BASE (STRICT) ===
Use this information to answer user questions if relevant:
${kbContext || "No specific database articles found."}

=== DYNAMIC SALES INTELLIGENCE ===
${avatarInstruction}
${locationContext}

=== ELITE SALES STRATEGY (NEPQ) ===
${salesStrategy}

Current Lead Context:
- Name: ${contactName}
- AVATAR SEGMENT: ${avatarType}
- LOCATION INFO: ${locationContext.trim().split("\n")[1] || "General Dubai"}
- Current Stage: ${stage}
- Goal: ${hubspotData?.properties?.fitness_goal || "Unknown"}
${historySummary}

IMPORTANT: You are talking to ${contactName}.
CURRENT GOAL: ${currentGoal} (This is your ONLY focus).
Drive towards the assessment using the STRATEGY above. Be casual and concise.
`;
}

async function syncToHubSpot(
  phone: string,
  incoming: string,
  outgoing: string,
  context: any,
  newStage?: string,
  intent?: string,
) {
  try {
    let contactId = context?.id;

    if (!contactId) {
      const existing = await hubspot.searchContactByPhone(phone);
      if (existing) {
        contactId = existing.id;
      } else {
        const email = `${phone.replace("+", "")}@whatsapp.placeholder.com`;
        const createUrl = `https://api.hubapi.com/crm/v3/objects/contacts`;
        const createRes = await fetch(createUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            properties: {
              phone,
              email,
              firstname: "WhatsApp",
              lastname: "Lead",
              hs_lead_status: "NEW",
            },
          }),
        });
        const createData = await createRes.json();
        contactId = createData.id;
      }
    }

    // Log Message as Note
    const noteUrl = `https://api.hubapi.com/crm/v3/objects/notes`;
    const noteBody = `📲 **Dialogflow Chat**\n\n**Intent**: ${intent || "N/A"}\n**User**: ${incoming}\n**Mark**: ${outgoing}`;

    await fetch(noteUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HUBSPOT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          hs_note_body: noteBody,
          hs_timestamp: new Date().toISOString(),
        },
        associations: [
          {
            to: { id: contactId },
            types: [
              {
                associationCategory: "HUBSPOT_DEFINED",
                associationTypeId: 202,
              },
            ],
          },
        ],
      }),
    });

    if (newStage) {
      await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ properties: { whatsapp_stage: newStage } }),
        },
      );
    }
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

// [RAG] Dynamic Knowledge Base
async function getKnowledgeBase(query: string): Promise<string> {
  if (!query) return "";

  try {
    // 1. Keyword Search (Simple & Fast)
    const { data, error } = await supabase
      .from("knowledge_base")
      .select("question, answer, category")
      .eq("is_active", true)
      .textSearch("question", query, { type: "websearch", config: "english" })
      .limit(3);

    if (error) {
      console.warn("⚠️ Knowledge Base Lookup Failed", error);
      return "";
    }

    if (!data || data.length === 0) return "";

    return data
      .map(
        (item) => `
[Q]: ${item.question}
[A]: ${item.answer}
    `,
      )
      .join("\n");
  } catch (e) {
    console.error("⚠️ KB Error", e);
    return "";
  }
}

async function checkBotPaused(phone: string): Promise<boolean> {
  const { data } = await supabase
    .from("lead_states")
    .select("bot_paused")
    .eq("phone_number", phone)
    .single();
  return data?.bot_paused || false;
}

async function setBotPaused(phone: string, paused: boolean) {
  await supabase
    .from("lead_states")
    .upsert(
      {
        phone_number: phone,
        bot_paused: paused,
        last_interaction: new Date().toISOString(),
      },
      { onConflict: "phone_number" },
    );
  console.log(`🔄 Bot Paused State set to ${paused} for ${phone}`);
}
