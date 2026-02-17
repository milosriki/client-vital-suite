import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();
    const periods = [30, 60, 90];
    const entries = [];

    for (const days of periods) {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);

      const { data: insights, error } = await supabase
        .from('facebook_ads_insights')
        .select('spend, impressions, clicks, leads, campaign_id, date')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', now.toISOString().split('T')[0]);

      if (error) throw error;
      if (!insights || insights.length === 0) continue;

      const totalSpend = insights.reduce((s, r) => s + (Number(r.spend) || 0), 0);
      const totalLeads = insights.reduce((s, r) => s + (Number(r.leads) || 0), 0);
      const totalClicks = insights.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
      const totalImpressions = insights.reduce((s, r) => s + (Number(r.impressions) || 0), 0);

      const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
      const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      // Get deals in period for close rate
      const { data: dealsInPeriod } = await supabase
        .from('deals')
        .select('stage, amount')
        .gte('close_date', startDate.toISOString().split('T')[0])
        .lte('close_date', now.toISOString().split('T')[0]);

      const totalDeals = dealsInPeriod?.length || 0;
      const wonDeals = (dealsInPeriod || []).filter(d => ['closedwon', 'closed_won'].includes(d.stage));
      const totalRevenue = wonDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
      const closeRate = totalDeals > 0 ? wonDeals.length / totalDeals : 0;
      const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

      entries.push({
        dimension_type: 'overall',
        dimension_value: 'all_campaigns',
        period_days: days,
        avg_roas: Number(avgRoas.toFixed(4)),
        avg_cpl: Number(avgCpl.toFixed(2)),
        avg_cpa: 0,
        avg_ghost_rate: 0,
        avg_close_rate: Number(closeRate.toFixed(4)),
        total_spend: Number(totalSpend.toFixed(2)),
        total_leads: totalLeads,
        total_assessments: 0,
        total_purchases: wonDeals.length,
        total_revenue: Number(totalRevenue.toFixed(2)),
        trend_direction: 'stable',
        trend_pct: 0,
        computed_at: now.toISOString(),
        created_at: now.toISOString(),
      });
    }

    if (entries.length === 0) {
      return new Response(JSON.stringify({ message: 'No data to compute baselines', inserted: 0 }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { error: insertError } = await supabase
      .from('historical_baselines')
      .upsert(entries, { onConflict: 'dimension_type,dimension_value,period_days', ignoreDuplicates: false });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ 
      message: `Computed baselines for ${entries.length} periods`,
      entries: entries.length 
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
