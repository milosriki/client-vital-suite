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
    const { clear_fake_data = false, sync_type = 'all', incremental = true } = await req.json().catch(() => ({}));

    const results = {
      contacts_synced: 0,
      leads_synced: 0,
      deals_synced: 0,
      calls_synced: 0,
      errors: [] as string[],
      mode: incremental ? 'incremental' : 'full'
    };

    // Get last sync timestamp for incremental sync
    let lastSyncTime: string | null = null;
    if (incremental) {
      const { data: lastSync } = await supabase
        .from('sync_logs')
        .select('completed_at')
        .eq('platform', 'hubspot')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1);
      
      if (lastSync?.[0]?.completed_at) {
        lastSyncTime = lastSync[0].completed_at;
        console.log(`Incremental sync from: ${lastSyncTime}`);
      } else {
        // First sync - only get last 30 days, not all 100K
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        lastSyncTime = thirtyDaysAgo.toISOString();
        console.log(`First sync - fetching from: ${lastSyncTime}`);
      }
    }

    // Clear fake/test data if requested
    if (clear_fake_data) {
      console.log('Clearing fake data...');
      await supabase.from('leads').delete().or('email.ilike.%@example.com,phone.ilike.%555-0%');
      await supabase.from('contacts').delete().ilike('email', '%@example.com');
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

    // Helper for paginated fetching with optional date filter
    async function fetchAllHubSpot(objectType: string, properties: string[], sortProperty: string = 'createdate', filterAfter?: string) {
      let allResults: any[] = [];
      let after: string | undefined = undefined;
      let pageCount = 0;
      const MAX_PAGES = 50; // Limit to avoid timeout (5000 records max per sync)

      console.log(`Starting sync for ${objectType}${filterAfter ? ` (modified after ${filterAfter})` : ''}...`);

      do {
        const filterGroups = filterAfter ? [{
          filters: [{
            propertyName: 'hs_lastmodifieddate',
            operator: 'GTE',
            value: new Date(filterAfter).getTime().toString()
          }]
        }] : [];

        const fetchResponse: Response = await fetch(
          `https://api.hubapi.com/crm/v3/objects/${objectType}/search`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              filterGroups,
              properties,
              sorts: [{ propertyName: sortProperty, direction: 'DESCENDING' }],
              limit: 100,
              after
            })
          }
        );

        if (!fetchResponse.ok) {
          throw new Error(`HubSpot API error for ${objectType}: ${await fetchResponse.text()}`);
        }

        const jsonData: { results: any[]; paging?: { next?: { after?: string } } } = await fetchResponse.json();
        allResults = allResults.concat(jsonData.results);
        after = jsonData.paging?.next?.after;
        pageCount++;

        if (after && pageCount < MAX_PAGES) {
          console.log(`Fetching page ${pageCount + 1} for ${objectType}...`);
        }

      } while (after && pageCount < MAX_PAGES);

      console.log(`Fetched ${allResults.length} ${objectType} (${pageCount} pages)`);
      return allResults;
    }

    // Sync Contacts (incremental by default) - with ALL HubSpot fields
    if (sync_type === 'all' || sync_type === 'contacts') {
      try {
        const contacts = await fetchAllHubSpot('contacts', [
          'firstname', 'lastname', 'email', 'phone', 'mobilephone',
          'hubspot_owner_id', 'lifecyclestage', 'hs_lead_status',
          'createdate', 'lastmodifieddate', 'city', 'hs_object_id',
          // Location/neighborhood fields
          'address', 'state', 'country', 'zip',
          // Job and traffic source
          'jobtitle', 'hs_analytics_source', 'hs_analytics_source_data_1', 'hs_analytics_source_data_2',
          // Call tracking
          'num_contacted_notes', 'notes_last_contacted', 'hs_sales_email_last_replied',
          // Custom lifecycle
          'custom_lifecycle_stage',
          // Speed to lead metrics
          'hs_time_to_first_engagement', 'first_conversion_date',
          // Lead scoring
          'hs_lead_status', 'hs_lifecyclestage_lead_date',
          // Form submissions & conversions
          'num_form_submissions', 'num_unique_forms_submitted', 'recent_conversion_event_name', 'recent_conversion_date',
          // SLA & team tracking
          'hubspot_team_id', 'hs_content_membership_registered_at', 'hs_sa_first_engagement_descr',
          // Reassignment & delegation
          'hs_date_entered_lead', 'hs_latest_sequence_enrolled_date', 'contact_unworked',
          // Engagement tracking
          'hs_last_sales_activity_date', 'hs_email_domain', 'hs_is_unworked'
        ], 'lastmodifieddate', incremental ? lastSyncTime || undefined : undefined);

        for (const contact of contacts) {
          const props = contact.properties;

          // Skip if no email
          if (!props.email) continue;

          // Get owner name from map
          const ownerName = props.hubspot_owner_id ? ownerMap[props.hubspot_owner_id] || null : null;

          // Calculate location/neighborhood from city or address
          const location = props.city || props.state || props.address || null;
          const neighborhood = props.city || null;

          // Upsert into contacts table with ALL fields
          const { error } = await supabase
            .from('contacts')
            .upsert({
              hubspot_contact_id: contact.id,
              email: props.email,
              first_name: props.firstname,
              last_name: props.lastname,
              phone: props.phone || props.mobilephone,
              owner_id: props.hubspot_owner_id,
              owner_name: ownerName,
              lifecycle_stage: props.lifecyclestage,
              status: props.hs_lead_status || 'active',
              city: props.city,
              // Location fields
              location: location,
              neighborhood: neighborhood,
              job_title: props.jobtitle,
              latest_traffic_source: props.hs_analytics_source,
              latest_traffic_source_2: props.hs_analytics_source_data_1,
              call_attempt_count: parseInt(props.num_contacted_notes) || 0,
              custom_lifecycle_stage: props.custom_lifecycle_stage,
              lead_status: props.hs_lead_status,
              // Form submissions & conversions
              first_conversion_date: props.first_conversion_date || null,
              num_form_submissions: parseInt(props.num_form_submissions) || 0,
              num_unique_forms_submitted: parseInt(props.num_unique_forms_submitted) || 0,
              recent_conversion: props.recent_conversion_event_name,
              recent_conversion_date: props.recent_conversion_date || null,
              // Team & SLA tracking
              hubspot_team: props.hubspot_team_id,
              sla_first_touch: props.hs_sa_first_engagement_descr,
              time_of_entry: props.hs_date_entered_lead || null,
              // Engagement & member tracking
              contact_unworked: props.hs_is_unworked === 'true' || props.contact_unworked === 'true',
              last_activity_date: props.hs_last_sales_activity_date || null,
              email_domain: props.hs_email_domain,
              currently_in_prospecting: !!props.hs_latest_sequence_enrolled_date,
              registered_member: props.hs_content_membership_registered_at ? 1 : 0,
              created_at: props.createdate,
              updated_at: props.lastmodifieddate || new Date().toISOString()
            }, {
              onConflict: 'hubspot_contact_id',
              ignoreDuplicates: false
            });

          if (error) {
            results.errors.push(`Contact ${props.email}: ${error.message}`);
          } else {
            results.contacts_synced++;
          }

          // Also sync to leads table
          const leadStatus = mapHubspotStatusToLead(props.lifecyclestage, props.hs_lead_status);

          await supabase
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

          results.leads_synced++;
        }
      } catch (err: any) {
        results.errors.push(`Contacts Sync Error: ${err.message}`);
      }
    }

    // Sync Deals
    if (sync_type === 'all' || sync_type === 'deals') {
      try {
        const deals = await fetchAllHubSpot('deals', [
          'dealname', 'dealstage', 'amount', 'pipeline',
          'closedate', 'hubspot_owner_id', 'createdate'
        ]);

        for (const deal of deals) {
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

          if (error) {
            results.errors.push(`Deal ${props.dealname}: ${error.message}`);
          } else {
            results.deals_synced++;
          }
        }
      } catch (err: any) {
        results.errors.push(`Deals Sync Error: ${err.message}`);
      }
    }

    // Sync Calls
    if (sync_type === 'all' || sync_type === 'calls') {
      try {
        const calls = await fetchAllHubSpot('calls', [
          'hs_call_title', 'hs_call_status', 'hs_call_duration',
          'hs_timestamp', 'hs_call_to_number', 'hs_call_from_number',
          'hubspot_owner_id', 'hs_call_disposition'
        ], 'hs_timestamp');

        for (const call of calls) {
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

          if (error) {
            results.errors.push(`Call ${call.id}: ${error.message}`);
          } else {
            results.calls_synced++;
          }
        }
      } catch (err: any) {
        results.errors.push(`Calls Sync Error: ${err.message}`);
      }
    }

    // Log successful sync
    await supabase.from('sync_logs').insert({
      platform: 'hubspot',
      sync_type: sync_type,
      status: results.errors.length > 0 ? 'completed_with_errors' : 'completed',
      records_processed: results.contacts_synced + results.deals_synced + results.calls_synced,
      records_failed: results.errors.length,
      error_details: results.errors.length > 0 ? { errors: results.errors } : null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `HubSpot ${results.mode} sync completed`,
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
