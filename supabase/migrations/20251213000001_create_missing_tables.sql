-- ============================================================
-- CRITICAL FIX: Create all missing tables referenced in code
-- This migration creates 10+ tables that are referenced but never created
-- ============================================================

-- 1. LEADS TABLE (Referenced by 13+ Edge Functions)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    phone TEXT,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT GENERATED ALWAYS AS (COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) STORED,
    company TEXT,
    source TEXT,
    status TEXT DEFAULT 'new',
    lead_score INTEGER DEFAULT 0,
    hubspot_id TEXT UNIQUE,
    hubspot_owner_id TEXT,
    lifecycle_stage TEXT DEFAULT 'lead',
    last_contacted_at TIMESTAMPTZ,
    ai_suggested_reply TEXT,
    ai_reply_generated_at TIMESTAMPTZ,
    notes TEXT,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_hubspot_id ON public.leads(hubspot_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);

-- 2. CLIENT_HEALTH_SCORES TABLE (Referenced by 53+ functions)
-- Note: health_scores exists but code references client_health_scores
CREATE TABLE IF NOT EXISTS public.client_health_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    client_name TEXT,
    health_score INTEGER DEFAULT 50 CHECK (health_score >= 0 AND health_score <= 100),
    risk_level TEXT DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    engagement_score INTEGER DEFAULT 50,
    payment_score INTEGER DEFAULT 50,
    activity_score INTEGER DEFAULT 50,
    churn_probability DECIMAL(5,4) DEFAULT 0.0,
    last_activity_at TIMESTAMPTZ,
    last_payment_at TIMESTAMPTZ,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    days_since_last_contact INTEGER,
    open_tickets INTEGER DEFAULT 0,
    factors JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    hubspot_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_health_email ON public.client_health_scores(email);
CREATE INDEX IF NOT EXISTS idx_client_health_score ON public.client_health_scores(health_score);
CREATE INDEX IF NOT EXISTS idx_client_health_risk ON public.client_health_scores(risk_level);

-- 3. CONTACTS TABLE (Referenced by foreign keys)
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    phone TEXT,
    first_name TEXT,
    last_name TEXT,
    company TEXT,
    job_title TEXT,
    hubspot_id TEXT UNIQUE,
    hubspot_owner_id TEXT,
    lifecycle_stage TEXT,
    lead_status TEXT,
    last_contacted_at TIMESTAMPTZ,
    source TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_hubspot_id ON public.contacts(hubspot_id);

-- 4. DEALS TABLE (Referenced by RLS policies)
CREATE TABLE IF NOT EXISTS public.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_name TEXT NOT NULL,
    amount DECIMAL(12,2),
    currency TEXT DEFAULT 'AED',
    stage TEXT DEFAULT 'qualification',
    pipeline TEXT DEFAULT 'default',
    close_date DATE,
    probability INTEGER DEFAULT 0,
    contact_id UUID REFERENCES public.contacts(id),
    hubspot_id TEXT UNIQUE,
    hubspot_owner_id TEXT,
    source TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_hubspot_id ON public.deals(hubspot_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON public.deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON public.deals(contact_id);

-- 5. ENHANCED_LEADS TABLE (Referenced by policies)
CREATE TABLE IF NOT EXISTS public.enhanced_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id),
    enrichment_source TEXT,
    enrichment_data JSONB DEFAULT '{}',
    ai_analysis JSONB DEFAULT '{}',
    quality_score INTEGER DEFAULT 0,
    verified_email BOOLEAN DEFAULT FALSE,
    verified_phone BOOLEAN DEFAULT FALSE,
    social_profiles JSONB DEFAULT '{}',
    company_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. APPOINTMENTS TABLE (Referenced by policies)
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
    contact_id UUID REFERENCES public.contacts(id),
    deal_id UUID REFERENCES public.deals(id),
    assigned_to TEXT,
    location TEXT,
    meeting_url TEXT,
    hubspot_id TEXT UNIQUE,
    notes TEXT,
    outcome TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_start ON public.appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);

-- 7. CALL_RECORDS TABLE (Referenced by policies)
CREATE TABLE IF NOT EXISTS public.call_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id TEXT UNIQUE,
    direction TEXT CHECK (direction IN ('inbound', 'outbound')),
    status TEXT DEFAULT 'completed',
    duration INTEGER DEFAULT 0,
    caller_number TEXT,
    called_number TEXT,
    agent_name TEXT,
    agent_id TEXT,
    contact_id UUID REFERENCES public.contacts(id),
    recording_url TEXT,
    transcription TEXT,
    sentiment TEXT,
    summary TEXT,
    outcome TEXT,
    callgear_id TEXT,
    hubspot_engagement_id TEXT,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_records_agent ON public.call_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_records_contact ON public.call_records(contact_id);
CREATE INDEX IF NOT EXISTS idx_call_records_started ON public.call_records(started_at);

-- 8. STAFF TABLE (Referenced by policies)
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'agent' CHECK (role IN ('admin', 'manager', 'supervisor', 'agent')),
    department TEXT,
    team TEXT,
    hubspot_owner_id TEXT,
    callgear_employee_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    permissions JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_email ON public.staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_role ON public.staff(role);

-- 9. KPI_TRACKING TABLE (Referenced by policies)
CREATE TABLE IF NOT EXISTS public.kpi_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(12,4),
    metric_type TEXT CHECK (metric_type IN ('count', 'currency', 'percentage', 'duration', 'score')),
    dimension TEXT,
    dimension_value TEXT,
    target_value DECIMAL(12,4),
    variance DECIMAL(12,4),
    staff_id UUID REFERENCES public.staff(id),
    team TEXT,
    department TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, metric_name, dimension, dimension_value)
);

CREATE INDEX IF NOT EXISTS idx_kpi_date ON public.kpi_tracking(date);
CREATE INDEX IF NOT EXISTS idx_kpi_metric ON public.kpi_tracking(metric_name);

-- 10. BUSINESS_FORECASTS TABLE (Referenced by policies)
CREATE TABLE IF NOT EXISTS public.business_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forecast_date DATE NOT NULL,
    forecast_type TEXT NOT NULL CHECK (forecast_type IN ('revenue', 'deals', 'leads', 'churn', 'growth')),
    period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly')),
    predicted_value DECIMAL(12,2),
    confidence_level DECIMAL(5,4),
    lower_bound DECIMAL(12,2),
    upper_bound DECIMAL(12,2),
    actual_value DECIMAL(12,2),
    variance DECIMAL(12,2),
    model_version TEXT,
    factors JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(forecast_date, forecast_type, period)
);

CREATE INDEX IF NOT EXISTS idx_forecasts_date ON public.business_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_forecasts_type ON public.business_forecasts(forecast_type);

-- ============================================================
-- Enable RLS on all new tables
-- ============================================================
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enhanced_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_forecasts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Create permissive policies (service_role always has access)
-- ============================================================
CREATE POLICY "Service role full access leads" ON public.leads FOR ALL USING (true);
CREATE POLICY "Service role full access client_health_scores" ON public.client_health_scores FOR ALL USING (true);
CREATE POLICY "Service role full access contacts" ON public.contacts FOR ALL USING (true);
CREATE POLICY "Service role full access deals" ON public.deals FOR ALL USING (true);
CREATE POLICY "Service role full access enhanced_leads" ON public.enhanced_leads FOR ALL USING (true);
CREATE POLICY "Service role full access appointments" ON public.appointments FOR ALL USING (true);
CREATE POLICY "Service role full access call_records" ON public.call_records FOR ALL USING (true);
CREATE POLICY "Service role full access staff" ON public.staff FOR ALL USING (true);
CREATE POLICY "Service role full access kpi_tracking" ON public.kpi_tracking FOR ALL USING (true);
CREATE POLICY "Service role full access business_forecasts" ON public.business_forecasts FOR ALL USING (true);

-- ============================================================
-- Create updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['leads', 'client_health_scores', 'contacts', 'deals', 'enhanced_leads', 'appointments', 'staff', 'business_forecasts'])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I;
            CREATE TRIGGER update_%I_updated_at
                BEFORE UPDATE ON public.%I
                FOR EACH ROW
                EXECUTE FUNCTION public.update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END $$;

-- ============================================================
-- Add comments for documentation
-- ============================================================
COMMENT ON TABLE public.leads IS 'Sales leads from various sources';
COMMENT ON TABLE public.client_health_scores IS 'Client health and churn risk scores';
COMMENT ON TABLE public.contacts IS 'CRM contacts synced from HubSpot';
COMMENT ON TABLE public.deals IS 'Sales deals/opportunities';
COMMENT ON TABLE public.enhanced_leads IS 'AI-enriched lead data';
COMMENT ON TABLE public.appointments IS 'Scheduled meetings and calls';
COMMENT ON TABLE public.call_records IS 'Call history from CallGear';
COMMENT ON TABLE public.staff IS 'Internal team members';
COMMENT ON TABLE public.kpi_tracking IS 'Daily KPI metrics';
COMMENT ON TABLE public.business_forecasts IS 'AI-generated business forecasts';
