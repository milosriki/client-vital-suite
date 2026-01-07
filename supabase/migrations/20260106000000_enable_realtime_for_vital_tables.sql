-- Enable Realtime for critical tables used in useVitalState.ts
-- This fixes the "UI disconnected" issue by allowing the frontend to subscribe to changes

BEGIN;

  -- Add tables to the supabase_realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE client_health_scores;
  ALTER PUBLICATION supabase_realtime ADD TABLE deals;
  ALTER PUBLICATION supabase_realtime ADD TABLE intervention_log;
  ALTER PUBLICATION supabase_realtime ADD TABLE sync_logs;
  ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
  ALTER PUBLICATION supabase_realtime ADD TABLE call_records;
  ALTER PUBLICATION supabase_realtime ADD TABLE daily_summary;

COMMIT;
