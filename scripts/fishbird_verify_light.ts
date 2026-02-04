import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("🦅 Fishbird Verification: Running Manual Checks...");

// 1. Check for Sync Errors
const { data: errors, error: syncError } = await supabase
  .from("sync_errors")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(5);

if (syncError) {
  console.error("Failed to fetch sync errors:", syncError);
} else {
  console.log(`\n🔍 Found ${errors.length} recent sync errors:`);
  console.table(
    errors.map((e) => ({
      time: e.created_at,
      function: e.function_name,
      error: e.error_message.substring(0, 50) + "...",
    })),
  );
}

// 2. Check Deal Consistency
const { count: dealCount } = await supabase
  .from("deals")
  .select("*", { count: "exact", head: true });
console.log(`\n📊 Total Deals in Supabase: ${dealCount}`);

console.log(
  "\n✅ Verification Complete (RDS Check Skipped - Connection Pending)",
);
