import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleError,
  createSuccessResponse,
  handleCorsPreFlight,
  corsHeaders,
  ErrorCode,
  validateEnvVars,
  parseJsonSafely,
} from "../_shared/error-handler.ts";

// AnyTrack Webhook Receiver - syncs conversion events to Supabase
serve(async (req) => {
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

    return new Response(
      JSON.stringify(successResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

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
