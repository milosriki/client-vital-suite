import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";

serve(async (req) => {
  try { verifyAuth(req); } catch { throw new UnauthorizedError(); }
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!HUBSPOT_API_KEY) throw new Error("HUBSPOT_ACCESS_TOKEN not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get deals that are missing contact_id
    const { data: unlinkedDeals, error: fetchError } = await supabase
      .from("deals")
      .select("id, hubspot_deal_id")
      .is("contact_id", null)
      .not("hubspot_deal_id", "is", null)
      .limit(100); // Process in batches of 100

    if (fetchError) throw fetchError;
    if (!unlinkedDeals?.length) {
      return apiSuccess({ message: "No unlinked deals found", linked: 0 });
    }

    let linked = 0;
    let errors = 0;

    for (const deal of unlinkedDeals) {
      try {
        // Call HubSpot Associations API v4
        const assocResponse = await fetch(
          `https://api.hubapi.com/crm/v4/objects/deals/${deal.hubspot_deal_id}/associations/contacts`,
          { headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` } },
        );

        if (!assocResponse.ok) {
          if (assocResponse.status === 429) {
            // Rate limited — wait and retry
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          console.warn(`HubSpot 404/error for deal ${deal.hubspot_deal_id}: ${assocResponse.status}`);
          errors++;
          continue;
        }

        const assocData = await assocResponse.json();
        const results = assocData.results || [];

        if (results.length === 0) continue;

        // Get the primary contact (first result)
        const hubspotContactId = String(results[0].toObjectId);

        // Find this contact in our database
        const { data: contact } = await supabase
          .from("contacts")
          .select("id")
          .eq("hubspot_contact_id", hubspotContactId)
          .maybeSingle();

        if (!contact) {
          console.log(`Contact ${hubspotContactId} not found in Supabase for deal ${deal.hubspot_deal_id}`);
          continue;
        }

        // Link the deal to the contact
        const { error: updateError } = await supabase
          .from("deals")
          .update({ contact_id: contact.id })
          .eq("id", deal.id);

        if (updateError) {
          console.warn(`Failed to link deal ${deal.id}: ${updateError.message}`);
          errors++;
        } else {
          linked++;
        }

        // Rate limit: 100 requests/10 seconds for HubSpot
        if (linked % 10 === 0) await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        console.warn(`Error processing deal ${deal.hubspot_deal_id}:`, e);
        errors++;
      }
    }

    console.log(`[Backfill] Linked ${linked}/${unlinkedDeals.length} deals. Errors: ${errors}`);

    return apiSuccess({
      processed: unlinkedDeals.length,
      linked,
      errors,
      remaining: unlinkedDeals.length - linked - errors,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Backfill-Deal-Contacts] Error:", msg);
    return apiSuccess({ error: msg });
  }
});
