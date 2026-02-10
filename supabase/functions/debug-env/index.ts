import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.16.0";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import {
  handleError,
  ErrorCode,
  corsHeaders as defaultCorsHeaders,
} from "../_shared/error-handler.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

serve(async (req) => {
  try {
    verifyAuth(req);
  } catch {
    throw new UnauthorizedError();
  } // Security Hardening
  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  if (!geminiKey) {
    return apiError("INTERNAL_ERROR", "GEMINI_API_KEY is missing", 500);
  }

  try {
    // We can't easily list models via the simple SDK wrapper in this version without a fetch
    // So we'll just try a raw fetch to the models endpoint
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
    );
    const data = await response.json();

    return apiSuccess({
      success: true,
      provider: "gemini_list",
      models: data,
    });
  } catch (error: unknown) {
    return apiSuccess({
      success: false,
      provider: "gemini",
      error: error.message,
      stack: error.stack,
    });
  }
});
