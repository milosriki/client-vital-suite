-- Enable Row Level Security on all tables
ALTER TABLE client_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summary ENABLE ROW LEVEL SECURITY;

-- Create public read access policies
CREATE POLICY "Allow public read access" ON client_health_scores
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access" ON coach_performance
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access" ON intervention_log
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access" ON daily_summary
  FOR SELECT USING (true);