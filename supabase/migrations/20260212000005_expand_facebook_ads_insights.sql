-- Expand facebook_ads_insights with ALL Meta Ads API fields
-- Enables agent super-intelligence: full metrics for AI analysis & recommendations
-- ============================================================

-- === Core metrics currently missing ===
ALTER TABLE public.facebook_ads_insights
  ADD COLUMN IF NOT EXISTS frequency NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS unique_clicks INTEGER,
  ADD COLUMN IF NOT EXISTS unique_ctr NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS cost_per_unique_click NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS inline_link_clicks INTEGER,
  ADD COLUMN IF NOT EXISTS cost_per_inline_link_click NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS outbound_clicks INTEGER;

-- === Full action/conversion data (JSONB for all action types) ===
ALTER TABLE public.facebook_ads_insights
  ADD COLUMN IF NOT EXISTS actions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS action_values JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cost_per_action_type JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS conversions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_per_conversion NUMERIC(10,2);

-- === Video metrics (critical for creative analysis) ===
ALTER TABLE public.facebook_ads_insights
  ADD COLUMN IF NOT EXISTS video_p25_watched INTEGER,
  ADD COLUMN IF NOT EXISTS video_p50_watched INTEGER,
  ADD COLUMN IF NOT EXISTS video_p75_watched INTEGER,
  ADD COLUMN IF NOT EXISTS video_p100_watched INTEGER,
  ADD COLUMN IF NOT EXISTS video_avg_time_watched NUMERIC(10,2);

-- === Meta quality signals (agent recommendations) ===
ALTER TABLE public.facebook_ads_insights
  ADD COLUMN IF NOT EXISTS quality_ranking TEXT,
  ADD COLUMN IF NOT EXISTS engagement_rate_ranking TEXT,
  ADD COLUMN IF NOT EXISTS conversion_rate_ranking TEXT;

-- === Additional spend & engagement ===
ALTER TABLE public.facebook_ads_insights
  ADD COLUMN IF NOT EXISTS social_spend NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS website_ctr NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS objective TEXT;

-- === Composite index for agent queries ===
CREATE INDEX IF NOT EXISTS idx_fb_insights_campaign_date
  ON public.facebook_ads_insights(campaign_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fb_insights_quality
  ON public.facebook_ads_insights(quality_ranking)
  WHERE quality_ranking IS NOT NULL;

COMMENT ON COLUMN public.facebook_ads_insights.actions IS 'All Meta action types as JSONB array: [{action_type, value}]';
COMMENT ON COLUMN public.facebook_ads_insights.action_values IS 'Revenue/value per action type: [{action_type, value}]';
COMMENT ON COLUMN public.facebook_ads_insights.quality_ranking IS 'Meta ad quality ranking: ABOVE_AVERAGE_35, AVERAGE, BELOW_AVERAGE_10, etc.';
COMMENT ON COLUMN public.facebook_ads_insights.engagement_rate_ranking IS 'Meta engagement ranking vs competitors';
COMMENT ON COLUMN public.facebook_ads_insights.conversion_rate_ranking IS 'Meta conversion ranking vs competitors';
