-- ============================================
-- PERMANENT USER MEMORY SYSTEM
-- ============================================
-- Purpose: Persistent memory that NEVER expires
-- Accessible from ANY device using user_key
-- No authentication required - just a user identifier
-- ============================================

-- User memory table (permanent storage)
CREATE TABLE IF NOT EXISTS user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identifier (email, name, badge ID, etc.)
  user_key TEXT NOT NULL,
  
  -- Memory storage
  memory_key TEXT NOT NULL,
  memory_value JSONB NOT NULL,
  memory_type TEXT DEFAULT 'general', -- 'general', 'preference', 'context', 'conversation', 'knowledge'
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Optional: track which device last updated
  last_device_fingerprint TEXT,
  last_ip_address INET,
  
  -- Version tracking for conflict resolution
  version INT DEFAULT 1,
  
  -- UNIQUE constraint: one value per user per key
  UNIQUE(user_key, memory_key)
);

-- Conversation history (permanent)
CREATE TABLE IF NOT EXISTS user_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key TEXT NOT NULL,
  conversation_id TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  
  -- Full conversation data
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Context summary (for RAG)
  summary TEXT,
  embedding vector(1536) -- For semantic search if needed
);

-- Knowledge base (permanent facts about user)
CREATE TABLE IF NOT EXISTS user_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key TEXT NOT NULL,
  
  -- Fact storage
  fact_key TEXT NOT NULL,
  fact_value TEXT NOT NULL,
  confidence FLOAT DEFAULT 1.0,
  source TEXT, -- Where this fact came from
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_key, fact_key)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_memory_user_key ON user_memory(user_key);
CREATE INDEX IF NOT EXISTS idx_user_memory_lookup ON user_memory(user_key, memory_key);
CREATE INDEX IF NOT EXISTS idx_user_memory_type ON user_memory(user_key, memory_type);
CREATE INDEX IF NOT EXISTS idx_user_conversations_user ON user_conversations(user_key, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_user ON user_knowledge(user_key);

-- RLS: Deny direct access (only service_role via API)
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_knowledge ENABLE ROW LEVEL SECURITY;

-- Policies that deny all public/anon access
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deny_user_memory' AND tablename = 'user_memory') THEN
    CREATE POLICY "deny_user_memory" ON user_memory FOR ALL USING (false);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deny_user_conversations' AND tablename = 'user_conversations') THEN
    CREATE POLICY "deny_user_conversations" ON user_conversations FOR ALL USING (false);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deny_user_knowledge' AND tablename = 'user_knowledge') THEN
    CREATE POLICY "deny_user_knowledge" ON user_knowledge FOR ALL USING (false);
  END IF;
END $$;

-- Comments
COMMENT ON TABLE user_memory IS 'Permanent key-value memory per user - never expires';
COMMENT ON TABLE user_conversations IS 'Full conversation history per user - never expires';
COMMENT ON TABLE user_knowledge IS 'Facts/knowledge about user - never expires';
