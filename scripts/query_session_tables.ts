import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  console.log("✅ Connected to Supabase.\n");

  // 1. Query member_analytics for trainer session data
  console.log("📊 MEMBER_ANALYTICS TABLE (Session Data):");
  console.log("=".repeat(60));
  const { data: analytics, error: aErr } = await supabase
    .from("member_analytics")
    .select("*")
    .order("visit_date", { ascending: false })
    .limit(20);

  if (aErr) {
    console.log("❌ Error:", aErr.message);
  } else if (!analytics || analytics.length === 0) {
    console.log("⚠️ No data in member_analytics.");
  } else {
    console.log(`Found ${analytics.length} records.\n`);
    console.table(
      analytics.map((r) => ({
        visit_date: r.visit_date,
        trainer_id: r.trainer_id,
        member_id: r.member_id?.slice(0, 8),
        session_type: r.session_type,
        location: r.location,
      })),
    );
  }

  // 2. Query trainer_performance for aggregated data
  console.log("\n📈 TRAINER_PERFORMANCE TABLE (Aggregated Data):");
  console.log("=".repeat(60));
  const { data: perf, error: pErr } = await supabase
    .from("trainer_performance")
    .select("*")
    .order("period_start", { ascending: false })
    .limit(20);

  if (pErr) {
    console.log("❌ Error:", pErr.message);
  } else if (!perf || perf.length === 0) {
    console.log("⚠️ No data in trainer_performance.");
  } else {
    console.log(`Found ${perf.length} records.\n`);
    console.table(
      perf.map((r) => ({
        period_start: r.period_start,
        period_end: r.period_end,
        trainer_id: r.trainer_id?.slice(0, 8),
        sessions_conducted: r.sessions_conducted,
        total_revenue: r.total_revenue,
        location: r.location,
      })),
    );
  }

  // 3. Check if staff table has trainer names
  console.log("\n👥 STAFF TABLE (Trainer Names):");
  console.log("=".repeat(60));
  const { data: staff, error: sErr } = await supabase
    .from("staff")
    .select("id, name, role, email")
    .limit(30);

  if (sErr) {
    console.log("❌ Error:", sErr.message);
  } else if (!staff || staff.length === 0) {
    console.log("⚠️ No data in staff.");
  } else {
    console.log(`Found ${staff.length} staff members.\n`);
    console.table(staff);
  }
}

run();
