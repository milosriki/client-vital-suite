-- Fix cron job URLs: use CVS project ztjndilxurtsfqdsvfds (was wrongly lqmnbntloslpsjbsdoid).
-- Rollback: re-run 20260203000000 logic with wrong URL if needed.

DO $$
BEGIN
    PERFORM cron.unschedule('fetch-callgear-data');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
    'fetch-callgear-data',
    '0 22 * * *',
    $$
    select
      net.http(
        url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/fetch-callgear-data',
        method:='POST',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('request.header.apikey', true) || '"}'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
    $$
);

DO $$
BEGIN
    PERFORM cron.unschedule('sync-hubspot-daily-safety');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
    'sync-hubspot-daily-safety',
    '0 23 * * *',
    $$
    select
      net.http(
        url:='https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/sync-hubspot-to-supabase',
        method:='POST',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('request.header.apikey', true) || '"}'::jsonb,
        body:='{"incremental": true}'::jsonb
      ) as request_id;
    $$
);
