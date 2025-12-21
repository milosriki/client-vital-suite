-- Remove duplicate cron jobs
SELECT cron.unschedule(10); -- business-intelligence-daily (duplicate)
SELECT cron.unschedule(11); -- sync-hubspot-hourly (duplicate)

-- Add Client Health & Intervention (runs every 6 hours)
-- ⚠️ SECURITY: Uses anon key from database settings (not hardcoded)
SELECT cron.schedule(
  'client-health-calculator',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/health-calculator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key', true)
    ),
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- Add Intervention Recommender (runs daily at 8 AM Dubai = 4 AM UTC)
SELECT cron.schedule(
  'daily-intervention-check',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/intervention-recommender',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key', true)
    ),
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);