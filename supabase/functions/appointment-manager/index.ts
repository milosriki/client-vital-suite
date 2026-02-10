/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildAgentPrompt,
  AGENT_ROLES,
  LISA_PERSONA,
} from "../_shared/unified-prompts.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import {
  corsHeaders,
  handleError,
  ErrorCode,
} from "../_shared/error-handler.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limiter.ts";
import {
  UnauthorizedError,
  ValidationError,
  errorToResponse,
} from "../_shared/app-errors.ts";

serve(async (req) => {
  // CORS preflight — per api-patterns skill
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    // Auth — per auth-implementation-patterns skill
    try {
      verifyAuth(req);
    } catch {
      throw new UnauthorizedError();
    }

    // Rate limit — per api-patterns/rate-limiting.md
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const allowed = checkRateLimit(ip, RATE_LIMITS.chat);
    if (!allowed)
      throw new (await import("../_shared/app-errors.ts")).RateLimitError();
    // Input validation — per api-patterns/validation.md
    const body = await req.json();
    const { message, contact_id, current_slots = [] } = body;

    if (!message) {
      throw new ValidationError("Missing required field: message", ["message"]);
    }

    console.log(`📅 Managing Appointment for Contact: ${contact_id}`);

    // 1. Build Persona (Lisa - Executive Scheduler)
    const systemPrompt = buildAgentPrompt("CALENDAR_NEGOTIATOR", {
      additionalContext: `
            LISA'S CORE DIRECTIVE:
            You are Lisa from PTD Fitness. LEAD the conversation. Never sell. Never explain what PTD is.
            SHOW expertise through the questions you ask — sleep, stress, lifestyle. They'll figure out you're different.
            
            HUMAN TOUCH RULES:
            - DETECT EMOTION: If they sound stressed/tired, acknowledge it FIRST. ("you sound exhausted. let's sort that first.")
            - SCARCITY IS REAL: Open spots are limited because the coach builds a custom plan for each person.
            
            SCARCITY EXECUTION:
            - NEVER offer more than 2 slots.
            - FRAME: "i have one opening at" or "there's a spot on" — natural, not scripted.
            - ALWAYS: "free assessment where the coach builds your custom plan"
            
            AVAILABLE SLOTS:
            ${JSON.stringify(current_slots.length > 0 ? current_slots : ["Tomorrow 2pm", "Tomorrow 4pm", "Thursday 10am"])}
        `,
    });

    // 2. User Prompt
    const userPrompt = `
        INCOMING MESSAGE: "${message}"
        
        YOUR TASK:
        1. Analyze intent (Booking + Sentiment).
        2. IF sentiment is negative (stress/tired), use "Empathy First" approach.
        3. IF intent is pure booking, use "Alternative Close" with "Big Sister" warmth.
        4. Respond as Lisa.
    `;

    // 3. Execute AI
    const aiResponse = await unifiedAI.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        jsonMode: true,
        temperature: 0.3, // Lower temp for precise scheduling
      },
    );

    // Success — per api-patterns/response.md: envelope pattern
    structuredLog("info", "appointment-manager: success", { contact_id });
    return apiSuccess({
      scheduler_response: JSON.parse(aiResponse.content),
    });
  } catch (error: unknown) {
    // Enterprise error handling — per error-handling-patterns skill
    structuredLog("error", "appointment-manager: failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return errorToResponse(error);
  }
});
