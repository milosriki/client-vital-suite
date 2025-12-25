/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildAgentPrompt } from "../_shared/unified-prompts.ts";

// ============================================
// INTERVENTION RECOMMENDER AGENT
// AI-powered intervention suggestions with draft messages
// Smart recommendations based on client context
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Environment variable validation
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration");
}

// ANTHROPIC_API_KEY is optional
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
if (!ANTHROPIC_API_KEY) {
  console.warn("ANTHROPIC_API_KEY not set - using template messages only");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface InterventionRecommendation {
  client_email: string;
  client_name: string;
  intervention_type: string;
  priority: string;
  timing: string;
  channel: string;
  message_draft: string;
  psychological_insight: string;
  success_probability: number;
  reasoning: string;
}

const INTERVENTION_TYPES = {
  URGENT_OUTREACH: {
    name: "Urgent Personal Outreach",
    timing: "Within 24 hours",
    channel: "Phone call"
  },
  WELLNESS_CHECK: {
    name: "Wellness Check-in",
    timing: "Within 48 hours",
    channel: "WhatsApp/SMS"
  },
  RENEWAL_CONVERSATION: {
    name: "Package Renewal",
    timing: "Within 1 week",
    channel: "In-person or call"
  },
  RE_ENGAGEMENT: {
    name: "Re-engagement Campaign",
    timing: "Within 48 hours",
    channel: "Email + SMS"
  },
  CELEBRATION: {
    name: "Achievement Celebration",
    timing: "Same day",
    channel: "WhatsApp"
  },
  INCENTIVE_OFFER: {
    name: "Special Offer",
    timing: "Within 72 hours",
    channel: "Email"
  }
};

function selectInterventionType(client: any): keyof typeof INTERVENTION_TYPES {
  const { health_zone, momentum_indicator, days_since_last_session, outstanding_sessions, predictive_risk_score } = client;

  // Critical situations
  if (health_zone === "RED" && predictive_risk_score > 75) {
    return "URGENT_OUTREACH";
  }

  // Package running out
  if (outstanding_sessions < 5 && outstanding_sessions > 0) {
    return "RENEWAL_CONVERSATION";
  }

  // Inactive but has sessions
  if (days_since_last_session > 14 && outstanding_sessions > 5) {
    return "RE_ENGAGEMENT";
  }

  // Declining momentum
  if (momentum_indicator === "DECLINING" && health_zone !== "RED") {
    return "WELLNESS_CHECK";
  }

  // High performer
  if (health_zone === "PURPLE" || (health_zone === "GREEN" && momentum_indicator === "ACCELERATING")) {
    return "CELEBRATION";
  }

  // Default for at-risk
  if (health_zone === "YELLOW") {
    return "INCENTIVE_OFFER";
  }

  return "WELLNESS_CHECK";
}

async function generateMessageDraft(client: any, interventionType: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return getTemplateMessage(client, interventionType);
  }

  try {
    const systemPrompt = buildAgentPrompt('INTERVENTION_RECOMMENDER', {
      includeLifecycle: true,
      outputFormat: 'INTERVENTION_PLAN',
      additionalContext: `TONE GUIDELINES:
- Warm and supportive, never pushy
- Focus on their journey and wellbeing
- Acknowledge life gets busy
- Make it easy to respond

FORBIDDEN:
- Guilt-tripping language
- Aggressive sales tactics
- Generic "we miss you" clichés
- Overly formal business language`
    });

    const prompt = `Generate a personalized, warm outreach message for a fitness client.

Context:
- Client Name: ${client.firstname}
- Intervention Type: ${interventionType}
- Days Since Last Session: ${client.days_since_last_session}
- Sessions Remaining: ${client.outstanding_sessions}
- Health Zone: ${client.health_zone}
- Coach: ${client.assigned_coach || "the team"}

Requirements:
- Warm, personal tone
- No guilt-tripping
- Focus on their wellbeing
- Include a clear next step/CTA
- Keep under 100 words
- For WhatsApp format (can use emojis sparingly)

Write the message:`;

    // Add timeout to Claude API call (10 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 200,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }]
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[Claude API] Request failed with status ${response.status}`);
        return getTemplateMessage(client, interventionType);
      }

      const data = await response.json();
      return data.content[0]?.text || getTemplateMessage(client, interventionType);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.warn("[Claude API] Request timeout - falling back to template");
      } else {
        console.warn("[Claude API] Request failed:", fetchError);
      }
      return getTemplateMessage(client, interventionType);
    }
  } catch (error) {
    console.error("[Claude API] Unexpected error:", error);
    return getTemplateMessage(client, interventionType);
  }
}

function getTemplateMessage(client: any, interventionType: string): string {
  const name = client.firstname || "there";
  const coach = client.assigned_coach || "the PTD team";

  const templates: Record<string, string> = {
    URGENT_OUTREACH: `Hi ${name}! It's been a while since we've seen you at PTD. We genuinely miss having you around and want to make sure everything is okay. Can we chat today? ${coach} would love to hear from you.`,
    WELLNESS_CHECK: `Hey ${name}! Just checking in to see how you're doing. Your fitness journey matters to us. Is there anything we can help with or adjust to better support your goals?`,
    RENEWAL_CONVERSATION: `Hi ${name}! I noticed you're running low on sessions. I'd love to discuss your progress and help plan your next phase. When's a good time to chat about your options?`,
    RE_ENGAGEMENT: `${name}! We've been thinking about you. Life gets busy, but your health matters. How about we schedule a session this week? I have some great ideas to get you back on track!`,
    CELEBRATION: `${name}! Just wanted to say - you've been absolutely crushing it lately! Your consistency is inspiring. Keep up the amazing work! 🌟`,
    INCENTIVE_OFFER: `Hi ${name}! We have a special offer just for you - book your next session this week and get a complimentary wellness assessment. Interested?`
  };

  return templates[interventionType] || templates.WELLNESS_CHECK;
}

function getPsychologicalInsight(client: any): string {
  const insights: string[] = [];

  if (client.days_since_last_session > 21) {
    insights.push("Long absence may indicate life stress or loss of motivation - approach with empathy, not pressure.");
  }

  if (client.momentum_indicator === "DECLINING" && client.health_zone === "GREEN") {
    insights.push("Client was highly engaged but slowing down - may be experiencing burnout or schedule conflicts.");
  }

  if (client.outstanding_sessions < 3) {
    insights.push("Low sessions remaining may cause avoidance due to fear of 'running out' - address this directly.");
  }

  if (client.sessions_last_7d === 0 && client.sessions_last_30d >= 8) {
    insights.push("Sudden stop after consistent activity - check for injury, illness, or personal issues.");
  }

  return insights.length > 0
    ? insights.join(" ")
    : "Maintain supportive tone and focus on their goals rather than the gap in attendance.";
}

function calculateSuccessProbability(client: any, interventionType: string): number {
  let probability = 50;

  // Higher success for shorter gaps
  if (client.days_since_last_session < 7) probability += 20;
  else if (client.days_since_last_session < 14) probability += 10;
  else if (client.days_since_last_session > 30) probability -= 15;

  // Higher success if they have sessions remaining
  if (client.outstanding_sessions > 10) probability += 10;
  else if (client.outstanding_sessions === 0) probability -= 20;

  // Accelerating momentum is good sign
  if (client.momentum_indicator === "ACCELERATING") probability += 15;

  // Celebration has high success
  if (interventionType === "CELEBRATION") probability += 20;

  return Math.max(20, Math.min(90, probability));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const {
      client_email,
      zones = ["RED", "YELLOW"],
      limit = 20,
      generate_messages = true,
      save_to_db = true
    } = await req.json().catch(() => ({}));

    console.log("[Intervention Recommender] Generating recommendations...");

    // Build query
    let query = supabase
      .from("client_health_scores")
      .select("*")
      .order("predictive_risk_score", { ascending: false })
      .limit(limit);

    if (client_email) {
      query = query.eq("email", client_email);
    } else {
      query = query.in("health_zone", zones);
    }

    const { data: clients, error } = await query;
    if (error) throw error;

    // Handle empty query results
    if (!clients || clients.length === 0) {
      console.log("[Intervention Recommender] No clients found matching criteria");
      return new Response(JSON.stringify({
        success: true,
        duration_ms: Date.now() - startTime,
        count: 0,
        recommendations: [],
        message: "No clients found matching the specified criteria"
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const recommendations: InterventionRecommendation[] = [];

    for (const client of clients) {
      const interventionKey = selectInterventionType(client);
      const intervention = INTERVENTION_TYPES[interventionKey];

      let messageDraft = "";
      if (generate_messages) {
        messageDraft = await generateMessageDraft(client, interventionKey);
      }

      const successProb = calculateSuccessProbability(client, interventionKey);
      const psychInsight = getPsychologicalInsight(client);

      const rec: InterventionRecommendation = {
        client_email: client.email,
        client_name: `${client.firstname || ""} ${client.lastname || ""}`.trim(),
        intervention_type: intervention.name,
        priority: client.health_zone === "RED" ? "CRITICAL" :
                  client.predictive_risk_score > 60 ? "HIGH" : "MEDIUM",
        timing: intervention.timing,
        channel: intervention.channel,
        message_draft: messageDraft,
        psychological_insight: psychInsight,
        success_probability: successProb,
        reasoning: `Selected ${intervention.name} because: Zone=${client.health_zone}, Risk=${client.predictive_risk_score}, Days inactive=${client.days_since_last_session}`
      };

      recommendations.push(rec);

      // Save to intervention log with error handling
      if (save_to_db) {
        try {
          const { error: upsertError } = await supabase.from("intervention_log").upsert({
            client_email: client.email,
            email: client.email,
            firstname: client.firstname,
            lastname: client.lastname,
            intervention_type: intervention.name,
            priority: rec.priority,
            health_score: client.health_score,
            health_zone: client.health_zone,
            churn_risk_at_trigger: client.predictive_risk_score,
            ai_recommendation: messageDraft,
            ai_insight: psychInsight,
            ai_confidence: successProb / 100,
            communication_method: intervention.channel,
            communication_timing: intervention.timing,
            psychological_insight: psychInsight,
            success_probability: successProb,
            status: "PENDING",
            triggered_at: new Date().toISOString()
          }, {
            onConflict: "client_email",
            ignoreDuplicates: false
          });

          if (upsertError) {
            console.error(`[Intervention Recommender] Failed to save intervention for ${client.email}:`, upsertError);
            // Continue processing other clients even if one fails
          }
        } catch (dbError) {
          console.error(`[Intervention Recommender] Database error for ${client.email}:`, dbError);
          // Continue processing other clients even if one fails
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Intervention Recommender] Complete in ${duration}ms - ${recommendations.length} recommendations`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      count: recommendations.length,
      recommendations
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error("[Intervention Recommender] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
