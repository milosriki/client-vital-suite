-- ============================================================
-- FIX: Dashboard Schema Compatibility Migration
-- Fixes missing tables, columns, and functions required by frontend
-- ============================================================

-- 1. Create is_admin() function (required by RLS policies)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- For now, allow all authenticated users or service role
    -- In production, implement proper admin check
    RETURN (
        auth.role() = 'service_role' OR
        auth.role() = 'authenticated' OR
        current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create sync_queue table if not exists
CREATE TABLE IF NOT EXISTS public.sync_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_type TEXT NOT NULL,
    payload JSONB,
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_attempt_at TIMESTAMPTZ DEFAULT now(),
    error_message TEXT,
    error_details JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for sync_queue
CREATE INDEX IF NOT EXISTS idx_sync_queue_status_next_attempt 
ON public.sync_queue(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at 
ON public.sync_queue(created_at DESC);

-- Enable RLS on sync_queue
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Public read sync_queue" ON public.sync_queue;
CREATE POLICY "Public read sync_queue" ON public.sync_queue FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role full access sync_queue" ON public.sync_queue;
CREATE POLICY "Service role full access sync_queue" ON public.sync_queue FOR ALL USING (true);

-- 3. Add missing columns to contact_activities
ALTER TABLE public.contact_activities 
ADD COLUMN IF NOT EXISTS activity_description TEXT,
ADD COLUMN IF NOT EXISTS performed_by TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 4. Add performance_score column to coach_performance
ALTER TABLE public.coach_performance 
ADD COLUMN IF NOT EXISTS performance_score NUMERIC;

-- Backfill performance_score from avg_client_health if null
UPDATE public.coach_performance 
SET performance_score = avg_client_health 
WHERE performance_score IS NULL AND avg_client_health IS NOT NULL;

-- 5. Ensure daily_summary has proper RLS
ALTER TABLE public.daily_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read daily_summary" ON public.daily_summary;
CREATE POLICY "Public read daily_summary" ON public.daily_summary FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role full access daily_summary" ON public.daily_summary;
CREATE POLICY "Service role full access daily_summary" ON public.daily_summary FOR ALL USING (true);

-- 6. Ensure all key tables have public read access
DO $$ 
BEGIN
    -- contacts
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'Public read contacts') THEN
        CREATE POLICY "Public read contacts" ON public.contacts FOR SELECT USING (true);
    END IF;
    
    -- client_health_scores
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_health_scores' AND policyname = 'Public read client_health_scores') THEN
        CREATE POLICY "Public read client_health_scores" ON public.client_health_scores FOR SELECT USING (true);
    END IF;
    
    -- deals
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'deals' AND policyname = 'Public read deals') THEN
        CREATE POLICY "Public read deals" ON public.deals FOR SELECT USING (true);
    END IF;
    
    -- intervention_log
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'intervention_log' AND policyname = 'Public read intervention_log') THEN
        CREATE POLICY "Public read intervention_log" ON public.intervention_log FOR SELECT USING (true);
    END IF;
END $$;

-- 7. Add updated_at trigger to sync_queue
DROP TRIGGER IF EXISTS update_sync_queue_updated_at ON public.sync_queue;
CREATE TRIGGER update_sync_queue_updated_at
BEFORE UPDATE ON public.sync_queue
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.sync_queue IS 'Queue for scheduled sync jobs - used by dashboard to show sync status';
