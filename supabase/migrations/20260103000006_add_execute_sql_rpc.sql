-- Migration to add execute_sql_query RPC for AI Agent analysis
CREATE OR REPLACE FUNCTION public.execute_sql_query(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with high privilege to access all tables
AS $$
DECLARE
    result JSONB;
BEGIN
    -- Only allow SELECT queries for safety
    IF NOT (LOWER(sql_query) LIKE 'select%') THEN
        RETURN jsonb_build_object('error', 'Only SELECT queries are allowed.');
    END IF;

    -- Execute the query and convert to JSON
    EXECUTE 'SELECT jsonb_agg(t) FROM (' || sql_query || ') t' INTO result;
    
    RETURN result;
END;
$$;

-- Grant access to service_role (AI Agent)
GRANT EXECUTE ON FUNCTION public.execute_sql_query(TEXT) TO service_role;
