import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse the incoming webhook payload
    const payload = await req.json();
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
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
