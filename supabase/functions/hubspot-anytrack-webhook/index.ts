import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HubSpot Native AnyTrack Webhook Receiver
// HubSpot sends webhooks when AnyTrack events occur (when AnyTrack is connected natively in HubSpot)
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[HubSpot AnyTrack Webhook] Received request");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    console.log("[HubSpot AnyTrack Webhook] Payload:", JSON.stringify(body).slice(0, 500));

    // HubSpot sends webhook events for contacts/deals when AnyTrack events occur
    const events = Array.isArray(body) ? body : [body];
    let processed = 0;
    let errors = 0;

    for (const event of events) {
      try {
        // HubSpot webhook structure for AnyTrack events
        const subscriptionType = event.subscriptionType;
        const objectId = event.objectId;
        const properties = event.properties || {};
        
        // Extract AnyTrack attribution data from HubSpot properties
        const anytrackData = {
          event_id: `hubspot_anytrack_${objectId}_${Date.now()}`,
          event_name: mapHubspotEventToAnyTrack(subscriptionType, properties),
          event_time: new Date().toISOString(),
          source: "hubspot_anytrack", // Native HubSpot + AnyTrack integration
          status: "completed",
          user_data: {
            em: properties.email || null,
            ph: properties.phone || null,
            fn: properties.firstname || null,
            ln: properties.lastname || null,
            external_id: objectId, // HubSpot contact/deal ID
          },
          custom: {
            value: parseFloat(properties.amount || properties.total_revenue || 0),
            currency: "AED",
            transaction_id: properties.hs_deal_amount || null,
            order_id: objectId,
            // Extract AnyTrack attribution from HubSpot custom properties
            source_attribution: properties.hs_analytics_source || 
                               properties.first_touch_source || 
                               properties.latest_traffic_source || null,
            medium: properties.hs_analytics_medium || null,
            campaign: extractCampaignName(properties),
            gclid: properties.gclid || null,
            fbclid: properties.fbclid || properties.hs_analytics_first_touch_converting_campaign || null,
            click_id: properties.click_id || null,
            // Facebook campaign data
            fb_campaign_id: extractFBCampaignId(properties),
            fb_ad_id: extractFBAdId(properties),
            fb_adset_id: extractFBAdsetId(properties),
          },
          meta: {
            hubspot_contact_id: subscriptionType.includes("contact") ? objectId : null,
            hubspot_deal_id: subscriptionType.includes("deal") ? objectId : null,
            lifecycle_stage: properties.lifecyclestage || null,
            lead_status: properties.hs_lead_status || null,
            integration_id: "hubspot-native-anytrack",
            tracking_group: "hubspot",
            attributions: parseAttributions(properties),
          },
        };

        // Insert into events table
        const { error: eventError } = await supabase
          .from("events")
          .upsert(anytrackData, { onConflict: "event_id,source" });

        if (eventError) {
          console.error("[HubSpot AnyTrack Webhook] Event insert error:", eventError);
          errors++;
          continue;
        }

        // Create attribution event for conversion tracking
        if (isConversionEvent(subscriptionType, properties)) {
          const attributionData = {
            event_id: anytrackData.event_id,
            event_name: anytrackData.event_name,
            event_time: anytrackData.event_time,
            email: anytrackData.user_data.em,
            first_name: anytrackData.user_data.fn,
            last_name: anytrackData.user_data.ln,
            value: anytrackData.custom.value,
            currency: anytrackData.custom.currency,
            source: anytrackData.custom.source_attribution || "hubspot",
            medium: anytrackData.custom.medium || null,
            campaign: anytrackData.custom.campaign || null,
            utm_source: anytrackData.custom.source_attribution || null,
            utm_medium: anytrackData.custom.medium || null,
            utm_campaign: anytrackData.custom.campaign || null,
            platform: "hubspot_anytrack",
            // Facebook campaign tracking
            fb_campaign_id: anytrackData.custom.fb_campaign_id,
            fb_ad_id: anytrackData.custom.fb_ad_id,
            fb_adset_id: anytrackData.custom.fb_adset_id,
          };

          await supabase
            .from("attribution_events")
            .upsert(attributionData, { onConflict: "event_id" });
        }

        // Update contact with attribution data
        if (subscriptionType.includes("contact") && anytrackData.user_data.em) {
          await supabase
            .from("contacts")
            .upsert({
              email: anytrackData.user_data.em,
              first_name: anytrackData.user_data.fn,
              last_name: anytrackData.user_data.ln,
              hubspot_contact_id: objectId,
              first_touch_source: anytrackData.custom.source_attribution || null,
              latest_traffic_source: anytrackData.custom.source_attribution || null,
              total_events: 1,
              total_value: anytrackData.custom.value || 0,
            }, { onConflict: "email" });
        }

        processed++;
        console.log(`[HubSpot AnyTrack Webhook] Processed ${subscriptionType} event: ${anytrackData.event_id}`);

      } catch (e) {
        console.error("[HubSpot AnyTrack Webhook] Error processing event:", e);
        errors++;
      }
    }

    console.log(`[HubSpot AnyTrack Webhook] Complete: ${processed} processed, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        errors,
        message: `Processed ${processed} events from HubSpot AnyTrack`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[HubSpot AnyTrack Webhook] Fatal error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Map HubSpot subscription type to AnyTrack event name
function mapHubspotEventToAnyTrack(subscriptionType: string, properties: any): string {
  if (subscriptionType.includes("deal")) {
    if (properties.dealstage?.includes("closedwon")) return "Purchase";
    if (properties.dealstage?.includes("closedlost")) return "DealLost";
    return "DealNew";
  }
  
  if (subscriptionType.includes("contact")) {
    const lifecycle = properties.lifecyclestage?.toLowerCase();
    if (lifecycle === "customer") return "Purchase";
    if (lifecycle === "opportunity") return "InitiateCheckout";
    if (lifecycle === "salesqualifiedlead") return "Lead";
    if (lifecycle === "marketingqualifiedlead") return "Lead";
    if (subscriptionType.includes("creation")) return "Lead";
    return "Lead";
  }
  
  return "Unknown";
}

// Extract campaign name from HubSpot properties
function extractCampaignName(properties: any): string | null {
  return properties.hs_analytics_first_touch_converting_campaign ||
         properties.hs_analytics_last_touch_converting_campaign ||
         properties.utm_campaign ||
         properties.campaign ||
         null;
}

// Extract Facebook campaign ID from properties
function extractFBCampaignId(properties: any): string | null {
  // Check various property names HubSpot might use for FB campaign ID
  return properties.fb_campaign_id ||
         properties.facebook_campaign_id ||
         properties.hs_analytics_campaign_id ||
         extractFromFBClickId(properties.fbclid) ||
         null;
}

// Extract Facebook ad ID
function extractFBAdId(properties: any): string | null {
  return properties.fb_ad_id ||
         properties.facebook_ad_id ||
         properties.hs_analytics_ad_id ||
         null;
}

// Extract Facebook adset ID
function extractFBAdsetId(properties: any): string | null {
  return properties.fb_adset_id ||
         properties.facebook_adset_id ||
         properties.hs_analytics_adset_id ||
         null;
}

// Parse attributions array from HubSpot properties
function parseAttributions(properties: any): any[] {
  try {
    if (properties.attributions) {
      return typeof properties.attributions === 'string' 
        ? JSON.parse(properties.attributions)
        : properties.attributions;
    }
    return [];
  } catch {
    return [];
  }
}

// Extract campaign ID from fbclid (if encoded)
function extractFromFBClickId(fbclid: string | null): string | null {
  if (!fbclid) return null;
  // fbclid format: fb.1.{timestamp}.{campaign_id}
  const parts = fbclid.split('.');
  return parts.length > 3 ? parts[3] : null;
}

// Check if event is a conversion event
function isConversionEvent(subscriptionType: string, properties: any): boolean {
  const eventName = mapHubspotEventToAnyTrack(subscriptionType, properties);
  return ["Purchase", "Lead", "InitiateCheckout", "CompleteRegistration"].includes(eventName);
}
