-- Schedule calculate-health-scores function to run daily at 6 AM Dubai time (2 AM UTC)
-- This calculates health scores for all active clients (outstanding_sessions > 0)
-- and updates HubSpot with client_health_score and client_health_zone fields

SELECT cron.schedule(
  'daily-health-score-calculator',
  '0 2 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/calculate-health-scores',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body:='{"trigger": "cron", "log_to_db": true}'::jsonb
    ) as request_id;
  $$
);

COMMENT ON EXTENSION cron IS 'Health score calculator runs daily at 6 AM Dubai time (2 AM UTC) via pg_cron';
