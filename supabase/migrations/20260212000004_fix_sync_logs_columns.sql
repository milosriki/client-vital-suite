-- Add missing columns to sync_logs that edge functions expect
-- Functions write sync_type and records_processed but these columns were never added

ALTER TABLE public.sync_logs
ADD COLUMN IF NOT EXISTS sync_type TEXT,
ADD COLUMN IF NOT EXISTS records_processed INTEGER DEFAULT 0;
