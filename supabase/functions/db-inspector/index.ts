import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import {
  handleError,
  corsHeaders,
  ErrorCode,
} from "../_shared/error-handler.ts";

const FUNCTION_NAME = "db-inspector";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    verifyAuth(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get all table names via RPC
    const { data: tables, error } = await supabase.rpc("get_all_tables");

    if (error) {
      return apiError("INTERNAL_ERROR", JSON.stringify({
          error: "Could not list tables via RPC",
          details: error,
          hint: "We might need to rely on the previously detected count of 153 tables.",
        }), 500);
    }

    // Count rows to see which tables are active (limit to 50 to avoid timeout)
    const tableStats = [];

    for (const table of tables.slice(0, 50)) {
      const tableName = typeof table === "string" ? table : table.table_name;
      const { count, error: countError } = await supabase
        .from(tableName)
        .select("*", { count: "exact", head: true });

      tableStats.push({
        name: tableName,
        rows: count,
        status: countError
          ? `Error: ${countError.message}`
          : count === 0
            ? "Empty (Potential Legacy)"
            : "Active",
      });
    }

    return apiSuccess({
          total_tables_found: tables.length,
          sample_analysis: tableStats,
        },
        null,
        2,);
  } catch (error: unknown) {
    return handleError(error, FUNCTION_NAME, {
      errorCode: ErrorCode.UNKNOWN_ERROR,
      context: { action: "inspect_database" },
    });
  }
});
