import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

console.log(
  "DEBUG: URL Length:",
  SUPABASE_URL?.length,
  "Key Length:",
  SUPABASE_SERVICE_ROLE_KEY?.length,
);
console.log("DEBUG: Key Start:", SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10));
console.log("DEBUG: Key End:", SUPABASE_SERVICE_ROLE_KEY?.slice(-5));
const sanitizedKey = (SUPABASE_SERVICE_ROLE_KEY || "")
  .replace(/\\n/g, "")
  .trim();
console.log("DEBUG: Sanitized Key End:", sanitizedKey.slice(-5));
const supabase = createClient(SUPABASE_URL, sanitizedKey);

async function checkWinningAds() {
  console.log("🚀 Invoking 'fetch-facebook-insights' for TODAY...");

  const { data, error } = await supabase.functions.invoke(
    "fetch-facebook-insights",
    {
      body: { date_preset: "today" },
    },
  );

  if (error) {
    console.error(
      "❌ Error invokes function (Live Sync Failed):",
      error.message,
    );
    if (error instanceof Error && "context" in error) {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.text === "function") {
        try {
          const errBody = await ctx.text();
          console.error("🔴 EDGE FUNCTION RAW ERROR:", errBody);
        } catch (e) {
          console.error("Could not parse error body text:", e);
        }
      }
    }
    console.log("⚠️  Proceeding to check database for cached data...");
  } else if (!data.success) {
    console.error("❌ Function returned API error:", data.error);
    console.log("⚠️  Proceeding to check database for cached data...");
  } else {
    console.log("✅ Function Result:", JSON.stringify(data, null, 2));
  }

  // Also query the insights table to see the top performers
  console.log("\n🔎 Querying 'facebook_ads_insights' table...");
  const { data: insights, error: dbError } = await supabase
    .from("facebook_ads_insights")
    .select("campaign_name, ad_name, spend, clicks, ctr, cpc, date")
    // .eq("date_preset", "today") // Removing this filter as table might not store 'date_preset' column exactly like that
    .order("date", { ascending: false })
    .order("spend", { ascending: false })
    .limit(10);

  if (dbError) {
    console.error("❌ Database Error:", dbError.message);
    return;
  }

  if (insights && insights.length > 0) {
    console.log("\n🏆 TOP ADS (Most Recent Data):");
    console.table(insights);
  } else {
    console.log("\n⚠️ No data found in DB.");
  }
}

checkWinningAds();
