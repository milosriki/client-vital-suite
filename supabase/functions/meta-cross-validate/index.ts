import { createClient } from "jsr:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing or invalid authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Parse period
  let periodStart: string;
  let periodEnd: string;
  try {
    const body = await req.json().catch(() => null);
    if (body?.period_start && body?.period_end) {
      periodStart = body.period_start;
      periodEnd = body.period_end;
    } else {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      periodStart = start.toISOString().split("T")[0];
      periodEnd = end.toISOString().split("T")[0];
    }
  } catch {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    periodStart = start.toISOString().split("T")[0];
    periodEnd = end.toISOString().split("T")[0];
  }

  try {
    // 1. Meta data
    const { data: metaData } = await supabase.rpc("execute_sql", {
      query: `SELECT COALESCE(SUM(spend),0) as meta_spend, COALESCE(SUM(conversions),0) as meta_conversions, CASE WHEN SUM(conversions) > 0 THEN SUM(spend)/SUM(conversions) END as meta_cpa FROM facebook_ads_insights WHERE date >= '${periodStart}' AND date <= '${periodEnd}'`,
    });

    // Fallback: query via .from if rpc not available
    let metaSpend = 0, metaConversions = 0, metaCpa: number | null = null, metaRoas: number | null = null;

    const { data: metaRows } = await supabase
      .from("facebook_ads_insights")
      .select("spend, conversions, roas")
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (metaRows && metaRows.length > 0) {
      metaSpend = metaRows.reduce((s: number, r: any) => s + (Number(r.spend) || 0), 0);
      metaConversions = metaRows.reduce((s: number, r: any) => s + (Number(r.conversions) || 0), 0);
      metaCpa = metaConversions > 0 ? metaSpend / metaConversions : null;
      // Weighted average ROAS from Meta
      const totalSpendForRoas = metaRows.reduce((s: number, r: any) => s + (r.roas != null && r.spend ? Number(r.spend) : 0), 0);
      const weightedRoas = metaRows.reduce((s: number, r: any) => s + (Number(r.roas) || 0) * (Number(r.spend) || 0), 0);
      metaRoas = totalSpendForRoas > 0 ? weightedRoas / totalSpendForRoas : null;
    }

    // 2. HubSpot leads
    const { count: hubspotLeads } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("lifecycle_stage", "lead")
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd);

    const { count: hubspotNewContacts } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd);

    // 3. Stripe revenue from deals
    const { data: dealRows } = await supabase
      .from("deals")
      .select("amount")
      .eq("dealstage", "closedwon")
      .gte("closedate", periodStart)
      .lte("closedate", periodEnd);

    const stripeRevenue = dealRows
      ? dealRows.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0)
      : 0;

    // 4. Calculate real metrics
    const leads = hubspotLeads || 0;
    const newContacts = hubspotNewContacts || 0;
    const realCpl = newContacts > 0 ? metaSpend / newContacts : null;
    const realRoas = metaSpend > 0 ? stripeRevenue / metaSpend : null;
    const cpaDiffPct = realCpl !== null && metaCpa !== null && metaCpa > 0
      ? ((realCpl - metaCpa) / metaCpa) * 100
      : null;
    const roasDiffPct = realRoas !== null && metaRoas !== null && metaRoas > 0
      ? ((realRoas - metaRoas) / metaRoas) * 100
      : null;

    // 5. Generate insight
    let insight = "";
    if (cpaDiffPct !== null) {
      const direction = cpaDiffPct < 0 ? "lower" : "higher";
      insight += `Real CPL is ${Math.abs(Math.round(cpaDiffPct))}% ${direction} than Meta-reported CPA. `;
    }
    if (roasDiffPct !== null) {
      const direction = roasDiffPct > 0 ? "higher" : "lower";
      insight += `Real ROAS is ${Math.abs(Math.round(roasDiffPct))}% ${direction} than Meta-reported ROAS. `;
    }
    if (cpaDiffPct !== null && cpaDiffPct < 0) {
      insight += "Meta undercounts conversions due to 7-day attribution window vs actual 30-day sales cycle.";
    }

    // 6. Upsert to meta_cross_validation
    await supabase.from("meta_cross_validation").upsert(
      {
        period_start: periodStart,
        period_end: periodEnd,
        meta_spend: metaSpend,
        meta_conversions: metaConversions,
        meta_cpa: metaCpa,
        meta_roas: metaRoas,
        hubspot_leads: leads,
        hubspot_new_contacts: newContacts,
        stripe_revenue: stripeRevenue,
        real_cpl: realCpl,
        real_roas: realRoas,
        cpa_diff_pct: cpaDiffPct,
        roas_diff_pct: roasDiffPct,
        insight,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "period_start,period_end" }
    );

    const result = {
      meta: {
        spend: Math.round(metaSpend),
        conversions: metaConversions,
        cpa: metaCpa ? Math.round(metaCpa) : null,
        roas: metaRoas ? Math.round(metaRoas * 10) / 10 : null,
      },
      hubspot: { leads, new_contacts: newContacts },
      stripe: { revenue: Math.round(stripeRevenue) },
      real: {
        cpl: realCpl ? Math.round(realCpl) : null,
        roas: realRoas ? Math.round(realRoas * 10) / 10 : null,
      },
      diff: {
        cpa_pct: cpaDiffPct ? Math.round(cpaDiffPct * 10) / 10 : null,
        roas_pct: roasDiffPct ? Math.round(roasDiffPct * 10) / 10 : null,
      },
      insight: insight.trim(),
      period: { start: periodStart, end: periodEnd },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
