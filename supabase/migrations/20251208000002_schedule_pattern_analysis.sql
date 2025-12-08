-- ============================================
-- SCHEDULE CALL PATTERN ANALYSIS
-- Runs daily at 8:00 AM UTC (before health scoring)
-- ============================================

-- Daily 8:00 AM UTC - Analyze call patterns
SELECT cron.schedule(
  'daily-pattern-analysis',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/analyze-call-patterns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"limit": 200}'::jsonb
  );
  $$
);

-- Add comment
COMMENT ON EXTENSION pg_cron IS 'Job scheduler with call pattern analysis running daily at 8:00 AM UTC';
