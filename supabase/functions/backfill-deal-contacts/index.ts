import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";

/**
 * Backfill Deal→Contact Linkage via HubSpot Batch Associations API
 *
 * Uses the batch endpoint (500 deals per request) instead of individual calls.
 * Accepts optional `days` param to filter by recent deals only.
 *
 * Usage:
 *   POST /functions/v1/backfill-deal-contacts
 *   Body: { "days": 30 }   ← only last 30 days (default)
 *   Body: { "days": 0 }    ← all unlinked deals
 */
serve(async (req) => {
  try { verifyAuth(req); } catch { throw new UnauthorizedError(); }
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const HUBSPOT_TOKEN = Deno.env.get("HUBSPOT_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!HUBSPOT_TOKEN) throw new Error("HUBSPOT_ACCESS_TOKEN not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json().catch(() => ({}));
    const days = body.days ?? 30; // Default: last 30 days

    // 1. Get unlinked deals (with optional date filter)
    let query = supabase
      .from("deals")
      .select("id, hubspot_deal_id")
      .is("contact_id", null)
      .not("hubspot_deal_id", "is", null);

    if (days > 0) {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", since);
    }

    const { data: unlinkedDeals, error: fetchError } = await query.limit(500);

    if (fetchError) throw fetchError;
    if (!unlinkedDeals?.length) {
      return apiSuccess({ message: "No unlinked deals found", linked: 0, days });
    }

    console.log(`[Backfill] Found ${unlinkedDeals.length} unlinked deals (last ${days} days)`);

    // 2. Call HubSpot Batch Read Associations (up to 500 per request)
    const batchInputs = unlinkedDeals.map(d => ({ id: d.hubspot_deal_id }));

    const batchResponse = await fetch(
      "https://api.hubapi.com/crm/v4/associations/deals/contacts/batch/read",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUBSPOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: batchInputs }),
      },
    );

    if (!batchResponse.ok) {
      const errText = await batchResponse.text();
      console.error(`[Backfill] HubSpot Batch API error ${batchResponse.status}: ${errText}`);
      return apiSuccess({
        error: `HubSpot API ${batchResponse.status}`,
        detail: errText.substring(0, 500),
        processed: 0,
        linked: 0,
      });
    }

    const batchData = await batchResponse.json();
    const results = batchData.results || [];

    console.log(`[Backfill] HubSpot returned ${results.length} association results`);

    // 3. Build deal→contact map from HubSpot response
    // Response format: { results: [{ from: { id: "dealId" }, to: [{ toObjectId: contactId, ... }] }] }
    const dealToContact = new Map<string, string>();
    for (const result of results) {
      const dealHsId = String(result.from?.id);
      const contacts = result.to || [];
      if (contacts.length > 0) {
        // Take the first associated contact
        dealToContact.set(dealHsId, String(contacts[0].toObjectId));
      }
    }

    console.log(`[Backfill] ${dealToContact.size} deals have contact associations in HubSpot`);

    if (dealToContact.size === 0) {
      return apiSuccess({
        processed: unlinkedDeals.length,
        with_associations: 0,
        linked: 0,
        message: "No associations found in HubSpot for these deals",
        days,
      });
    }

    // 4. Resolve HubSpot contact IDs → Supabase UUIDs
    const hsContactIds = [...new Set(dealToContact.values())];
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, hubspot_contact_id")
      .in("hubspot_contact_id", hsContactIds);

    const contactMap = new Map<string, string>();
    for (const c of contacts || []) {
      contactMap.set(c.hubspot_contact_id, c.id);
    }

    console.log(`[Backfill] ${contactMap.size}/${hsContactIds.length} contacts found in Supabase`);

    // 5. Update deals with resolved contact_id
    let linked = 0;
    let notInSupabase = 0;

    for (const deal of unlinkedDeals) {
      const hsContactId = dealToContact.get(deal.hubspot_deal_id);
      if (!hsContactId) continue;

      const supabaseContactId = contactMap.get(hsContactId);
      if (!supabaseContactId) {
        notInSupabase++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("deals")
        .update({ contact_id: supabaseContactId, updated_at: new Date().toISOString() })
        .eq("id", deal.id);

      if (!updateError) linked++;
    }

    console.log(`[Backfill] Linked ${linked} deals. ${notInSupabase} contacts not in Supabase.`);

    return apiSuccess({
      days,
      processed: unlinkedDeals.length,
      with_associations: dealToContact.size,
      contacts_resolved: contactMap.size,
      linked,
      contacts_not_in_supabase: notInSupabase,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Backfill-Deal-Contacts] Error:", msg);
    return apiSuccess({ error: msg });
  }
});
