/**
 * CallGear Webhook - Receives real-time HTTP notifications from CallGear
 * Deployed with --no-verify-jwt (no auth required for webhooks)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface CallGearNotification {
  event: string;
  call_session_id: string;
  virtual_phone_number?: string;
  employee_id?: string;
  employee_name?: string;
  direction?: string;
  talk_duration?: number;
  total_duration?: number;
  timestamp?: string;
  tags?: string[];
  contact_phone_number?: string;
  caller_number?: string;
  finish_reason?: string;
  is_lost?: boolean;
  city?: string;
  country?: string;
  region?: string;
  recording_url?: string;
  comment?: string;
}

function mapDirection(dir?: string): string {
  if (dir === "in" || dir === "inbound") return "inbound";
  if (dir === "out" || dir === "outbound") return "outbound";
  return "inbound";
}

function mapStatus(event: string, finishReason?: string, isLost?: boolean): string {
  if (isLost) return "missed";
  if (event === "call.completed" || event === "call_finished") return "completed";
  if (event === "call.missed" || finishReason === "abandoned") return "missed";
  if (finishReason === "busy") return "busy";
  return "completed";
}

function mapOutcome(event: string, finishReason?: string, isLost?: boolean): string {
  if (isLost) return "lost";
  if (finishReason === "abandoned" || event === "call.missed") return "no_answer";
  if (finishReason === "busy") return "busy";
  return "answered";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: CallGearNotification = await req.json();
    console.log("CallGear webhook received:", JSON.stringify(payload));

    if (!payload.call_session_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing call_session_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const callerNumber = payload.contact_phone_number || payload.caller_number || "unknown";
    const callStatus = mapStatus(payload.event, payload.finish_reason, payload.is_lost);
    const callOutcome = mapOutcome(payload.event, payload.finish_reason, payload.is_lost);

    const record = {
      provider_call_id: payload.call_session_id,
      call_status: callStatus,
      call_direction: mapDirection(payload.direction),
      call_outcome: callOutcome,
      caller_number: callerNumber,
      duration_seconds: payload.total_duration || payload.talk_duration || 0,
      started_at: payload.timestamp || new Date().toISOString(),
      hubspot_owner_id: payload.employee_id || null,
      caller_city: payload.city || null,
      caller_country: payload.country || null,
      caller_state: payload.region || null,
      recording_url: payload.recording_url || null,
      keywords: payload.tags || null,
      ai_summary: payload.comment || null,
      owner_name: payload.employee_name || null,
      is_lost: payload.event === 'lost_call' || callOutcome === 'no_answer',
      ptd_outcome: payload.event === 'lost_call' ? 'Lost Call' : null,
    };

    // Upsert by provider_call_id
    const { data, error } = await supabase
      .from("call_records")
      .upsert(record, { onConflict: "provider_call_id" })
      .select("id")
      .single();

    if (error) {
      console.error("Upsert error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Call record upserted:", data.id);
    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
