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
    const { contact_ids, batch_scheduled_for, mode = 'test' } = await req.json();
    
    const HUBSPOT_API_KEY = Deno.env.get('HUBSPOT_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!HUBSPOT_API_KEY || !supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Syncing HubSpot contacts to CAPI events:', {
      count: contact_ids?.length || 'all recent',
      mode
    });

    // Fetch contacts from HubSpot
    const fetchUrl = contact_ids && contact_ids.length > 0
      ? `https://api.hubapi.com/crm/v3/objects/contacts/batch/read`
      : `https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=email,phone,firstname,lastname,lifecyclestage,hs_lead_status,city,state,country,zip,createdate,hs_analytics_source,hs_analytics_first_url`;

    const hubspotOptions: any = {
      method: contact_ids ? 'POST' : 'GET',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    if (contact_ids && contact_ids.length > 0) {
      hubspotOptions.body = JSON.stringify({
        inputs: contact_ids.map((id: string) => ({ id })),
        properties: [
          'email', 'phone', 'firstname', 'lastname', 'lifecyclestage',
          'hs_lead_status', 'city', 'state', 'country', 'zip',
          'createdate', 'hs_analytics_source', 'hs_analytics_first_url'
        ]
      });
    }

    const hubspotResponse = await fetch(fetchUrl, hubspotOptions);
    const hubspotData = await hubspotResponse.json();

    if (!hubspotResponse.ok) {
      throw new Error(`HubSpot API error: ${JSON.stringify(hubspotData)}`);
    }

    const contacts = contact_ids ? hubspotData.results : hubspotData.results;
    const events: any[] = [];

    // Map HubSpot contacts to CAPI events
    for (const contact of contacts) {
      const props = contact.properties;
      const lifecycleStage = props.lifecyclestage;

      // Determine Meta event name based on lifecycle stage
      let eventName = 'Lead';
      if (lifecycleStage === 'customer') eventName = 'Purchase';
      else if (lifecycleStage === 'opportunity') eventName = 'InitiateCheckout';
      else if (lifecycleStage === 'marketingqualifiedlead' || lifecycleStage === 'salesqualifiedlead') eventName = 'Lead';

      const eventTime = props.createdate || new Date().toISOString();
      const eventId = `hubspot_${contact.id}_${Date.now()}`;

      events.push({
        event_id: eventId,
        event_name: eventName,
        event_time: eventTime,
        email: props.email,
        phone: props.phone,
        first_name: props.firstname,
        last_name: props.lastname,
        city: props.city,
        state: props.state,
        country: props.country || 'ae',
        zip_code: props.zip,
        hubspot_contact_id: contact.id,
        lifecycle_stage: lifecycleStage,
        lead_source: props.hs_analytics_source,
        original_source: props.hs_analytics_first_url,
        event_source_url: props.hs_analytics_first_url || 'https://ptdfitness.com',
        action_source: 'website',
        currency: 'AED',
        batch_scheduled_for: batch_scheduled_for || null,
        send_status: 'pending',
        mode: mode,
        raw_payload: contact,
      });
    }

    // Insert events into database
    const { data, error } = await supabase
      .from('capi_events_enriched')
      .upsert(events, { onConflict: 'event_id', ignoreDuplicates: false });

    if (error) {
      console.error('Error inserting events:', error);
      throw error;
    }

    console.log('Successfully synced events:', events.length);

    return new Response(
      JSON.stringify({
        success: true,
        events_synced: events.length,
        events: events.map(e => ({ event_id: e.event_id, event_name: e.event_name }))
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in sync-hubspot-to-capi:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
