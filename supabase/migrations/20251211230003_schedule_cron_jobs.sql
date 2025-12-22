-- Enable pg_cron if not already enabled
-- create extension if not exists pg_cron;

-- Schedule Proactive Scanner (Every 15 minutes)
select cron.schedule(
  'ptd-proactive-scan',
  '*/15 * * * *',
  $$
  select
    net.http_post(
      url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/ptd-proactive-scanner',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
    ) as request_id;
  $$
);

-- Schedule Action Expiration (Every hour)
select cron.schedule(
  'ptd-expire-actions',
  '0 * * * *',
  $$
  select expire_old_prepared_actions();
  $$
);

-- Schedule Daily Business Intelligence Report (8:00 AM Dubai time = 4:00 AM UTC)
select cron.schedule(
  'ptd-daily-briefing',
  '0 4 * * *',
  $$
  select
    net.http_post(
      url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/ai-ceo-master',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body:='{"command": "Generate daily business intelligence briefing", "context": {"source": "cron"}}'::jsonb
    ) as request_id;
  $$
);
