import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
  const client = new Client(Deno.env.get("SUPABASE_DB_URL")!);

  try {
    await client.connect();
    const results: string[] = [];

    // 1. Ensure tables exist
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS public.coach_trust_ledger (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        coach_name text NOT NULL, ledger_date date NOT NULL,
        sessions_scheduled int DEFAULT 0, sessions_completed int DEFAULT 0,
        sessions_cancelled int DEFAULT 0, gps_verified int DEFAULT 0,
        gps_mismatch int DEFAULT 0, gps_no_data int DEFAULT 0,
        ghost_sessions int DEFAULT 0, late_arrivals int DEFAULT 0,
        early_departures int DEFAULT 0, avg_arrival_offset_min numeric DEFAULT 0,
        total_dwell_min int DEFAULT 0, total_travel_min int DEFAULT 0,
        total_idle_min int DEFAULT 0, travel_km numeric DEFAULT 0,
        trust_score int DEFAULT 100, risk_level text DEFAULT 'normal',
        cancel_rate numeric DEFAULT 0, completion_rate numeric DEFAULT 0,
        verification_rate numeric DEFAULT 0,
        anomalies jsonb DEFAULT '[]'::jsonb, ai_insights jsonb DEFAULT '[]'::jsonb,
        created_at timestamptz DEFAULT now(), UNIQUE(coach_name, ledger_date)
      )
    `);
    await client.queryArray(`ALTER TABLE public.coach_trust_ledger ENABLE ROW LEVEL SECURITY`);
    await client.queryArray(`DROP POLICY IF EXISTS anon_read_trust ON public.coach_trust_ledger`);
    await client.queryArray(`CREATE POLICY anon_read_trust ON public.coach_trust_ledger FOR SELECT USING (true)`);
    await client.queryArray(`DROP POLICY IF EXISTS svc_all_trust ON public.coach_trust_ledger`);
    await client.queryArray(`CREATE POLICY svc_all_trust ON public.coach_trust_ledger FOR ALL TO service_role USING (true)`);
    results.push("✅ coach_trust_ledger OK");

    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS public.coach_name_map (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        gps_name text NOT NULL, session_name text NOT NULL,
        confidence text DEFAULT 'exact', created_at timestamptz DEFAULT now(),
        UNIQUE(gps_name, session_name)
      )
    `);
    await client.queryArray(`ALTER TABLE public.coach_name_map ENABLE ROW LEVEL SECURITY`);
    await client.queryArray(`DROP POLICY IF EXISTS anon_read_nm ON public.coach_name_map`);
    await client.queryArray(`CREATE POLICY anon_read_nm ON public.coach_name_map FOR SELECT USING (true)`);
    await client.queryArray(`DROP POLICY IF EXISTS svc_all_nm ON public.coach_name_map`);
    await client.queryArray(`CREATE POLICY svc_all_nm ON public.coach_name_map FOR ALL TO service_role USING (true)`);
    results.push("✅ coach_name_map OK");

    // 2. Seed name mappings
    await client.queryArray(`
      INSERT INTO public.coach_name_map (gps_name, session_name, confidence) VALUES
        ('Abigail O''Connor', 'Abigail O''conor', 'fuzzy'),
        ('Matthew', 'Matthew Bosch', 'fuzzy'),
        ('Medya S', 'Medya Shadkam', 'fuzzy'),
        ('Nazanin', 'Nazanin Mirmahdion', 'fuzzy'),
        ('Zouheir', 'ZOUHEIR  BOUZIRI', 'fuzzy'),
        ('Menna Khalid', 'Menna Khalid', 'exact')
      ON CONFLICT (gps_name, session_name) DO NOTHING
    `);
    results.push("✅ name mappings OK");

    // 3. Create name normalization function
    await client.queryArray(`
      CREATE OR REPLACE FUNCTION public.normalize_coach_name(raw_name text)
      RETURNS text LANGUAGE sql STABLE AS $$
        SELECT COALESCE(
          (SELECT session_name FROM coach_name_map WHERE LOWER(TRIM(gps_name)) = LOWER(TRIM(raw_name)) LIMIT 1),
          (SELECT session_name FROM coach_name_map WHERE LOWER(TRIM(session_name)) = LOWER(TRIM(raw_name)) LIMIT 1),
          TRIM(raw_name)
        )
      $$
    `);
    results.push("✅ normalize_coach_name() function OK");

    // 4. FIXED crosscheck view — uses name normalization + trust from daily ledger
    await client.queryArray(`DROP VIEW IF EXISTS public.view_session_gps_crosscheck CASCADE`);
    await client.queryArray(`
      CREATE VIEW public.view_session_gps_crosscheck AS
      WITH session_stats AS (
        SELECT normalize_coach_name(coach_name) as coach_name,
          COUNT(*) as total_sessions,
          COUNT(*) FILTER (WHERE status = 'Completed') as completed,
          COUNT(*) FILTER (WHERE status LIKE 'Cancelled-%' AND status != 'Cancelled-Rebooked') as cancelled,
          ROUND(COUNT(*) FILTER (WHERE status LIKE 'Cancelled-%' AND status != 'Cancelled-Rebooked')::numeric / NULLIF(COUNT(*), 0) * 100, 1) as cancel_rate
        FROM training_sessions_live
        WHERE training_date >= CURRENT_DATE - interval '30 days'
        GROUP BY normalize_coach_name(coach_name)
      ),
      trust_recent AS (
        SELECT coach_name,
          ROUND(AVG(trust_score)) as avg_trust,
          SUM(ghost_sessions) as total_ghosts_30d,
          SUM(gps_verified) as total_verified_30d,
          SUM(gps_no_data) as total_no_gps_30d,
          ROUND(AVG(verification_rate)::numeric, 1) as avg_verify_rate,
          COUNT(*) as days_tracked
        FROM coach_trust_ledger
        WHERE ledger_date >= CURRENT_DATE - 30
        GROUP BY coach_name
      ),
      device_info AS (
        SELECT normalize_coach_name(coach_name) as coach_name,
          battery_level, is_online, last_location_at
        FROM mdm_devices
        WHERE coach_name NOT LIKE 'SM-%'
      )
      SELECT COALESCE(s.coach_name, t.coach_name) as coach_name,
        s.total_sessions, s.completed, s.cancelled, s.cancel_rate,
        t.total_ghosts_30d as ghosts,
        t.total_verified_30d as gps_verified,
        t.total_no_gps_30d as gps_no_data,
        t.avg_trust as trust_score,
        t.avg_verify_rate as gps_verify_pct,
        t.days_tracked,
        d.battery_level, d.is_online, d.last_location_at,
        CASE
          WHEN t.total_ghosts_30d > 5 THEN 'FRAUD_SUSPECT'
          WHEN t.total_ghosts_30d > 2 OR s.cancel_rate > 40 THEN 'HIGH_RISK'
          WHEN t.total_ghosts_30d > 0 OR s.cancel_rate > 20 THEN 'MONITOR'
          ELSE 'TRUSTED'
        END as intelligence_verdict
      FROM session_stats s
      FULL OUTER JOIN trust_recent t ON s.coach_name = t.coach_name
      LEFT JOIN device_info d ON COALESCE(s.coach_name, t.coach_name) = d.coach_name
      ORDER BY COALESCE(t.total_ghosts_30d, 0) DESC, COALESCE(s.cancel_rate, 0) DESC
    `);
    await client.queryArray(`GRANT SELECT ON public.view_session_gps_crosscheck TO anon, authenticated, service_role`);
    results.push("✅ view_session_gps_crosscheck v2 (with name normalization) OK");

    // 5. Trust summary view
    await client.queryArray(`DROP VIEW IF EXISTS public.view_coach_trust_summary CASCADE`);
    await client.queryArray(`
      CREATE VIEW public.view_coach_trust_summary AS
      SELECT coach_name, COUNT(*) as days_tracked,
        SUM(sessions_scheduled) as total_scheduled,
        SUM(sessions_completed) as total_completed,
        SUM(sessions_cancelled) as total_cancelled,
        SUM(ghost_sessions) as total_ghosts,
        SUM(gps_verified) as total_verified,
        ROUND(AVG(trust_score)) as avg_trust_score,
        ROUND(AVG(cancel_rate)::numeric, 1) as avg_cancel_rate,
        ROUND(AVG(travel_km)::numeric, 1) as avg_km_per_day,
        CASE
          WHEN SUM(ghost_sessions) > 10 THEN 'FRAUD_RISK'
          WHEN AVG(trust_score) < 30 THEN 'CRITICAL'
          WHEN AVG(trust_score) < 60 THEN 'REVIEW'
          ELSE 'TRUSTED'
        END as trust_tier,
        MIN(ledger_date) as tracking_since, MAX(ledger_date) as last_tracked
      FROM public.coach_trust_ledger
      WHERE ledger_date >= CURRENT_DATE - 30
      GROUP BY coach_name ORDER BY avg_trust_score ASC
    `);
    await client.queryArray(`GRANT SELECT ON public.view_coach_trust_summary TO anon, authenticated, service_role`);
    results.push("✅ view_coach_trust_summary OK");

    await client.queryArray(`NOTIFY pgrst, 'reload schema'`);
    results.push("✅ schema cache reloaded");

    await client.end();
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    try { await client.end(); } catch {}
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
