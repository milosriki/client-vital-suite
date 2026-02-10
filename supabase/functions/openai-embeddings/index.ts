import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === 'OPTIONS') {
    return apiCorsPreFlight();
  }

  try {
    const { text } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log(`Generating embedding for ${text.length} chars`);

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000), // Limit input size
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI embeddings error:', error);
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    const embedding = data.data[0].embedding;

    console.log(`✅ Generated ${embedding.length}-dim embedding`);

    return apiSuccess({ 
      embedding,
      dimensions: embedding.length,
      model: 'text-embedding-3-small'
    });

  } catch (error: unknown) {
    console.error('Embeddings error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return apiError("INTERNAL_ERROR", JSON.stringify({ error: errMsg }), 500);
  }
});
