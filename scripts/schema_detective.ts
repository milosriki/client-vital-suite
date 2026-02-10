import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  console.log("🕵️‍♂️ Starting Schema Detective (PowerBI Source Hunt)...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  // 1. List All Tables (Public Schema)
  console.log("\n📂 1. Scanning Table Registry...");
  // Note: internal introspection requires direct SQL or specific permissions.
  // We'll try to deduce from standard queries if possible, or use a known list if RPC fails.
  // Using Postgrest to inspect is hard, so we just try common names first.

  const suspects = [
    "deals",
    "bookings",
    "reservations",
    "attendance",
    "gym_visits",
    "packages",
    "subscriptions",
    "credits",
    "session_packs",
    "coaches",
    "trainers",
    "staff",
    "employees",
    "users",
    "profiles",
    "legacy_users",
    "wp_users",
    "hubspot_owners",
    "team_members",
    "ptd_coaches",
    "v2_coaches",
    "trainer_commissions",
  ];

  console.log(`   Targeting likely suspects: ${suspects.join(", ")}`);

  for (const table of suspects) {
    const { data, error } = await supabase.from(table).select("*").limit(5);
    if (!error) {
      console.log(`   ✅ Found Table: '${table}' (Rows: ${data.length})`);
      if (data.length > 0) {
        console.log(`      Keys: ${Object.keys(data[0]).join(", ")}`);
        // Check for integer IDs
        const hasIntId = Number.isInteger(data[0].id);
        console.log(
          `      ID Type: ${hasIntId ? "INTEGER (Legacy?)" : "UUID/String"}`,
        );
      }
    }
  }

  // 2. Global Search for "Zouheir" (Legacy Name)
  console.log("\n👤 2. Hunting for 'Zouheir' (ID: 609)...");

  // We double check the 'coaches' table if it exists, for that specific name
  // Or 'users' if it has a different structure

  const tablesToScan = [
    "deals",
    "trainer_commissions",
    "coaches",
    "users",
    "profiles",
    "trainers",
  ];

  for (const table of tablesToScan) {
    try {
      // Try text search
      const { data: results } = await supabase
        .from(table)
        .select("*")
        .textSearch("name", "'Zouheir'", { config: "english" }) // varied syntax support
        .catch(() => ({ data: null }));

      // Fallback: simple ilike on common columns
      const { data: ilikeResults } = await supabase
        .from(table)
        .select("*")
        .or(
          "name.ilike.%Zouheir%,first_name.ilike.%Zouheir%,full_name.ilike.%Zouheir%",
        )
        .limit(5);

      if (ilikeResults && ilikeResults.length > 0) {
        console.log(`   🎯 HIT in '${table}':`, ilikeResults);
      }
    } catch (e) {}
  }

  // 3. Search for ID 609 specifically
  console.log("\n🔢 3. Hunting for ID 609...");
  for (const table of tablesToScan) {
    try {
      const { data: idMatch } = await supabase
        .from(table)
        .select("*")
        .eq("id", 609) // Integer check
        .limit(1);

      if (idMatch && idMatch.length > 0) {
        console.log(`   🎯 ID HIT in '${table}':`, idMatch);
      }
    } catch (e) {}
  }
}

run();
