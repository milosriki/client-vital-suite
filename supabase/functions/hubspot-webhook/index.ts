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

serve(async (req) => {
  const FUNCTION_NAME = "hubspot-webhook";

  if (req.method === 'OPTIONS') {
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    supabase = createClient(supabaseUrl, supabaseKey);

    // Parse the incoming webhook payload with error handling
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

    const payload = parseResult.data;
    console.log('Received HubSpot Webhook:', JSON.stringify(payload, null, 2));

    // Handle array of events (HubSpot sends batches)
    const events = Array.isArray(payload) ? payload : [payload];
    const results = { processed: 0, errors: 0 };

    for (const event of events) {
      try {
        const { subscriptionType, objectId, propertyName, propertyValue, occurredAt } = event;

        // 1. Handle Contact Creation
        if (subscriptionType === 'contact.creation') {
          await supabase.from('contacts').upsert({
            hubspot_contact_id: objectId,
            created_at: new Date(occurredAt).toISOString(),
            status: 'new'
          }, { onConflict: 'hubspot_contact_id' });
        }

        // 2. Handle Deal Creation
        else if (subscriptionType === 'deal.creation') {
          await supabase.from('deals').upsert({
            hubspot_deal_id: objectId,
            created_at: new Date(occurredAt).toISOString(),
            status: 'new'
          }, { onConflict: 'hubspot_deal_id' });
        }

        // 3. Handle Lifecycle Stage Changes
        else if (subscriptionType === 'contact.propertyChange' && propertyName === 'lifecyclestage') {
          await supabase.from('contacts').update({
            lifecycle_stage: propertyValue,
            updated_at: new Date().toISOString()
          }).eq('hubspot_contact_id', objectId);
        }

        // 4. Handle Deal Stage Changes
        else if (subscriptionType === 'deal.propertyChange' && propertyName === 'dealstage') {
          await supabase.from('deals').update({
            stage: propertyValue,
            updated_at: new Date().toISOString()
          }).eq('hubspot_deal_id', objectId);
        }

        // Log the raw event for debugging/audit
        await supabase.from('webhook_logs').insert({
          source: 'hubspot',
          event_type: subscriptionType,
          payload: event,
          processed_at: new Date().toISOString()
        });

        results.processed++;
      } catch (err) {
        console.error('Error processing event:', err);
        results.errors++;
        // Log individual event processing error
        await handleError(
          err as Error,
          FUNCTION_NAME,
          {
            supabase,
            errorCode: ErrorCode.DATABASE_ERROR,
            context: {
              subscriptionType: event.subscriptionType,
              objectId: event.objectId,
              operation: "process_event"
            },
          }
        );
      }
    }

    const successResponse = createSuccessResponse({
      ...results,
      totalEvents: events.length,
    });

    return new Response(JSON.stringify(successResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    // Determine appropriate error code
    let errorCode = ErrorCode.INTERNAL_ERROR;

    if (error.message?.includes("HubSpot")) {
      errorCode = ErrorCode.HUBSPOT_API_ERROR;
    } else if (error.message?.includes("database") || error.message?.includes("insert")) {
      errorCode = ErrorCode.DATABASE_ERROR;
    } else if (error.message?.includes("JSON") || error.message?.includes("parse")) {
      errorCode = ErrorCode.VALIDATION_ERROR;
    }

    return handleError(
      error,
      FUNCTION_NAME,
      {
        supabase,
        errorCode,
        context: { method: req.method },
      }
    );
  }
});
