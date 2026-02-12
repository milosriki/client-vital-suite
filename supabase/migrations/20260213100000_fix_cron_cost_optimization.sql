-- ============================================================================
-- COST OPTIMIZATION: Eliminate duplicate crons + reduce frequencies
-- Estimated savings: ~380 fewer unnecessary Edge Function invocations/day
-- ============================================================================

-- 1. Kill duplicate health score crons (keep health-calculator only, reduced)
SELECT cron.unschedule('daily-health-scoring');
SELECT cron.unschedule('daily-health-score-calculator');

-- 2. Reduce health-calculator from every 30 min to 4x/day (2AM, 8AM, 2PM, 8PM UTC = 6AM, noon, 6PM, midnight UAE)
SELECT cron.unschedule('health-calculator');
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
SELECT cron.unschedule('ptd-24x7-monitor');
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

-- 4. Kill duplicate HubSpot hourly syncs (webhook handles real-time, daily safety net exists)
SELECT cron.unschedule('hubspot-sync-hourly');
SELECT cron.unschedule('hourly-hubspot-sync');

-- 5. Kill duplicate lead-reply cron (keep lead-reply-generator)
SELECT cron.unschedule('generate-lead-reply-2h');

-- 6. Kill duplicate business intelligence cron (keep daily-business-intelligence at 3AM)
SELECT cron.unschedule('business-intelligence-daily');

-- 7. Kill dead cron for deleted function
SELECT cron.unschedule('ptd-self-learn');

-- 8. Schedule missing cleanup-agent-memory (daily at 3AM UTC = 7AM UAE)
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
