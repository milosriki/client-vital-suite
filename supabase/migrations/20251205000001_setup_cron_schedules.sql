-- ============================================
-- CRON SCHEDULING (Replaces n8n)
-- ============================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- SCHEDULED JOBS
-- ============================================

-- Daily 9:00 AM UTC - Calculate health scores
SELECT cron.schedule(
  'daily-health-scoring',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/health-calculator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"mode": "full"}'::jsonb
  );
  $$
);

-- Daily 10:30 AM UTC - Generate interventions
SELECT cron.schedule(
  'daily-interventions',
  '30 10 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/intervention-recommender',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"zones": ["RED", "YELLOW"], "limit": 100}'::jsonb
  );
  $$
);

-- Daily 11:00 AM UTC - Sync to CAPI
SELECT cron.schedule(
  'daily-capi-sync',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-hubspot-to-capi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"mode": "prod"}'::jsonb
  );
  $$
);

-- Every 6 hours - Proactive monitoring
SELECT cron.schedule(
  'watcher-every-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ptd-watcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Daily 6:00 PM UTC - Generate daily report
SELECT cron.schedule(
  'daily-report',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Weekly Monday 8:00 AM - Coach analysis
SELECT cron.schedule(
  'weekly-coach-analysis',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/coach-analyzer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"save_to_db": true}'::jsonb
  );
  $$
);

-- View scheduled jobs
-- SELECT * FROM cron.job;
