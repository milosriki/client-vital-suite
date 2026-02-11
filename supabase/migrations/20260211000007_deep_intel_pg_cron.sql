-- ======================================================
-- pg_cron: Deep Intelligence Agent Schedule
-- Run in Supabase Dashboard > SQL Editor
-- ======================================================

-- Enable pg_cron if not already enabled
-- create extension if not exists pg_cron;

-- ─── DAILY AGENTS (run at 4:30 AM UAE = 00:30 UTC) ─────

-- 1. Marketing Historian: compute 30/60/90d baselines
SELECT cron.schedule(
  'deep-intel-historian',
  '30 0 * * *',  -- 04:30 UAE daily
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/marketing-historian',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 2. Funnel Stage Tracker: compute 12-stage funnel metrics
SELECT cron.schedule(
  'deep-intel-funnel',
  '35 0 * * *',  -- 04:35 UAE daily
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/funnel-stage-tracker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 3. Marketing Loss Analyst: analyze closed-lost deals
SELECT cron.schedule(
  'deep-intel-loss-analyst',
  '40 0 * * *',  -- 04:40 UAE daily
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/marketing-loss-analyst',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 4. Marketing Predictor: generate revenue projections & alerts
SELECT cron.schedule(
  'deep-intel-predictor',
  '45 0 * * *',  -- 04:45 UAE daily
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/marketing-predictor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 5. Daily Marketing Brief: CEO morning intelligence report (runs at 08:30 UAE = 04:30 UTC)
SELECT cron.schedule(
  'deep-intel-ceo-brief',
  '30 4 * * *',  -- 08:30 UAE daily
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/daily-marketing-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ─── VERIFY SCHEDULE ──────────────────────────────
-- SELECT * FROM cron.job WHERE jobname LIKE 'deep-intel%';
