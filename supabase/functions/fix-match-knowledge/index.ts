import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    verifyAuth(req);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fix the match_knowledge RPC function
    const { error } = await supabase.rpc("exec_sql", {
      sql: `
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
          tags jsonb,
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
      `,
    });

    if (error) {
      // Try direct SQL if exec_sql doesn't exist
      console.warn("exec_sql not available, trying direct approach:", error.message);
      return apiSuccess({
        success: false,
        message: "Need to run SQL directly via Supabase dashboard or migration",
        sql: `CREATE OR REPLACE FUNCTION match_knowledge(query_embedding vector(1536), match_threshold float DEFAULT 0.3, match_count int DEFAULT 5) RETURNS TABLE (id uuid, category text, question text, answer text, tags jsonb, similarity float) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY SELECT k.id, k.category, k.question, k.answer, k.tags, (1 - (k.embedding <=> query_embedding))::float AS similarity FROM knowledge_base k WHERE k.is_active = true AND k.embedding IS NOT NULL AND (1 - (k.embedding <=> query_embedding)) > match_threshold ORDER BY k.embedding <=> query_embedding LIMIT match_count; END; $$;`,
      });
    }

    return apiSuccess({ success: true, message: "match_knowledge RPC created/updated" });
  } catch (error: unknown) {
    return handleError(error, "fix-match-knowledge", {
      errorCode: ErrorCode.UNKNOWN_ERROR,
    });
  }
});
