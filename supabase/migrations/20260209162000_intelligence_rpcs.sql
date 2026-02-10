-- Migration for Intelligence Service RPCs

-- 1. Analyze Coach Retention
-- Calculates retention rate based on clients active > 60 days
CREATE OR REPLACE FUNCTION analyze_coach_retention(lookback_months int DEFAULT 6)
RETURNS TABLE (
  coach text,
  total_clients bigint,
  long_term_clients bigint,
  retention_rate text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH coach_stats AS (
    SELECT
      COALESCE(assigned_coach, 'Unassigned') as coach_name,
      COUNT(*) as total,
      COUNT(*) FILTER (
        WHERE (EXTRACT(EPOCH FROM (NOW() - COALESCE(closedate, created_at))) / 86400) > 60
      ) as long_term
    FROM deals
    WHERE deal_stage = 'closedwon'
      AND created_at > (NOW() - (lookback_months || ' months')::INTERVAL)
    GROUP BY assigned_coach
  )
  SELECT
    coach_name,
    total,
    long_term,
    (ROUND((long_term::numeric / NULLIF(total, 0)) * 100) || '%')::text as rate
  FROM coach_stats
  ORDER BY (long_term::numeric / NULLIF(total, 0)) DESC NULLS LAST;
END;
$$;

-- 2. Analyze Goal Conversion
-- Calculates conversion from Lead to Customer by Fitness Goal
CREATE OR REPLACE FUNCTION analyze_goal_conversion()
RETURNS TABLE (
  goal text,
  leads bigint,
  customers bigint,
  conversion_rate text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH goal_stats AS (
    SELECT
      LOWER(TRIM(fitness_goal)) as goal_name,
      COUNT(*) as total_leads,
      COUNT(*) FILTER (WHERE lifecyclestage = 'customer') as total_customers
    FROM contacts
    WHERE fitness_goal IS NOT NULL
    GROUP BY LOWER(TRIM(fitness_goal))
  )
  SELECT
    goal_name,
    total_leads,
    total_customers,
    (ROUND((total_customers::numeric / NULLIF(total_leads, 0)) * 100) || '%')::text as rate
  FROM goal_stats
  WHERE total_leads > 5 -- Ignore statistically insignificant goals
  ORDER BY (total_customers::numeric / NULLIF(total_leads, 0)) DESC NULLS LAST
  LIMIT 5;
END;
$$;
