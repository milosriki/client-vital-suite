-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a keep-alive job that pings the agent every 5 minutes
SELECT cron.schedule(
  'keep-agent-alive',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/ptd-agent-claude',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo"}'::jsonb,
    body := '{"message": "ping"}'::jsonb
  );
  $$
);