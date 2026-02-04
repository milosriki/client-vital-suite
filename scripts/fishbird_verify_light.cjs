const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing Supabase credentials in environment");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("🦅 Fishbird Verification (Light): Running Manual Checks...");

  try {
    // 1. Check for Sync Errors
    const { data: errors, error: syncError } = await supabase
      .from("sync_errors")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (syncError) {
      console.error("❌ Failed to fetch sync errors:", syncError.message);
    } else {
      console.log(`\n🔍 Found ${errors.length} recent sync errors:`);
      if (errors.length > 0) {
        console.table(
          errors.map((e) => ({
            time: new Date(e.created_at).toISOString(),
            function: e.function_name,
            error: e.error_message.substring(0, 50) + "...",
          })),
        );
      } else {
        console.log("✅ No recent sync errors found.");
      }
    }

    // 2. Check Deal Consistency
    const { count: dealCount, error: countError } = await supabase
      .from("deals")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("❌ Failed to count deals:", countError.message);
    } else {
      console.log(`\n📊 Total Deals in Supabase: ${dealCount}`);
    }

    console.log(
      "\n✅ Verification Complete (RDS Check Skipped - Connection Pending)",
    );
  } catch (err) {
    console.error("\n❌ Unexpected Error:", err);
  }
}

main();
