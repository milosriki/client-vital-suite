-- Phase 2: Daily Business Intelligence
-- Create table for daily snapshots of key business metrics

CREATE TABLE IF NOT EXISTS public.daily_business_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    
    -- Lead Metrics (Top of Funnel)
    total_leads_new INTEGER DEFAULT 0,
    total_leads_active INTEGER DEFAULT 0,
    leads_from_ads INTEGER DEFAULT 0,
    leads_from_referrals INTEGER DEFAULT 0,
    
    -- Sales Activity (Middle of Funnel)
    total_calls_made INTEGER DEFAULT 0,
    total_appointments_set INTEGER DEFAULT 0,
    total_appointments_held INTEGER DEFAULT 0,
    
    -- Revenue & Deals (Bottom of Funnel)
    total_revenue_booked DECIMAL(12, 2) DEFAULT 0,
    total_cash_collected DECIMAL(12, 2) DEFAULT 0,
    total_deals_closed INTEGER DEFAULT 0,
    avg_deal_value DECIMAL(12, 2) DEFAULT 0,
    
    -- Marketing Performance
    ad_spend_facebook DECIMAL(12, 2) DEFAULT 0,
    ad_impressions INTEGER DEFAULT 0,
    ad_clicks INTEGER DEFAULT 0,
    
    -- Calculated KPIs (Computed on insert/update if possible, or stored)
    roas_daily DECIMAL(10, 2) DEFAULT 0, -- Revenue / Spend
    conversion_rate_daily DECIMAL(5, 2) DEFAULT 0, -- Closed / New Leads
    cost_per_lead DECIMAL(10, 2) DEFAULT 0, -- Spend / New Leads
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.daily_business_metrics ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read daily_business_metrics" ON public.daily_business_metrics FOR SELECT USING (true);
CREATE POLICY "Service role full access daily_business_metrics" ON public.daily_business_metrics FOR ALL USING (true);

-- Index for fast date lookups
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON public.daily_business_metrics(date);
