import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";

// Multi-Agent Intelligence Orchestrator
// Coordinates 4 specialist agents that "chat" to provide recommendations

interface AgentResponse {
  agent: string;
  analysis: string;
  recommendations: string[];
  metrics: Record<string, number>;
}

interface OrchestratorResponse {
  query: string;
  agents: AgentResponse[];
  synthesis: string;
  actionPlan: string[];
  projectedROI: number;
  timestamp: string;
}

// Agent Prompts
const AGENT_PROMPTS = {
  oracle: `You are the ORACLE AGENT - a deal closing probability specialist.
Analyze the provided deal pipeline data and predict:
1. Close probability (0-100%) for each deal
2. Expected close dates
3. Risk factors blocking deals
4. Revenue forecast

Be specific with numbers. Format your response as JSON with: analysis, recommendations[], metrics{}.`,

  costOptimizer: `You are the COST OPTIMIZER AGENT - an ad spend efficiency specialist.
Analyze the provided campaign performance data and recommend:
1. Which campaigns to KILL (ROAS < 1.0)
2. Which campaigns to SCALE (ROAS > 2.5)
3. Budget reallocation strategy
4. Projected savings and gains

Be specific with dollar amounts. Format your response as JSON with: analysis, recommendations[], metrics{}.`,

  paymentIntel: `You are the PAYMENT INTELLIGENCE AGENT - a Stripe subscription specialist.
Analyze the provided payment data and identify:
1. Failed payments requiring intervention
2. Churn risk clients
3. Upsell opportunities (high engagement + low tier)
4. Payment health trends

Be specific with client counts and MRR impact. Format your response as JSON with: analysis, recommendations[], metrics{}.`,

  adsStrategist: `You are the ADS STRATEGIST AGENT - a creative performance specialist.
Analyze the provided ad creative data and recommend:
1. Top performing creatives to duplicate
2. Audience expansion opportunities
3. Bid strategy adjustments
4. New creative directions based on winners

Be specific with ROAS and conversion metrics. Format your response as JSON with: analysis, recommendations[], metrics{}.`,
};

// Fetch data for each agent
async function getOracleData(supabase: any) {
  const { data: deals } = await supabase
    .from("deals")
    .select("*")
    .gte(
      "close_date",
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    )
    .order("amount", { ascending: false })
    .limit(50);
  return deals || [];
}

async function getCostOptimizerData(supabase: any) {
  // Get campaign performance from our aggregated data
  const { data: campaigns } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  // Fallback mock if no live data
  return (
    campaigns || [
      { name: "Video A", spend: 5200, revenue: 15000, roas: 2.88 },
      { name: "Video B", spend: 3100, revenue: 3000, roas: 0.96 },
      { name: "Carousel Success", spend: 6200, revenue: 24000, roas: 3.87 },
    ]
  );
}

async function getPaymentData(supabase: any) {
  const { data: payments } = await supabase
    .from("stripe_subscriptions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return payments || [];
}

async function getAdsData(supabase: any) {
  const { data: creatives } = await supabase
    .from("ad_creatives")
    .select("*")
    .order("roas", { ascending: false })
    .limit(20);
  return creatives || [];
}

// Run single agent
async function runAgent(
  genAI: GoogleGenerativeAI,
  agentName: string,
  prompt: string,
  data: any,
): Promise<AgentResponse> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const fullPrompt = `${prompt}

DATA TO ANALYZE:
${JSON.stringify(data, null, 2)}

Respond ONLY with valid JSON.`;

  try {
    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        agent: agentName,
        analysis: parsed.analysis || "Analysis complete.",
        recommendations: parsed.recommendations || [],
        metrics: parsed.metrics || {},
      };
    }
  } catch (e) {
    console.error(`Agent ${agentName} error:`, e);
  }

  return {
    agent: agentName,
    analysis: "Agent encountered an error during analysis.",
    recommendations: [],
    metrics: {},
  };
}

// Synthesize all agent responses
async function synthesize(
  genAI: GoogleGenerativeAI,
  query: string,
  responses: AgentResponse[],
): Promise<{ synthesis: string; actionPlan: string[]; projectedROI: number }> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const synthesisPrompt = `You are the CHIEF INTELLIGENCE OFFICER synthesizing recommendations from 4 specialist agents.

USER QUERY: "${query}"

AGENT RESPONSES:
${responses
  .map(
    (r) => `
### ${r.agent.toUpperCase()}
Analysis: ${r.analysis}
Recommendations: ${r.recommendations.join(", ")}
Metrics: ${JSON.stringify(r.metrics)}
`,
  )
  .join("\n")}

Create a UNIFIED ACTION PLAN that:
1. Prioritizes actions by impact
2. Resolves any conflicts between agents
3. Calculates total projected ROI
4. Provides specific timelines

Respond with JSON: { synthesis: "...", actionPlan: ["action 1", "action 2", ...], projectedROI: number }`;

  try {
    const result = await model.generateContent(synthesisPrompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("Synthesis error:", e);
  }

  return {
    synthesis:
      "Multi-agent analysis complete. Review individual agent recommendations.",
    actionPlan: responses.flatMap((r) => r.recommendations),
    projectedROI: 0,
  };
}

serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query) {
      throw new Error("Query is required");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY") ?? "");

    console.log(`[Multi-Agent] Processing query: "${query}"`);

    // Fetch data for all agents in parallel
    const [oracleData, costData, paymentData, adsData] = await Promise.all([
      getOracleData(supabase),
      getCostOptimizerData(supabase),
      getPaymentData(supabase),
      getAdsData(supabase),
    ]);

    // Run all agents in parallel
    const agentResponses = await Promise.all([
      runAgent(genAI, "Oracle", AGENT_PROMPTS.oracle, oracleData),
      runAgent(genAI, "Cost Optimizer", AGENT_PROMPTS.costOptimizer, costData),
      runAgent(genAI, "Payment Intel", AGENT_PROMPTS.paymentIntel, paymentData),
      runAgent(genAI, "Ads Strategist", AGENT_PROMPTS.adsStrategist, adsData),
    ]);

    console.log(`[Multi-Agent] All 4 agents completed`);

    // Synthesize responses
    const { synthesis, actionPlan, projectedROI } = await synthesize(
      genAI,
      query,
      agentResponses,
    );

    const response: OrchestratorResponse = {
      query,
      agents: agentResponses,
      synthesis,
      actionPlan,
      projectedROI,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Multi-Agent] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
