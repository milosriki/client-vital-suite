-- ============================================================================
-- MULTI-SOURCE DATA RECONCILIATION — 7-SOURCE VIEW
-- Brainstorming-validated: no single source trusted alone
-- Sources: HubSpot + Deals + AnyTrack + CallGear + ConvIntel + AWS + Health Scores
-- Implements Source-of-Truth Hierarchy (NON-NEGOTIABLE):
--   Revenue: Stripe > AWS > Deals (Stripe currently unjoinable — cus_ IDs)
--   Coach:   AWS > HubSpot > client_health_scores
--   Sessions: AWS > HubSpot > client_health_scores
--   Attribution: HubSpot first_touch > AnyTrack > CallGear tracking
--   Lead Quality: Composite (AI 40% + calls 30% + analytics 15% + lifecycle 15%)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. view_contact_360 — Multi-source reconciliation per contact
--    Joins 7 sources with conflict detection and composite scoring
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.view_contact_360;

CREATE VIEW public.view_contact_360 AS
WITH deal_summary AS (
    SELECT
        contact_id,
        COUNT(*) AS deal_count,
        SUM(deal_value) AS total_deal_revenue_aed,
        SUM(CASE WHEN stage = 'closedwon' THEN deal_value ELSE 0 END) AS closedwon_revenue_aed,
        MAX(stage) AS latest_stage,
        MAX(close_date) AS latest_close_date
    FROM public.deals
    WHERE contact_id IS NOT NULL
    GROUP BY contact_id
),
aws_truth AS (
    -- Coach + Session Ground Truth: AWS (operational system)
    -- aws_truth_cache.email joins to contacts.email
    SELECT DISTINCT ON (lower(email))
        lower(email) AS email_lower,
        coach_name AS aws_coach,
        outstanding_sessions AS aws_outstanding_sessions,
        total_sessions_attended AS aws_sessions_attended,
        total_sessions_cancelled AS aws_sessions_cancelled,
        last_session_date AS aws_last_session,
        lifetime_revenue AS aws_lifetime_revenue
    FROM public.aws_truth_cache
    WHERE email IS NOT NULL
    ORDER BY lower(email), updated_at DESC NULLS LAST
),
health_scores AS (
    -- Client health + churn + engagement (fallback for coach/sessions)
    SELECT DISTINCT ON (lower(email))
        lower(email) AS email_lower,
        health_score,
        churn_risk_score,
        engagement_score,
        momentum_score,
        financial_score,
        relationship_score,
        health_zone,
        risk_category,
        early_warning_flag,
        assigned_coach AS hs_coach,
        sessions_last_7d AS hs_sessions_7d,
        sessions_last_30d AS hs_sessions_30d,
        sessions_last_90d AS hs_sessions_90d,
        outstanding_sessions AS hs_outstanding,
        package_type AS hs_package_type,
        package_value_aed
    FROM public.client_health_scores
    WHERE email IS NOT NULL
    ORDER BY lower(email), calculated_on DESC NULLS LAST
),
attribution_by_email AS (
    -- Best-effort FB attribution via email
    SELECT DISTINCT ON (lower(email))
        lower(email) AS email_lower,
        fb_ad_id,
        fb_campaign_id,
        fb_adset_id,
        source AS attr_source,
        landing_page,
        utm_source AS attr_utm_source,
        utm_medium AS attr_utm_medium,
        utm_campaign AS attr_utm_campaign
    FROM public.attribution_events
    WHERE email IS NOT NULL
    ORDER BY lower(email), event_time DESC
),
attribution_by_phone AS (
    -- Fallback: FB attribution via phone
    SELECT DISTINCT ON (phone)
        phone,
        fb_ad_id,
        fb_campaign_id,
        fb_adset_id,
        source AS attr_source,
        utm_source AS attr_utm_source,
        utm_campaign AS attr_utm_campaign
    FROM public.attribution_events
    WHERE phone IS NOT NULL
    ORDER BY phone, event_time DESC
),
call_stats AS (
    -- Call intelligence with ms->seconds fix
    SELECT
        caller_number,
        COUNT(*) AS total_calls,
        SUM(ROUND(duration_seconds / 1000.0)) AS total_talk_seconds,
        MAX(started_at) AS last_call_at,
        ROUND(AVG(call_score)::numeric, 1) AS avg_call_score,
        ROUND(AVG(sentiment_score)::numeric, 2) AS avg_sentiment
    FROM public.call_records
    GROUP BY caller_number
)
SELECT
    c.id AS contact_id,
    c.hubspot_contact_id,
    c.email,
    c.phone,
    c.first_name,
    c.last_name,

    -- HUBSPOT CRM DATA
    c.lifecycle_stage,
    c.lead_status,
    c.first_touch_source,
    c.analytics_score,
    c.num_associated_deals,

    -- VERIFIED REVENUE (Hierarchy: AWS > Deals; Stripe unjoinable currently)
    COALESCE(aws.aws_lifetime_revenue, 0) AS aws_revenue_aed,
    COALESCE(ds.closedwon_revenue_aed, 0) AS deal_revenue_aed,
    COALESCE(
        NULLIF(aws.aws_lifetime_revenue, 0),
        ds.closedwon_revenue_aed,
        0
    ) AS verified_revenue_aed,
    -- Revenue mismatch flag: AWS vs deals differ by >500 AED
    CASE
        WHEN COALESCE(aws.aws_lifetime_revenue, 0) > 0
         AND COALESCE(ds.closedwon_revenue_aed, 0) > 0
         AND ABS(aws.aws_lifetime_revenue - ds.closedwon_revenue_aed) > 500
        THEN true
        ELSE false
    END AS revenue_mismatch_flag,

    -- VERIFIED COACH (Hierarchy: AWS > HubSpot > client_health_scores)
    aws.aws_coach,
    c.assigned_coach AS hubspot_coach,
    hs.hs_coach AS health_scores_coach,
    COALESCE(aws.aws_coach, c.assigned_coach, hs.hs_coach) AS verified_coach,
    -- Coach mismatch flag
    CASE
        WHEN aws.aws_coach IS NOT NULL
         AND c.assigned_coach IS NOT NULL
         AND lower(aws.aws_coach) != lower(c.assigned_coach)
        THEN true
        ELSE false
    END AS coach_mismatch_flag,

    -- VERIFIED SESSIONS (Hierarchy: AWS > HubSpot > client_health_scores)
    aws.aws_sessions_attended,
    aws.aws_sessions_cancelled,
    aws.aws_outstanding_sessions,
    aws.aws_last_session,
    COALESCE(aws.aws_outstanding_sessions, c.outstanding_sessions, hs.hs_outstanding) AS verified_outstanding_sessions,
    COALESCE(c.sessions_last_7d, hs.hs_sessions_7d) AS sessions_last_7d,
    COALESCE(c.sessions_last_30d, hs.hs_sessions_30d) AS sessions_last_30d,
    COALESCE(c.sessions_last_90d, hs.hs_sessions_90d) AS sessions_last_90d,
    c.sessions_purchased,

    -- DEAL PIPELINE
    COALESCE(ds.deal_count, 0) AS deal_count,
    ds.latest_stage AS deal_latest_stage,

    -- ATTRIBUTION (Hierarchy: HubSpot > AnyTrack email > AnyTrack phone)
    COALESCE(c.attributed_ad_id, ab_email.fb_ad_id, ab_phone.fb_ad_id) AS best_ad_id,
    COALESCE(c.attributed_campaign_id, ab_email.fb_campaign_id, ab_phone.fb_campaign_id) AS best_campaign_id,
    COALESCE(c.attribution_source, c.first_touch_source, ab_email.attr_source, ab_phone.attr_source) AS best_channel,
    COALESCE(c.utm_campaign, ab_email.attr_utm_campaign, ab_phone.attr_utm_campaign) AS best_utm_campaign,
    COALESCE(c.utm_source, ab_email.attr_utm_source, ab_phone.attr_utm_source) AS best_utm_source,
    -- Attribution confidence level
    CASE
        WHEN c.attributed_ad_id IS NOT NULL THEN 'HIGH'
        WHEN c.first_touch_source IS NOT NULL AND c.utm_source IS NOT NULL THEN 'MEDIUM'
        WHEN c.first_touch_source IS NOT NULL THEN 'LOW'
        WHEN ab_email.fb_ad_id IS NOT NULL OR ab_phone.fb_ad_id IS NOT NULL THEN 'INFERRED'
        ELSE 'NONE'
    END AS attribution_confidence,

    -- CALL INTELLIGENCE
    COALESCE(cs.total_calls, 0) AS total_calls,
    COALESCE(cs.total_talk_seconds, 0) AS total_talk_seconds,
    cs.avg_call_score,
    cs.avg_sentiment,

    -- CONVERSATION AI
    ci.lead_score AS ai_lead_score,
    ci.lead_temperature AS ai_temperature,
    ci.conversation_phase AS ai_phase,

    -- CLIENT HEALTH
    hs.health_score,
    hs.churn_risk_score,
    hs.engagement_score,
    hs.momentum_score,
    hs.health_zone,
    hs.risk_category,
    hs.early_warning_flag,
    hs.package_value_aed,

    -- COMPOSITE LEAD SCORE
    -- Weighted: AI 40% + Calls 30% + Analytics 15% + Lifecycle 15%
    ROUND((
        COALESCE(ci.lead_score, 0) * 0.40 +
        LEAST(COALESCE(cs.avg_call_score, 0) * 10, 100) * 0.30 +
        LEAST(COALESCE(c.analytics_score, 0), 100) * 0.15 +
        CASE c.lifecycle_stage
            WHEN 'customer' THEN 100
            WHEN 'opportunity' THEN 80
            WHEN 'salesqualifiedlead' THEN 60
            WHEN 'marketingqualifiedlead' THEN 40
            WHEN 'lead' THEN 20
            ELSE 0
        END * 0.15
    )::numeric, 1) AS composite_lead_score,

    -- VERIFIED VERDICT
    CASE
        WHEN COALESCE(ds.closedwon_revenue_aed, 0) > 0
          THEN 'DEAL WINNER'
        WHEN COALESCE(aws.aws_lifetime_revenue, 0) > 0
          THEN 'AWS VERIFIED'
        WHEN COALESCE(ci.lead_score, 0) > 80 OR COALESCE(cs.avg_call_score, 0) > 7
          THEN 'HIGH INTENT'
        WHEN EXISTS (
            SELECT 1 FROM public.deals d
            WHERE d.contact_id = c.id
              AND d.stage NOT IN ('closedwon', 'closedlost')
              AND d.stage IS NOT NULL
        ) THEN 'ACTIVE PIPELINE'
        WHEN COALESCE(cs.total_calls, 0) > 0 OR c.lifecycle_stage IN ('lead', 'marketingqualifiedlead')
          THEN 'PROSPECTING'
        ELSE 'COLD'
    END AS verified_verdict,

    -- DATA COMPLETENESS (12 signals)
    (
        CASE WHEN c.email IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN c.phone IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN c.lifecycle_stage IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN c.first_touch_source IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN COALESCE(ds.deal_count, 0) > 0 THEN 1 ELSE 0 END +
        CASE WHEN COALESCE(cs.total_calls, 0) > 0 THEN 1 ELSE 0 END +
        CASE WHEN ci.lead_score IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN aws.aws_coach IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN hs.health_score IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN c.attributed_ad_id IS NOT NULL OR ab_email.fb_ad_id IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN c.analytics_score IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN c.assigned_coach IS NOT NULL THEN 1 ELSE 0 END
    ) AS data_completeness_score

FROM public.contacts c
LEFT JOIN deal_summary ds ON ds.contact_id = c.id
LEFT JOIN aws_truth aws ON aws.email_lower = lower(c.email)
LEFT JOIN health_scores hs ON hs.email_lower = lower(c.email)
LEFT JOIN attribution_by_email ab_email ON ab_email.email_lower = lower(c.email)
LEFT JOIN attribution_by_phone ab_phone ON ab_phone.phone = c.phone AND ab_email.fb_ad_id IS NULL
LEFT JOIN call_stats cs ON cs.caller_number = c.phone
LEFT JOIN public.conversation_intelligence ci ON ci.phone = c.phone;

GRANT SELECT ON public.view_contact_360 TO authenticated;
GRANT SELECT ON public.view_contact_360 TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. view_marketing_attribution — Campaign-level channel -> revenue with ROAS
--    Currency: AED throughout
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.view_marketing_attribution;

CREATE VIEW public.view_marketing_attribution AS
WITH channel_contacts AS (
    SELECT
        CASE
            WHEN c.first_touch_source IS NOT NULL THEN c.first_touch_source
            WHEN EXISTS (
                SELECT 1 FROM public.call_records cr
                WHERE cr.caller_number = c.phone AND c.phone IS NOT NULL
            ) THEN 'PHONE_INQUIRY'
            ELSE 'UNKNOWN'
        END AS channel,
        c.utm_campaign,
        c.lifecycle_stage,
        c.id AS contact_id
    FROM public.contacts c
),
channel_revenue AS (
    SELECT
        cc.channel,
        cc.utm_campaign,
        COUNT(DISTINCT cc.contact_id) AS total_contacts,
        COUNT(DISTINCT cc.contact_id) FILTER (WHERE cc.lifecycle_stage = 'customer') AS customers,
        COUNT(DISTINCT cc.contact_id) FILTER (WHERE cc.lifecycle_stage IN ('lead', 'marketingqualifiedlead')) AS mqls,
        COUNT(DISTINCT cc.contact_id) FILTER (WHERE cc.lifecycle_stage IN ('salesqualifiedlead', 'opportunity')) AS sqls,
        COALESCE(SUM(d.deal_value) FILTER (WHERE d.stage = 'closedwon'), 0) AS closedwon_revenue_aed,
        COUNT(d.id) FILTER (WHERE d.stage = 'closedwon') AS closedwon_deals
    FROM channel_contacts cc
    LEFT JOIN public.deals d ON d.contact_id = cc.contact_id
    GROUP BY cc.channel, cc.utm_campaign
),
fb_spend AS (
    SELECT
        campaign_name,
        SUM(spend) AS total_spend_aed,
        SUM(impressions) AS total_impressions,
        SUM(clicks) AS total_clicks,
        SUM(conversions) AS total_conversions
    FROM public.facebook_ads_insights
    GROUP BY campaign_name
)
SELECT
    cr.channel,
    cr.utm_campaign,
    cr.total_contacts,
    cr.mqls,
    cr.sqls,
    cr.customers,
    cr.closedwon_revenue_aed,
    cr.closedwon_deals,
    fs.total_spend_aed,
    fs.total_impressions,
    fs.total_clicks,
    CASE WHEN cr.total_contacts > 0
        THEN ROUND(100.0 * cr.customers / cr.total_contacts, 1)
    END AS conversion_rate_pct,
    CASE WHEN fs.total_spend_aed > 0
        THEN ROUND(cr.closedwon_revenue_aed / fs.total_spend_aed, 2)
    END AS roas,
    CASE WHEN cr.customers > 0
        THEN ROUND(COALESCE(fs.total_spend_aed, 0) / cr.customers, 0)
    END AS cac_aed,
    CASE
        WHEN cr.channel IN ('PAID_SOCIAL', 'PAID_SEARCH') AND fs.total_spend_aed IS NOT NULL THEN 'HIGH'
        WHEN cr.channel IN ('SOCIAL_MEDIA', 'ORGANIC_SEARCH', 'DIRECT_TRAFFIC') THEN 'MEDIUM'
        WHEN cr.channel = 'PHONE_INQUIRY' THEN 'LOW'
        WHEN cr.channel = 'UNKNOWN' THEN 'NONE'
        ELSE 'LOW'
    END AS channel_confidence
FROM channel_revenue cr
LEFT JOIN fb_spend fs ON fs.campaign_name ILIKE '%' || cr.utm_campaign || '%'
    AND cr.utm_campaign IS NOT NULL
ORDER BY cr.closedwon_revenue_aed DESC;

GRANT SELECT ON public.view_marketing_attribution TO authenticated;
GRANT SELECT ON public.view_marketing_attribution TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. INDEXES — Supabase Postgres Best Practices
-- ─────────────────────────────────────────────────────────────────────────────

-- == JOIN COLUMN INDEXES (query-missing-indexes: CRITICAL) ==

CREATE INDEX IF NOT EXISTS idx_contacts_email_lower
  ON public.contacts (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_phone
  ON public.contacts (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aws_truth_cache_email_lower
  ON public.aws_truth_cache (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_health_scores_email_lower
  ON public.client_health_scores (lower(email), calculated_on DESC NULLS LAST)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conv_intel_phone
  ON public.conversation_intelligence (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_call_records_caller_number
  ON public.call_records (caller_number)
  WHERE caller_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attribution_events_email
  ON public.attribution_events (email, event_time DESC)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attribution_events_phone
  ON public.attribution_events (phone, event_time DESC)
  WHERE phone IS NOT NULL;

-- == PARTIAL INDEXES (query-partial-indexes: HIGH) ==

CREATE INDEX IF NOT EXISTS idx_deals_closedwon
  ON public.deals (contact_id, deal_value)
  WHERE stage = 'closedwon' AND contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deals_active_pipeline
  ON public.deals (contact_id)
  WHERE stage NOT IN ('closedwon', 'closedlost')
    AND stage IS NOT NULL
    AND contact_id IS NOT NULL;

-- == COVERING INDEXES (query-covering-indexes: MEDIUM-HIGH) ==

CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle_source
  ON public.contacts (lifecycle_stage)
  INCLUDE (first_touch_source, assigned_coach, analytics_score)
  WHERE lifecycle_stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fb_insights_campaign
  ON public.facebook_ads_insights (campaign_name)
  INCLUDE (spend, impressions, clicks, conversions);

-- == COMPOSITE INDEXES (query-composite-indexes: HIGH) ==

CREATE INDEX IF NOT EXISTS idx_call_records_caller_stats
  ON public.call_records (caller_number)
  INCLUDE (duration_seconds, call_score, sentiment_score, started_at)
  WHERE caller_number IS NOT NULL;

-- == ANALYZE (monitor-vacuum-analyze) ==
ANALYZE public.contacts;
ANALYZE public.deals;
ANALYZE public.call_records;
ANALYZE public.aws_truth_cache;
ANALYZE public.client_health_scores;
ANALYZE public.conversation_intelligence;
ANALYZE public.attribution_events;
ANALYZE public.facebook_ads_insights;
