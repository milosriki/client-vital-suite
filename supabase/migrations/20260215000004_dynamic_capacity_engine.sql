-- Coach capacity + segment HUD
-- FIX: staff.full_name → name, coach_name → assigned_coach

CREATE OR REPLACE VIEW public.view_coach_capacity_load AS
WITH coach_activity AS (
    SELECT
        assigned_coach,
        COUNT(*) AS sessions_last_14d,
        COUNT(*) / 2.0 AS avg_weekly_sessions
    FROM public.client_health_scores
    WHERE calculated_on >= (now() - interval '14 days')
    GROUP BY assigned_coach
),
coach_segment_mapping AS (
    SELECT
        name AS coach_name,
        COALESCE(home_zone, 'Dubai') AS zone,
        gender
    FROM public.staff
    WHERE role = 'coach' AND status = 'active'
)
SELECT
    m.zone,
    m.gender,
    m.coach_name,
    COALESCE(a.sessions_last_14d, 0) AS sessions_14d,
    ROUND((COALESCE(a.sessions_last_14d, 0)::numeric / 44.0) * 100, 1) AS load_percentage,
    CASE
        WHEN (COALESCE(a.sessions_last_14d, 0)::numeric / 44.0) > 0.9 THEN 'CRITICAL'
        WHEN (COALESCE(a.sessions_last_14d, 0)::numeric / 44.0) > 0.7 THEN 'LIMITED'
        ELSE 'SCALABLE'
    END AS capacity_status
FROM coach_segment_mapping m
LEFT JOIN coach_activity a ON a.assigned_coach = m.coach_name;

CREATE OR REPLACE VIEW public.view_segment_capacity_hud AS
SELECT
    zone,
    gender,
    COUNT(coach_name) AS coach_count,
    ROUND(AVG(load_percentage), 1) AS avg_segment_load,
    SUM(sessions_14d) AS total_segment_sessions
FROM public.view_coach_capacity_load
GROUP BY zone, gender;

GRANT SELECT ON public.view_coach_capacity_load TO authenticated;
GRANT SELECT ON public.view_coach_capacity_load TO service_role;
GRANT SELECT ON public.view_segment_capacity_hud TO authenticated;
GRANT SELECT ON public.view_segment_capacity_hud TO service_role;

-- Rule 1.1: Index JOIN column
CREATE INDEX IF NOT EXISTS idx_health_scores_assigned_coach
  ON public.client_health_scores (assigned_coach)
  WHERE assigned_coach IS NOT NULL;

-- Rule 1.3: Composite for 14-day window filter
CREATE INDEX IF NOT EXISTS idx_health_scores_coach_calculated
  ON public.client_health_scores (assigned_coach, calculated_on DESC)
  WHERE assigned_coach IS NOT NULL;
