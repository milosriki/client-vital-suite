/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { buildAgentPrompt } from "../_shared/unified-prompts.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import {
  corsHeaders,
  handleError,
  ErrorCode,
} from "../_shared/error-handler.ts";

const ObjectionResponseSchema = z.object({
  response: z.string().min(1),
  technique: z.enum(["diffuse", "reframe", "question", "nepq_combined"]),
  confidence: z.number().min(0).max(1),
});

const ObjectionAnalysisSchema = z.object({
  classification: z.string(),
  responses: z.array(ObjectionResponseSchema).min(1).max(5),
});

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

    // 2. User Prompt with structured output spec
    const userPrompt = `OBJECTION: "${objection_text}"

YOUR TASK: Provide 3 specific responses using NEPQ logic.
Return strict JSON:
{
  "classification": "<Financial | Spousal | Fear | Timing | Commitment | Trust | Other>",
  "responses": [
    { "response": "<The Diffuse — soft, disarming>", "technique": "diffuse", "confidence": <0-1> },
    { "response": "<The Re-Frame — shift perspective>", "technique": "reframe", "confidence": <0-1> },
    { "response": "<The Question — put ball back in their court>", "technique": "question", "confidence": <0-1> }
  ]
}

ERROR RECOVERY:
- If the objection is vague or unclear, still classify it as "Other" and provide generic NEPQ responses with confidence below 0.4.
- Never return an empty responses array. Always provide at least one response.`;

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

    let analysis: z.infer<typeof ObjectionAnalysisSchema> | Record<string, unknown>;
    try {
      const raw = JSON.parse(aiResponse.content);
      const parsed = ObjectionAnalysisSchema.safeParse(raw);
      if (parsed.success) {
        analysis = parsed.data;
      } else {
        console.warn("[sales-objection-handler] Zod validation failed:", parsed.error.issues);
        analysis = raw;
      }
    } catch {
      analysis = { raw_response: aiResponse.content, validation_error: "Failed to parse JSON" };
    }

    return apiSuccess({
        success: true,
        objection: objection_text,
        analysis,
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
