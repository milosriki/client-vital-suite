import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  console.log("🏗️ Auditing Database Structure (Finding the Real Data)...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  // 1. Inspect Appointments Columns (Final Check)
  console.log("\n🔍 1. Inspecting 'appointments' columns...");
  const { data: apptCols } = await supabase
    .from("appointments")
    .select("*")
    .limit(1);
  if (apptCols && apptCols.length > 0) {
    console.log("   Keys:", Object.keys(apptCols[0]).join(", "));
  }

  // 2. List All Tables with Row Counts
  // We have to iterate the known list + any guesses
  // We will check row count for each.

  const tables = [
    "appointments",
    "starts",
    "conductions",
    "sessions",
    "bookings",
    "reservations",
    "gym_visits",
    "attendance",
    "checkins",
    "class_schedule",
    "classes",
    "leads",
    "contacts",
    "deals",
    "users",
    "profiles",
    "trainer_commissions",
    "commissions",
    "payouts",
    "targets",
    "goals",
    "audit_logs",
    "activity_logs",
    "events",
  ];

  console.log("\n📊 2. Table Row Counts (Scanning Suspects)...");

  for (const t of tables) {
    const { count, error } = await supabase
      .from(t)
      .select("*", { count: "exact", head: true });
    if (!error && count !== null) {
      console.log(`   [${t}]: ${count} rows`);
      if (count > 0 && count < 10) {
        // Inspect small tables immediately
        const { data } = await supabase.from(t).select("*").limit(1);
        console.log(`      -> Keys: ${Object.keys(data[0]).join(", ")}`);
      }
    }
  }
}

run();
