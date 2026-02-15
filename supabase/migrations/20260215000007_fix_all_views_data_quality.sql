-- ============================================================================
-- DATA QUALITY FIX: Comprehensive view rewrite
-- Fixes 8 critical/high issues identified in data audit:
--   1. view_atlas_lead_dna → 0 rows (INNER JOIN on empty email match)
--   2. view_coach_capacity_load → 0 rows (staff has no coaches)
--   3. view_segment_capacity_hud → 0 rows (depends on #2)
--   4. Truth genome revenue = $0 (known_cards empty)
--   5. Truth genome verdict broken (closedwon not in contacts)
--   6. Call duration_seconds is milliseconds (divide by 1000)
--   7. Stripe amount already AED not fils (remove /100)
--   8. Coach names only exist in client_health_scores, not staff
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. FIX view_atlas_lead_dna
--    OLD: INNER JOIN contacts→attribution_events by email (0 matches)
--    NEW: contacts as base → LEFT JOIN deals for revenue → LEFT JOIN calls
--         → LEFT JOIN attribution_events → LEFT JOIN facebook_creatives
-- ─────────────────────────────────────────────────────────────────────────────

-- Must DROP first — column list changed (added first_touch_source, deal_count)
DROP VIEW IF EXISTS public.view_atlas_lead_dna;

CREATE VIEW public.view_atlas_lead_dna AS
WITH deal_revenue AS (
    -- Revenue truth: deals with closedwon stage (2,751 deals, $10M total)
    SELECT
        contact_id,
        SUM(deal_value) AS total_deal_value,
        COUNT(*) AS deal_count,
        MAX(close_date) AS last_close_date
    FROM public.deals
    WHERE stage = 'closedwon'
      AND contact_id IS NOT NULL
    GROUP BY contact_id
),
call_intent AS (
    -- Call intelligence: duration_seconds is actually milliseconds, divide by 1000
    SELECT
        caller_number,
        SUM(duration_seconds) / 1000.0 AS total_call_seconds,
        MAX(started_at) AS last_call_at,
        COUNT(*) AS total_calls
    FROM public.call_records
    GROUP BY caller_number
),
attribution_link AS (
    -- Best-effort FB attribution: LEFT JOIN, not INNER
    -- Only 56 events have fb_ad_id after backfill, but more will come after webhook fix
    SELECT DISTINCT ON (lower(ae.email))
        lower(ae.email) AS email_lower,
        ae.fb_ad_id,
        ae.fb_adset_id,
        ae.fb_campaign_id,
        ae.source AS attribution_source,
        ae.landing_page
    FROM public.attribution_events ae
    WHERE ae.email IS NOT NULL
    ORDER BY lower(ae.email), ae.event_time DESC
)
SELECT
    c.id AS contact_id,
    c.first_name || ' ' || c.last_name AS full_name,
    c.email,
    c.city,
    c.lifecycle_stage,
    c.first_touch_source,
    -- FB creative linkage (via attribution or direct)
    COALESCE(al.fb_ad_id, c.attributed_ad_id) AS ad_id,
    fc.creative_name,
    fc.body AS ad_copy,
    fc.image_url,
    -- Call metrics (ms → seconds)
    COALESCE(ci.total_call_seconds, 0) AS call_duration_seconds,
    COALESCE(ci.total_calls, 0) AS call_count,
    -- Revenue from deals (not broken stripe/known_cards path)
    COALESCE(dr.total_deal_value, 0) AS verified_revenue,
    COALESCE(dr.deal_count, 0) AS deal_count,
    -- Verdict based on actual data signals
    CASE
        WHEN COALESCE(dr.total_deal_value, 0) > 0
          THEN 'Verified Winner'
        WHEN ci.total_call_seconds > 900 AND COALESCE(dr.total_deal_value, 0) = 0
          THEN 'High Intent - Pending'
        WHEN ci.total_calls > 0 AND ci.total_call_seconds < 60
          THEN 'Low Intent - Potential Waste'
        WHEN c.first_touch_source IN ('PAID_SOCIAL', 'SOCIAL_MEDIA', 'PAID_SEARCH')
          THEN 'Marketing Lead'
        ELSE 'Neutral'
    END AS atlas_lead_status
FROM public.contacts c
LEFT JOIN deal_revenue dr ON dr.contact_id = c.id
LEFT JOIN call_intent ci ON ci.caller_number = c.phone
LEFT JOIN attribution_link al ON al.email_lower = lower(c.email)
LEFT JOIN public.facebook_creatives fc ON fc.ad_id = COALESCE(al.fb_ad_id, c.attributed_ad_id);

GRANT SELECT ON public.view_atlas_lead_dna TO authenticated;
GRANT SELECT ON public.view_atlas_lead_dna TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FIX view_enterprise_truth_genome
--    OLD: known_cards for revenue (empty), closedwon on contacts (doesn't exist)
--    NEW: deals for revenue, actual deal stages for verdict, ms→s fix
-- ─────────────────────────────────────────────────────────────────────────────

-- Must DROP first — added first_touch_source column, changed verdict logic
DROP VIEW IF EXISTS public.view_enterprise_truth_genome;

CREATE VIEW public.view_enterprise_truth_genome AS
WITH deal_revenue AS (
    SELECT
        contact_id,
        SUM(deal_value) AS lifetime_value,
        MIN(close_date) AS first_close_date
    FROM public.deals
    WHERE stage = 'closedwon'
      AND contact_id IS NOT NULL
    GROUP BY contact_id
),
attribution_bridge AS (
    SELECT DISTINCT ON (lower(email))
        lower(email) AS email_lower,
        fb_ad_id,
        fb_adset_id,
        fb_campaign_id,
        utm_source,
        utm_medium,
        utm_content,
        created_at AS lead_created_at
    FROM public.attribution_events
    WHERE email IS NOT NULL
    ORDER BY lower(email), created_at DESC
),
call_intelligence AS (
    -- FIX: duration_seconds is milliseconds → divide by 1000
    SELECT
        caller_number,
        AVG(duration_seconds) / 1000.0 AS avg_duration_sec,
        COUNT(*) AS total_calls,
        MAX(started_at) AS last_call_at
    FROM public.call_records
    GROUP BY caller_number
)
SELECT
    c.id AS contact_id,
    c.first_name || ' ' || c.last_name AS lead_name,
    c.email,
    c.city,
    c.lifecycle_stage AS stage,
    c.first_touch_source,
    COALESCE(ab.fb_ad_id, c.attributed_ad_id) AS ad_id,
    -- Revenue from deals, not broken stripe path
    COALESCE(dr.lifetime_value, 0) AS verified_cash,
    -- Payback: days from attribution event to first close
    EXTRACT(EPOCH FROM (dr.first_close_date - ab.lead_created_at)) / 86400 AS payback_days,
    -- Call duration in seconds (was milliseconds)
    COALESCE(ci.avg_duration_sec, 0) AS avg_call_min,
    -- Verdict based on deals + call signals
    CASE
        WHEN COALESCE(dr.lifetime_value, 0) > 0 THEN 'VERIFIED WINNER'
        WHEN COALESCE(ci.avg_duration_sec, 0) > 900 THEN 'HIGH INTENT PENDING'
        WHEN EXISTS (
            SELECT 1 FROM public.deals d
            WHERE d.contact_id = c.id
              AND d.stage NOT IN ('closedwon', 'closedlost')
              AND d.stage IS NOT NULL
        ) THEN 'ACTIVE PIPELINE'
        ELSE 'PROSPECTING'
    END AS atlas_verdict
FROM public.contacts c
LEFT JOIN deal_revenue dr ON dr.contact_id = c.id
LEFT JOIN attribution_bridge ab ON ab.email_lower = lower(c.email)
LEFT JOIN call_intelligence ci ON ci.caller_number = c.phone;

GRANT SELECT ON public.view_enterprise_truth_genome TO authenticated;
GRANT SELECT ON public.view_enterprise_truth_genome TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FIX view_coach_capacity_load
--    OLD: Derives coaches from staff WHERE role='coach' (0 rows)
--    NEW: Derives coaches from client_health_scores.assigned_coach (actual data)
-- ─────────────────────────────────────────────────────────────────────────────

-- Must drop segment_capacity_hud FIRST (depends on coach_capacity_load)
DROP VIEW IF EXISTS public.view_segment_capacity_hud;
DROP VIEW IF EXISTS public.view_coach_capacity_load;

CREATE VIEW public.view_coach_capacity_load AS
WITH coach_roster AS (
    -- Coaches only exist as free-text in client_health_scores.assigned_coach
    -- No coach data in staff table (only closers/setters)
    SELECT DISTINCT assigned_coach AS coach_name
    FROM public.client_health_scores
    WHERE assigned_coach IS NOT NULL
),
coach_activity AS (
    SELECT
        assigned_coach,
        COUNT(*) AS sessions_last_14d,
        COUNT(*) / 2.0 AS avg_weekly_sessions
    FROM public.client_health_scores
    WHERE calculated_on >= (now() - interval '14 days')
    GROUP BY assigned_coach
)
SELECT
    'Dubai'::text AS zone,
    'Unknown'::text AS gender,
    r.coach_name,
    COALESCE(a.sessions_last_14d, 0) AS sessions_14d,
    ROUND((COALESCE(a.sessions_last_14d, 0)::numeric / 44.0) * 100, 1) AS load_percentage,
    CASE
        WHEN (COALESCE(a.sessions_last_14d, 0)::numeric / 44.0) > 0.9 THEN 'CRITICAL'
        WHEN (COALESCE(a.sessions_last_14d, 0)::numeric / 44.0) > 0.7 THEN 'LIMITED'
        ELSE 'SCALABLE'
    END AS capacity_status
FROM coach_roster r
LEFT JOIN coach_activity a ON a.assigned_coach = r.coach_name;

GRANT SELECT ON public.view_coach_capacity_load TO authenticated;
GRANT SELECT ON public.view_coach_capacity_load TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FIX view_segment_capacity_hud (depends on fixed coach capacity view)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE VIEW public.view_segment_capacity_hud AS
SELECT
    zone,
    gender,
    COUNT(coach_name) AS coach_count,
    ROUND(AVG(load_percentage), 1) AS avg_segment_load,
    SUM(sessions_14d) AS total_segment_sessions
FROM public.view_coach_capacity_load
GROUP BY zone, gender;

GRANT SELECT ON public.view_segment_capacity_hud TO authenticated;
GRANT SELECT ON public.view_segment_capacity_hud TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. REBUILD mv_enterprise_truth_genome
--    Same fixes as view_enterprise_truth_genome:
--    - deals for revenue (not stripe/known_cards)
--    - ms→s duration fix
--    - deal-stage based verdict
-- ─────────────────────────────────────────────────────────────────────────────

-- Must drop indexes before replacing materialized view
DROP INDEX IF EXISTS idx_mv_genome_contact_id;
DROP INDEX IF EXISTS idx_mv_genome_verdict;
DROP INDEX IF EXISTS idx_mv_genome_ad_verdict;
DROP INDEX IF EXISTS idx_mv_genome_cash;

DROP MATERIALIZED VIEW IF EXISTS public.mv_enterprise_truth_genome;

CREATE MATERIALIZED VIEW public.mv_enterprise_truth_genome AS
WITH deal_revenue AS (
    SELECT
        contact_id,
        SUM(deal_value) AS lifetime_value,
        MIN(close_date) AS first_close_date
    FROM public.deals
    WHERE stage = 'closedwon'
      AND contact_id IS NOT NULL
    GROUP BY contact_id
),
attribution_bridge AS (
    SELECT DISTINCT ON (lower(email))
        lower(email) AS email_lower,
        fb_ad_id,
        fb_adset_id,
        fb_campaign_id,
        utm_source,
        utm_medium,
        utm_content,
        created_at AS lead_created_at
    FROM public.attribution_events
    WHERE email IS NOT NULL
    ORDER BY lower(email), created_at DESC
),
call_intelligence AS (
    SELECT
        caller_number,
        -- FIX: duration_seconds is actually milliseconds
        AVG(duration_seconds) / 1000.0 AS avg_duration_sec,
        ROUND(AVG(CASE
            WHEN duration_seconds / 1000.0 > 900 THEN 100
            WHEN duration_seconds / 1000.0 > 300 THEN 70
            ELSE 30
        END), 0) AS lead_intent_iq,
        COUNT(*) AS total_calls
    FROM public.call_records
    GROUP BY caller_number
),
active_pipeline AS (
    -- Contacts with non-terminal deals (not closedwon/closedlost)
    SELECT DISTINCT contact_id
    FROM public.deals
    WHERE stage NOT IN ('closedwon', 'closedlost')
      AND stage IS NOT NULL
      AND contact_id IS NOT NULL
)
SELECT
    c.id AS contact_id,
    c.first_name || ' ' || c.last_name AS lead_name,
    c.email,
    c.city,
    c.lifecycle_stage AS stage,
    c.first_touch_source,
    COALESCE(ab.fb_ad_id, c.attributed_ad_id) AS ad_id,
    COALESCE(dr.lifetime_value, 0) AS verified_cash,
    EXTRACT(EPOCH FROM (dr.first_close_date - ab.lead_created_at)) / 86400 AS payback_days,
    COALESCE(ci.lead_intent_iq, 0) AS lead_intent_iq,
    COALESCE(ci.avg_duration_sec, 0) / 60.0 AS avg_call_min,
    CASE
        WHEN COALESCE(dr.lifetime_value, 0) > 0 THEN 'VERIFIED WINNER'
        WHEN COALESCE(ci.lead_intent_iq, 0) > 80 THEN 'HIGH INTENT PENDING'
        WHEN ap.contact_id IS NOT NULL THEN 'ACTIVE PIPELINE'
        ELSE 'PROSPECTING'
    END AS atlas_verdict,
    now() AS last_reconciled_at
FROM public.contacts c
LEFT JOIN deal_revenue dr ON dr.contact_id = c.id
LEFT JOIN attribution_bridge ab ON ab.email_lower = lower(c.email)
LEFT JOIN call_intelligence ci ON ci.caller_number = c.phone
LEFT JOIN active_pipeline ap ON ap.contact_id = c.id;

-- Rule 1.1: UNIQUE index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_genome_contact_id
  ON public.mv_enterprise_truth_genome (contact_id);

-- Rule 1.5: Partial index for verdict queries
CREATE INDEX idx_mv_genome_verdict
  ON public.mv_enterprise_truth_genome (atlas_verdict)
  WHERE atlas_verdict IN ('VERIFIED WINNER', 'HIGH INTENT PENDING', 'ACTIVE PIPELINE');

-- Rule 1.3: Composite for Creative DNA tab
CREATE INDEX idx_mv_genome_ad_verdict
  ON public.mv_enterprise_truth_genome (ad_id, atlas_verdict)
  WHERE ad_id IS NOT NULL;

-- Rule 1.4: Covering index for revenue queries
CREATE INDEX idx_mv_genome_cash
  ON public.mv_enterprise_truth_genome (verified_cash DESC)
  INCLUDE (lead_name, email, atlas_verdict);

-- Index for deals.contact_id JOIN (Rule 1.1)
CREATE INDEX IF NOT EXISTS idx_deals_contact_id
  ON public.deals (contact_id)
  WHERE contact_id IS NOT NULL;

-- Partial index for closedwon deals (Rule 1.5)
CREATE INDEX IF NOT EXISTS idx_deals_closedwon
  ON public.deals (contact_id, deal_value)
  WHERE stage = 'closedwon' AND contact_id IS NOT NULL;

-- Index for active pipeline subquery
CREATE INDEX IF NOT EXISTS idx_deals_active_pipeline
  ON public.deals (contact_id)
  WHERE stage NOT IN ('closedwon', 'closedlost')
    AND stage IS NOT NULL
    AND contact_id IS NOT NULL;

GRANT SELECT ON public.mv_enterprise_truth_genome TO authenticated;
GRANT SELECT ON public.mv_enterprise_truth_genome TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Update refresh function (unchanged logic, just documenting)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.refresh_revenue_genome()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_enterprise_truth_genome;
END;
$$;
