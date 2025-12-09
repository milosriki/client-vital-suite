-- ============================================
-- AGENT ORCHESTRATION CRON SCHEDULES
-- Tasks 11, 12, 13: Automated agent execution
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- UNSCHEDULE EXISTING JOBS (for idempotency)
-- ============================================

-- Remove any existing schedules with these names
SELECT cron.unschedule('agent-business-intelligence');
SELECT cron.unschedule('agent-generate-lead-reply');
SELECT cron.unschedule('agent-sync-hubspot-to-supabase');

-- ============================================
-- TASK 11: Business Intelligence Agent
-- Analyzes business metrics and generates insights
-- Schedule: Daily at 7:00 AM UTC
-- ============================================

SELECT cron.schedule(
  'agent-business-intelligence',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/business-intelligence',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- TASK 12: Generate Lead Reply Agent
-- Automatically generates personalized replies to new leads
-- Schedule: Every 2 hours
-- ============================================

SELECT cron.schedule(
  'agent-generate-lead-reply',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/generate-lead-reply',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- TASK 13: Sync HubSpot to Supabase
-- Synchronizes contact and deal data from HubSpot
-- Schedule: Every hour
-- ============================================

SELECT cron.schedule(
  'agent-sync-hubspot-to-supabase',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/sync-hubspot-to-supabase',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- VIEW SCHEDULED JOBS
-- ============================================

-- To view all scheduled jobs, run:
-- SELECT jobid, jobname, schedule, command FROM cron.job;

-- To manually unschedule a job, run:
-- SELECT cron.unschedule('job-name-here');
