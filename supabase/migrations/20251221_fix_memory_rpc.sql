-- ============================================
-- FIX: MEMORY SYSTEM & TABLE ALIGNMENT
-- ============================================

-- 1. Create match_memories RPC (Missing function)
-- Allows the agent to vector-search past conversations
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  filter_thread_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  role TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.content,
    am.role,
    1 - (am.embedding <=> query_embedding) AS similarity,
    am.created_at
  FROM agent_memory am
  WHERE (filter_thread_id IS NULL OR am.thread_id = filter_thread_id)
    AND 1 - (am.embedding <=> query_embedding) > match_threshold
  ORDER BY am.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 2. Fix Table Naming Inconsistency
-- Code expects 'knowledge_base', but migration created 'agent_knowledge'
-- We create a view to make 'knowledge_base' point to 'agent_knowledge'
-- This allows existing code to work without changes

CREATE OR REPLACE VIEW knowledge_base AS
SELECT 
  id,
  content,
  category,
  subcategory,
  title,
  structured_data,
  embedding,
  source,
  confidence,
  created_at,
  updated_at
FROM agent_knowledge;

-- 3. Grant access to the view
GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge_base TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge_base TO service_role;
