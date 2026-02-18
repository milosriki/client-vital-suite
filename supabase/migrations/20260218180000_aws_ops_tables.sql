-- AWS Operations Data Tables
-- Synced from AWS RDS via local script (IP-whitelisted)

-- Training sessions mirror
CREATE TABLE IF NOT EXISTS training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rds_id integer UNIQUE,
  client_id text,
  client_name text,
  client_email text,
  coach_id text,
  coach_name text,
  training_date timestamptz,
  status text,
  session_type text,
  time_slot text,
  package_code text,
  location text,
  synced_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ts_date ON training_sessions(training_date);
CREATE INDEX IF NOT EXISTS idx_ts_coach ON training_sessions(coach_name, training_date);
CREATE INDEX IF NOT EXISTS idx_ts_client ON training_sessions(client_id, training_date);
CREATE INDEX IF NOT EXISTS idx_ts_status ON training_sessions(status);

-- Client packages mirror
CREATE TABLE IF NOT EXISTS client_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id text UNIQUE,
  client_id text,
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
  sessions_per_week numeric,
  future_booked integer DEFAULT 0,
  next_session_date timestamptz,
  depletion_priority text, -- CRITICAL, HIGH, MEDIUM, WATCH, SAFE
  days_until_depleted integer,
  synced_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cp_priority ON client_packages(depletion_priority);
CREATE INDEX IF NOT EXISTS idx_cp_client ON client_packages(client_id);
CREATE INDEX IF NOT EXISTS idx_cp_remaining ON client_packages(remaining_sessions);

-- Daily ops snapshot (one row per day, JSONB columns for dashboard)
CREATE TABLE IF NOT EXISTS aws_ops_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date UNIQUE NOT NULL,
  generated_at timestamptz DEFAULT now(),
  
  -- Summary numbers
  sessions_today integer DEFAULT 0,
  sessions_confirmed_today integer DEFAULT 0,
  active_clients_30d integer DEFAULT 0,
  total_packages_active integer DEFAULT 0,
  
  -- Package alerts
  packages_critical integer DEFAULT 0,
  packages_high integer DEFAULT 0,
  packages_medium integer DEFAULT 0,
  
  -- Frequency trends
  clients_increasing integer DEFAULT 0,
  clients_decreasing integer DEFAULT 0,
  clients_stable integer DEFAULT 0,
  
  -- JSONB detail data
  coach_leaderboard jsonb,
  critical_packages jsonb,
  high_packages jsonb,
  declining_clients jsonb,
  daily_sessions jsonb,
  frequency_trends jsonb
);

-- Coach performance (daily snapshot)
CREATE TABLE IF NOT EXISTS aws_coach_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL,
  coach_name text NOT NULL,
  avg_sessions_per_day numeric,
  max_sessions_day integer,
  active_days integer,
  total_completed integer,
  total_cancelled integer,
  completion_rate numeric,
  avg_clients_per_day numeric,
  clients_90d integer,
  active_last_14d integer,
  retention_14d_pct numeric,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(report_date, coach_name)
);

-- RLS policies (anon read for dashboard)
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE aws_ops_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE aws_coach_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_training_sessions" ON training_sessions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_client_packages" ON client_packages FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_aws_ops_snapshot" ON aws_ops_snapshot FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_aws_coach_performance" ON aws_coach_performance FOR SELECT TO anon USING (true);

-- Service role can write
CREATE POLICY "service_write_training_sessions" ON training_sessions FOR ALL TO service_role USING (true);
CREATE POLICY "service_write_client_packages" ON client_packages FOR ALL TO service_role USING (true);
CREATE POLICY "service_write_aws_ops_snapshot" ON aws_ops_snapshot FOR ALL TO service_role USING (true);
CREATE POLICY "service_write_aws_coach_performance" ON aws_coach_performance FOR ALL TO service_role USING (true);
