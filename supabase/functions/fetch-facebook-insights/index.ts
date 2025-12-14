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

    // Get FB Access Token
    const fbAccessToken = Deno.env.get('FB_ACCESS_TOKEN');
    // Also try getting from app_settings if not in env
    // But for now assume Env.
    
    if (!fbAccessToken) {
      throw new Error('FB_ACCESS_TOKEN not configured in Edge Function Secrets');
    }

    // Get Ad Account ID (User needs to provide this, or we fetch the first one)
    // Try env var FB_AD_ACCOUNT_ID
    let adAccountId = Deno.env.get('FB_AD_ACCOUNT_ID');

    if (!adAccountId) {
      // Fetch Ad Accounts
      const meResp = await fetch(`https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name&access_token=${fbAccessToken}`);
      const meData = await meResp.json();
      
      if (meData.data && meData.data.length > 0) {
        adAccountId = meData.data[0].id;
        console.log(`Using first found Ad Account: ${adAccountId} (${meData.data[0].name})`);
      } else {
        throw new Error('No Ad Account found for this Access Token');
      }
    }

    // Fetch Insights
    // Level: ad (since user said "120 ads")
    // Fields: campaign_name, campaign_id, adset_name, ad_name, spend, impressions, clicks, reach
    // Date preset: today (or requesting specific date)
    
    const { date_preset = 'today' } = await req.json().catch(() => ({}));

    const url = `https://graph.facebook.com/v18.0/${adAccountId}/insights?level=ad&fields=campaign_name,campaign_id,adset_name,adset_id,ad_name,ad_id,spend,impressions,clicks,reach,ctr,cpc,cpm&date_preset=${date_preset}&access_token=${fbAccessToken}&limit=500`;

    const resp = await fetch(url);
    const data = await resp.json();

    if (data.error) {
      throw new Error(`Facebook API Error: ${data.error.message}`);
    }

    const insights = data.data || [];
    console.log(`Fetched ${insights.length} ad insights`);

    // Upsert to DB
    const upsertData = insights.map((row: any) => ({
      date: row.date_start || new Date().toISOString().split('T')[0],
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
      const { error } = await supabase
        .from('facebook_ads_insights')
        .upsert(upsertData, { onConflict: 'date,ad_id' });

      if (error) throw error;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      count: upsertData.length,
      adAccountId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching Facebook Insights:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
