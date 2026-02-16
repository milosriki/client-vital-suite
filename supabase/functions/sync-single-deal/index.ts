import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import { HubSpotManager } from "../_shared/hubspot-manager.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!HUBSPOT_API_KEY) throw new Error("HUBSPOT_ACCESS_TOKEN not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { dealId } = await req.json();

    if (!dealId) throw new Error("dealId is required");

    console.log(`[Sync-Single-Deal] Processing Deal ID: ${dealId}`);

    // Fetch owners map for name resolution
    const ownerMap: Record<string, string> = {};
    try {
      const ownersRes = await fetch("https://api.hubapi.com/crm/v3/owners", {
        headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` },
      });
      if (ownersRes.ok) {
        const data = await ownersRes.json();
        data.results.forEach(
          (o: { id: string; firstName: string; lastName: string }) =>
            (ownerMap[o.id] = `${o.firstName} ${o.lastName}`),
        );
      }
    } catch (e) {
      console.warn("[Sync-Single-Deal] Owner fetch failed, continuing", e);
    }

    // 1. Fetch Deal Details from HubSpot
    const dealResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals/${dealId}?properties=dealname,dealstage,amount,pipeline,closedate,hubspot_owner_id,createdate,lastmodifieddate,description,failure_reason`,
      {
        headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` },
      },
    );

    if (!dealResponse.ok) {
      if (dealResponse.status === 404) {
        console.log(`Deal ${dealId} not found (maybe deleted)`);
        // Optionally delete from Supabase if needed, or ignore
        return apiSuccess({ message: "Deal not found" });
      }
      throw new Error(`Failed to fetch deal: ${await dealResponse.text()}`);
    }

    const deal = await dealResponse.json();
    const props = deal.properties;

    // 2. Fetch Associations (Contacts)
    const assocResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/contacts`,
      {
        headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` },
      },
    );

    let contactId = null;
    if (assocResponse.ok) {
      const assocData = await assocResponse.json();
      if (assocData.results && assocData.results.length > 0) {
        const hubspotContactId = assocData.results[0].id;

        // Resolve to Supabase UUID
        const { data: contact } = await supabase
          .from("contacts")
          .select("id")
          .eq("hubspot_contact_id", hubspotContactId)
          .single();

        if (contact) {
          contactId = contact.id;
        } else {
          // If contact doesn't exist yet, we might want to trigger a sync for it?
          // For now, let's leave it null, or we could quickly fetch basic contact info.
          console.warn(
            `Contact ${hubspotContactId} not found in Supabase for deal ${dealId}`,
          );
        }
      }
    }

    // 3. Upsert to Supabase
    const dealOwnerId = props.hubspot_owner_id || null;
    const dealOwnerName = dealOwnerId ? ownerMap[dealOwnerId] || null : null;

    const dealData = {
      ...HubSpotManager.mapDealFields(deal, contactId, dealOwnerName),
    };

    const { error } = await supabase
      .from("deals")
      .upsert(dealData, { onConflict: "hubspot_deal_id" });

    if (error) throw error;

    console.log(`[Sync-Single-Deal] Successfully synced deal ${dealId}`);

    return apiSuccess({ success: true, deal: dealData });
  } catch (error: unknown) {
    console.error("[Sync-Single-Deal] Error:", error);
    return apiError("INTERNAL_ERROR", JSON.stringify({ error: error.message }), 500);
  }
});

// mapDealStageToStatus is now HubSpotManager.mapDealStageToStatus()
