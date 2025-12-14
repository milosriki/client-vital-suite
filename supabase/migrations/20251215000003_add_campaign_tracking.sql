-- Add Facebook campaign tracking columns to attribution_events table
ALTER TABLE public.attribution_events 
ADD COLUMN IF NOT EXISTS fb_campaign_id TEXT,
ADD COLUMN IF NOT EXISTS fb_ad_id TEXT,
ADD COLUMN IF NOT EXISTS fb_adset_id TEXT,
ADD COLUMN IF NOT EXISTS fb_campaign_name TEXT,
ADD COLUMN IF NOT EXISTS fb_ad_name TEXT,
ADD COLUMN IF NOT EXISTS fb_adset_name TEXT;

-- Add indexes for campaign queries
CREATE INDEX IF NOT EXISTS idx_attribution_events_fb_campaign ON public.attribution_events(fb_campaign_id);
CREATE INDEX IF NOT EXISTS idx_attribution_events_fb_ad ON public.attribution_events(fb_ad_id);
CREATE INDEX IF NOT EXISTS idx_attribution_events_campaign ON public.attribution_events(campaign);

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.campaign_performance;

-- Create campaign performance view
CREATE VIEW public.campaign_performance AS
SELECT 
  COALESCE(fb_campaign_id, campaign) as campaign_id,
  COALESCE(fb_campaign_name, campaign) as campaign_name,
  source,
  medium,
  COUNT(*) as total_events,
  COUNT(DISTINCT email) as unique_leads,
  SUM(value) as total_value,
  AVG(value) as avg_value,
  MIN(event_time) as first_event,
  MAX(event_time) as last_event,
  COUNT(CASE WHEN event_name = 'Purchase' THEN 1 END) as purchases,
  COUNT(CASE WHEN event_name = 'Lead' THEN 1 END) as leads,
  COUNT(CASE WHEN event_name = 'InitiateCheckout' THEN 1 END) as checkouts
FROM public.attribution_events
WHERE platform IN ('anytrack', 'hubspot_anytrack', 'facebook')
GROUP BY COALESCE(fb_campaign_id, campaign), COALESCE(fb_campaign_name, campaign), source, medium;

COMMENT ON VIEW public.campaign_performance IS 'Campaign performance metrics aggregated from attribution events';
