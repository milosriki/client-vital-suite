-- Task 11: Schedule BI Agent (Daily 7 AM Dubai = 3 AM UTC)
-- ⚠️ SECURITY: Uses anon key from database settings (not hardcoded)
SELECT cron.schedule(
  'daily-business-intelligence',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/business-intelligence',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key', true)
    ),
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- Task 12: Schedule Lead Reply Agent (Every 2 hours)
SELECT cron.schedule(
  'lead-reply-generator',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/generate-lead-reply',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key', true)
    ),
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- Task 13: Schedule HubSpot Sync (Hourly)
SELECT cron.schedule(
  'hourly-hubspot-sync',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/sync-hubspot-to-supabase',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key', true)
    ),
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);