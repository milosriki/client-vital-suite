import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import {
  handleError,
  createSuccessResponse,
  handleCorsPreFlight,
  corsHeaders,
  ErrorCode,
  validateEnvVars,
  parseJsonSafely,
} from "../_shared/error-handler.ts";

// Parse Facebook ad parameters from landing page URLs
// AnyTrack stores the full landing URL in event.location which contains
// ad_id=, adset_id=, hsa_cam= (campaign ID), utm_source, etc.
function parseFbParamsFromUrl(url: string | null | undefined): {
  ad_id: string | null;
  adset_id: string | null;
  campaign_id: string | null;
} {
  if (!url) return { ad_id: null, adset_id: null, campaign_id: null };
  try {
    const parsed = new URL(url);
    return {
      ad_id: parsed.searchParams.get("ad_id") || null,
      adset_id: parsed.searchParams.get("adset_id") || null,
      campaign_id: parsed.searchParams.get("utm_id")
        || parsed.searchParams.get("hsa_cam")
        || parsed.searchParams.get("campaign_id")
        || null,
    };
  } catch {
    // Malformed URL — try regex fallback
    const adMatch = url.match(/[?&]ad_id=([^&]+)/);
    const adsetMatch = url.match(/[?&]adset_id=([^&]+)/);
    const campMatch = url.match(/[?&](?:utm_id|hsa_cam|campaign_id)=([^&]+)/);
    return {
      ad_id: adMatch?.[1] || null,
      adset_id: adsetMatch?.[1] || null,
      campaign_id: campMatch?.[1] || null,
    };
  }
}

// AnyTrack Webhook Receiver - syncs conversion events to Supabase
serve(async (req) => {
  // Webhook endpoint — external service, no JWT auth (verify_jwt=false in config.toml)
  const FUNCTION_NAME = "anytrack-webhook";

  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  let supabase = null;

  try {
    // Validate required environment variables
    const envValidation = validateEnvVars(
      ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
      FUNCTION_NAME
    );

    if (!envValidation.valid) {
      return handleError(
        new Error(`Missing required environment variables: ${envValidation.missing.join(", ")}`),
        FUNCTION_NAME,
        {
          errorCode: ErrorCode.MISSING_API_KEY,
          context: { missingVars: envValidation.missing },
        }
      );
    }

    console.log("[AnyTrack Webhook] Received request");

    supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse request body with error handling
    const parseResult = await parseJsonSafely(req, FUNCTION_NAME);
    if (!parseResult.success) {
      return handleError(
        parseResult.error,
        FUNCTION_NAME,
        {
          supabase,
          errorCode: ErrorCode.VALIDATION_ERROR,
          context: { parseError: parseResult.error.message },
        }
      );
    }

    const body = parseResult.data;
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
          // Log individual event error to sync_errors
          await handleError(
            eventError,
            FUNCTION_NAME,
            {
              supabase,
              errorCode: ErrorCode.DATABASE_ERROR,
              context: {
                operation: "insert_event",
                event_id: eventData.event_id,
                event_name: eventData.event_name,
              },
            }
          );
          continue;
        }

        // Also create/update attribution event for journey tracking
        // EXPANDED: Include OutboundClick (has ad_id in URL/attributions) + PageView for full funnel
        const ATTRIBUTION_EVENTS = [
          "Purchase", "Lead", "CompleteRegistration", "OutboundClick", "PageView",
          "FormSubmit", "CrmLeadCrmLead", "DealNew", "salesqualifiedlead",
          "marketingqualifiedlead", "Schedule", "customer"
        ];
        if (ATTRIBUTION_EVENTS.includes(event.eventName)) {
          // Extract real Facebook ad/adset/campaign IDs
          // Priority: 1) attributions[0].params (most reliable), 2) landing page URL params
          const fbParams = parseFbParamsFromUrl(event.location);

          // AnyTrack also puts ad params in attributions[0].params — often more reliable
          const attrParams = event.attributions?.[0]?.params || {};
          if (!fbParams.ad_id && attrParams.ad_id) fbParams.ad_id = attrParams.ad_id;
          if (!fbParams.adset_id && attrParams.adset_id) fbParams.adset_id = attrParams.adset_id;
          if (!fbParams.campaign_id) {
            fbParams.campaign_id = attrParams.utm_id || attrParams.hsa_cam || attrParams.campaign_id || fbParams.campaign_id;
          }

          const attributionData = {
            event_id: eventData.event_id,
            event_name: eventData.event_name,
            event_time: eventData.event_time,
            email: eventData.user_data.em,
            phone: eventData.user_data.ph,
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
            // Facebook ad IDs — parsed from landing page URL params (ad_id=, adset_id=, hsa_cam=)
            fb_ad_id: fbParams.ad_id,
            fb_campaign_id: fbParams.campaign_id,
            fb_adset_id: fbParams.adset_id,
            fb_campaign_name: event.mainAttribution?.campaign || null,
            fb_ad_name: event.adName || null,
            fb_adset_name: event.adSetName || null,
          };

          await supabase
            .from("attribution_events")
            .upsert(attributionData, { onConflict: "event_id" });

          // ATTRIBUTION LINKING: When a Lead/CompleteRegistration has no ad_id,
          // look for a recent OutboundClick from the same contact and inherit its attribution
          if ((event.eventName === "Lead" || event.eventName === "CompleteRegistration") && !fbParams.ad_id) {
            const contactIdentifier = eventData.user_data.em || eventData.user_data.ph;
            if (contactIdentifier) {
              const identifierField = eventData.user_data.em ? "email" : "phone";
              
              // Strategy 1: Check attribution_events for OutboundClick with fb_ad_id
              const { data: clickAttribution } = await supabase
                .from("attribution_events")
                .select("fb_ad_id, fb_adset_id, fb_campaign_id, fb_campaign_name, fb_ad_name, fb_adset_name, landing_page")
                .eq(identifierField, contactIdentifier)
                .eq("event_name", "OutboundClick")
                .not("fb_ad_id", "is", null)
                .order("event_time", { ascending: false })
                .limit(1);

              let linkedAttribution = clickAttribution?.[0] || null;

              // Strategy 2: Fallback to events table — find any event with location containing ad_id
              if (!linkedAttribution) {
                const locationField = identifierField === "email" ? "user_data->>'em'" : "user_data->>'ph'";
                const { data: rawEvents } = await supabase
                  .from("events")
                  .select("meta")
                  .filter(locationField, "eq", contactIdentifier)
                  .filter("meta->>'location'", "ilike", "%ad_id=%")
                  .order("event_time", { ascending: false })
                  .limit(1);

                if (rawEvents?.[0]?.meta?.location) {
                  const extracted = parseFbParamsFromUrl(rawEvents[0].meta.location);
                  if (extracted.ad_id) {
                    linkedAttribution = {
                      fb_ad_id: extracted.ad_id,
                      fb_adset_id: extracted.adset_id,
                      fb_campaign_id: extracted.campaign_id,
                      fb_campaign_name: null,
                      fb_ad_name: null,
                      fb_adset_name: null,
                      landing_page: rawEvents[0].meta.location,
                    };
                    console.log(`[AnyTrack] Found attribution from events table for ${contactIdentifier}`);
                  }
                }
              }

              if (linkedAttribution) {
                console.log(`[AnyTrack] Linking ${event.eventName} to attribution for ${contactIdentifier}`);
                await supabase
                  .from("attribution_events")
                  .update({
                    fb_ad_id: linkedAttribution.fb_ad_id,
                    fb_adset_id: linkedAttribution.fb_adset_id,
                    fb_campaign_id: linkedAttribution.fb_campaign_id,
                    fb_campaign_name: linkedAttribution.fb_campaign_name,
                    fb_ad_name: linkedAttribution.fb_ad_name,
                    fb_adset_name: linkedAttribution.fb_adset_name,
                  })
                  .eq("event_id", eventData.event_id);

                // Also update the contact record with attribution
                if (eventData.user_data.em) {
                  await supabase
                    .from("contacts")
                    .update({
                      attributed_ad_id: linkedAttribution.fb_ad_id,
                      attributed_campaign_id: linkedAttribution.fb_campaign_id,
                      attribution_source: "anytrack_linked",
                    })
                    .eq("email", eventData.user_data.em);
                }
              }
            }
          }
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
            // Use upsert with email as conflict key to prevent duplicates
            // This ensures AnyTrack contacts don't create orphan records without hubspot_contact_id
            const { error: upsertError } = await supabase
              .from("contacts")
              .upsert({
                ...contactData,
                updated_at: new Date().toISOString(),
              }, { 
                onConflict: 'email',
                ignoreDuplicates: false 
              });
            
            if (upsertError) {
              console.warn(`[AnyTrack Webhook] Contact upsert warning for ${contactData.email}:`, upsertError.message);
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

    const successResponse = createSuccessResponse({
      processed,
      errors,
      totalEvents: events.length,
      message: `Processed ${processed} events from AnyTrack`,
    });

    return apiSuccess(successResponse);

  } catch (error: unknown) {
    // Determine appropriate error code
    let errorCode = ErrorCode.INTERNAL_ERROR;

    if (error instanceof Error) {
      if (error.message?.includes("database") || error.message?.includes("insert")) {
        errorCode = ErrorCode.DATABASE_ERROR;
      } else if (error.message?.includes("JSON") || error.message?.includes("parse")) {
        errorCode = ErrorCode.VALIDATION_ERROR;
      }
    }

    return handleError(
      error as Error,
      FUNCTION_NAME,
      {
        supabase: supabase ?? undefined,
        errorCode,
        context: { method: req.method },
      }
    );
  }
});
