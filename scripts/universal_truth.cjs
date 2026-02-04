const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing Supabase credentials in environment");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("🦅 Universal Truth Verification (Feb 2026) [FINAL]");
  console.log("-----------------------------------------");

  const startOfMonth = "2026-02-01T00:00:00.000Z";

  try {
    // 1. Get Live Deals (HubSpot Truth)
    // FIX: Use CLOSE_DATE for revenue attribution
    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select(
        "id, deal_name, amount, deal_value, stage, close_date, created_at, pipeline",
      )
      .ilike("stage", "%won%")
      .gte("close_date", startOfMonth);

    if (dealsError) console.error("❌ Deals Error:", dealsError.message);

    // 2. Get AnyTrack Events (Attribution Truth)
    const { data: atEvents, error: atError } = await supabase
      .from("attribution_events")
      .select("event_name, value, fb_ad_name, utm_campaign, utm_source")
      .eq("event_name", "Purchase")
      .gte("created_at", startOfMonth);

    if (atError) console.error("❌ AnyTrack Error:", atError.message);

    // 3. Get Facebook Side (via Daily Business Metrics)
    const { data: fbMetrics, error: fbError } = await supabase
      .from("daily_business_metrics")
      .select("date, ad_spend_facebook, facebook_purchases, roas_daily")
      .gte("date", startOfMonth.split("T")[0]);

    if (fbError) console.error("❌ FB Metrics Error:", fbError.message);

    // --- ANALYSIS ---
    const totalDeals = deals?.length || 0;
    // Use deal_value if available, fallback to amount
    const totalRevenue =
      deals?.reduce(
        (sum, d) => sum + (Number(d.deal_value) || Number(d.amount) || 0),
        0,
      ) || 0;

    const atPurchases = atEvents?.length || 0;
    const atRevenue =
      atEvents?.reduce((sum, e) => sum + (Number(e.value) || 0), 0) || 0;

    const fbPurchases =
      fbMetrics?.reduce(
        (sum, m) => sum + (Number(m.facebook_purchases) || 0),
        0,
      ) || 0;
    const fbSpend =
      fbMetrics?.reduce(
        (sum, m) => sum + (Number(m.ad_spend_facebook) || 0),
        0,
      ) || 0;

    console.log("\n📊 THE TRIANGLE OF TRUTH (Feb 1 - Now)");
    console.table([
      {
        Source: "HubSpot (Deals)",
        Count: totalDeals,
        Value: `AED ${totalRevenue.toLocaleString()}`,
      },
      {
        Source: "AnyTrack (Events)",
        Count: atPurchases,
        Value: `AED ${atRevenue.toLocaleString()}`,
        // Note: AnyTrack value might be slightly different due to exchange rates or partial payments
      },
      {
        Source: "Facebook (Reported)",
        Count: fbPurchases,
        Value: "N/A (Spend: " + fbSpend + ")",
      },
    ]);

    console.log("\n🔍 Discrepancy Analysis:");
    console.log(
      `- Deal vs AnyTrack Gap: ${Math.abs(totalDeals - atPurchases)} orders`,
    );
    console.log(
      `- Deal vs FB Gap:       ${Math.abs(totalDeals - fbPurchases)} orders`,
    );

    // --- ADS CROSSING ---
    const activeAds = new Set(
      atEvents?.map((e) => e.fb_ad_name).filter(Boolean),
    );
    if (activeAds.size > 0) {
      console.log("\n🏆 Ads Driving CONFIRMED Revenue (Visible in AnyTrack):");
      console.log(Array.from(activeAds).join("\n"));
    }

    if (deals && deals.length > 0) {
      console.log("\n📝 Latest Closed Deal:");
      const latest = deals.sort(
        (a, b) => new Date(b.close_date) - new Date(a.close_date),
      )[0];
      console.log(
        `${latest.deal_name} (${latest.deal_value || latest.amount} AED) - Closed: ${latest.close_date}`,
      );
    } else {
      console.log("\nℹ️ No Closed Won deals found in HubSpot for Feb.");
    }
  } catch (err) {
    console.error("\n❌ Unexpected Error:", err);
  }
}

main();
