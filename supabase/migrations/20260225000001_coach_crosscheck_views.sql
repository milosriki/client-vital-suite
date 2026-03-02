DROP VIEW IF EXISTS public.view_session_gps_crosscheck CASCADE;
DROP VIEW IF EXISTS public.view_coach_trust_summary CASCADE;

CREATE OR REPLACE VIEW public.view_session_gps_crosscheck AS
WITH session_stats AS (
  SELECT coach_name,
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE status = 'Completed') as completed,
    COUNT(*) FILTER (WHERE status LIKE 'Cancelled-%' AND status != 'Cancelled-Rebooked') as cancelled,
    ROUND(COUNT(*) FILTER (WHERE status LIKE 'Cancelled-%' AND status != 'Cancelled-Rebooked')::numeric / NULLIF(COUNT(*), 0) * 100, 1) as cancel_rate
  FROM training_sessions_live
  WHERE training_date >= CURRENT_DATE - interval '30 days'
  GROUP BY coach_name
),
gps_stats AS (
  SELECT coach_name, total_sessions as gps_total, gps_verified, gps_mismatch, no_gps,
    ghost_session_count, pattern_score, risk_level, verification_rate,
    late_arrival_count, early_departure_count
  FROM coach_gps_patterns
  WHERE analysis_date = (SELECT MAX(analysis_date) FROM coach_gps_patterns)
)
SELECT
  COALESCE(s.coach_name, g.coach_name) as coach_name,
  s.total_sessions, s.completed, s.cancelled, s.cancel_rate,
  g.gps_verified, g.gps_mismatch, g.no_gps as gps_no_data,
  g.ghost_session_count as ghosts,
  g.pattern_score as gps_trust_score,
  g.risk_level as gps_risk,
  g.verification_rate as gps_verify_pct,
  g.late_arrival_count as late_arrivals,
  CASE
    WHEN g.ghost_session_count > 5 THEN 'FRAUD_SUSPECT'
    WHEN g.ghost_session_count > 3 OR s.cancel_rate > 35 THEN 'HIGH_RISK'
    WHEN g.ghost_session_count > 0 OR s.cancel_rate > 20 THEN 'MONITOR'
    ELSE 'TRUSTED'
  END as intelligence_verdict
FROM session_stats s
FULL OUTER JOIN gps_stats g ON LOWER(TRIM(s.coach_name)) = LOWER(TRIM(g.coach_name))
ORDER BY COALESCE(g.ghost_session_count, 0) DESC;

-- Coach trust ledger for long-term learning
CREATE TABLE IF NOT EXISTS public.coach_trust_ledger (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_name text NOT NULL,
  ledger_date date NOT NULL,
  sessions_scheduled int DEFAULT 0,
  sessions_completed int DEFAULT 0,
  sessions_cancelled int DEFAULT 0,
  gps_verified int DEFAULT 0,
  gps_mismatch int DEFAULT 0,
  gps_no_data int DEFAULT 0,
  ghost_sessions int DEFAULT 0,
  late_arrivals int DEFAULT 0,
  early_departures int DEFAULT 0,
  avg_arrival_offset_min numeric DEFAULT 0,
  total_dwell_min int DEFAULT 0,
  total_travel_min int DEFAULT 0,
  total_idle_min int DEFAULT 0,
  travel_km numeric DEFAULT 0,
  trust_score int DEFAULT 100,
  risk_level text DEFAULT 'normal',
  cancel_rate numeric DEFAULT 0,
  completion_rate numeric DEFAULT 0,
  verification_rate numeric DEFAULT 0,
  anomalies jsonb DEFAULT '[]'::jsonb,
  ai_insights jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(coach_name, ledger_date)
);
ALTER TABLE public.coach_trust_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_trust" ON public.coach_trust_ledger;
CREATE POLICY "anon_read_trust" ON public.coach_trust_ledger FOR SELECT USING (true);
CREATE POLICY "service_all_trust" ON public.coach_trust_ledger FOR ALL TO service_role USING (true);

-- Coach name normalization map
CREATE TABLE IF NOT EXISTS public.coach_name_map (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gps_name text NOT NULL,
  session_name text NOT NULL,
  confidence text DEFAULT 'exact',
  created_at timestamptz DEFAULT now(),
  UNIQUE(gps_name, session_name)
);
ALTER TABLE public.coach_name_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_namemap" ON public.coach_name_map FOR SELECT USING (true);
CREATE POLICY "service_all_namemap" ON public.coach_name_map FOR ALL TO service_role USING (true);

-- Add unique constraints needed for upserts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coach_recommendations_unique_type') THEN
    ALTER TABLE public.coach_recommendations ADD CONSTRAINT coach_recommendations_unique_type UNIQUE(coach_id, type, title);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'route_efficiency_logs_unique_date') THEN
    ALTER TABLE public.route_efficiency_logs ADD CONSTRAINT route_efficiency_logs_unique_date UNIQUE(coach_id, log_date);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Trust summary view (rolling 30d)
CREATE OR REPLACE VIEW public.view_coach_trust_summary AS
SELECT coach_name,
  COUNT(*) as days_tracked,
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
  MIN(ledger_date) as tracking_since,
  MAX(ledger_date) as last_tracked
FROM public.coach_trust_ledger
WHERE ledger_date >= CURRENT_DATE - 30
GROUP BY coach_name
ORDER BY avg_trust_score ASC;

GRANT SELECT ON public.view_session_gps_crosscheck TO anon, authenticated, service_role;
GRANT SELECT ON public.view_coach_trust_summary TO anon, authenticated, service_role;
