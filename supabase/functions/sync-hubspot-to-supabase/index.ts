import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Batch size for processing - smaller batches prevent CPU timeout
const BATCH_SIZE = 100;
const MAX_RECORDS_PER_SYNC = 1000; // Process 1000 at a time, call again for more

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const HUBSPOT_API_KEY = Deno.env.get('HUBSPOT_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!HUBSPOT_API_KEY) {
      throw new Error('HUBSPOT_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json().catch(() => ({}));
    const { 
      clear_fake_data = false, 
      sync_type = 'all', 
      incremental = true,
      cursor = null, // Resume cursor for pagination
      batch_mode = true // Process in batches
    } = body;

    console.log(`Starting sync: type=${sync_type}, incremental=${incremental}, cursor=${cursor || 'none'}`);

    const results = {
      contacts_synced: 0,
      leads_synced: 0,
      deals_synced: 0,
      calls_synced: 0,
      errors: [] as string[],
      mode: incremental ? 'incremental' : 'full',
      next_cursor: null as string | null,
      has_more: false,
      processing_time_ms: 0
    };

    // Get last sync timestamp for incremental sync
    let lastSyncTime: string | null = null;
    if (incremental && !cursor) {
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
        // First sync - only get last 7 days to start
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        lastSyncTime = sevenDaysAgo.toISOString();
        console.log(`First sync - fetching from: ${lastSyncTime}`);
      }
    }

    // Clear fake/test data if requested
    if (clear_fake_data && !cursor) {
      console.log('Clearing fake data...');
      await supabase.from('leads').delete().or('email.ilike.%@example.com,phone.ilike.%555-0%');
      await supabase.from('contacts').delete().ilike('email', '%@example.com');
      // Also clear enhanced_leads test data
      await supabase.from('enhanced_leads').delete().ilike('email', '%@email.com');
      await supabase.from('enhanced_leads').delete().ilike('email', '%@example.com');
      console.log('Fake data cleared');
    }

    // Fetch owners for mapping (cache this)
    let ownerMap: Record<string, string> = {};
    try {
      const ownersResponse = await fetch('https://api.hubapi.com/crm/v3/owners', {
        headers: { 'Authorization': `Bearer ${HUBSPOT_API_KEY}` }
      });
      if (ownersResponse.ok) {
        const ownersData = await ownersResponse.json();
        ownerMap = Object.fromEntries(
          ownersData.results.map((o: any) => [o.id, `${o.firstName} ${o.lastName}`])
        );
      }
    } catch (e) {
      console.warn('Failed to fetch owners, continuing without names');
    }

    // Optimized batch fetching with cursor support
    async function fetchBatchHubSpot(
      objectType: string, 
      properties: string[], 
      afterCursor?: string,
      filterAfter?: string
    ): Promise<{ results: any[], nextCursor: string | null }> {
      
      const filterGroups = filterAfter ? [{
        filters: [{
          propertyName: 'hs_lastmodifieddate',
          operator: 'GTE',
          value: new Date(filterAfter).getTime().toString()
        }]
      }] : [];

      const fetchResponse = await fetch(
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
            sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
            limit: BATCH_SIZE,
            after: afterCursor || undefined
          })
        }
      );

      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        throw new Error(`HubSpot API error for ${objectType}: ${errorText}`);
      }

      const jsonData = await fetchResponse.json();
      return {
        results: jsonData.results || [],
        nextCursor: jsonData.paging?.next?.after || null
      };
    }

    // Process contacts in batches
    if (sync_type === 'all' || sync_type === 'contacts') {
      try {
        let processedCount = 0;
        let currentCursor = cursor;
        
        while (processedCount < MAX_RECORDS_PER_SYNC) {
          const { results: contacts, nextCursor } = await fetchBatchHubSpot(
            'contacts',
            [
              'firstname', 'lastname', 'email', 'phone', 'mobilephone',
              'hubspot_owner_id', 'lifecyclestage', 'hs_lead_status',
              'createdate', 'lastmodifieddate', 'city', 'hs_object_id',
              'jobtitle', 'hs_analytics_source', 'hs_analytics_source_data_1',
              'num_contacted_notes', 'custom_lifecycle_stage',
              'first_conversion_date', 'num_form_submissions', 'num_unique_forms_submitted',
              'recent_conversion_event_name', 'recent_conversion_date',
              'hubspot_team_id', 'hs_sa_first_engagement_descr',
              'hs_date_entered_lead', 'contact_unworked', 'hs_is_unworked',
              'hs_last_sales_activity_date', 'hs_email_domain'
            ],
            currentCursor || undefined,
            incremental ? lastSyncTime || undefined : undefined
          );

          if (contacts.length === 0) break;

          // Batch upsert contacts
          const contactsToUpsert = contacts
            .filter((c: any) => c.properties?.email)
            .map((contact: any) => {
              const props = contact.properties;
              const ownerName = props.hubspot_owner_id ? ownerMap[props.hubspot_owner_id] || null : null;
              
              return {
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
                location: props.city,
                neighborhood: props.city,
                job_title: props.jobtitle,
                latest_traffic_source: props.hs_analytics_source,
                latest_traffic_source_2: props.hs_analytics_source_data_1,
                call_attempt_count: parseInt(props.num_contacted_notes) || 0,
                custom_lifecycle_stage: props.custom_lifecycle_stage,
                lead_status: props.hs_lead_status,
                first_conversion_date: props.first_conversion_date || null,
                num_form_submissions: parseInt(props.num_form_submissions) || 0,
                num_unique_forms_submitted: parseInt(props.num_unique_forms_submitted) || 0,
                recent_conversion: props.recent_conversion_event_name,
                recent_conversion_date: props.recent_conversion_date || null,
                hubspot_team: props.hubspot_team_id,
                sla_first_touch: props.hs_sa_first_engagement_descr,
                time_of_entry: props.hs_date_entered_lead || null,
                contact_unworked: props.hs_is_unworked === 'true' || props.contact_unworked === 'true',
                last_activity_date: props.hs_last_sales_activity_date || null,
                email_domain: props.hs_email_domain,
                created_at: props.createdate,
                updated_at: props.lastmodifieddate || new Date().toISOString()
              };
            });

          if (contactsToUpsert.length > 0) {
            const { error: contactError } = await supabase
              .from('contacts')
              .upsert(contactsToUpsert, {
                onConflict: 'hubspot_contact_id',
                ignoreDuplicates: false
              });

            if (contactError) {
              results.errors.push(`Contacts batch: ${contactError.message}`);
            } else {
              results.contacts_synced += contactsToUpsert.length;
            }

            // Also sync to leads table (batch)
            const leadsToUpsert = contacts
              .filter((c: any) => c.properties?.email)
              .map((contact: any) => {
                const props = contact.properties;
                return {
                  hubspot_id: contact.id,
                  email: props.email,
                  first_name: props.firstname,
                  last_name: props.lastname,
                  phone: props.phone || props.mobilephone,
                  source: 'hubspot',
                  status: mapHubspotStatusToLead(props.lifecyclestage, props.hs_lead_status),
                  owner_id: props.hubspot_owner_id,
                  created_at: props.createdate
                };
              });

            const { error: leadsError } = await supabase
              .from('leads')
              .upsert(leadsToUpsert, {
                onConflict: 'hubspot_id',
                ignoreDuplicates: false
              });

            if (!leadsError) {
              results.leads_synced += leadsToUpsert.length;
            }
          }

          processedCount += contacts.length;
          currentCursor = nextCursor;

          // Check if we should stop and save cursor for next call
          if (!nextCursor || processedCount >= MAX_RECORDS_PER_SYNC) {
            results.next_cursor = nextCursor;
            results.has_more = !!nextCursor;
            break;
          }

          console.log(`Processed ${processedCount} contacts, continuing...`);
        }
      } catch (err: any) {
        results.errors.push(`Contacts Sync Error: ${err.message}`);
      }
    }

    // Sync Deals (only if not resuming contacts)
    if ((sync_type === 'all' || sync_type === 'deals') && !cursor) {
      try {
        const { results: deals } = await fetchBatchHubSpot('deals', [
          'dealname', 'dealstage', 'amount', 'pipeline',
          'closedate', 'hubspot_owner_id', 'createdate'
        ], undefined, incremental ? lastSyncTime || undefined : undefined);

        const dealsToUpsert = deals.map((deal: any) => {
          const props = deal.properties;
          return {
            hubspot_deal_id: deal.id,
            deal_name: props.dealname,
            deal_value: parseFloat(props.amount) || 0,
            stage: props.dealstage,
            pipeline: props.pipeline,
            status: mapDealStageToStatus(props.dealstage),
            close_date: props.closedate,
            created_at: props.createdate
          };
        });

        if (dealsToUpsert.length > 0) {
          const { error } = await supabase
            .from('deals')
            .upsert(dealsToUpsert, { onConflict: 'hubspot_deal_id', ignoreDuplicates: false });

          if (error) {
            results.errors.push(`Deals batch: ${error.message}`);
          } else {
            results.deals_synced = dealsToUpsert.length;
          }
        }
      } catch (err: any) {
        results.errors.push(`Deals Sync Error: ${err.message}`);
      }
    }

    // Sync Calls (only if not resuming contacts) - includes Call Gear data
    if ((sync_type === 'all' || sync_type === 'calls') && !cursor) {
      try {
        const { results: calls } = await fetchBatchHubSpot('calls', [
          // Standard HubSpot call properties
          'hs_call_title', 'hs_call_status', 'hs_call_duration',
          'hs_timestamp', 'hs_call_to_number', 'hs_call_from_number',
          'hubspot_owner_id', 'hs_call_disposition', 'hs_call_direction',
          'hs_call_body', 'hs_call_recording_url',
          // Call Gear custom properties
          'full_talk_record_link', 'total_talk_duration', 'total_waiting_duration',
          'call_finish_date_and_time', 'call_finish_reason', 'called_phone_number',
          'postprocessing_time', 'hs_activity_type'
        ], undefined, incremental ? lastSyncTime || undefined : undefined);

        // Log first call properties to debug Call Gear data
        if (calls.length > 0) {
          console.log('📞 Sample call properties:', JSON.stringify(calls[0].properties, null, 2));
        }

        const callsToUpsert = calls.map((call: any) => {
          const props = call.properties;
          
          // Parse duration - Call Gear sends "3 minutes and 12 seconds" format
          let durationSeconds = parseInt(props.hs_call_duration) || 0;
          if (props.total_talk_duration) {
            const match = props.total_talk_duration.match(/(\d+)\s*minutes?\s*(?:and\s*)?(\d+)?\s*seconds?/i);
            if (match) {
              durationSeconds = (parseInt(match[1]) || 0) * 60 + (parseInt(match[2]) || 0);
            }
          }
          
          // Get recording URL - prefer Call Gear's full_talk_record_link
          const recordingUrl = props.full_talk_record_link || props.hs_call_recording_url || null;
          
          // Map call direction
          const direction = props.hs_call_direction?.toLowerCase() || 
                           (props.hs_call_from_number ? 'outbound' : 'inbound');
          
          return {
            provider_call_id: `hubspot_${call.id}`,
            caller_number: props.hs_call_from_number || props.hs_call_to_number || props.called_phone_number || 'Unknown',
            call_status: mapHubspotCallStatus(props.hs_call_status, props.hs_call_disposition),
            duration_seconds: durationSeconds,
            started_at: props.hs_timestamp,
            call_outcome: props.hs_call_disposition || props.call_finish_reason,
            call_direction: direction,
            recording_url: recordingUrl,
            transcription: props.hs_call_body || null  // HubSpot AI call notes
          };
        });

        if (callsToUpsert.length > 0) {
          const { error } = await supabase
            .from('call_records')
            .upsert(callsToUpsert, { onConflict: 'provider_call_id', ignoreDuplicates: false });

          if (error) {
            results.errors.push(`Calls batch: ${error.message}`);
          } else {
            results.calls_synced = callsToUpsert.length;
          }
        }
      } catch (err: any) {
        results.errors.push(`Calls Sync Error: ${err.message}`);
      }
    }

    results.processing_time_ms = Date.now() - startTime;

    // Log successful sync
    await supabase.from('sync_logs').insert({
      platform: 'hubspot',
      sync_type: sync_type,
      status: results.errors.length > 0 ? 'completed_with_errors' : (results.has_more ? 'partial' : 'completed'),
      records_processed: results.contacts_synced + results.deals_synced + results.calls_synced,
      records_failed: results.errors.length,
      error_details: results.errors.length > 0 ? { errors: results.errors, next_cursor: results.next_cursor } : null,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString()
    });

    console.log(`Sync completed in ${results.processing_time_ms}ms: ${results.contacts_synced} contacts, has_more=${results.has_more}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: results.has_more 
          ? `Synced ${results.contacts_synced} contacts, more available. Call again with cursor.`
          : `HubSpot ${results.mode} sync completed`,
        ...results,
        instructions: results.has_more 
          ? 'Call this function again with { "cursor": "' + results.next_cursor + '" } to continue'
          : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: Date.now() - startTime
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

function mapDealStageToStatus(stage: string): 'pending' | 'closed' | 'cancelled' {
  if (stage?.includes('closed') && stage?.includes('won')) return 'closed';
  if (stage?.includes('closed') && stage?.includes('lost')) return 'cancelled';
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
