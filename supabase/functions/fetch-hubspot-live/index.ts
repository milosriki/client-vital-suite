import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleError,
  createSuccessResponse,
  handleCorsPreFlight,
  corsHeaders,
  ErrorCode,
  validateEnvVars,
  parseJsonSafely,
  createSupabaseClient,
} from "../_shared/error-handler.ts";
import { HubSpotSyncManager, HUBSPOT_PROPERTIES } from "../_shared/hubspot-sync-manager.ts";

serve(async (req) => {
  const FUNCTION_NAME = "fetch-hubspot-live";

  if (req.method === 'OPTIONS') {
    return handleCorsPreFlight();
  }

  const supabase = createSupabaseClient(FUNCTION_NAME);

  try {
    // Validate required environment variables
    const envValidation = validateEnvVars(['HUBSPOT_API_KEY'], FUNCTION_NAME);

    if (!envValidation.valid) {
      return handleError(
        new Error(`Missing required environment variables: ${envValidation.missing.join(", ")}`),
        FUNCTION_NAME,
        {
          errorCode: ErrorCode.MISSING_API_KEY,
          context: { missingVars: envValidation.missing },
        }
      );
    }

    const HUBSPOT_API_KEY = Deno.env.get('HUBSPOT_API_KEY')!;

    // Initialize unified HubSpot sync manager
    if (!supabase) {
      return handleError(
        new Error("Failed to create Supabase client"),
        FUNCTION_NAME,
        {
          errorCode: ErrorCode.INTERNAL_ERROR,
          context: { message: "Supabase client is null" },
        }
      );
    }

    const syncManager = new HubSpotSyncManager(supabase, HUBSPOT_API_KEY);

    // Parse request body with error handling
    const parseResult = await parseJsonSafely(req, FUNCTION_NAME);
    if (!parseResult.success) {
      return handleError(
        parseResult.error,
        FUNCTION_NAME,
        {
          supabase,
          errorCode: ErrorCode.VALIDATION_ERROR,
          context: { parseError: parseResult.error.message },
        }
      );
    }

    const body = parseResult.data as Record<string, unknown>;
    // Support both old and new parameter names
    const type = (body.type || body.action || 'all') as string;
    const timeframe = (body.timeframe || 'last_week') as string;
    const setter = body.setter as string | undefined;
    
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

    if (type === 'contacts' || type === 'all' || type === 'fetch-all') {
      // Fetch contacts using unified sync manager
      const filterGroups = [{
        filters: [{
          propertyName: 'createdate',
          operator: 'GTE',
          value: filterTimestamp.toString()
        }]
      }];

      let contactsData;
      try {
        // Use unified property list - SINGLE SOURCE OF TRUTH
        contactsData = await syncManager.fetchHubSpot('contacts', {
          filterGroups,
          properties: HUBSPOT_PROPERTIES.CONTACTS,
          sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
          limit: 100
        });
      } catch (error: any) {
        return handleError(
          new Error(`HubSpot API error: ${error.message}`),
          FUNCTION_NAME,
          {
            supabase,
            errorCode: ErrorCode.HUBSPOT_API_ERROR,
            context: {
              errorMessage: error.message,
              endpoint: 'contacts/search'
            },
          }
        );
      }
      
      // Filter by setter if specified
      let contacts = contactsData.results;
      if (setter) {
        contacts = contacts.filter((c: any) => 
          c.properties.assigned_coach?.toLowerCase().includes(setter.toLowerCase()) ||
          c.properties.hubspot_owner_id?.includes(setter)
        );
      }

      // Fetch deals for these contacts using unified sync manager
      const dealIds = contacts
        .map((c: any) => c.associations?.deals?.results || [])
        .flat()
        .map((d: any) => d.id);

      let deals = [];
      if (dealIds.length > 0) {
        try {
          // Use unified property list and batch fetch method
          deals = await syncManager.batchFetchHubSpot('deals', dealIds, HUBSPOT_PROPERTIES.DEALS);
        } catch (error) {
          console.warn('Failed to fetch deals:', error);
          // Continue without deals
        }
      }

      // Fetch owners using unified sync manager (with caching)
      const ownerMap = await syncManager.fetchOwners();

      const successResponse = createSuccessResponse({
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
        });

      return new Response(
        JSON.stringify(successResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // If type is 'activity' - fetch recent activity
    if (type === 'activity') {
      let activityData;
      try {
        // Use unified sync manager with unified property list
        const filterGroups = [{
          filters: [{
            propertyName: 'hs_timestamp',
            operator: 'GTE',
            value: filterTimestamp.toString()
          }]
        }];

        activityData = await syncManager.fetchHubSpot('calls', {
          filterGroups,
          properties: HUBSPOT_PROPERTIES.CALLS,
          sorts: [{ propertyName: 'hs_timestamp', direction: 'DESCENDING' }],
          limit: 100
        });
      } catch (error: any) {
        return handleError(
          new Error(`HubSpot activity API error: ${error.message}`),
          FUNCTION_NAME,
          {
            supabase,
            errorCode: ErrorCode.HUBSPOT_API_ERROR,
            context: {
              errorMessage: error.message,
              endpoint: 'calls/search'
            },
          }
        );
      }

      const successResponse = createSuccessResponse({
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
        });

      return new Response(
        JSON.stringify(successResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return handleError(
      new Error('Invalid type parameter'),
      FUNCTION_NAME,
      {
        supabase: supabase ?? undefined,
        errorCode: ErrorCode.VALIDATION_ERROR,
        context: { providedType: type },
      }
    );

  } catch (error) {
    // Determine appropriate error code
    let errorCode = ErrorCode.INTERNAL_ERROR;

    if (error instanceof Error) {
      if (error.message?.includes("HubSpot")) {
        errorCode = ErrorCode.HUBSPOT_API_ERROR;
      } else if (error.message?.includes("JSON") || error.message?.includes("parse")) {
        errorCode = ErrorCode.VALIDATION_ERROR;
      }
    }

    return handleError(
      error as Error,
      FUNCTION_NAME,
      {
        supabase: supabase ?? undefined,
        errorCode,
        context: {
          method: req.method,
        },
      }
    );
  }
});
