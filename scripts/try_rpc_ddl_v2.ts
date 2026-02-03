import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  console.log("🧪 Testing DDL Capability...");

  // 1. Create Dummy Table
  const sql1 =
    "CREATE TABLE IF NOT EXISTS public.test_ddl_check (id serial primary key);";
  const { data: d1, error: e1 } = await supabase.rpc("execute_sql_query", {
    sql_query: sql1,
  });
  console.log("CREATE Result:", { data: d1, error: e1 });

  // 2. Add Column to Deals
  const sql2 =
    "ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS hubspot_primary_contact_id TEXT;";
  const { data: d2, error: e2 } = await supabase.rpc("execute_sql_query", {
    sql_query: sql2,
  });
  console.log("ALTER Result:", { data: d2, error: e2 });

  // 3. Notify Reload
  await supabase.rpc("execute_sql_query", {
    sql_query: "NOTIFY pgrst, 'reload schema';",
  });
}
run();
