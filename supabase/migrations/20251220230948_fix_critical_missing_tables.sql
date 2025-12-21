-- ============================================================================
-- FIX CRITICAL MISSING TABLES AND RPC CONFLICTS
-- This migration fixes issues identified by the 10-agent audit
-- ============================================================================

-- ============================================================================
-- 1. CREATE MISSING server_sessions TABLE (required by api/memory.ts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS server_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address TEXT,
  device_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_server_sessions_session_id ON server_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_server_sessions_expires ON server_sessions(expires_at);

-- ============================================================================
-- 2. CREATE MISSING server_memory TABLE (required by api/memory.ts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS server_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES server_sessions(session_id) ON DELETE CASCADE,
  memory_key TEXT NOT NULL,
  memory_value JSONB NOT NULL,
  memory_type TEXT DEFAULT 'context',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(session_id, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_server_memory_session ON server_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_server_memory_key ON server_memory(session_id, memory_key);
CREATE INDEX IF NOT EXISTS idx_server_memory_expires ON server_memory(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- 3. ADD MISSING COLUMNS TO contacts TABLE (required by views)
-- ============================================================================
DO $$
BEGIN
  -- Add first_touch_time if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'contacts' AND column_name = 'first_touch_time') THEN
    ALTER TABLE contacts ADD COLUMN first_touch_time TIMESTAMPTZ;
  END IF;

  -- Add last_touch_time if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'contacts' AND column_name = 'last_touch_time') THEN
    ALTER TABLE contacts ADD COLUMN last_touch_time TIMESTAMPTZ;
  END IF;

  -- Add first_touch_source if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'contacts' AND column_name = 'first_touch_source') THEN
    ALTER TABLE contacts ADD COLUMN first_touch_source TEXT;
  END IF;

  -- Add total_events if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'contacts' AND column_name = 'total_events') THEN
    ALTER TABLE contacts ADD COLUMN total_events INTEGER DEFAULT 0;
  END IF;

  -- Add total_value if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'contacts' AND column_name = 'total_value') THEN
    ALTER TABLE contacts ADD COLUMN total_value DECIMAL(12,2) DEFAULT 0;
  END IF;

  -- Add owner_id if missing (referenced by index but never created)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'contacts' AND column_name = 'owner_id') THEN
    ALTER TABLE contacts ADD COLUMN owner_id TEXT;
  END IF;
END $$;

-- ============================================================================
-- 4. ADD MISSING COLUMNS TO deals TABLE (required by lead_lifecycle_view)
-- ============================================================================
DO $$
BEGIN
  -- Add hubspot_contact_id if missing (required for join in lead_lifecycle_view)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'deals' AND column_name = 'hubspot_contact_id') THEN
    ALTER TABLE deals ADD COLUMN hubspot_contact_id TEXT;
  END IF;

  -- Add status column if missing (lead_lifecycle_view uses d.status, not d.stage)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'deals' AND column_name = 'status') THEN
    ALTER TABLE deals ADD COLUMN status TEXT;
  END IF;

  -- Add deal_value if missing (lead_lifecycle_view uses d.deal_value, not d.amount)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'deals' AND column_name = 'deal_value') THEN
    ALTER TABLE deals ADD COLUMN deal_value DECIMAL(12,2);
  END IF;
END $$;

-- ============================================================================
-- 5. FIX match_memories RPC - CREATE SINGLE AUTHORITATIVE VERSION
-- Drop any existing conflicting definitions and create one correct version
-- ============================================================================
DROP FUNCTION IF EXISTS match_memories(vector(1536), float, int, text);
DROP FUNCTION IF EXISTS match_memories(vector, float, int, text);

CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 5,
  filter_thread_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  thread_id text,
  query text,
  response text,
  knowledge_extracted jsonb,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.thread_id,
    am.query,
    am.response,
    am.knowledge_extracted,
    am.created_at,
    1 - (am.embeddings <=> query_embedding) AS similarity
  FROM agent_memory am
  WHERE
    am.embeddings IS NOT NULL
    AND 1 - (am.embeddings <=> query_embedding) > match_threshold
    AND (filter_thread_id IS NULL OR am.thread_id = filter_thread_id)
  ORDER BY am.embeddings <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- 6. CREATE conversation_threads TABLE IF MISSING
-- (Referenced by conversation_messages FK)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT UNIQUE,
  title TEXT,
  agent_type TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- 7. CREATE conversation_messages TABLE IF MISSING
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES conversation_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  embedding vector(1536),
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_thread ON conversation_messages(thread_id, created_at);

-- ============================================================================
-- 8. CREATE knowledge_documents TABLE IF MISSING
-- (Referenced by ptd-agent-claude but never created)
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  source_url TEXT,
  document_type TEXT DEFAULT 'general',
  embedding vector(1536),
  chunk_index INTEGER DEFAULT 0,
  total_chunks INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_source ON knowledge_documents(source);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_type ON knowledge_documents(document_type);

-- ============================================================================
-- 9. CREATE business_goals TABLE IF MISSING
-- (Referenced by ai-ceo-master)
-- ============================================================================
CREATE TABLE IF NOT EXISTS business_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_name TEXT NOT NULL,
  goal_type TEXT NOT NULL,
  target_value DECIMAL(12,2),
  current_value DECIMAL(12,2),
  target_date DATE,
  priority INTEGER DEFAULT 5,
  status TEXT DEFAULT 'active',
  owner TEXT,
  description TEXT,
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 10. CREATE agent_conversations TABLE IF MISSING
-- (Referenced in migration comments but not created)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT NOT NULL,
  agent_type TEXT DEFAULT 'general',
  user_message TEXT NOT NULL,
  agent_response TEXT,
  tokens_used INTEGER,
  response_time_ms INTEGER,
  error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_thread ON agent_conversations(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent ON agent_conversations(agent_type, created_at DESC);

-- ============================================================================
-- 11. ENABLE RLS WITH PERMISSIVE POLICIES FOR NEW TABLES
-- ============================================================================
ALTER TABLE server_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;

-- Public read/insert for now (can be tightened later)
CREATE POLICY "public_read_server_sessions" ON server_sessions FOR SELECT USING (true);
CREATE POLICY "public_insert_server_sessions" ON server_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_server_sessions" ON server_sessions FOR UPDATE USING (true);

CREATE POLICY "public_read_server_memory" ON server_memory FOR SELECT USING (true);
CREATE POLICY "public_insert_server_memory" ON server_memory FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_server_memory" ON server_memory FOR UPDATE USING (true);
CREATE POLICY "public_delete_server_memory" ON server_memory FOR DELETE USING (true);

CREATE POLICY "public_all_conversation_threads" ON conversation_threads FOR ALL USING (true);
CREATE POLICY "public_all_conversation_messages" ON conversation_messages FOR ALL USING (true);
CREATE POLICY "public_all_knowledge_documents" ON knowledge_documents FOR ALL USING (true);
CREATE POLICY "public_all_business_goals" ON business_goals FOR ALL USING (true);
CREATE POLICY "public_all_agent_conversations" ON agent_conversations FOR ALL USING (true);

-- ============================================================================
-- 12. COMMENTS
-- ============================================================================
COMMENT ON TABLE server_sessions IS 'Server-side session storage for memory persistence';
COMMENT ON TABLE server_memory IS 'Server-side key-value memory storage per session';
COMMENT ON TABLE conversation_threads IS 'Conversation thread metadata';
COMMENT ON TABLE conversation_messages IS 'Individual messages within conversation threads';
COMMENT ON TABLE knowledge_documents IS 'RAG document store for agent knowledge base';
COMMENT ON TABLE business_goals IS 'Business goals for AI CEO tracking';
COMMENT ON TABLE agent_conversations IS 'Log of all agent conversations';
COMMENT ON FUNCTION match_memories IS 'RAG similarity search against agent_memory table';
