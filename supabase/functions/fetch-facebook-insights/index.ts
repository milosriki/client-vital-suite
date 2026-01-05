import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const fbAccessToken = Deno.env.get('FB_ACCESS_TOKEN');
    if (!fbAccessToken) {
      throw new Error('FB_ACCESS_TOKEN not configured in Edge Function Secrets');
    }

    // List all accounts to verify we are using the correct one
    const meResp = await fetch(`https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,currency&access_token=${fbAccessToken}`);
    const meData = await meResp.json();
    const allAccounts = meData.data || [];

    let adAccountId = Deno.env.get('FB_AD_ACCOUNT_ID');
    let currency = 'AED';

    if (!adAccountId && allAccounts.length > 0) {
      adAccountId = allAccounts[0].id;
      currency = allAccounts[0].currency;
    } else if (adAccountId) {
       const matchedAcc = allAccounts.find(a => a.id === adAccountId || a.id === `act_${adAccountId}`);
       if (matchedAcc) currency = matchedAcc.currency;
    }

    const { date_preset = 'today' } = await req.json().catch(() => ({}));
    const url = `https://graph.facebook.com/v18.0/${adAccountId}/insights?level=campaign&fields=campaign_name,spend,account_id&date_preset=${date_preset}&time_increment=1&access_token=${fbAccessToken}&limit=500`;

    const resp = await fetch(url);
    const data = await resp.json();

    if (data.error) {
      throw new Error(`Facebook API Error: ${data.error.message}`);
    }

    const campaignBreakdown = data.data || [];
    
    return new Response(JSON.stringify({ 
      success: true, 
      adAccountId,
      currency,
      date_preset,
      total_spend: campaignBreakdown.reduce((sum: number, c: any) => sum + parseFloat(c.spend), 0),
      breakdown: campaignBreakdown.map((c: any) => ({ name: c.campaign_name, spend: c.spend })),
      all_accounts: allAccounts.map((a: any) => ({ id: a.id, name: a.name, currency: a.currency }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});