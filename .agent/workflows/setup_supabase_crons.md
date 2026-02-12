---
description: Setup and manage Supabase pg_cron scheduled jobs for PTD intelligence agents
---

# Setup Supabase Cron Jobs

This workflow configures the 5 intelligence agents to run automatically via `pg_cron` in Supabase.

## Prerequisites

- Supabase project: `ztjndilxurtsfqdsvfds`
- Service Role Key available in Supabase secrets
- All 5 Edge Functions deployed

## Step 1: Enable pg_cron Extension

Go to **Supabase Dashboard** → **Database** → **Extensions** → search `pg_cron` → Enable it.

Or run this SQL in the SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;
```

## Step 2: Create the Cron Jobs

Run this SQL in the **Supabase SQL Editor** (Dashboard → SQL Editor → New Query):

```sql
-- Health Calculator: Every 6 hours
SELECT cron.schedule(
  'health-calculator',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/health-calculator',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Marketing Historian: Daily at midnight UTC
SELECT cron.schedule(
  'marketing-historian',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/marketing-historian',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"lookback_days": 90}'::jsonb
  );
  $$
);

-- Funnel Stage Tracker: Every 4 hours
SELECT cron.schedule(
  'funnel-stage-tracker',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/funnel-stage-tracker',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"lookback_days": 90}'::jsonb
  );
  $$
);

-- Marketing Loss Analyst: Daily at 6am UTC
SELECT cron.schedule(
  'marketing-loss-analyst',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/marketing-loss-analyst',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"lookback_days": 90}'::jsonb
  );
  $$
);

-- Daily Marketing Brief: Daily at 7am UTC (after all others run)
SELECT cron.schedule(
  'daily-marketing-brief',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/daily-marketing-brief',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- HubSpot Sync: Every 2 hours
SELECT cron.schedule(
  'sync-hubspot',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/sync-hubspot-to-supabase',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"sync_type": "all"}'::jsonb
  );
  $$
);
```

## Step 3: Verify Jobs Are Running

```sql
-- List all scheduled jobs
SELECT * FROM cron.job ORDER BY jobname;

-- Check recent job execution history
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

## Step 4: Manage Jobs

```sql
-- Disable a job temporarily
SELECT cron.unschedule('health-calculator');

-- Re-enable
-- Just re-run the SELECT cron.schedule(...) statement above

-- Delete all jobs
SELECT cron.unschedule(jobname) FROM cron.job;
```

## Schedule Overview

| Job                      | Schedule      | Runs At (UTC) |
| ------------------------ | ------------- | ------------- |
| `sync-hubspot`           | `0 */2 * * *` | Every 2h      |
| `health-calculator`      | `0 */6 * * *` | Every 6h      |
| `funnel-stage-tracker`   | `0 */4 * * *` | Every 4h      |
| `marketing-historian`    | `0 0 * * *`   | Midnight      |
| `marketing-loss-analyst` | `0 6 * * *`   | 6:00 AM       |
| `daily-marketing-brief`  | `0 7 * * *`   | 7:00 AM       |

> **Note**: If `net.http_post` is not available, enable the `pg_net` extension first:
>
> ```sql
> CREATE EXTENSION IF NOT EXISTS pg_net;
> ```
