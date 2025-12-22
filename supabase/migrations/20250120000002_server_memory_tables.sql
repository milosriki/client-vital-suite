-- ============================================
-- Server-Side Memory Persistence Tables
-- ============================================
-- Purpose: Store persistent memory on server (no client DB access)
-- All operations go through API routes using service_role
-- ============================================

-- Server sessions (browser/device session tracking)
CREATE TABLE IF NOT EXISTS server_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  device_fingerprint TEXT,
  browser_info JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Server memory (persistent key-value store)
CREATE TABLE IF NOT EXISTS server_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT REFERENCES server_sessions(session_id) ON DELETE CASCADE,
  memory_key TEXT NOT NULL,
  memory_value JSONB NOT NULL,
  memory_type TEXT DEFAULT 'context', -- 'context', 'preference', 'history'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(session_id, memory_key)
);

-- Server context (conversation history)
CREATE TABLE IF NOT EXISTS server_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT REFERENCES server_sessions(session_id) ON DELETE CASCADE,
  context_type TEXT DEFAULT 'conversation', -- 'conversation', 'task', 'query'
  context_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_server_sessions_session_id ON server_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_server_sessions_expires ON server_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_server_memory_session_key ON server_memory(session_id, memory_key);
CREATE INDEX IF NOT EXISTS idx_server_memory_expires ON server_memory(expires_at);
CREATE INDEX IF NOT EXISTS idx_server_context_session ON server_context(session_id, created_at DESC);

-- RLS Policies (deny all - only service_role can access)
ALTER TABLE server_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_context ENABLE ROW LEVEL SECURITY;

-- Deny all public access (only service_role can access)
CREATE POLICY "Deny all public access to server_sessions" ON server_sessions
  FOR ALL USING (false);

CREATE POLICY "Deny all public access to server_memory" ON server_memory
  FOR ALL USING (false);

CREATE POLICY "Deny all public access to server_context" ON server_context
  FOR ALL USING (false);

-- Comments for documentation
COMMENT ON TABLE server_sessions IS 'Browser/device session tracking for server-side memory persistence';
COMMENT ON TABLE server_memory IS 'Persistent key-value memory storage (server-side only)';
COMMENT ON TABLE server_context IS 'Conversation and context history (server-side only)';

