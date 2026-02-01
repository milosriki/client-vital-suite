import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function inspectDatabase() {
  // 1. Get all table names
  // This query fetches table names from the information_schema
  // Note: We can't run raw SQL easily via JS client without an RPC, 
  // so we'll try to use the 'rpc' if a generic one exists, otherwise we have to deduce from what we can see.
  // Actually, for a quick check, we can try to list common known tables vs suspect ones.
  // BETTER APPROACH: Use the PostgREST API to inspect definitions if exposed, 
  // but listing ALL tables is hard via standard JS client without a specific RPC.
  
  // Let's try to assume we have a `get_all_tables` RPC which was mentioned in previous context (Super Agent Orchestrator).
  
  const { data: tables, error } = await supabase.rpc('get_all_tables');
  
  if (error) {
    return new Response(JSON.stringify({ 
      error: "Could not list tables via RPC", 
      details: error,
      hint: "We might need to rely on the previously detected count of 153 tables."
    }), { headers: { "Content-Type": "application/json" } });
  }

  // If we got tables, let's count rows in them to see which are active
  const tableStats = [];
  
  // Limit to first 50 to avoid timeout if there are really 153
  for (const table of tables.slice(0, 50)) {
    const tableName = typeof table === 'string' ? table : table.table_name;
    const { count, error: countError } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
      
    tableStats.push({
      name: tableName,
      rows: count,
      status: countError ? `Error: ${countError.message}` : (count === 0 ? "Empty (Potential Legacy)" : "Active")
    });
  }

  return new Response(JSON.stringify({
    total_tables_found: tables.length,
    sample_analysis: tableStats
  }, null, 2), { headers: { "Content-Type": "application/json" } });
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
serve(inspectDatabase);
