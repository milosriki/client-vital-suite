
CREATE TABLE IF NOT EXISTS public.capi_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_name TEXT NOT NULL,
    event_id TEXT,
    event_time TIMESTAMPTZ DEFAULT now(),
    user_email TEXT,
    user_phone TEXT,
    value_aed NUMERIC,
    currency TEXT DEFAULT 'AED',
    status TEXT DEFAULT 'pending', -- pending, sent, failed
    fbp TEXT,
    fbc TEXT,
    payload JSONB, -- Full payload sent to FB
    response JSONB, -- Full response from FB
    error_message TEXT,
    mode TEXT DEFAULT 'live', -- test or live
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.capi_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view/insert (customize as needed)
CREATE POLICY "Enable read/write for authenticated users" ON public.capi_events
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Enable full access for service role" ON public.capi_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
