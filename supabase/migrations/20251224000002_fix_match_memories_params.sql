-- ============================================
-- FIX: match_memories RPC parameter names
-- ============================================
-- System check expects: query_embedding, threshold, count
-- Function had: query_embedding, match_threshold, match_count, filter_thread_id
-- ============================================

-- Drop and recreate with correct param names
DROP FUNCTION IF EXISTS match_memories(VECTOR(1536), FLOAT, INT, TEXT);
DROP FUNCTION IF EXISTS public.match_memories;

CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding VECTOR(1536),
  threshold FLOAT DEFAULT 0.7,
  count INT DEFAULT 5
)
RETURNS TABLE (
  id TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id::TEXT,
    m.content,
    COALESCE(m.context, '{}'::JSONB) AS metadata,
    (1 - (m.embedding <=> query_embedding))::FLOAT AS similarity
  FROM agent_memory m
  WHERE m.embedding IS NOT NULL
    AND (1 - (m.embedding <=> query_embedding)) > threshold
  ORDER BY m.embedding <=> query_embedding ASC
  LIMIT count;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.match_memories TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_memories TO service_role;
GRANT EXECUTE ON FUNCTION public.match_memories TO anon;

-- Refresh PostgREST schema
NOTIFY pgrst, 'reload schema';
