import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

/**
 * TRUTH AUDIT ENFORCER (v1.0)
 * Compares "Platform Claims" (Meta/AnyTrack) vs "Bank Truth" (AWS/Stripe).
 * Calculates the "Leak Score" = (Claimed - Actual) / Claimed
 */

const SUPABASE_URL = "https://ztjndilxurtsfqdsvfds.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface MarketingData {
  meta_ad_spend: number;
  meta_reported_revenue: number;
  anytrack_attributed_revenue: number;
  hubspot_closed_won_value: number;
}

interface TruthData {
  total_lifetime_revenue: number;
  total_cash_collected: number; // Placeholder if we had direct Stripe access here
}

async function auditTruth() {
  console.log("🕵️‍♂️ Starting Triple-Source Truth Audit...");

  // 1. Load Marketing Import (The "Claims")
  const marketingFile = path.join(process.cwd(), "marketing_export.json");
  let marketingData: MarketingData;

  try {
    if (fs.existsSync(marketingFile)) {
      const raw = fs.readFileSync(marketingFile, "utf-8");
      marketingData = JSON.parse(raw);
      console.log("📄 Loaded Marketing Claims from export.");
    } else {
      console.warn(
        "⚠️ 'marketing_export.json' not found. Using MOCK data for calibration.",
      );
      marketingData = {
        meta_ad_spend: 15000,
        meta_reported_revenue: 65000,
        anytrack_attributed_revenue: 58000,
        hubspot_closed_won_value: 62000,
      };
    }
  } catch (e) {
    console.error("❌ Failed to load marketing data:", e);
    return;
  }

  // 2. Fetch Ground Truth (The "Reality")
  console.log("📥 Fetching Verified Truth from AWS Cache...");

  // We sum up the lifetime_revenue from our cache which mirrors the PowerBI "amounttotal"
  const { data: truthRows, error } = await supabase
    .from("aws_truth_cache")
    .select("lifetime_revenue");

  if (error) {
    console.error("❌ Failed to fetch Truth Cache:", error.message);
    return;
  }

  const actualRevenue = truthRows.reduce(
    (sum, row) => sum + (row.lifetime_revenue || 0),
    0,
  );
  console.log(
    `✅ Verified Actual Revenue (AWS): AED ${actualRevenue.toLocaleString()}`,
  );

  // 3. Calculate Discrepancies (The "Leak")
  const claimedRevenue = marketingData.meta_reported_revenue;
  const discrepancy = claimedRevenue - actualRevenue;
  const leakScore =
    claimedRevenue > 0 ? (discrepancy / claimedRevenue) * 100 : 0;

  // 4. Report
  console.log("\n📊 === SUPREME TRUTH AUDIT REPORT === 📊");
  console.log(`----------------------------------------`);
  console.log(
    `🔹 Meta Ad Spend:          AED ${marketingData.meta_ad_spend.toLocaleString()}`,
  );
  console.log(
    `🔹 Meta Claimed Rev:       AED ${marketingData.meta_reported_revenue.toLocaleString()} (ROAS: ${(marketingData.meta_reported_revenue / marketingData.meta_ad_spend).toFixed(2)}x)`,
  );
  console.log(
    `🔹 AnyTrack Attr Rev:      AED ${marketingData.anytrack_attributed_revenue.toLocaleString()}`,
  );
  console.log(
    `🔹 HubSpot Closed Won:     AED ${marketingData.hubspot_closed_won_value.toLocaleString()}`,
  );
  console.log(`----------------------------------------`);
  console.log(
    `🟢 AWS Verified Rev:       AED ${actualRevenue.toLocaleString()} (True ROAS: ${(actualRevenue / marketingData.meta_ad_spend).toFixed(2)}x)`,
  );
  console.log(`----------------------------------------`);

  if (leakScore > 15) {
    console.log(`🚨 LEAK DETECTED! Leak Score: ${leakScore.toFixed(1)}%`);
    console.log(
      `   (Platform over-reporting by AED ${discrepancy.toLocaleString()})`,
    );
  } else if (leakScore < -5) {
    console.log(
      `⚠️ REVERSE LEAK! Actuals are HIGHER than attributed. (attribution loss)`,
    );
    console.log(
      `   (Undertracking by AED ${Math.abs(discrepancy).toLocaleString()})`,
    );
  } else {
    console.log(
      `✅ INTEGRITY CONFIRMED. Leak Score: ${leakScore.toFixed(1)}% (Within tolerance)`,
    );
  }
  console.log(`========================================\n`);

  // Optional: Write back to a DB table 'truth_audits' if we had one.
}

auditTruth();
