import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Use the admin client to run raw SQL via rpc
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false }, db: { schema: "public" } }
  );

  // We can't run DDL via supabase-js, so use the DB URL directly with fetch to pg
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: "No SUPABASE_DB_URL" }), { status: 500, headers: corsHeaders });
  }

  // Use Deno's built-in postgres
  const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
  const client = new Client(dbUrl);
  await client.connect();

  try {
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS session_depletion_alerts (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        client_name text,
        client_phone text,
        client_email text,
        package_id text NOT NULL UNIQUE,
        remaining_sessions integer,
        last_coach text,
        priority text,
        alert_status text DEFAULT 'pending',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `);
    await client.queryArray(`ALTER TABLE session_depletion_alerts ENABLE ROW LEVEL SECURITY`);
    await client.queryArray(`DROP POLICY IF EXISTS "anon_read_sda" ON session_depletion_alerts`);
    await client.queryArray(`CREATE POLICY "anon_read_sda" ON session_depletion_alerts FOR SELECT TO anon USING (true)`);
    await client.queryArray(`DROP POLICY IF EXISTS "service_write_sda" ON session_depletion_alerts`);
    await client.queryArray(`CREATE POLICY "service_write_sda" ON session_depletion_alerts FOR ALL TO service_role USING (true)`);
    
    await client.end();
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    await client.end();
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
