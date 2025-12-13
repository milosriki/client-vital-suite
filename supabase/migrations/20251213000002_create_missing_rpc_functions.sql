-- ============================================================
-- CRITICAL FIX: Create missing RPC functions referenced in code
-- These functions are called but were never defined
-- ============================================================

-- 1. exec_sql - Used by ai-trigger-deploy and run-setup.mjs
-- WARNING: This is a powerful function - restricted to service_role only
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    -- Only allow service_role to execute arbitrary SQL
    IF current_setting('request.jwt.claim.role', true) != 'service_role' THEN
        RAISE EXCEPTION 'exec_sql is restricted to service_role only';
    END IF;

    -- Execute the query and return result as JSON
    EXECUTE sql_query INTO result;
    RETURN COALESCE(result, '{"success": true}'::jsonb);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'error', SQLERRM,
            'detail', SQLSTATE
        );
END;
$$;

-- Grant only to service_role
REVOKE ALL ON FUNCTION public.exec_sql(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO service_role;

COMMENT ON FUNCTION public.exec_sql(TEXT) IS 'Execute arbitrary SQL (service_role only) - used by deployment scripts';

-- 2. execute_sql_query - Used by ptd-agent-gemini for read-only queries
-- This is a safer version that only allows SELECT statements
CREATE OR REPLACE FUNCTION public.execute_sql_query(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
    cleaned_query TEXT;
BEGIN
    -- Clean and validate the query
    cleaned_query := TRIM(sql_query);

    -- Only allow SELECT statements (read-only)
    IF NOT (
        cleaned_query ~* '^SELECT\s' OR
        cleaned_query ~* '^WITH\s' OR
        cleaned_query ~* '^\(\s*SELECT\s'
    ) THEN
        RAISE EXCEPTION 'Only SELECT queries are allowed';
    END IF;

    -- Block dangerous patterns
    IF cleaned_query ~* '(DROP|DELETE|TRUNCATE|INSERT|UPDATE|ALTER|CREATE|GRANT|REVOKE|COPY|pg_|information_schema\.role)' THEN
        RAISE EXCEPTION 'Query contains disallowed keywords';
    END IF;

    -- Execute and return as JSON array
    EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || cleaned_query || ') t'
    INTO result;

    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'error', SQLERRM,
            'query', sql_query
        );
END;
$$;

-- Grant to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.execute_sql_query(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_sql_query(TEXT) TO service_role;

COMMENT ON FUNCTION public.execute_sql_query(TEXT) IS 'Execute read-only SQL queries - used by PTD Agent for data retrieval';

-- 3. prune_thread_memories - Used by LangChain memory management
-- Cleans up old conversation memories to prevent token overflow
CREATE OR REPLACE FUNCTION public.prune_thread_memories(
    p_thread_id TEXT,
    p_max_messages INTEGER DEFAULT 50,
    p_max_age_days INTEGER DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER := 0;
    thread_uuid UUID;
BEGIN
    -- Try to convert thread_id to UUID, handle gracefully if not valid
    BEGIN
        thread_uuid := p_thread_id::UUID;
    EXCEPTION
        WHEN invalid_text_representation THEN
            -- If thread_id is not a valid UUID, try to find by external_id
            SELECT id INTO thread_uuid FROM public.conversation_threads
            WHERE external_id = p_thread_id LIMIT 1;
    END;

    IF thread_uuid IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Thread not found',
            'thread_id', p_thread_id
        );
    END IF;

    -- Delete old messages beyond max count (keep most recent)
    WITH ranked_messages AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
        FROM public.conversation_messages
        WHERE thread_id = thread_uuid
    ),
    to_delete AS (
        SELECT id FROM ranked_messages WHERE rn > p_max_messages
    )
    DELETE FROM public.conversation_messages
    WHERE id IN (SELECT id FROM to_delete);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Also delete messages older than max_age_days
    DELETE FROM public.conversation_messages
    WHERE thread_id = thread_uuid
    AND created_at < NOW() - (p_max_age_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_count', deleted_count,
        'thread_id', thread_uuid,
        'max_messages', p_max_messages,
        'max_age_days', p_max_age_days
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'thread_id', p_thread_id
        );
END;
$$;

GRANT EXECUTE ON FUNCTION public.prune_thread_memories(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prune_thread_memories(TEXT, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION public.prune_thread_memories(TEXT, INTEGER, INTEGER) IS 'Prune old conversation memories to prevent token overflow';

-- 4. match_memories - Enhanced version for RAG retrieval
-- Check if it exists first, create if not
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'match_memories'
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        EXECUTE $func$
        CREATE FUNCTION public.match_memories(
            query_embedding vector(1536),
            match_threshold FLOAT DEFAULT 0.7,
            match_count INT DEFAULT 5,
            p_thread_id TEXT DEFAULT NULL
        )
        RETURNS TABLE (
            id UUID,
            content TEXT,
            role TEXT,
            similarity FLOAT,
            created_at TIMESTAMPTZ,
            metadata JSONB
        )
        LANGUAGE plpgsql
        AS $inner$
        BEGIN
            RETURN QUERY
            SELECT
                cm.id,
                cm.content,
                cm.role,
                1 - (cm.embedding <=> query_embedding) as similarity,
                cm.created_at,
                cm.metadata
            FROM public.conversation_messages cm
            WHERE
                cm.embedding IS NOT NULL
                AND (p_thread_id IS NULL OR cm.thread_id::TEXT = p_thread_id)
                AND 1 - (cm.embedding <=> query_embedding) > match_threshold
            ORDER BY cm.embedding <=> query_embedding
            LIMIT match_count;
        END;
        $inner$;

        GRANT EXECUTE ON FUNCTION public.match_memories(vector, FLOAT, INT, TEXT) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.match_memories(vector, FLOAT, INT, TEXT) TO service_role;
        $func$;
    END IF;
END $$;

-- 5. Ensure conversation_threads table exists for prune_thread_memories
CREATE TABLE IF NOT EXISTS public.conversation_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT UNIQUE,
    user_id UUID REFERENCES auth.users(id),
    title TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threads_external_id ON public.conversation_threads(external_id);
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON public.conversation_threads(user_id);

-- 6. Ensure conversation_messages table exists
CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'function')),
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON public.conversation_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.conversation_messages(created_at);

-- Enable RLS
ALTER TABLE public.conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY IF NOT EXISTS "Service role full access threads"
    ON public.conversation_threads FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Service role full access messages"
    ON public.conversation_messages FOR ALL USING (true);

COMMENT ON TABLE public.conversation_threads IS 'LangChain conversation threads for memory management';
COMMENT ON TABLE public.conversation_messages IS 'Messages within conversation threads';
