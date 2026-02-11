import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Helper for Semantic Chunking (Mirroring process-knowledge)
function chunkTextSemantically(text: string, maxChunkSize = 1000): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [text];
  const chunks: string[] = [];
  let currentChunk = "";
  for (const sentence of sentences) {
    if (
      (currentChunk + sentence).length > maxChunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());
  return chunks;
}

serve(async (req) => {
  try {
    verifyAuth(req);
  } catch (e) {
    return errorToResponse(new UnauthorizedError());
  }
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    const {
      action = "generate",
      text,
      id,
      table = "knowledge_chunks", // Default to optimized table
      metadata = {},
    } = await req.json();
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Action: Generate embedding for new content and insert
    if (action === "generate" && text) {
      // 1. Chunk
      const chunks = chunkTextSemantically(text);
      const insertedData = [];

      // 2. Embed & Insert Each Chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await unifiedAI.embed(chunk);

        const { data, error } = await supabase
          .from("knowledge_chunks")
          .insert({
            content: chunk,
            chunk_index: i,
            filepath: metadata.filename || `gen_${Date.now()}`,
            embedding,
            metadata: {
              ...metadata,
              embedding_model: "text-embedding-004",
              source_text_length: text.length,
            },
          })
          .select()
          .single();

        if (error) throw error;
        insertedData.push(data);
      }

      return apiSuccess({
        success: true,
        chunks_processed: chunks.length,
        data: insertedData,
      });
    }

    // Action: Update embedding for existing row (Assuming knowledge_chunks structure)
    if (action === "update" && id) {
      const { data: row } = await supabase
        .from(table)
        .select("content")
        .eq("id", id)
        .single();

      if (!row) throw new Error("Row not found");

      // For update, we re-embed the content.
      // NOTE: If content changed significantly, we arguably should re-chunk, but 'update' implies modifying a specific row/chunk.
      // We will assume 'id' refers to a specific chunk here.
      const embedding = await unifiedAI.embed(row.content);

      const { error } = await supabase
        .from(table)
        .update({
          embedding,
          metadata: {
            ...metadata,
            embedding_model: "text-embedding-004",
            updated_at: new Date(),
          },
        })
        .eq("id", id);

      if (error) throw error;

      return apiSuccess({ success: true, updated: id });
    }

    // Action: Batch update (Legacy/Maintenance)
    // Refactored to update knowledge_chunks logic if needed, but primarily strict.
    if (action === "batch") {
      return apiSuccess({
        error: "Batch update deprecated for semantic chunks. Use re-ingestion.",
      });
    }

    throw new Error("Invalid action or missing parameters");
  } catch (error: unknown) {
    console.error("generate-embeddings error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return apiSuccess({ error: errMsg });
  }
});
