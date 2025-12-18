-- ENABLE ROW LEVEL SECURITY ON NEW TABLES
ALTER TABLE IF EXISTS client_lifecycle_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS churn_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS intervention_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_insights ENABLE ROW LEVEL SECURITY;

-- ENABLE RLS ON EXISTING TABLES THAT DON'T HAVE IT
ALTER TABLE IF EXISTS client_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS coach_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS intervention_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_summary ENABLE ROW LEVEL SECURITY;

-- CREATE PUBLIC ACCESS POLICIES (since this is a backend analytics system)
-- Client Lifecycle History
DROP POLICY IF EXISTS "Allow public read access" ON client_lifecycle_history;
CREATE POLICY "Allow public read access" ON client_lifecycle_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert access" ON client_lifecycle_history;
CREATE POLICY "Allow public insert access" ON client_lifecycle_history FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update access" ON client_lifecycle_history;
CREATE POLICY "Allow public update access" ON client_lifecycle_history FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete access" ON client_lifecycle_history;
CREATE POLICY "Allow public delete access" ON client_lifecycle_history FOR DELETE USING (true);

-- Churn Patterns
DROP POLICY IF EXISTS "Allow public read access" ON churn_patterns;
CREATE POLICY "Allow public read access" ON churn_patterns FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert access" ON churn_patterns;
CREATE POLICY "Allow public insert access" ON churn_patterns FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update access" ON churn_patterns;
CREATE POLICY "Allow public update access" ON churn_patterns FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete access" ON churn_patterns;
CREATE POLICY "Allow public delete access" ON churn_patterns FOR DELETE USING (true);

-- Intervention Outcomes
DROP POLICY IF EXISTS "Allow public read access" ON intervention_outcomes;
CREATE POLICY "Allow public read access" ON intervention_outcomes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert access" ON intervention_outcomes;
CREATE POLICY "Allow public insert access" ON intervention_outcomes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update access" ON intervention_outcomes;
CREATE POLICY "Allow public update access" ON intervention_outcomes FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete access" ON intervention_outcomes;
CREATE POLICY "Allow public delete access" ON intervention_outcomes FOR DELETE USING (true);

-- AI Insights
DROP POLICY IF EXISTS "Allow public read access" ON ai_insights;
CREATE POLICY "Allow public read access" ON ai_insights FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert access" ON ai_insights;
CREATE POLICY "Allow public insert access" ON ai_insights FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update access" ON ai_insights;
CREATE POLICY "Allow public update access" ON ai_insights FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete access" ON ai_insights;
CREATE POLICY "Allow public delete access" ON ai_insights FOR DELETE USING (true);

-- Client Health Scores
DROP POLICY IF EXISTS "Allow public read access" ON client_health_scores;
CREATE POLICY "Allow public read access" ON client_health_scores FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert access" ON client_health_scores;
CREATE POLICY "Allow public insert access" ON client_health_scores FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update access" ON client_health_scores;
CREATE POLICY "Allow public update access" ON client_health_scores FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete access" ON client_health_scores;
CREATE POLICY "Allow public delete access" ON client_health_scores FOR DELETE USING (true);

-- Coach Performance
DROP POLICY IF EXISTS "Allow public read access" ON coach_performance;
CREATE POLICY "Allow public read access" ON coach_performance FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert access" ON coach_performance;
CREATE POLICY "Allow public insert access" ON coach_performance FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update access" ON coach_performance;
CREATE POLICY "Allow public update access" ON coach_performance FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete access" ON coach_performance;
CREATE POLICY "Allow public delete access" ON coach_performance FOR DELETE USING (true);

-- Intervention Log
DROP POLICY IF EXISTS "Allow public read access" ON intervention_log;
CREATE POLICY "Allow public read access" ON intervention_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert access" ON intervention_log;
CREATE POLICY "Allow public insert access" ON intervention_log FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update access" ON intervention_log;
CREATE POLICY "Allow public update access" ON intervention_log FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete access" ON intervention_log;
CREATE POLICY "Allow public delete access" ON intervention_log FOR DELETE USING (true);

-- Daily Summary
DROP POLICY IF EXISTS "Allow public read access" ON daily_summary;
CREATE POLICY "Allow public read access" ON daily_summary FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert access" ON daily_summary;
CREATE POLICY "Allow public insert access" ON daily_summary FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update access" ON daily_summary;
CREATE POLICY "Allow public update access" ON daily_summary FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete access" ON daily_summary;
CREATE POLICY "Allow public delete access" ON daily_summary FOR DELETE USING (true);
