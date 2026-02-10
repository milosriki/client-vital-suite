import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  console.log("🕵️‍♂️ Deep Search for 'Zouhair'...");

  let users = [];
  try {
    const res = await supabase
      .from("users")
      .select("*")
      .or(
        "email.ilike.%zouhair%,first_name.ilike.%zouhair%,last_name.ilike.%zouhair%",
      )
      .limit(5);

    if (res.data) users = res.data;
  } catch (e) {
    // console.log("User search failed");
  }

  if (users && users.length > 0) {
    console.log("✅ Found in 'users' table:", users);
  } else {
    console.log("❌ Not found in 'users' table.");
  }

  // 2. Check 'contacts' for any email match
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, email, first_name, last_name")
    .ilike("email", "%zouhair%")
    .limit(5);

  if (contacts && contacts.length > 0) {
    console.log("✅ Found in 'contacts' (email match):", contacts);
  } else {
    console.log("❌ Not found in 'contacts' by email.");
  }
}

run();
