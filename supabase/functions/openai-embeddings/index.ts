import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  try {
    verifyAuth(req);
  } catch {
    throw new UnauthorizedError();
  } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    const { text } = await req.json();

    if (!text) {
      throw new Error("Text is required");
    }

    // Switched to UnifiedAI (Gemini) - No longer depends on OPENAI_API_KEY
    const embedding = await unifiedAI.embed(text);

    console.log(`✅ Generated ${embedding.length}-dim embedding (Gemini)`);

    return apiSuccess({
      embedding,
      dimensions: embedding.length,
      model: "text-embedding-004", // Gemini embedding model
    });
  } catch (error: unknown) {
    console.error("Embeddings error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return apiError("INTERNAL_ERROR", JSON.stringify({ error: errMsg }), 500);
  }
});
