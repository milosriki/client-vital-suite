import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const statements = [
    `CREATE TABLE IF NOT EXISTS clients_full (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      client_id text UNIQUE NOT NULL,
      email text,
      first_name text,
      last_name text,
      phone text,
      status text DEFAULT 'active',
      registration_date timestamptz,
      last_login timestamptz,
      packages jsonb DEFAULT '[]',
      total_sessions_365d integer DEFAULT 0,
      last_completed_session timestamptz,
      cancellations_90d integer DEFAULT 0,
      synced_at timestamptz DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS coaches_full (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      coach_name text UNIQUE NOT NULL,
      active_clients integer DEFAULT 0,
      total_clients_ever integer DEFAULT 0,
      total_remaining_sessions integer DEFAULT 0,
      total_sessions_year integer DEFAULT 0,
      last_session_date timestamptz,
      synced_at timestamptz DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS training_sessions_full (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      client_id text,
      client_email text,
      client_name text,
      coach_name text,
      training_date timestamptz NOT NULL,
      status text,
      session_type text,
      location text,
      synced_at timestamptz DEFAULT now(),
      UNIQUE(client_id, training_date, coach_name)
    )`,
    // RLS
    `ALTER TABLE clients_full ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE coaches_full ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE training_sessions_full ENABLE ROW LEVEL SECURITY`,
    // Anon read policies
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clients_full' AND policyname='anon_read') THEN
        CREATE POLICY anon_read ON clients_full FOR SELECT TO anon USING (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='coaches_full' AND policyname='anon_read') THEN
        CREATE POLICY anon_read ON coaches_full FOR SELECT TO anon USING (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='training_sessions_full' AND policyname='anon_read') THEN
        CREATE POLICY anon_read ON training_sessions_full FOR SELECT TO anon USING (true);
      END IF;
    END $$`,
    // Service role write policies
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clients_full' AND policyname='service_write') THEN
        CREATE POLICY service_write ON clients_full FOR ALL TO service_role USING (true) WITH CHECK (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='coaches_full' AND policyname='service_write') THEN
        CREATE POLICY service_write ON coaches_full FOR ALL TO service_role USING (true) WITH CHECK (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='training_sessions_full' AND policyname='service_write') THEN
        CREATE POLICY service_write ON training_sessions_full FOR ALL TO service_role USING (true) WITH CHECK (true);
      END IF;
    END $$`,
    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_clients_full_status ON clients_full(status)`,
    `CREATE INDEX IF NOT EXISTS idx_clients_full_email ON clients_full(email)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_full_date ON training_sessions_full(training_date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_full_client ON training_sessions_full(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_full_coach ON training_sessions_full(coach_name)`,
  ];

  const results = [];
  for (const sql of statements) {
    const { error } = await supabase.rpc("exec_sql", { query: sql }).maybeSingle();
    if (error) {
      // Try direct SQL via postgrest if exec_sql doesn't exist
      const res = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/exec_sql`,
        {
          method: "POST",
          headers: {
            apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: sql }),
        }
      );
      results.push({ sql: sql.substring(0, 60), error: error.message });
    } else {
      results.push({ sql: sql.substring(0, 60), ok: true });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
