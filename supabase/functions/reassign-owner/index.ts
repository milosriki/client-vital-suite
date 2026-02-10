import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import {
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
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
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === 'OPTIONS') {
    return apiCorsPreFlight();
  }

  try {
    const HUBSPOT_API_KEY = Deno.env.get('HUBSPOT_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!HUBSPOT_API_KEY) {
      throw new Error('HUBSPOT_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { contact_id, new_owner_id, reason, old_owner_id } = await req.json();

    if (!contact_id || !new_owner_id) {
      return apiError("BAD_REQUEST", JSON.stringify({
        success: false,
        error: 'Missing required fields: contact_id and new_owner_id are required'
      }), 400);
    }

    const contactIdStr = contact_id.toString();

    // ========================================
    // CIRCUIT BREAKER CHECK - Prevent Infinite Loops
    // ========================================
    const circuitCheck = checkCircuitBreaker(contactIdStr);
    if (!circuitCheck.shouldProcess) {
      console.warn(`[CIRCUIT BREAKER] ${circuitCheck.reason}`);
      await logCircuitBreakerTrip(supabase, contactIdStr, circuitCheck.count, circuitCheck.reason!);
      
      return apiRateLimited();
    }

    console.log(`[Reassign Owner] Reassigning contact ${contact_id} to owner ${new_owner_id} (attempt ${circuitCheck.count}/3)`);

    // ========================================
    // RECORD SOURCE BEFORE HUBSPOT UPDATE
    // This ensures when HubSpot sends webhook back, we know to ignore it
    // ========================================
    await recordUpdateSource(supabase, contactIdStr, 'manual_reassign', {
      new_owner_id,
      old_owner_id,
      reason: reason || 'MANUAL_REASSIGNMENT',
      initiated_at: new Date().toISOString()
    });
    console.log(`[Reassign Owner] Recorded source as 'manual_reassign' for ${contactIdStr}`);

    // Update owner in HubSpot
    const hubspotResponse = await fetch(
      `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/${contact_id}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            hubspot_owner_id: new_owner_id
          }
        })
      }
    );

    if (!hubspotResponse.ok) {
      const errorData = await hubspotResponse.json();
      throw new Error(`HubSpot API error: ${JSON.stringify(errorData)}`);
    }

    const hubspotData = await hubspotResponse.json();
    console.log(`[Reassign Owner] Success: ${contact_id} → ${new_owner_id}`);

    // Log reassignment in Supabase
    try {
      await supabase.from('reassignment_log').insert({
        contact_id: contact_id.toString(),
        hubspot_contact_id: contact_id.toString(),
        old_owner_id: old_owner_id || null,
        new_owner_id: new_owner_id.toString(),
        reason: reason || 'MANUAL_REASSIGNMENT',
        reassigned_at: new Date().toISOString(),
        status: 'success'
      });
    } catch (logError) {
      console.warn('[Reassign Owner] Failed to log reassignment:', logError);
      // Continue even if logging fails
    }

    // Update contact in Supabase if exists
    // Mark the source so webhook handler knows to ignore bounce-back
    try {
      await supabase
        .from('contacts')
        .update({ 
          owner_id: new_owner_id.toString(),
          last_updated_by: 'manual_reassign',
          last_updated_source: 'internal',
          updated_at: new Date().toISOString()
        })
        .eq('hubspot_contact_id', contact_id.toString());
    } catch (updateError) {
      console.warn('[Reassign Owner] Failed to update Supabase contact:', updateError);
      // Continue even if update fails
    }

    return apiSuccess({
      success: true,
      contact_id,
      old_owner_id: old_owner_id || null,
      new_owner_id,
      reason: reason || 'MANUAL_REASSIGNMENT',
      hubspot_response: hubspotData,
      reassigned_at: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('[Reassign Owner] Error:', error);
    return apiError("INTERNAL_ERROR", JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), 500);
  }
});
