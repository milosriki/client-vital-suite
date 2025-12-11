-- Delete resolved errors older than 30 days (runs daily at 2 AM UTC)
SELECT cron.schedule(
  'cleanup-old-errors',
  '0 2 * * *',
  $$
  DELETE FROM sync_errors 
  WHERE resolved_at IS NOT NULL 
    AND resolved_at < NOW() - INTERVAL '30 days'
  $$
);
