-- Schedule Weekly CEO Report every Monday at 06:00 UTC
SELECT cron.schedule(
    'weekly-ceo-report-monday',
    '0 6 * * 1',
    $$
    SELECT net.http_post(
        url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/weekly-ceo-report',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
    $$
);
