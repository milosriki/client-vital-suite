-- ============================================================================
-- ORG GLOBAL BRAIN TABLES
-- Creates org-wide memory that is NOT tied to a browser session
-- All tables have RLS enabled with deny-all policies; only service_role reads/writes
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- 1. ORG_SESSIONS - For per-user threads if needed later
-- ============================================================================
CREATE TABLE IF NOT EXISTS org_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_name TEXT NOT NULL DEFAULT 'default',
  user_label TEXT,  -- Optional: who is this session for
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_org_sessions_active ON org_sessions(is_active, last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_sessions_user ON org_sessions(user_label) WHERE user_label IS NOT NULL;

-- ============================================================================
-- 2. ORG_MEMORY_KV - Key/value JSONB with namespace + optional TTL
-- ============================================================================
CREATE TABLE IF NOT EXISTS org_memory_kv (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  namespace TEXT NOT NULL DEFAULT 'global',
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  source TEXT,  -- Who wrote this (agent name, user, system)
  ttl_seconds INTEGER,  -- Optional TTL
  expires_at TIMESTAMPTZ,  -- Computed expiry time
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(namespace, key)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_org_memory_kv_namespace ON org_memory_kv(namespace);
CREATE INDEX IF NOT EXISTS idx_org_memory_kv_expires ON org_memory_kv(expires_at) WHERE expires_at IS NOT NULL;

-- Trigger to compute expires_at when ttl_seconds is set
CREATE OR REPLACE FUNCTION compute_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ttl_seconds IS NOT NULL THEN
    NEW.expires_at := NOW() + (NEW.ttl_seconds || ' seconds')::INTERVAL;
  ELSE
    NEW.expires_at := NULL;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_compute_expiry ON org_memory_kv;
CREATE TRIGGER trigger_compute_expiry
  BEFORE INSERT OR UPDATE ON org_memory_kv
  FOR EACH ROW EXECUTE FUNCTION compute_expiry();

-- ============================================================================
-- 3. ORG_MEMORY_EVENTS - Append-only log of memory writes
-- ============================================================================
CREATE TABLE IF NOT EXISTS org_memory_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  namespace TEXT NOT NULL DEFAULT 'global',
  key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('write', 'delete', 'expire')),
  value JSONB,
  source TEXT,  -- Who triggered this event
  user_label TEXT,  -- Optional user identifier
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for event queries
CREATE INDEX IF NOT EXISTS idx_org_memory_events_namespace ON org_memory_events(namespace, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_memory_events_key ON org_memory_events(namespace, key, created_at DESC);

-- ============================================================================
-- 4. ORG_DOCUMENTS - For RAG documents with embeddings
-- ============================================================================
CREATE TABLE IF NOT EXISTS org_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  source TEXT NOT NULL,  -- Where this document came from (url, file, manual)
  source_id TEXT,  -- External ID if applicable
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding VECTOR(1536),  -- OpenAI text-embedding-3-small
  chunk_index INTEGER DEFAULT 0,  -- For multi-chunk documents
  total_chunks INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for document search
CREATE INDEX IF NOT EXISTS idx_org_documents_source ON org_documents(source);
CREATE INDEX IF NOT EXISTS idx_org_documents_embedding ON org_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- 5. ORG_FACTS - Canonical facts with validity window + confidence + provenance
-- ============================================================================
CREATE TABLE IF NOT EXISTS org_facts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fact_key TEXT NOT NULL UNIQUE,  -- Unique identifier for this fact
  fact_value JSONB NOT NULL,
  description TEXT,  -- Human readable description
  confidence DECIMAL(3,2) DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  provenance TEXT,  -- Source of this fact (agent, user, system)
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,  -- NULL means forever valid
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fact lookups
CREATE INDEX IF NOT EXISTS idx_org_facts_key ON org_facts(fact_key);
CREATE INDEX IF NOT EXISTS idx_org_facts_tags ON org_facts USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_org_facts_valid ON org_facts(valid_from, valid_until);

-- ============================================================================
-- 6. AGENT_MESSAGES - Inter-agent communication log
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('request', 'response', 'broadcast', 'event')),
  content JSONB NOT NULL,
  correlation_id UUID,  -- Links related messages
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'processed', 'failed')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes for message queries
CREATE INDEX IF NOT EXISTS idx_agent_messages_to ON agent_messages(to_agent, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_correlation ON agent_messages(correlation_id) WHERE correlation_id IS NOT NULL;

-- ============================================================================
-- 7. REASONING_TRACES - Track agent reasoning steps
-- ============================================================================
CREATE TABLE IF NOT EXISTS reasoning_traces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID,  -- Links to org_sessions
  agent_name TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('input', 'reasoning', 'action', 'observation', 'output')),
  content JSONB NOT NULL,
  confidence DECIMAL(3,2),
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for trace queries
CREATE INDEX IF NOT EXISTS idx_reasoning_traces_session ON reasoning_traces(session_id, step_number);
CREATE INDEX IF NOT EXISTS idx_reasoning_traces_agent ON reasoning_traces(agent_name, created_at DESC);

-- ============================================================================
-- 8. AGENT_PATTERNS TABLE (if not exists from unified-brain)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_name TEXT NOT NULL UNIQUE,
  description TEXT,
  examples JSONB DEFAULT '[]'::jsonb,
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_patterns_name ON agent_patterns(pattern_name);
CREATE INDEX IF NOT EXISTS idx_agent_patterns_confidence ON agent_patterns(confidence DESC);

-- ============================================================================
-- RLS POLICIES - Deny all by default, only service_role can access
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE org_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_memory_kv ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_memory_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reasoning_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_patterns ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies (only service_role can CRUD)
CREATE POLICY "service_role_all_org_sessions" ON org_sessions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_org_memory_kv" ON org_memory_kv FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_org_memory_events" ON org_memory_events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_org_documents" ON org_documents FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_org_facts" ON org_facts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_agent_messages" ON agent_messages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_reasoning_traces" ON reasoning_traces FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_agent_patterns" ON agent_patterns FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to match documents by embedding similarity
CREATE OR REPLACE FUNCTION match_org_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.75,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  source TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.source,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM org_documents d
  WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get active facts
CREATE OR REPLACE FUNCTION get_active_facts(
  fact_tags TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  fact_key TEXT,
  fact_value JSONB,
  description TEXT,
  confidence DECIMAL,
  provenance TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.fact_key,
    f.fact_value,
    f.description,
    f.confidence,
    f.provenance
  FROM org_facts f
  WHERE
    (f.valid_from IS NULL OR f.valid_from <= NOW())
    AND (f.valid_until IS NULL OR f.valid_until > NOW())
    AND (fact_tags IS NULL OR f.tags && fact_tags)
  ORDER BY f.confidence DESC;
END;
$$;

-- Function to clean up expired memory entries
CREATE OR REPLACE FUNCTION cleanup_expired_memory()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired KV entries
  WITH deleted AS (
    DELETE FROM org_memory_kv
    WHERE expires_at IS NOT NULL AND expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  -- Log expiry events
  INSERT INTO org_memory_events (namespace, key, action, source)
  SELECT namespace, key, 'expire', 'system'
  FROM org_memory_kv
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  RETURN deleted_count;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE org_sessions IS 'Org-wide sessions for tracking user/browser sessions';
COMMENT ON TABLE org_memory_kv IS 'Key-value store for org-wide memory with optional TTL';
COMMENT ON TABLE org_memory_events IS 'Append-only log of all memory write/delete events';
COMMENT ON TABLE org_documents IS 'RAG document store with vector embeddings';
COMMENT ON TABLE org_facts IS 'Canonical facts with validity windows and confidence scores';
COMMENT ON TABLE agent_messages IS 'Inter-agent communication log';
COMMENT ON TABLE reasoning_traces IS 'Step-by-step reasoning traces from agents';
COMMENT ON TABLE agent_patterns IS 'Learned behavioral patterns from agents';
