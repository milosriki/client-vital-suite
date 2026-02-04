import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { HubSpotManager } from "../_shared/hubspot-manager.ts";
import { WHATSAPP_SALES_PERSONA } from "../_shared/whatsapp-sales-prompts.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { contentFilter } from "../_shared/content-filter.ts";

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
  const startTime = Date.now();
  console.log("🚀 [AISensy-Orchestrator] Received request");

  try {
    // 1. Verify Signature (Security First)
    const signature = req.headers.get("x-aisensy-signature");
    const bodyText = await req.text();

    if (!verifySignature(bodyText, signature, AISENSY_WEBHOOK_SECRET)) {
      console.error("❌ Invalid signature");
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = JSON.parse(bodyText);
    const incomingText = payload.message?.payload?.text;
    const phone = payload.destinationNumber; // AISensy format

    if (!incomingText || !phone) {
      return new Response("Missing data", { status: 400 });
    }

    // 2. Parallel Context Retrieval (Speed Pillar)
    const [hubspotContext, chatHistory] = await Promise.all([
      hubspot.searchContactByPhone(phone),
      getChatHistory(phone),
    ]);

    console.log(`🧠 Context retrieved in ${Date.now() - startTime}ms`);

    // 3. AI Intelligence (Persona Pillar)
    const persona = buildDynamicPersona(hubspotContext, chatHistory);

    const aiResponse = await unifiedAI.chat(
      [
        { role: "system", content: persona },
        { role: "user", content: incomingText },
      ],
      {
        temperature: 0.7,
      },
    );

    const sanitized = contentFilter.sanitize(aiResponse.content);
    const filteredResponse = contentFilter.toWhatsAppFormat(sanitized);

    // 4. Immediate Delivery (Efficiency Pillar)
    const deliveryPromise = sendToAISensy(phone, filteredResponse);

    // 5. Background Sync (Reliability Pillar)
    // We don't wait for this to finish to return the response to the webhook
    // @ts-expect-error: EdgeRuntime is available in Supabase
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          await Promise.all([
            deliveryPromise,
            syncToHubSpot(
              phone,
              incomingText,
              filteredResponse,
              hubspotContext,
            ),
            logInteraction(phone, incomingText, filteredResponse),
          ]);
          console.log(
            `✅ [AISensy-Orchestrator] Full cycle complete in ${Date.now() - startTime}ms`,
          );
        } catch (e) {
          console.error("❌ Background sync failed", e);
        }
      })(),
    );

    return new Response(JSON.stringify({ status: "processing" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    console.error("💥 Orchestrator Error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
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
    console.warn("⚠️ AISENSY_WEBHOOK_SECRET not set. Skipping verification.");
    return true;
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
  } catch (error) {
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
    .limit(5);
  return data || [];
}

function buildDynamicPersona(hubspotData: any, history: any[]) {
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

  return `
${WHATSAPP_SALES_PERSONA}

Current Lead Context:
- Name: ${contactName}
- Current Stage: ${stage}
- Goal: ${hubspotData?.properties?.fitness_goal || "Unknown"}
${historySummary}

IMPORTANT: You are talking to ${contactName}. Be helpful, concise, and drive towards the assessment.
`;
}

async function sendToAISensy(phone: string, text: string) {
  const url = `https://backend.aisensy.com/devapi/v1/project/default/messages`;
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
  if (!response.ok)
    throw new Error(`AISensy Send Failed: ${await response.text()}`);
}

async function syncToHubSpot(
  phone: string,
  incoming: string,
  outgoing: string,
  context: any,
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
        console.log(`🆕 [Sync] Created new contact ${contactId}`);
      }
    }

    // 2. Log Message as Note (Engagement)
    const noteUrl = `https://api.hubapi.com/crm/v3/objects/notes`;
    const noteBody = `📲 **WhatsApp Chat (Direct Path)**\n\n**User**: ${incoming}\n**Mark**: ${outgoing}`;

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
