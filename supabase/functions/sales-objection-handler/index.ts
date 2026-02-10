/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildAgentPrompt } from "../_shared/unified-prompts.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import {
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
  corsHeaders,
  handleError,
  ErrorCode,
} from "../_shared/error-handler.ts";

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
    const { objection_text, client_context = {} } = await req.json();

    if (!objection_text) {
      throw new Error("Missing objection_text");
    }

    console.log(`🛡️ Handling Objection: "${objection_text}"`);

    // 1. Build Persona
    const systemPrompt = buildAgentPrompt("SALES_OBJECTION_HANDLER", {
      additionalContext: `
            CLIENT CONTEXT:
            Name: ${client_context.name || "Unknown"}
            Goal: ${client_context.goal || "Unknown"}
            
            NEPQ FRAMEWORK RULES:
            1. NEVER argue or defend.
            2. ALWAYS "Diffuse" first ("I totally understand", "That makes sense").
            3. Use "Pattern Interrupts" to break their script.
            4. End with a clarifying question, NOT a statement.
        `,
    });

    // 2. User Prompt
    const userPrompt = `
        OBJECTION: "${objection_text}"
        
        YOUR TASK:
        Provide 3 specific responses using NEPQ logic:
        1. "The Diffuse" (Soft, disarming)
        2. "The Re-Frame" (Shift perspective)
        3. "The Question" (Put ball back in their court)
        
        Also provide a strict "Classification" of this objection (e.g., Financial, Spousal, Fear, Timing).
    `;

    // 3. Execute AI
    const aiResponse = await unifiedAI.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        jsonMode: true,
        temperature: 0.4,
      },
    );

    return apiSuccess({
        success: true,
        objection: objection_text,
        analysis: JSON.parse(aiResponse.content),
      });
  } catch (error: unknown) {
    return handleError(error, "sales-objection-handler", {
      supabase: createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ),
      errorCode: ErrorCode.INTERNAL_ERROR,
      context: { function: "sales-objection-handler" },
    });
  }
});
