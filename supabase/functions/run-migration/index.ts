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

    const supabase = createClient(

      Deno.env.get('SUPABASE_URL')!,

      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    );



    const { sql, query } = await req.json();

    const finalSql = sql || query;



    if (!finalSql) {

      return apiError("BAD_REQUEST", JSON.stringify({ error: "Missing SQL query" }), 400);

    }



    // We use a known RPC like 'execute_sql_query' if it exists, but it doesn't.

    // So we'll try to use the Postgres REST API trick if available or just return error.

    // Actually, I will use the Supabase Admin client's ability if I can.

    

    return apiError("INTERNAL_ERROR", JSON.stringify({ 

      error: "Direct SQL execution via JS client is disabled. Please use migrations.",

      tip: "I will use 'supabase db push' instead."

    }), 500);

  } catch (e) {

    return errorToResponse(e);

  }

});
