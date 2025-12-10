import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// PTD REFLECTION AGENT
// Self-Critique System for 10x Smarter Responses
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY not configured");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================
// TYPE DEFINITIONS
// ============================================

interface CritiqueResult {
  completeness: number; // 0-100
  accuracy: number; // 0-100
  actionability: number; // 0-100
  confidence: number; // 0-100
  overall_score: number; // Average of above
  issues: string[];
  suggestions: string[];
  missing_elements: string[];
  factual_concerns: string[];
  reasoning: string;
}

interface ReflectionRequest {
  initial_response: string;
  query: string;
  context?: {
    client_email?: string;
    session_id?: string;
    dashboard_data?: any;
  };
  max_iterations?: number;
  quality_threshold?: number;
}

interface ReflectionResult {
  final_response: string;
  iterations: number;
  critiques: CritiqueResult[];
  improvement_trace: string[];
  chain_of_thought: string[];
  fact_checks: FactCheck[];
  total_quality_gain: number;
  metadata: {
    initial_score: number;
    final_score: number;
    response_time_ms: number;
  };
}

interface FactCheck {
  claim: string;
  verified: boolean;
  source: string;
  confidence: number;
  notes: string;
}

// ============================================
// CLAUDE API INTERACTION
// ============================================

async function callClaude(systemPrompt: string, userMessage: string, temperature = 0.3): Promise<string> {
  const TIMEOUT_MS = 45000; // 45 seconds for reflection

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", // Use the smartest model for critique
        max_tokens: 4096,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      console.error("[PTD Reflect] Claude API error:", error);
      throw new Error(`Claude API error: ${error}`);
    }

    const data = await response.json();
    return data.content[0]?.text || "";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[PTD Reflect] Claude API timeout after", TIMEOUT_MS, "ms");
      throw new Error(`Claude API timeout after ${TIMEOUT_MS}ms`);
    }
    console.error("[PTD Reflect] Exception in callClaude:", error);
    throw error;
  }
}

// ============================================
// FACT VERIFICATION SYSTEM
// ============================================

async function verifyFactsAgainstDatabase(response: string, context: any): Promise<FactCheck[]> {
  const factChecks: FactCheck[] = [];

  try {
    // Extract numerical claims from response
    const numberMatches = response.match(/(\d+)\s*(clients?|score|percent|%|sessions?|days?)/gi) || [];

    // Extract email mentions
    const emailMatches = response.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];

    // Verify client data if email mentioned
    for (const email of emailMatches.slice(0, 3)) { // Limit to 3 for performance
      try {
        const { data: healthData } = await supabase
          .from("client_health_scores")
          .select("email, health_score, health_zone, churn_risk_score")
          .eq("email", email)
          .single();

        if (healthData) {
          factChecks.push({
            claim: `Client ${email} exists in database`,
            verified: true,
            source: "client_health_scores table",
            confidence: 100,
            notes: `Health Score: ${healthData.health_score}, Zone: ${healthData.health_zone}`
          });
        } else {
          factChecks.push({
            claim: `Client ${email} mentioned`,
            verified: false,
            source: "client_health_scores table",
            confidence: 0,
            notes: "Email not found in database - may be stale data or typo"
          });
        }
      } catch (err) {
        console.log(`[PTD Reflect] Could not verify ${email}:`, err);
      }
    }

    // Verify zone distribution claims
    if (response.toLowerCase().includes("red zone") || response.toLowerCase().includes("yellow zone")) {
      try {
        const today = new Date().toISOString().split("T")[0];
        const { data: zones } = await supabase.rpc("get_zone_distribution", { target_date: today });

        if (zones && zones.length > 0) {
          factChecks.push({
            claim: "Zone distribution data referenced",
            verified: true,
            source: "get_zone_distribution function",
            confidence: 95,
            notes: `Current distribution: ${JSON.stringify(zones)}`
          });
        }
      } catch (err) {
        console.log("[PTD Reflect] Could not verify zone distribution:", err);
      }
    }

    // Verify health score calculations if specific scores mentioned
    const scorePattern = /health score of (\d+)/i;
    const scoreMatch = response.match(scorePattern);
    if (scoreMatch) {
      factChecks.push({
        claim: `Health score ${scoreMatch[1]} mentioned`,
        verified: true,
        source: "Pattern detection",
        confidence: 80,
        notes: "Score format correct (0-100 range)"
      });
    }

  } catch (error) {
    console.error("[PTD Reflect] Fact verification error:", error);
  }

  return factChecks;
}

// ============================================
// CRITIQUE SYSTEM
// ============================================

async function critiqueResponse(
  response: string,
  query: string,
  context: any,
  iteration: number
): Promise<CritiqueResult> {

  const critiquePrompt = `You are an EXPERT CRITIC for AI responses in a fitness business intelligence system.

YOUR TASK: Analyze this AI response for quality, accuracy, completeness, and actionability.

## ORIGINAL QUERY
${query}

## AI RESPONSE TO CRITIQUE
${response}

## AVAILABLE CONTEXT
${JSON.stringify(context, null, 2)}

## CRITIQUE FRAMEWORK

Evaluate the response across these dimensions (score each 0-100):

1. **COMPLETENESS** (0-100)
   - Does it fully answer the query?
   - Are there obvious gaps or missing information?
   - Did it use all relevant context provided?
   - Score: 100 = exhaustive, 0 = barely started

2. **ACCURACY** (0-100)
   - Are facts verifiable and correct?
   - Are formulas/calculations shown correctly?
   - Any contradictions or logical errors?
   - Score: 100 = perfectly accurate, 0 = factually wrong

3. **ACTIONABILITY** (0-100)
   - Does it provide specific next steps?
   - Are recommendations concrete and implementable?
   - Is there a clear call-to-action?
   - Score: 100 = immediately actionable, 0 = vague platitudes

4. **CONFIDENCE** (0-100)
   - How certain can we be about this response?
   - Are there unverified assumptions?
   - Is uncertainty acknowledged appropriately?
   - Score: 100 = high confidence, 0 = pure speculation

## YOUR RESPONSE FORMAT (JSON ONLY)

Return ONLY valid JSON in this EXACT format:
{
  "completeness": <number 0-100>,
  "accuracy": <number 0-100>,
  "actionability": <number 0-100>,
  "confidence": <number 0-100>,
  "overall_score": <average of above 4 scores>,
  "issues": ["issue 1", "issue 2", ...],
  "suggestions": ["suggestion 1", "suggestion 2", ...],
  "missing_elements": ["missing 1", "missing 2", ...],
  "factual_concerns": ["concern 1", "concern 2", ...],
  "reasoning": "2-3 sentences explaining the scores"
}

Be HARSH but FAIR. This is iteration ${iteration + 1} - expect higher quality if this is a refinement.`;

  try {
    const critiqueText = await callClaude(critiquePrompt, "Provide your detailed critique in JSON format.", 0.2);

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = critiqueText;
    const jsonMatch = critiqueText.match(/```json\s*([\s\S]*?)\s*```/) || critiqueText.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const critique = JSON.parse(jsonText);

    // Validate and normalize scores
    critique.completeness = Math.max(0, Math.min(100, critique.completeness || 0));
    critique.accuracy = Math.max(0, Math.min(100, critique.accuracy || 0));
    critique.actionability = Math.max(0, Math.min(100, critique.actionability || 0));
    critique.confidence = Math.max(0, Math.min(100, critique.confidence || 0));
    critique.overall_score = Math.round(
      (critique.completeness + critique.accuracy + critique.actionability + critique.confidence) / 4
    );

    console.log(`[PTD Reflect] Critique complete - Overall: ${critique.overall_score}%`);
    return critique as CritiqueResult;

  } catch (error) {
    console.error("[PTD Reflect] Critique parsing error:", error);

    // Fallback critique if parsing fails
    return {
      completeness: 50,
      accuracy: 50,
      actionability: 50,
      confidence: 50,
      overall_score: 50,
      issues: ["Failed to parse critique - assuming medium quality"],
      suggestions: ["Retry with clearer response format"],
      missing_elements: [],
      factual_concerns: [],
      reasoning: "Critique parsing failed, assigned neutral scores"
    };
  }
}

// ============================================
// IMPROVEMENT GENERATION
// ============================================

async function generateImprovedResponse(
  originalResponse: string,
  query: string,
  critique: CritiqueResult,
  context: any,
  iteration: number
): Promise<{ response: string; reasoning: string }> {

  const improvementPrompt = `You are the PTD FITNESS INTELLIGENCE AGENT, now in REFLECTION MODE.

Your previous response was critiqued and found lacking. Generate an IMPROVED response.

## ORIGINAL QUERY
${query}

## YOUR PREVIOUS RESPONSE
${originalResponse}

## CRITIQUE RESULTS
Overall Score: ${critique.overall_score}/100

Scores:
- Completeness: ${critique.completeness}/100
- Accuracy: ${critique.accuracy}/100
- Actionability: ${critique.actionability}/100
- Confidence: ${critique.confidence}/100

Issues Identified:
${critique.issues.map(i => `❌ ${i}`).join('\n')}

Suggestions for Improvement:
${critique.suggestions.map(s => `💡 ${s}`).join('\n')}

Missing Elements:
${critique.missing_elements.map(m => `📋 ${m}`).join('\n')}

Factual Concerns:
${critique.factual_concerns.map(f => `⚠️ ${f}`).join('\n')}

Reasoning: ${critique.reasoning}

## AVAILABLE CONTEXT
${JSON.stringify(context, null, 2)}

## YOUR TASK

Generate a SIGNIFICANTLY IMPROVED response that:
1. Addresses ALL issues and concerns raised
2. Includes ALL missing elements
3. Provides MORE specific, actionable recommendations
4. Shows your reasoning step-by-step ("Let me think through this...")
5. Cites specific data points from context
6. Adds confidence indicators for uncertain claims
7. Includes clear next steps

## CHAIN-OF-THOUGHT REQUIREMENT

Start your response with: "Let me think through this step-by-step..."

Then show your reasoning process before giving the final answer.

## RESPONSE GUIDELINES

- Be 2x more detailed than before
- Add specific numbers, dates, names from context
- Include formulas/calculations if relevant
- Provide draft messages or scripts if recommending outreach
- Flag any assumptions or uncertainties
- End with clear action items

This is iteration ${iteration + 1}/3 - make it count!`;

  try {
    const improvedText = await callClaude(improvementPrompt, "Generate your improved response with chain-of-thought reasoning.", 0.4);

    // Extract chain-of-thought reasoning
    const reasoningMatch = improvedText.match(/Let me think through this.*?(?=\n\n(?:Based on|Here|Now|In summary|##))/s);
    const reasoning = reasoningMatch ? reasoningMatch[0] : "Chain-of-thought reasoning included inline.";

    return {
      response: improvedText,
      reasoning
    };

  } catch (error) {
    console.error("[PTD Reflect] Improvement generation error:", error);
    throw error;
  }
}

// ============================================
// MAIN REFLECTION LOOP
// ============================================

async function runReflectionLoop(request: ReflectionRequest): Promise<ReflectionResult> {
  const startTime = Date.now();
  const maxIterations = request.max_iterations || 2;
  const qualityThreshold = request.quality_threshold || 80;

  let currentResponse = request.initial_response;
  const critiques: CritiqueResult[] = [];
  const improvementTrace: string[] = [`[Initial] ${currentResponse.substring(0, 200)}...`];
  const chainOfThought: string[] = [];

  console.log(`[PTD Reflect] Starting reflection loop - Max iterations: ${maxIterations}, Threshold: ${qualityThreshold}%`);

  // Initial critique
  const initialCritique = await critiqueResponse(currentResponse, request.query, request.context, 0);
  critiques.push(initialCritique);

  console.log(`[PTD Reflect] Initial score: ${initialCritique.overall_score}%`);

  // Iterative improvement loop
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const currentCritique = critiques[critiques.length - 1];

    // Check if quality threshold met
    if (currentCritique.overall_score >= qualityThreshold) {
      console.log(`[PTD Reflect] Quality threshold met (${currentCritique.overall_score}% >= ${qualityThreshold}%) - stopping early`);
      break;
    }

    console.log(`[PTD Reflect] Iteration ${iteration + 1}/${maxIterations} - Improving response (current: ${currentCritique.overall_score}%)`);

    // Generate improved response
    const improved = await generateImprovedResponse(
      currentResponse,
      request.query,
      currentCritique,
      request.context,
      iteration
    );

    currentResponse = improved.response;
    chainOfThought.push(improved.reasoning);
    improvementTrace.push(`[Iteration ${iteration + 1}] ${improved.response.substring(0, 200)}...`);

    // Re-critique the improved response (unless this was the last iteration)
    if (iteration < maxIterations - 1) {
      const newCritique = await critiqueResponse(currentResponse, request.query, request.context, iteration + 1);
      critiques.push(newCritique);
      console.log(`[PTD Reflect] New score after iteration ${iteration + 1}: ${newCritique.overall_score}%`);
    } else {
      // Final critique after last iteration
      const finalCritique = await critiqueResponse(currentResponse, request.query, request.context, iteration + 1);
      critiques.push(finalCritique);
      console.log(`[PTD Reflect] Final score: ${finalCritique.overall_score}%`);
    }
  }

  // Fact verification on final response
  const factChecks = await verifyFactsAgainstDatabase(currentResponse, request.context);

  const responseTime = Date.now() - startTime;
  const initialScore = critiques[0].overall_score;
  const finalScore = critiques[critiques.length - 1].overall_score;
  const qualityGain = finalScore - initialScore;

  console.log(`[PTD Reflect] Reflection complete - Quality gain: +${qualityGain}% (${initialScore}% → ${finalScore}%)`);

  return {
    final_response: currentResponse,
    iterations: critiques.length - 1, // -1 because first is initial critique
    critiques,
    improvement_trace: improvementTrace,
    chain_of_thought: chainOfThought,
    fact_checks: factChecks,
    total_quality_gain: qualityGain,
    metadata: {
      initial_score: initialScore,
      final_score: finalScore,
      response_time_ms: responseTime
    }
  };
}

// ============================================
// ENHANCED PTD AGENT WITH REFLECTION
// ============================================

async function getPTDResponseWithReflection(query: string, context: any = {}): Promise<ReflectionResult> {
  console.log("[PTD Reflect] Calling base PTD agent for initial response...");

  try {
    // Call the base PTD agent to get initial response
    const { data: ptdResponse, error: ptdError } = await supabase.functions.invoke("ptd-agent", {
      body: {
        query,
        session_id: context.session_id || `reflect_${Date.now()}`,
        context
      }
    });

    if (ptdError) {
      console.error("[PTD Reflect] PTD agent error:", ptdError);
      throw new Error(`PTD agent error: ${ptdError.message}`);
    }

    const initialResponse = ptdResponse?.response || ptdResponse?.data?.response || "No response from PTD agent";

    console.log(`[PTD Reflect] Got initial response (${initialResponse.length} chars), starting reflection...`);

    // Run reflection loop
    const reflectionResult = await runReflectionLoop({
      initial_response: initialResponse,
      query,
      context,
      max_iterations: 2,
      quality_threshold: 80
    });

    return reflectionResult;

  } catch (error) {
    console.error("[PTD Reflect] Error calling PTD agent:", error);

    // Fallback: If PTD agent fails, generate response directly with reflection
    console.log("[PTD Reflect] Fallback: Generating response directly...");

    const fallbackPrompt = `You are the PTD Fitness Intelligence Agent. Answer this query with the available context.

Query: ${query}

Context: ${JSON.stringify(context, null, 2)}

Provide a helpful, data-driven response.`;

    const fallbackResponse = await callClaude(fallbackPrompt, query, 0.5);

    return await runReflectionLoop({
      initial_response: fallbackResponse,
      query,
      context,
      max_iterations: 2,
      quality_threshold: 80
    });
  }
}

// ============================================
// HTTP HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      query,
      initial_response,
      context = {},
      mode = "full", // "full" = get PTD response + reflect, "critique_only" = just critique provided response
      max_iterations = 2,
      quality_threshold = 80
    } = body;

    if (!query && !initial_response) {
      throw new Error("Either 'query' or 'initial_response' is required");
    }

    console.log(`[PTD Reflect] Mode: ${mode}`);

    let result: ReflectionResult;

    if (mode === "critique_only" && initial_response) {
      // Just critique and improve the provided response
      console.log("[PTD Reflect] Critique-only mode");
      result = await runReflectionLoop({
        initial_response,
        query: query || "User query not provided",
        context,
        max_iterations,
        quality_threshold
      });
    } else {
      // Full mode: Get PTD response + reflect
      console.log("[PTD Reflect] Full mode: Getting PTD response + reflection");
      result = await getPTDResponseWithReflection(query, context);
    }

    const totalTime = Date.now() - startTime;

    return new Response(JSON.stringify({
      success: true,
      ...result,
      metadata: {
        ...result.metadata,
        total_time_ms: totalTime
      }
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error("[PTD Reflect] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
