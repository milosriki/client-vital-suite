-- Schedule System Health Check (Daily at 9 AM Dubai time = 5 AM UTC)
select cron.schedule(
  'system-health-check-daily',
  '0 5 * * *',
  $$
  select
    net.http_post(
      url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/system-health-check',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
    ) as request_id;
  $$
);
