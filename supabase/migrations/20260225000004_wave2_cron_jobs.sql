-- ======================================================
-- Wave 2: New pg_cron Job Schedules
-- ======================================================
-- All times in UTC. Dubai (Gulf Standard Time) = UTC+4.
-- Existing pattern: net.http_post with service_role key.
-- ======================================================

-- ─── 1. update-currency-rates: 02:00 UTC = 06:00 Dubai ───
DO $$ BEGIN PERFORM cron.unschedule('update-currency-rates'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'update-currency-rates',
  '0 2 * * *',  -- 02:00 UTC = 06:00 Dubai daily
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/update-currency-rates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ─── 2. populate-loss-analysis: 02:15 UTC = 06:15 Dubai ───
DO $$ BEGIN PERFORM cron.unschedule('populate-loss-analysis'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'populate-loss-analysis',
  '15 2 * * *',  -- 02:15 UTC = 06:15 Dubai daily
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/populate-loss-analysis',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ─── 3. populate-baselines: 03:00 UTC = 07:00 Dubai ───
DO $$ BEGIN PERFORM cron.unschedule('populate-baselines'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'populate-baselines',
  '0 3 * * *',  -- 03:00 UTC = 07:00 Dubai daily
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/populate-baselines',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ─── 4. ad-creative-analyst: 04:00 UTC = 08:00 Dubai ───
DO $$ BEGIN PERFORM cron.unschedule('ad-creative-analyst'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'ad-creative-analyst',
  '0 4 * * *',  -- 04:00 UTC = 08:00 Dubai daily
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/ad-creative-analyst',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ─── 5. true-roas-calculator: 05:00 UTC = 09:00 Dubai ───
DO $$ BEGIN PERFORM cron.unschedule('true-roas-calculator'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'true-roas-calculator',
  '0 5 * * *',  -- 05:00 UTC = 09:00 Dubai daily
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/true-roas-calculator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
