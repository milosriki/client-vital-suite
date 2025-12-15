import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * HubSpot Live Query - FULL FUNCTIONS
 * 
 * READ Operations:
 * - latest_contacts: Get newest contacts
 * - latest_deals: Get newest deals
 * - search: Search contacts/deals
 * - today_activity: Today's new leads/deals
 * - owners: Get all owners (your team)
 * - contact_detail: Full contact with history
 * - conversations: Live chat/conversations
 * - pipelines: Get all pipelines/stages
 * 
 * WRITE Operations:
 * - reassign: Change contact owner
 * - update_contact: Update contact properties
 * - update_deal: Update deal properties
 * - log_call: Log a call activity
 * - log_note: Add note to contact
 */

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
    const body = await req.json();
    const { query, limit = 10, contact_id, deal_id, search_term, new_owner_id, properties, note_body, call_duration } = body;

    const headers = {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json',
    };

    // Fetch owners for name mapping (used by multiple queries)
    const ownersResponse = await fetch('https://api.hubapi.com/crm/v3/owners', { headers });
    const ownersData = await ownersResponse.json();
    const ownerMap: Record<string, { name: string; email: string; id: string }> = {};
    const ownersList: any[] = [];
    for (const owner of ownersData.results || []) {
      ownerMap[owner.id] = {
        id: owner.id,
        name: `${owner.firstName} ${owner.lastName}`,
        email: owner.email
      };
      ownersList.push({
        id: owner.id,
        name: `${owner.firstName} ${owner.lastName}`,
        email: owner.email,
        firstName: owner.firstName,
        lastName: owner.lastName
      });
    }

    // =====================
    // QUERY: owners - Get all team members
    // =====================
    if (query === 'owners') {
      return new Response(
        JSON.stringify({
          success: true,
          query: 'owners',
          fetched_at: new Date().toISOString(),
          count: ownersList.length,
          owners: ownersList
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================
    // QUERY: latest_contacts
    // =====================
    if (query === 'latest_contacts') {
      const response = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts/search',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
            properties: [
              'firstname', 'lastname', 'email', 'phone', 'mobilephone',
              'hubspot_owner_id', 'lifecyclestage', 'hs_lead_status',
              'createdate', 'lastmodifieddate', 'city',
              'hs_analytics_source', 'num_notes', 'notes_last_contacted',
              'hs_conversations_visitor_email', 'recent_conversion_event_name'
            ],
            limit: Math.min(limit, 100)
          })
        }
      );

      const data = await response.json();
      
      const contacts = (data.results || []).map((c: any) => ({
        id: c.id,
        name: `${c.properties.firstname || ''} ${c.properties.lastname || ''}`.trim() || 'Unknown',
        email: c.properties.email,
        phone: c.properties.phone || c.properties.mobilephone,
        owner: ownerMap[c.properties.hubspot_owner_id]?.name || 'Unassigned',
        owner_id: c.properties.hubspot_owner_id,
        lifecycle_stage: c.properties.lifecyclestage,
        lead_status: c.properties.hs_lead_status,
        city: c.properties.city,
        source: c.properties.hs_analytics_source,
        created_at: c.properties.createdate,
        last_modified: c.properties.lastmodifieddate,
        last_contacted: c.properties.notes_last_contacted,
        has_chat: !!c.properties.hs_conversations_visitor_email,
        conversion_event: c.properties.recent_conversion_event_name
      }));

      return new Response(
        JSON.stringify({ 
          success: true, 
          query: 'latest_contacts',
          count: contacts.length,
          fetched_at: new Date().toISOString(),
          contacts 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================
    // QUERY: latest_deals
    // =====================
    if (query === 'latest_deals') {
      const response = await fetch(
        'https://api.hubapi.com/crm/v3/objects/deals/search',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
            properties: [
              'dealname', 'amount', 'dealstage', 'pipeline',
              'hubspot_owner_id', 'closedate', 'createdate',
              'hs_lastmodifieddate', 'hs_deal_stage_probability'
            ],
            limit: Math.min(limit, 100)
          })
        }
      );

      const data = await response.json();
      
      const deals = (data.results || []).map((d: any) => ({
        id: d.id,
        name: d.properties.dealname,
        amount: parseFloat(d.properties.amount) || 0,
        stage: d.properties.dealstage,
        pipeline: d.properties.pipeline,
        owner: ownerMap[d.properties.hubspot_owner_id]?.name || 'Unassigned',
        owner_id: d.properties.hubspot_owner_id,
        close_date: d.properties.closedate,
        created_at: d.properties.createdate,
        last_modified: d.properties.hs_lastmodifieddate,
        probability: d.properties.hs_deal_stage_probability
      }));

      return new Response(
        JSON.stringify({ 
          success: true, 
          query: 'latest_deals',
          count: deals.length,
          fetched_at: new Date().toISOString(),
          deals 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================
    // QUERY: contact_detail - Full contact with engagements
    // =====================
    if (query === 'contact_detail' && contact_id) {
      // Get contact with all properties
      const contactResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts/${contact_id}?associations=deals,calls,emails,meetings,notes,companies`,
        { headers }
      );
      const contact = await contactResponse.json();

      // Get recent calls
      let calls = [];
      try {
        const callsResponse = await fetch(
          'https://api.hubapi.com/crm/v3/objects/calls/search',
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              filterGroups: [{
                filters: [{
                  propertyName: 'associations.contact',
                  operator: 'EQ',
                  value: contact_id
                }]
              }],
              properties: ['hs_call_title', 'hs_call_status', 'hs_call_duration', 'hs_timestamp', 'hs_call_body'],
              sorts: [{ propertyName: 'hs_timestamp', direction: 'DESCENDING' }],
              limit: 10
            })
          }
        );
        const callsData = await callsResponse.json();
        calls = (callsData.results || []).map((c: any) => ({
          id: c.id,
          title: c.properties.hs_call_title,
          status: c.properties.hs_call_status,
          duration: c.properties.hs_call_duration,
          timestamp: c.properties.hs_timestamp,
          notes: c.properties.hs_call_body
        }));
      } catch (e) {
        console.log('Could not fetch calls:', e);
      }

      // Get recent notes
      let notes = [];
      try {
        const notesResponse = await fetch(
          'https://api.hubapi.com/crm/v3/objects/notes/search',
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              filterGroups: [{
                filters: [{
                  propertyName: 'associations.contact',
                  operator: 'EQ',
                  value: contact_id
                }]
              }],
              properties: ['hs_note_body', 'hs_timestamp', 'hubspot_owner_id'],
              sorts: [{ propertyName: 'hs_timestamp', direction: 'DESCENDING' }],
              limit: 10
            })
          }
        );
        const notesData = await notesResponse.json();
        notes = (notesData.results || []).map((n: any) => ({
          id: n.id,
          body: n.properties.hs_note_body,
          timestamp: n.properties.hs_timestamp,
          owner: ownerMap[n.properties.hubspot_owner_id]?.name || 'Unknown'
        }));
      } catch (e) {
        console.log('Could not fetch notes:', e);
      }

      return new Response(
        JSON.stringify({
          success: true,
          query: 'contact_detail',
          fetched_at: new Date().toISOString(),
          contact: {
            id: contact.id,
            properties: contact.properties,
            owner: ownerMap[contact.properties?.hubspot_owner_id]?.name || 'Unassigned',
            associations: contact.associations
          },
          recent_calls: calls,
          recent_notes: notes
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================
    // QUERY: conversations - Live Chat/Inbox
    // =====================
    if (query === 'conversations') {
      const convoResponse = await fetch(
        'https://api.hubapi.com/conversations/v3/conversations/threads?limit=' + Math.min(limit, 50),
        { headers }
      );
      
      let conversations = [];
      if (convoResponse.ok) {
        const convoData = await convoResponse.json();
        conversations = (convoData.results || []).map((c: any) => ({
          id: c.id,
          status: c.status,
          created_at: c.createdAt,
          updated_at: c.updatedAt,
          channel: c.channelType,
          assigned_to: c.assignedTo,
          subject: c.subject
        }));
      } else {
        // Conversations API might not be available
        const errorText = await convoResponse.text();
        console.log('Conversations API response:', errorText);
      }

      return new Response(
        JSON.stringify({
          success: true,
          query: 'conversations',
          fetched_at: new Date().toISOString(),
          count: conversations.length,
          conversations,
          note: conversations.length === 0 ? 'Conversations API may require Service Hub Professional or higher' : null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================
    // QUERY: pipelines - Get all pipelines and stages
    // =====================
    if (query === 'pipelines') {
      const pipelinesResponse = await fetch(
        'https://api.hubapi.com/crm/v3/pipelines/deals',
        { headers }
      );
      const pipelinesData = await pipelinesResponse.json();

      return new Response(
        JSON.stringify({
          success: true,
          query: 'pipelines',
          fetched_at: new Date().toISOString(),
          pipelines: (pipelinesData.results || []).map((p: any) => ({
            id: p.id,
            label: p.label,
            display_order: p.displayOrder,
            stages: (p.stages || []).map((s: any) => ({
              id: s.id,
              label: s.label,
              display_order: s.displayOrder,
              probability: s.metadata?.probability
            }))
          }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================
    // QUERY: search
    // =====================
    if (query === 'search' && search_term) {
      const [contactsResponse, dealsResponse] = await Promise.all([
        fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: search_term,
            properties: ['firstname', 'lastname', 'email', 'phone', 'hubspot_owner_id', 'lifecyclestage', 'createdate'],
            limit: Math.min(limit, 20)
          })
        }),
        fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: search_term,
            properties: ['dealname', 'amount', 'dealstage', 'hubspot_owner_id', 'createdate'],
            limit: Math.min(limit, 20)
          })
        })
      ]);

      const contactsData = await contactsResponse.json();
      const dealsData = await dealsResponse.json();

      return new Response(
        JSON.stringify({
          success: true,
          query: 'search',
          search_term,
          fetched_at: new Date().toISOString(),
          contacts: (contactsData.results || []).map((c: any) => ({
            id: c.id,
            name: `${c.properties.firstname || ''} ${c.properties.lastname || ''}`.trim(),
            email: c.properties.email,
            phone: c.properties.phone,
            owner: ownerMap[c.properties.hubspot_owner_id]?.name || 'Unassigned',
            owner_id: c.properties.hubspot_owner_id,
            stage: c.properties.lifecyclestage,
            created: c.properties.createdate
          })),
          deals: (dealsData.results || []).map((d: any) => ({
            id: d.id,
            name: d.properties.dealname,
            amount: d.properties.amount,
            stage: d.properties.dealstage,
            owner: ownerMap[d.properties.hubspot_owner_id]?.name || 'Unassigned',
            created: d.properties.createdate
          }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================
    // QUERY: today_activity
    // =====================
    if (query === 'today_activity') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [contactsResponse, dealsResponse] = await Promise.all([
        fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            filterGroups: [{
              filters: [{
                propertyName: 'createdate',
                operator: 'GTE',
                value: todayStart.getTime().toString()
              }]
            }],
            properties: ['firstname', 'lastname', 'email', 'phone', 'hubspot_owner_id', 'lifecyclestage', 'createdate', 'hs_analytics_source'],
            sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
            limit: 50
          })
        }),
        fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            filterGroups: [{
              filters: [{
                propertyName: 'createdate',
                operator: 'GTE',
                value: todayStart.getTime().toString()
              }]
            }],
            properties: ['dealname', 'amount', 'dealstage', 'hubspot_owner_id', 'createdate'],
            sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
            limit: 50
          })
        })
      ]);

      const contactsData = await contactsResponse.json();
      const dealsData = await dealsResponse.json();

      return new Response(
        JSON.stringify({
          success: true,
          query: 'today_activity',
          date: todayStart.toISOString().split('T')[0],
          fetched_at: new Date().toISOString(),
          new_contacts: (contactsData.results || []).map((c: any) => ({
            id: c.id,
            name: `${c.properties.firstname || ''} ${c.properties.lastname || ''}`.trim(),
            email: c.properties.email,
            phone: c.properties.phone,
            owner: ownerMap[c.properties.hubspot_owner_id]?.name || 'Unassigned',
            owner_id: c.properties.hubspot_owner_id,
            stage: c.properties.lifecyclestage,
            source: c.properties.hs_analytics_source,
            created_at: c.properties.createdate
          })),
          new_deals: (dealsData.results || []).map((d: any) => ({
            id: d.id,
            name: d.properties.dealname,
            amount: parseFloat(d.properties.amount) || 0,
            stage: d.properties.dealstage,
            owner: ownerMap[d.properties.hubspot_owner_id]?.name || 'Unassigned',
            created_at: d.properties.createdate
          })),
          totals: {
            contacts_today: contactsData.total || contactsData.results?.length || 0,
            deals_today: dealsData.total || dealsData.results?.length || 0
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================
    // ACTION: reassign - Change contact owner
    // =====================
    if (query === 'reassign' && contact_id && new_owner_id) {
      const reassignResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts/${contact_id}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            properties: {
              hubspot_owner_id: new_owner_id
            }
          })
        }
      );

      if (!reassignResponse.ok) {
        const errorData = await reassignResponse.json();
        throw new Error(`Reassign failed: ${JSON.stringify(errorData)}`);
      }

      const result = await reassignResponse.json();
      const newOwnerName = ownerMap[new_owner_id]?.name || 'Unknown';

      // Log to Supabase
      try {
        await supabase.from('reassignment_log').insert({
          contact_id: contact_id.toString(),
          hubspot_contact_id: contact_id.toString(),
          new_owner_id: new_owner_id.toString(),
          reason: 'MANUAL_REASSIGNMENT',
          reassigned_at: new Date().toISOString(),
          status: 'success'
        });
      } catch (e) {
        console.log('Could not log reassignment:', e);
      }

      return new Response(
        JSON.stringify({
          success: true,
          query: 'reassign',
          contact_id,
          new_owner_id,
          new_owner_name: newOwnerName,
          reassigned_at: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================
    // ACTION: update_contact
    // =====================
    if (query === 'update_contact' && contact_id && properties) {
      const updateResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts/${contact_id}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ properties })
        }
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(`Update failed: ${JSON.stringify(errorData)}`);
      }

      const result = await updateResponse.json();

      return new Response(
        JSON.stringify({
          success: true,
          query: 'update_contact',
          contact_id,
          updated_properties: Object.keys(properties),
          updated_at: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================
    // ACTION: log_note
    // =====================
    if (query === 'log_note' && contact_id && note_body) {
      // Create note
      const noteResponse = await fetch(
        'https://api.hubapi.com/crm/v3/objects/notes',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            properties: {
              hs_note_body: note_body,
              hs_timestamp: new Date().toISOString()
            }
          })
        }
      );

      if (!noteResponse.ok) {
        const errorData = await noteResponse.json();
        throw new Error(`Note creation failed: ${JSON.stringify(errorData)}`);
      }

      const note = await noteResponse.json();

      // Associate note with contact
      await fetch(
        `https://api.hubapi.com/crm/v3/objects/notes/${note.id}/associations/contacts/${contact_id}/note_to_contact`,
        {
          method: 'PUT',
          headers
        }
      );

      return new Response(
        JSON.stringify({
          success: true,
          query: 'log_note',
          note_id: note.id,
          contact_id,
          created_at: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================
    // Unknown query - show available options
    // =====================
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Unknown query type',
        available_queries: {
          read: ['latest_contacts', 'latest_deals', 'search', 'today_activity', 'owners', 'contact_detail', 'conversations', 'pipelines'],
          write: ['reassign', 'update_contact', 'log_note']
        },
        usage_examples: {
          latest_contacts: { query: 'latest_contacts', limit: 5 },
          latest_deals: { query: 'latest_deals', limit: 5 },
          search: { query: 'search', search_term: 'john', limit: 10 },
          today_activity: { query: 'today_activity' },
          owners: { query: 'owners' },
          contact_detail: { query: 'contact_detail', contact_id: '123456' },
          conversations: { query: 'conversations', limit: 20 },
          pipelines: { query: 'pipelines' },
          reassign: { query: 'reassign', contact_id: '123456', new_owner_id: '789' },
          update_contact: { query: 'update_contact', contact_id: '123456', properties: { lifecyclestage: 'customer' } },
          log_note: { query: 'log_note', contact_id: '123456', note_body: 'Called - interested in premium package' }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
