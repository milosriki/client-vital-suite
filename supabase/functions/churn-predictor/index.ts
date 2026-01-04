/// <reference lib="deno.ns" />
import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildAgentPrompt } from "../_shared/unified-prompts.ts";

// ============================================
// CHURN PREDICTOR AGENT
// AI-powered churn prediction with explanations
// Daily AI-powered churn risk analysis
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Environment variable validation
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration");
}
// ANTHROPIC_API_KEY is optional - AI insights will be skipped if missing

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface ChurnPrediction {
  email: string;
  name: string;
  churn_probability: number;
  risk_category: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  days_to_churn_estimate: number | null;
  risk_factors: string[];
  recommended_actions: string[];
  ai_insight: string | null;
}

function calculateChurnFactors(client: any): { factors: string[]; score: number } {
  const factors: string[] = [];
  let score = 0;

  // Factor 1: Days since last session
  const daysSince = client.days_since_last_session || 0;
  if (daysSince > 30) {
    factors.push(`No session in ${daysSince} days (critical)`);
    score += 30;
  } else if (daysSince > 14) {
    factors.push(`No session in ${daysSince} days (concerning)`);
    score += 15;
  } else if (daysSince > 7) {
    factors.push(`Gap of ${daysSince} days since last session`);
    score += 5;
  }

  // Factor 2: Session frequency trend
  const sessions7d = client.sessions_last_7d || 0;
  const sessions30d = client.sessions_last_30d || 0;
  const avgWeekly = sessions30d / 4.3;

  if (sessions7d === 0 && avgWeekly > 1) {
    factors.push("Complete stop in activity this week");
    score += 25;
  } else if (sessions7d < avgWeekly * 0.5) {
    factors.push("Activity dropped by more than 50%");
    score += 15;
  }

  // Factor 3: Package depletion
  const outstanding = client.outstanding_sessions || 0;
  const purchased = client.sessions_purchased || 1;
  const remainingPct = (outstanding / purchased) * 100;

  if (outstanding === 0) {
    factors.push("Package fully depleted");
    score += 20;
  } else if (remainingPct < 10) {
    factors.push(`Only ${outstanding} sessions remaining (${Math.round(remainingPct)}%)`);
    score += 15;
  } else if (remainingPct < 25) {
    factors.push(`Package at ${Math.round(remainingPct)}% - renewal conversation needed`);
    score += 5;
  }

  // Factor 4: Health zone trajectory
  if (client.health_zone === "RED") {
    factors.push("Currently in RED zone");
    score += 20;
  } else if (client.health_zone === "YELLOW") {
    factors.push("In YELLOW warning zone");
    score += 10;
  }

  // Factor 5: Momentum
  if (client.momentum_indicator === "DECLINING") {
    factors.push("Declining momentum trend");
    score += 15;
  }

  // Factor 6: Combined risk signals
  if (client.health_zone === "GREEN" && client.momentum_indicator === "DECLINING") {
    factors.push("GREEN zone but declining - early warning signal");
    score += 10;
  }

  if (daysSince > 14 && outstanding < 5) {
    factors.push("Inactive AND low sessions - high churn risk combination");
    score += 10;
  }

  return { factors, score: Math.min(100, score) };
}

function getRiskCategory(score: number): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 75) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function estimateDaysToChurn(client: any, score: number): number | null {
  if (score < 40) return null; // Low risk, no estimate

  // Base estimate on activity patterns
  const daysSince = client.days_since_last_session || 0;
  const sessions7d = client.sessions_last_7d || 0;
  const outstanding = client.outstanding_sessions || 0;

  if (outstanding === 0) return 7; // Already depleted
  if (daysSince > 30) return 14; // Already inactive for a month
  if (score >= 75) return 14;
  if (score >= 60) return 30;
  return 45;
}

function getRecommendedActions(client: any, riskCategory: string, factors: string[]): string[] {
  const actions: string[] = [];

  if (riskCategory === "CRITICAL") {
    actions.push("Immediate phone call from assigned coach");
    actions.push("Offer complimentary session to re-engage");
  }

  if (riskCategory === "HIGH" || riskCategory === "CRITICAL") {
    actions.push("Personal outreach within 24 hours");
    if (factors.some(f => f.includes("depleted") || f.includes("remaining"))) {
      actions.push("Prepare renewal offer with incentive");
    }
  }

  if (client.days_since_last_session > 14) {
    actions.push("Send 'We miss you' personalized message");
  }

  if (client.momentum_indicator === "DECLINING") {
    actions.push("Schedule wellness check-in call");
  }

  if (actions.length === 0) {
    actions.push("Continue monitoring");
    actions.push("Proactive check-in within 7 days");
  }

  return actions;
}

async function getAIInsight(client: any, factors: string[]): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) {
    console.log("Skipping AI insight - ANTHROPIC_API_KEY not configured");
    return null;
  }

  try {
    const systemPrompt = buildAgentPrompt('CHURN_PREDICTOR', {
      includeLifecycle: true,
      includeHealthZones: true,
      outputFormat: 'CLIENT_ANALYSIS'
    });

    const prompt = `Analyze this fitness client's churn risk and provide a 1-2 sentence actionable insight:

Client: ${client.firstname} ${client.lastname}
Health Score: ${client.health_score}/100
Zone: ${client.health_zone}
Days Since Last Session: ${client.days_since_last_session}
Sessions This Week: ${client.sessions_last_7d}
Sessions Remaining: ${client.outstanding_sessions}
Momentum: ${client.momentum_indicator}

Risk Factors:
${factors.map(f => `- ${f}`).join('\n')}

Provide a brief, actionable insight for the coach.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-4-5-sonnet",
        max_tokens: 150,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.content[0]?.text || null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const {
      min_risk = 40,
      limit = 50,
      include_ai_insights = false,
      save_to_db = true
    } = await req.json().catch(() => ({}));

    console.log("[Churn Predictor] Analyzing churn risks...");

    // Get all clients
    const { data: clients, error } = await supabase
      .from("client_health_scores")
      .select("*")
      .order("predictive_risk_score", { ascending: false });

    if (error) throw error;

    const predictions: ChurnPrediction[] = [];

    for (const client of clients || []) {
      try {
        const { factors, score } = calculateChurnFactors(client);

        if (score < min_risk) continue;

        const riskCategory = getRiskCategory(score);
        const daysToChurn = estimateDaysToChurn(client, score);
        const actions = getRecommendedActions(client, riskCategory, factors);

        let aiInsight: string | null = null;
        if (include_ai_insights && score >= 60) {
          aiInsight = await getAIInsight(client, factors);
        }

        predictions.push({
          email: client.email,
          name: `${client.firstname || ""} ${client.lastname || ""}`.trim(),
          churn_probability: score,
          risk_category: riskCategory,
          days_to_churn_estimate: daysToChurn,
          risk_factors: factors,
          recommended_actions: actions,
          ai_insight: aiInsight
        });

        if (predictions.length >= limit) break;
      } catch (clientError) {
        console.error(`[Churn Predictor] Error processing client ${client.email}:`, clientError);
        // Continue processing other clients
        continue;
      }
    }

    // Save high-risk predictions to intervention log
    if (save_to_db) {
      const criticalPredictions = predictions.filter(p =>
        p.risk_category === "CRITICAL" || p.risk_category === "HIGH"
      );

      for (const pred of criticalPredictions) {
        try {
          await supabase.from("intervention_log").upsert({
            client_email: pred.email,
            email: pred.email,
            trigger_reason: `Churn Predictor: ${pred.risk_category} risk (${pred.churn_probability}%)`,
            intervention_type: "CHURN_PREVENTION",
            priority: pred.risk_category,
            ai_recommendation: pred.recommended_actions.join("; "),
            ai_insight: pred.ai_insight || pred.risk_factors.join("; "),
            ai_confidence: pred.churn_probability / 100,
            status: "PENDING",
            triggered_at: new Date().toISOString()
          }, {
            onConflict: "client_email",
            ignoreDuplicates: false
          });
        } catch (dbError) {
          console.error(`[Churn Predictor] Error saving intervention for ${pred.email}:`, dbError);
          // Continue saving other predictions
        }
      }

      // TRIGGER NEXT AGENT: Intervention Recommender
      // Only trigger if we found critical/high risk clients
      if (criticalPredictions.length > 0) {
        console.log("[Churn Predictor] Triggering Intervention Recommender...");

        fetch(`${SUPABASE_URL}/functions/v1/intervention-recommender`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            zones: ["RED", "YELLOW"], // Focus on at-risk zones
            generate_messages: true,
            save_to_db: true
          })
        }).catch(err => console.error("Failed to trigger Intervention Recommender:", err));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Churn Predictor] Complete in ${duration}ms - ${predictions.length} at-risk clients`);

    const summary = {
      total_analyzed: clients?.length || 0,
      at_risk_count: predictions.length,
      critical: predictions.filter(p => p.risk_category === "CRITICAL").length,
      high: predictions.filter(p => p.risk_category === "HIGH").length,
      medium: predictions.filter(p => p.risk_category === "MEDIUM").length
    };

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      summary,
      predictions
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error("[Churn Predictor] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
