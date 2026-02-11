-- Create attribution_events table
-- This table is written by anytrack-webhook, hubspot-anytrack-webhook, calendly-webhook
-- and read by funnel-stage-tracker, marketing-loss-analyst, marketing-stress-test, and 7+ others
-- Previously existed only in Supabase (created via dashboard/SQL editor) but had no migration

CREATE TABLE IF NOT EXISTS public.attribution_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id TEXT UNIQUE,
    event_name TEXT,
    event_time TIMESTAMPTZ,
    email TEXT,
    phone TEXT,
    first_name TEXT,
    last_name TEXT,
    external_id TEXT,
    value NUMERIC(12,2),
    currency TEXT DEFAULT 'AED',
    transaction_id TEXT,
    order_id TEXT,
    items JSONB,
    source TEXT,
    medium TEXT,
    campaign TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    platform TEXT,
    source_attribution JSONB,
    status TEXT,
    fb_ad_id TEXT,
    fb_campaign_id TEXT,
    fb_adset_id TEXT,
    fb_campaign_name TEXT,
    fb_ad_name TEXT,
    fb_adset_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_attribution_email ON public.attribution_events(email);
CREATE INDEX IF NOT EXISTS idx_attribution_event_time ON public.attribution_events(event_time);
CREATE INDEX IF NOT EXISTS idx_attribution_fb_ad ON public.attribution_events(fb_ad_id);
CREATE INDEX IF NOT EXISTS idx_attribution_campaign ON public.attribution_events(campaign);

COMMENT ON TABLE public.attribution_events IS 'Cross-platform attribution events from AnyTrack, Calendly, and HubSpot webhooks';
