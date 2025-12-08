import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OwnerChangeResult {
  changed: boolean;
  old_owner: string | null;
  new_owner: string;
  change_count: number;
  history_id: string | null;
  should_intervene: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HUBSPOT_API_KEY = Deno.env.get('HUBSPOT_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!HUBSPOT_API_KEY || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { contact_ids, limit = 100, track_changes = true } = await req.json().catch(() => ({}));

    console.log('[sync-hubspot-contacts] Starting sync:', {
      contact_ids: contact_ids?.length || 'all',
      limit,
      track_changes
    });

    // Fetch contacts from HubSpot
    const fetchUrl = contact_ids && contact_ids.length > 0
      ? 'https://api.hubapi.com/crm/v3/objects/contacts/batch/read'
      : `https://api.hubapi.com/crm/v3/objects/contacts/search`;

    const hubspotOptions: any = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    if (contact_ids && contact_ids.length > 0) {
      // Batch read specific contacts
      hubspotOptions.body = JSON.stringify({
        inputs: contact_ids.map((id: string) => ({ id })),
        properties: [
          'email', 'firstname', 'lastname', 'phone',
          'hubspot_owner_id', 'lifecyclestage', 'hs_lead_status',
          'createdate', 'lastmodifieddate', 'notes_last_contacted',
          'assigned_coach', 'package_type', 'package_value_aed'
        ]
      });
    } else {
      // Search for recently modified contacts
      hubspotOptions.body = JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'lastmodifieddate',
                operator: 'GTE',
                value: Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
              }
            ]
          }
        ],
        properties: [
          'email', 'firstname', 'lastname', 'phone',
          'hubspot_owner_id', 'lifecyclestage', 'hs_lead_status',
          'createdate', 'lastmodifieddate', 'notes_last_contacted',
          'assigned_coach', 'package_type', 'package_value_aed'
        ],
        sorts: [{ propertyName: 'lastmodifieddate', direction: 'DESCENDING' }],
        limit: limit
      });
    }

    const hubspotResponse = await fetch(fetchUrl, hubspotOptions);

    if (!hubspotResponse.ok) {
      const errorText = await hubspotResponse.text();
      console.error('[sync-hubspot-contacts] HubSpot API error:', errorText);
      throw new Error(`HubSpot API error: ${hubspotResponse.status}`);
    }

    const hubspotData = await hubspotResponse.json();
    const contacts = hubspotData.results || [];

    console.log(`[sync-hubspot-contacts] Fetched ${contacts.length} contacts from HubSpot`);

    // Fetch owner names for mapping
    const ownersResponse = await fetch(
      'https://api.hubapi.com/crm/v3/owners',
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        }
      }
    );

    let ownerMap: Record<string, string> = {};
    if (ownersResponse.ok) {
      const ownersData = await ownersResponse.json();
      ownerMap = Object.fromEntries(
        ownersData.results.map((owner: any) => [
          owner.id,
          `${owner.firstName} ${owner.lastName}`.trim()
        ])
      );
    }

    const syncResults = {
      total: contacts.length,
      synced: 0,
      owner_changes: 0,
      interventions_triggered: 0,
      errors: [] as any[]
    };

    // Process each contact
    for (const contact of contacts) {
      const props = contact.properties;

      if (!props.email) {
        console.warn('[sync-hubspot-contacts] Skipping contact without email:', contact.id);
        continue;
      }

      try {
        const currentOwner = props.hubspot_owner_id
          ? ownerMap[props.hubspot_owner_id] || props.hubspot_owner_id
          : props.assigned_coach || null;

        // Get existing record to check for owner change
        const { data: existing } = await supabase
          .from('client_health_scores')
          .select('assigned_coach, health_score, health_zone, owner_change_count')
          .eq('email', props.email)
          .single();

        let ownerChangeResult: OwnerChangeResult | null = null;

        // Track owner change if enabled and owner is different
        if (track_changes && existing && existing.assigned_coach !== currentOwner) {
          console.log('[sync-hubspot-contacts] Owner change detected:', {
            email: props.email,
            old: existing.assigned_coach,
            new: currentOwner
          });

          // Call the detect_owner_change function
          const { data: changeData, error: changeError } = await supabase
            .rpc('detect_owner_change', {
              p_client_email: props.email,
              p_new_owner: currentOwner,
              p_current_health: existing.health_score,
              p_current_zone: existing.health_zone
            });

          if (changeError) {
            console.error('[sync-hubspot-contacts] Error detecting owner change:', changeError);
          } else {
            ownerChangeResult = changeData as OwnerChangeResult;
            syncResults.owner_changes++;

            // Trigger intervention if needed
            if (ownerChangeResult.should_intervene) {
              try {
                await supabase.functions.invoke('intervention-recommender', {
                  body: {
                    client_email: props.email,
                    trigger: 'owner_change',
                    new_owner: currentOwner,
                    old_owner: ownerChangeResult.old_owner,
                    metadata: {
                      change_count: ownerChangeResult.change_count,
                      history_id: ownerChangeResult.history_id
                    }
                  }
                });
                syncResults.interventions_triggered++;

                // Update the history record to mark intervention triggered
                if (ownerChangeResult.history_id) {
                  await supabase
                    .from('contact_owner_history')
                    .update({ triggered_intervention: true })
                    .eq('id', ownerChangeResult.history_id);
                }
              } catch (interventionError) {
                console.error('[sync-hubspot-contacts] Error triggering intervention:', interventionError);
              }
            }
          }
        }

        // Upsert to client_health_scores
        const upsertData: any = {
          email: props.email,
          firstname: props.firstname || null,
          lastname: props.lastname || null,
          hubspot_contact_id: contact.id,
          assigned_coach: currentOwner,
          package_type: props.package_type || null,
          package_value_aed: props.package_value_aed ? parseFloat(props.package_value_aed) : null,
        };

        // If this is a new record, initialize owner tracking fields
        if (!existing) {
          upsertData.owner_change_count = 0;
        }

        const { error: upsertError } = await supabase
          .from('client_health_scores')
          .upsert(upsertData, {
            onConflict: 'email',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error('[sync-hubspot-contacts] Error upserting contact:', props.email, upsertError);
          syncResults.errors.push({
            email: props.email,
            error: upsertError.message
          });
        } else {
          syncResults.synced++;
        }

      } catch (error) {
        console.error('[sync-hubspot-contacts] Error processing contact:', props.email, error);
        syncResults.errors.push({
          email: props.email,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('[sync-hubspot-contacts] Sync complete:', syncResults);

    return new Response(
      JSON.stringify({
        success: true,
        ...syncResults,
        message: `Synced ${syncResults.synced} contacts, detected ${syncResults.owner_changes} owner changes, triggered ${syncResults.interventions_triggered} interventions`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[sync-hubspot-contacts] Fatal error:', error);
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
