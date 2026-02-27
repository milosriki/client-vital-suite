-- Kill split-brain: remove legacy health-calculator cron (every 30min)
-- Keep only: daily-health-score-calculator (daily, health-score-engine v2)
-- Use DO block to handle case where job doesn't exist
DO $$
BEGIN
  PERFORM cron.unschedule('health-calculator');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'health-calculator cron not found, skipping';
END $$;

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
