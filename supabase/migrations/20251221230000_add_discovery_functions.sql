-- Function to get all tables with metadata
DROP FUNCTION IF EXISTS get_all_tables();
CREATE OR REPLACE FUNCTION get_all_tables()
RETURNS TABLE (
  table_name text,
  column_count bigint,
  row_estimate bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.table_name::text,
    count(c.column_name)::bigint as column_count,
    (SELECT reltuples::bigint FROM pg_class WHERE relname = t.table_name) as row_estimate
  FROM
    information_schema.tables t
    LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
  WHERE
    t.table_schema = 'public'
  GROUP BY
    t.table_name;
END;
$$;

-- Function to get all functions with metadata
DROP FUNCTION IF EXISTS get_all_functions();
CREATE OR REPLACE FUNCTION get_all_functions()
RETURNS TABLE (
  function_name text,
  parameter_count bigint,
  return_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.routine_name::text,
    count(p.parameter_name)::bigint as parameter_count,
    r.data_type::text as return_type
  FROM
    information_schema.routines r
    LEFT JOIN information_schema.parameters p ON r.specific_name = p.specific_name
  WHERE
    r.routine_schema = 'public'
  GROUP BY
    r.routine_name, r.data_type;
END;
$$;
