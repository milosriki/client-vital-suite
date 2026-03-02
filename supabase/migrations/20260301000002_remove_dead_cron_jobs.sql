-- Remove cron jobs targeting non-existent edge functions
-- ptd-agent-claude was scheduled in 20251210202842 but no matching function exists
-- ptd-self-learn was scheduled in 20251219000000 but no matching function exists

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ptd-agent-claude') THEN
    PERFORM cron.unschedule('ptd-agent-claude');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ptd-self-learn') THEN
    PERFORM cron.unschedule('ptd-self-learn');
  END IF;
END;
$$;
