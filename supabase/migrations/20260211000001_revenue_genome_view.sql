-- Revenue Genome 7-Day View
-- Connects: facebook_ads_insights → attribution_events → contacts → client_health_scores → stripe
-- This is the "one query" that answers "which exact ad produced healthy, paying clients?"

CREATE OR REPLACE VIEW revenue_genome_7d AS
SELECT
  fai.ad_id,
  fai.ad_name,
  fai.campaign_name,
  SUM(fai.spend) as spend_7d,
  AVG(fai.ctr) as avg_ctr_7d,
  AVG(fai.cpc) as avg_cpc_7d,
  SUM(fai.impressions) as impressions_7d,
  SUM(fai.clicks) as clicks_7d,
  COUNT(DISTINCT ae.user_email) FILTER (WHERE ae.event_name = 'Lead' OR ae.event_name = 'lead_created') as leads_7d,
  COUNT(DISTINCT ae.user_email) FILTER (WHERE ae.event_name = 'assessment_completed') as assessments_7d,
  COUNT(DISTINCT ae.user_email) FILTER (WHERE ae.event_name = 'assessment_ghosted') as ghosts_7d,
  COUNT(DISTINCT ae.user_email) FILTER (WHERE ae.event_name IN ('purchase', 'purchase_completed')) as paid_clients_7d,
  -- Health of clients from this ad
  COALESCE(AVG(hs.overall_score), 0) as avg_health_7d,
  -- Revenue from this ad
  COALESCE(SUM(
    CASE WHEN ae.event_name IN ('purchase', 'purchase_completed') THEN COALESCE(ae.value, 0) ELSE 0 END
  ), 0) as revenue_7d,
  -- Computed metrics
  CASE WHEN SUM(fai.spend) > 0
    THEN COALESCE(SUM(
      CASE WHEN ae.event_name IN ('purchase', 'purchase_completed') THEN COALESCE(ae.value, 0) ELSE 0 END
    ), 0) / SUM(fai.spend)
    ELSE 0
  END as roas_7d,
  -- Show rate: assessments completed / total leads
  CASE WHEN COUNT(DISTINCT ae.user_email) FILTER (WHERE ae.event_name IN ('Lead', 'lead_created')) > 0
    THEN COUNT(DISTINCT ae.user_email) FILTER (WHERE ae.event_name = 'assessment_completed')::float
         / COUNT(DISTINCT ae.user_email) FILTER (WHERE ae.event_name IN ('Lead', 'lead_created')) * 100
    ELSE 0
  END as show_rate_pct,
  -- Ghost rate: ghosted / (ghosted + completed)
  CASE WHEN (COUNT(DISTINCT ae.user_email) FILTER (WHERE ae.event_name = 'assessment_completed')
           + COUNT(DISTINCT ae.user_email) FILTER (WHERE ae.event_name = 'assessment_ghosted')) > 0
    THEN COUNT(DISTINCT ae.user_email) FILTER (WHERE ae.event_name = 'assessment_ghosted')::float
         / (COUNT(DISTINCT ae.user_email) FILTER (WHERE ae.event_name = 'assessment_completed')
          + COUNT(DISTINCT ae.user_email) FILTER (WHERE ae.event_name = 'assessment_ghosted')) * 100
    ELSE 0
  END as ghost_rate_pct,
  -- True CPA: spend / assessments_completed
  CASE WHEN COUNT(DISTINCT ae.user_email) FILTER (WHERE ae.event_name = 'assessment_completed') > 0
    THEN SUM(fai.spend) / COUNT(DISTINCT ae.user_email) FILTER (WHERE ae.event_name = 'assessment_completed')
    ELSE NULL
  END as true_cpa_7d
FROM facebook_ads_insights fai
LEFT JOIN attribution_events ae
  ON ae.fb_ad_id = fai.ad_id
  AND ae.event_time >= NOW() - INTERVAL '7 days'
LEFT JOIN client_health_scores hs
  ON hs.email = ae.user_email
WHERE fai.date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY fai.ad_id, fai.ad_name, fai.campaign_name
HAVING SUM(fai.spend) > 0;

-- Index to speed up the join
CREATE INDEX IF NOT EXISTS idx_attribution_events_fb_ad_id
  ON attribution_events (fb_ad_id)
  WHERE fb_ad_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attribution_events_user_email
  ON attribution_events (user_email)
  WHERE user_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_facebook_ads_insights_date
  ON facebook_ads_insights (date);

COMMENT ON VIEW revenue_genome_7d IS 
  'Revenue Genome: Links ad spend → leads → assessments → payments → health. 7-day rolling window matching PTD sales cycle.';
