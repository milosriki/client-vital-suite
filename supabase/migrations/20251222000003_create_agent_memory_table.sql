-- ============================================
-- AGENT MEMORY TABLE - FIX SCHEMA MISMATCH
-- ============================================
-- Remote has: id, thread_id, query, response, knowledge_extracted, created_at, embeddings
-- Code expects: id, content, role, embedding, thread_id, session_id, user_id, agent_type, context, created_at, updated_at
-- ============================================

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Ensure table exists
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 1: Rename embeddings → embedding
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agent_memory' AND column_name='embeddings')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agent_memory' AND column_name='embedding')
  THEN
    ALTER TABLE agent_memory RENAME COLUMN embeddings TO embedding;
  END IF;
END $$;

-- Step 2: Add embedding column if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agent_memory' AND column_name='embedding')
  THEN
    ALTER TABLE agent_memory ADD COLUMN embedding VECTOR(1536);
  END IF;
END $$;

-- Step 3: Add content column (map from response if exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agent_memory' AND column_name='content')
  THEN
    ALTER TABLE agent_memory ADD COLUMN content TEXT;
    -- Copy data from response to content if response exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agent_memory' AND column_name='response')
    THEN
      UPDATE agent_memory SET content = COALESCE(query, '') || ' ' || COALESCE(response, '') WHERE content IS NULL;
    END IF;
  END IF;
END $$;

-- Step 4: Add role column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agent_memory' AND column_name='role')
  THEN
    ALTER TABLE agent_memory ADD COLUMN role TEXT DEFAULT 'assistant';
  END IF;
END $$;

-- Step 5: Add session_id column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agent_memory' AND column_name='session_id')
  THEN
    ALTER TABLE agent_memory ADD COLUMN session_id TEXT;
  END IF;
END $$;

-- Step 6: Add user_id column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agent_memory' AND column_name='user_id')
  THEN
    ALTER TABLE agent_memory ADD COLUMN user_id TEXT;
  END IF;
END $$;

-- Step 7: Add agent_type column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agent_memory' AND column_name='agent_type')
  THEN
    ALTER TABLE agent_memory ADD COLUMN agent_type TEXT DEFAULT 'analyst';
  END IF;
END $$;

-- Step 8: Add context column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agent_memory' AND column_name='context')
  THEN
    ALTER TABLE agent_memory ADD COLUMN context JSONB DEFAULT '{}';
  END IF;
END $$;

-- Step 9: Add updated_at column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agent_memory' AND column_name='updated_at')
  THEN
    ALTER TABLE agent_memory ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Step 10: Create indexes (drop first to avoid conflicts)
DROP INDEX IF EXISTS idx_agent_memory_embedding;
DROP INDEX IF EXISTS idx_agent_memory_thread;
DROP INDEX IF EXISTS idx_agent_memory_session;
DROP INDEX IF EXISTS idx_agent_memory_user;

CREATE INDEX idx_agent_memory_embedding ON agent_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_agent_memory_thread ON agent_memory(thread_id, created_at DESC);
CREATE INDEX idx_agent_memory_session ON agent_memory(session_id, created_at DESC);
CREATE INDEX idx_agent_memory_user ON agent_memory(user_id, created_at DESC);

-- Step 11: RLS
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated access to agent_memory" ON agent_memory;
CREATE POLICY "Allow authenticated access to agent_memory" ON agent_memory FOR ALL USING (true);

-- Step 12: Refresh schema cache
NOTIFY pgrst, 'reload schema';
