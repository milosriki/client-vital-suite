import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  console.log("🕵️‍♂️ Inspecting Leads & Coach Assignments...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  // 1. Group by Assigned Coach
  console.log("\n📊 1. Leads by Assigned Coach:");
  const { data: coachStats, error } = await supabase
    .from("leads")
    .select("assigned_coach");

  if (coachStats) {
    const counts: Record<string, number> = {};
    coachStats.forEach((l) => {
      const coach = l.assigned_coach || "Unassigned";
      counts[coach] = (counts[coach] || 0) + 1;
    });
    console.table(counts);

    const distinctCoaches = Object.keys(counts);
    console.log("Distinct Values:", distinctCoaches);

    if (distinctCoaches.includes("609")) {
      console.log("✅ FOUND ID 609 in assigned_coach!");
    }
  }

  // 2. Group by Deals Owner Name
  console.log("\n💰 2. Deals by Owner Name:");
  const { data: dealStats } = await supabase.from("deals").select("owner_name");

  if (dealStats) {
    const counts: Record<string, number> = {};
    dealStats.forEach((d) => {
      const owner = d.owner_name || "Unassigned";
      counts[owner] = (counts[owner] || 0) + 1;
    });
    console.table(counts);

    if (
      Object.keys(counts).some(
        (n) => n.includes("Zouheir") || n.includes("Bouziri"),
      )
    ) {
      console.log("✅ FOUND Zouheir in Deals!");
    }
  }
}

run();
