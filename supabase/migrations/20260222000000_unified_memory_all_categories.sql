-- ==============================================================================
-- UNIFIED MEMORY: NULL = All Categories
-- When allowed_categories is NULL, internal agents (Atlas, ptd-agent) get ALL
-- knowledge including findings, plans, architecture. LISA stays restricted.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.match_isolated_knowledge(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5,
    allowed_categories TEXT[] DEFAULT NULL  -- NULL = unrestricted (all categories)
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
      AND ak.embedding IS NOT NULL
      -- NULL = unrestricted. Otherwise filter by allowed categories.
      AND (allowed_categories IS NULL OR ak.category = ANY(allowed_categories))
      AND 1 - (ak.embedding <=> query_embedding) > match_threshold
    ORDER BY ak.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_isolated_knowledge(vector, FLOAT, INT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_isolated_knowledge(vector, FLOAT, INT, TEXT[]) TO service_role;

COMMENT ON FUNCTION public.match_isolated_knowledge IS 'Vector search for agent knowledge. NULL allowed_categories = all categories (internal). Explicit array = restricted (LISA).';
