import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { HubSpotSyncManager } from "../_shared/hubspot-sync-manager.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const HUBSPOT_ACCESS_TOKEN = Deno.env.get("HUBSPOT_ACCESS_TOKEN");
    if (!HUBSPOT_ACCESS_TOKEN) {
      throw new Error("Missing HUBSPOT_ACCESS_TOKEN");
    }

    console.log("🔄 Starting HubSpot Contacts Sync...");

    // Initialize Sync Manager
    const syncManager = new HubSpotSyncManager(supabase, HUBSPOT_ACCESS_TOKEN);

    // 1. Fetch Modified Contacts (Last 24h)
    // Using the search endpoint via SyncManager
    const last24h = Date.now() - 24 * 60 * 60 * 1000;

    const searchResult = await syncManager.fetchHubSpot("contacts", {
      limit: 100, // Process in chunks if we were doing pagination, but for daily delta 100 might be enough or we need pagination loop
      filterGroups: [
        {
          filters: [
            {
              propertyName: "lastmodifieddate",
              operator: "GTE",
              value: last24h,
            },
          ],
        },
      ],
      properties: [
        "firstname",
        "lastname",
        "email",
        "phone",
        "lifecyclestage",
        "hubspot_owner_id",
        "call_status",
        "hs_lead_status",
        "createdate",
        "lastmodifieddate",
      ],
    });

    const contacts = searchResult.results;
    console.log(`📥 Fetched ${contacts.length} modified contacts.`);

    if (contacts.length === 0) {
      return apiSuccess({
        message: "No contacts modified in last 24h",
        start: new Date(last24h).toISOString(),
      });
    }

    // 2. Transform & Normalize
    const upsertData = contacts.map((contact: any) => {
      const props = contact.properties;

      // Smart Status Logic (copied from previous logic but refined)
      const rawStatus = props.call_status || props.hs_lead_status || "NEW";
      let normalizedStatus = "NEW";

      const statusMap: Record<string, string> = {
        connected: "CONNECTED",
        completed: "CONNECTED",
        busy: "ATTEMPTED",
        no_answer: "ATTEMPTED",
        left_voicemail: "LEFT_VOICEMAIL",
        bad_timing: "BAD_TIMING",
        wrong_number: "WRONG_NUMBER",
        not_interested: "DISQUALIFIED",
        qualified: "QUALIFIED",
        new: "NEW",
        open: "NEW",
        attempted_to_contact: "ATTEMPTED",
      };

      const lookup = rawStatus.toLowerCase().replace(/ /g, "_");
      if (statusMap[lookup]) {
        normalizedStatus = statusMap[lookup];
      }

      return {
        hubspot_id: contact.id,
        email: props.email,
        first_name: props.firstname,
        last_name: props.lastname,
        phone: props.phone,
        status: normalizedStatus,
        raw_status: rawStatus,
        hubspot_owner_id: props.hubspot_owner_id,
        lifecycle_stage: props.lifecyclestage || "lead",
        last_contacted: props.lastmodifieddate,
        updated_at: new Date().toISOString(),
        // Ensure we handle potentially missing fields gracefully
        created_at: props.createdate
          ? new Date(props.createdate).toISOString()
          : new Date().toISOString(),
      };
    });

    // 3. Upsert to Supabase
    const { error } = await supabase
      .from("contacts")
      .upsert(upsertData, { onConflict: "hubspot_id" });

    if (error) {
      console.error("Supabase Upsert Error:", error);
      throw error;
    }

    console.log(`✅ Successfully synced ${upsertData.length} contacts.`);

    return apiSuccess({
      success: true,
      processed: upsertData.length,
      message: "Sync complete",
    });
  } catch (error: unknown) {
    console.error("Sync Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError("INTERNAL_ERROR", message, 500);
  }
});
