-- Enable Row Level Security on all tables
ALTER TABLE IF EXISTS client_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS coach_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS intervention_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_summary ENABLE ROW LEVEL SECURITY;

-- Create public read access policies
DROP POLICY IF EXISTS "Allow public read access" ON client_health_scores;
CREATE POLICY "Allow public read access" ON client_health_scores
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON coach_performance;
CREATE POLICY "Allow public read access" ON coach_performance
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON intervention_log;
CREATE POLICY "Allow public read access" ON intervention_log
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON daily_summary;
CREATE POLICY "Allow public read access" ON daily_summary
  FOR SELECT USING (true);
