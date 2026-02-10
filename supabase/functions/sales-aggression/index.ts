import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiValidationError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { validateOrThrow } from "../_shared/data-contracts.ts";
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

    // 1. Identify "UNDER-WORKED" leads (< 5 attempts)
    // We'll use a complex SQL query to join leads with call counts
    const { data: underworked, error: queryError } = await supabase.rpc('get_underworked_leads', {
      min_attempts: 5
    });

    if (queryError) throw queryError;

    // 2. Identify "STALE" deals (Opportunity stage for > 48h)
    const { data: staleDeals, error: staleError } = await supabase.rpc('get_stale_deals', {
      hours_threshold: 48
    });

    if (staleError) throw staleError;

    return apiSuccess({ 
      success: true, 
      underworked_count: underworked?.length || 0,
      stale_deals_count: staleDeals?.length || 0,
      data: {
        underworked,
        staleDeals
      }
    });
  } catch (e) {
    return apiError("INTERNAL_ERROR", JSON.stringify({ error: e.message }), 500);
  }
});
