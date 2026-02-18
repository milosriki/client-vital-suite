import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: "No SUPABASE_DB_URL" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
  const sql = postgres(dbUrl, { max: 1 });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS session_depletion_alerts (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        client_name text,
        client_phone text,
        client_email text,
        package_id text NOT NULL UNIQUE,
        remaining_sessions integer,
        last_coach text,
        priority text CHECK (priority IN ('CRITICAL','HIGH')),
        alert_status text DEFAULT 'pending' CHECK (alert_status IN ('pending','contacted','renewed','churned')),
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `;

    await sql`ALTER TABLE session_depletion_alerts ENABLE ROW LEVEL SECURITY`;
    await sql.unsafe(`DROP POLICY IF EXISTS "anon_read_sda" ON session_depletion_alerts`).catch(() => {});
    await sql.unsafe(`CREATE POLICY "anon_read_sda" ON session_depletion_alerts FOR SELECT TO anon USING (true)`);
    await sql.unsafe(`DROP POLICY IF EXISTS "service_write_sda" ON session_depletion_alerts`).catch(() => {});
    await sql.unsafe(`CREATE POLICY "service_write_sda" ON session_depletion_alerts FOR ALL TO service_role USING (true)`);

    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_sda_status ON session_depletion_alerts(alert_status)`).catch(() => {});
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_sda_priority ON session_depletion_alerts(priority)`).catch(() => {});
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_sda_created_at ON session_depletion_alerts(created_at DESC)`).catch(() => {});

    const alerts = await sql`
      INSERT INTO session_depletion_alerts (
        client_name,
        client_phone,
        client_email,
        package_id,
        remaining_sessions,
        last_coach,
        priority,
        alert_status,
        created_at,
        updated_at
      )
      SELECT
        client_name,
        client_phone,
        client_email,
        package_id,
        remaining_sessions,
        last_coach,
        depletion_priority,
        'pending',
        now(),
        now()
      FROM client_packages_live
      WHERE depletion_priority IN ('CRITICAL','HIGH')
        AND future_booked = 0
      ON CONFLICT (package_id) DO UPDATE SET
        client_name = EXCLUDED.client_name,
        client_phone = EXCLUDED.client_phone,
        client_email = EXCLUDED.client_email,
        remaining_sessions = EXCLUDED.remaining_sessions,
        last_coach = EXCLUDED.last_coach,
        priority = EXCLUDED.priority,
        updated_at = now()
      RETURNING id
    `;

    await sql.end();

    return new Response(
      JSON.stringify({ ok: true, upserted: alerts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    await sql.end();
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
