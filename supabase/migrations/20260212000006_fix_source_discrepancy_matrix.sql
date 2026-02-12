-- Fix source_discrepancy_matrix VIEW
-- Broken refs: date_start→date, action_type/action_value→leads column, events→attribution_events
-- Also add fb_reach, fb_cpl, and setter funnel breakdown

CREATE OR REPLACE VIEW public.source_discrepancy_matrix AS
WITH fb_daily AS (
    SELECT
        date as report_date,
        campaign_name,
        SUM(spend) as fb_spend,
        SUM(impressions) as fb_impressions,
        SUM(clicks) as fb_clicks,
        SUM(reach) as fb_reach,
        SUM(leads) as fb_leads
    FROM public.facebook_ads_insights
    WHERE date >= (CURRENT_DATE - INTERVAL '30 days')
    GROUP BY date, campaign_name
),
anytrack_daily AS (
    SELECT
        event_time::date as report_date,
        COALESCE(campaign, utm_campaign, 'unknown') as campaign_name,
        COUNT(*) FILTER (WHERE event_name IN ('Lead', 'lead_created', 'CompleteRegistration')) as anytrack_leads,
        COUNT(*) FILTER (WHERE event_name IN ('Purchase', 'purchase')) as anytrack_purchases,
        SUM(COALESCE(value, 0)) FILTER (WHERE event_name IN ('Purchase', 'purchase')) as anytrack_revenue
    FROM public.attribution_events
    WHERE event_time >= (CURRENT_DATE - INTERVAL '30 days')
    GROUP BY event_time::date, COALESCE(campaign, utm_campaign, 'unknown')
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
    -- Source counts
    COALESCE(fb.fb_spend, 0) as fb_spend,
    COALESCE(fb.fb_leads, 0) as fb_reported_leads,
    COALESCE(at.anytrack_leads, 0) as anytrack_leads,
    COALESCE(ct.new_contacts, 0) as supabase_contacts,
    COALESCE(at.anytrack_purchases, 0) as anytrack_purchases,
    COALESCE(at.anytrack_revenue, 0) as anytrack_revenue,
    -- CPL from FB (agent intelligence)
    CASE WHEN COALESCE(fb.fb_leads, 0) > 0
         THEN ROUND(COALESCE(fb.fb_spend, 0) / fb.fb_leads, 2)
         ELSE 0
    END as fb_cpl,
    -- Discrepancy calculations
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
    -- Trust verdict
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

-- Setter Funnel View: Lead → Book → Held → Close by appointment setter (hubspot_owner_id)
CREATE OR REPLACE VIEW public.setter_funnel_matrix AS
SELECT
    COALESCE(c.owner_name, c.owner_id, 'Unassigned') as setter_name,
    c.owner_id as setter_id,
    -- Stage counts
    COUNT(*) as total_leads,
    COUNT(*) FILTER (WHERE d.stage IS NOT NULL) as deals_created,
    COUNT(*) FILTER (WHERE d.stage IN ('122237508', '122237276', '122221229', 'qualifiedtobuy', 'closedwon')) as booked,
    COUNT(*) FILTER (WHERE d.stage IN ('122237276', 'qualifiedtobuy', 'closedwon')) as held,
    COUNT(*) FILTER (WHERE d.stage = 'closedwon') as closed_won,
    COUNT(*) FILTER (WHERE d.stage = '1063991961') as closed_lost,
    -- Conversion rates
    CASE WHEN COUNT(*) > 0
         THEN ROUND(COUNT(*) FILTER (WHERE d.stage IS NOT NULL)::numeric / COUNT(*)::numeric * 100, 1)
         ELSE 0 END as lead_to_deal_pct,
    CASE WHEN COUNT(*) FILTER (WHERE d.stage IN ('122237508', '122237276', '122221229', 'qualifiedtobuy', 'closedwon')) > 0
         THEN ROUND(COUNT(*) FILTER (WHERE d.stage IN ('122237276', 'qualifiedtobuy', 'closedwon'))::numeric
              / COUNT(*) FILTER (WHERE d.stage IN ('122237508', '122237276', '122221229', 'qualifiedtobuy', 'closedwon'))::numeric * 100, 1)
         ELSE 0 END as book_to_held_pct,
    CASE WHEN COUNT(*) FILTER (WHERE d.stage IN ('122237276', 'qualifiedtobuy', 'closedwon', '1063991961')) > 0
         THEN ROUND(COUNT(*) FILTER (WHERE d.stage = 'closedwon')::numeric
              / COUNT(*) FILTER (WHERE d.stage IN ('122237276', 'qualifiedtobuy', 'closedwon', '1063991961'))::numeric * 100, 1)
         ELSE 0 END as held_to_close_pct,
    -- Ghost rate (booked but not held)
    CASE WHEN COUNT(*) FILTER (WHERE d.stage IN ('122237508', '122237276', '122221229', 'qualifiedtobuy', 'closedwon')) > 0
         THEN ROUND(
            (COUNT(*) FILTER (WHERE d.stage IN ('122237508', '122237276', '122221229', 'qualifiedtobuy', 'closedwon'))
             - COUNT(*) FILTER (WHERE d.stage IN ('122237276', 'qualifiedtobuy', 'closedwon')))::numeric
            / COUNT(*) FILTER (WHERE d.stage IN ('122237508', '122237276', '122221229', 'qualifiedtobuy', 'closedwon'))::numeric * 100, 1)
         ELSE 0 END as ghost_rate_pct
FROM public.contacts c
LEFT JOIN public.deals d ON d.contact_id = c.id
WHERE c.created_at >= (CURRENT_DATE - INTERVAL '90 days')
GROUP BY COALESCE(c.owner_name, c.owner_id, 'Unassigned'), c.owner_id
ORDER BY total_leads DESC;

COMMENT ON VIEW public.source_discrepancy_matrix IS 'Fixed: FB vs AnyTrack vs Contacts daily comparison with CPL and trust verdict';
COMMENT ON VIEW public.setter_funnel_matrix IS 'Lead→Book→Held→Close funnel by appointment setter (hubspot_owner_id)';
