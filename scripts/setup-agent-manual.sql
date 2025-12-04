-- ============================================
-- PTD SMART AGENT SYSTEM - MANUAL SETUP
-- ============================================
-- Run this in Supabase SQL Editor if you can't use the CLI
-- This combines both migration files into one script

-- ============================================
-- PART 1: CREATE TABLES
-- ============================================

-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. KNOWLEDGE BASE (RAG Storage)
CREATE TABLE IF NOT EXISTS agent_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  subcategory TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  structured_data JSONB DEFAULT '{}',
  embedding VECTOR(1536),
  source TEXT,
  confidence FLOAT DEFAULT 1.0,
  usage_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON agent_knowledge(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_knowledge_active ON agent_knowledge(is_active);

-- 2. CONVERSATION MEMORY
CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  agent_type TEXT DEFAULT 'analyst',
  context JSONB DEFAULT '{}',
  tokens_used INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_session ON agent_conversations(session_id, created_at DESC);

-- 3. AGENT DECISIONS (Learning Loop)
CREATE TABLE IF NOT EXISTS agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  input_context JSONB NOT NULL,
  decision JSONB NOT NULL,
  reasoning TEXT,
  confidence FLOAT,
  client_email TEXT,
  coach_name TEXT,
  outcome TEXT CHECK (outcome IN ('pending', 'successful', 'partially_successful', 'failed', 'unknown')),
  outcome_notes TEXT,
  outcome_metrics JSONB DEFAULT '{}',
  outcome_recorded_at TIMESTAMPTZ,
  outcome_recorded_by TEXT,
  was_helpful BOOLEAN,
  feedback_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_type ON agent_decisions(decision_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_outcome ON agent_decisions(outcome);

-- 4. PROACTIVE INSIGHTS QUEUE
CREATE TABLE IF NOT EXISTS proactive_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  action_items JSONB DEFAULT '[]',
  suggested_response TEXT,
  affected_entities JSONB DEFAULT '{}',
  source_agent TEXT,
  source_data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  is_actioned BOOLEAN DEFAULT FALSE,
  actioned_at TIMESTAMPTZ,
  actioned_by TEXT,
  action_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  dedup_key TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_insights_active ON proactive_insights(is_dismissed, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_priority ON proactive_insights(priority, created_at DESC);

-- 5. AGENT METRICS
CREATE TABLE IF NOT EXISTS agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  agent_type TEXT NOT NULL,
  queries_count INT DEFAULT 0,
  tokens_input INT DEFAULT 0,
  tokens_output INT DEFAULT 0,
  avg_response_time_ms INT,
  decisions_made INT DEFAULT 0,
  successful_decisions INT DEFAULT 0,
  helpful_responses INT DEFAULT 0,
  estimated_cost_usd DECIMAL(10, 4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, agent_type)
);

-- ============================================
-- PART 2: FUNCTIONS
-- ============================================

-- Get conversation context
CREATE OR REPLACE FUNCTION get_conversation_context(
  p_session_id TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  role TEXT,
  content TEXT,
  context JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.role,
    ac.content,
    ac.context,
    ac.created_at
  FROM agent_conversations ac
  WHERE ac.session_id = p_session_id
  ORDER BY ac.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Get active insights for dashboard
CREATE OR REPLACE FUNCTION get_active_insights(
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  insight_type TEXT,
  priority TEXT,
  title TEXT,
  content TEXT,
  action_items JSONB,
  affected_entities JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pi.id,
    pi.insight_type,
    pi.priority,
    pi.title,
    pi.content,
    pi.action_items,
    pi.affected_entities,
    pi.created_at
  FROM proactive_insights pi
  WHERE pi.is_dismissed = FALSE
    AND (pi.expires_at IS NULL OR pi.expires_at > NOW())
  ORDER BY
    CASE pi.priority
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END,
    pi.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Get successful decisions for learning
CREATE OR REPLACE FUNCTION get_successful_decisions(
  p_decision_type TEXT DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  decision_type TEXT,
  input_context JSONB,
  decision JSONB,
  reasoning TEXT,
  outcome_metrics JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ad.decision_type,
    ad.input_context,
    ad.decision,
    ad.reasoning,
    ad.outcome_metrics
  FROM agent_decisions ad
  WHERE ad.outcome IN ('successful', 'partially_successful')
    AND (p_decision_type IS NULL OR ad.decision_type = p_decision_type)
  ORDER BY ad.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================
-- PART 3: ROW LEVEL SECURITY
-- ============================================

ALTER TABLE agent_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE proactive_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_metrics ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated" ON agent_knowledge FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON agent_conversations FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON agent_decisions FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON proactive_insights FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON agent_metrics FOR ALL USING (true);

-- ============================================
-- PART 4: SEED KNOWLEDGE BASE
-- ============================================

-- Health Score Formula
INSERT INTO agent_knowledge (category, subcategory, title, content, structured_data, source, confidence) VALUES
('formula', 'health_score', 'Health Score Calculation',
'The overall health score is calculated as a weighted average:
HEALTH_SCORE = (ENGAGEMENT × 0.40) + (PACKAGE_HEALTH × 0.30) + (MOMENTUM × 0.30)

A score of 70+ indicates a healthy client, while below 50 is critical.',
'{"weights": {"engagement": 0.40, "package_health": 0.30, "momentum": 0.30}}',
'system', 1.0);

-- Engagement Score
INSERT INTO agent_knowledge (category, subcategory, title, content, structured_data, source, confidence) VALUES
('formula', 'engagement_score', 'Engagement Score Calculation',
'Starting from BASE of 50 points:

RECENT ACTIVITY (last 7 days):
+30 if 3+ sessions, +20 if 2+ sessions, +10 if 1+ session

CONSISTENCY (last 30 days):
+15 if 12+ sessions, +10 if 8+ sessions

RECENCY PENALTIES:
-30 if gap > 30 days, -15 if gap > 14 days, -5 if gap > 7 days',
'{"base": 50}', 'system', 1.0);

-- Predictive Risk Score
INSERT INTO agent_knowledge (category, subcategory, title, content, structured_data, source, confidence) VALUES
('formula', 'predictive_risk', 'Predictive Risk Score (Churn Probability)',
'Starting from BASE of 50:

MOMENTUM: +30 if DECLINING, -15 if ACCELERATING
RECENT ACTIVITY: +25 if 0 sessions 7d, +15 if <1 session, -10 if 2+ sessions
GAP: +25 if >30 days, +15 if >14 days, -10 if ≤7 days
PACKAGE: +20 if <10% remaining AND inactive, -10 if >50% remaining

RISK CATEGORIES: CRITICAL (75-100), HIGH (60-74), MEDIUM (40-59), LOW (0-39)',
'{"base": 50}', 'system', 1.0);

-- Zone Classification
INSERT INTO agent_knowledge (category, subcategory, title, content, structured_data, source, confidence) VALUES
('rule', 'zone_classification', 'Health Zone Classification',
'PURPLE (85-100): Champions - Zero churn risk
GREEN (70-84): Healthy - Low churn risk
YELLOW (50-69): At Risk - Intervention needed
RED (0-49): Critical - Urgent action required',
'{"zones": {"PURPLE": {"min": 85}, "GREEN": {"min": 70}, "YELLOW": {"min": 50}, "RED": {"min": 0}}}',
'system', 1.0);

-- Intervention Rules
INSERT INTO agent_knowledge (category, subcategory, title, content, structured_data, source, confidence) VALUES
('rule', 'interventions', 'Intervention Priority Rules',
'CRITICAL (24h): RED zone + risk > 75
HIGH (48h): RED zone OR risk > 60 OR YELLOW + DECLINING
MEDIUM (7d): GREEN + DECLINING OR package < 20%',
'{}', 'system', 1.0);

-- ============================================
-- DONE! Your agent tables are ready
-- ============================================
SELECT 'Agent tables created successfully!' as status;
