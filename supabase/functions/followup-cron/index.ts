// ================================================================
// File: supabase/functions/followup-cron/index.ts
// Scheduled function for anti-ghost follow-ups
// Schedule: Every 6 hours (configure in Supabase Dashboard)
// ================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import {
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
  handleError,
  corsHeaders,
  ErrorCode,
} from "../_shared/error-handler.ts";

const FUNCTION_NAME = "followup-cron";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const aisensyKey = Deno.env.get("AISENSY_API_KEY")!;

interface FollowUpLead {
  phone: string;
  name: string;
  goal: string;
  dominant_pain: string;
  followup_stage: string;
  followup_count: number;
  hours_inactive: number;
}

function getFollowUpMessage(
  lead: FollowUpLead,
): { message: string; newStage: string } | null {
  const name = lead.name || "there";
  const goal = lead.goal || "getting in shape";

  if (lead.followup_stage === "none" && lead.hours_inactive >= 24) {
    return {
      message:
        `Hey ${name}, did you give up on ${goal} ` +
        `or just get super busy? \uD83D\uDE02`,
      newStage: "challenge_sent",
    };
  }

  if (lead.followup_stage === "challenge_sent" && lead.hours_inactive >= 48) {
    return {
      message:
        `Hey, just saw one of our clients in Dubai ` +
        `hit a solid transformation in 8 weeks. Similar ` +
        `starting point to what you described. Want me ` +
        `to share what they did?`,
      newStage: "value_drop_sent",
    };
  }

  if (lead.followup_stage === "value_drop_sent" && lead.hours_inactive >= 72) {
    return {
      message:
        `No stress if the timing's off \u2014 just going ` +
        `to close your file for now. If you want to revisit ` +
        `later, just message back. \u270C\uFE0F`,
      newStage: "breakup_sent",
    };
  }

  // After breakup, mark as exhausted (stop following up)
  if (lead.followup_stage === "breakup_sent" && lead.hours_inactive >= 96) {
    return { message: "", newStage: "exhausted" };
  }

  return null;
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  try {
    // If no API key, log and return true (simulation)
    if (!aisensyKey) {
      console.warn("AiSensy API Key missing. Skipping send.");
      return true;
    }

    const resp = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aisensyKey}`,
      },
      body: JSON.stringify({
        apiKey: aisensyKey,
        campaignName: "mark_followup",
        destination: phone,
        userName: "PTD Fitness",
        templateParams: [],
        message: message,
      }),
    });
    return resp.ok;
  } catch (e) {
    console.error(`Failed to send to ${phone}:`, e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    verifyAuth(req);
    // Get all leads needing follow-up from the VIEW
    const { data: leads, error } = await supabase
      .from("v_followup_queue")
      .select("*")
      .limit(50);

    if (error) {
      console.error("Error fetching leads:", error);
      return apiSuccess({ error: error.message }), {
        status: 500,
      });
    }

    if (!leads || leads.length === 0) {
      return apiSuccess({ processed: 0 });
    }

    let processed = 0;

    for (const lead of leads) {
      try {
        const action = getFollowUpMessage(lead as FollowUpLead);
        if (!action) continue;

        if (action.message) {
          await sendWhatsApp(lead.phone, action.message);
        }

        await supabase
          .from("conversation_intelligence")
          .update({
            followup_stage: action.newStage,
            followup_count: (lead.followup_count || 0) + 1,
          })
          .eq("phone", lead.phone);

        processed++;
      } catch (e) {
        console.error(`Error processing lead ${lead.phone}:`, e);
      }
    }

    return apiSuccess({ processed, total: leads.length });
