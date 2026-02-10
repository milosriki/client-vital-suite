import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  console.log("🕵️‍♂️ Deep Packet Inspection: 'appointments' (Full JSON Dump)...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  // Fetch 1 row with detailed selection
  // We explicitly select * to get everything
  const { data: appts } = await supabase
    .from("appointments")
    .select("*")
    .not("notes", "is", null) // Get one with notes to maximize data density
    .limit(1);

  if (!appts || appts.length === 0) {
    console.log("❌ No appointments found.");
    return;
  }

  const row = appts[0];
  console.log("\n📦 Raw JSON Payload:");
  console.log(JSON.stringify(row, null, 2));

  // Check for specific keywords in keys
  const keys = Object.keys(row);
  const suspiciousKeys = keys.filter(
    (k) =>
      k.includes("owner") ||
      k.includes("trainer") ||
      k.includes("coach") ||
      k.includes("lead") ||
      k.includes("assign") ||
      k.includes("user"),
  );

  console.log("\n🗝️ Suspicious Keys found:", suspiciousKeys);
}

run();
