-- ============================================
-- Missing Views: assessment_truth_matrix + daily_marketing_briefs
-- GPS Cron: Pull locations every 6 hours for 30-day data retention
-- Data Retention: Clean GPS events older than 90 days
-- ============================================

-- 1. assessment_truth_matrix view: SKIPPED
-- Reason: client_health_scores.client_email column missing, contacts missing owner_name/assigned_coach
-- TODO: Fix schema then re-enable

-- 2. daily_marketing_briefs view: SKIPPED
-- Reason: May reference missing columns. Deferred to schema alignment.

-- 3. GPS Pull Cron (every 6 hours — accumulates 30+ days)
SELECT cron.schedule(
  'gps-pull-every-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/tinymdm-pull-locations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 4. GPS Data Retention (clean >90 day events, keep 30-day analysis window)
SELECT cron.schedule(
  'gps-cleanup-90d',
  '0 3 * * 0',
  $$
  DELETE FROM mdm_location_events WHERE recorded_at < NOW() - INTERVAL '90 days';
  $$
);

-- 5. Coach GPS Patterns Table (for predictions — created in 20260224220000, IF NOT EXISTS is safe)
CREATE TABLE IF NOT EXISTS coach_gps_patterns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_name text NOT NULL,
  analysis_date date NOT NULL DEFAULT CURRENT_DATE,
  total_sessions int DEFAULT 0,
  gps_verified int DEFAULT 0,
  gps_mismatch int DEFAULT 0,
  no_gps int DEFAULT 0,
  avg_arrival_offset_min numeric DEFAULT 0,
  avg_dwell_vs_scheduled_min numeric DEFAULT 0,
  ghost_session_count int DEFAULT 0,
  late_arrival_count int DEFAULT 0,
  early_departure_count int DEFAULT 0,
  verification_rate numeric DEFAULT 0,
  pattern_score numeric DEFAULT 0,
  risk_level text DEFAULT 'normal',
  anomalies jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  UNIQUE(coach_name, analysis_date)
);

-- RLS for coach_gps_patterns
ALTER TABLE coach_gps_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on coach_gps_patterns" ON coach_gps_patterns;
CREATE POLICY "Service role full access on coach_gps_patterns" ON coach_gps_patterns
  FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated read coach_gps_patterns" ON coach_gps_patterns;
CREATE POLICY "Authenticated read coach_gps_patterns" ON coach_gps_patterns
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_coach_gps_patterns_coach ON coach_gps_patterns(coach_name);
CREATE INDEX IF NOT EXISTS idx_coach_gps_patterns_date ON coach_gps_patterns(analysis_date);
