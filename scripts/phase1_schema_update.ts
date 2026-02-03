import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function runSchemaUpdate() {
  console.log("🏗️ Applying Phase 1 Schema Update...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  console.log(`✅ Keys Loaded.`);

  // 1. Add Column
  const sql = `ALTER TABLE deals ADD COLUMN IF NOT EXISTS hubspot_primary_contact_id TEXT;`;

  // There is no direct SQL method in simple client unless RPC is setup for it.
  // However, I saw 'execute_sql_query' RPC in tool-executor.ts earlier.
  // Let's try to use that if it exists, otherwise we might need a migration tool or just use the agent tool?
  // The previous scripts used 'direct_sql.ts' but that seemed to just use the client to query tables, not DDL?
  // Wait, 'direct_sql.ts' had 'list tables' logic.
  // Let's rely on the AI Agent's `run_sql_query` tool capability? No, I am the agent.
  // I can check if 'execute_sql_query' RPC exists.

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "execute_sql_query",
    { sql_query: sql },
  );

  if (rpcError) {
    console.error("RPC Error:", rpcError);
    // Fallback: If RPC doesn't exist, we might be stuck unless we use the dashboard or have another way.
    // But the previous analysis showed 'run_sql_query' tool uses 'execute_sql_query' RPC. So it SHOULD exist.
  } else {
    console.log("✅ Schema Update Success: Column added.");
  }
}

runSchemaUpdate();
