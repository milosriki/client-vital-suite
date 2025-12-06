import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, validateApiKey, unauthorizedResponse } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate API key for service-to-service calls
  if (!validateApiKey(req)) {
    return unauthorizedResponse();
  }

  try {
    const HUBSPOT_API_KEY = Deno.env.get('HUBSPOT_API_KEY');
    if (!HUBSPOT_API_KEY) {
      throw new Error('HUBSPOT_API_KEY not configured');
    }

    const { type, timeframe, setter } = await req.json();
    
    const now = new Date();
    let filterDate = new Date();
    
    // Calculate date range based on timeframe
    switch(timeframe) {
      case 'today':
        filterDate.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        filterDate.setDate(filterDate.getDate() - 1);
        filterDate.setHours(0, 0, 0, 0);
        break;
      case 'this_month':
        filterDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        filterDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        break;
      default:
        filterDate.setDate(filterDate.getDate() - 7); // Last 7 days default
    }

    const filterTimestamp = filterDate.getTime();

    if (type === 'contacts' || type === 'all') {
      // Fetch contacts with recent activity
      const contactsResponse = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts/search',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: 'createdate',
                    operator: 'GTE',
                    value: filterTimestamp.toString()
                  }
                ]
              }
            ],
            properties: [
              'firstname',
              'lastname',
              'email',
              'phone',
              'hubspot_owner_id',
              'lifecyclestage',
              'hs_lead_status',
              'createdate',
              'lastmodifieddate',
              'notes_last_contacted',
              'call_status',
              'assigned_coach',
              'assessment_scheduled',
              'assessment_date'
            ],
            sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
            limit: 100
          })
        }
      );

      if (!contactsResponse.ok) {
        const errorText = await contactsResponse.text();
        console.error('HubSpot contacts error:', errorText);
        throw new Error(`HubSpot API error: ${contactsResponse.status}`);
      }

      const contactsData = await contactsResponse.json();
      
      // Filter by setter if specified
      let contacts = contactsData.results;
      if (setter) {
        contacts = contacts.filter((c: any) => 
          c.properties.assigned_coach?.toLowerCase().includes(setter.toLowerCase()) ||
          c.properties.hubspot_owner_id?.includes(setter)
        );
      }

      // Fetch deals for these contacts
      const dealIds = contacts
        .map((c: any) => c.associations?.deals?.results || [])
        .flat()
        .map((d: any) => d.id);

      let deals = [];
      if (dealIds.length > 0) {
        const dealsResponse = await fetch(
          'https://api.hubapi.com/crm/v3/objects/deals/batch/read',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              properties: [
                'dealname',
                'dealstage',
                'amount',
                'pipeline',
                'closedate',
                'hubspot_owner_id',
                'createdate'
              ],
              inputs: dealIds.slice(0, 50).map((id: string) => ({ id }))
            })
          }
        );

        if (dealsResponse.ok) {
          const dealsData = await dealsResponse.json();
          deals = dealsData.results;
        }
      }

      // Fetch owners for name mapping
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
            `${owner.firstName} ${owner.lastName}`
          ])
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          timeframe,
          filterDate: filterDate.toISOString(),
          contacts: contacts.slice(0, 100).map((c: any) => ({
            id: c.id,
            firstName: c.properties.firstname,
            lastName: c.properties.lastname,
            email: c.properties.email,
            phone: c.properties.phone,
            owner: ownerMap[c.properties.hubspot_owner_id] || c.properties.assigned_coach || 'Unknown',
            ownerId: c.properties.hubspot_owner_id,
            lifecycleStage: c.properties.lifecyclestage,
            leadStatus: c.properties.hs_lead_status,
            callStatus: c.properties.call_status,
            assessmentScheduled: c.properties.assessment_scheduled,
            assessmentDate: c.properties.assessment_date,
            createdDate: c.properties.createdate,
            lastModified: c.properties.lastmodifieddate,
            lastContacted: c.properties.notes_last_contacted
          })),
          deals: deals.map((d: any) => ({
            id: d.id,
            name: d.properties.dealname,
            stage: d.properties.dealstage,
            amount: d.properties.amount,
            pipeline: d.properties.pipeline,
            closeDate: d.properties.closedate,
            owner: ownerMap[d.properties.hubspot_owner_id] || 'Unknown',
            createdDate: d.properties.createdate
          })),
          ownerMap,
          totalContacts: contacts.length,
          totalDeals: deals.length
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // If type is 'activity' - fetch recent activity
    if (type === 'activity') {
      const activityResponse = await fetch(
        'https://api.hubapi.com/crm/v3/objects/calls/search',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: 'hs_timestamp',
                    operator: 'GTE',
                    value: filterTimestamp.toString()
                  }
                ]
              }
            ],
            properties: [
              'hs_call_title',
              'hs_call_status',
              'hs_call_duration',
              'hs_timestamp',
              'hs_call_to_number',
              'hs_call_from_number',
              'hubspot_owner_id'
            ],
            sorts: [{ propertyName: 'hs_timestamp', direction: 'DESCENDING' }],
            limit: 100
          })
        }
      );

      if (!activityResponse.ok) {
        throw new Error(`HubSpot activity API error: ${activityResponse.status}`);
      }

      const activityData = await activityResponse.json();

      return new Response(
        JSON.stringify({
          success: true,
          timeframe,
          activities: activityData.results.map((a: any) => ({
            id: a.id,
            title: a.properties.hs_call_title,
            status: a.properties.hs_call_status,
            duration: a.properties.hs_call_duration,
            timestamp: a.properties.hs_timestamp,
            toNumber: a.properties.hs_call_to_number,
            fromNumber: a.properties.hs_call_from_number,
            ownerId: a.properties.hubspot_owner_id
          })),
          totalActivities: activityData.results.length
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid type parameter' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error fetching HubSpot data:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to fetch live data from HubSpot'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
