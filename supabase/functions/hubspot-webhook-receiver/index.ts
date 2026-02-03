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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify HubSpot Signature (Security Best Practice)
    // For now, we trust the obscure URL, but in prod we check X-HubSpot-Signature

    const events = await req.json();
    console.log(`[HubSpot Webhook] Received ${events.length} events`);

    for (const event of events) {
      const { subscriptionType, objectId, propertyName, propertyValue } = event;
      console.log(`Processing ${subscriptionType} for object ${objectId}`);

      // 1. Deal Events
      if (subscriptionType === "deal.creation") {
        await supabase.functions.invoke("sync-single-deal", {
          body: { dealId: objectId },
        });
      }

      // 2. Contact Events (New Lead)
      if (
        subscriptionType === "contact.creation" ||
        subscriptionType === "contact.propertyChange"
      ) {
        console.log(`Triggering sync for contact ${objectId}`);
        await supabase.functions.invoke("sync-single-contact", {
          body: { objectId },
        });
      }

      // 3. Call Creation (The "Smart Sync" for Calls)
      // Note: User must subscribe to "Call creation" in HubSpot Webhooks
      if (
        subscriptionType === "call.creation" ||
        (subscriptionType === "object.creation" &&
          (event as any).objectType === "CALL")
      ) {
        console.log(`Triggering sync for CALL ${objectId}`);
        await supabase.functions.invoke("sync-single-call", {
          body: { objectId },
        });
      }

      // 4. Association Change (Linker)
      if (subscriptionType === "deal.associationChange") {
        const { toObjectId } = event;
        console.log(
          `Association changed: Deal ${objectId} <-> Object ${toObjectId}`,
        );
        await supabase.rpc("manual_link_deal_contact", {
          p_deal_id: objectId.toString(),
          p_contact_id: toObjectId.toString(),
        });
      }

      // 5. Stage Change
      if (
        propertyName === "dealstage" &&
        (propertyValue === "closedwon" || propertyValue === "closed_won")
      ) {
        console.log("💰 DEAL WON! Triggering celebration...");
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
