import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Auth context of the logged in user
    const supabaseClient = createClient(
      // Supabase API URL - env var exported by default.
      Deno.env.get('SUPABASE_URL') ?? '',
      // Supabase API ANON KEY - env var exported by default.
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      // Create client with Auth context of the user that called the function.
      // This way your row-level-security (RLS) policies are applied.
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    console.log("🏥 Starting System Health Check...")

    const tablesToCheck = [
      'client_health_scores',
      'contacts',
      'deals',
      'intervention_log',
      'agent_memory'
    ];

    const results = {};
    let allHealthy = true;

    for (const table of tablesToCheck) {
      const { count, error } = await supabaseClient
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.error(`❌ Table '${table}': Failed - ${error.message}`);
        results[table] = { status: 'error', error: error.message };
        allHealthy = false;
      } else {
        console.log(`✅ Table '${table}': Verified (Count: ${count})`);
        results[table] = { status: 'ok', count };
      }
    }

    // Return the report
    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        healthy: allHealthy,
        checks: results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: allHealthy ? 200 : 503,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
