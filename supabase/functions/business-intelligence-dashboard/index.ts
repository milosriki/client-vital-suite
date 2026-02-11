import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/error-handler.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Default to "today" if not specified, but for "Real Data" dashboard usually we want a specific range
    // or just "today" for the Pulse.
    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "today"; // today, week, month

    // Determine start date
    const now = new Date();
    const startDate = new Date();
    if (range === "today") {
      startDate.setHours(0, 0, 0, 0);
    } else if (range === "week") {
      startDate.setDate(now.getDate() - 7);
    } else if (range === "month") {
      startDate.setDate(now.getDate() - 30);
    }

    const startIso = startDate.toISOString();

    console.log(`📊 Generating Dashboard Report (${range}) from ${startIso}`);

    // --- ZONE A: THE PULSE (Financials) ---
    // 1. Stripe Cash Collected
    const { data: stripeData, error: stripeError } = await supabase
      .from("stripe_transactions")
      .select("amount")
      .eq("status", "succeeded") // Only actual cash
      .gte("created_at", startIso);

    if (stripeError) console.error("Stripe Error:", stripeError);

    const cashCollected =
      stripeData?.reduce((sum, tx) => sum + (tx.amount || 0), 0) || 0;

    // 2. Facebook Ad Spend
    // Note: facebook_ads_insights uses 'date' column (YYYY-MM-DD) usually,
    // depending on migration. Let's check format. 'date' DATE NOT NULL.
    // We need to compare date.
    const startDateStr = startDate.toISOString().split("T")[0];

    const { data: fbData, error: fbError } = await supabase
      .from("facebook_ads_insights")
      .select("spend, clicks, impressions")
      .gte("date", startDateStr);

    if (fbError) console.error("FB Error:", fbError);

    const adSpend =
      fbData?.reduce((sum, row) => sum + (row.spend || 0), 0) || 0;
    const totalClicks =
      fbData?.reduce((sum, row) => sum + (row.clicks || 0), 0) || 0;
    const totalImpressions =
      fbData?.reduce((sum, row) => sum + (row.impressions || 0), 0) || 0;

    // 3. New Leads
    const { count: newLeads, error: leadsError } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startIso);

    if (leadsError) console.error("Leads Error:", leadsError);

    // KPI Calcs
    const roas = adSpend > 0 ? (cashCollected / adSpend).toFixed(2) : "0.00";
    const cpl =
      newLeads && newLeads > 0 ? (adSpend / newLeads).toFixed(2) : "0.00";

    // --- ZONE E: TRUTH AUDIT (The Leak) ---
    // Fetch Verified Truth from AWS Cache
    const { data: truthData } = await supabase
      .from("aws_truth_cache")
      .select("lifetime_revenue");

    // Calculate Verified Revenue (Lifetime)
    const verifiedLifetimeRevenue =
      truthData?.reduce((sum, row) => sum + (row.lifetime_revenue || 0), 0) ||
      0;

    // 3b. Facebook Reported Revenue (for Integrity Score)
    // We try to fetch purchase_value. If column missing in older schema, this might fail or return null.
    // Assuming schema has been updated or standard fields used.
    const { data: fbRevData } = await supabase
      .from("facebook_ads_insights")
      .select("purchase_value") // Standard Meta API field
      .gte("date", startDateStr);

    const fbReportedRevenue =
      fbRevData?.reduce((sum, row) => sum + (row.purchase_value || 0), 0) || 0;

    // Integrity Score (Stripe Cash / FB Claims)
    // If FB says $10k and Stripe says $8k, Score = 0.8.
    // If FB says $0 (no tracking), Score = 1.0 (default to trust cash).
    const integrityScore =
      fbReportedRevenue > 0
        ? Math.min(cashCollected / fbReportedRevenue, 1.2)
        : 1.0;

    // --- ZONE B: GROWTH ENGINE (Trends) ---
    const { data: recentDeals } = await supabase
      .from("deals")
      .select("deal_name, amount, stage, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    // --- ZONE C: FUNNEL (Counts) ---
    const { count: appointments } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startIso);

    const { count: dealsClosed } = await supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startIso)
      .eq("stage", "closedwon");

    // --- ZONE D: CREATIVE (Visual DNA) ---
    // Fetch top ads with purchase_value for True ROI calc
    const { data: topAds } = await supabase
      .from("facebook_ads_insights")
      .select(
        "ad_id, ad_name, spend, impressions, clicks, ctr, cpc, purchase_value",
      )
      .gte("date", startDateStr)
      .order("spend", { ascending: false })
      .limit(6);

    // Construct Response
    const dashboardData = {
      zone_a: {
        title: "The Pulse",
        metrics: {
          true_roas: parseFloat(roas as string),
          cash_collected: cashCollected,
          ad_spend: adSpend,
          new_leads: newLeads || 0,
          cpl: parseFloat(cpl as string),
          integrity_score: integrityScore, // [NEW]
        },
      },
      zone_b: {
        title: "Growth Engine",
        recent_activity: recentDeals || [],
      },
      zone_c: {
        title: "Funnel Truth",
        funnel: {
          impressions: totalImpressions,
          clicks: totalClicks,
          leads: newLeads || 0,
          appointments: appointments || 0,
          sales: dealsClosed || 0,
        },
      },
      zone_d: {
        title: "Creative Brain",
        top_performers: topAds || [],
      },
      truth: {
        verified_lifetime_revenue: verifiedLifetimeRevenue, // [NEW]
        integrity_score: integrityScore, // [NEW]
      },
      meta: {
        range,
        generated_at: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(dashboardData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
