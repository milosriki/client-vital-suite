-- Enable RLS on all tables (safe to run multiple times - idempotent)
ALTER TABLE client_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summary ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Enable read access for all users" ON client_health_scores;
DROP POLICY IF EXISTS "Enable read access for all users" ON coach_performance;
DROP POLICY IF EXISTS "Enable read access for all users" ON intervention_log;
DROP POLICY IF EXISTS "Enable read access for all users" ON daily_summary;

-- Create public read policies for dashboard
CREATE POLICY "Enable read access for all users" 
ON client_health_scores FOR SELECT 
TO anon, authenticated 
USING (true);

CREATE POLICY "Enable read access for all users" 
ON coach_performance FOR SELECT 
TO anon, authenticated 
USING (true);

CREATE POLICY "Enable read access for all users" 
ON intervention_log FOR SELECT 
TO anon, authenticated 
USING (true);

CREATE POLICY "Enable read access for all users" 
ON daily_summary FOR SELECT 
TO anon, authenticated 
USING (true);