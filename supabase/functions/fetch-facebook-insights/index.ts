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

    let adAccountId = Deno.env.get('FB_AD_ACCOUNT_ID');
    let currency = 'USD';

    if (!adAccountId) {
      const meResp = await fetch(`https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,currency&access_token=${fbAccessToken}`);
      const meData = await meResp.json();
      if (meData.data && meData.data.length > 0) {
        adAccountId = meData.data[0].id;
        currency = meData.data[0].currency;
      } else {
        throw new Error('No Ad Account found');
      }
    } else {
       const accResp = await fetch(`https://graph.facebook.com/v18.0/${adAccountId}?fields=currency&access_token=${fbAccessToken}`);
       const accData = await accResp.json();
       currency = accData.currency;
    }

    const { date_preset = 'today' } = await req.json().catch(() => ({}));
    const url = `https://graph.facebook.com/v18.0/${adAccountId}/insights?level=ad&fields=date_start,date_stop,campaign_name,campaign_id,adset_name,adset_id,ad_name,ad_id,spend,impressions,clicks,reach,ctr,cpc,cpm&date_preset=${date_preset}&time_increment=1&access_token=${fbAccessToken}&limit=500`;

    const resp = await fetch(url);
    const data = await resp.json();

    if (data.error) {
      throw new Error(`Facebook API Error: ${data.error.message}`);
    }

    const insights = data.data || [];
    const upsertData = insights.map((row: any) => ({
      date: row.date_start,
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      adset_id: row.adset_id,
      adset_name: row.adset_name,
      ad_id: row.ad_id,
      ad_name: row.ad_name,
      spend: parseFloat(row.spend || 0),
      impressions: parseInt(row.impressions || 0),
      clicks: parseInt(row.clicks || 0),
      reach: parseInt(row.reach || 0),
      ctr: parseFloat(row.ctr || 0),
      cpc: parseFloat(row.cpc || 0),
      cpm: parseFloat(row.cpm || 0),
      updated_at: new Date().toISOString()
    }));

    if (upsertData.length > 0) {
      const { error: upsertError } = await supabase
        .from('facebook_ads_insights')
        .upsert(upsertData, { onConflict: 'date,ad_id' });
      if (upsertError) throw new Error(`Supabase Error: ${upsertError.message}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      count: upsertData.length,
      adAccountId,
      currency,
      date_preset
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