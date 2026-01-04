-- 1. Create a Dynamic Lead Funnel View
-- This view aggregates contacts and deals into a single funnel, sliceable by owner and campaign.
CREATE OR REPLACE VIEW public.dynamic_funnel_view AS
SELECT 
    c.id as contact_id,
    c.email,
    c.first_name,
    c.last_name,
    c.owner_name as owner,
    c.lifecycle_stage,
    c.lead_status,
    c.source as lead_source,
    c.utm_campaign as campaign,
    c.utm_content as ad_content,
    c.created_at,
    CASE 
        WHEN c.lifecycle_stage = 'customer' THEN 'CLOSED_WON'
        WHEN c.lead_status = 'appointment_scheduled' THEN 'OPPORTUNITY'
        WHEN c.lifecycle_stage = 'opportunity' THEN 'OPPORTUNITY'
        WHEN c.lifecycle_stage = 'salesqualifiedlead' THEN 'MQL'
        WHEN c.lifecycle_stage = 'marketingqualifiedlead' THEN 'MQL'
        ELSE 'LEAD'
    END as funnel_stage,
    COALESCE(d.deal_value, 0) as deal_value,
    d.status as deal_status
FROM 
    public.contacts c
LEFT JOIN 
    public.deals d ON c.id = d.contact_id;

-- 2. Create a Deep Payment History Table (to cache Stripe data for faster UI)
CREATE TABLE IF NOT EXISTS public.client_payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    first_purchase_date TIMESTAMPTZ,
    last_three_packages JSONB DEFAULT '[]', -- [{"name": "12 Sessions", "date": "2025-10-01", "amount": 4725}]
    failed_payment_count INTEGER DEFAULT 0,
    failed_payment_log JSONB DEFAULT '[]', -- [{"date": "2025-12-01", "reason": "card_declined"}]
    total_lifetime_value DECIMAL(12, 2) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.client_payment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access client_payment_history" ON public.client_payment_history FOR ALL USING (true);
