/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * AI ANALYST ENGINE v1.0
 * ======================
 * LLM-powered analysis layer that sits on top of rule-based detection.
 *
 * Architecture (from AI Engineer + LLM App Patterns skills):
 *   Detection (rules) → Analysis (LLM) → Recommendation (LLM)
 *
 * Pattern: ReAct + Prompt Chain
 *   1. RETRIEVE: Get prepared_actions + client context
 *   2. ANALYZE: Gemini reasons about WHY
 *   3. RECOMMEND: Gemini generates specific actions
 *   4. STORE: Enriched analysis back to prepared_actions
 *
 * Self-learning:
 *   - Tracks which LLM recommendations get acted on
 *   - Adjusts prompts based on outcome data
 *   - Costs ~$0.02/run (20 actions × ~1000 tokens each)
 *
 * Runs daily AFTER client-intelligence-engine (which detects patterns).
 * Cron: 30 min after detection engine.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_KEY") || "";
const GEMINI_MODEL = "gemini-2.0-flash";
const MAX_ACTIONS = 20; // Analyze top 20 per run (cost control)

interface AnalysisResult {
  root_cause: string;
  specific_recommendation: string;
  urgency: "immediate" | "this_week" | "monitor";
  confidence: number;
  suggested_owner: string;
  similar_cases: string;
}

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    return JSON.stringify({
      root_cause: "AI analysis unavailable (no API key)",
      specific_recommendation: "Configure GEMINI_API_KEY in Supabase secrets",
      urgency: "monitor",
      confidence: 0,
      suggested_owner: "admin",
      similar_cases: "none",
    });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3, // Low temp for analytical precision
          maxOutputTokens: 500,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const startTime = Date.now();

    // ═══ 1. GET PENDING ACTIONS (highest priority first) ═══
    const { data: actions } = await supabase
      .from("prepared_actions")
      .select("*")
      .eq("status", "pending")
      .eq("source_agent", "client-intelligence-engine")
      .is("approved_by", null) // Not yet analyzed
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(MAX_ACTIONS);

    if (!actions || actions.length === 0) {
      return new Response(JSON.stringify({
        engine: "ai-analyst",
        analyzed: 0,
        message: "No pending actions to analyze",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══ 2. GET CONTEXT DATA ═══

    // Get all coaches and their stats
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: coachStats } = await supabase
      .from("training_sessions_live")
      .select("coach_name, status, client_name")
      .gte("training_date", thirtyDaysAgo);

    // Build coach capacity map
    const coachCapacity: Record<string, {
      clients: Set<string>;
      completed: number;
      cancelled: number;
    }> = {};

    for (const s of (coachStats || [])) {
      if (!coachCapacity[s.coach_name]) {
        coachCapacity[s.coach_name] = { clients: new Set(), completed: 0, cancelled: 0 };
      }
      coachCapacity[s.coach_name].clients.add(s.client_name);
      if (s.status === "Completed") coachCapacity[s.coach_name].completed++;
      else if (s.status?.includes("Cancel")) coachCapacity[s.coach_name].cancelled++;
    }

    // Get health data for context
    const { data: latestHealth } = await supabase
      .from("client_health_daily")
      .select("client_name, total_score, tier, trend, days_since_training, sessions_30d, cancels_30d")
      .order("score_date", { ascending: false })
      .limit(300);

    const healthMap: Record<string, any> = {};
    for (const h of (latestHealth || [])) {
      if (!healthMap[h.client_name]) healthMap[h.client_name] = h;
    }

    // Get learned patterns for prompt context
    const { data: patterns } = await supabase
      .from("learned_patterns")
      .select("pattern_type, confidence, times_validated, times_invalidated")
      .gt("times_applied", 0);

    const patternContext = (patterns || [])
      .map((p: any) => `${p.pattern_type}: validated ${p.times_validated}x, dismissed ${p.times_invalidated}x, confidence ${p.confidence}`)
      .join("\n");

    // ═══ 3. ANALYZE EACH ACTION WITH LLM ═══
    const results: { id: string; analysis: AnalysisResult | null; error?: string }[] = [];

    // Build available coaches list for recommendations
    const availableCoaches = Object.entries(coachCapacity)
      .filter(([_, stats]) => stats.completed > 0) // Active coaches only
      .map(([name, stats]) => ({
        name,
        clients: stats.clients.size,
        completed_30d: stats.completed,
        cancel_rate: Math.round((stats.cancelled / (stats.completed + stats.cancelled || 1)) * 100),
      }))
      .sort((a, b) => a.clients - b.clients); // Least loaded first

    for (const action of actions) {
      try {
        const clientName = action.prepared_payload?.client_name || action.action_title;
        const health = healthMap[clientName];

        const prompt = `You are a fitness business analyst for PTD Fitness Dubai (home-visit personal training, 27 coaches, 218 active clients).

ALERT: ${action.action_title}
TYPE: ${action.action_type}
DETAILS: ${action.action_description}
REASONING: ${action.reasoning}

CLIENT CONTEXT:
${health ? `- Health Score: ${health.total_score}/100 (${health.tier})
- Trend: ${health.trend}
- Days since training: ${health.days_since_training}
- Sessions last 30d: ${health.sessions_30d}
- Cancels last 30d: ${health.cancels_30d}` : "- No health data available"}
- Package info: ${JSON.stringify(action.prepared_payload || {})}

AVAILABLE COACHES (sorted by capacity):
${availableCoaches.slice(0, 10).map(c => `${c.name}: ${c.clients} clients, ${c.completed_30d} sessions/30d, ${c.cancel_rate}% cancel`).join("\n")}

${patternContext ? `HISTORICAL PATTERN DATA:\n${patternContext}` : ""}

Analyze this situation and respond in JSON:
{
  "root_cause": "The most likely reason this is happening (be specific, not generic)",
  "specific_recommendation": "Exact action to take. If reassignment needed, name the best coach match.",
  "urgency": "immediate | this_week | monitor",
  "confidence": 0.0-1.0,
  "suggested_owner": "Who should handle this (team_leader/sales/admin)",
  "similar_cases": "Brief note on whether you've seen this pattern before"
}`;

        const response = await callGemini(prompt);
        let analysis: AnalysisResult;

        try {
          analysis = JSON.parse(response);
        } catch {
          // Try to extract JSON from response
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("Failed to parse Gemini response as JSON");
          }
        }

        // Update the action with AI analysis
        await supabase
          .from("prepared_actions")
          .update({
            approved_by: "ai-analyst-engine",
            supporting_data: {
              ...(action.supporting_data || {}),
              ai_analysis: analysis,
              analyzed_at: new Date().toISOString(),
            },
          })
          .eq("id", action.id);

        results.push({ id: action.id, analysis });

        // Small delay between API calls (rate limiting)
        await new Promise((r) => setTimeout(r, 200));

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ id: action.id, analysis: null, error: msg });
      }
    }

    const elapsed = Date.now() - startTime;
    const successful = results.filter((r) => r.analysis).length;

    const summary = {
      engine: "ai-analyst-engine",
      version: "1.0",
      elapsed_ms: elapsed,
      actions_analyzed: results.length,
      successful: successful,
      failed: results.length - successful,
      model: GEMINI_MODEL,
      api_key_set: !!GEMINI_API_KEY,
      sample_analysis: results.find((r) => r.analysis)?.analysis || null,
    };

    return new Response(JSON.stringify(summary, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
