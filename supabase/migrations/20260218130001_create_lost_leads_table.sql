-- Lost leads table for tracking uncontacted missed calls
CREATE TABLE IF NOT EXISTS public.lost_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES public.contacts(id),
    caller_number TEXT NOT NULL,
    missed_call_count INTEGER DEFAULT 1,
    last_missed_at TIMESTAMPTZ,
    lead_score NUMERIC(5,2) DEFAULT 0,
    lifecycle_stage TEXT,
    assigned_owner TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lost_leads_caller ON public.lost_leads(caller_number);
CREATE INDEX IF NOT EXISTS idx_lost_leads_status ON public.lost_leads(status);
CREATE INDEX IF NOT EXISTS idx_lost_leads_score ON public.lost_leads(lead_score DESC);

ALTER TABLE public.lost_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read lost_leads" ON public.lost_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow service role all lost_leads" ON public.lost_leads FOR ALL TO service_role USING (true);
