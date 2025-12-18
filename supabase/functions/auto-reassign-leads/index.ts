import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  checkCircuitBreaker,
  recordUpdateSource,
  logCircuitBreakerTrip,
} from "../_shared/circuit-breaker.ts";

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
    const { max_reassignments = 50, sla_minutes = 20 } = await req.json().catch(() => ({}));

    console.log(`[Auto Reassign] Starting auto-reassignment (SLA: ${sla_minutes}min, Max: ${max_reassignments})`);

    const results = {
      checked: 0,
      reassigned: 0,
      skipped: 0,
      circuitBreakerTrips: 0,
      errors: [] as string[],
      reassignments: [] as any[]
    };

    // 1. Get available owners (setters) from HubSpot
    const ownersResponse = await fetch(
      `${HUBSPOT_BASE_URL}/crm/v3/owners?limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (!ownersResponse.ok) {
      throw new Error('Failed to fetch owners from HubSpot');
    }

    const ownersData = await ownersResponse.json();
    const availableOwners = (ownersData.results || [])
      .filter((o: any) => o.archived === false)
      .map((o: any) => o.id);

    if (availableOwners.length === 0) {
      throw new Error('No available owners found in HubSpot');
    }

    console.log(`[Auto Reassign] Found ${availableOwners.length} available owners`);

    // 2. Find leads needing reassignment
    const slaThreshold = new Date(Date.now() - sla_minutes * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get contacts from Supabase that need reassignment
    const { data: contactsNeedingReassignment, error: queryError } = await supabase
      .from('contacts')
      .select('hubspot_contact_id, email, owner_id, created_at, updated_at')
      .or(`owner_id.is.null,owner_id.eq.`)
      .lt('created_at', slaThreshold)
      .limit(max_reassignments);

    if (queryError) {
      console.warn('[Auto Reassign] Supabase query error, trying HubSpot API directly:', queryError);
    }

    // Also check HubSpot directly for leads without owners or stale leads
    const hubspotSearchResponse = await fetch(
      `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filterGroups: [{
            filters: [{
              propertyName: 'lifecyclestage',
              operator: 'IN',
              value: ['lead', 'marketingqualifiedlead', 'salesqualifiedlead']
            }],
          }, {
            filters: [{
              propertyName: 'hubspot_owner_id',
              operator: 'NOT_HAS_PROPERTY'
            }]
          }],
          properties: ['email', 'firstname', 'lastname', 'hubspot_owner_id', 'createdate', 'lifecyclestage'],
          limit: max_reassignments,
          sorts: [{
            propertyName: 'createdate',
            direction: 'ASCENDING'
          }]
        })
      }
    );

    let hubspotContacts: any[] = [];
    if (hubspotSearchResponse.ok) {
      const hubspotSearchData = await hubspotSearchResponse.json();
      hubspotContacts = hubspotSearchData.results || [];
    }

    // Combine and deduplicate contacts
    const contactsToReassign = [
      ...(contactsNeedingReassignment || []).map(c => ({
        id: c.hubspot_contact_id,
        email: c.email,
        current_owner: c.owner_id,
        created_at: c.created_at
      })),
      ...hubspotContacts.map(c => ({
        id: c.id,
        email: c.properties?.email,
        current_owner: c.properties?.hubspot_owner_id,
        created_at: c.properties?.createdate || c.createdAt
      }))
    ].filter((c, index, self) => 
      index === self.findIndex(t => t.id === c.id)
    ).slice(0, max_reassignments);

    console.log(`[Auto Reassign] Found ${contactsToReassign.length} contacts needing reassignment`);

    // 3. Round-robin assignment
    let ownerIndex = 0;
    const ownerRotation = [...availableOwners];

    for (const contact of contactsToReassign) {
      results.checked++;
      const contactIdStr = contact.id?.toString();

      try {
        // ========================================
        // CIRCUIT BREAKER CHECK - Prevent Infinite Loops
        // ========================================
        if (contactIdStr) {
          const circuitCheck = checkCircuitBreaker(contactIdStr);
          if (!circuitCheck.shouldProcess) {
            console.warn(`[CIRCUIT BREAKER] Skipping ${contactIdStr}: ${circuitCheck.reason}`);
            await logCircuitBreakerTrip(supabase, contactIdStr, circuitCheck.count, circuitCheck.reason!);
            results.circuitBreakerTrips++;
            results.skipped++;
            continue;
          }
        }

        // Skip if already has owner and was recently updated
        if (contact.current_owner && contact.created_at) {
          const createdDate = new Date(contact.created_at);
          const minutesSinceCreation = (Date.now() - createdDate.getTime()) / (60 * 1000);
          if (minutesSinceCreation < sla_minutes) {
            results.skipped++;
            continue;
          }
        }

        // Get next owner (round-robin)
        const newOwnerId = ownerRotation[ownerIndex % ownerRotation.length];
        ownerIndex++;

        // ========================================
        // RECORD SOURCE BEFORE REASSIGNMENT
        // This ensures webhook handler knows to ignore bounce-back
        // ========================================
        if (contactIdStr) {
          await recordUpdateSource(supabase, contactIdStr, 'auto_reassign', {
            new_owner_id: newOwnerId,
            old_owner_id: contact.current_owner || null,
            reason: `AUTO_REASSIGN_SLA_BREACH_${sla_minutes}MIN`,
            initiated_at: new Date().toISOString()
          });
        }

        // Reassign using reassign-owner function (or direct API call)
        const reassignResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/reassign-owner`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contact_id: contact.id,
              new_owner_id: newOwnerId,
              old_owner_id: contact.current_owner || null,
              reason: `AUTO_REASSIGN_SLA_BREACH_${sla_minutes}MIN`
            })
          }
        );

        if (reassignResponse.ok) {
          const reassignData = await reassignResponse.json();
          results.reassigned++;
          results.reassignments.push({
            contact_id: contact.id,
            email: contact.email,
            old_owner: contact.current_owner,
            new_owner: newOwnerId,
            reason: `SLA_BREACH_${sla_minutes}MIN`
          });
          console.log(`[Auto Reassign] ✅ Reassigned ${contact.id} → ${newOwnerId}`);
        } else {
          const errorData = await reassignResponse.json();
          
          // Check if it was a circuit breaker trip
          if (reassignResponse.status === 429) {
            results.circuitBreakerTrips++;
            results.skipped++;
            console.warn(`[Auto Reassign] ⚠️ Circuit breaker for ${contact.id}:`, errorData);
          } else {
            results.errors.push(`Contact ${contact.id}: ${errorData.error || 'Unknown error'}`);
            console.error(`[Auto Reassign] ❌ Failed to reassign ${contact.id}:`, errorData);
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        results.errors.push(`Contact ${contact.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`[Auto Reassign] Error processing ${contact.id}:`, error);
      }
    }

    // Log summary
    const hasCircuitBreakerIssues = results.circuitBreakerTrips > 0;
    await supabase.from('sync_logs').insert({
      platform: 'hubspot',
      status: hasCircuitBreakerIssues ? 'warning' : (results.errors.length > 0 ? 'warning' : 'success'),
      message: `Auto-reassignment: ${results.reassigned} reassigned, ${results.skipped} skipped, ${results.circuitBreakerTrips} circuit breaker trips, ${results.errors.length} errors`,
      error_details: results.errors.length > 0 || hasCircuitBreakerIssues 
        ? { errors: results.errors, circuit_breaker_trips: results.circuitBreakerTrips } 
        : null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    });

    console.log(`[Auto Reassign] Complete: ${results.reassigned} reassigned, ${results.skipped} skipped, ${results.circuitBreakerTrips} circuit breaker trips, ${results.errors.length} errors`);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        checked: results.checked,
        reassigned: results.reassigned,
        skipped: results.skipped,
        circuit_breaker_trips: results.circuitBreakerTrips,
        errors: results.errors.length
      },
      reassignments: results.reassignments,
      errors: results.errors.slice(0, 10), // Limit error details
      circuit_breaker_warning: hasCircuitBreakerIssues 
        ? `${results.circuitBreakerTrips} contacts hit circuit breaker - check for infinite loops in workflow 1655409725`
        : null,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Auto Reassign] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
