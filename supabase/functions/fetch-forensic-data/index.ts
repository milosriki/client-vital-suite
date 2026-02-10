import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
    if (req.method === 'OPTIONS') {
        return apiCorsPreFlight();
    }

    try {
        // Use HUBSPOT_API_KEY for consistency with other functions
        const HUBSPOT_API_KEY = Deno.env.get('HUBSPOT_API_KEY') || Deno.env.get('HUBSPOT_ACCESS_TOKEN');
        if (!HUBSPOT_API_KEY) {
            throw new Error('HUBSPOT_API_KEY or HUBSPOT_ACCESS_TOKEN not set');
        }

        const { target_identity, limit = 50 } = await req.json().catch(() => ({}));

        if (!target_identity) {
            throw new Error('target_identity (email, phone, or ID) is required');
        }

        console.log(`🔍 Forensic Audit Request for: ${target_identity}`);

        // 1. Search for the Contact in HubSpot to get ID
        const searchResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filterGroups: [{
                    filters: [
                        { propertyName: 'email', operator: 'EQ', value: target_identity },
                        { propertyName: 'phone', operator: 'EQ', value: target_identity },
                        { propertyName: 'hs_object_id', operator: 'EQ', value: target_identity }
                    ]
                }],
                properties: ['firstname', 'lastname', 'email', 'hubspot_owner_id'],
                limit: 1
            })
        });

        const searchData = await searchResponse.json();
        const contact = searchData.results?.[0];

        if (!contact) {
            return apiSuccess({
                success: false,
                message: `No contact found for identity: ${target_identity}`
            });
        }

        const contactId = contact.id;
        console.log(`✅ Found Contact ID: ${contactId}`);

        // 2. Fetch Property History (Audit Log) for Critical Fields
        // We check: Lifecycle Stage, Lead Status, Owner, Hubspot Team
        const propertiesToCheck = ['lifecyclestage', 'hs_lead_status', 'hubspot_owner_id', 'dealstage', 'amount'];

        // Note: HubSpot API for property history is slightly different. 
        // We use the 'propertiesWithHistory' param in the details endpoint or a specific history endpoint if available.
        // For V3, we can request history in the read endpoint.

        const historyResponse = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=${propertiesToCheck.join(',')}&propertiesWithHistory=${propertiesToCheck.join(',')}`, {
            headers: {
                'Authorization': `Bearer ${HUBSPOT_API_KEY}`
            }
        });

        const historyData = await historyResponse.json();

        // 3. Process History into a Timeline
        const timeline: any[] = [];

        propertiesToCheck.forEach(prop => {
            if (historyData.propertiesWithHistory && historyData.propertiesWithHistory[prop]) {
                historyData.propertiesWithHistory[prop].forEach((change: any) => {
                    timeline.push({
                        timestamp: change.timestamp,
                        field: prop,
                        value: change.value,
                        source_type: change.sourceType, // e.g., 'CRM_UI', 'API', 'AUTOMATION'
                        source_id: change.sourceId, // User ID or App ID
                        description: `Changed '${prop}' to '${change.value}' via ${change.sourceType}`
                    });
                });
            }
        });

        // Sort by date desc
        timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // 4. (Optional) Fetch Associated Deals History
        const associationsResponse = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}/associations/deals`, {
            headers: { 'Authorization': `Bearer ${HUBSPOT_API_KEY}` }
        });
        const assocData = await associationsResponse.json();

        const dealAudits = [];
        if (assocData.results) {
            for (const deal of assocData.results) {
                const dealHistoryResponse = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${deal.id}?properties=dealstage,amount&propertiesWithHistory=dealstage,amount`, {
                    headers: { 'Authorization': `Bearer ${HUBSPOT_API_KEY}` }
                });
                const dealData = await dealHistoryResponse.json();
                if (dealData.propertiesWithHistory) {
                    ['dealstage', 'amount'].forEach(prop => {
                        if (dealData.propertiesWithHistory[prop]) {
                            dealData.propertiesWithHistory[prop].forEach((change: any) => {
                                timeline.push({
                                    timestamp: change.timestamp,
                                    field: `DEAL_${prop}`,
                                    value: change.value,
                                    source_type: change.sourceType,
                                    description: `Deal ${deal.id}: Changed '${prop}' to '${change.value}' via ${change.sourceType}`
                                });
                            });
                        }
                    });
                }
            }
        }

        // Re-sort with deal data
        timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return apiSuccess({
            success: true,
            contact: {
                id: contact.id,
                name: `${contact.properties.firstname} ${contact.properties.lastname}`,
                email: contact.properties.email
            },
            audit_log: timeline.slice(0, limit)
        });

    } catch (error: unknown) {
        console.error('Forensic Error:', error);
        return apiError("INTERNAL_ERROR", JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 500);
    }
});
