import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { HubSpotManager } from "../_shared/hubspot-manager.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { isDubaiWorkHours } from "../_shared/date-utils.ts";
import { parseAIResponse } from "../_shared/response-parser.ts";
import { buildSmartPrompt } from "../_shared/smart-prompt.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import { getConstitutionalSystemMessage } from "../_shared/constitutional-framing.ts";
import {
  handleError,
  corsHeaders,
  ErrorCode,
} from "../_shared/error-handler.ts";

const FUNCTION_NAME = "antigravity-followup-engine";

const AISENSY_API_KEY = Deno.env.get("AISENSY_API_KEY")!;
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
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  console.log("⏰ Antigravity Follow-up Engine Triggered");

  // 1. Guardrail: Timezone (7 AM - 10 PM GST)
  if (!isDubaiWorkHours()) {
    console.log("😴 Outside Dubai work hours. Skipping.");
    return apiSuccess({ status: "skipped_nighttime" });
  }

  try {
    verifyAuth(req);
    // 2. Query Follow-up Queue
    const { data: queue, error } = await supabase
      .from("v_followup_queue")
      .select("*")
      .limit(5);
    if (error || !queue) throw error || new Error("Queue empty");

    console.log(`🔍 Found ${queue.length} potential leads for follow-up`);

    for (const lead of queue) {
      // 3. HubSpot Guards (bot_paused & human activity)
      const hsContact = await hubspot.searchContactByPhone(lead.phone);

      if (
        hsContact?.properties?.bot_paused === "true" ||
        hsContact?.properties?.bot_paused === true
      ) {
        console.log(`⏸️ Bot paused for ${lead.phone}. Skipping.`);
        continue;
      }

      // Check for recent interaction to avoid double-texting
      const { data: interactions } = await supabase
        .from("whatsapp_interactions")
        .select("*")
        .eq("phone_number", lead.phone)
        .gt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());

      if (interactions && interactions.length > 0) {
        // If there's an outgoing response text, it means AI or human spoke in the last 30 mins
        console.log(
          `⏳ Recent interaction detected for ${lead.phone}. Skipping.`,
        );
        continue;
      }

      // 4. Generate High-Status Follow-up
      const context = {
        name: hsContact?.properties?.firstname || "Friend",
        phone: lead.phone,
        goal: hsContact?.properties?.fitness_goal || lead.desired_outcome,
        area: hsContact?.properties?.city || lead.area || "Dubai",
        housing_type: null,
        history_summary: lead.conversation_summary || "",
        message_count: lead.message_count || 0,
        last_message: "",
        lead_score: lead.lead_score || 10,
        dominant_pain: lead.dominant_pain,
        psychological_profile: lead.psychological_profile,
        days_since_last_reply: 0,
        referral_source: null,
      };

      const constitutionalPrefix = getConstitutionalSystemMessage();
      const prompt = `${constitutionalPrefix}\n\n${buildSmartPrompt(context)}`;
      const aiResponse = await unifiedAI.chat([
        { role: "system", content: prompt },
        {
          role: "user",
          content:
            "(SYSTEM: The user has been silent for 30 minutes. Send a high-status pattern interrupt to re-engage them. Use their name and a Dubai pain point if known. Mention that life gets busy.)",
        },
      ]);

      const parsed = parseAIResponse(aiResponse.content);

      // 5. Send to AiSensy
      await sendToAiSensy(lead.phone, parsed.reply);

      // 6. Update Database
      await supabase
        .from("conversation_intelligence")
        .update({
          last_followup_at: new Date().toISOString(),
          followup_count: (lead.followup_count || 0) + 1,
          followup_stage: "challenge_sent",
        })
        .eq("phone", lead.phone);

      // 7. Sync to HubSpot
      await hubspot.createNote(
        hsContact.id,
        `📲 **Auto-Followup (Lisa AI Strategist)**\n${parsed.reply}`,
      );

      console.log(`✅ Follow-up sent to ${lead.phone}: ${parsed.reply}`);
    }

    return apiSuccess({ status: "complete", processed: queue.length });
  } catch (err: unknown) {
    console.error("💥 Follow-up Error:", err);
    return handleError(err, FUNCTION_NAME, {
      errorCode: ErrorCode.UNKNOWN_ERROR,
      context: { action: "followup_engine" },
    });
  }
});

async function sendToAiSensy(phone: string, text: string) {
  const url = `https://backend.aisensy.com/devapi/v1/project/default/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: AISENSY_API_KEY,
        campaignName: "direct_reply",
        destinationNumber: phone,
        message: { type: "text", payload: { text } },
      }),
    });
    if (!res.ok) console.error("AiSensy API error:", await res.text());
  } catch (e) {
    console.error("AiSensy Fetch error:", e);
  }
}
