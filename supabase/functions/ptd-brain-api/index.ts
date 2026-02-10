import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import {
  handleError,
  corsHeaders,
  ErrorCode,
} from "../_shared/error-handler.ts";

const FUNCTION_NAME = "ptd-brain-api";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    verifyAuth(req);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get params from URL or Body
    const url = new URL(req.url);
    const body = await req.text().then((t) => (t ? JSON.parse(t) : {}));
    const action = url.searchParams.get("action") || body.action;

    // ==========================================
    // 1. RECALL (RAG Search) - GEMINI POWERED
    // ==========================================
    if (action === "recall") {
      const query = url.searchParams.get("query") || body.query;
      if (!query) throw new Error("Query required");

      // Generate Embedding (Gemini 768d)
      const embedding = await unifiedAI.generateEmbedding(query);

      // Match against knowledge_chunks (new table)
      const { data: chunks, error } = await supabase.rpc(
        "match_knowledge_chunks",
        {
          query_embedding: embedding,
          match_threshold: 0.6, // Slightly lower for Gemini 004
          match_count: 8,
        },
      );

      if (error) throw error;

      return apiSuccess({ ok: true, matches: chunks });
    }

    // ==========================================
    // 2. RECENT KNOWLEDGE (For Dashboard)
    // ==========================================
    if (action === "recent_knowledge") {
      const limit = parseInt(url.searchParams.get("limit") || "20");

      const { data: chunks, error } = await supabase
        .from("knowledge_chunks")
        .select("id, content, created_at, category")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return apiSuccess({ ok: true, chunks });
    }

    // ==========================================
    // 3. STATS (For Dashboard)
    // ==========================================
    if (action === "stats") {
      const { count: chunkCount } = await supabase
        .from("knowledge_chunks")
        .select("*", { count: "exact", head: true });

      const { count: memoryCount } = await supabase
        .from("agent_memory")
        .select("*", { count: "exact", head: true });

      return apiSuccess({
        ok: true,
        stats: {
          total_knowledge_chunks: chunkCount || 0,
          total_agent_memories: memoryCount || 0,
        },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    return handleError(error, FUNCTION_NAME, {
      errorCode: ErrorCode.UNKNOWN_ERROR,
      context: { action: "brain_api" },
    });
  }
});
