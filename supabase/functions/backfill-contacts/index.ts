import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";

serve(async (req) => {
  try { verifyAuth(req); } catch { throw new UnauthorizedError(); }
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get contacts missing marketing data (first_touch_source is the litmus test)
    const { data: staleContacts, error: fetchError } = await supabase
      .from("contacts")
      .select("hubspot_contact_id")
      .not("hubspot_contact_id", "is", null)
      .is("first_touch_source", null)
      .limit(50); // Process 50 per invocation (HubSpot rate limits)

    if (fetchError) throw fetchError;
    if (!staleContacts?.length) {
      return apiSuccess({ message: "All contacts backfilled", remaining: 0 });
    }

    let synced = 0;
    let errors = 0;

    for (const contact of staleContacts) {
      try {
        // Call our own sync-single-contact function (already fixed in Task 2)
        const syncResponse = await fetch(
          `${supabaseUrl}/functions/v1/sync-single-contact`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ objectId: contact.hubspot_contact_id }),
          },
        );

        const result = await syncResponse.json();
        if (result.data?.error) {
          console.warn(`Failed to sync ${contact.hubspot_contact_id}: ${result.data.error}`);
          errors++;
        } else {
          synced++;
        }

        // Rate limit: HubSpot allows 100 requests/10 seconds
        if (synced % 10 === 0) await new Promise(r => setTimeout(r, 1200));
      } catch (e) {
        console.warn(`Error syncing ${contact.hubspot_contact_id}:`, e);
        errors++;
      }
    }

    // Count remaining
    const { count } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .not("hubspot_contact_id", "is", null)
      .is("first_touch_source", null);

    return apiSuccess({ synced, errors, remaining: count || 0 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return apiSuccess({ error: msg });
  }
});
