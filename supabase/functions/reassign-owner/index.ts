import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HUBSPOT_API_KEY = Deno.env.get('HUBSPOT_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!HUBSPOT_API_KEY) {
      throw new Error('HUBSPOT_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { contact_id, new_owner_id, reason, old_owner_id } = await req.json();

    if (!contact_id || !new_owner_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: contact_id and new_owner_id are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Reassign Owner] Reassigning contact ${contact_id} to owner ${new_owner_id}`);

    // Update owner in HubSpot
    const hubspotResponse = await fetch(
      `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/${contact_id}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            hubspot_owner_id: new_owner_id
          }
        })
      }
    );

    if (!hubspotResponse.ok) {
      const errorData = await hubspotResponse.json();
      throw new Error(`HubSpot API error: ${JSON.stringify(errorData)}`);
    }

    const hubspotData = await hubspotResponse.json();
    console.log(`[Reassign Owner] Success: ${contact_id} → ${new_owner_id}`);

    // Log reassignment in Supabase
    try {
      await supabase.from('reassignment_log').insert({
        contact_id: contact_id.toString(),
        hubspot_contact_id: contact_id.toString(),
        old_owner_id: old_owner_id || null,
        new_owner_id: new_owner_id.toString(),
        reason: reason || 'MANUAL_REASSIGNMENT',
        reassigned_at: new Date().toISOString(),
        status: 'success'
      });
    } catch (logError) {
      console.warn('[Reassign Owner] Failed to log reassignment:', logError);
      // Continue even if logging fails
    }

    // Update contact in Supabase if exists
    try {
      await supabase
        .from('contacts')
        .update({ owner_id: new_owner_id.toString() })
        .eq('hubspot_contact_id', contact_id.toString());
    } catch (updateError) {
      console.warn('[Reassign Owner] Failed to update Supabase contact:', updateError);
      // Continue even if update fails
    }

    return new Response(JSON.stringify({
      success: true,
      contact_id,
      old_owner_id: old_owner_id || null,
      new_owner_id,
      reason: reason || 'MANUAL_REASSIGNMENT',
      hubspot_response: hubspotData,
      reassigned_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Reassign Owner] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
