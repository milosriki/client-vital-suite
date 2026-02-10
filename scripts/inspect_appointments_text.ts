import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  console.log("🕵️‍♂️ Inspecting Appointments Text Columns (The 'Human' Link)...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  // Fetch 20 rows with non-null owner_name if possible
  const { data: appts } = await supabase
    .from("appointments")
    .select("id, scheduled_at, owner_name, notes, status")
    .limit(20);

  if (!appts || appts.length === 0) {
    console.log("❌ No appointments found.");
    return;
  }

  console.log(`✅ Loaded ${appts.length} appointments.`);

  console.log("\n📄 Sample Rows:");
  console.table(appts);

  // Check Distinct Owner Names
  const owners = new Set(appts.map((a) => a.owner_name));
  console.log("\n👥 Distinct Owner Names in Sample:", Array.from(owners));

  // Hypothesize Client Name in Notes?
  console.log("\n📝 Notes Analysis:");
  appts.forEach((a) => {
    if (typeof a.notes === "string" && a.notes.length > 0) {
      console.log(`   [${a.scheduled_at}]: ${a.notes.substring(0, 50)}...`);
    }
  });

  // Global Stat: Count by Owner Name
  const { data: allAppts } = await supabase
    .from("appointments")
    .select("owner_name");
  if (allAppts) {
    const counts: Record<string, number> = {};
    allAppts.forEach((a) => {
      const name = a.owner_name || "NULL";
      counts[name] = (counts[name] || 0) + 1;
    });
    console.log("\n📊 FULL Owner Distribution:");
    console.table(counts);
  }
}

run();
