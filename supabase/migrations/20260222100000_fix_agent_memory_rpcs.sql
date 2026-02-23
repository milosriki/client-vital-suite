-- ==============================================================================
-- FIX: Agent memory RPCs — column name mismatch + parameter mismatch
-- ==============================================================================
-- Bug 1: match_agent_memory uses am.embeddings (plural) but column is embedding (singular)
-- Bug 2: match_memories returns content/metadata but callers expect query/response
--         and callers pass match_threshold/match_count/filter_thread_id
--         but function only accepts threshold/count (no thread filter)
-- Result: ALL agent memory recall has been silently returning empty results
-- ==============================================================================

-- ============================================
-- FIX 1: match_agent_memory (used by ptd-agent-gemini)
-- Change am.embeddings → am.embedding
-- ============================================
CREATE OR REPLACE FUNCTION public.match_agent_memory(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5,
    p_agent_name TEXT DEFAULT 'ptd-agent-gemini',
    p_thread_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    query TEXT,
    response TEXT,
    knowledge_extracted JSONB,
    similarity FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        am.id,
        am.query,
        am.response,
        am.knowledge_extracted,
        1 - (am.embedding <=> query_embedding) as similarity,
        am.created_at
    FROM public.agent_memory am
    WHERE
        am.embedding IS NOT NULL
        AND am.agent_name = p_agent_name
        AND (p_thread_id IS NULL OR am.thread_id = p_thread_id)
        AND 1 - (am.embedding <=> query_embedding) > match_threshold
    ORDER BY am.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_agent_memory(vector, FLOAT, INT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_agent_memory(vector, FLOAT, INT, TEXT, TEXT) TO service_role;

-- ============================================
-- FIX 2: match_memories (used by ptd-agent-atlas + unified-brain.ts)
-- Callers pass: match_threshold, match_count, filter_thread_id
-- Callers read: m.query, m.response, m.knowledge_extracted, m.created_at
-- Previous version (20251224) had wrong param names + wrong return columns
-- ============================================
DROP FUNCTION IF EXISTS public.match_memories(VECTOR(1536), FLOAT, INT);
DROP FUNCTION IF EXISTS public.match_memories(VECTOR(1536), FLOAT, INT, TEXT);

CREATE OR REPLACE FUNCTION public.match_memories(
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.7,
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
LANGUAGE plpgsql STABLE
SECURITY DEFINER
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
        (1 - (am.embedding <=> query_embedding))::FLOAT AS similarity
    FROM public.agent_memory am
    WHERE
        am.embedding IS NOT NULL
        AND (filter_thread_id IS NULL OR am.thread_id = filter_thread_id)
        AND (1 - (am.embedding <=> query_embedding)) > match_threshold
    ORDER BY am.embedding <=> query_embedding ASC
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_memories(VECTOR(1536), FLOAT, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_memories(VECTOR(1536), FLOAT, INT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_memories(VECTOR(1536), FLOAT, INT, TEXT) TO anon;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
