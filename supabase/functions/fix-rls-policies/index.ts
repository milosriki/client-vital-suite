import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { corsHeaders } from "../_shared/error-handler.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Tables that need public (anon) read access for the dashboard
    const tables = [
      "funnel_metrics",
      "historical_baselines", 
      "setter_daily_stats",
      "lost_leads",
      "intervention_log",
      "knowledge_base",
      "loss_analysis",
      "client_payment_history",
      "agent_knowledge",
      "ai_execution_metrics",
      "daily_marketing_briefs",
    ];

    const results: Record<string, string> = {};

    for (const table of tables) {
      const policyName = `Public read ${table}`;
      
      // Drop if exists, then create
      const { error: dropErr } = await supabase.rpc("execute_sql_query", {
        sql_query: `DROP POLICY IF EXISTS "${policyName}" ON "${table}"`,
      }).maybeSingle();
      
      // We can't use rpc for DDL, so let's use a different approach
      // Just verify data exists using service role
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      
      results[table] = error ? error.message : `${count} rows (service role can read)`;
    }

    // The real fix: we need to run SQL to add RLS policies
    // Since execute_sql_query is read-only, we'll document what needs to happen
    const sqlStatements = tables.map(t => 
      `CREATE POLICY IF NOT EXISTS "Public read ${t}" ON "${t}" FOR SELECT USING (true);`
    );

    return apiSuccess({
      message: "RLS policies need to be added via Supabase Dashboard SQL Editor or migration",
      current_counts: results,
      sql_to_run: sqlStatements.join("\n"),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
