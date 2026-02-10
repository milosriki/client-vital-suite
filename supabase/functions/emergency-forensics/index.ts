import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === 'OPTIONS') return apiCorsPreFlight();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { query } = await req.json();
    
    // Direct database query bypassing RPC
    const sql = query || "SELECT * FROM stripe_events WHERE (type LIKE '%.deleted' OR type = 'customer.subscription.deleted') AND created_at BETWEEN '2025-06-01' AND '2025-06-30' ORDER BY created_at DESC";
    
    // Fallback: search for Abdallah specifically in that range
    const { data, error } = await supabase
      .from('stripe_events')
      .select('id, event_type, created_at, data')
      .gte('created_at', '2025-06-01')
      .lte('created_at', '2025-06-30');

    if (error) throw error;

    // Filter for deletions in JS to ensure we get results even if LIKE fails
    const filtered = data.filter((e: any) => 
      (e.event_type && e.event_type.includes('.deleted')) || 
      JSON.stringify(e.data).includes('didouchabdellah')
    );

    return apiSuccess({ count: filtered.length, data: filtered });

    return apiSuccess({ data });
  } catch (e) {
    return apiError("INTERNAL_ERROR", JSON.stringify({ error: e.message }), 500);
  }
});
