import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  console.log(
    "🔍 Exhaustive Table Discovery (Looking for Session-Trainer Link)...\n",
  );

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  // 1. Query information_schema to get ALL tables in ALL schemas
  const { data: tables, error } = await supabase.rpc("get_all_tables");

  if (error) {
    console.log(
      "Note: RPC 'get_all_tables' not found. Using fallback discovery...\n",
    );

    // Fallback: Probe known and suspected table names
    const suspects = [
      // Session-related
      "sessions",
      "conductions",
      "session_trainers",
      "session_coaches",
      "trainer_sessions",
      "coach_sessions",
      "bookings",
      "reservations",
      "attendance",
      "gym_visits",
      "workout_logs",
      "training_sessions",
      // Staff-related
      "trainers",
      "coaches",
      "staff",
      "employees",
      "team_members",
      "trainer_assignments",
      "coach_assignments",
      "staff_assignments",
      // Junction tables
      "appointment_trainers",
      "appointment_coaches",
      "lead_trainers",
      "contact_trainers",
      "client_trainers",
      "user_trainers",
      // Legacy
      "hubspot_owners",
      "hubspot_trainers",
      "hubspot_sessions",
      "wp_users",
      "wp_trainers",
      "legacy_sessions",
    ];

    console.log("📋 Probing", suspects.length, "suspected table names...\n");

    for (const table of suspects) {
      const { data, error: e } = await supabase
        .from(table)
        .select("*")
        .limit(1);
      if (!e && data) {
        console.log(
          `✅ FOUND: '${table}' - Columns:`,
          Object.keys(data[0] || {}).join(", "),
        );
      }
    }
  } else {
    console.table(tables);
  }

  // 2. Check known tables for hidden relationships
  console.log("\n🧬 Checking Known Tables for 'Trainer' Columns...\n");

  const knownTables = ["leads", "contacts", "deals", "appointments"];
  for (const t of knownTables) {
    const { data } = await supabase.from(t).select("*").limit(1);
    if (data && data.length > 0) {
      const keys = Object.keys(data[0]);
      const trainerKeys = keys.filter(
        (k) =>
          k.includes("trainer") ||
          k.includes("coach") ||
          k.includes("conductor") ||
          k.includes("assign"),
      );
      if (trainerKeys.length > 0) {
        console.log(`🎯 '${t}' has: ${trainerKeys.join(", ")}`);
      }
    }
  }

  // 3. Deep Dive into 'leads' table (since it has 'assigned_coach')
  console.log("\n📊 leads.assigned_coach Value Distribution:");
  const { data: coachStats } = await supabase
    .from("leads")
    .select("assigned_coach");
  if (coachStats) {
    const counts: Record<string, number> = {};
    coachStats.forEach((l) => {
      const coach = l.assigned_coach || "Unassigned";
      counts[coach] = (counts[coach] || 0) + 1;
    });
    // Sort by count
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    console.table(
      sorted
        .slice(0, 15)
        .map(([name, count]) => ({ Coach: name, Leads: count })),
    );
  }
}

run();
