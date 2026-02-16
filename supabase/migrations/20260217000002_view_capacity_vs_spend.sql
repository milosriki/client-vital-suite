-- View: Capacity vs Ad Spend by Segment
-- Purpose: Match coach capacity with current ad spend by zone/gender targeting
-- Flag segments at >85% capacity for PAUSE_ADS action
-- Part of PRD-INTELLIGENCE-95 Task 5

CREATE OR REPLACE VIEW public.view_capacity_vs_spend AS
WITH staff_segments AS (
    -- Get active coaches by zone and gender
    SELECT
        COALESCE(home_zone, 'Dubai') AS zone,
        COALESCE(gender, 'Unknown') AS gender,
        COUNT(*) AS coach_count
    FROM public.staff
    WHERE role = 'coach' AND status = 'active'
    GROUP BY home_zone, gender
),
active_clients_per_coach AS (
    -- Count active clients per coach from recent health scores
    SELECT
        assigned_coach,
        COUNT(DISTINCT COALESCE(contact_id, email)) AS active_client_count
    FROM public.client_health_scores
    WHERE calculated_on >= (NOW() - INTERVAL '30 days')
        AND assigned_coach IS NOT NULL
    GROUP BY assigned_coach
),
coach_capacity AS (
    -- Join staff with their active client counts
    SELECT
        s.home_zone AS zone,
        s.gender,
        s.name AS coach_name,
        COALESCE(a.active_client_count, 0) AS active_clients,
        22 AS max_capacity_per_coach  -- Industry standard: ~22 active 1:1 clients per coach
    FROM public.staff s
    LEFT JOIN active_clients_per_coach a ON a.assigned_coach = s.name
    WHERE s.role = 'coach' AND s.status = 'active'
),
segment_capacity AS (
    -- Aggregate capacity metrics by segment
    SELECT
        COALESCE(zone, 'Dubai') AS zone,
        COALESCE(gender, 'Unknown') AS gender,
        COUNT(*) AS coach_count,
        SUM(active_clients) AS total_active_clients,
        SUM(max_capacity_per_coach) AS total_max_capacity,
        ROUND(
            (SUM(active_clients)::NUMERIC / NULLIF(SUM(max_capacity_per_coach), 0)) * 100,
            1
        ) AS capacity_pct
    FROM coach_capacity
    GROUP BY zone, gender
),
ad_spend_by_targeting AS (
    -- Extract zone and gender from campaign/adset names
    -- Assumes naming convention includes zone and gender keywords
    -- e.g., "Dubai-Male-25-35", "London-Female-Starter", etc.
    SELECT
        CASE
            WHEN LOWER(campaign_name) LIKE '%dubai%' OR LOWER(adset_name) LIKE '%dubai%' THEN 'Dubai'
            WHEN LOWER(campaign_name) LIKE '%london%' OR LOWER(adset_name) LIKE '%london%' THEN 'London'
            WHEN LOWER(campaign_name) LIKE '%abu dhabi%' OR LOWER(adset_name) LIKE '%abu dhabi%' THEN 'Abu Dhabi'
            WHEN LOWER(campaign_name) LIKE '%sharjah%' OR LOWER(adset_name) LIKE '%sharjah%' THEN 'Sharjah'
            ELSE 'Dubai'  -- Default to Dubai if no zone detected
        END AS zone,
        CASE
            WHEN LOWER(campaign_name) LIKE '%male%' OR LOWER(adset_name) LIKE '%male%' THEN 'Male'
            WHEN LOWER(campaign_name) LIKE '%female%' OR LOWER(adset_name) LIKE '%female%' THEN 'Female'
            ELSE 'Unknown'
        END AS gender,
        SUM(spend) AS total_spend_last_7d,
        COUNT(DISTINCT campaign_id) AS active_campaign_count
    FROM public.facebook_ads_insights
    WHERE date >= (CURRENT_DATE - INTERVAL '7 days')
    GROUP BY zone, gender
)
SELECT
    sc.zone,
    sc.gender,
    sc.coach_count,
    sc.total_active_clients,
    sc.total_max_capacity,
    sc.capacity_pct,
    COALESCE(ads.total_spend_last_7d, 0) AS ad_spend_last_7d,
    COALESCE(ads.active_campaign_count, 0) AS active_campaigns,

    -- Capacity status flags
    CASE
        WHEN sc.capacity_pct >= 95 THEN 'CRITICAL_FULL'
        WHEN sc.capacity_pct >= 85 THEN 'PAUSE_ADS'
        WHEN sc.capacity_pct >= 70 THEN 'SCALE_CAREFULLY'
        ELSE 'SCALE_FREELY'
    END AS capacity_status,

    -- Action recommendations
    CASE
        WHEN sc.capacity_pct >= 85 AND COALESCE(ads.total_spend_last_7d, 0) > 0 THEN
            'IMMEDIATE: Pause ads for ' || sc.zone || '-' || sc.gender || ' segment'
        WHEN sc.capacity_pct >= 70 AND COALESCE(ads.total_spend_last_7d, 0) > 100 THEN
            'WARNING: Monitor ' || sc.zone || '-' || sc.gender || ' capacity closely'
        WHEN sc.capacity_pct < 50 AND COALESCE(ads.total_spend_last_7d, 0) < 50 THEN
            'OPPORTUNITY: Scale ' || sc.zone || '-' || sc.gender || ' ads'
        ELSE NULL
    END AS recommended_action,

    -- Calculate clients per coach average
    ROUND(sc.total_active_clients::NUMERIC / NULLIF(sc.coach_count, 0), 1) AS avg_clients_per_coach,

    -- Metadata
    NOW() AS calculated_at

FROM segment_capacity sc
LEFT JOIN ad_spend_by_targeting ads
    ON sc.zone = ads.zone
    AND sc.gender = ads.gender

ORDER BY sc.capacity_pct DESC, ads.total_spend_last_7d DESC;

-- Add descriptive comment
COMMENT ON VIEW public.view_capacity_vs_spend IS
'Intelligence view matching coach capacity with ad spend by zone/gender segment.
Flags segments at >85% capacity for ad pause. Powers capacity-aware ad scaling decisions.
Part of PRD-INTELLIGENCE-95 attribution brain.';

-- Grant permissions
GRANT SELECT ON public.view_capacity_vs_spend TO authenticated;
GRANT SELECT ON public.view_capacity_vs_spend TO service_role;
GRANT SELECT ON public.view_capacity_vs_spend TO anon;
