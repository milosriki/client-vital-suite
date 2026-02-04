const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing Supabase credentials in environment");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("🦅 Debugging Revenue Data Schema...");
  const today = new Date().toISOString().split("T")[0];
  // Start of Feb 2026
  const startOfMonth = "2026-02-01T00:00:00.000Z";

  try {
    // 1. Inspect Schema (Get one row to see columns)
    const { data: sampleDeal, error: schemaError } = await supabase
      .from("deals")
      .select("*")
      .limit(1);

    if (schemaError) {
      console.error("⚠️ Schema Check Failed:", schemaError.message);
    } else if (sampleDeal && sampleDeal.length > 0) {
      console.log(
        "🔍 Sample Deal Keys:",
        Object.keys(sampleDeal[0]).join(", "),
      );
    }

    // 2. Try fetching "Closed Won" deals with correct schema assumptions
    // Based on previous knowledge, likely 'deal_stage' or 'pipeline_stage'
    // And 'amount' or 'value'

    // Attempt 1: Standard Guess
    let query = supabase
      .from("deals")
      .select("*")
      .or("deal_stage.ilike.%won%,pipeline_stage.ilike.%won%")
      .gte("created_at", startOfMonth); // Using created_at as backup if close_date missing

    const { data: closedDeals, error: queryError } = await query;

    if (queryError) {
      console.error("⚠️ Revenue Query Failed:", queryError.message);
    } else {
      const count = closedDeals.length;
      const revenue = closedDeals.reduce(
        (sum, d) => sum + (Number(d.amount) || Number(d.value) || 0),
        0,
      );

      console.log("\n📊 REVENUE DEBUG REPORT (Feb 2026)");
      console.log("--------------------------------------------------");
      console.log(`✅ Closed Deals Found:   ${count}`);
      console.log(`✅ Total Revenue:        AED ${revenue.toLocaleString()}`);
      console.log("--------------------------------------------------");
      if (count > 0) {
        console.log("Sample Deal:", JSON.stringify(closedDeals[0], null, 2));
      }
    }
  } catch (err) {
    console.error("\n❌ Unexpected Error:", err);
  }
}

main();
