-- ============================================================================
-- FIX: get_campaign_money_map — Wire attribution_events into campaign matching
-- Problem: RPC relied solely on contacts.utm_campaign, leaving 10K+ leads as
--          "Unattributed/Organic". Now we join attribution_events (403 records
--          with fb_ad_id after backfill) to link contacts → campaigns → revenue.
-- Also updates view_marketing_attribution to use the same attribution hierarchy.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. get_campaign_money_map — Now uses attribution_events for campaign matching
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_campaign_money_map(days_back integer DEFAULT 90)
RETURNS TABLE (
  campaign_name text,
  total_spend numeric,
  total_leads bigint,
  total_revenue numeric,
  total_deals bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH fb_spend AS (
    SELECT
      f.campaign_name,
      SUM(f.spend) AS spend
    FROM facebook_ads_insights f
    WHERE f.date >= (current_date - days_back * interval '1 day')::date
    GROUP BY f.campaign_name
  ),
  -- Best attribution per contact: contacts.utm_campaign > attribution_events (email) > attribution_events (phone)
  contact_campaign AS (
    SELECT
      c.id AS contact_id,
      COALESCE(
        c.utm_campaign,
        ae_email.best_campaign,
        ae_phone.best_campaign,
        'Unattributed/Organic'
      ) AS campaign_name,
      COALESCE(c.total_deal_value, 0) AS deal_value,
      COALESCE(c.num_associated_deals, 0) AS deal_count
    FROM contacts c
    LEFT JOIN LATERAL (
      SELECT COALESCE(a.fb_campaign_name, a.utm_campaign) AS best_campaign
      FROM attribution_events a
      WHERE a.email IS NOT NULL
        AND lower(a.email) = lower(c.email)
        AND c.email IS NOT NULL
      ORDER BY a.event_time DESC
      LIMIT 1
    ) ae_email ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(a.fb_campaign_name, a.utm_campaign) AS best_campaign
      FROM attribution_events a
      WHERE a.phone IS NOT NULL
        AND a.phone = c.phone
        AND c.phone IS NOT NULL
        AND ae_email.best_campaign IS NULL
      ORDER BY a.event_time DESC
      LIMIT 1
    ) ae_phone ON true
  ),
  hs_revenue AS (
    SELECT
      cc.campaign_name,
      COUNT(*) AS leads,
      SUM(cc.deal_value) AS revenue,
      SUM(cc.deal_count) AS deals
    FROM contact_campaign cc
    GROUP BY cc.campaign_name
  ),
  all_campaigns AS (
    SELECT DISTINCT name FROM (
      SELECT f.campaign_name AS name FROM fb_spend f
      UNION
      SELECT h.campaign_name AS name FROM hs_revenue h
    ) s
  )
  SELECT
    ac.name,
    COALESCE(f.spend, 0)::numeric,
    COALESCE(h.leads, 0)::bigint,
    COALESCE(h.revenue, 0)::numeric,
    COALESCE(h.deals, 0)::bigint
  FROM all_campaigns ac
  LEFT JOIN fb_spend f ON ac.name = f.campaign_name
  LEFT JOIN hs_revenue h ON ac.name = h.campaign_name
  ORDER BY h.revenue DESC NULLS LAST;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. view_marketing_attribution — Use same attribution hierarchy
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.view_marketing_attribution;

CREATE VIEW public.view_marketing_attribution AS
WITH contact_attributed AS (
    SELECT
        c.id AS contact_id,
        c.lifecycle_stage,
        c.phone,
        -- Channel: HubSpot first_touch > attribution_events > phone inquiry > unknown
        COALESCE(
            c.first_touch_source,
            ae_email.attr_source,
            ae_phone.attr_source,
            CASE WHEN EXISTS (
                SELECT 1 FROM public.call_records cr
                WHERE cr.caller_number = c.phone AND c.phone IS NOT NULL
            ) THEN 'PHONE_INQUIRY' ELSE 'UNKNOWN' END
        ) AS channel,
        -- Campaign: utm_campaign > attribution fb_campaign_name > attribution utm_campaign
        COALESCE(
            c.utm_campaign,
            ae_email.best_campaign,
            ae_phone.best_campaign
        ) AS utm_campaign
    FROM public.contacts c
    LEFT JOIN LATERAL (
        SELECT
            COALESCE(a.fb_campaign_name, a.utm_campaign) AS best_campaign,
            a.source AS attr_source
        FROM public.attribution_events a
        WHERE a.email IS NOT NULL
          AND lower(a.email) = lower(c.email)
          AND c.email IS NOT NULL
        ORDER BY a.event_time DESC
        LIMIT 1
    ) ae_email ON true
    LEFT JOIN LATERAL (
        SELECT
            COALESCE(a.fb_campaign_name, a.utm_campaign) AS best_campaign,
            a.source AS attr_source
        FROM public.attribution_events a
        WHERE a.phone IS NOT NULL
          AND a.phone = c.phone
          AND c.phone IS NOT NULL
          AND ae_email.best_campaign IS NULL
        ORDER BY a.event_time DESC
        LIMIT 1
    ) ae_phone ON true
),
channel_revenue AS (
    SELECT
        ca.channel,
        ca.utm_campaign,
        COUNT(DISTINCT ca.contact_id) AS total_contacts,
        COUNT(DISTINCT ca.contact_id) FILTER (WHERE ca.lifecycle_stage = 'customer') AS customers,
        COUNT(DISTINCT ca.contact_id) FILTER (WHERE ca.lifecycle_stage IN ('lead', 'marketingqualifiedlead')) AS mqls,
        COUNT(DISTINCT ca.contact_id) FILTER (WHERE ca.lifecycle_stage IN ('salesqualifiedlead', 'opportunity')) AS sqls,
        COALESCE(SUM(d.deal_value) FILTER (WHERE d.stage = 'closedwon'), 0) AS closedwon_revenue_aed,
        COUNT(d.id) FILTER (WHERE d.stage = 'closedwon') AS closedwon_deals
    FROM contact_attributed ca
    LEFT JOIN public.deals d ON d.contact_id = ca.contact_id
    GROUP BY ca.channel, ca.utm_campaign
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
