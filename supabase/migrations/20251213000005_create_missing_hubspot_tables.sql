-- ============================================================
-- CRITICAL FIX: Create missing HubSpot tables referenced in code
-- ============================================================

-- 1. HUBSPOT_DEALS TABLE (Referenced by business-intelligence function)
-- This table stores synced deals from HubSpot
CREATE TABLE IF NOT EXISTS public.hubspot_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hubspot_deal_id TEXT UNIQUE NOT NULL,
    deal_name TEXT,
    amount DECIMAL(12,2),
    currency TEXT DEFAULT 'AED',
    dealstage TEXT,
    pipeline TEXT,
    closedate TIMESTAMPTZ,
    createdate TIMESTAMPTZ,
    closed_lost_reason TEXT,
    deal_type TEXT,
    hubspot_owner_id TEXT,
    owner_name TEXT,
    associated_contact_id TEXT,
    associated_company_id TEXT,
    properties JSONB DEFAULT '{}'::jsonb,
    raw_data JSONB DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hubspot_deals_hubspot_id ON public.hubspot_deals(hubspot_deal_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_deals_stage ON public.hubspot_deals(dealstage);
CREATE INDEX IF NOT EXISTS idx_hubspot_deals_createdate ON public.hubspot_deals(createdate DESC);
CREATE INDEX IF NOT EXISTS idx_hubspot_deals_closedate ON public.hubspot_deals(closedate DESC);
CREATE INDEX IF NOT EXISTS idx_hubspot_deals_owner ON public.hubspot_deals(hubspot_owner_id);

-- Enable RLS
ALTER TABLE public.hubspot_deals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role full access hubspot_deals" 
ON public.hubspot_deals FOR ALL USING (true);

CREATE POLICY "Public read hubspot_deals" 
ON public.hubspot_deals FOR SELECT USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_hubspot_deals_updated_at
BEFORE UPDATE ON public.hubspot_deals
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 2. Verify existing HubSpot tables exist (from migration 20251209005251)
-- These should already exist, but verify:
-- - hubspot_login_activity
-- - hubspot_security_activity
-- - hubspot_contact_changes
-- - hubspot_user_daily_summary

-- 3. Add missing columns to existing tables if needed

-- Add missing columns to contacts table for HubSpot sync
DO $$ 
BEGIN
    -- Add hubspot_team column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'contacts' 
        AND column_name = 'hubspot_team'
    ) THEN
        ALTER TABLE public.contacts ADD COLUMN hubspot_team TEXT;
        CREATE INDEX IF NOT EXISTS idx_contacts_hubspot_team ON public.contacts(hubspot_team);
    END IF;
END $$;

-- 4. Create sync_logs table if missing (should exist from 20251209_phase1_foundation.sql)
CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT NOT NULL, -- 'hubspot', 'stripe', 'system'
    status TEXT NOT NULL, -- 'success', 'error', 'warning', 'completed'
    message TEXT,
    error_details JSONB,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON public.sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_platform ON public.sync_logs(platform);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON public.sync_logs(started_at DESC);

-- Enable RLS
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access sync_logs" 
ON public.sync_logs FOR ALL USING (true);

CREATE POLICY "Public read sync_logs" 
ON public.sync_logs FOR SELECT USING (true);

-- 5. Create sync_errors table if missing
CREATE TABLE IF NOT EXISTS public.sync_errors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT NOT NULL,
    error_type TEXT NOT NULL,
    error_message TEXT,
    error_details JSONB,
    record_id TEXT,
    record_type TEXT,
    severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_errors_platform ON public.sync_errors(platform);
CREATE INDEX IF NOT EXISTS idx_sync_errors_severity ON public.sync_errors(severity);
CREATE INDEX IF NOT EXISTS idx_sync_errors_resolved ON public.sync_errors(resolved);
CREATE INDEX IF NOT EXISTS idx_sync_errors_created_at ON public.sync_errors(created_at DESC);

-- Enable RLS
ALTER TABLE public.sync_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access sync_errors" 
ON public.sync_errors FOR ALL USING (true);

CREATE POLICY "Public read sync_errors" 
ON public.sync_errors FOR SELECT USING (true);

-- 6. Create sync_queue table if missing
CREATE TABLE IF NOT EXISTS public.sync_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_type TEXT NOT NULL, -- 'sync_contacts', 'sync_deals', 'sync_companies'
    payload JSONB,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_attempt_at TIMESTAMPTZ DEFAULT now(),
    error_message TEXT,
    error_details JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status_next_attempt 
ON public.sync_queue(status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_sync_queue_job_type 
ON public.sync_queue(job_type);

-- Enable RLS
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access sync_queue" 
ON public.sync_queue FOR ALL USING (true);

CREATE POLICY "Public read sync_queue" 
ON public.sync_queue FOR SELECT USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_sync_queue_updated_at
BEFORE UPDATE ON public.sync_queue
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 7. Comments for documentation
COMMENT ON TABLE public.hubspot_deals IS 'Synced deals from HubSpot CRM';
COMMENT ON TABLE public.sync_logs IS 'Logs for all sync operations (HubSpot, Stripe, etc.)';
COMMENT ON TABLE public.sync_errors IS 'Errors encountered during sync operations';
COMMENT ON TABLE public.sync_queue IS 'Queue for scheduled sync jobs';
