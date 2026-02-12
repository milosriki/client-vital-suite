-- =============================================================
-- Attribution Deep Views — Adset, Creative & Lead Journey
-- =============================================================
-- Creates:
--   1. adset_full_funnel VIEW — full chain per adset (via attribution_events bridge)
--   2. ad_creative_funnel VIEW — full chain per ad/creative with video & quality signals
--   3. lead_full_journey VIEW — enhanced lead lifecycle with full attribution chain
--   4. Supporting indexes for JOIN performance
-- =============================================================

-- ── 1. Supporting indexes ──

-- attribution_events: adset/ad grouping + email joins
CREATE INDEX IF NOT EXISTS idx_ae_fb_adset_name
  ON public.attribution_events (fb_adset_name)
  WHERE fb_adset_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ae_fb_ad_id
  ON public.attribution_events (fb_ad_id)
  WHERE fb_ad_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ae_email
  ON public.attribution_events (email)
  WHERE email IS NOT NULL;

-- facebook_ads_insights: adset/ad-level aggregation
CREATE INDEX IF NOT EXISTS idx_fai_adset_date
  ON public.facebook_ads_insights (adset_name, date DESC)
  WHERE adset_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fai_ad_id_date
  ON public.facebook_ads_insights (ad_id, date DESC)
  WHERE ad_id IS NOT NULL;

-- call_records: phone-based join for lead journey
CREATE INDEX IF NOT EXISTS idx_cr_caller_number
  ON public.call_records (caller_number)
  WHERE caller_number IS NOT NULL;


-- ── 2. adset_full_funnel VIEW ──
-- Like campaign_full_funnel but per adset.
-- Uses attribution_events as bridge since contacts.utm_campaign only maps to campaign, not adset.
-- JOIN chain: facebook_ads_insights → attribution_events (fb_adset_name → email) → contacts → deals

CREATE OR REPLACE VIEW public.adset_full_funnel AS
WITH adset_spend AS (
    SELECT
        campaign_name,
        adset_id,
        adset_name,
        SUM(spend) AS spend,
        SUM(COALESCE(leads, 0)) AS fb_leads,
        SUM(COALESCE(impressions, 0)) AS impressions,
        SUM(COALESCE(clicks, 0)) AS clicks
    FROM public.facebook_ads_insights
    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      AND adset_name IS NOT NULL
    GROUP BY campaign_name, adset_id, adset_name
),
adset_attribution AS (
    SELECT
        fb_adset_name,
        COUNT(DISTINCT email) AS anytrack_leads
    FROM public.attribution_events
    WHERE event_time >= CURRENT_DATE - INTERVAL '90 days'
      AND fb_adset_name IS NOT NULL
      AND email IS NOT NULL
    GROUP BY fb_adset_name
),
adset_contacts AS (
    SELECT
        ae.fb_adset_name,
        COUNT(DISTINCT c.hubspot_contact_id) AS db_leads,
        COUNT(DISTINCT c.hubspot_contact_id)
            FILTER (WHERE c.created_at >= NOW() - INTERVAL '7 days') AS leads_7d
    FROM public.attribution_events ae
    JOIN public.contacts c ON c.email = ae.email
    WHERE ae.event_time >= CURRENT_DATE - INTERVAL '90 days'
      AND ae.fb_adset_name IS NOT NULL
      AND c.hubspot_contact_id IS NOT NULL
    GROUP BY ae.fb_adset_name
),
adset_deals AS (
    SELECT
        ae.fb_adset_name,
        COUNT(DISTINCT d.id) FILTER (WHERE d.stage IN (
            '122237508','122237276','122221229',
            'qualifiedtobuy','decisionmakerboughtin',
            '2900542','987633705','closedwon'
        )) AS booked,
        COUNT(DISTINCT d.id) FILTER (WHERE d.stage IN (
            '122237276','122221229',
            'qualifiedtobuy','decisionmakerboughtin',
            '2900542','987633705','closedwon'
        )) AS held,
        COUNT(DISTINCT d.id) FILTER (WHERE d.stage IN (
            'qualifiedtobuy','decisionmakerboughtin',
            '2900542','987633705','closedwon'
        )) AS in_deal,
        COUNT(DISTINCT d.id) FILTER (WHERE d.stage = 'closedwon') AS closed_won,
        COUNT(DISTINCT d.id) FILTER (WHERE d.stage = '1063991961') AS closed_lost,
        COALESCE(SUM(d.deal_value) FILTER (WHERE d.stage = 'closedwon'), 0) AS revenue
    FROM public.attribution_events ae
    JOIN public.contacts c ON c.email = ae.email
    JOIN public.deals d ON d.contact_id = c.id
    WHERE ae.event_time >= CURRENT_DATE - INTERVAL '90 days'
      AND ae.fb_adset_name IS NOT NULL
      AND d.updated_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY ae.fb_adset_name
)
SELECT
    asp.campaign_name,
    asp.adset_id,
    asp.adset_name,
    COALESCE(asp.spend, 0) AS spend,
    COALESCE(asp.fb_leads, 0) AS fb_leads,
    COALESCE(aa.anytrack_leads, 0) AS anytrack_leads,
    COALESCE(ac.db_leads, 0) AS db_leads,
    COALESCE(ac.leads_7d, 0) AS leads_7d,
    COALESCE(asp.impressions, 0) AS impressions,
    COALESCE(asp.clicks, 0) AS clicks,
    COALESCE(ad.booked, 0) AS booked,
    COALESCE(ad.held, 0) AS held,
    COALESCE(ad.in_deal, 0) AS in_deal,
    COALESCE(ad.closed_won, 0) AS closed_won,
    COALESCE(ad.closed_lost, 0) AS closed_lost,
    COALESCE(ad.revenue, 0) AS revenue,
    -- Computed metrics
    CASE WHEN asp.spend > 0 AND COALESCE(ac.db_leads, 0) > 0
         THEN ROUND(asp.spend / ac.db_leads, 0)
         ELSE 0 END AS cpl,
    CASE WHEN asp.spend > 0 AND COALESCE(ad.closed_won, 0) > 0
         THEN ROUND(asp.spend / ad.closed_won, 0)
         ELSE 0 END AS cpo,
    CASE WHEN asp.spend > 0 AND COALESCE(ad.revenue, 0) > 0
         THEN ROUND(ad.revenue / asp.spend, 1)
         ELSE 0 END AS roas,
    -- Conversion rates
    CASE WHEN COALESCE(ac.db_leads, 0) > 0
         THEN ROUND((COALESCE(ad.booked, 0)::numeric / ac.db_leads) * 100, 1)
         ELSE 0 END AS lead_to_book_pct,
    CASE WHEN COALESCE(ad.booked, 0) > 0
         THEN ROUND((COALESCE(ad.held, 0)::numeric / ad.booked) * 100, 1)
         ELSE 0 END AS book_to_held_pct,
    CASE WHEN COALESCE(ad.held, 0) > 0
         THEN ROUND((COALESCE(ad.closed_won, 0)::numeric / ad.held) * 100, 1)
         ELSE 0 END AS held_to_close_pct,
    -- Verdict (identical logic to campaign_full_funnel)
    CASE
        WHEN asp.spend IS NULL OR asp.spend = 0 THEN 'NO_SPEND'
        WHEN COALESCE(ad.revenue, 0) / NULLIF(asp.spend, 0) > 3 THEN 'SCALE'
        WHEN COALESCE(ac.db_leads, 0) < 3 THEN 'LOW_VOLUME'
        WHEN COALESCE(ad.booked, 0)::numeric / NULLIF(ac.db_leads, 0) < 0.15 THEN 'BAD_LEADS'
        WHEN COALESCE(ad.held, 0)::numeric / NULLIF(ad.booked, 0) < 0.5 THEN 'FIX_FOLLOWUP'
        WHEN COALESCE(ad.closed_won, 0)::numeric / NULLIF(ad.held, 0) < 0.15 THEN 'FIX_COACH'
        WHEN COALESCE(ad.revenue, 0) / NULLIF(asp.spend, 0) >= 1 THEN 'MONITOR'
        ELSE 'FIX_ROAS'
    END AS verdict
FROM adset_spend asp
LEFT JOIN adset_attribution aa ON asp.adset_name = aa.fb_adset_name
LEFT JOIN adset_contacts ac ON asp.adset_name = ac.fb_adset_name
LEFT JOIN adset_deals ad ON asp.adset_name = ad.fb_adset_name
WHERE asp.spend > 0 OR COALESCE(ac.db_leads, 0) > 0;


-- ── 3. ad_creative_funnel VIEW ──
-- Per ad/creative funnel with video completion and Meta quality signals.
-- Joins on ad_id = fb_ad_id (unique identifier, unlike ad_name).

CREATE OR REPLACE VIEW public.ad_creative_funnel AS
WITH ad_spend AS (
    SELECT
        campaign_name,
        adset_name,
        ad_id,
        ad_name,
        SUM(spend) AS spend,
        SUM(COALESCE(leads, 0)) AS fb_leads,
        SUM(COALESCE(impressions, 0)) AS impressions,
        SUM(COALESCE(clicks, 0)) AS clicks,
        -- Video engagement
        SUM(COALESCE(video_p25_watched, 0)) AS video_p25_total,
        SUM(COALESCE(video_p100_watched, 0)) AS video_p100_total,
        -- Quality rankings (most recent non-null)
        (ARRAY_AGG(quality_ranking ORDER BY date DESC)
            FILTER (WHERE quality_ranking IS NOT NULL))[1] AS quality_ranking,
        (ARRAY_AGG(engagement_rate_ranking ORDER BY date DESC)
            FILTER (WHERE engagement_rate_ranking IS NOT NULL))[1] AS engagement_rate_ranking,
        (ARRAY_AGG(conversion_rate_ranking ORDER BY date DESC)
            FILTER (WHERE conversion_rate_ranking IS NOT NULL))[1] AS conversion_rate_ranking
    FROM public.facebook_ads_insights
    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      AND ad_id IS NOT NULL
    GROUP BY campaign_name, adset_name, ad_id, ad_name
),
ad_attribution AS (
    SELECT
        fb_ad_id,
        COUNT(DISTINCT email) AS anytrack_leads
    FROM public.attribution_events
    WHERE event_time >= CURRENT_DATE - INTERVAL '90 days'
      AND fb_ad_id IS NOT NULL
      AND email IS NOT NULL
    GROUP BY fb_ad_id
),
ad_contacts AS (
    SELECT
        ae.fb_ad_id,
        COUNT(DISTINCT c.hubspot_contact_id) AS db_leads
    FROM public.attribution_events ae
    JOIN public.contacts c ON c.email = ae.email
    WHERE ae.event_time >= CURRENT_DATE - INTERVAL '90 days'
      AND ae.fb_ad_id IS NOT NULL
      AND c.hubspot_contact_id IS NOT NULL
    GROUP BY ae.fb_ad_id
),
ad_deals AS (
    SELECT
        ae.fb_ad_id,
        COUNT(DISTINCT d.id) FILTER (WHERE d.stage IN (
            '122237508','122237276','122221229',
            'qualifiedtobuy','decisionmakerboughtin',
            '2900542','987633705','closedwon'
        )) AS booked,
        COUNT(DISTINCT d.id) FILTER (WHERE d.stage = 'closedwon') AS closed_won,
        COALESCE(SUM(d.deal_value) FILTER (WHERE d.stage = 'closedwon'), 0) AS revenue
    FROM public.attribution_events ae
    JOIN public.contacts c ON c.email = ae.email
    JOIN public.deals d ON d.contact_id = c.id
    WHERE ae.event_time >= CURRENT_DATE - INTERVAL '90 days'
      AND ae.fb_ad_id IS NOT NULL
      AND d.updated_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY ae.fb_ad_id
)
SELECT
    asp.campaign_name,
    asp.adset_name,
    asp.ad_id,
    asp.ad_name,
    COALESCE(asp.spend, 0) AS spend,
    COALESCE(asp.fb_leads, 0) AS fb_leads,
    COALESCE(aa.anytrack_leads, 0) AS anytrack_leads,
    COALESCE(ac.db_leads, 0) AS db_leads,
    COALESCE(asp.impressions, 0) AS impressions,
    COALESCE(asp.clicks, 0) AS clicks,
    COALESCE(ad.booked, 0) AS booked,
    COALESCE(ad.closed_won, 0) AS closed_won,
    COALESCE(ad.revenue, 0) AS revenue,
    -- Creative health signals
    asp.video_p25_total,
    asp.video_p100_total,
    CASE WHEN asp.video_p25_total > 0
         THEN ROUND((asp.video_p100_total::numeric / asp.video_p25_total) * 100, 1)
         ELSE 0 END AS video_completion_pct,
    asp.quality_ranking,
    asp.engagement_rate_ranking,
    asp.conversion_rate_ranking,
    -- Computed metrics
    CASE WHEN asp.spend > 0 AND COALESCE(ac.db_leads, 0) > 0
         THEN ROUND(asp.spend / ac.db_leads, 0)
         ELSE 0 END AS cpl,
    CASE WHEN asp.spend > 0 AND COALESCE(ad.revenue, 0) > 0
         THEN ROUND(ad.revenue / asp.spend, 1)
         ELSE 0 END AS roas,
    -- Creative verdict
    CASE
        WHEN asp.spend IS NULL OR asp.spend = 0 THEN 'NO_SPEND'
        WHEN COALESCE(ad.revenue, 0) / NULLIF(asp.spend, 0) > 3 THEN 'WINNER'
        WHEN COALESCE(ac.db_leads, 0) < 2 THEN 'LOW_VOLUME'
        WHEN asp.quality_ranking = 'BELOW_AVERAGE_10' THEN 'LOW_QUALITY'
        WHEN COALESCE(ad.revenue, 0) / NULLIF(asp.spend, 0) >= 1 THEN 'PROFITABLE'
        WHEN COALESCE(ad.booked, 0)::numeric / NULLIF(ac.db_leads, 0) < 0.10 THEN 'BAD_LEADS'
        ELSE 'UNPROFITABLE'
    END AS creative_verdict
FROM ad_spend asp
LEFT JOIN ad_attribution aa ON asp.ad_id = aa.fb_ad_id
LEFT JOIN ad_contacts ac ON asp.ad_id = ac.fb_ad_id
LEFT JOIN ad_deals ad ON asp.ad_id = ad.fb_ad_id
WHERE asp.spend > 0;


-- ── 4. lead_full_journey VIEW ──
-- Enhanced lead lifecycle with full attribution chain, call history, and health.
-- Uses DISTINCT ON + LATERAL subqueries to prevent row multiplication.
-- Production schema: call_records has caller_number (not contact_id), hubspot_owner_id (not agent_name).

CREATE OR REPLACE VIEW public.lead_full_journey AS
SELECT DISTINCT ON (c.id)
    c.id AS contact_id,
    c.hubspot_contact_id,
    c.email,
    c.first_name,
    c.last_name,
    c.phone,
    c.owner_name,
    c.lifecycle_stage,
    c.lead_status,
    -- Deal info
    d.stage AS deal_stage,
    CASE
        WHEN d.stage = '122178070' THEN 'New Lead (Incoming)'
        WHEN d.stage = '122237508' THEN 'Assessment Booked'
        WHEN d.stage = '122237276' THEN 'Assessment Completed'
        WHEN d.stage = '122221229' THEN 'Booking Process'
        WHEN d.stage = 'qualifiedtobuy' THEN 'Package Selected'
        WHEN d.stage = 'decisionmakerboughtin' THEN 'Decision Maker'
        WHEN d.stage = 'contractsent' THEN 'Contract Sent'
        WHEN d.stage = '2900542' THEN 'Payment Pending'
        WHEN d.stage = '987633705' THEN 'Onboarding'
        WHEN d.stage = 'closedwon' THEN 'Closed Won'
        WHEN d.stage = '1063991961' THEN 'Closed Lost'
        WHEN d.stage = '1064059180' THEN 'On Hold'
        ELSE COALESCE(d.stage, 'No Deal')
    END AS deal_stage_label,
    d.deal_value,
    -- Full attribution chain
    ae.source AS attribution_source,
    ae.campaign AS attribution_campaign,
    ae.fb_campaign_id,
    ae.fb_campaign_name,
    ae.fb_adset_id,
    ae.fb_adset_name,
    ae.fb_ad_id,
    ae.fb_ad_name,
    -- Coaching
    c.assigned_coach,
    -- Call records (aggregated via LATERAL)
    cr.total_calls,
    cr.completed_calls,
    cr.latest_call_date,
    cr.latest_agent,
    cr.latest_call_outcome,
    cr.total_call_duration_seconds,
    -- Health
    chs.health_score,
    chs.health_zone,
    chs.churn_risk_score,
    -- Timeline
    c.created_at AS lead_created_at,
    d.created_at AS deal_created_at,
    c.assessment_date,
    c.speed_to_lead_minutes,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(d.updated_at, c.updated_at))) / 86400 AS days_in_current_stage,
    GREATEST(c.updated_at, COALESCE(d.updated_at, c.created_at)) AS last_updated_at
FROM public.contacts c
LEFT JOIN public.deals d
    ON d.contact_id = c.id
LEFT JOIN LATERAL (
    SELECT
        source, campaign,
        fb_campaign_id, fb_campaign_name,
        fb_adset_id, fb_adset_name,
        fb_ad_id, fb_ad_name
    FROM public.attribution_events
    WHERE email = c.email
    ORDER BY event_time DESC
    LIMIT 1
) ae ON true
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS total_calls,
        COUNT(*) FILTER (WHERE call_status IN ('completed', 'answered', 'ANSWERED')) AS completed_calls,
        MAX(started_at) AS latest_call_date,
        (ARRAY_AGG(hubspot_owner_id ORDER BY started_at DESC)
            FILTER (WHERE hubspot_owner_id IS NOT NULL))[1] AS latest_agent,
        (ARRAY_AGG(call_outcome ORDER BY started_at DESC)
            FILTER (WHERE call_outcome IS NOT NULL))[1] AS latest_call_outcome,
        SUM(COALESCE(duration_seconds, 0)) AS total_call_duration_seconds
    FROM public.call_records
    WHERE caller_number = c.phone
) cr ON c.phone IS NOT NULL
LEFT JOIN LATERAL (
    SELECT health_score, health_zone, churn_risk_score
    FROM public.client_health_scores
    WHERE email = c.email
    ORDER BY calculated_at DESC NULLS LAST
    LIMIT 1
) chs ON true
ORDER BY c.id, d.updated_at DESC NULLS LAST;


-- ── 5. Grant access (authenticated only — no anon access to PII) ──

GRANT SELECT ON public.adset_full_funnel TO authenticated;
GRANT SELECT ON public.ad_creative_funnel TO authenticated;
GRANT SELECT ON public.lead_full_journey TO authenticated;
