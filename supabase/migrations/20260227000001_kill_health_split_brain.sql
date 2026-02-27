-- Kill split-brain: remove legacy health-calculator cron (every 30min)
-- Keep only: daily-health-score-calculator (daily, health-score-engine v2)
SELECT cron.unschedule('health-calculator');

-- Verify only one health scorer remains
DO $$
DECLARE
  job_count INT;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname IN ('daily-health-score-calculator', 'health-calculator');
  
  RAISE NOTICE 'Remaining health cron jobs: %', job_count;
END $$;
