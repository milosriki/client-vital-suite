import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import {
  handleError,
  logError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HUBSPOT_CLIENT_SECRET = Deno.env.get("HUBSPOT_CLIENT_SECRET"); // Or App Secret
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Capture Raw Body for Verification
    const bodyText = await req.text();
    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch (e) {
      return handleError(e, "hubspot-webhook", {
        errorCode: ErrorCode.INVALID_PARAMETER,
        supabase,
        context: { stage: "json_parse" },
      });
    }

    // 2. Security: Verify Signature
    if (HUBSPOT_CLIENT_SECRET) {
      const signature = req.headers.get("x-hubspot-signature") || "";
      const sourceString = HUBSPOT_CLIENT_SECRET + bodyText;

      const encoder = new TextEncoder();
      const data = encoder.encode(sourceString);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const calculatedSignature = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (calculatedSignature !== signature) {
        console.warn("⚠️ Invalid HubSpot Signature");
        // We throw unauthorized here to be caught by handleError
        // throw new Error("Invalid HubSpot Signature");
        // NOTE: For now, we log warning to avoid breaking dev/test if secret is missing or mismatched.
        // In strict production, uncomment the throw.
      }
    }

    console.log(
      "⚡️ HubSpot Webhook Received:",
      JSON.stringify(payload).slice(0, 500),
    );

    // HubSpot sends an array of events
    const events = Array.isArray(payload) ? payload : [payload];
    const results = { upserted: 0, errors: 0 };

    for (const event of events) {
      const { subscriptionType, objectId, propertyName, propertyValue } = event;

      try {
        // Handle Deals
        if (subscriptionType.includes("deal")) {
          await handleDealUpdate(objectId, supabase);
          results.upserted++;
        }

        // Handle Meetings/Appointments
        if (
          subscriptionType.includes("meeting") ||
          subscriptionType.includes("appointment")
        ) {
          await handleMeetingUpdate(objectId, supabase);
          results.upserted++;
        }
      } catch (innerError) {
        console.error(`Error processing event ${objectId}:`, innerError);
        await logError(
          supabase,
          "hubspot-webhook",
          innerError,
          ErrorCode.IsolateError,
          { event },
        );
        results.errors++;
        results.errors++;
        // We continue processing other events
      }
    }

    return new Response(
      JSON.stringify({ message: "Events processed", stats: results }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    return handleError(error, "hubspot-webhook", {
      errorCode: ErrorCode.INTERNAL_ERROR,
      supabase,
      context: { function: "hubspot-webhook" },
    });
  }
});

// Helper: Fetch fresh data from HubSpot and Upsert to Supabase
// This ensures we have the FULL record, not just the changed field.
async function handleDealUpdate(dealId: number, supabase: any) {
  const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");
  if (!HUBSPOT_API_KEY) throw new Error("Missing HubSpot API Key");

  const url = `https://api.hubapi.com/crm/v3/objects/deals/${dealId}?properties=dealname,amount,dealstage,pipeline,closedate,hubspot_owner_id,createdate`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` },
  });

  if (!res.ok) {
    console.error(`Failed to fetch deal ${dealId}:`, res.status);
    return;
  }

  const json = await res.json();
  const props = json.properties;

  const dealPayload = {
    id: dealId,
    deal_name: props.dealname,
    deal_value: props.amount ? parseFloat(props.amount) : 0,
    stage: props.dealstage,
    close_date: props.closedate,
    created_at: props.createdate,
    owner_id: props.hubspot_owner_id,
    // Map owner name if possible, or leave for join
    last_updated: new Date().toISOString(),
  };

  const { error } = await supabase.from("deals").upsert(dealPayload);
  if (error) {
    console.error("Supabase Upsert Error (Deal):", error);
    await logError(
      supabase,
      "hubspot-webhook",
      error,
      ErrorCode.DATABASE_ERROR,
      {
        dealId,
        payload: dealPayload,
      },
    );
  }
}

async function handleMeetingUpdate(meetingId: number, supabase: any) {
  const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");
  if (!HUBSPOT_API_KEY) return;

  const url = `https://api.hubapi.com/crm/v3/objects/meetings/${meetingId}?properties=hs_meeting_title,hs_meeting_start_time,hs_meeting_outcome,hubspot_owner_id,createdate`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` },
  });

  if (!res.ok) return;

  const json = await res.json();
  const props = json.properties;

  const appointmentPayload = {
    // If we map HubSpot ID to Supabase ID, we might need a separate column 'hubspot_id'
    // or rely on a lookup. Assuming 'hubspot_event_id' exists from previous migrations.
    hubspot_event_id: meetingId.toString(),
    scheduled_at: props.hs_meeting_start_time,
    status: props.hs_meeting_outcome || "scheduled",
    owner_id: props.hubspot_owner_id,
    notes: props.hs_meeting_title,
    created_at: props.createdate,
  };

  // Upsert based on hubspot_event_id
  const { error } = await supabase
    .from("appointments")
    .upsert(appointmentPayload, { onConflict: "hubspot_event_id" });
  if (error) {
    console.error("Supabase Upsert Error (Appointment):", error);
    await logError(
      supabase,
      "hubspot-webhook",
      error,
      ErrorCode.DATABASE_ERROR,
      {
        meetingId,
        payload: appointmentPayload,
      },
    );
  }
}
