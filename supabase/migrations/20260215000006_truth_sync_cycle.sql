-- 15-minute refresh cycle for materialized truth genome

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
    'refresh-revenue-genome',
    '*/15 * * * *',
    $$ SELECT public.refresh_revenue_genome() $$
);

-- On-demand refresh (callable from edge functions after webhooks)
CREATE OR REPLACE FUNCTION public.trigger_immediate_truth_sync()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_stat_activity
        WHERE query ILIKE '%refresh materialized view%'
          AND state = 'active'
    ) THEN
        PERFORM public.refresh_revenue_genome();
    END IF;
END;
$$;
