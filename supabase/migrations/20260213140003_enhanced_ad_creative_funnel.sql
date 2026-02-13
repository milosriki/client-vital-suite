-- Task 4.4: Revenue per Creative — KEY DELIVERABLE
-- Enhances ad_creative_funnel with actual Stripe revenue (not just HubSpot deal_value)
-- Full chain: facebook_ads_insights → attribution_events → contacts → deals → stripe_transactions
-- Answers: "Ad X spent AED Y and generated AED Z = TRUE ROI of N%"

-- Must DROP first because column order changed (PG cannot rename via CREATE OR REPLACE)
DROP VIEW IF EXISTS public.ad_creative_funnel;

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
        COUNT(DISTINCT c.hubspot_contact_id) AS db_leads,
        -- Collect contact emails for Stripe matching
        ARRAY_AGG(DISTINCT LOWER(c.email)) FILTER (WHERE c.email IS NOT NULL) AS contact_emails
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
        COALESCE(SUM(d.deal_value) FILTER (WHERE d.stage = 'closedwon'), 0) AS deal_revenue
    FROM public.attribution_events ae
    JOIN public.contacts c ON c.email = ae.email
    JOIN public.deals d ON d.contact_id = c.id
    WHERE ae.event_time >= CURRENT_DATE - INTERVAL '90 days'
      AND ae.fb_ad_id IS NOT NULL
      AND d.updated_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY ae.fb_ad_id
),
ad_stripe_revenue AS (
    -- Actual Stripe payments linked to each ad via:
    -- attribution_events → contacts → known_cards → stripe_transactions
    SELECT
        ae.fb_ad_id,
        COALESCE(SUM(st.amount), 0) AS stripe_revenue,
        COUNT(DISTINCT st.id) AS stripe_transaction_count
    FROM public.attribution_events ae
    JOIN public.contacts c ON LOWER(c.email) = LOWER(ae.email)
    JOIN public.known_cards kc ON LOWER(kc.customer_email) = LOWER(c.email)
    JOIN public.stripe_transactions st
        ON st.customer_id = kc.customer_id
        AND st.status = 'succeeded'
        AND st.amount > 0
    WHERE ae.event_time >= CURRENT_DATE - INTERVAL '90 days'
      AND ae.fb_ad_id IS NOT NULL
      AND c.email IS NOT NULL
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
    -- Revenue: HubSpot deal value (reported)
    COALESCE(ad.deal_revenue, 0) AS revenue,
    -- Revenue: Actual Stripe payments (verified)
    COALESCE(asr.stripe_revenue, 0) AS stripe_revenue,
    COALESCE(asr.stripe_transaction_count, 0) AS stripe_transactions,
    -- Creative health signals
    asp.video_p25_total,
    asp.video_p100_total,
    CASE WHEN asp.video_p25_total > 0
         THEN ROUND((asp.video_p100_total::numeric / asp.video_p25_total) * 100, 1)
         ELSE 0 END AS video_completion_pct,
    asp.quality_ranking,
    asp.engagement_rate_ranking,
    asp.conversion_rate_ranking,
    -- Computed metrics (using deal revenue for backward compat)
    CASE WHEN asp.spend > 0 AND COALESCE(ac.db_leads, 0) > 0
         THEN ROUND(asp.spend / ac.db_leads, 0)
         ELSE 0 END AS cpl,
    CASE WHEN asp.spend > 0 AND COALESCE(ad.deal_revenue, 0) > 0
         THEN ROUND(ad.deal_revenue / asp.spend, 1)
         ELSE 0 END AS roas,
    -- TRUE ROAS based on actual Stripe payments
    CASE WHEN asp.spend > 0 AND COALESCE(asr.stripe_revenue, 0) > 0
         THEN ROUND(asr.stripe_revenue / asp.spend, 1)
         ELSE 0 END AS true_roas,
    -- Cost per opportunity (booked assessment)
    CASE WHEN asp.spend > 0 AND COALESCE(ad.booked, 0) > 0
         THEN ROUND(asp.spend / ad.booked, 0)
         ELSE 0 END AS cpo,
    -- Creative verdict
    CASE
        WHEN asp.spend IS NULL OR asp.spend = 0 THEN 'NO_SPEND'
        WHEN COALESCE(asr.stripe_revenue, 0) / NULLIF(asp.spend, 0) > 3 THEN 'WINNER'
        WHEN COALESCE(ac.db_leads, 0) < 2 THEN 'LOW_VOLUME'
        WHEN asp.quality_ranking = 'BELOW_AVERAGE_10' THEN 'LOW_QUALITY'
        WHEN COALESCE(asr.stripe_revenue, 0) / NULLIF(asp.spend, 0) >= 1 THEN 'PROFITABLE'
        WHEN COALESCE(ad.booked, 0)::numeric / NULLIF(ac.db_leads, 0) < 0.10 THEN 'BAD_LEADS'
        ELSE 'UNPROFITABLE'
    END AS creative_verdict
FROM ad_spend asp
LEFT JOIN ad_attribution aa ON asp.ad_id = aa.fb_ad_id
LEFT JOIN ad_contacts ac ON asp.ad_id = ac.fb_ad_id
LEFT JOIN ad_deals ad ON asp.ad_id = ad.fb_ad_id
LEFT JOIN ad_stripe_revenue asr ON asp.ad_id = asr.fb_ad_id
WHERE asp.spend > 0;
