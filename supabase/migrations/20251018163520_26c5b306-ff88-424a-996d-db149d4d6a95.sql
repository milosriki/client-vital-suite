-- ENABLE ROW LEVEL SECURITY ON NEW TABLES
ALTER TABLE client_lifecycle_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

-- ENABLE RLS ON EXISTING TABLES THAT DON'T HAVE IT
ALTER TABLE client_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summary ENABLE ROW LEVEL SECURITY;

-- CREATE PUBLIC ACCESS POLICIES (since this is a backend analytics system)
-- Client Lifecycle History
CREATE POLICY "Allow public read access" ON client_lifecycle_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON client_lifecycle_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON client_lifecycle_history FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON client_lifecycle_history FOR DELETE USING (true);

-- Churn Patterns
CREATE POLICY "Allow public read access" ON churn_patterns FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON churn_patterns FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON churn_patterns FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON churn_patterns FOR DELETE USING (true);

-- Intervention Outcomes
CREATE POLICY "Allow public read access" ON intervention_outcomes FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON intervention_outcomes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON intervention_outcomes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON intervention_outcomes FOR DELETE USING (true);

-- AI Insights
CREATE POLICY "Allow public read access" ON ai_insights FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON ai_insights FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON ai_insights FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON ai_insights FOR DELETE USING (true);

-- Client Health Scores
CREATE POLICY "Allow public read access" ON client_health_scores FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON client_health_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON client_health_scores FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON client_health_scores FOR DELETE USING (true);

-- Coach Performance
CREATE POLICY "Allow public read access" ON coach_performance FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON coach_performance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON coach_performance FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON coach_performance FOR DELETE USING (true);

-- Intervention Log
CREATE POLICY "Allow public read access" ON intervention_log FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON intervention_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON intervention_log FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON intervention_log FOR DELETE USING (true);

-- Daily Summary
CREATE POLICY "Allow public read access" ON daily_summary FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON daily_summary FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON daily_summary FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON daily_summary FOR DELETE USING (true);