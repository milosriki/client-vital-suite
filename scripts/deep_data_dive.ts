import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { config } from "dotenv";
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function deepDive() {
  console.log("🤿 STARTING DEEP DATA DIVE...");

  // 1. FACEBOOK INSIGHTS (Cached)
  const { data: fbData } = await supabase
    .from("facebook_ads_insights")
    .select("*")
    .order("spend", { ascending: false });

  // Aggregates
  const totalSpend = fbData?.reduce((sum, r) => sum + (r.spend || 0), 0) || 0;
  const totalImpressions =
    fbData?.reduce((sum, r) => sum + (r.impressions || 0), 0) || 0;
  const totalClicks = fbData?.reduce((sum, r) => sum + (r.clicks || 0), 0) || 0;
  const uniqueCampaigns = [...new Set(fbData?.map((r) => r.campaign_name))];
  const uniqueAds = [...new Set(fbData?.map((r) => r.ad_name))];

  console.log("\n📊 FACEBOOK (Cached Data)");
  console.log(`- Total Spend: $${totalSpend.toFixed(2)}`);
  console.log(`- Impressions: ${totalImpressions}`);
  console.log(`- Clicks: ${totalClicks}`);
  console.log(`- CTR: ${((totalClicks / totalImpressions) * 100).toFixed(2)}%`);
  console.log(`- CPC: $${(totalSpend / totalClicks).toFixed(2)}`);
  console.log(`- Campaigns: ${uniqueCampaigns.length}`);
  console.log(`- Unique Ads: ${uniqueAds.length}`);

  // 2. HUBSPOT LEADS (Recent)
  const { data: leads } = await supabase
    .from("leads")
    .select("status, source, lead_score, created_at, ai_analysis")
    .gte("created_at", "2026-01-01"); // Match timeframe roughly

  const totalLeads = leads?.length || 0;
  const sourceBreakdown = leads?.reduce(
    (acc, l) => {
      acc[l.source || "unknown"] = (acc[l.source || "unknown"] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log("\n📥 LEADS (Since Jan 1, 2026)");
  console.log(`- Total New Leads: ${totalLeads}`);
  console.log("- Source Breakdown:", JSON.stringify(sourceBreakdown, null, 2));

  // 3. DEALS & REVENUE
  const { data: deals } = await supabase
    .from("deals")
    .select("deal_name, amount, stage, source, created_at")
    .gte("created_at", "2026-01-01");

  const totalDeals = deals?.length || 0;
  const totalPipeline =
    deals?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

  console.log("\n💰 DEALS (Since Jan 1, 2026)");
  console.log(`- Total Deals: ${totalDeals}`);
  console.log(`- Pipeline Value: AED ${totalPipeline.toFixed(2)}`);

  // 4. CREATIVE OPPORTUNITY ANALYSIS (Top 5 vs Bottom 5)
  console.log("\n🎨 CREATIVE PERFORMANCE (Top 5 by ROAS/CTR)");
  // Calc approximated "performance score" (CTR * Spend weight) since we might not have direct purchase data per ad in cached view easily
  // Actually check_winning_ads output showed 'spend', 'clicks'.

  const topCreatives = fbData?.slice(0, 5).map((ad) => ({
    name: ad.ad_name,
    spend: ad.spend,
    ctr: ad.ctr,
    cpc: ad.cpc,
  }));
  console.table(topCreatives);
}

deepDive();
