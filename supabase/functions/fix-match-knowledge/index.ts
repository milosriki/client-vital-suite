import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";

const DB_URL = Deno.env.get("SUPABASE_DB_URL");

serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    verifyAuth(req);
    if (!DB_URL) return apiError("INTERNAL_ERROR", "Missing SUPABASE_DB_URL", 500);

    const client = new Client(DB_URL);
    await client.connect();

    // Drop old version first (different return type)
    await client.queryArray(`DROP FUNCTION IF EXISTS match_knowledge(vector, float, int);`);

    await client.queryArray(`
      CREATE OR REPLACE FUNCTION match_knowledge(
        query_embedding vector(1536),
        match_threshold float DEFAULT 0.3,
        match_count int DEFAULT 5
      )
      RETURNS TABLE (
        id uuid,
        category text,
        question text,
        answer text,
        tags text[],
        similarity float
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          k.id,
          k.category,
          k.question,
          k.answer,
          k.tags,
          (1 - (k.embedding <=> query_embedding))::float AS similarity
        FROM knowledge_base k
        WHERE k.is_active = true
          AND k.embedding IS NOT NULL
          AND (1 - (k.embedding <=> query_embedding)) > match_threshold
        ORDER BY k.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $$;
    `);

    await client.end();

    return apiSuccess({ success: true, message: "match_knowledge RPC created successfully" });
  } catch (error: any) {
    console.error("Error:", error);
    return apiError("INTERNAL_ERROR", error?.message || "Unknown error", 500);
  }
});
