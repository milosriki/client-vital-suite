-- ============================================
-- PTD HEALTH SCORE SYSTEM - RPC FUNCTIONS
-- ============================================

-- Drop existing RPC functions if they exist
DROP FUNCTION IF EXISTS get_zone_distribution(DATE);
DROP FUNCTION IF EXISTS get_overall_avg(DATE);
DROP FUNCTION IF EXISTS get_at_risk_clients(DATE);

-- ============================================
-- RPC FUNCTION: get_zone_distribution
-- Returns count of clients in each health zone for a specific date
-- ============================================
CREATE OR REPLACE FUNCTION get_zone_distribution(target_date DATE)
RETURNS TABLE(health_zone TEXT, count BIGINT) AS $$
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
$$ LANGUAGE plpgsql;

-- ============================================
-- RPC FUNCTION: get_overall_avg
-- Returns average health score for a specific date
-- ============================================
CREATE OR REPLACE FUNCTION get_overall_avg(target_date DATE)
RETURNS TABLE(avg_score NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    AVG(health_score)::NUMERIC(5,2) as avg_score
  FROM client_health_scores
  WHERE DATE(calculated_at) = target_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RPC FUNCTION: get_at_risk_clients
-- Returns all at-risk clients (RED/YELLOW zones) for a specific date
-- ============================================
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
) AS $$
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
$$ LANGUAGE plpgsql;

-- ============================================
-- Add at_risk_revenue column to daily_summary if it doesn't exist
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_summary' 
    AND column_name = 'at_risk_revenue'
  ) THEN
    ALTER TABLE daily_summary ADD COLUMN at_risk_revenue NUMERIC(10,2);
  END IF;
END $$;

-- ============================================
-- Add indexes for better performance (without DATE function)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_intervention_log_status ON intervention_log(status);