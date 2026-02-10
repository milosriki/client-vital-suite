import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

// SHA-256 hash function for PII (Meta CAPI requirement)
async function hashPII(value: string | null | undefined): Promise<string | null> {
  if (!value || value.trim() === "") return null;

  // Normalize: lowercase and trim
  const normalized = value.toLowerCase().trim();

  // Create SHA-256 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Normalize phone number before hashing
async function hashPhone(phone: string | null | undefined): Promise<string | null> {
  if (!phone) return null;
  // Remove all non-digit characters
  const normalized = phone.replace(/\D/g, "");
  if (normalized.length === 0) return null;
  return hashPII(normalized);
}

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
    const { eventData, mode = 'test' } = await req.json();
    
    const STAPE_CAPIG_API_KEY = Deno.env.get('STAPE_CAPIG_API_KEY');
    const STAPE_URL = 'https://ap.stape.info';
    const CAPIG_IDENTIFIER = 'ecxdsmmg';
    
    // Stape is optional - if no key, return success but don't send
    if (!STAPE_CAPIG_API_KEY) {
      console.log('⚠️  STAPE_CAPIG_API_KEY not configured - event stored but not sent to Meta CAPI');
      return apiSuccess({
          success: true,
          mode,
          event_id: `evt_${Date.now()}`,
          message: 'Stape API key not configured - event stored but not sent',
          stored_only: true
        });
    }

    console.log('Sending event to Stape CAPI:', {
      mode,
      event_name: eventData.event_name,
      email: eventData.user_data?.email
    });

    // Hash PII for Meta CAPI compliance (SHA-256 required)
    const hashedEmail = await hashPII(eventData.user_data?.email);
    const hashedPhone = await hashPhone(eventData.user_data?.phone);
    const hashedFirstName = await hashPII(eventData.user_data?.first_name);
    const hashedLastName = await hashPII(eventData.user_data?.last_name);

    // Prepare the event payload for Stape CAPI
    const payload: any = {
      event_name: eventData.event_name || 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url: 'https://www.personaltrainersdubai.com',
      user_data: {
        em: hashedEmail,  // SHA-256 hashed email
        ph: hashedPhone,  // SHA-256 hashed phone
        fn: hashedFirstName,  // SHA-256 hashed first name
        ln: hashedLastName,  // SHA-256 hashed last name
        external_id: eventData.user_data?.external_id || null,
        fbp: eventData.user_data?.fbp || null,
        fbc: eventData.user_data?.fbc || null,
      },
      custom_data: {
        currency: eventData.custom_data?.currency || 'AED',
        value: eventData.custom_data?.value || 0,
        content_name: eventData.custom_data?.content_name || null,
      }
    };

    // Add test_event_code if in test mode
    if (mode === 'test' && eventData.test_event_code) {
      payload.test_event_code = eventData.test_event_code;
    }

    // Send to Stape CAPI
    const stapeResponse = await fetch(`${STAPE_URL}/stape-api/${CAPIG_IDENTIFIER}/v1/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STAPE_CAPIG_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await stapeResponse.json();
    
    console.log('Stape CAPI response:', {
      status: stapeResponse.status,
      data: responseData
    });

    if (!stapeResponse.ok) {
      throw new Error(`Stape CAPI error: ${JSON.stringify(responseData)}`);
    }

    return apiSuccess({
        success: true,
        mode,
        event_id: responseData.event_id || `evt_${Date.now()}`,
        response: responseData
      });
  } catch (error: unknown) {
    console.error('Error in send-to-stape-capi:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return apiError("INTERNAL_ERROR", JSON.stringify({
        success: false,
        error: errorMessage
      }), 500);
  }
});
