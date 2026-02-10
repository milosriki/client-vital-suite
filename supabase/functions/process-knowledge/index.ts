import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// SEMANTIC CHUNKING (SENTENCE-AWARE)
// ============================================================================
function chunkTextSemantically(text: string, maxChunkSize = 1000): string[] {
  // 1. Split by sentence boundaries (period, question, exclamation + space/newline)
  // distinct lookbehind (?<=...) not supported in all JS engines, but standard split works well enough
  // We use a regex that keeps the delimiter
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

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

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
    const { content, filename, metadata } = await req.json();

    if (!content || !filename) {
      throw new Error("Content and filename are required");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Processing knowledge file: ${filename}`);

    // 1. Semantic Chunking
    const chunks = chunkTextSemantically(content);
    console.log(`Created ${chunks.length} semantic chunks`);

    // 2. Process Each Chunk (Embed & Insert)
    // This aligns with Embedding Strategies: "Index at multiple chunk sizes" -> We are indexing chunks.
    let processed = 0;

    // Using for...of loop to handle async/await correctly
    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = chunks[i];

      // Generate Embedding for THIS CHUNK (Gemini 004 = 768 dims)
      const embedding = await unifiedAI.embed(chunkContent);

      // Insert into knowledge_chunks
      const { error } = await supabase.from("knowledge_chunks").insert({
        filepath: filename,
        content: chunkContent,
        chunk_index: i,
        embedding: embedding,
        metadata: {
          ...metadata,
          embedding_model: "text-embedding-004",
          total_chunks: chunks.length,
        },
      });

      if (error) {
        console.error(`Failed to insert chunk ${i}:`, error);
      } else {
        processed++;
      }
    }

    console.log(
      `✅ Saved ${processed}/${chunks.length} chunks to knowledge_chunks`,
    );

    return apiError("INTERNAL_ERROR", JSON.stringify({
        success: true,
        document_id: filename,
        chunks_created: chunks.length,
        chunks_processed: processed,
        message: `Learned from ${filename} using Gemini Brain! Indexed ${processed} chunks.`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("Process knowledge error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return apiSuccess({ error: errMsg });
  }
});
