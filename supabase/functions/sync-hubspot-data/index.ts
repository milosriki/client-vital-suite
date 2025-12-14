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
    const HUBSPOT_API_KEY = Deno.env.get('HUBSPOT_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!HUBSPOT_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const syncStartTime = new Date().toISOString();
    let syncStats = {
      contacts: { synced: 0, errors: 0 },
      deals: { synced: 0, errors: 0 },
      appointments: { synced: 0, errors: 0 },
    };

    console.log('🔄 Starting HubSpot → Supabase sync...');

    // 1. SYNC CONTACTS
    console.log('📇 Syncing contacts...');
    try {
      const contactsResponse = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,hubspot_owner_id,lifecyclestage,hs_lead_status,createdate,lastmodifieddate,notes_last_contacted,assigned_coach',
        {
          headers: {
            'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json();

        for (const contact of contactsData.results) {
          const props = contact.properties;

          const { error } = await supabase
            .from('contacts')
            .upsert({
              hubspot_contact_id: contact.id,
              email: props.email || null,
              first_name: props.firstname || null,
              last_name: props.lastname || null,
              phone: props.phone || null,
              owner_id: props.hubspot_owner_id || null,
              lifecycle_stage: props.lifecyclestage || null,
              status: props.hs_lead_status || null,
              created_at: props.createdate ? new Date(parseInt(props.createdate)).toISOString() : null,
            }, {
              onConflict: 'hubspot_contact_id'
            });

          if (error) {
            console.error(`Error syncing contact ${contact.id}:`, error);
            syncStats.contacts.errors++;
          } else {
            syncStats.contacts.synced++;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }

    // 2. SYNC DEALS
    console.log('💼 Syncing deals...');
    try {
      const dealsResponse = await fetch(
        'https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage,closedate,hubspot_owner_id,pipeline,createdate,deal_probability,deal_currency,contact_email',
        {
          headers: {
            'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (dealsResponse.ok) {
        const dealsData = await dealsResponse.json();

        for (const deal of dealsData.results) {
          const props = deal.properties;

          const { error } = await supabase
            .from('deals')
            .upsert({
              hubspot_deal_id: deal.id,
              deal_name: props.dealname || null,
              deal_value: props.amount ? parseFloat(props.amount) : 0,
              value_aed: props.amount ? parseFloat(props.amount) : null,
              stage: props.dealstage || null,
              close_date: props.closedate ? new Date(parseInt(props.closedate)).toISOString() : null,
              closer_id: props.hubspot_owner_id || null,
              pipeline: props.pipeline || null,
              created_at: props.createdate ? new Date(parseInt(props.createdate)).toISOString() : null,
            }, {
              onConflict: 'hubspot_deal_id'
            });

          if (error) {
            console.error(`Error syncing deal ${deal.id}:`, error);
            syncStats.deals.errors++;
          } else {
            syncStats.deals.synced++;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching deals:', error);
    }

    // 3. SYNC APPOINTMENTS (Meetings)
    console.log('📅 Syncing appointments...');
    try {
      const meetingsResponse = await fetch(
        'https://api.hubapi.com/crm/v3/objects/meetings?limit=100&properties=hs_meeting_title,hs_meeting_start_time,hs_meeting_end_time,hs_meeting_outcome,hs_meeting_body,hubspot_owner_id,createdate',
        {
          headers: {
            'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (meetingsResponse.ok) {
        const meetingsData = await meetingsResponse.json();

        for (const meeting of meetingsData.results) {
          const props = meeting.properties;

          const { error} = await supabase
            .from('appointments')
            .upsert({
              scheduled_at: props.hs_meeting_start_time ? new Date(parseInt(props.hs_meeting_start_time)).toISOString() : new Date().toISOString(),
              notes: `${props.hs_meeting_title || 'Meeting'}\n${props.hs_meeting_body || ''}`,
              status: props.hs_meeting_outcome || 'scheduled',
              created_at: props.createdate ? new Date(parseInt(props.createdate)).toISOString() : null,
            });

          if (error) {
            console.error(`Error syncing meeting ${meeting.id}:`, error);
            syncStats.appointments.errors++;
          } else {
            syncStats.appointments.synced++;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
    }

    // 4. LOG SYNC RESULTS
    const syncEndTime = new Date().toISOString();
    await supabase
      .from('sync_logs')
      .insert({
        sync_type: 'hubspot_full_sync',
        started_at: syncStartTime,
        completed_at: syncEndTime,
        status: 'completed',
        records_synced: syncStats.contacts.synced + syncStats.deals.synced + syncStats.appointments.synced,
        records_failed: syncStats.contacts.errors + syncStats.deals.errors + syncStats.appointments.errors,
        sync_details: syncStats,
      });

    console.log('✅ Sync complete:', syncStats);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'HubSpot sync completed',
        stats: syncStats,
        duration: new Date(syncEndTime).getTime() - new Date(syncStartTime).getTime()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
