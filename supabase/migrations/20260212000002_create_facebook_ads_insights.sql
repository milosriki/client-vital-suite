-- Create facebook_ads_insights table
-- This table is written by fetch-facebook-insights and read by 10+ functions
-- Previously existed only in Supabase (created via dashboard/SQL editor) but had no migration

CREATE TABLE IF NOT EXISTS public.facebook_ads_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    ad_id TEXT NOT NULL,
    ad_name TEXT,
    campaign_id TEXT,
    campaign_name TEXT,
    adset_id TEXT,
    adset_name TEXT,
    spend NUMERIC(12,2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ctr NUMERIC(8,4) DEFAULT 0,
    cpc NUMERIC(10,2) DEFAULT 0,
    cpm NUMERIC(10,2),
    reach INTEGER,
    leads INTEGER DEFAULT 0,
    roas NUMERIC(10,4) DEFAULT 0,
    purchase_value NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(date, ad_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_fb_insights_date ON public.facebook_ads_insights(date);
CREATE INDEX IF NOT EXISTS idx_fb_insights_campaign ON public.facebook_ads_insights(campaign_id);
CREATE INDEX IF NOT EXISTS idx_fb_insights_ad ON public.facebook_ads_insights(ad_id);

COMMENT ON TABLE public.facebook_ads_insights IS 'Daily Facebook/Meta ad performance metrics synced from Pipeboard MCP';
