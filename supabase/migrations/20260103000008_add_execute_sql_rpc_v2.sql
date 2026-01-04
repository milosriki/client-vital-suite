-- Migration to add execute_sql_query RPC for AI Agent analysis
-- (Already created in previous turn but perhaps not pushed)
CREATE OR REPLACE FUNCTION public.execute_sql_query(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    IF NOT (LOWER(sql_query) LIKE 'select%') THEN
        RETURN jsonb_build_object('error', 'Only SELECT queries are allowed.');
    END IF;
    EXECUTE 'SELECT jsonb_agg(t) FROM (' || sql_query || ') t' INTO result;
    RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.execute_sql_query(TEXT) TO service_role;
