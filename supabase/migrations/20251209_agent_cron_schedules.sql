-- Phase 3: Automation - Cron Schedules

-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Task 11: Schedule Business Intelligence Agent (Daily at 7:00 AM UTC)
SELECT cron.schedule(
    'business-intelligence-daily',
    '0 7 * * *',
    $$
    SELECT
      net.http_post(
          url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/business-intelligence',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
);

-- Task 12: Schedule Lead Reply Agent (Every 2 hours)
SELECT cron.schedule(
    'generate-lead-reply-2h',
    '0 */2 * * *',
    $$
    SELECT
      net.http_post(
          url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/generate-lead-reply',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
);

-- Task 13: Schedule HubSpot Sync (Every hour)
SELECT cron.schedule(
    'hubspot-sync-hourly',
    '0 * * * *',
    $$
    SELECT
      net.http_post(
          url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/sync-hubspot-to-supabase',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
);
