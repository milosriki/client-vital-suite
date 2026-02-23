-- ==============================================================================
-- LISA ISOLATED RAG MIGRATION
-- Enforces strict parameter-level isolation for agent memory and knowledge
-- ==============================================================================

-- 1. Create match_agent_memory (The Isolated Brain)
-- Queries the agent_memory table and strictly enforces agent_name isolation
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
        1 - (am.embeddings <=> query_embedding) as similarity,
        am.created_at
    FROM public.agent_memory am
    WHERE
        am.embeddings IS NOT NULL
        -- STRICT ISOLATION: Must match agent name exactly
        AND am.agent_name = p_agent_name
        AND (p_thread_id IS NULL OR am.thread_id = p_thread_id)
        AND 1 - (am.embeddings <=> query_embedding) > match_threshold
    ORDER BY am.embeddings <=> query_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_agent_memory(vector, FLOAT, INT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_agent_memory(vector, FLOAT, INT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.match_agent_memory(vector, FLOAT, INT, TEXT, TEXT) IS 'Isolated vector search for specific agent memories (e.g. LISA only)';


-- 2. Update match_knowledge to support multiple safe categories
-- Allows LISA to fetch pricing, packages, and locations simultaneously
CREATE OR REPLACE FUNCTION public.match_isolated_knowledge(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5,
    allowed_categories TEXT[] DEFAULT ARRAY['pricing', 'packages', 'locations', 'faq']
)
RETURNS TABLE (
    id UUID,
    category TEXT,
    title TEXT,
    content TEXT,
    structured_data JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ak.id,
        ak.category,
        ak.title,
        ak.content,
        ak.structured_data,
        1 - (ak.embedding <=> query_embedding) AS similarity
    FROM public.agent_knowledge ak
    WHERE ak.is_active = TRUE
      -- STRICT ISOLATION: Only search within explicitly allowed categories
      AND ak.category = ANY(allowed_categories)
      AND 1 - (ak.embedding <=> query_embedding) > match_threshold
    ORDER BY ak.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_isolated_knowledge(vector, FLOAT, INT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_isolated_knowledge(vector, FLOAT, INT, TEXT[]) TO service_role;

COMMENT ON FUNCTION public.match_isolated_knowledge(vector, FLOAT, INT, TEXT[]) IS 'Isolated vector search for agent knowledge, restricted to safe categories';
