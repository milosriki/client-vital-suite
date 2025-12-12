import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AnyTrack Webhook Receiver - syncs conversion events to Supabase
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[AnyTrack Webhook] Received request");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    console.log("[AnyTrack Webhook] Payload:", JSON.stringify(body).slice(0, 500));

    // AnyTrack sends array of events
    const events = Array.isArray(body) ? body : [body];
    let processed = 0;
    let errors = 0;

    for (const event of events) {
      try {
        // Extract event data from AnyTrack format
        const eventData = {
          event_id: event.transactionId || event.clientId || `anytrack_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          event_name: event.eventName || "Unknown",
          event_time: event.eventTime || new Date().toISOString(),
          source: "anytrack",
          status: "completed",
          user_data: {
            em: event.email || null,
            ph: event.phone || null,
            fn: event.firstName || event.fullName?.split(" ")[0] || null,
            ln: event.lastName || event.fullName?.split(" ").slice(1).join(" ") || null,
            external_id: event.customerId || event.clientId || null,
          },
          custom: {
            value: event.eventValue || event.orderTotal || event.cartTotal || 0,
            currency: event.currency || "AED",
            transaction_id: event.transactionId || null,
            order_id: event.order_id || null,
            items: event.items || [],
            // Attribution data
            source_attribution: event.mainAttribution?.source || null,
            medium: event.mainAttribution?.medium || null,
            campaign: event.mainAttribution?.campaign || null,
            gclid: event.mainAttribution?.gclid || null,
            fbclid: event.mainAttribution?.fbclid || null,
            click_id: event.clickId || null,
          },
          meta: {
            anytrack_asset_id: event.assetId || null,
            integration_id: event.integrationId || null,
            tracking_group: event.trackingGroupId || null,
            user_agent: event.userAgent || null,
            location: event.location || null,
            brand: event.brandName || null,
            attributions: event.attributions || [],
          },
        };

        // Insert into events table - use composite key (event_id, source)
        const { error: eventError } = await supabase
          .from("events")
          .upsert(eventData, { onConflict: "event_id,source" });

        if (eventError) {
          console.error("[AnyTrack Webhook] Event insert error:", eventError);
          errors++;
          continue;
        }

        // Also create/update attribution event for journey tracking
        if (event.eventName === "Purchase" || event.eventName === "Lead" || event.eventName === "CompleteRegistration") {
          const attributionData = {
            event_id: eventData.event_id,
            event_name: eventData.event_name,
            event_time: eventData.event_time,
            email: eventData.user_data.em,
            first_name: eventData.user_data.fn,
            last_name: eventData.user_data.ln,
            value: eventData.custom.value,
            currency: eventData.custom.currency,
            source: event.mainAttribution?.source || "anytrack",
            medium: event.mainAttribution?.medium || null,
            campaign: event.mainAttribution?.campaign || null,
            utm_source: event.mainAttribution?.source || null,
            utm_medium: event.mainAttribution?.medium || null,
            utm_campaign: event.mainAttribution?.campaign || null,
            utm_term: event.mainAttribution?.term || null,
            utm_content: event.mainAttribution?.content || null,
            landing_page: event.location || null,
            referrer: event.mainAttribution?.referrer || null,
            platform: "anytrack",
          };

          await supabase
            .from("attribution_events")
            .upsert(attributionData, { onConflict: "event_id" });
        }

        // If it's a lead event, also sync to contacts
        if (event.eventName === "Lead" || event.eventName === "CompleteRegistration" || event.eventName === "FormSubmit") {
          const contactData = {
            email: eventData.user_data.em,
            first_name: eventData.user_data.fn,
            last_name: eventData.user_data.ln,
            first_touch_source: event.mainAttribution?.source || "anytrack",
            first_touch_time: new Date().toISOString(),
            latest_traffic_source: event.mainAttribution?.source || null,
            total_events: 1,
            total_value: eventData.custom.value || 0,
          };

          if (contactData.email) {
            // Check if contact exists
            const { data: existing } = await supabase
              .from("contacts")
              .select("id, total_events, total_value")
              .eq("email", contactData.email)
              .single();

            if (existing) {
              // Update existing
              await supabase
                .from("contacts")
                .update({
                  total_events: (existing.total_events || 0) + 1,
                  total_value: (existing.total_value || 0) + (eventData.custom.value || 0),
                  last_touch_source: event.mainAttribution?.source || null,
                  last_touch_time: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existing.id);
            } else {
              // Create new
              await supabase.from("contacts").insert(contactData);
            }
          }
        }

        processed++;
        console.log(`[AnyTrack Webhook] Processed ${event.eventName} event: ${eventData.event_id}`);

      } catch (e) {
        console.error("[AnyTrack Webhook] Error processing event:", e);
        errors++;
      }
    }

    console.log(`[AnyTrack Webhook] Complete: ${processed} processed, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        errors,
        message: `Processed ${processed} events from AnyTrack`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[AnyTrack Webhook] Fatal error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
