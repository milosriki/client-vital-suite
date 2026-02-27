-- Compatibility layer for frontend queries expecting legacy client_health_daily columns
-- Source of truth remains AWS-derived scoring written by health-score-engine.

BEGIN;

-- 1) Add legacy/expected columns (no-op if already present)
ALTER TABLE public.client_health_daily
  ADD COLUMN IF NOT EXISTS health_score numeric,
  ADD COLUMN IF NOT EXISTS health_zone text,
  ADD COLUMN IF NOT EXISTS assigned_coach text,
  ADD COLUMN IF NOT EXISTS package_type text,
  ADD COLUMN IF NOT EXISTS outstanding_sessions integer,
  ADD COLUMN IF NOT EXISTS package_value_aed numeric,
  ADD COLUMN IF NOT EXISTS churn_risk_score numeric,
  ADD COLUMN IF NOT EXISTS calculated_at timestamptz,
  ADD COLUMN IF NOT EXISTS calculated_on date,
  ADD COLUMN IF NOT EXISTS calculated_date date,
  ADD COLUMN IF NOT EXISTS days_since_last_session integer,
  ADD COLUMN IF NOT EXISTS sessions_last_30d integer,
  ADD COLUMN IF NOT EXISTS sessions_last_7d integer,
  ADD COLUMN IF NOT EXISTS sessions_last_90d integer,
  ADD COLUMN IF NOT EXISTS sessions_purchased integer,
  ADD COLUMN IF NOT EXISTS health_trend text,
  ADD COLUMN IF NOT EXISTS momentum_indicator text,
  ADD COLUMN IF NOT EXISTS package_health_score numeric,
  ADD COLUMN IF NOT EXISTS predictive_risk_score numeric,
  ADD COLUMN IF NOT EXISTS relationship_score numeric,
  ADD COLUMN IF NOT EXISTS engagement_score numeric,
  ADD COLUMN IF NOT EXISTS financial_score numeric,
  ADD COLUMN IF NOT EXISTS client_segment text,
  ADD COLUMN IF NOT EXISTS intervention_priority text,
  ADD COLUMN IF NOT EXISTS risk_category text,
  ADD COLUMN IF NOT EXISTS risk_factors jsonb,
  ADD COLUMN IF NOT EXISTS rate_of_change_percent numeric,
  ADD COLUMN IF NOT EXISTS early_warning_flag boolean,
  ADD COLUMN IF NOT EXISTS days_until_renewal integer,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS firstname text,
  ADD COLUMN IF NOT EXISTS lastname text,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS hubspot_contact_id text,
  ADD COLUMN IF NOT EXISTS calculation_version text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- 2) Backfill compatibility columns from current canonical columns
UPDATE public.client_health_daily
SET
  health_score = COALESCE(health_score, total_score),
  health_zone = COALESCE(
    health_zone,
    CASE UPPER(COALESCE(tier, ''))
      WHEN 'HEALTHY' THEN 'GREEN'
      WHEN 'ATTENTION' THEN 'YELLOW'
      WHEN 'AT_RISK' THEN 'ORANGE'
      WHEN 'CRITICAL' THEN 'RED'
      WHEN 'FROZEN' THEN 'RED'
      ELSE tier
    END
  ),
  assigned_coach = COALESCE(assigned_coach, coach_name),
  outstanding_sessions = COALESCE(outstanding_sessions, remaining_sessions),
  package_value_aed = COALESCE(package_value_aed, package_value),
  calculated_on = COALESCE(calculated_on, score_date),
  calculated_date = COALESCE(calculated_date, score_date),
  calculated_at = COALESCE(calculated_at, created_at, (score_date::timestamptz)),
  days_since_last_session = COALESCE(days_since_last_session, days_since_training),
  sessions_last_30d = COALESCE(sessions_last_30d, sessions_30d),
  health_trend = COALESCE(health_trend, trend),
  package_health_score = COALESCE(package_health_score, package_score),
  momentum_indicator = COALESCE(momentum_indicator, trend),
  churn_risk_score = COALESCE(churn_risk_score, LEAST(100, GREATEST(0, COALESCE(cancel_rate, 0) * 100))),
  risk_category = COALESCE(risk_category, tier),
  risk_factors = COALESCE(risk_factors, jsonb_build_object('alert', alert, 'cancel_rate', cancel_rate)),
  updated_at = COALESCE(updated_at, now())
WHERE TRUE;

-- 3) Keep compatibility columns synced on future inserts/updates
CREATE OR REPLACE FUNCTION public.sync_client_health_daily_compat()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.health_score := COALESCE(NEW.health_score, NEW.total_score);
  NEW.health_zone := COALESCE(
    NEW.health_zone,
    CASE UPPER(COALESCE(NEW.tier, ''))
      WHEN 'HEALTHY' THEN 'GREEN'
      WHEN 'ATTENTION' THEN 'YELLOW'
      WHEN 'AT_RISK' THEN 'ORANGE'
      WHEN 'CRITICAL' THEN 'RED'
      WHEN 'FROZEN' THEN 'RED'
      ELSE NEW.tier
    END
  );
  NEW.assigned_coach := COALESCE(NEW.assigned_coach, NEW.coach_name);
  NEW.outstanding_sessions := COALESCE(NEW.outstanding_sessions, NEW.remaining_sessions);
  NEW.package_value_aed := COALESCE(NEW.package_value_aed, NEW.package_value);
  NEW.calculated_on := COALESCE(NEW.calculated_on, NEW.score_date);
  NEW.calculated_date := COALESCE(NEW.calculated_date, NEW.score_date);
  NEW.calculated_at := COALESCE(NEW.calculated_at, NEW.created_at, (NEW.score_date::timestamptz), now());
  NEW.days_since_last_session := COALESCE(NEW.days_since_last_session, NEW.days_since_training);
  NEW.sessions_last_30d := COALESCE(NEW.sessions_last_30d, NEW.sessions_30d);
  NEW.health_trend := COALESCE(NEW.health_trend, NEW.trend);
  NEW.package_health_score := COALESCE(NEW.package_health_score, NEW.package_score);
  NEW.momentum_indicator := COALESCE(NEW.momentum_indicator, NEW.trend);
  NEW.churn_risk_score := COALESCE(NEW.churn_risk_score, LEAST(100, GREATEST(0, COALESCE(NEW.cancel_rate, 0) * 100)));
  NEW.risk_category := COALESCE(NEW.risk_category, NEW.tier);
  NEW.risk_factors := COALESCE(NEW.risk_factors, jsonb_build_object('alert', NEW.alert, 'cancel_rate', NEW.cancel_rate));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_health_daily_compat ON public.client_health_daily;
CREATE TRIGGER trg_sync_client_health_daily_compat
BEFORE INSERT OR UPDATE ON public.client_health_daily
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_health_daily_compat();

-- 4) Helpful indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_client_health_daily_calculated_at ON public.client_health_daily (calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_health_daily_health_zone ON public.client_health_daily (health_zone);
CREATE INDEX IF NOT EXISTS idx_client_health_daily_assigned_coach ON public.client_health_daily (assigned_coach);

COMMIT;
