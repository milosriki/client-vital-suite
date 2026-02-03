-- COST OPTIMIZATION MIGRATION (FINAL "SMART SYNC" VERSION)
-- 1. Reduce CallGear Sync to DAILY (Safety Net Only) -> Rely on HubSpot Webhooks for Real-Time.
-- 2. HubSpot Sync is also DAILY (Safety Net).

-- 1. Optimize CallGear Sync (Daily at 2am Dubai)
SELECT cron.unschedule('fetch-callgear-data');
SELECT cron.schedule(
    'fetch-callgear-data',
    '0 22 * * *', -- 22:00 UTC = 02:00 Dubai (Next Day)
    $$
    select
      net.http(
        url:='https://lqmnbntloslpsjbsdoid.supabase.co/functions/v1/fetch-callgear-data',
        method:='POST',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('request.header.apikey', true) || '"}'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
    $$
);

-- 2. Optimize HubSpot Sync (Daily at 3am Dubai)
SELECT cron.unschedule('sync-hubspot-hourly');
SELECT cron.schedule(
    'sync-hubspot-daily-safety',
    '0 23 * * *', -- 23:00 UTC = 03:00 Dubai
    $$
    select
      net.http(
        url:='https://lqmnbntloslpsjbsdoid.supabase.co/functions/v1/sync-hubspot-to-supabase',
        method:='POST',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('request.header.apikey', true) || '"}'::jsonb,
        body:='{"incremental": true}'::jsonb
      ) as request_id;
    $$
);
