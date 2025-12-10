-- Function to discover all tables in the database
CREATE OR REPLACE FUNCTION public.get_all_tables()
RETURNS TABLE(table_name TEXT, column_count BIGINT, row_estimate BIGINT) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_name::TEXT,
    COUNT(c.column_name)::BIGINT as column_count,
    COALESCE(
      (SELECT reltuples::BIGINT FROM pg_class WHERE relname = t.table_name), 
      0
    ) as row_estimate
  FROM information_schema.tables t
  LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
  WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  GROUP BY t.table_name
  ORDER BY t.table_name;
END;
$$;

-- Function to discover all database functions
CREATE OR REPLACE FUNCTION public.get_all_functions()
RETURNS TABLE(function_name TEXT, parameter_count INTEGER, return_type TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.proname::TEXT as function_name,
    p.pronargs::INTEGER as parameter_count,
    pg_catalog.pg_get_function_result(p.oid)::TEXT as return_type
  FROM pg_catalog.pg_proc p
  LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
  ORDER BY p.proname;
END;
$$;

-- Function to get table columns with types
CREATE OR REPLACE FUNCTION public.get_table_columns(target_table TEXT)
RETURNS TABLE(column_name TEXT, data_type TEXT, is_nullable TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = target_table
  ORDER BY c.ordinal_position;
END;
$$;