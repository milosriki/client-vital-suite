import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  try {
    verifyAuth(req);
  } catch {
    throw new UnauthorizedError();
  } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_ACCESS_TOKEN"); // Use Access Token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!HUBSPOT_API_KEY)
      throw new Error("HUBSPOT_ACCESS_TOKEN not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { objectId } = await req.json(); // Call ID

    if (!objectId) throw new Error("objectId (Call ID) is required");

    console.log(`[Sync-Single-Call] Processing Call ID: ${objectId}`);

    // 1. Fetch Call Details from HubSpot
    const properties = [
      "hs_call_title",
      "hs_call_body",
      "hs_call_duration",
      "hs_call_status",
      "hs_call_from_number",
      "hs_call_to_number",
      "hs_call_recording_url",
      "hs_timestamp",
      "hubspot_owner_id",
      "hs_call_direction",
    ];

    const response = await fetch(
      `https://api.hubapi.com/crm/v3/objects/calls/${objectId}?properties=${properties.join(",")}`,
      {
        headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` },
      },
    );

    if (!response.ok) {
      if (response.status === 404)
        return apiSuccess({ message: "Call not found (deleted?)" });
      throw new Error(`HubSpot API Error: ${await response.text()}`);
    }

    const data = await response.json();
    const props = data.properties;

    // 2. Fetch Associations (Contact)
    // We need to know WHO was called to link it properly
    const assocResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/calls/${objectId}/associations/contacts`,
      { headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` } },
    );

    let contactId = null;
    let dealId = null;

    if (assocResponse.ok) {
      const assocData = await assocResponse.json();
      if (assocData.results?.length > 0) {
        const hsContactId = assocData.results[0].id;
        // Find internal contact ID
        const { data: contact } = await supabase
          .from("contacts")
          .select("id")
          .eq("hubspot_contact_id", hsContactId)
          .single();
        if (contact) contactId = contact.id;
      }
    }

    // 3. Upsert to Supabase 'call_records'
    const callRecord = {
      hubspot_engagement_id: objectId, // The ID from HubSpot
      caller_number: props.hs_call_from_number || "unknown",
      call_direction: props.hs_call_direction?.toLowerCase() || "outbound",
      call_status:
        props.hs_call_status === "COMPLETED" ? "completed" : "missed", // Simplified mapping
      call_outcome: props.hs_call_body || "No outcome logged", // Often stored in body
      duration_seconds: parseInt(props.hs_call_duration || "0") / 1000,
      started_at: props.hs_timestamp
        ? new Date(parseInt(props.hs_timestamp)).toISOString()
        : new Date().toISOString(),
      recording_url: props.hs_call_recording_url,
      hubspot_owner_id: props.hubspot_owner_id,
      // Linkage
      contact_id: contactId,
    };

    const { error } = await supabase
      .from("call_records")
      .upsert(callRecord, { onConflict: "hubspot_engagement_id" });

    if (error) throw error;

    console.log(
      `[Sync-Single-Call] Saved call ${objectId} linked to contact ${contactId}`,
    );

    return apiSuccess({ success: true, call: callRecord });
  } catch (error: unknown) {
    console.error("[Sync-Single-Call] Error:", error);
    return apiSuccess({ error: error.message });
  }
});
