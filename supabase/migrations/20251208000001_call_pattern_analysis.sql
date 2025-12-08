-- ============================================
-- CALL PATTERN ANALYSIS SYSTEM
-- Tracks client call frequency and detects pattern breaks
-- ============================================

-- Add pattern tracking columns to client_health_scores
ALTER TABLE client_health_scores
ADD COLUMN IF NOT EXISTS avg_calls_per_week NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS calls_this_week INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_pattern_check TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pattern_status TEXT DEFAULT 'NORMAL';

-- Create call_pattern_analysis table
CREATE TABLE IF NOT EXISTS call_pattern_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  analysis_date DATE NOT NULL,
  calls_this_week INTEGER DEFAULT 0,
  avg_calls_per_week NUMERIC DEFAULT 0,
  pattern_status TEXT DEFAULT 'NORMAL', -- NORMAL, BELOW_PATTERN, ABOVE_PATTERN, PATTERN_BREAK
  deviation_pct NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pattern_client ON call_pattern_analysis(client_email);
CREATE INDEX IF NOT EXISTS idx_pattern_date ON call_pattern_analysis(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_status ON call_pattern_analysis(pattern_status);
CREATE INDEX IF NOT EXISTS idx_client_pattern_status ON client_health_scores(pattern_status) WHERE pattern_status IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE call_pattern_analysis ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read access" ON call_pattern_analysis
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON call_pattern_analysis
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON call_pattern_analysis
  FOR UPDATE USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_call_pattern_analysis_updated_at
  BEFORE UPDATE ON call_pattern_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create helper function to get week start date
CREATE OR REPLACE FUNCTION get_week_start(target_date TIMESTAMPTZ DEFAULT NOW())
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN DATE_TRUNC('week', target_date);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create RPC function to get pattern breaks
CREATE OR REPLACE FUNCTION get_pattern_breaks(days_back INTEGER DEFAULT 7)
RETURNS TABLE(
  client_email TEXT,
  client_name TEXT,
  avg_calls_per_week NUMERIC,
  calls_this_week INTEGER,
  deviation_pct NUMERIC,
  pattern_status TEXT,
  health_zone TEXT,
  assigned_coach TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    chs.email,
    COALESCE(chs.firstname || ' ' || chs.lastname, chs.email) as client_name,
    chs.avg_calls_per_week,
    chs.calls_this_week,
    CASE
      WHEN chs.avg_calls_per_week > 0
      THEN ((chs.calls_this_week - chs.avg_calls_per_week) / chs.avg_calls_per_week) * 100
      ELSE 0
    END as deviation_pct,
    chs.pattern_status,
    chs.health_zone,
    chs.assigned_coach
  FROM client_health_scores chs
  WHERE chs.pattern_status IN ('PATTERN_BREAK', 'BELOW_PATTERN')
    AND chs.last_pattern_check >= NOW() - (days_back || ' days')::INTERVAL
  ORDER BY
    CASE chs.pattern_status
      WHEN 'PATTERN_BREAK' THEN 1
      WHEN 'BELOW_PATTERN' THEN 2
      ELSE 3
    END,
    (CASE
      WHEN chs.avg_calls_per_week > 0
      THEN ((chs.calls_this_week - chs.avg_calls_per_week) / chs.avg_calls_per_week) * 100
      ELSE 0
    END) ASC;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE call_pattern_analysis IS 'Tracks historical call frequency patterns and deviations for each client';
COMMENT ON COLUMN client_health_scores.avg_calls_per_week IS 'Average calls per week over the last 30 days';
COMMENT ON COLUMN client_health_scores.calls_this_week IS 'Number of calls this week (Monday-Sunday)';
COMMENT ON COLUMN client_health_scores.pattern_status IS 'Call frequency pattern status: NORMAL, BELOW_PATTERN, ABOVE_PATTERN, PATTERN_BREAK';
COMMENT ON COLUMN client_health_scores.last_pattern_check IS 'Timestamp of the last pattern analysis';
