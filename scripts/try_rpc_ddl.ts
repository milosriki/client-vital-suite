import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  const rpcNames = ["execute_sql_query", "exec_sql", "run_sql", "execute_sql"];
  const sql = `ALTER TABLE deals ADD COLUMN IF NOT EXISTS hubspot_primary_contact_id TEXT;`;

  for (const name of rpcNames) {
    console.log(`Trying RPC: ${name}...`);
    const { error } = await supabase.rpc(name, { sql_query: sql }); // Try sql_query param
    if (error) {
      console.log(`❌ ${name} failed: ${error.message}`);
      // Try 'query' param?
      const { error: err2 } = await supabase.rpc(name, { query: sql });
      if (err2) console.log(`   (query param also failed)`);
      else {
        console.log(`✅ SUCCESS with ${name} (query param)!`);
        return;
      }
    } else {
      console.log(`✅ SUCCESS with ${name} (sql_query param)!`);
      return;
    }
  }
  console.log("😭 All RPC attempts failed.");
}
run();
