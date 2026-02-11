-- Deploy Antigravity Views, Indexes and RLS
-- Part 2 of Deep Intelligence Tables

-- 4. Assessment Truth Matrix (VIEW)
CREATE OR REPLACE VIEW public.assessment_truth_matrix AS
SELECT
    c.email,
    c.first_name,
    c.last_name,
    c.owner_name as coach,
    d.stage as hubspot_deal_stage,
    CASE
        WHEN d.stage = '122237508' THEN 'Assessment Booked'
        WHEN d.stage = '122237276' THEN 'Assessment Completed'
        WHEN d.stage = '122221229' THEN 'Booking Process'
        WHEN d.stage = 'qualifiedtobuy' THEN 'Qualified to Buy'
        WHEN d.stage = 'closedwon' THEN 'Closed Won'
        WHEN d.stage = '1063991961' THEN 'Closed Lost'
        WHEN d.stage = '1064059180' THEN 'On Hold'
        ELSE d.stage
    END as hubspot_stage_name,
    CASE WHEN d.stage = '122237276' THEN true ELSE false END as hubspot_says_completed,
    CASE WHEN atc.email IS NOT NULL THEN true ELSE false END as aws_confirms_attended,
    CASE
        WHEN d.stage = '122237276' AND atc.email IS NOT NULL THEN 'CONFIRMED_ATTENDED'
        WHEN d.stage = '122237276' AND atc.email IS NULL THEN 'HUBSPOT_ONLY_NO_AWS_PROOF'
        WHEN d.stage = '122237508' AND atc.email IS NOT NULL THEN 'ATTENDED_BUT_HUBSPOT_NOT_UPDATED'
        WHEN d.stage = '122237508' AND atc.email IS NULL THEN 'BOOKED_NOT_ATTENDED'
        WHEN d.stage IN ('closedwon', '1063991961') THEN 'PAST_ASSESSMENT_STAGE'
        ELSE 'UNKNOWN'
    END as truth_status,
    ae.fb_ad_id,
    ae.campaign,
    ae.source as attribution_source,
    c.created_at as lead_created_at,
    d.created_at as deal_created_at,
    d.updated_at as stage_updated_at,
    chs.health_score,
    chs.health_zone
FROM public.contacts c
JOIN public.deals d ON d.hubspot_contact_id = c.hubspot_contact_id
LEFT JOIN public.aws_truth_cache atc ON atc.email = c.email
LEFT JOIN public.client_health_scores chs ON chs.email = c.email
LEFT JOIN LATERAL (
    SELECT fb_ad_id, campaign, source
    FROM public.attribution_events
    WHERE email = c.email
    ORDER BY event_time DESC
    LIMIT 1
) ae ON true;

-- 5. Source Discrepancy Matrix (VIEW)
CREATE OR REPLACE VIEW public.source_discrepancy_matrix AS
WITH fb_daily AS (
    SELECT
        date_start::date as report_date,
        campaign_name,
        SUM(spend::numeric) as fb_spend,
        SUM(impressions::numeric) as fb_impressions,
        SUM(clicks::numeric) as fb_clicks,
        SUM(CASE WHEN action_type = 'lead' THEN action_value::numeric ELSE 0 END) as fb_leads
    FROM public.facebook_ads_insights
    WHERE date_start >= (CURRENT_DATE - INTERVAL '30 days')
    GROUP BY date_start::date, campaign_name
),
anytrack_daily AS (
    SELECT
        event_time::date as report_date,
        COALESCE(custom->>'campaign', 'unknown') as campaign_name,
        COUNT(*) FILTER (WHERE event_name IN ('Lead', 'lead_created')) as anytrack_leads,
        COUNT(*) FILTER (WHERE event_name = 'Purchase') as anytrack_purchases,
        SUM(COALESCE((custom->>'value')::numeric, 0)) FILTER (WHERE event_name = 'Purchase') as anytrack_revenue
    FROM public.events
    WHERE source IN ('anytrack', 'hubspot_anytrack')
      AND event_time >= (CURRENT_DATE - INTERVAL '30 days')
    GROUP BY event_time::date, COALESCE(custom->>'campaign', 'unknown')
),
contacts_daily AS (
    SELECT
        created_at::date as report_date,
        COALESCE(utm_campaign, 'unknown') as campaign_name,
        COUNT(*) as new_contacts
    FROM public.contacts
    WHERE created_at >= (CURRENT_DATE - INTERVAL '30 days')
    GROUP BY created_at::date, COALESCE(utm_campaign, 'unknown')
)
SELECT
    COALESCE(fb.report_date, at.report_date, ct.report_date) as report_date,
    COALESCE(fb.campaign_name, at.campaign_name, ct.campaign_name) as campaign_name,
    COALESCE(fb.fb_spend, 0) as fb_spend,
    COALESCE(fb.fb_leads, 0) as fb_reported_leads,
    COALESCE(at.anytrack_leads, 0) as anytrack_leads,
    COALESCE(ct.new_contacts, 0) as supabase_contacts,
    COALESCE(at.anytrack_purchases, 0) as anytrack_purchases,
    COALESCE(at.anytrack_revenue, 0) as anytrack_revenue,
    ABS(COALESCE(fb.fb_leads, 0) - COALESCE(at.anytrack_leads, 0)) as lead_gap_fb_vs_anytrack,
    ABS(COALESCE(fb.fb_leads, 0) - COALESCE(ct.new_contacts, 0)) as lead_gap_fb_vs_contacts,
    CASE
        WHEN GREATEST(COALESCE(fb.fb_leads, 0), COALESCE(at.anytrack_leads, 0), COALESCE(ct.new_contacts, 0)) = 0 THEN 0
        ELSE ROUND(
            (GREATEST(COALESCE(fb.fb_leads, 0), COALESCE(at.anytrack_leads, 0), COALESCE(ct.new_contacts, 0))
            - LEAST(COALESCE(fb.fb_leads, 0), COALESCE(at.anytrack_leads, 0), COALESCE(ct.new_contacts, 0)))::numeric
            / GREATEST(COALESCE(fb.fb_leads, 0), COALESCE(at.anytrack_leads, 0), COALESCE(ct.new_contacts, 0))
            * 100, 1)
    END as max_discrepancy_pct,
    CASE
        WHEN GREATEST(COALESCE(fb.fb_leads, 0), COALESCE(at.anytrack_leads, 0), COALESCE(ct.new_contacts, 0)) = 0 THEN 'NO_DATA'
        WHEN (GREATEST(COALESCE(fb.fb_leads, 0), COALESCE(at.anytrack_leads, 0), COALESCE(ct.new_contacts, 0))
            - LEAST(COALESCE(fb.fb_leads, 0), COALESCE(at.anytrack_leads, 0), COALESCE(ct.new_contacts, 0)))::numeric
            / GREATEST(COALESCE(fb.fb_leads, 0), COALESCE(at.anytrack_leads, 0), COALESCE(ct.new_contacts, 0)) < 0.10
        THEN 'ALIGNED'
        WHEN (GREATEST(COALESCE(fb.fb_leads, 0), COALESCE(at.anytrack_leads, 0), COALESCE(ct.new_contacts, 0))
            - LEAST(COALESCE(fb.fb_leads, 0), COALESCE(at.anytrack_leads, 0), COALESCE(ct.new_contacts, 0)))::numeric
            / GREATEST(COALESCE(fb.fb_leads, 0), COALESCE(at.anytrack_leads, 0), COALESCE(ct.new_contacts, 0)) < 0.25
        THEN 'DRIFTING'
        ELSE 'BROKEN'
    END as trust_verdict
FROM fb_daily fb
FULL OUTER JOIN anytrack_daily at
    ON fb.report_date = at.report_date AND fb.campaign_name = at.campaign_name
FULL OUTER JOIN contacts_daily ct
    ON COALESCE(fb.report_date, at.report_date) = ct.report_date
    AND COALESCE(fb.campaign_name, at.campaign_name) = ct.campaign_name;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_historical_baselines_dimension
    ON public.historical_baselines(dimension_type, dimension_value);
CREATE INDEX IF NOT EXISTS idx_historical_baselines_period
    ON public.historical_baselines(period_days);
CREATE INDEX IF NOT EXISTS idx_loss_analysis_email
    ON public.loss_analysis(contact_email);
CREATE INDEX IF NOT EXISTS idx_loss_analysis_reason
    ON public.loss_analysis(primary_loss_reason);
CREATE INDEX IF NOT EXISTS idx_loss_analysis_coach
    ON public.loss_analysis(coach_name);
CREATE INDEX IF NOT EXISTS idx_funnel_metrics_date
    ON public.funnel_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_funnel_metrics_dimension
    ON public.funnel_metrics(dimension_type, dimension_value);

-- RLS
ALTER TABLE public.historical_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loss_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_historical_baselines" ON public.historical_baselines;
CREATE POLICY "authenticated_read_historical_baselines"
    ON public.historical_baselines FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_all_historical_baselines" ON public.historical_baselines;
CREATE POLICY "service_role_all_historical_baselines"
    ON public.historical_baselines FOR ALL
    TO service_role USING (true);

DROP POLICY IF EXISTS "authenticated_read_loss_analysis" ON public.loss_analysis;
CREATE POLICY "authenticated_read_loss_analysis"
    ON public.loss_analysis FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_all_loss_analysis" ON public.loss_analysis;
CREATE POLICY "service_role_all_loss_analysis"
    ON public.loss_analysis FOR ALL
    TO service_role USING (true);

DROP POLICY IF EXISTS "authenticated_read_funnel_metrics" ON public.funnel_metrics;
CREATE POLICY "authenticated_read_funnel_metrics"
    ON public.funnel_metrics FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_all_funnel_metrics" ON public.funnel_metrics;
CREATE POLICY "service_role_all_funnel_metrics"
    ON public.funnel_metrics FOR ALL
    TO service_role USING (true);
