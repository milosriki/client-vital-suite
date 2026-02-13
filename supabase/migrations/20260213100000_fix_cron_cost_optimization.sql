-- ============================================================================
-- COST OPTIMIZATION: Eliminate duplicate crons + reduce frequencies
-- Estimated savings: ~380 fewer unnecessary Edge Function invocations/day
-- ============================================================================

-- Safely unschedule crons (ignore errors if they don't exist)
DO $$
BEGIN
  PERFORM cron.unschedule('daily-health-scoring');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('daily-health-score-calculator');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Reduce health-calculator from every 30 min to 4x/day
DO $$
BEGIN
  PERFORM cron.unschedule('health-calculator');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('health-calculator', '0 2,8,14,20 * * *', $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/calculate-health-scores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"log_to_db": true}'::jsonb
  );
$$);

-- 3. Reduce ptd-24x7-monitor from every 5 min to every 15 min
DO $$
BEGIN
  PERFORM cron.unschedule('ptd-24x7-monitor');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('ptd-24x7-monitor', '*/15 * * * *', $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ptd-24x7-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
$$);

-- 4. Kill duplicate HubSpot hourly syncs
DO $$
BEGIN
  PERFORM cron.unschedule('hubspot-sync-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('hourly-hubspot-sync');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 5. Kill duplicate lead-reply cron
DO $$
BEGIN
  PERFORM cron.unschedule('generate-lead-reply-2h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. Kill duplicate business intelligence cron
DO $$
BEGIN
  PERFORM cron.unschedule('business-intelligence-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 7. Kill dead cron for deleted function
DO $$
BEGIN
  PERFORM cron.unschedule('ptd-self-learn');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 8. Schedule cleanup-agent-memory (daily at 3AM UTC = 7AM UAE)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-agent-memory');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('cleanup-agent-memory', '0 3 * * *', $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/cleanup-agent-memory',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
$$);