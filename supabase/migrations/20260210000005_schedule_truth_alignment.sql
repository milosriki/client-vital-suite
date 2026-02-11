-- Schedule AWS Truth Alignment daily at 03:00 UTC
-- This ensures that after the HubSpot sync, AWS ground truth is enforced

SELECT cron.schedule(
    'aws-truth-alignment-daily',
    '0 3 * * *',
    $$
    SELECT net.http_post(
        url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/aws-truth-alignment',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
    $$
);
