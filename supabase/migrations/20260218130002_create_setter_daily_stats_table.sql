-- Setter daily performance stats
CREATE TABLE IF NOT EXISTS public.setter_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hubspot_owner_id TEXT,
    owner_name TEXT,
    date DATE NOT NULL,
    total_calls INTEGER DEFAULT 0,
    answered_calls INTEGER DEFAULT 0,
    missed_calls INTEGER DEFAULT 0,
    avg_duration NUMERIC(8,2) DEFAULT 0,
    total_talk_time INTEGER DEFAULT 0,
    lost_lead_count INTEGER DEFAULT 0,
    appointments_set INTEGER DEFAULT 0,
    conversion_rate NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(hubspot_owner_id, date)
);

CREATE INDEX IF NOT EXISTS idx_setter_stats_date ON public.setter_daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_setter_stats_owner ON public.setter_daily_stats(hubspot_owner_id);

ALTER TABLE public.setter_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read setter_daily_stats" ON public.setter_daily_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow service role all setter_daily_stats" ON public.setter_daily_stats FOR ALL TO service_role USING (true);
