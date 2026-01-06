import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
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
import {
  recordUpdateSource,
} from "../_shared/circuit-breaker.ts";

serve(async (req) => {
  const FUNCTION_NAME = "hubspot-webhook";

  if (req.method === 'OPTIONS') {
    return handleCorsPreFlight();
  }

  let supabase = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    supabase = createClient(supabaseUrl, supabaseKey);

    const parseResult = await parseJsonSafely(req, FUNCTION_NAME);
    if (!parseResult.success) {
      return handleError(parseResult.error, FUNCTION_NAME, { supabase, errorCode: ErrorCode.VALIDATION_ERROR });
    }

    const payload = parseResult.data;
    const events = Array.isArray(payload) ? payload : [payload];
    const results = { processed: 0, errors: 0 };

    for (const event of events) {
      try {
        const { subscriptionType, objectId, propertyName, propertyValue, occurredAt } = event;
        const hubspotId = objectId?.toString();

        // 1. Handle Contact Creation
        if (subscriptionType === 'contact.creation') {
          // Just insert minimal record, the sync function will enrich it
          await supabase.from('contacts').upsert({
            hubspot_contact_id: hubspotId,
            created_at: new Date(occurredAt).toISOString(),
            status: 'new'
          }, { onConflict: 'hubspot_contact_id' });
          
          await supabase.from('leads').upsert({
            hubspot_id: hubspotId,
            source: 'hubspot',
            status: 'new',
            created_at: new Date(occurredAt).toISOString()
          }, { onConflict: 'hubspot_id' });
        }

        // 2. Handle Property Changes
        else if (subscriptionType === 'contact.propertyChange') {
          const updateObj: Record<string, any> = { updated_at: new Date().toISOString() };
          const leadUpdateObj: Record<string, any> = { updated_at: new Date().toISOString() };

          if (propertyName === 'assigned_coach') {
            updateObj.assigned_coach = propertyValue;
            leadUpdateObj.assigned_coach = propertyValue;
          } else if (propertyName === 'hubspot_owner_id') {
            updateObj.owner_id = propertyValue;
            leadUpdateObj.owner_id = propertyValue;
          } else if (propertyName === 'lifecyclestage') {
            updateObj.lifecycle_stage = propertyValue;
            // Also map to lead status
            if (propertyValue === 'customer') leadUpdateObj.status = 'closed';
          } else if (propertyName === 'email') {
            updateObj.email = propertyValue;
            leadUpdateObj.email = propertyValue;
          }

          if (Object.keys(updateObj).length > 1) {
            await supabase.from('contacts').update(updateObj).eq('hubspot_contact_id', hubspotId);
            await supabase.from('leads').update(leadUpdateObj).eq('hubspot_id', hubspotId);
          }
        }

        // 3. Handle Deal Changes
        else if (subscriptionType === 'deal.propertyChange' && propertyName === 'dealstage') {
          await supabase.from('deals').update({
            stage: propertyValue,
            status: propertyValue?.includes('closedwon') ? 'closed' : 'pending',
            updated_at: new Date().toISOString()
          }).eq('hubspot_deal_id', hubspotId);
        }

        results.processed++;
      } catch (err) {
        console.error('Error processing event:', err);
        results.errors++;
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});