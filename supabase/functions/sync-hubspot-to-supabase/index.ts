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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!HUBSPOT_API_KEY) {
      throw new Error('HUBSPOT_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { clear_fake_data = false, sync_type = 'all' } = await req.json().catch(() => ({}));

    const results = {
      contacts_synced: 0,
      leads_synced: 0,
      deals_synced: 0,
      calls_synced: 0,
      errors: [] as string[]
    };

    // Clear fake/test data if requested
    if (clear_fake_data) {
      console.log('Clearing fake data...');
      
      // Delete leads with example.com emails or test phone numbers
      await supabase
        .from('leads')
        .delete()
        .or('email.ilike.%@example.com,phone.ilike.%555-0%');
      
      // Delete contacts with example.com emails
      await supabase
        .from('contacts')
        .delete()
        .ilike('email', '%@example.com');
        
      console.log('Fake data cleared');
    }

    // Fetch owners for mapping
    const ownersResponse = await fetch('https://api.hubapi.com/crm/v3/owners', {
      headers: { 'Authorization': `Bearer ${HUBSPOT_API_KEY}` }
    });
    
    let ownerMap: Record<string, string> = {};
    if (ownersResponse.ok) {
      const ownersData = await ownersResponse.json();
      ownerMap = Object.fromEntries(
        ownersData.results.map((o: any) => [o.id, `${o.firstName} ${o.lastName}`])
      );
    }

    // Sync Contacts
    if (sync_type === 'all' || sync_type === 'contacts') {
      console.log('Syncing contacts from HubSpot...');
      
      const contactsResponse = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts/search',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filterGroups: [],
            properties: [
              'firstname', 'lastname', 'email', 'phone', 'mobilephone',
              'hubspot_owner_id', 'lifecyclestage', 'hs_lead_status',
              'createdate', 'lastmodifieddate', 'city'
            ],
            sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
            limit: 100
          })
        }
      );

      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json();
        
        for (const contact of contactsData.results) {
          const props = contact.properties;
          
          // Skip if no email
          if (!props.email) continue;
          
          // Upsert into contacts table
          const { error } = await supabase
            .from('contacts')
            .upsert({
              hubspot_contact_id: contact.id,
              email: props.email,
              first_name: props.firstname,
              last_name: props.lastname,
              phone: props.phone || props.mobilephone,
              owner_id: props.hubspot_owner_id,
              lifecycle_stage: props.lifecyclestage,
              status: props.hs_lead_status || 'active',
              city: props.city,
              created_at: props.createdate,
              updated_at: props.lastmodifieddate || new Date().toISOString()
            }, { 
              onConflict: 'hubspot_contact_id',
              ignoreDuplicates: false 
            });

          if (error) {
            // Try insert with email conflict handling
            const { error: insertError } = await supabase
              .from('contacts')
              .insert({
                hubspot_contact_id: contact.id,
                email: props.email,
                first_name: props.firstname,
                last_name: props.lastname,
                phone: props.phone || props.mobilephone,
                owner_id: props.hubspot_owner_id,
                lifecycle_stage: props.lifecyclestage,
                status: props.hs_lead_status || 'active',
                city: props.city
              });
            
            if (insertError && !insertError.message.includes('duplicate')) {
              results.errors.push(`Contact ${props.email}: ${insertError.message}`);
            }
          } else {
            results.contacts_synced++;
          }

          // Also sync to leads table for pipeline visibility
          const leadStatus = mapHubspotStatusToLead(props.lifecyclestage, props.hs_lead_status);
          
          const { error: leadError } = await supabase
            .from('leads')
            .upsert({
              hubspot_id: contact.id,
              email: props.email,
              first_name: props.firstname,
              last_name: props.lastname,
              phone: props.phone || props.mobilephone,
              source: 'hubspot',
              status: leadStatus,
              owner_id: props.hubspot_owner_id,
              created_at: props.createdate
            }, { 
              onConflict: 'hubspot_id',
              ignoreDuplicates: false 
            });
            
          if (!leadError) {
            results.leads_synced++;
          }
        }
      } else {
        const errorText = await contactsResponse.text();
        results.errors.push(`Contacts API error: ${errorText}`);
      }
    }

    // Sync Deals
    if (sync_type === 'all' || sync_type === 'deals') {
      console.log('Syncing deals from HubSpot...');
      
      const dealsResponse = await fetch(
        'https://api.hubapi.com/crm/v3/objects/deals/search',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filterGroups: [],
            properties: [
              'dealname', 'dealstage', 'amount', 'pipeline',
              'closedate', 'hubspot_owner_id', 'createdate'
            ],
            sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
            limit: 100
          })
        }
      );

      if (dealsResponse.ok) {
        const dealsData = await dealsResponse.json();
        
        for (const deal of dealsData.results) {
          const props = deal.properties;
          const dealStatus = mapDealStageToStatus(props.dealstage);
          
          const { error } = await supabase
            .from('deals')
            .upsert({
              hubspot_deal_id: deal.id,
              deal_name: props.dealname,
              deal_value: parseFloat(props.amount) || 0,
              stage: props.dealstage,
              pipeline: props.pipeline,
              status: dealStatus,
              close_date: props.closedate,
              created_at: props.createdate
            }, { 
              onConflict: 'hubspot_deal_id',
              ignoreDuplicates: false 
            });

          if (error && !error.message.includes('duplicate')) {
            results.errors.push(`Deal ${props.dealname}: ${error.message}`);
          } else if (!error) {
            results.deals_synced++;
          }
        }
      } else {
        const errorText = await dealsResponse.text();
        results.errors.push(`Deals API error: ${errorText}`);
      }
    }

    // Sync Calls
    if (sync_type === 'all' || sync_type === 'calls') {
      console.log('Syncing calls from HubSpot...');
      
      const callsResponse = await fetch(
        'https://api.hubapi.com/crm/v3/objects/calls/search',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filterGroups: [],
            properties: [
              'hs_call_title', 'hs_call_status', 'hs_call_duration',
              'hs_timestamp', 'hs_call_to_number', 'hs_call_from_number',
              'hubspot_owner_id', 'hs_call_disposition'
            ],
            sorts: [{ propertyName: 'hs_timestamp', direction: 'DESCENDING' }],
            limit: 100
          })
        }
      );

      if (callsResponse.ok) {
        const callsData = await callsResponse.json();
        
        for (const call of callsData.results) {
          const props = call.properties;
          const callStatus = mapHubspotCallStatus(props.hs_call_status, props.hs_call_disposition);
          
          const { error } = await supabase
            .from('call_records')
            .upsert({
              provider_call_id: `hubspot_${call.id}`,
              caller_number: props.hs_call_from_number || props.hs_call_to_number || 'Unknown',
              call_status: callStatus,
              duration_seconds: parseInt(props.hs_call_duration) || 0,
              started_at: props.hs_timestamp,
              call_outcome: props.hs_call_disposition
            }, { 
              onConflict: 'provider_call_id',
              ignoreDuplicates: false 
            });

          if (error && !error.message.includes('duplicate')) {
            results.errors.push(`Call ${call.id}: ${error.message}`);
          } else if (!error) {
            results.calls_synced++;
          }
        }
      } else {
        const errorText = await callsResponse.text();
        results.errors.push(`Calls API error: ${errorText}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'HubSpot sync completed',
        ...results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function mapHubspotStatusToLead(lifecycle: string, leadStatus: string): string {
  if (leadStatus === 'CLOSED_WON' || lifecycle === 'customer') return 'closed';
  if (leadStatus === 'APPOINTMENT_SCHEDULED') return 'appointment_set';
  if (leadStatus === 'IN_PROGRESS' || leadStatus === 'CONTACTED') return 'follow_up';
  if (leadStatus === 'NO_SHOW') return 'no_show';
  if (lifecycle === 'salesqualifiedlead' || lifecycle === 'opportunity') return 'pitch_given';
  return 'new';
}

function mapDealStageToStatus(stage: string): 'pending' | 'closed' | 'lost' {
  if (stage?.includes('closed') && stage?.includes('won')) return 'closed';
  if (stage?.includes('closed') && stage?.includes('lost')) return 'lost';
  return 'pending';
}

function mapHubspotCallStatus(status: string, disposition: string): string {
  if (disposition === 'CONNECTED') return 'completed';
  if (disposition === 'NO_ANSWER') return 'missed';
  if (disposition === 'BUSY') return 'busy';
  if (disposition === 'LEFT_VOICEMAIL') return 'voicemail';
  if (status === 'COMPLETED') return 'completed';
  if (status === 'MISSED') return 'missed';
  return 'initiated';
}
