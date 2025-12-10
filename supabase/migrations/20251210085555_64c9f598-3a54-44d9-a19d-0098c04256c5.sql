-- Task 01: Sync Logs Table
CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT NOT NULL, -- 'hubspot', 'stripe', 'anytrack', 'system'
    status TEXT NOT NULL, -- 'success', 'error', 'warning'
    message TEXT,
    error_details JSONB,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER
);

-- Task 02: Sync Queue Table
CREATE TABLE IF NOT EXISTS public.sync_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_type TEXT NOT NULL, -- 'sync_contacts', 'sync_deals', 'sync_events'
    payload JSONB,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    attempts INTEGER DEFAULT 0,
    next_attempt_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Task 03: System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by TEXT
);

-- Task 04: Performance Indexes
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON public.sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON public.sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_platform ON public.sync_logs(platform);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status_next ON public.sync_queue(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_sync_queue_job_type ON public.sync_queue(job_type);

-- Task 05: Auto-Cleanup Function
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.sync_logs WHERE started_at < now() - INTERVAL '30 days';
    DELETE FROM public.sync_queue WHERE status IN ('completed', 'failed') AND created_at < now() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable RLS
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin full access sync_logs" ON public.sync_logs FOR ALL USING (is_admin());
CREATE POLICY "Public read sync_logs" ON public.sync_logs FOR SELECT USING (true);

CREATE POLICY "Admin full access sync_queue" ON public.sync_queue FOR ALL USING (is_admin());
CREATE POLICY "Public read sync_queue" ON public.sync_queue FOR SELECT USING (true);

CREATE POLICY "Admin full access system_settings" ON public.system_settings FOR ALL USING (is_admin());
CREATE POLICY "Public read system_settings" ON public.system_settings FOR SELECT USING (true);

-- Seed initial settings
INSERT INTO public.system_settings (key, value, updated_by) VALUES
('last_hubspot_sync', '{"timestamp": null, "status": "never"}', 'system'),
('last_anytrack_sync', '{"timestamp": null, "status": "never"}', 'system'),
('feature_flags', '{"ai_replies": true, "auto_sync": true, "leak_detector": true}', 'system')
ON CONFLICT (key) DO NOTHING;