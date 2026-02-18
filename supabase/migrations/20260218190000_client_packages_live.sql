-- Live client packages synced from AWS RDS
CREATE TABLE IF NOT EXISTS client_packages_live (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id text NOT NULL,
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
  synced_at timestamptz DEFAULT now(),
  UNIQUE(package_id)
);

-- RLS
ALTER TABLE client_packages_live ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_client_packages_live" ON client_packages_live FOR SELECT TO anon USING (true);
CREATE POLICY "service_write_client_packages_live" ON client_packages_live FOR ALL TO service_role USING (true);

-- Training sessions live (last 90 days)
CREATE TABLE IF NOT EXISTS training_sessions_live (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rds_id text NOT NULL,
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
  synced_at timestamptz DEFAULT now(),
  UNIQUE(rds_id)
);

ALTER TABLE training_sessions_live ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_training_sessions_live" ON training_sessions_live FOR SELECT TO anon USING (true);
CREATE POLICY "service_write_training_sessions_live" ON training_sessions_live FOR ALL TO service_role USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cpl_depletion ON client_packages_live(depletion_priority);
CREATE INDEX IF NOT EXISTS idx_cpl_client ON client_packages_live(client_id);
CREATE INDEX IF NOT EXISTS idx_tsl_date ON training_sessions_live(training_date DESC);
CREATE INDEX IF NOT EXISTS idx_tsl_client ON training_sessions_live(client_id);
CREATE INDEX IF NOT EXISTS idx_tsl_coach ON training_sessions_live(coach_name);
