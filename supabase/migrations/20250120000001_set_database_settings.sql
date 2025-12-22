-- ============================================
-- Database-Level Settings for pg_cron
-- ============================================
-- 
-- IMPORTANT: This must be run in Supabase Dashboard SQL Editor
-- with superuser permissions (not via regular migrations)
--
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================

-- Confirm database name
SELECT current_database() as db_name;

-- Set Supabase URL (non-sensitive, safe to persist)
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://ztjndilxurtsfqdsvfds.supabase.co';

-- Set pg_cron secret (generate new one with: openssl rand -hex 32)
-- Replace <PASTE_LONG_RANDOM_SECRET> with your generated secret
ALTER DATABASE postgres SET app.cron_secret = '152bd25836768729ac62122db53ad38c0d7b1d68621e8d86b4133f0521872117';

-- Verify settings (open a NEW SQL editor tab after running above, or reconnect)
SELECT
  current_setting('app.settings.supabase_url', true) as supabase_url,
  CASE 
    WHEN current_setting('app.cron_secret', true) IS NOT NULL 
    THEN 'SET (hidden for security)'
    ELSE 'NOT SET'
  END as cron_secret_status;

