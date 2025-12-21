-- Schedule business-intelligence function to run daily at 7 AM Dubai time (3 AM UTC)
SELECT cron.schedule(
  'daily-business-intelligence',
  '0 3 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/business-intelligence',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- Schedule midday refresh at 2 PM Dubai time (10 AM UTC)
SELECT cron.schedule(
  'midday-business-intelligence',
  '0 10 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/business-intelligence',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);
