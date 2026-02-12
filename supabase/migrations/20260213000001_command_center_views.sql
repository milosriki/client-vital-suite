-- =============================================================
-- PTD Command Center — Database Views & Supporting Indexes
-- =============================================================
-- Creates:
--   1. campaign_full_funnel VIEW — full chain: FB spend → contacts → deals with verdict
--   2. cold_leads VIEW — leads with no deal activity within 7 days of creation
--   3. upcoming_assessments VIEW — contacts with assessment_date in next 7 days
--   4. Supporting indexes for JOIN performance
-- =============================================================

-- ── 1. Supporting indexes (Supabase best practice: index JOIN and WHERE columns) ──

-- contacts.utm_campaign is used to join campaigns → contacts
CREATE INDEX IF NOT EXISTS idx_contacts_utm_campaign
  ON public.contacts (utm_campaign)
  WHERE utm_campaign IS NOT NULL;

-- contacts.created_at for date filtering
CREATE INDEX IF NOT EXISTS idx_contacts_created_at
  ON public.contacts (created_at DESC);

-- contacts.assessment_date for upcoming assessments
CREATE INDEX IF NOT EXISTS idx_contacts_assessment_date
  ON public.contacts (assessment_date)
  WHERE assessment_date IS NOT NULL;

-- deals.contact_id for JOIN to contacts (FK index — Postgres doesn't auto-index FKs)
CREATE INDEX IF NOT EXISTS idx_deals_contact_id
  ON public.deals (contact_id)
  WHERE contact_id IS NOT NULL;

-- deals.stage for filtering by deal stage
CREATE INDEX IF NOT EXISTS idx_deals_stage
  ON public.deals (stage)
  WHERE stage IS NOT NULL;

-- Composite: deals (stage, updated_at) for stage + date range queries
CREATE INDEX IF NOT EXISTS idx_deals_stage_updated
  ON public.deals (stage, updated_at DESC);

-- facebook_ads_insights (campaign_name, date) for campaign aggregation
CREATE INDEX IF NOT EXISTS idx_fai_campaign_date
  ON public.facebook_ads_insights (campaign_name, date DESC);

-- client_health_scores.email for JOIN in upcoming_assessments
CREATE INDEX IF NOT EXISTS idx_chs_email
  ON public.client_health_scores (email);


-- ── 2. campaign_full_funnel VIEW ──
-- Joins FB spend → contacts (via utm_campaign) → deals per campaign
-- Uses contact_id to join contacts ↔ deals (established codebase pattern)
-- Computes: leads, booked, held, closed, revenue, ROAS, verdict

CREATE OR REPLACE VIEW public.campaign_full_funnel AS
WITH campaign_spend AS (
    SELECT
        campaign_name,
        SUM(spend) AS spend,
        SUM(COALESCE(leads, 0)) AS fb_leads,
        SUM(COALESCE(impressions, 0)) AS impressions,
        SUM(COALESCE(clicks, 0)) AS clicks
    FROM public.facebook_ads_insights
    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY campaign_name
),
campaign_contacts AS (
    SELECT
        utm_campaign,
        COUNT(*) AS db_leads,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS leads_7d
    FROM public.contacts
    WHERE utm_campaign IS NOT NULL
      AND created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY utm_campaign
),
campaign_deals AS (
    SELECT
        c.utm_campaign,
        COUNT(d.id) FILTER (WHERE d.stage IN (
            '122237508','122237276','122221229',
            'qualifiedtobuy','decisionmakerboughtin',
            '2900542','987633705','closedwon'
        )) AS booked,
        COUNT(d.id) FILTER (WHERE d.stage IN (
            '122237276','122221229',
            'qualifiedtobuy','decisionmakerboughtin',
            '2900542','987633705','closedwon'
        )) AS held,
        COUNT(d.id) FILTER (WHERE d.stage IN (
            'qualifiedtobuy','decisionmakerboughtin',
            '2900542','987633705','closedwon'
        )) AS in_deal,
        COUNT(d.id) FILTER (WHERE d.stage = 'closedwon') AS closed_won,
        COUNT(d.id) FILTER (WHERE d.stage = '1063991961') AS closed_lost,
        COUNT(d.id) FILTER (WHERE d.stage = '1064059180') AS on_hold,
        COALESCE(SUM(d.deal_value) FILTER (WHERE d.stage = 'closedwon'), 0) AS revenue
    FROM public.contacts c
    JOIN public.deals d ON d.contact_id = c.id
    WHERE c.utm_campaign IS NOT NULL
      AND d.updated_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY c.utm_campaign
)
SELECT
    COALESCE(cs.campaign_name, cc.utm_campaign) AS campaign,
    COALESCE(cs.spend, 0) AS spend,
    COALESCE(cs.fb_leads, 0) AS fb_leads,
    COALESCE(cc.db_leads, 0) AS db_leads,
    COALESCE(cc.leads_7d, 0) AS leads_7d,
    COALESCE(cs.impressions, 0) AS impressions,
    COALESCE(cs.clicks, 0) AS clicks,
    COALESCE(cd.booked, 0) AS booked,
    COALESCE(cd.held, 0) AS held,
    COALESCE(cd.in_deal, 0) AS in_deal,
    COALESCE(cd.closed_won, 0) AS closed_won,
    COALESCE(cd.closed_lost, 0) AS closed_lost,
    COALESCE(cd.on_hold, 0) AS on_hold,
    COALESCE(cd.revenue, 0) AS revenue,
    -- Computed metrics
    CASE WHEN cs.spend > 0 AND cc.db_leads > 0
         THEN ROUND(cs.spend / cc.db_leads, 0)
         ELSE 0 END AS cpl,
    CASE WHEN cs.spend > 0 AND cd.closed_won > 0
         THEN ROUND(cs.spend / cd.closed_won, 0)
         ELSE 0 END AS cpo,
    CASE WHEN cs.spend > 0 AND cd.revenue > 0
         THEN ROUND(cd.revenue / cs.spend, 1)
         ELSE 0 END AS roas,
    -- Conversion rates
    CASE WHEN cc.db_leads > 0
         THEN ROUND((COALESCE(cd.booked, 0)::numeric / cc.db_leads) * 100, 1)
         ELSE 0 END AS lead_to_book_pct,
    CASE WHEN cd.booked > 0
         THEN ROUND((COALESCE(cd.held, 0)::numeric / cd.booked) * 100, 1)
         ELSE 0 END AS book_to_held_pct,
    CASE WHEN cd.held > 0
         THEN ROUND((COALESCE(cd.closed_won, 0)::numeric / cd.held) * 100, 1)
         ELSE 0 END AS held_to_close_pct,
    -- Verdict: WHERE does the chain break?
    CASE
        WHEN cs.spend IS NULL OR cs.spend = 0 THEN 'NO_SPEND'
        WHEN COALESCE(cd.revenue, 0) / NULLIF(cs.spend, 0) > 3 THEN 'SCALE'
        WHEN COALESCE(cc.db_leads, 0) < 3 THEN 'LOW_VOLUME'
        WHEN COALESCE(cd.booked, 0)::numeric / NULLIF(cc.db_leads, 0) < 0.15 THEN 'BAD_LEADS'
        WHEN COALESCE(cd.held, 0)::numeric / NULLIF(cd.booked, 0) < 0.5 THEN 'FIX_FOLLOWUP'
        WHEN COALESCE(cd.closed_won, 0)::numeric / NULLIF(cd.held, 0) < 0.15 THEN 'FIX_COACH'
        WHEN COALESCE(cd.revenue, 0) / NULLIF(cs.spend, 0) >= 1 THEN 'MONITOR'
        ELSE 'FIX_ROAS'
    END AS verdict
FROM campaign_spend cs
FULL OUTER JOIN campaign_contacts cc ON cs.campaign_name = cc.utm_campaign
LEFT JOIN campaign_deals cd ON COALESCE(cs.campaign_name, cc.utm_campaign) = cd.utm_campaign
WHERE COALESCE(cs.campaign_name, cc.utm_campaign) IS NOT NULL;


-- ── 3. cold_leads VIEW ──
-- Contacts created in last 7 days with no associated deal activity
-- Uses contact_id join (established pattern)

CREATE OR REPLACE VIEW public.cold_leads AS
SELECT
    c.id,
    c.email,
    c.first_name,
    c.last_name,
    c.phone,
    c.owner_name AS setter,
    c.utm_campaign AS source_campaign,
    c.location,
    c.city,
    c.lifecycle_stage,
    c.created_at,
    c.call_attempt_count,
    c.speed_to_lead_minutes,
    c.lead_status,
    EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 3600 AS hours_since_creation,
    CASE
        WHEN EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 3600 > 72 THEN 'CRITICAL'
        WHEN EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 3600 > 48 THEN 'URGENT'
        WHEN EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 3600 > 24 THEN 'WARNING'
        ELSE 'FRESH'
    END AS urgency
FROM public.contacts c
LEFT JOIN public.deals d ON d.contact_id = c.id
WHERE c.created_at >= NOW() - INTERVAL '7 days'
  AND d.id IS NULL
ORDER BY c.created_at ASC;


-- ── 4. upcoming_assessments VIEW ──
-- Contacts with assessment_date between today and +7 days
-- Joined with deals and latest health score for full context
-- Uses DISTINCT ON to prevent row multiplication from multiple deals/health records

CREATE OR REPLACE VIEW public.upcoming_assessments AS
SELECT DISTINCT ON (c.id)
    c.id AS contact_id,
    c.email,
    c.first_name,
    c.last_name,
    c.phone,
    c.assessment_date,
    c.assigned_coach AS coach,
    c.owner_name AS setter,
    c.utm_campaign AS source_campaign,
    c.location,
    c.city,
    d.stage AS deal_stage,
    d.deal_value,
    d.deal_name,
    CASE
        WHEN d.stage = '122237508' THEN 'Assessment Booked'
        WHEN d.stage = '122237276' THEN 'Assessment Completed'
        WHEN d.stage = '122221229' THEN 'Booking Process'
        WHEN d.stage = 'qualifiedtobuy' THEN 'Package Selected'
        WHEN d.stage = 'decisionmakerboughtin' THEN 'Decision Maker'
        WHEN d.stage = 'closedwon' THEN 'Closed Won'
        WHEN d.stage = '1063991961' THEN 'Closed Lost'
        ELSE COALESCE(d.stage, 'No Deal')
    END AS stage_label,
    EXTRACT(DAY FROM (c.assessment_date - CURRENT_DATE)) AS days_until,
    chs.health_score,
    chs.health_zone
FROM public.contacts c
LEFT JOIN public.deals d ON d.contact_id = c.id
LEFT JOIN LATERAL (
    SELECT health_score, health_zone
    FROM public.client_health_scores
    WHERE email = c.email
    ORDER BY calculated_at DESC NULLS LAST
    LIMIT 1
) chs ON true
WHERE c.assessment_date IS NOT NULL
  AND c.assessment_date >= CURRENT_DATE
  AND c.assessment_date <= CURRENT_DATE + INTERVAL '7 days'
ORDER BY c.id, c.assessment_date ASC;


-- ── 5. Grant access to views (authenticated only — no anon access to PII) ──

GRANT SELECT ON public.campaign_full_funnel TO authenticated;
GRANT SELECT ON public.cold_leads TO authenticated;
GRANT SELECT ON public.upcoming_assessments TO authenticated;
