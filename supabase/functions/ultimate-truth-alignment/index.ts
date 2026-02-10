import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
// Ultimate Truth Alignment Engine
// Aligns events from Facebook CAPI, HubSpot, and AnyTrack to find single source of truth

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hash email for matching (SHA-256) - Deno compatible
async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Normalize phone number for matching
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  // Normalize UAE format (+971...)
  if (digits.startsWith('971')) return '+' + digits;
  if (digits.startsWith('0')) return '+971' + digits.slice(1);
  return '+' + digits;
}

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === 'OPTIONS') {
    return apiCorsPreFlight();
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { time_window_hours = 168, batch_size = 100 } = await req.json().catch(() => ({}));

    console.log('[Ultimate Truth] Starting alignment...');

    // Step 1: Get events from all sources (last 7 days by default)
    const timeWindow = new Date();
    timeWindow.setHours(timeWindow.getHours() - time_window_hours);

    // Get AnyTrack events
    const { data: anytrackEvents } = await supabase
      .from('events')
      .select('*')
      .eq('source', 'anytrack')
      .gte('event_time', timeWindow.toISOString())
      .limit(batch_size);

    // Get HubSpot contacts/deals
    const { data: hubspotContacts } = await supabase
      .from('contacts')
      .select('*')
      .gte('updated_at', timeWindow.toISOString())
      .limit(batch_size);

    const { data: hubspotDeals } = await supabase
      .from('deals')
      .select('*')
      .gte('updated_at', timeWindow.toISOString())
      .limit(batch_size);

    // Get Facebook CAPI events
    const { data: capiEvents } = await supabase
      .from('capi_events_enriched')
      .select('*')
      .gte('event_time', timeWindow.toISOString())
      .limit(batch_size);

    console.log(`[Ultimate Truth] Found: ${anytrackEvents?.length || 0} AnyTrack, ${hubspotContacts?.length || 0} HubSpot contacts, ${hubspotDeals?.length || 0} HubSpot deals, ${capiEvents?.length || 0} CAPI events`);

    const alignedEvents: any[] = [];
    const processedEmails = new Set<string>();

    // Step 2: Match events by email (primary method)
    for (const anytrackEvent of anytrackEvents || []) {
      const email = anytrackEvent.user_data?.em;
      if (!email || processedEmails.has(email)) continue;

      processedEmails.add(email);

      // Find matching HubSpot contact (direct email match - no hash needed)
      const hubspotContact = hubspotContacts?.find(c => 
        c.email?.toLowerCase() === email.toLowerCase()
      );

      // Find matching HubSpot deal
      const hubspotDeal = hubspotDeals?.find(d => 
        d.hubspot_contact_id === hubspotContact?.hubspot_contact_id
      );

      // Find matching CAPI event (direct email match - CAPI already has hashed emails in user_data.em)
      // We can match by checking if CAPI event has email that matches when hashed
      let capiEvent = null;
      if (capiEvents) {
        const emailHash = await hashEmail(email);
        for (const e of capiEvents) {
          // CAPI stores hashed email in user_data.em, or raw email in email field
          if (e.email && e.email.toLowerCase() === email.toLowerCase()) {
            capiEvent = e;
            break;
          }
          // Also check hashed email if available
          if (e.user_data?.em && typeof e.user_data.em === 'string' && e.user_data.em.length === 64) {
            // Looks like a hash, compare
            if (e.user_data.em === emailHash) {
              capiEvent = e;
              break;
            }
          }
        }
      }

      // Get attribution from AnyTrack
      const { data: attributionEventData } = await supabase
        .from('attribution_events')
        .select('*')
        .eq('email', email)
        .order('event_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const attributionEvent = attributionEventData || null;

      // Build aligned event
      const alignedEvent = {
        ultimate_event_id: `ultimate_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        event_name: anytrackEvent.event_name || 'Lead',
        event_time: anytrackEvent.event_time || new Date().toISOString(),
        email: hubspotContact?.email || email,
        phone: normalizePhone(hubspotContact?.phone || anytrackEvent.user_data?.ph),
        first_name: hubspotContact?.first_name || anytrackEvent.user_data?.fn,
        last_name: hubspotContact?.last_name || anytrackEvent.user_data?.ln,
        
        // Attribution (AnyTrack priority)
        attribution_source: attributionEvent?.source || anytrackEvent.custom?.source_attribution || hubspotContact?.first_touch_source,
        attribution_medium: attributionEvent?.medium || anytrackEvent.custom?.medium,
        attribution_campaign: attributionEvent?.campaign || anytrackEvent.custom?.campaign,
        fb_campaign_id: attributionEvent?.fb_campaign_id || anytrackEvent.custom?.fb_campaign_id,
        fb_ad_id: attributionEvent?.fb_ad_id || anytrackEvent.custom?.fb_ad_id,
        fb_adset_id: attributionEvent?.fb_adset_id || anytrackEvent.custom?.fb_adset_id,
        
        // Conversion (HubSpot priority)
        conversion_value: hubspotDeal?.deal_value || attributionEvent?.value || anytrackEvent.custom?.value || 0,
        conversion_currency: 'AED',
        hubspot_deal_id: hubspotDeal?.hubspot_deal_id || null,
        deal_closed_at: hubspotDeal?.close_date || null,
        
        // Source tracking
        has_facebook_capi: !!capiEvent,
        has_hubspot: !!hubspotContact,
        has_anytrack: true,
        
        // Source event IDs
        facebook_capi_event_id: capiEvent?.event_id || null,
        hubspot_contact_id: hubspotContact?.hubspot_contact_id || null,
        hubspot_deal_id_ref: hubspotDeal?.hubspot_deal_id || null,
        anytrack_event_id: anytrackEvent.event_id,
        
        alignment_method: 'email_match',
        alignment_notes: `Matched by email: ${email}`,
      };

      // Calculate confidence score
      const { data: confidenceScore } = await supabase.rpc('calculate_confidence_score', {
        p_has_email: !!alignedEvent.email,
        p_has_phone: !!alignedEvent.phone,
        p_has_fbp: !!capiEvent?.fbp,
        p_has_fbc: !!capiEvent?.fbc,
        p_has_external_id: !!hubspotContact?.hubspot_contact_id,
        p_multiple_sources: (alignedEvent.has_facebook_capi ? 1 : 0) + (alignedEvent.has_hubspot ? 1 : 0) + (alignedEvent.has_anytrack ? 1 : 0) >= 2,
        p_time_aligned: true, // Simplified - could check time windows
      });

      (alignedEvent as any).confidence_score = confidenceScore || 0;
      alignedEvents.push(alignedEvent);
    }

    // Step 3: Upsert aligned events
    if (alignedEvents.length > 0) {
      const { error: upsertError } = await supabase
        .from('ultimate_truth_events')
        .upsert(alignedEvents, {
          onConflict: 'ultimate_event_id',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error('[Ultimate Truth] Upsert error:', upsertError);
        throw upsertError;
      }
    }

    console.log(`[Ultimate Truth] Aligned ${alignedEvents.length} events`);

    return apiSuccess({
        success: true,
        aligned_count: alignedEvents.length,
        anytrack_events: anytrackEvents?.length || 0,
        hubspot_contacts: hubspotContacts?.length || 0,
        hubspot_deals: hubspotDeals?.length || 0,
        capi_events: capiEvents?.length || 0,
        average_confidence: alignedEvents.length > 0 
          ? Math.round(alignedEvents.reduce((sum, e) => sum + (e.confidence_score || 0), 0) / alignedEvents.length)
          : 0,
      });

  } catch (error: unknown) {
    console.error('[Ultimate Truth] Error:', error);
    return apiError("INTERNAL_ERROR", JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }), 500);
  }
});
