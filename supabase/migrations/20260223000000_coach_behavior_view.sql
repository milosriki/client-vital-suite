-- ==============================================================================
-- VIEW: Coach Behavior Scorecard (The Pulse)
-- Purpose: Compare Scheduled Sessions (AWS) vs Actual GPS Visits (TinyMDM)
-- Metric: Truth Score (0-100%)
-- ==============================================================================

DROP VIEW IF EXISTS view_coach_behavior_scorecard;

CREATE VIEW view_coach_behavior_scorecard AS
WITH session_stats AS (
    -- 1. Get Scheduled Sessions (from AWS)
    SELECT
        coach_name,
        COUNT(*) as sessions_scheduled,
        SUM(CASE WHEN session_status = 'Completed' THEN 1 ELSE 0 END) as sessions_claimed,
        AVG(EXTRACT(EPOCH FROM (session_end - session_start))/60)::INT as avg_scheduled_duration
    FROM training_sessions_live
    WHERE session_date >= NOW() - INTERVAL '30 days'
    GROUP BY coach_name
),
gps_stats AS (
    -- 2. Get Actual GPS Visits (from TinyMDM)
    SELECT
        coach_name,
        COUNT(*) as gps_visits_detected,
        AVG(dwell_minutes)::INT as avg_actual_dwell,
        SUM(CASE WHEN is_ptd_location THEN 1 ELSE 0 END) as ptd_gym_visits,
        SUM(CASE WHEN NOT is_ptd_location THEN 1 ELSE 0 END) as client_home_visits
    FROM coach_visits
    WHERE arrival_time >= NOW() - INTERVAL '30 days'
    GROUP BY coach_name
),
notes_stats AS (
    -- 3. Get Team Leader Context (Notes)
    SELECT
        entity_name as coach_name,
        COUNT(*) as total_notes,
        SUM(CASE WHEN note_type = 'concern' THEN 1 ELSE 0 END) as concerns_flagged,
        SUM(CASE WHEN note_type = 'positive' THEN 1 ELSE 0 END) as kudos_received
    FROM coach_client_notes
    WHERE entity_type = 'coach'
    AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY entity_name
)
SELECT
    s.coach_name,
    -- Reliability Metrics
    s.sessions_scheduled,
    s.sessions_claimed,
    COALESCE(g.gps_visits_detected, 0) as gps_verified_visits,
    
    -- The "Truth Gap" (Claimed vs Verified)
    CASE 
        WHEN s.sessions_claimed = 0 THEN 100 
        ELSE ROUND((COALESCE(g.gps_visits_detected, 0)::NUMERIC / s.sessions_claimed::NUMERIC) * 100, 1)
    END as verification_rate,

    -- Dwell Compliance (Did they stay?)
    s.avg_scheduled_duration as scheduled_min,
    COALESCE(g.avg_actual_dwell, 0) as actual_min,
    (COALESCE(g.avg_actual_dwell, 0) - s.avg_scheduled_duration) as dwell_gap_min,

    -- Context
    COALESCE(n.concerns_flagged, 0) as concerns,
    COALESCE(n.kudos_received, 0) as kudos,

    -- AI Scoring (Simple Heuristic for now)
    CASE
        WHEN (COALESCE(g.gps_visits_detected, 0)::NUMERIC / NULLIF(s.sessions_claimed, 0)) < 0.5 THEN 'Critical'
        WHEN (COALESCE(g.gps_visits_detected, 0)::NUMERIC / NULLIF(s.sessions_claimed, 0)) < 0.8 THEN 'Review'
        ELSE 'Good'
    END as behavior_status

FROM session_stats s
LEFT JOIN gps_stats g ON s.coach_name = g.coach_name
LEFT JOIN notes_stats n ON s.coach_name = n.coach_name;

-- Grant access
GRANT SELECT ON view_coach_behavior_scorecard TO authenticated;
GRANT SELECT ON view_coach_behavior_scorecard TO service_role;
