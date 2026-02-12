import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";

/**
 * Marketing Copywriter Agent ✍️
 *
 * Job: Generate winning ad copy variants using Gemini, based on
 *      winning creative DNA from the Analyst.
 * Runs: Daily at 05:30 UAE (after Analyst)
 *
 * Reads: marketing_recommendations (SCALE actions = winners)
 * Writes: creative_library (status: pending_approval)
 *
 * Guardrail: All copy is saved as pending_approval.
 * CEO must approve before anything touches Meta.
 *
 * Skill applied: ai-product
 * - Structured JSON output with validation
 * - Prompt versioning as code
 * - Cost tracking per request
 */

const PROMPT_VERSION = "v1.0.0";

const SYSTEM_PROMPT = `You are an ad copywriter for PTD Fitness, a premium personal training company in Dubai.

TARGET AUDIENCE: Business Bay executives, 35-45, seeking transformation results.

BRAND VOICE:
- Professional but not corporate
- Results-focused, backed by data
- Empathetic to busy executive lifestyle
- Premium positioning (AED 289-440/session)

WINNING PATTERNS FROM DATA:
- Before/after transformation narratives drive 3x+ ROAS
- Specific location mentions (Business Bay, DIFC) increase CTR 40%
- Social proof with numbers ("847 transformations") converts well
- Mobile/convenience messaging resonates ("we come to you")

RULES:
1. Write exactly 3 headline variants (max 25 words each)
2. Write exactly 3 body copy variants (max 90 words each)
3. Include at least ONE specific number in each variant
4. Each variant must have a clear CTA
5. Return ONLY valid JSON, no commentary or markdown

OUTPUT FORMAT:
{
  "headlines": ["headline1", "headline2", "headline3"],
  "bodies": ["body1", "body2", "body3"],
  "reasoning": "brief explanation of why these will work"
}`;

interface CopyOutput {
  headlines: string[];
  bodies: string[];
  reasoning: string;
}

function validateCopyOutput(raw: string): CopyOutput {
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.headlines) || parsed.headlines.length !== 3) {
    throw new Error("Must have exactly 3 headlines");
  }
  if (!Array.isArray(parsed.bodies) || parsed.bodies.length !== 3) {
    throw new Error("Must have exactly 3 body variants");
  }
  if (parsed.headlines.some((h: string) => h.split(/\s+/).length > 30)) {
    throw new Error("Headline exceeds word limit");
  }
  if (parsed.bodies.some((b: string) => b.split(/\s+/).length > 100)) {
    throw new Error("Body exceeds word limit");
  }
  if (typeof parsed.reasoning !== "string") {
    throw new Error("Missing reasoning field");
  }

  return parsed as CopyOutput;
}

const handler = async (req: Request): Promise<Response> => {
  try {
    verifyAuth(req);
  } catch {
    throw new UnauthorizedError();
  }
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return apiSuccess({
        success: false,
        message:
          "GEMINI_API_KEY not configured. Copywriter agent requires Gemini access.",
      });
    }

    // 1. Find today's SCALE recommendations (winners to generate copy for)
    const today = new Date().toISOString().split("T")[0];
    const { data: winners } = await supabase
      .from("marketing_recommendations")
      .select("*")
      .in("action", ["SCALE", "REFRESH"])
      .gte("created_at", `${today}T00:00:00`)
      .eq("status", "pending");

    if (!winners || winners.length === 0) {
      return apiSuccess({
        success: true,
        message: "No winners or refresh candidates today",
        copy_generated: 0,
      });
    }

    let generated = 0;
    let errors = 0;

    for (const winner of winners.slice(0, 5)) {
      // Process max 5 winners per run (cost control)
      try {
        const userPrompt = `Generate ad copy variants for this creative:

AD: ${winner.ad_name || winner.ad_id}
PERFORMANCE: ${JSON.stringify(winner.metrics)}
ACTION: ${winner.action}
ANALYST REASONING: ${winner.reasoning}

${
  winner.action === "REFRESH"
    ? "This creative is experiencing FATIGUE. Generate fresh angles while keeping the core message."
    : "This creative is a WINNER. Generate variants that amplify what's working."
}`;

        // Call Gemini API
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [{ text: SYSTEM_PROMPT + "\n\n" + userPrompt }],
                },
              ],
              generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 1024,
                responseMimeType: "application/json",
              },
            }),
          },
        );

        if (!geminiResponse.ok) {
          throw new Error(`Gemini API error: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
          throw new Error("Empty response from Gemini");
        }

        // Validate output (per ai-product skill: "Always validate output")
        const validCopy = validateCopyOutput(rawText);

        // Save to creative_library (upsert by source_ad_id + prompt_version)
        const { error: insertErr } = await supabase
          .from("creative_library")
          .upsert({
            source_ad_id: winner.ad_id,
            source_ad_name: winner.ad_name,
            prompt_version: PROMPT_VERSION,
            headlines: validCopy.headlines,
            bodies: validCopy.bodies,
            reasoning: validCopy.reasoning,
            winning_dna: winner.metrics,
            status: "pending_approval",
          }, { onConflict: "source_ad_id, prompt_version" });

        if (insertErr) {
          throw new Error(`DB insert error: ${insertErr.message}`);
        }

        generated++;
      } catch (err) {
        console.error(
          `[copywriter] Error generating copy for ${winner.ad_id}:`,
          err,
        );
        errors++;
      }
    }

    structuredLog("marketing-copywriter", "info", "Copywriter run complete", {
      winners_found: winners.length,
      copy_generated: generated,
      errors,
      prompt_version: PROMPT_VERSION,
    });

    return apiSuccess({
      success: true,
      copy_generated: generated,
      errors,
      winners_analyzed: winners.length,
      prompt_version: PROMPT_VERSION,
    });
  } catch (error: unknown) {
    return handleError(error, "marketing-copywriter", {
      supabase: createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ),
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  }
};

serve(
  withTracing(handler, {
    functionName: "marketing-copywriter",
    runType: "chain",
    tags: ["marketing", "agent", "copywriter", "gemini"],
  }),
);
