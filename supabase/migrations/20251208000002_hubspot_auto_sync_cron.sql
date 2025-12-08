-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create app settings table for storing configuration (if not exists)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Supabase configuration for cron jobs
INSERT INTO app_settings (key, value)
VALUES
  ('supabase_url', current_setting('app.settings.supabase_url', true)),
  ('service_role_key', current_setting('app.settings.service_role_key', true))
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();

-- Schedule HubSpot deals sync every 15 minutes
SELECT cron.schedule(
  'sync-hubspot-deals',
  '*/15 * * * *',
  $$
  SELECT
    net.http_post(
      url := (SELECT value FROM app_settings WHERE key = 'supabase_url') || '/functions/v1/fetch-hubspot-live',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM app_settings WHERE key = 'service_role_key')
      ),
      body := jsonb_build_object(
        'type', 'deals',
        'sync', true
      )
    );
  $$
);

-- Schedule HubSpot contacts sync every 5 minutes
SELECT cron.schedule(
  'sync-hubspot-contacts',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := (SELECT value FROM app_settings WHERE key = 'supabase_url') || '/functions/v1/fetch-hubspot-live',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM app_settings WHERE key = 'service_role_key')
      ),
      body := jsonb_build_object(
        'type', 'contacts',
        'sync', true,
        'timeframe', 'this_month'
      )
    );
  $$
);

-- Schedule HubSpot owners sync daily at 6 AM
SELECT cron.schedule(
  'sync-hubspot-owners',
  '0 6 * * *',
  $$
  SELECT
    net.http_post(
      url := (SELECT value FROM app_settings WHERE key = 'supabase_url') || '/functions/v1/fetch-hubspot-live',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM app_settings WHERE key = 'service_role_key')
      ),
      body := jsonb_build_object(
        'type', 'owners',
        'sync', true
      )
    );
  $$
);

-- Add comment explaining the cron jobs
COMMENT ON EXTENSION pg_cron IS 'HubSpot Auto-Sync System: Syncs deals every 15min, contacts every 5min, owners daily at 6am';

-- Create function to manually trigger sync
CREATE OR REPLACE FUNCTION trigger_hubspot_sync(sync_type TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT
    net.http_post(
      url := (SELECT value FROM app_settings WHERE key = 'supabase_url') || '/functions/v1/fetch-hubspot-live',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM app_settings WHERE key = 'service_role_key')
      ),
      body := jsonb_build_object(
        'type', sync_type,
        'sync', true
      )
    ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get latest sync status
CREATE OR REPLACE FUNCTION get_latest_sync_status()
RETURNS TABLE(
  sync_type TEXT,
  last_sync_time TIMESTAMPTZ,
  status TEXT,
  records_processed INT,
  records_failed INT,
  duration_ms INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (sl.sync_type)
    sl.sync_type,
    sl.completed_at as last_sync_time,
    sl.status,
    sl.records_processed,
    sl.records_failed,
    sl.duration_ms
  FROM sync_logs sl
  WHERE sl.platform = 'hubspot'
  ORDER BY sl.sync_type, sl.completed_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION trigger_hubspot_sync(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_latest_sync_status() TO authenticated, anon;
