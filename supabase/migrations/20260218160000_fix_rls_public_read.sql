-- Add public (anon) read policies to all analytics tables for dashboard access

DO $$ 
DECLARE
  t text;
  pname text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'funnel_metrics', 'historical_baselines', 'setter_daily_stats',
    'lost_leads', 'intervention_log', 'knowledge_base', 'loss_analysis',
    'client_payment_history', 'agent_knowledge', 'ai_execution_metrics',
    'daily_marketing_briefs'
  ])
  LOOP
    pname := 'anon_read_' || t;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = pname
    ) THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (true)', pname, t);
    END IF;
  END LOOP;
END $$;
