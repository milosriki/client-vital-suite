import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

// SHA-256 hash function for PII (Meta CAPI requirement)
async function hashPII(value: string | null | undefined): Promise<string | null> {
  if (!value || value.trim() === "") return null;

  // Normalize: lowercase and trim
  const normalized = value.toLowerCase().trim();

  // Create SHA-256 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Normalize phone number before hashing
async function hashPhone(phone: string | null | undefined): Promise<string | null> {
  if (!phone) return null;
  // Remove all non-digit characters
  const normalized = phone.replace(/\D/g, "");
  if (normalized.length === 0) return null;
  return hashPII(normalized);
}

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

      // Hash PII for Meta CAPI compliance
      const hashedEmail = await hashPII(props.email);
      const hashedPhone = await hashPhone(props.phone);
      const hashedFirstName = await hashPII(props.firstname);
      const hashedLastName = await hashPII(props.lastname);
      const hashedCity = await hashPII(props.city);
      const hashedState = await hashPII(props.state);
      const hashedZip = await hashPII(props.zip);

      events.push({
        event_id: eventId,
        event_name: eventName,
        event_time: eventTime,
        email_hash: hashedEmail,
        phone_hash: hashedPhone,
        first_name_hash: hashedFirstName,
        last_name_hash: hashedLastName,
        city_hash: hashedCity,
        state_hash: hashedState,
        country: props.country || 'ae',
        zip_code_hash: hashedZip,
        hubspot_contact_id: contact.id,
        lifecycle_stage: lifecycleStage,
        lead_source: props.hs_analytics_source,
        original_source: props.hs_analytics_first_url,
        event_source_url: props.hs_analytics_first_url || 'https://www.personaltrainersdubai.com',
        action_source: 'website',
        currency: 'AED',
        batch_scheduled_for: batch_scheduled_for || null,
        send_status: 'pending',
        mode: mode,
        // Store raw payload without PII for debugging
        raw_payload: {
          ...contact,
          properties: {
            ...props,
            email: '[REDACTED]',
            phone: '[REDACTED]',
            firstname: '[REDACTED]',
            lastname: '[REDACTED]'
          }
        },
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
