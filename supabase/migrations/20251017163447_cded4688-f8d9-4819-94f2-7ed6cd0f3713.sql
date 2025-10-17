-- Enable full public access for n8n to write data
-- This allows n8n workflows to insert, update, and delete records

-- client_health_scores policies
CREATE POLICY "Allow public insert access" ON client_health_scores
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON client_health_scores
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON client_health_scores
  FOR DELETE USING (true);

-- coach_performance policies
CREATE POLICY "Allow public insert access" ON coach_performance
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON coach_performance
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON coach_performance
  FOR DELETE USING (true);

-- intervention_log policies
CREATE POLICY "Allow public insert access" ON intervention_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON intervention_log
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON intervention_log
  FOR DELETE USING (true);

-- daily_summary policies
CREATE POLICY "Allow public insert access" ON daily_summary
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON daily_summary
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON daily_summary
  FOR DELETE USING (true);

-- weekly_patterns policies
CREATE POLICY "Allow public insert access" ON weekly_patterns
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON weekly_patterns
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON weekly_patterns
  FOR DELETE USING (true);