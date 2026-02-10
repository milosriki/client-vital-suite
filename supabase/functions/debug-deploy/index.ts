import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode, corsHeaders as defaultCorsHeaders } from "../_shared/error-handler.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

serve(async (req) => {
  try {
    verifyAuth(req); // Security Hardening
    const url = Deno.env.get("SUPABASE_URL") ?? "https://example.com";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "key";
    const client = createClient(url, key);

    return apiSuccess({ message: "Supabase Client Init OK" });
  } catch (e: any) {
    return errorToResponse(e);
  }
});
