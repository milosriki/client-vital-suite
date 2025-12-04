-- ============================================
-- SMART AGENT SYSTEM - DATABASE TABLES
-- ============================================

-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 1. KNOWLEDGE BASE (RAG Storage)
-- Stores formulas, rules, patterns, and learnings
-- ============================================
CREATE TABLE IF NOT EXISTS agent_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Content categorization
  category TEXT NOT NULL, -- 'formula', 'rule', 'pattern', 'intervention_template', 'learning'
  subcategory TEXT, -- 'health_score', 'risk_prediction', 'zone_classification', etc.
  title TEXT NOT NULL,

  -- The actual knowledge content
  content TEXT NOT NULL,

  -- Structured data (formulas, thresholds, etc.)
  structured_data JSONB DEFAULT '{}',

  -- Vector embedding for semantic search
  embedding VECTOR(1536),

  -- Metadata
  source TEXT, -- 'system', 'user', 'learned'
  confidence FLOAT DEFAULT 1.0, -- How confident we are in this knowledge
  usage_count INT DEFAULT 0, -- How often this knowledge is used
  last_used_at TIMESTAMPTZ,

  -- Versioning
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON agent_knowledge
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON agent_knowledge(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_knowledge_active ON agent_knowledge(is_active);

-- ============================================
-- 2. CONVERSATION MEMORY
-- Stores chat history for context
-- ============================================
CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session tracking
  session_id TEXT NOT NULL,
  user_id TEXT, -- Optional user identifier

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- Agent info
  agent_type TEXT DEFAULT 'analyst', -- 'analyst', 'advisor', 'watcher'

  -- Context attached to this message
  context JSONB DEFAULT '{}', -- { client_id, coach_id, data_snapshot, etc. }

  -- Token tracking for cost monitoring
  tokens_used INT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_session ON agent_conversations(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON agent_conversations(user_id, created_at DESC);

-- ============================================
-- 3. AGENT DECISIONS (Learning Loop)
-- Tracks decisions and their outcomes for learning
-- ============================================
CREATE TABLE IF NOT EXISTS agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Decision identification
  agent_type TEXT NOT NULL,
  decision_type TEXT NOT NULL, -- 'intervention', 'alert', 'recommendation', 'prediction'

  -- Input that led to decision
  input_context JSONB NOT NULL,

  -- The decision made
  decision JSONB NOT NULL,
  reasoning TEXT, -- Agent's explanation
  confidence FLOAT, -- 0.0 to 1.0

  -- Related entities
  client_email TEXT,
  coach_name TEXT,

  -- Outcome tracking (filled in later)
  outcome TEXT CHECK (outcome IN ('pending', 'successful', 'partially_successful', 'failed', 'unknown')),
  outcome_notes TEXT,
  outcome_metrics JSONB DEFAULT '{}', -- { health_score_change, sessions_booked, etc. }
  outcome_recorded_at TIMESTAMPTZ,
  outcome_recorded_by TEXT,

  -- Learning flags
  was_helpful BOOLEAN, -- User feedback
  feedback_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_type ON agent_decisions(decision_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_outcome ON agent_decisions(outcome);
CREATE INDEX IF NOT EXISTS idx_decisions_client ON agent_decisions(client_email);

-- ============================================
-- 4. PROACTIVE INSIGHTS QUEUE
-- Alerts and insights for dashboard display
-- ============================================
CREATE TABLE IF NOT EXISTS proactive_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Classification
  insight_type TEXT NOT NULL, -- 'alert', 'recommendation', 'pattern', 'prediction', 'opportunity'
  priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),

  -- Content
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT, -- Short version for notifications

  -- Actions
  action_items JSONB DEFAULT '[]', -- [{ action: "", priority: "", assigned_to: "" }]
  suggested_response TEXT, -- Pre-written response/action

  -- Affected entities
  affected_entities JSONB DEFAULT '{}', -- { clients: [], coaches: [], count: N }

  -- Source tracking
  source_agent TEXT, -- Which agent generated this
  source_data JSONB DEFAULT '{}', -- Raw data that triggered insight

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  is_actioned BOOLEAN DEFAULT FALSE,
  actioned_at TIMESTAMPTZ,
  actioned_by TEXT,
  action_notes TEXT,

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Auto-dismiss after this time

  -- Deduplication
  dedup_key TEXT UNIQUE -- Prevent duplicate insights
);

CREATE INDEX IF NOT EXISTS idx_insights_active ON proactive_insights(is_dismissed, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_priority ON proactive_insights(priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_type ON proactive_insights(insight_type);

-- ============================================
-- 5. AGENT METRICS (Performance Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  date DATE NOT NULL DEFAULT CURRENT_DATE,
  agent_type TEXT NOT NULL,

  -- Usage metrics
  queries_count INT DEFAULT 0,
  tokens_input INT DEFAULT 0,
  tokens_output INT DEFAULT 0,
  avg_response_time_ms INT,

  -- Quality metrics
  decisions_made INT DEFAULT 0,
  successful_decisions INT DEFAULT 0,
  helpful_responses INT DEFAULT 0,

  -- Cost tracking
  estimated_cost_usd DECIMAL(10, 4) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(date, agent_type)
);

-- ============================================
-- 6. FUNCTIONS FOR VECTOR SEARCH
-- ============================================

-- Match knowledge by semantic similarity
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  filter_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  category TEXT,
  title TEXT,
  content TEXT,
  structured_data JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ak.id,
    ak.category,
    ak.title,
    ak.content,
    ak.structured_data,
    1 - (ak.embedding <=> query_embedding) AS similarity
  FROM agent_knowledge ak
  WHERE ak.is_active = TRUE
    AND (filter_category IS NULL OR ak.category = filter_category)
    AND 1 - (ak.embedding <=> query_embedding) > match_threshold
  ORDER BY ak.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

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
-- 7. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE agent_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE proactive_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_metrics ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (adjust as needed)
CREATE POLICY "Allow all for authenticated" ON agent_knowledge FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON agent_conversations FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON agent_decisions FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON proactive_insights FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON agent_metrics FOR ALL USING (true);

-- ============================================
-- 8. TRIGGERS FOR AUTO-UPDATE
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_knowledge_updated_at
  BEFORE UPDATE ON agent_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
