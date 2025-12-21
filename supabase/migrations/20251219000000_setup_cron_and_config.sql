-- ============================================================
-- CRON RELIABILITY + SETTINGS VALIDATION
-- Ensures pg_cron schedules exist for key Edge Functions
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper: clear existing schedules to make this migration idempotent
SELECT cron.unschedule('health-calculator');
SELECT cron.unschedule('churn-predictor');
SELECT cron.unschedule('ptd-self-learn');
SELECT cron.unschedule('ptd-24x7-monitor');
SELECT cron.unschedule('daily-settings-check');

-- Health calculator every 30 minutes
SELECT cron.schedule(
  'health-calculator',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/health-calculator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"mode": "full"}'::jsonb
  );
  $$
);

-- Churn predictor daily at 02:30 UTC
SELECT cron.schedule(
  'churn-predictor',
  '30 2 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/churn-predictor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- PTD self-learn daily at 02:00 UTC
SELECT cron.schedule(
  'ptd-self-learn',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/ptd-self-learn',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- PTD 24x7 monitor every 5 minutes
SELECT cron.schedule(
  'ptd-24x7-monitor',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/ptd-24x7-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Daily settings check to fail fast when configuration is missing
SELECT cron.schedule(
  'daily-settings-check',
  '5 3 * * *',
  $$
  DO $$
  DECLARE
    supabase_url text := current_setting('app.settings.supabase_url', true);
    service_role text := current_setting('app.settings.service_role_key', true);
  BEGIN
    IF supabase_url IS NULL OR service_role IS NULL THEN
      RAISE EXCEPTION 'Missing required settings: supabase_url=%, service_role_key=%', supabase_url, service_role;
    ELSE
      RAISE NOTICE 'Supabase settings present: %', supabase_url;
    END IF;
  END $$;
  $$
);

