import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Client as PostgresClient } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

Deno.serve(async (req) => {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL") || Deno.env.get("DIRECT_URL");
  
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: "Missing SUPABASE_DB_URL" }), { status: 500 });
  }

  const client = new PostgresClient(dbUrl);
  
  try {
    await client.connect();
    
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS public.aws_truth_cache (
          id uuid primary key default gen_random_uuid(),
          email text unique NOT NULL,
          full_name text,
          outstanding_sessions int DEFAULT 0,
          last_session_date timestamptz,
          coach_name text,
          package_name text,
          updated_at timestamptz default now()
      );

      ALTER TABLE public.aws_truth_cache ENABLE ROW LEVEL SECURITY;

      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view AWS truth cache') THEN
              CREATE POLICY "Users can view AWS truth cache" ON public.aws_truth_cache FOR SELECT TO authenticated USING (true);
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage AWS truth cache') THEN
              CREATE POLICY "Service role can manage AWS truth cache" ON public.aws_truth_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
          END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_aws_truth_cache_email ON public.aws_truth_cache(email);
    `);

    return new Response(JSON.stringify({ success: true, message: "Supreme Cache established." }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  } finally {
    await client.end();
  }
});
