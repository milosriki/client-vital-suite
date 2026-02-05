import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function run() {
  console.log("🚀 Initializing Knowledge Base Setup...");

  // Try to load from process.env (if loaded by dotenv) or manually parse .env.local like direct_sql.ts
  let url = process.env.SUPABASE_URL;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.log(
      "⚠️  Env vars not found in process.env, parsing .env.local manually...",
    );
    try {
      const envPath = join(process.cwd(), ".env.local");
      const content = await readFile(envPath, "utf-8");
      const urlMatch = content.match(/SUPABASE_URL="([^"]+)"/);
      const keyMatch = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/);
      url = urlMatch ? urlMatch[1] : undefined;
      key = keyMatch ? keyMatch[1] : undefined;
    } catch (e) {
      console.error("❌ Failed to read .env.local", e);
      process.exit(1);
    }
  }

  if (!url || !key) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const sql = `
    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE TABLE IF NOT EXISTS public.knowledge_base (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        category TEXT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        tags TEXT[],
        embedding vector(1536),
        is_active BOOLEAN DEFAULT true
    );

    CREATE INDEX IF NOT EXISTS idx_kb_category ON public.knowledge_base(category);

    -- Enable RLS but allow service role
    ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Allow Service Role Full Access" ON public.knowledge_base
    FOR ALL
    USING (true)
    WITH CHECK (true);
  `;

  console.log("📜 Executing SQL...");

  // Using rpc if available or falling back to pg connection is hard from client.
  // But wait, supabase-js doesn't natively run raw SQL unless exposed via RPC.
  // The 'scripts/direct_sql.ts' was doing selects/filters on the client side.
  // To run DDL, we often need a direct postgres connection OR an RPC function that runs SQL.
  // Let's check provided tools. 'scripts/direct_sql.ts' was NOT running direct SQL, it was using the JS SDK.

  // HACK: We can try to use the `execute_sql` RPC function if it exists.
  // Based on the migration file list (20260103000006_add_execute_sql_rpc.sql), it seems likely!

  const { data, error } = await supabase.rpc("execute_sql", {
    query: sql,
  });

  if (error) {
    console.error("❌ SQL Execution Failed:", error);
    // Fallback: If execute_sql doesn't exist, we might have to guide the user or try another way.
    // We can check if 'exec_sql' or similar exists.
  } else {
    console.log("✅ Knowledge Base Table Created Successfully!");
  }
}

run();
