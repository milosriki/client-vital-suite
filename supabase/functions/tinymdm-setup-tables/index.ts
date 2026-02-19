import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

const pool = new Pool(Deno.env.get("SUPABASE_DB_URL")!, 1);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const conn = await pool.connect();
  try {
    await conn.queryArray(`
      CREATE TABLE IF NOT EXISTS mdm_devices (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        tinymdm_device_id text UNIQUE NOT NULL,
        device_name text,
        coach_id text,
        coach_name text,
        policy_id text,
        last_sync_at timestamptz,
        battery_level integer,
        is_online boolean DEFAULT false,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS mdm_location_events (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        device_id text NOT NULL,
        recorded_at timestamptz NOT NULL,
        lat double precision NOT NULL,
        lng double precision NOT NULL,
        accuracy_m double precision,
        raw_hash text,
        UNIQUE(device_id, recorded_at)
      );

      CREATE TABLE IF NOT EXISTS mdm_pois (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        name text NOT NULL,
        type text DEFAULT 'client_home',
        lat double precision NOT NULL,
        lng double precision NOT NULL,
        radius_m integer DEFAULT 50,
        client_id text,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS mdm_visits (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        coach_id text,
        device_id text,
        poi_id uuid REFERENCES mdm_pois(id),
        start_ts timestamptz NOT NULL,
        end_ts timestamptz,
        duration_min integer,
        confidence double precision DEFAULT 0.5,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS mdm_session_verifications (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        session_id text,
        status text DEFAULT 'unverified' CHECK (status IN ('verified','unverified','flagged')),
        points_in_geofence integer DEFAULT 0,
        max_distance_m double precision,
        evidence_window tstzrange,
        created_at timestamptz DEFAULT now()
      );

      -- Enable RLS on all tables
      ALTER TABLE mdm_devices ENABLE ROW LEVEL SECURITY;
      ALTER TABLE mdm_location_events ENABLE ROW LEVEL SECURITY;
      ALTER TABLE mdm_pois ENABLE ROW LEVEL SECURITY;
      ALTER TABLE mdm_visits ENABLE ROW LEVEL SECURITY;
      ALTER TABLE mdm_session_verifications ENABLE ROW LEVEL SECURITY;

      -- Anon read policies
      DROP POLICY IF EXISTS "anon_read_mdm_devices" ON mdm_devices;
      CREATE POLICY "anon_read_mdm_devices" ON mdm_devices FOR SELECT TO anon USING (true);

      DROP POLICY IF EXISTS "anon_read_mdm_location_events" ON mdm_location_events;
      CREATE POLICY "anon_read_mdm_location_events" ON mdm_location_events FOR SELECT TO anon USING (true);

      DROP POLICY IF EXISTS "anon_read_mdm_pois" ON mdm_pois;
      CREATE POLICY "anon_read_mdm_pois" ON mdm_pois FOR SELECT TO anon USING (true);

      DROP POLICY IF EXISTS "anon_read_mdm_visits" ON mdm_visits;
      CREATE POLICY "anon_read_mdm_visits" ON mdm_visits FOR SELECT TO anon USING (true);

      DROP POLICY IF EXISTS "anon_read_mdm_session_verifications" ON mdm_session_verifications;
      CREATE POLICY "anon_read_mdm_session_verifications" ON mdm_session_verifications FOR SELECT TO anon USING (true);

      -- Service role write policies
      DROP POLICY IF EXISTS "service_write_mdm_devices" ON mdm_devices;
      CREATE POLICY "service_write_mdm_devices" ON mdm_devices FOR ALL TO service_role USING (true) WITH CHECK (true);

      DROP POLICY IF EXISTS "service_write_mdm_location_events" ON mdm_location_events;
      CREATE POLICY "service_write_mdm_location_events" ON mdm_location_events FOR ALL TO service_role USING (true) WITH CHECK (true);

      DROP POLICY IF EXISTS "service_write_mdm_pois" ON mdm_pois;
      CREATE POLICY "service_write_mdm_pois" ON mdm_pois FOR ALL TO service_role USING (true) WITH CHECK (true);

      DROP POLICY IF EXISTS "service_write_mdm_visits" ON mdm_visits;
      CREATE POLICY "service_write_mdm_visits" ON mdm_visits FOR ALL TO service_role USING (true) WITH CHECK (true);

      DROP POLICY IF EXISTS "service_write_mdm_session_verifications" ON mdm_session_verifications;
      CREATE POLICY "service_write_mdm_session_verifications" ON mdm_session_verifications FOR ALL TO service_role USING (true) WITH CHECK (true);

      -- Extra columns for device details
      ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS os_version text;
      ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS imei text;
      ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS serial_number text;
      ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS manufacturer text;
      ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS phone_number text;
      ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS enrollment_type text;
      ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS user_id text;
      ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS group_id text;
      ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS last_lat double precision;
      ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS last_lng double precision;
      ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS last_address text;
      ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS last_location_at timestamptz;

      -- Extra column for location address
      ALTER TABLE mdm_location_events ADD COLUMN IF NOT EXISTS address text;

      -- Add unique constraint on raw_hash if not exists
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mdm_location_events_raw_hash ON mdm_location_events(raw_hash);

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_mdm_location_events_device_time ON mdm_location_events(device_id, recorded_at DESC);
      CREATE INDEX IF NOT EXISTS idx_mdm_visits_coach_time ON mdm_visits(coach_id, start_ts DESC);
      CREATE INDEX IF NOT EXISTS idx_mdm_location_events_time ON mdm_location_events(recorded_at DESC);
    `);

    return new Response(JSON.stringify({ success: true, message: "All MDM tables created with RLS policies" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    conn.release();
  }
});
