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

    return new Response(JSON.stringify({ 
      success: true, 
      underworked_count: underworked?.length || 0,
      stale_deals_count: staleDeals?.length || 0,
      data: {
        underworked,
        staleDeals
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
