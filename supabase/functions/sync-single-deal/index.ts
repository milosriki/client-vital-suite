import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!HUBSPOT_API_KEY) throw new Error("HUBSPOT_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { dealId } = await req.json();

    if (!dealId) throw new Error("dealId is required");

    console.log(`[Sync-Single-Deal] Processing Deal ID: ${dealId}`);

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
        return new Response(JSON.stringify({ message: "Deal not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
    const dealData = {
      hubspot_deal_id: deal.id,
      deal_name: props.dealname,
      deal_value: parseFloat(props.amount) || 0,
      value_aed: parseFloat(props.amount) || 0,
      stage: props.dealstage,
      pipeline: props.pipeline,
      close_date: props.closedate
        ? new Date(props.closedate).toISOString()
        : null,
      status: mapDealStageToStatus(props.dealstage),
      created_at: props.createdate
        ? new Date(props.createdate).toISOString()
        : new Date().toISOString(),
      updated_at: props.lastmodifieddate
        ? new Date(props.lastmodifieddate).toISOString()
        : new Date().toISOString(),
      contact_id: contactId,
      // Sync extra fields if schema supports them
      description: props.description,
      lost_reason: props.failure_reason,
    };

    const { error } = await supabase
      .from("deals")
      .upsert(dealData, { onConflict: "hubspot_deal_id" });

    if (error) throw error;

    console.log(`[Sync-Single-Deal] Successfully synced deal ${dealId}`);

    return new Response(JSON.stringify({ success: true, deal: dealData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Sync-Single-Deal] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function mapDealStageToStatus(stage: string): string {
  if (!stage) return "open";
  const s = stage.toLowerCase();
  if (s === "closedwon" || s === "closed_won") return "won";
  if (s === "closedlost" || s === "closed_lost") return "lost";
  return "open";
}
