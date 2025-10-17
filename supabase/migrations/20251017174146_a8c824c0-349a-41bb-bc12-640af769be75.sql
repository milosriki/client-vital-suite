-- Fix security warnings by setting search_path on all RPC functions

-- Drop and recreate get_zone_distribution with secure search_path
DROP FUNCTION IF EXISTS get_zone_distribution(DATE);
CREATE OR REPLACE FUNCTION get_zone_distribution(target_date DATE)
RETURNS TABLE(health_zone TEXT, count BIGINT) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    chs.health_zone,
    COUNT(*)::BIGINT as count
  FROM client_health_scores chs
  WHERE DATE(chs.calculated_at) = target_date
  GROUP BY chs.health_zone
  ORDER BY chs.health_zone;
END;
$$;

-- Drop and recreate get_overall_avg with secure search_path
DROP FUNCTION IF EXISTS get_overall_avg(DATE);
CREATE OR REPLACE FUNCTION get_overall_avg(target_date DATE)
RETURNS TABLE(avg_score NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    AVG(health_score)::NUMERIC(5,2) as avg_score
  FROM client_health_scores
  WHERE DATE(calculated_at) = target_date;
END;
$$;

-- Drop and recreate get_at_risk_clients with secure search_path
DROP FUNCTION IF EXISTS get_at_risk_clients(DATE);
CREATE OR REPLACE FUNCTION get_at_risk_clients(target_date DATE)
RETURNS TABLE(
    id BIGINT,
    email TEXT,
    client_name TEXT,
    health_score NUMERIC,
    health_zone TEXT,
    assigned_coach TEXT,
    days_since_last_session INTEGER,
    churn_risk_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    chs.id,
    chs.email,
    COALESCE(chs.firstname || ' ' || chs.lastname, chs.email) as client_name,
    chs.health_score,
    chs.health_zone,
    chs.assigned_coach,
    chs.days_since_last_session,
    chs.churn_risk_score
  FROM client_health_scores chs
  WHERE DATE(chs.calculated_at) = target_date
    AND chs.health_zone IN ('RED', 'YELLOW')
  ORDER BY chs.health_score ASC;
END;
$$;