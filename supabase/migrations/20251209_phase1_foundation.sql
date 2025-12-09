-- Phase 1: Foundation - Database Setup

-- Task 01: Create Sync Logs Table
CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT NOT NULL, -- 'hubspot', 'stripe', 'system'
    status TEXT NOT NULL, -- 'success', 'error', 'warning'
    message TEXT,
    error_details JSONB,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER
);

-- Task 02: Create Sync Queue Table
CREATE TABLE IF NOT EXISTS public.sync_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_type TEXT NOT NULL, -- 'sync_contacts', 'sync_deals'
    payload JSONB,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    attempts INTEGER DEFAULT 0,
    next_attempt_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Task 03: Create System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by TEXT
);

-- Task 04: Add Performance Indexes
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON public.sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_platform ON public.sync_logs(platform);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON public.sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status_next_attempt ON public.sync_queue(status, next_attempt_at);

-- Task 05: Cleanup Function
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.sync_logs WHERE started_at < now() - INTERVAL '30 days';
    DELETE FROM public.sync_queue WHERE status IN ('completed', 'failed') AND created_at < now() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
