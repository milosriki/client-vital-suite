import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function reload() {
  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  console.log("🔄 Reloading PostgREST Schema Cache...");
  const { error } = await supabase.rpc("execute_sql_query", {
    sql_query: "NOTIFY pgrst, 'reload schema';",
  });

  if (error) console.log("Error:", error);
  else console.log("✅ Schema Reload Triggered.");
}
reload();
