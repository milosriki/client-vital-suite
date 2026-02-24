-- ============================================
-- Missing Views: assessment_truth_matrix + daily_marketing_briefs
-- GPS Cron: Pull locations every 6 hours for 30-day data retention
-- Data Retention: Clean GPS events older than 90 days
-- ============================================

-- 1. Assessment Truth Matrix
-- Purpose: Show assessment → client conversion funnel with health scores
CREATE OR REPLACE VIEW assessment_truth_matrix AS
SELECT
  c.hubspot_contact_id,
  c.email,
  c.first_name,
  c.last_name,
  c.lifecycle_stage,
  c.owner_name AS setter_name,
  c.assigned_coach AS coach_name,
  c.created_at AS contact_created,
  -- Health scores
  hs.overall_score AS health_score,
  hs.zone AS health_zone,
  hs.engagement_score,
  hs.financial_score,
  hs.session_score,
  -- Deal outcome
  d.deal_stage,
  d.amount AS deal_amount,
  d.close_date,
  d.pipeline_name,
  -- Assessment status
  CASE
    WHEN d.deal_stage = 'closedwon' THEN 'converted'
    WHEN d.deal_stage = 'closedlost' THEN 'lost'
    WHEN d.deal_stage IS NOT NULL THEN 'in_pipeline'
    ELSE 'no_deal'
  END AS conversion_status,
  -- Time to convert
  CASE
    WHEN d.close_date IS NOT NULL THEN
      EXTRACT(DAY FROM (d.close_date::timestamp - c.created_at))
    ELSE NULL
  END AS days_to_close
FROM contacts c
LEFT JOIN client_health_scores hs ON hs.client_email = c.email
LEFT JOIN LATERAL (
  SELECT deal_stage, amount, close_date, pipeline_name
  FROM deals
  WHERE deals.contact_id = c.hubspot_contact_id
  ORDER BY close_date DESC NULLS LAST
  LIMIT 1
) d ON true
WHERE c.lifecycle_stage IS NOT NULL;

GRANT SELECT ON assessment_truth_matrix TO authenticated;
GRANT SELECT ON assessment_truth_matrix TO service_role;

-- 2. Daily Marketing Briefs (CEO Morning Brief)
-- Purpose: Aggregate daily marketing + sales performance
CREATE OR REPLACE VIEW daily_marketing_briefs AS
SELECT
  fai.date AS report_date,
  -- Ad Performance
  COUNT(DISTINCT fai.campaign_id) AS active_campaigns,
  SUM(fai.spend) AS total_spend_aed,
  SUM(fai.impressions) AS total_impressions,
  SUM(fai.clicks) AS total_clicks,
  CASE WHEN SUM(fai.impressions) > 0
    THEN ROUND((SUM(fai.clicks)::numeric / SUM(fai.impressions)) * 100, 2)
    ELSE 0
  END AS ctr_pct,
  CASE WHEN SUM(fai.clicks) > 0
    THEN ROUND(SUM(fai.spend) / SUM(fai.clicks), 2)
    ELSE 0
  END AS cpc_aed,
  SUM(fai.conversions) AS total_conversions,
  CASE WHEN SUM(fai.conversions) > 0
    THEN ROUND(SUM(fai.spend) / SUM(fai.conversions), 2)
    ELSE 0
  END AS cpa_aed,
  -- Lead Generation (from contacts created that day)
  (SELECT COUNT(*) FROM contacts c
   WHERE c.created_at::date = fai.date) AS new_leads,
  -- Deals Created
  (SELECT COUNT(*) FROM deals d
   WHERE d.created_at::date = fai.date) AS new_deals,
  -- Deals Won
  (SELECT COUNT(*) FROM deals d
   WHERE d.close_date::date = fai.date AND d.deal_stage = 'closedwon') AS deals_won,
  (SELECT COALESCE(SUM(d.amount), 0) FROM deals d
   WHERE d.close_date::date = fai.date AND d.deal_stage = 'closedwon') AS revenue_won_aed,
  -- ROAS
  CASE WHEN SUM(fai.spend) > 0
    THEN ROUND(
      (SELECT COALESCE(SUM(d.amount), 0) FROM deals d
       WHERE d.close_date::date = fai.date AND d.deal_stage = 'closedwon')
      / SUM(fai.spend), 2)
    ELSE 0
  END AS daily_roas
FROM facebook_ads_insights fai
WHERE fai.date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY fai.date
ORDER BY fai.date DESC;

GRANT SELECT ON daily_marketing_briefs TO authenticated;
GRANT SELECT ON daily_marketing_briefs TO service_role;

-- 3. GPS Pull Cron (every 6 hours — accumulates 30+ days)
SELECT cron.schedule(
  'gps-pull-every-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/tinymdm-pull-locations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 4. GPS Data Retention (clean >90 day events, keep 30-day analysis window)
SELECT cron.schedule(
  'gps-cleanup-90d',
  '0 3 * * 0',
  $$
  DELETE FROM mdm_location_events WHERE recorded_at < NOW() - INTERVAL '90 days';
  $$
);

-- 5. Coach GPS Patterns Table (for predictions)
CREATE TABLE IF NOT EXISTS coach_gps_patterns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_name text NOT NULL,
  analysis_date date NOT NULL DEFAULT CURRENT_DATE,
  total_sessions int DEFAULT 0,
  gps_verified int DEFAULT 0,
  gps_mismatch int DEFAULT 0,
  no_gps int DEFAULT 0,
  avg_arrival_offset_min numeric DEFAULT 0,
  avg_dwell_vs_scheduled_min numeric DEFAULT 0,
  ghost_session_count int DEFAULT 0,
  late_arrival_count int DEFAULT 0,
  early_departure_count int DEFAULT 0,
  verification_rate numeric DEFAULT 0,
  pattern_score numeric DEFAULT 0,
  risk_level text DEFAULT 'normal',
  anomalies jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  UNIQUE(coach_name, analysis_date)
);

-- RLS for coach_gps_patterns
ALTER TABLE coach_gps_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on coach_gps_patterns" ON coach_gps_patterns;
CREATE POLICY "Service role full access on coach_gps_patterns" ON coach_gps_patterns
  FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated read coach_gps_patterns" ON coach_gps_patterns;
CREATE POLICY "Authenticated read coach_gps_patterns" ON coach_gps_patterns
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_coach_gps_patterns_coach ON coach_gps_patterns(coach_name);
CREATE INDEX IF NOT EXISTS idx_coach_gps_patterns_date ON coach_gps_patterns(analysis_date);
