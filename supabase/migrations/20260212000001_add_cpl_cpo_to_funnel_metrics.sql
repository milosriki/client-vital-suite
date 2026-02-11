-- Add CPL/CPO columns to funnel_metrics table
-- These are computed by funnel-stage-tracker from facebook_ads_insights spend data
ALTER TABLE public.funnel_metrics
ADD COLUMN IF NOT EXISTS cpl NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS cpo NUMERIC(10,2);

COMMENT ON COLUMN public.funnel_metrics.cpl IS 'Cost Per Lead = total ad spend / leads created (overall dimension only)';
COMMENT ON COLUMN public.funnel_metrics.cpo IS 'Cost Per Opportunity = total ad spend / deals created (overall dimension only)';
