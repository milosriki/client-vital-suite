-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a keep-alive job that pings the agent every 5 minutes
-- ⚠️ SECURITY: Uses anon key from database settings (not hardcoded)
SELECT cron.schedule(
  'keep-agent-alive',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/ptd-agent-claude',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key', true)
    ),
    body := '{"message": "ping"}'::jsonb
  );
  $$
);