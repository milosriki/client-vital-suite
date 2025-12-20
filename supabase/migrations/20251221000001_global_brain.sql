-- ============================================
-- PTD GLOBAL BRAIN - ORG-WIDE MEMORY TABLES
-- ============================================

-- 1. Org-wide key/value memory
CREATE TABLE IF NOT EXISTS org_memory_kv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace TEXT NOT NULL DEFAULT 'global',
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  ttl_seconds INT,  -- NULL = never expires
  expires_at TIMESTAMPTZ GENERATED ALWAYS AS (
    CASE WHEN ttl_seconds IS NOT NULL 
    THEN created_at + (ttl_seconds || ' seconds')::INTERVAL 
    ELSE NULL END
  ) STORED,
  source TEXT DEFAULT 'manual',  -- 'manual', 'agent', 'system', 'hubspot', 'stripe'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(namespace, key)
);

-- 2. Append-only audit log for memory writes
CREATE TABLE IF NOT EXISTS org_memory_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('write', 'delete', 'expire')),
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value_before JSONB,
  value_after JSONB,
  source TEXT,
  user_id TEXT,  -- Optional: who made the change
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Org-wide facts (canonical truths)
CREATE TABLE IF NOT EXISTS org_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_key TEXT NOT NULL,
  fact_value JSONB NOT NULL,
  category TEXT DEFAULT 'general',
  confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,  -- NULL = forever valid
  source TEXT NOT NULL,  -- 'hubspot', 'stripe', 'manual', 'learned', 'calculated'
  source_id TEXT,  -- External ID if from HubSpot/Stripe
  provenance JSONB,  -- { query, timestamp, tables_used }
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fact_key, category)
);

-- 4. Shared conversation threads
CREATE TABLE IF NOT EXISTS org_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_name TEXT,
  created_by TEXT DEFAULT 'anonymous',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Messages in threads
CREATE TABLE IF NOT EXISTS org_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES org_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  evidence JSONB,  -- { tables: [], filters: {}, timeRange: {} }
  sources_used TEXT[],
  latency_ms INT,
  agent_memory_id UUID,  -- Link to agent_memory for RAG retrieval
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Query audit log (for analytics & debugging)
CREATE TABLE IF NOT EXISTS org_query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  mode TEXT DEFAULT 'fast' CHECK (mode IN ('fast', 'deep')),
  answer TEXT,
  evidence JSONB,
  sources_used TEXT[],
  context_tokens INT,
  response_tokens INT,
  latency_ms INT,
  error TEXT,
  user_id TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_org_memory_kv_namespace ON org_memory_kv(namespace);
CREATE INDEX IF NOT EXISTS idx_org_memory_kv_lookup ON org_memory_kv(namespace, key);
CREATE INDEX IF NOT EXISTS idx_org_memory_kv_expires ON org_memory_kv(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_memory_events_time ON org_memory_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_facts_category ON org_facts(category);
CREATE INDEX IF NOT EXISTS idx_org_facts_key ON org_facts(fact_key);
CREATE INDEX IF NOT EXISTS idx_org_facts_valid ON org_facts(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_org_messages_thread ON org_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_org_query_log_time ON org_query_log(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (service_role only)
-- ============================================

ALTER TABLE org_memory_kv ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_memory_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_query_log ENABLE ROW LEVEL SECURITY;

-- Deny all access except service_role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_only' AND tablename = 'org_memory_kv') THEN
    CREATE POLICY "service_role_only" ON org_memory_kv FOR ALL USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_only' AND tablename = 'org_memory_events') THEN
    CREATE POLICY "service_role_only" ON org_memory_events FOR ALL USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_only' AND tablename = 'org_facts') THEN
    CREATE POLICY "service_role_only" ON org_facts FOR ALL USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_only' AND tablename = 'org_threads') THEN
    CREATE POLICY "service_role_only" ON org_threads FOR ALL USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_only' AND tablename = 'org_messages') THEN
    CREATE POLICY "service_role_only" ON org_messages FOR ALL USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_only' AND tablename = 'org_query_log') THEN
    CREATE POLICY "service_role_only" ON org_query_log FOR ALL USING (false);
  END IF;
END $$;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER org_memory_kv_updated
  BEFORE UPDATE ON org_memory_kv
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER org_facts_updated
  BEFORE UPDATE ON org_facts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Clean up expired memory entries (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_memory()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  WITH deleted AS (
    DELETE FROM org_memory_kv
    WHERE expires_at IS NOT NULL AND expires_at < NOW()
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
