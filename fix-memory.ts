import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { config } from "https://deno.land/x/dotenv/mod.ts";

const env = config({ path: "/Users/milosvukovic/client-vital-suite/.env.local" });
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Service Role Key in .env.local");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
CREATE OR REPLACE FUNCTION match_agent_memory(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  role text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.content,
    am.role,
    1 - (am.embedding <=> query_embedding) AS similarity
  FROM agent_memory am
  WHERE 1 - (am.embedding <=> query_embedding) > match_threshold
  ORDER BY am.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
`;

const { error } = await supabase.rpc("execute_sql", { sql_query: sql });

if (error) {
  console.error("Error executing SQL:", error);
} else {
  console.log("Success: match_agent_memory function updated!");
}
