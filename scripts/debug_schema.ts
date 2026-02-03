import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  const { data: deals, error } = await supabase
    .from("deals")
    .select("*")
    .limit(1);
  console.log("Error:", error);
  console.log("Deal Sample:", JSON.stringify(deals, null, 2));
}
run();
