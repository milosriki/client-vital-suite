-- Schedule CallGear sync every 10 minutes
SELECT cron.schedule(
  'fetch-callgear-data-10min',
  '*/10 * * * *', -- Every 10 minutes
  $$
  SELECT
    net.http_post(
      url := (SELECT 'https://' || current_setting('app.settings.supabase_url') || '/functions/v1/fetch-callgear-data'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('limit', 100)
    );
  $$
);
