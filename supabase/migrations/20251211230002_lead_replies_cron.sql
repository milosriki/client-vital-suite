-- Run every 2 hours during business hours
SELECT cron.schedule(
  'generate-lead-replies',
  '0 */2 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/generate-lead-replies',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);
