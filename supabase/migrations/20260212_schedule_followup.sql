-- Schedule Antigravity Follow-up Engine (Every hour)
-- This replaces the template-based mockup with an AI-driven high-status re-engager
SELECT cron.schedule(
  'ptd-antigravity-followup',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/antigravity-followup-engine',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);
