-- ==============================================================================
-- GPS INTELLIGENCE SUPREME: 30-Day Patterns, Predictions, Cron Retention
-- ==============================================================================

-- 1. Coach GPS Patterns Table (The Core Intelligence Store)
CREATE TABLE IF NOT EXISTS public.coach_gps_patterns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_name text NOT NULL,
  analysis_date date NOT NULL DEFAULT CURRENT_DATE,
  total_sessions int DEFAULT 0,
  gps_verified int DEFAULT 0,
  gps_mismatch int DEFAULT 0,
  no_gps int DEFAULT 0,
  avg_arrival_offset_min numeric DEFAULT 0,   -- negative=early, positive=late
  avg_dwell_vs_scheduled_min numeric DEFAULT 0, -- negative=left early
  ghost_session_count int DEFAULT 0,
  late_arrival_count int DEFAULT 0,           -- >15min late
  early_departure_count int DEFAULT 0,        -- left >10min early
  verification_rate numeric DEFAULT 0,        -- 0-100%
  pattern_score numeric DEFAULT 0,            -- 0-100 (higher=more trustworthy)
  risk_level text DEFAULT 'normal',           -- normal | review | critical
  anomalies jsonb DEFAULT '[]'::jsonb,        -- specific anomalies + predictions
  created_at timestamptz DEFAULT now(),
  UNIQUE(coach_name, analysis_date)
);

-- RLS
ALTER TABLE public.coach_gps_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_coach_gps_patterns" ON public.coach_gps_patterns;
DROP POLICY IF EXISTS "write_coach_gps_patterns" ON public.coach_gps_patterns;

CREATE POLICY "read_coach_gps_patterns"  ON public.coach_gps_patterns FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_coach_gps_patterns" ON public.coach_gps_patterns FOR ALL    TO service_role  USING (true) WITH CHECK (true);

GRANT ALL  ON public.coach_gps_patterns TO service_role;
GRANT SELECT ON public.coach_gps_patterns TO authenticated;

-- 2. GPS Staleness Alerts Table
CREATE TABLE IF NOT EXISTS public.gps_device_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id text NOT NULL,
  coach_name text,
  alert_type text NOT NULL,   -- STALENESS | NO_GPS | DEVICE_OFFLINE
  severity text NOT NULL DEFAULT 'warning', -- info | warning | critical
  last_seen_at timestamptz,
  hours_silent numeric,
  message text,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Note: expression-based unique index with DATE_TRUNC(timestamptz) not allowed (non-IMMUTABLE).
-- Deduplication handled at application layer instead.
-- CREATE UNIQUE INDEX idx_gps_device_alerts_unique ON public.gps_device_alerts(device_id, alert_type, DATE_TRUNC('day', created_at));

ALTER TABLE public.gps_device_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_gps_alerts" ON public.gps_device_alerts;
DROP POLICY IF EXISTS "write_gps_alerts" ON public.gps_device_alerts;

CREATE POLICY "read_gps_alerts"  ON public.gps_device_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_gps_alerts" ON public.gps_device_alerts FOR ALL    TO service_role  USING (true) WITH CHECK (true);

GRANT ALL    ON public.gps_device_alerts TO service_role;
GRANT SELECT ON public.gps_device_alerts TO authenticated;

-- 3. Indexes for 30-day queries
CREATE INDEX IF NOT EXISTS idx_mdm_location_events_recorded_at
  ON public.mdm_location_events(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_gps_patterns_date
  ON public.coach_gps_patterns(analysis_date DESC, coach_name);

CREATE INDEX IF NOT EXISTS idx_coach_gps_patterns_risk
  ON public.coach_gps_patterns(risk_level, analysis_date DESC);

-- 4. Cron: Pull GPS every 6 hours (captures data before TinyMDM ~3-day window expires)
DO $$ BEGIN PERFORM cron.unschedule('gps-pull-every-6h'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'gps-pull-every-6h',
  '0 */6 * * *',
  $$
  select net.http(
    url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/tinymdm-pull-locations',
    method:='POST',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('request.header.apikey', true) || '"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- 5. Cron: Run pattern analyzer daily at 2am Dubai time (= 22:00 UTC)
DO $$ BEGIN PERFORM cron.unschedule('gps-pattern-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'gps-pattern-daily',
  '0 22 * * *',
  $$
  select net.http(
    url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/gps-pattern-analyzer',
    method:='POST',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('request.header.apikey', true) || '"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- 6. Cron: Cleanup GPS data older than 90 days (weekly, Sunday 3am UTC)
DO $$ BEGIN PERFORM cron.unschedule('gps-cleanup-90d'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'gps-cleanup-90d',
  '0 3 * * 0',
  $$
  DELETE FROM mdm_location_events WHERE recorded_at < NOW() - INTERVAL '90 days';
  $$
);

-- 7. Cron: Run dwell engine every 6 hours (build coach_visits from raw pings)
DO $$ BEGIN PERFORM cron.unschedule('gps-dwell-every-6h'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'gps-dwell-every-6h',
  '30 */6 * * *',
  $$
  select net.http(
    url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/gps-dwell-engine',
    method:='POST',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('request.header.apikey', true) || '"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- 8. View: Latest pattern score per coach (convenience)
CREATE OR REPLACE VIEW view_coach_pattern_latest AS
SELECT DISTINCT ON (coach_name)
  coach_name,
  analysis_date,
  total_sessions,
  gps_verified,
  gps_mismatch,
  no_gps,
  ghost_session_count,
  late_arrival_count,
  early_departure_count,
  avg_arrival_offset_min,
  avg_dwell_vs_scheduled_min,
  verification_rate,
  pattern_score,
  risk_level,
  anomalies,
  created_at
FROM public.coach_gps_patterns
ORDER BY coach_name, analysis_date DESC;

GRANT SELECT ON view_coach_pattern_latest TO authenticated;
GRANT SELECT ON view_coach_pattern_latest TO service_role;

-- Notify PostgREST
NOTIFY pgrst, 'reload schema';
