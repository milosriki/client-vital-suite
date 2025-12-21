-- ULTIMATE SELF-CODING AI & PTD SUPERINTELLIGENCE SCHEMA

-- 1. PREPARED ACTIONS (Approval Queue)
CREATE TABLE IF NOT EXISTS prepared_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL CHECK (action_type IN ('code_deploy', 'intervention', 'workflow', 'database', 'analysis', 'email', 'alert')),
  action_title TEXT NOT NULL,
  action_description TEXT,
  reasoning TEXT,
  expected_impact TEXT,
  risk_level TEXT DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  confidence FLOAT DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  prepared_payload JSONB NOT NULL DEFAULT '{}',
  supporting_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'prepared' CHECK (status IN ('prepared', 'approved', 'rejected', 'executing', 'executed', 'failed', 'expired')),
  target_email TEXT,
  target_coach TEXT,
  priority INT DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  source_agent TEXT DEFAULT 'user_request',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours'),
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  executed_at TIMESTAMPTZ,
  rejection_reason TEXT
);

-- 2. BUSINESS CALIBRATION (Learning from CEO)
CREATE TABLE IF NOT EXISTS business_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_type TEXT NOT NULL,
  scenario_description TEXT,
  ai_recommendation TEXT,
  ai_reasoning TEXT,
  ai_confidence FLOAT,
  your_decision TEXT,
  your_reasoning TEXT,
  was_ai_correct BOOLEAN,
  learning_weight INT DEFAULT 3 CHECK (learning_weight >= 1 AND learning_weight <= 5),
  action_id UUID REFERENCES prepared_actions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. LEARNED PATTERNS
CREATE TABLE IF NOT EXISTS learned_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL,
  pattern_description TEXT NOT NULL,
  recommended_action TEXT,
  times_applied INT DEFAULT 0,
  times_validated INT DEFAULT 0,
  times_invalidated INT DEFAULT 0,
  confidence FLOAT DEFAULT 0.5,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_applied_at TIMESTAMPTZ
);

-- 4. BUSINESS GOALS
CREATE TABLE IF NOT EXISTS business_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_name TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  baseline_value FLOAT NOT NULL,
  current_value FLOAT NOT NULL,
  target_value FLOAT NOT NULL,
  deadline DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'failed', 'paused')),
  constraints JSONB DEFAULT '{}',
  progress_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PROACTIVE INSIGHTS
CREATE TABLE IF NOT EXISTS proactive_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  data JSONB DEFAULT '{}',
  source_agent TEXT DEFAULT 'proactive_scanner',
  is_dismissed BOOLEAN DEFAULT FALSE,
  actioned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_prepared_actions_status ON prepared_actions(status);
CREATE INDEX IF NOT EXISTS idx_prepared_actions_risk ON prepared_actions(risk_level);
CREATE INDEX IF NOT EXISTS idx_calibration_type ON business_calibration(scenario_type);
CREATE INDEX IF NOT EXISTS idx_goals_status ON business_goals(status);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON learned_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_insights_priority ON proactive_insights(priority);

-- HELPER FUNCTION: Get calibration examples
CREATE OR REPLACE FUNCTION get_calibration_examples(
  scenario_type_filter TEXT DEFAULT NULL,
  limit_count INT DEFAULT 5
)
RETURNS TABLE(scenario TEXT, ai_said TEXT, you_said TEXT, was_correct BOOLEAN, weight INT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bc.scenario_description,
    bc.ai_recommendation,
    bc.your_decision,
    bc.was_ai_correct,
    bc.learning_weight
  FROM business_calibration bc
  WHERE (scenario_type_filter IS NULL OR bc.scenario_type = scenario_type_filter)
  ORDER BY bc.learning_weight DESC, bc.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- HELPER FUNCTION: Get pending summary
CREATE OR REPLACE FUNCTION get_pending_actions_summary()
RETURNS TABLE(total_pending BIGINT, critical_count BIGINT, high_count BIGINT, auto_approvable BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_pending,
    COUNT(*) FILTER (WHERE risk_level = 'critical') as critical_count,
    COUNT(*) FILTER (WHERE risk_level = 'high') as high_count,
    COUNT(*) FILTER (WHERE risk_level = 'low' AND confidence > 0.85) as auto_approvable
  FROM prepared_actions
  WHERE status = 'prepared';
END;
$$ LANGUAGE plpgsql;

-- HELPER FUNCTION: Expire old actions
CREATE OR REPLACE FUNCTION expire_old_prepared_actions()
RETURNS void AS $$
BEGIN
  UPDATE prepared_actions
  SET status = 'expired'
  WHERE status = 'prepared'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- RLS POLICIES
ALTER TABLE prepared_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_calibration ENABLE ROW LEVEL SECURITY;
ALTER TABLE learned_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proactive_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access pa" ON prepared_actions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access bc" ON business_calibration FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access lp" ON learned_patterns FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access bg" ON business_goals FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access pi" ON proactive_insights FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Auth read pa" ON prepared_actions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth read bg" ON business_goals FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth read pi" ON proactive_insights FOR SELECT USING (auth.role() = 'authenticated');

-- SEED GOALS
INSERT INTO business_goals (goal_name, metric_name, baseline_value, current_value, target_value, deadline, constraints) VALUES
('Reduce Churn', 'monthly_churn_rate', 8.5, 8.5, 5.0, CURRENT_DATE + INTERVAL '90 days', '{"max_discount": 20}'),
('Increase MRR', 'mrr', 450000, 450000, 550000, CURRENT_DATE + INTERVAL '90 days', '{}'),
('Lead Conversion', 'conversion_rate', 12.0, 12.0, 18.0, CURRENT_DATE + INTERVAL '60 days', '{}')
ON CONFLICT DO NOTHING;
