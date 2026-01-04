import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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

    return new Response(JSON.stringify({ count: filtered.length, data: filtered }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
