import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  console.log("🕵️‍♂️ Scanning Auth Users (Admin API)...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  // Use listUsers which paginates
  let allUsers: any[] = [];
  let page = 1;

  while (true) {
    console.log(`   Fetching page ${page}...`);
    const {
      data: { users },
      error,
    } = await supabase.auth.admin.listUsers({
      page: page,
      perPage: 1000,
    });

    if (error || !users || users.length === 0) break;
    allUsers = [...allUsers, ...users];
    if (users.length < 1000) break;
    page++;
  }

  console.log(`\n✅ Total Auth Users: ${allUsers.length}`);

  // Search logic
  const match = allUsers.find(
    (u) =>
      JSON.stringify(u).toLowerCase().includes("zouhair") ||
      JSON.stringify(u).toLowerCase().includes("bouziri") ||
      JSON.stringify(u).includes(":609") ||
      JSON.stringify(u).includes(": 609"),
  );

  if (match) {
    console.log("🎯 FOUND MATCH in Auth Users:", match);
  } else {
    console.log("❌ Not found in Auth Users.");
  }
}

run();
