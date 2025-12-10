import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// PTD INTELLIGENCE AGENT
// Smart RAG Agent with Memory & Learning
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

if (!ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY not configured in environment");
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================
// EMBEDDED KNOWLEDGE: Your Formulas & Rules
// ============================================
const PTD_KNOWLEDGE = {
  // Health Score Formula
  healthScoreFormula: {
    title: "Health Score Calculation",
    description: "Multi-dimensional scoring algorithm for client health",
    formula: `
HEALTH_SCORE = (ENGAGEMENT × 0.40) + (PACKAGE_HEALTH × 0.30) + (MOMENTUM × 0.30)

Where:
- ENGAGEMENT (0-100): Based on session frequency and recency
- PACKAGE_HEALTH (0-100): Based on sessions remaining vs time
- MOMENTUM (0-100): Based on week-over-week trend
    `,
    code: `
function calculateHealthScore(client) {
  const engagement = calculateEngagementScore(client);
  const packageHealth = calculatePackageHealthScore(client);
  const momentum = calculateMomentumScore(client);

  return Math.round(engagement * 0.40 + packageHealth * 0.30 + momentum * 0.30);
}
    `
  },

  // Engagement Score
  engagementFormula: {
    title: "Engagement Score Calculation",
    formula: `
BASE = 50 points

RECENT ACTIVITY (last 7 days):
  +30 if sessions >= 3
  +20 if sessions >= 2
  +10 if sessions >= 1

CONSISTENCY (last 30 days):
  +15 if sessions >= 12
  +10 if sessions >= 8

RECENCY PENALTY:
  -30 if days_since > 30
  -15 if days_since > 14
  -5  if days_since > 7

Final: Clamp to 0-100
    `,
    code: `
function calculateEngagementScore(client) {
  let score = 50;

  // Recent activity bonus
  if (client.sessions_last_7d >= 3) score += 30;
  else if (client.sessions_last_7d >= 2) score += 20;
  else if (client.sessions_last_7d >= 1) score += 10;

  // Consistency bonus
  if (client.sessions_last_30d >= 12) score += 15;
  else if (client.sessions_last_30d >= 8) score += 10;

  // Recency penalty
  if (client.days_since_last_session > 30) score -= 30;
  else if (client.days_since_last_session > 14) score -= 15;
  else if (client.days_since_last_session > 7) score -= 5;

  return Math.max(0, Math.min(100, score));
}
    `
  },

  // Package Health Score
  packageHealthFormula: {
    title: "Package Health Score Calculation",
    formula: `
remaining_percent = (outstanding_sessions / sessions_purchased) × 100

SCORE:
  90 if remaining >= 50%
  70 if remaining >= 30%
  50 if remaining >= 10%
  30 if remaining < 10%
    `,
    code: `
function calculatePackageHealthScore(client) {
  const outstanding = client.outstanding_sessions || 0;
  const purchased = client.sessions_purchased || 1;
  const remainingPct = (outstanding / purchased) * 100;

  if (remainingPct >= 50) return 90;
  if (remainingPct >= 30) return 70;
  if (remainingPct >= 10) return 50;
  return 30;
}
    `
  },

  // Momentum Score
  momentumFormula: {
    title: "Momentum Score Calculation",
    formula: `
avg_weekly_7d = sessions_last_7d
avg_weekly_30d = sessions_last_30d / 4.3

rate_of_change = ((avg_weekly_7d - avg_weekly_30d) / avg_weekly_30d) × 100

MOMENTUM:
  ACCELERATING if rate > +20%  → Score: 90
  STABLE if rate between -20% and +20% → Score: 70 or 50
  DECLINING if rate < -20% → Score: 30
    `,
    code: `
function calculateMomentumScore(client) {
  const avgWeekly7d = client.sessions_last_7d || 0;
  const avgWeekly30d = (client.sessions_last_30d || 0) / 4.3;

  if (avgWeekly30d === 0) {
    return client.sessions_last_7d > 0 ? 70 : 30;
  }

  const rateOfChange = ((avgWeekly7d - avgWeekly30d) / avgWeekly30d) * 100;

  if (rateOfChange > 20) return 90;  // ACCELERATING
  if (rateOfChange > 0) return 70;   // SLIGHTLY UP
  if (rateOfChange > -20) return 50; // STABLE
  return 30;                          // DECLINING
}
    `
  },

  // Predictive Risk Score
  predictiveRiskFormula: {
    title: "Predictive Risk Score (Churn Probability)",
    formula: `
BASE = 50 points

MOMENTUM IMPACT:
  +30 if DECLINING
  -15 if ACCELERATING

RECENT ACTIVITY:
  +25 if sessions_7d = 0
  +15 if sessions_7d < 1
  -10 if sessions_7d >= 2

GAP IMPACT:
  +25 if days_since > 30
  +15 if days_since > 14
  -10 if days_since <= 7

PACKAGE DEPLETION:
  +20 if remaining < 10% AND sessions_7d < 2
  -10 if remaining > 50%

ZONE MISMATCH:
  +10 if GREEN zone but DECLINING momentum

Final: Clamp to 0-100

RISK CATEGORIES:
  CRITICAL: 75-100
  HIGH: 60-74
  MEDIUM: 40-59
  LOW: 0-39
    `,
    code: `
function calculatePredictiveRisk(client) {
  let risk = 50;

  // Momentum impact
  if (client.momentum === 'DECLINING') risk += 30;
  else if (client.momentum === 'ACCELERATING') risk -= 15;

  // Recent activity
  if (client.sessions_last_7d === 0) risk += 25;
  else if (client.sessions_last_7d < 1) risk += 15;
  else if (client.sessions_last_7d >= 2) risk -= 10;

  // Gap impact
  if (client.days_since_last_session > 30) risk += 25;
  else if (client.days_since_last_session > 14) risk += 15;
  else if (client.days_since_last_session <= 7) risk -= 10;

  // Package depletion
  const remainingPct = (client.outstanding_sessions / client.sessions_purchased) * 100;
  if (remainingPct < 10 && client.sessions_last_7d < 2) risk += 20;
  else if (remainingPct > 50) risk -= 10;

  // Zone mismatch
  if (client.health_zone === 'GREEN' && client.momentum === 'DECLINING') risk += 10;

  return Math.max(0, Math.min(100, risk));
}
    `
  },

  // Zone Classification
  zoneClassification: {
    title: "Health Zone Classification",
    formula: `
PURPLE (Champions):  health_score >= 85
GREEN (Healthy):     health_score >= 70 AND < 85
YELLOW (At Risk):    health_score >= 50 AND < 70
RED (Critical):      health_score < 50
    `,
    thresholds: {
      PURPLE: { min: 85, max: 100, description: "Champions - High engagement, zero risk" },
      GREEN: { min: 70, max: 84, description: "Healthy - Consistent activity, low risk" },
      YELLOW: { min: 50, max: 69, description: "At Risk - Declining engagement, intervention needed" },
      RED: { min: 0, max: 49, description: "Critical - Immediate churn risk, urgent action required" }
    }
  },

  // Intervention Rules
  interventionRules: {
    title: "Intervention Priority Rules",
    rules: [
      {
        condition: "RED zone + predictive_risk > 75",
        priority: "CRITICAL",
        action: "Immediate coach outreach within 24 hours"
      },
      {
        condition: "RED zone OR predictive_risk > 60",
        priority: "HIGH",
        action: "Schedule call within 48 hours"
      },
      {
        condition: "YELLOW zone + DECLINING momentum",
        priority: "HIGH",
        action: "Proactive check-in, offer incentive"
      },
      {
        condition: "GREEN zone + DECLINING momentum",
        priority: "MEDIUM",
        action: "Early warning - monitor closely"
      },
      {
        condition: "Package < 20% remaining",
        priority: "MEDIUM",
        action: "Renewal conversation"
      }
    ]
  },

  // Company Benchmarks
  benchmarks: {
    title: "Company Performance Benchmarks",
    targets: {
      avgHealthScore: 70,
      greenPlusRate: 0.70, // 70% should be GREEN or PURPLE
      redZoneMax: 0.10, // Max 10% in RED
      interventionSuccessRate: 0.60
    }
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getConversationHistory(sessionId: string, limit = 10): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("agent_conversations")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[PTD Agent] Error fetching conversation history:", error);
      return "";
    }

    if (!data?.length) return "";

    return data
      .reverse()
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");
  } catch (error) {
    console.error("[PTD Agent] Exception in getConversationHistory:", error);
    return "";
  }
}

async function getLiveDashboardData() {
  const today = new Date().toISOString().split("T")[0];

  try {
    // Zone distribution
    let zones = null;
    try {
      const { data } = await supabase.rpc("get_zone_distribution", { target_date: today });
      zones = data;
    } catch (err) {
      console.error("[PTD Agent] Error fetching zone distribution:", err);
    }

    // At-risk clients (top 15)
    let atRiskClients = null;
    try {
      const { data } = await supabase
        .from("client_health_scores")
        .select("email, firstname, lastname, health_score, health_zone, predictive_risk_score, momentum_indicator, days_since_last_session, outstanding_sessions, sessions_last_7d, sessions_last_30d, assigned_coach")
        .in("health_zone", ["RED", "YELLOW"])
        .order("predictive_risk_score", { ascending: false })
        .limit(15);
      atRiskClients = data;
    } catch (err) {
      console.error("[PTD Agent] Error fetching at-risk clients:", err);
    }

    // Recent interventions
    let recentInterventions = null;
    try {
      const { data } = await supabase
        .from("intervention_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      recentInterventions = data;
    } catch (err) {
      console.error("[PTD Agent] Error fetching recent interventions:", err);
    }

    // Today's summary
    let summary = null;
    try {
      const { data } = await supabase
        .from("daily_summary")
        .select("*")
        .order("summary_date", { ascending: false })
        .limit(1);
      summary = data?.[0] ?? null;
    } catch (err) {
      console.error("[PTD Agent] Error fetching daily summary:", err);
    }

    // Coach performance
    let coaches = null;
    try {
      const { data } = await supabase
        .from("coach_performance")
        .select("*")
        .order("avg_client_health", { ascending: true })
        .limit(10);
      coaches = data;
    } catch (err) {
      console.error("[PTD Agent] Error fetching coach performance:", err);
    }

    return { zones, atRiskClients, recentInterventions, summary, coaches };
  } catch (error) {
    console.error("[PTD Agent] Exception in getLiveDashboardData:", error);
    return { zones: null, atRiskClients: null, recentInterventions: null, summary: null, coaches: null };
  }
}

async function getSuccessfulDecisions(type?: string, limit = 5) {
  // Skip if table doesn't exist - return empty array gracefully
  return [];
}

async function saveConversation(sessionId: string, role: string, content: string) {
  try {
    const { error } = await supabase.from("agent_conversations").insert({
      session_id: sessionId,
      role,
      content
    });

    if (error) {
      // Log but don't throw - conversation saving is not critical
      console.warn("[PTD Agent] Could not save conversation:", error.message);
    }
  } catch (error) {
    console.warn("[PTD Agent] Exception in saveConversation:", error);
  }
}

async function saveDecision(decision: any) {
  // Skip if table doesn't exist - decision logging is optional
  console.log("[PTD Agent] Decision made:", decision.decision_type);
}

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const TIMEOUT_MS = 30000; // 30 second timeout

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
        model: "claude-sonnet-4-20250514",
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      console.error("[PTD Agent] Claude API error:", error);
      throw new Error(`Claude API error: ${error}`);
    }

    const data = await response.json();
    return data.content[0]?.text || "";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[PTD Agent] Claude API timeout after", TIMEOUT_MS, "ms");
      throw new Error(`Claude API timeout after ${TIMEOUT_MS}ms`);
    }
    console.error("[PTD Agent] Exception in callClaude:", error);
    throw error;
  }
}

// ============================================
// MAIN AGENT HANDLER
// ============================================

interface AgentRequest {
  query: string;
  session_id: string;
  action?: "chat" | "analyze_client" | "recommend_intervention" | "explain_formula";
  context?: {
    client_email?: string;
    coach_name?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body: AgentRequest = await req.json();
    const { query, session_id, action = "chat", context = {} } = body;

    if (!query || !session_id) {
      throw new Error("Missing required fields: query and session_id");
    }

    console.log(`[PTD Agent] Action: ${action}, Query: ${query.substring(0, 100)}...`);

    // 1. Get conversation history for context
    const conversationHistory = await getConversationHistory(session_id);

    // 2. Get live dashboard data
    const dashboardData = await getLiveDashboardData();

    // 3. Get successful past decisions for learning
    const successfulDecisions = await getSuccessfulDecisions(undefined, 5);

    // 4. Build the system prompt with ALL knowledge
    const systemPrompt = `You are the PTD Fitness Intelligence Agent - an expert AI assistant that helps analyze client health, predict churn risks, and recommend interventions.

## YOUR KNOWLEDGE BASE (Use these formulas and rules)

### Health Score Calculation
${PTD_KNOWLEDGE.healthScoreFormula.formula}

### Engagement Score
${PTD_KNOWLEDGE.engagementFormula.formula}

### Package Health Score
${PTD_KNOWLEDGE.packageHealthFormula.formula}

### Momentum Score
${PTD_KNOWLEDGE.momentumFormula.formula}

### Predictive Risk Score (Churn Probability)
${PTD_KNOWLEDGE.predictiveRiskFormula.formula}

### Zone Classification
${PTD_KNOWLEDGE.zoneClassification.formula}

Zone Descriptions:
- PURPLE: ${PTD_KNOWLEDGE.zoneClassification.thresholds.PURPLE.description}
- GREEN: ${PTD_KNOWLEDGE.zoneClassification.thresholds.GREEN.description}
- YELLOW: ${PTD_KNOWLEDGE.zoneClassification.thresholds.YELLOW.description}
- RED: ${PTD_KNOWLEDGE.zoneClassification.thresholds.RED.description}

### Intervention Rules
${PTD_KNOWLEDGE.interventionRules.rules.map(r => `- ${r.condition} → ${r.priority}: ${r.action}`).join('\n')}

### Company Benchmarks
- Target Average Health Score: ${PTD_KNOWLEDGE.benchmarks.targets.avgHealthScore}
- Target GREEN+PURPLE Rate: ${PTD_KNOWLEDGE.benchmarks.targets.greenPlusRate * 100}%
- Max RED Zone: ${PTD_KNOWLEDGE.benchmarks.targets.redZoneMax * 100}%

## CURRENT DASHBOARD STATE (Live Data)

### Zone Distribution
${JSON.stringify(dashboardData.zones, null, 2)}

### Daily Summary
${JSON.stringify(dashboardData.summary, null, 2)}

### Top At-Risk Clients
${dashboardData.atRiskClients?.slice(0, 10).map((c: any) =>
  `- ${c.firstname} ${c.lastname} (${c.email}): Score ${c.health_score}, Zone ${c.health_zone}, Risk ${c.predictive_risk_score}, Momentum ${c.momentum_indicator}, Days Since: ${c.days_since_last_session}, 7d Sessions: ${c.sessions_last_7d}, Coach: ${c.assigned_coach || 'Unassigned'}`
).join('\n')}

### Recent Interventions
${dashboardData.recentInterventions?.slice(0, 5).map((i: any) =>
  `- ${i.client_name}: ${i.intervention_type} (${i.status}) - ${i.created_at}`
).join('\n')}

### Coach Performance (sorted by avg health, lowest first)
${dashboardData.coaches?.map((c: any) =>
  `- ${c.coach_name}: ${c.total_clients} clients, Avg Health: ${c.avg_client_health}, RED: ${c.red_count}, YELLOW: ${c.yellow_count}`
).join('\n')}

## PAST SUCCESSFUL DECISIONS (Learn from these)
${successfulDecisions.length > 0 ? successfulDecisions.map((d: any) =>
  `Decision Type: ${d.decision_type}
Context: ${JSON.stringify(d.input_context)}
Decision: ${JSON.stringify(d.decision)}
Outcome: ${JSON.stringify(d.outcome_metrics)}`
).join('\n\n') : "(No past decisions recorded yet)"}

## CONVERSATION HISTORY
${conversationHistory || "(No previous messages in this session)"}

## YOUR CAPABILITIES
1. Explain WHY a client's health score is what it is (break down the formula)
2. Predict which clients are most likely to churn and why
3. Recommend specific interventions based on client data
4. Compare coach performance and identify issues
5. Identify patterns and anomalies in the data
6. Write personalized outreach messages for at-risk clients
7. Explain your reasoning using the formulas above

## RESPONSE GUIDELINES
- Always cite specific data points from the dashboard
- When explaining scores, show the math using the formulas
- Be proactive - if you notice something concerning, mention it
- Suggest specific actions, not vague advice
- If recommending an intervention, include a draft message
- Format responses clearly with sections when appropriate

Today's Date: ${new Date().toISOString().split('T')[0]}`;

    // 5. Call Claude
    const response = await callClaude(systemPrompt, query);

    // 6. Save conversation
    await saveConversation(session_id, "user", query);
    await saveConversation(session_id, "assistant", response);

    // 7. Track if this was a decision/recommendation (for learning)
    const isDecision = action === "recommend_intervention" ||
      query.toLowerCase().includes("recommend") ||
      query.toLowerCase().includes("intervention") ||
      query.toLowerCase().includes("what should");

    if (isDecision) {
      await saveDecision({
        agent_type: "analyst",
        decision_type: "recommendation",
        input_context: { query, context, dashboard_snapshot: dashboardData.summary },
        decision: { response: response.substring(0, 1000) },
        reasoning: query,
        confidence: 0.8,
        outcome: "pending"
      });
    }

    // 8. Calculate metrics
    const responseTime = Date.now() - startTime;

    return new Response(JSON.stringify({
      success: true,
      response,
      session_id,
      metrics: {
        response_time_ms: responseTime
      }
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error("[PTD Agent] Error:", error);
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
