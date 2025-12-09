-- Add pg_cron schedule for HubSpot data sync
-- Runs every 15 minutes to sync contacts, deals, and appointments from HubSpot

DO $$
BEGIN
  -- Remove existing schedule if it exists
  PERFORM cron.unschedule('hubspot-data-sync');
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'cron.unschedule not available, skipping';
  WHEN OTHERS THEN
    RAISE NOTICE 'Error unscheduling: %', SQLERRM;
END $$;

-- Schedule HubSpot sync every 15 minutes
SELECT cron.schedule(
  'hubspot-data-sync',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT
    net.http_post(
      url := (SELECT 'https://' || current_setting('app.settings.supabase_url') || '/functions/v1/sync-hubspot-data'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
      ),
      body := jsonb_build_object('trigger', 'cron')
    );
  $$
);

COMMENT ON EXTENSION cron IS 'HubSpot data sync runs every 15 minutes via pg_cron';
