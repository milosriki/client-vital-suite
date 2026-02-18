import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const results: string[] = [];

  // Use the admin client to insert test data which will auto-create via PostgREST
  // Actually, we need raw SQL. Use pg from Deno.
  
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: "No SUPABASE_DB_URL" }), { status: 500, headers: corsHeaders });
  }

  // Import postgres
  const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
  const sql = postgres(dbUrl, { max: 1 });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS client_packages_live (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        package_id text NOT NULL UNIQUE,
        client_id text NOT NULL,
        client_name text,
        client_email text,
        client_phone text,
        package_name text,
        pack_size integer,
        remaining_sessions integer,
        package_value numeric,
        expiry_date timestamptz,
        purchase_date timestamptz,
        last_coach text,
        last_session_date timestamptz,
        sessions_per_week numeric DEFAULT 0,
        future_booked integer DEFAULT 0,
        next_session_date timestamptz,
        depletion_priority text DEFAULT 'SAFE',
        days_until_depleted integer,
        synced_at timestamptz DEFAULT now()
      )
    `;
    results.push("client_packages_live created");

    await sql`ALTER TABLE client_packages_live ENABLE ROW LEVEL SECURITY`;
    results.push("RLS enabled on client_packages_live");

    await sql.unsafe(`DROP POLICY IF EXISTS "anon_read_cpl" ON client_packages_live`).catch(() => {});
    await sql.unsafe(`CREATE POLICY "anon_read_cpl" ON client_packages_live FOR SELECT TO anon USING (true)`);
    await sql.unsafe(`DROP POLICY IF EXISTS "service_write_cpl" ON client_packages_live`).catch(() => {});
    await sql.unsafe(`CREATE POLICY "service_write_cpl" ON client_packages_live FOR ALL TO service_role USING (true)`);
    results.push("Policies created on client_packages_live");

    await sql`
      CREATE TABLE IF NOT EXISTS training_sessions_live (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        rds_id text NOT NULL UNIQUE,
        client_id text,
        client_name text,
        coach_id text,
        coach_name text,
        training_date timestamptz,
        status text,
        session_type text,
        client_email text,
        time_slot text,
        package_code text,
        location text,
        synced_at timestamptz DEFAULT now()
      )
    `;
    results.push("training_sessions_live created");

    await sql`ALTER TABLE training_sessions_live ENABLE ROW LEVEL SECURITY`;
    await sql.unsafe(`DROP POLICY IF EXISTS "anon_read_tsl" ON training_sessions_live`).catch(() => {});
    await sql.unsafe(`CREATE POLICY "anon_read_tsl" ON training_sessions_live FOR SELECT TO anon USING (true)`);
    await sql.unsafe(`DROP POLICY IF EXISTS "service_write_tsl" ON training_sessions_live`).catch(() => {});
    await sql.unsafe(`CREATE POLICY "service_write_tsl" ON training_sessions_live FOR ALL TO service_role USING (true)`);
    results.push("training_sessions_live + policies created");

    // Indexes
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_cpl_depletion ON client_packages_live(depletion_priority)`).catch(() => {});
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_cpl_client ON client_packages_live(client_id)`).catch(() => {});
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_tsl_date ON training_sessions_live(training_date DESC)`).catch(() => {});
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_tsl_client ON training_sessions_live(client_id)`).catch(() => {});
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_tsl_coach ON training_sessions_live(coach_name)`).catch(() => {});
    results.push("Indexes created");

    // Session depletion alerts
    await sql`
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
    `;
    await sql`ALTER TABLE session_depletion_alerts ENABLE ROW LEVEL SECURITY`;
    await sql.unsafe(`DROP POLICY IF EXISTS "anon_read_sda" ON session_depletion_alerts`).catch(() => {});
    await sql.unsafe(`CREATE POLICY "anon_read_sda" ON session_depletion_alerts FOR SELECT TO anon USING (true)`);
    await sql.unsafe(`DROP POLICY IF EXISTS "service_write_sda" ON session_depletion_alerts`).catch(() => {});
    await sql.unsafe(`CREATE POLICY "service_write_sda" ON session_depletion_alerts FOR ALL TO service_role USING (true)`);
    results.push("session_depletion_alerts created");

    await sql.end();
  } catch (e) {
    await sql.end();
    return new Response(JSON.stringify({ error: e.message, results }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true, results }), { 
    headers: { ...corsHeaders, "Content-Type": "application/json" } 
  });
});
