-- Create reassignment_log table for tracking owner reassignments
CREATE TABLE IF NOT EXISTS public.reassignment_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id TEXT NOT NULL,
    hubspot_contact_id TEXT,
    old_owner_id TEXT,
    new_owner_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    reassigned_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_reassignment_contact ON public.reassignment_log(contact_id);
CREATE INDEX IF NOT EXISTS idx_reassignment_new_owner ON public.reassignment_log(new_owner_id);
CREATE INDEX IF NOT EXISTS idx_reassignment_reason ON public.reassignment_log(reason);
CREATE INDEX IF NOT EXISTS idx_reassignment_date ON public.reassignment_log(reassigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_reassignment_status ON public.reassignment_log(status);

-- Enable RLS
ALTER TABLE public.reassignment_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public read reassignment_log" ON public.reassignment_log FOR SELECT USING (true);
CREATE POLICY "Service role full access reassignment_log" ON public.reassignment_log FOR ALL USING (true);

-- Add comment
COMMENT ON TABLE public.reassignment_log IS 'Tracks all HubSpot contact owner reassignments for audit and analytics';
