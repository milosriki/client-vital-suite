import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  console.log("🕵️‍♂️ Deep Dive: Sessions & Deals...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  // 1. Inspect 'sessions' table (if it exists)
  console.log("\n🧘 1. Inspecting 'sessions' table...");
  const { data: sessions, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .limit(5);

  if (sessionError) {
    console.log("   ❌ Error accessing 'sessions':", sessionError.message);
  } else if (!sessions || sessions.length === 0) {
    console.log("   ⚠️ 'sessions' table is empty or inaccessible.");
  } else {
    console.log(`   ✅ Found 'sessions' (Sample Row):`);
    console.log("      Keys:", Object.keys(sessions[0]).join(", "));
    console.log("      Sample:", sessions[0]);
  }

  // 2. Scan 'deals' for Zouheir
  console.log("\n🤝 2. Scanning 'deals' for 'Zouheir'...");
  const { data: dealMatches } = await supabase
    .from("deals")
    .select("id, deal_name, owner_name, owner_id")
    .ilike("owner_name", "%Zouheir%")
    .limit(5);

  if (dealMatches && dealMatches.length > 0) {
    console.log("   🎯 HIT in 'deals':", dealMatches);
  } else {
    console.log("   ❌ Not found in 'deals' (owner_name).");
  }

  // 3. Scan 'users' metadata for 609
  console.log("\n🧬 3. Scanning 'users' metadata for ID 609...");
  // Check if raw_user_meta_data contains 609
  // We fetch a batch and scan in JS
  const { data: users } = await supabase
    .from("users") // Assuming public.users mirror or auth.users access
    .select("id, raw_user_meta_data")
    .limit(500); // larger batch

  if (users) {
    const match = users.find(
      (u) =>
        JSON.stringify(u).includes(":609") ||
        JSON.stringify(u).includes(": 609") ||
        JSON.stringify(u).includes('"609"'),
    );
    if (match) {
      console.log("   🎯 Metadata HIT for 609:", match);
    } else {
      console.log("   ❌ No metadata match for 609.");
    }
  }
}

run();
