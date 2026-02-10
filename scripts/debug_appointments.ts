import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  console.log("🔍 Debugging Appointments Table...");

  // 1. Get one row to see columns
  const { data: example, error } = await supabase
    .from("appointments")
    .select("*")
    .limit(1);

  if (error) {
    console.error("❌ Error fetching appointments:", error.message);
  } else if (example && example.length > 0) {
    console.log("✅ Sample Row Keys:", Object.keys(example[0]));
    console.log("Sample Data:", example[0]);
  } else {
    console.log("⚠️ Table is empty (unexpected).");
  }

  // 2. Broad Search for Zouhair
  console.log("\n🕵️‍♂️ Broad Search for 'Zouhair'...");
  const tables = ["contacts", "users", "appointments"]; // Removed leads, not a table? 'leads' was found earlier?

  // Try searching in contacts 'first_name', 'last_name', 'owner_name'
  const { data: zContacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, owner_name")
    .or(
      "first_name.ilike.%Zouhair%,last_name.ilike.%Zouhair%,owner_name.ilike.%Zouhair%",
    )
    .limit(5);

  if (zContacts && zContacts.length > 0) {
    console.log("Found in Contacts:", zContacts);
  } else {
    console.log("Not found in Contacts.");
  }
}

run();
