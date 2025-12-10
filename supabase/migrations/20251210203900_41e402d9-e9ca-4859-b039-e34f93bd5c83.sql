-- 1. MAIN AGENT MEMORY (Learns from EVERY interaction)
CREATE TABLE IF NOT EXISTS public.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT NOT NULL,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  knowledge_extracted JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  embeddings vector(1536)
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS agent_memory_thread_idx ON public.agent_memory(thread_id);
CREATE INDEX IF NOT EXISTS agent_memory_created_idx ON public.agent_memory(created_at DESC);
CREATE INDEX IF NOT EXISTS agent_memory_embeddings_idx ON public.agent_memory USING ivfflat (embeddings vector_cosine_ops) WITH (lists = 100);

-- 2. LONG-TERM PATTERNS (What agent learned)
CREATE TABLE IF NOT EXISTS public.agent_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name TEXT UNIQUE NOT NULL,
  description TEXT,
  confidence NUMERIC(3,2) DEFAULT 0.5,
  examples JSONB[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_patterns_name_idx ON public.agent_patterns(pattern_name);
CREATE INDEX IF NOT EXISTS agent_patterns_confidence_idx ON public.agent_patterns(confidence DESC);

-- 3. SEMANTIC MEMORY SEARCH FUNCTION
CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.78,
  match_count INT DEFAULT 5,
  filter_thread_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  thread_id TEXT,
  query TEXT,
  response TEXT,
  knowledge_extracted JSONB,
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE SQL STABLE
SET search_path = public
AS $$
  SELECT 
    agent_memory.id,
    agent_memory.thread_id,
    agent_memory.query,
    agent_memory.response,
    agent_memory.knowledge_extracted,
    agent_memory.created_at,
    1 - (agent_memory.embeddings <=> query_embedding) AS similarity
  FROM agent_memory
  WHERE 
    agent_memory.embeddings IS NOT NULL
    AND 1 - (agent_memory.embeddings <=> query_embedding) > match_threshold
    AND (filter_thread_id IS NULL OR agent_memory.thread_id = filter_thread_id)
  ORDER BY agent_memory.embeddings <=> query_embedding
  LIMIT match_count;
$$;

-- 4. RLS POLICIES
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read agent_memory" ON public.agent_memory FOR SELECT USING (true);
CREATE POLICY "Allow insert agent_memory" ON public.agent_memory FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin full access agent_memory" ON public.agent_memory FOR ALL USING (is_admin());

CREATE POLICY "Public read agent_patterns" ON public.agent_patterns FOR SELECT USING (true);
CREATE POLICY "Allow insert agent_patterns" ON public.agent_patterns FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update agent_patterns" ON public.agent_patterns FOR UPDATE USING (true);
CREATE POLICY "Admin full access agent_patterns" ON public.agent_patterns FOR ALL USING (is_admin());