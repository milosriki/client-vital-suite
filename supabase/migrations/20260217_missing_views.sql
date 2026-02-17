-- assessment_truth_matrix: contacts + health scores + deals for Deep Intel Zone 7
CREATE OR REPLACE VIEW public.assessment_truth_matrix AS
SELECT 
  c.id as contact_id,
  c.email,
  c.first_name,
  c.last_name,
  c.lifecycle_stage,
  c.lead_status,
  c.assigned_coach,
  chs.health_score,
  chs.sessions_last_7d,
  chs.sessions_last_30d,
  chs.sessions_last_90d,
  chs.sessions_purchased,
  chs.outstanding_sessions,
  d.id as deal_id,
  d.deal_name,
  d.stage as deal_stage,
  d.amount as deal_amount,
  d.close_date,
  CASE 
    WHEN chs.health_score >= 80 THEN 'healthy'
    WHEN chs.health_score >= 50 THEN 'at_risk'
    WHEN chs.health_score IS NOT NULL THEN 'critical'
    ELSE 'unknown'
  END as health_category,
  CASE
    WHEN d.stage IN ('closedwon', 'closed_won') AND chs.health_score >= 80 THEN 'converted_healthy'
    WHEN d.stage IN ('closedwon', 'closed_won') AND chs.health_score < 50 THEN 'converted_struggling'
    WHEN d.stage IN ('closedlost', 'closed_lost') THEN 'lost'
    WHEN d.stage IS NOT NULL THEN 'in_pipeline'
    ELSE 'no_deal'
  END as truth_category
FROM contacts c
LEFT JOIN client_health_scores chs ON c.email = chs.email
LEFT JOIN deals d ON c.hubspot_contact_id = d.contact_id
ORDER BY c.created_at DESC;

-- daily_marketing_briefs: aggregated daily marketing metrics for CEO Morning Brief (Zone 8)
CREATE OR REPLACE VIEW public.daily_marketing_briefs AS
SELECT 
  fai.date::date as brief_date,
  COUNT(DISTINCT fai.campaign_id) as active_campaigns,
  SUM(fai.spend) as total_spend,
  SUM(fai.impressions) as total_impressions,
  SUM(fai.clicks) as total_clicks,
  SUM(fai.leads) as total_leads,
  CASE WHEN SUM(fai.clicks) > 0 
    THEN ROUND((SUM(fai.leads)::numeric / SUM(fai.clicks)::numeric) * 100, 2) 
    ELSE 0 
  END as click_to_lead_rate,
  CASE WHEN SUM(fai.impressions) > 0 
    THEN ROUND((SUM(fai.clicks)::numeric / SUM(fai.impressions)::numeric) * 100, 2) 
    ELSE 0 
  END as ctr,
  CASE WHEN SUM(fai.leads) > 0 
    THEN ROUND(SUM(fai.spend)::numeric / SUM(fai.leads)::numeric, 2) 
    ELSE 0 
  END as cost_per_lead,
  (SELECT COUNT(*) FROM deals WHERE created_at::date = fai.date::date) as deals_created,
  (SELECT COUNT(*) FROM deals WHERE close_date::date = fai.date::date AND stage IN ('closedwon', 'closed_won')) as deals_won
FROM facebook_ads_insights fai
GROUP BY fai.date::date
ORDER BY brief_date DESC;
