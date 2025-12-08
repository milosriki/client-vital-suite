import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// GET LEADS NEEDING ACTION
// Smart query for leads requiring calls with AI prioritization
// Ensures 0 leads fall through cracks
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface LeadAction {
  client_email: string;
  client_name: string;
  firstname: string;
  lastname: string;

  // Priority scoring (1-10)
  ai_priority: number;

  // Why this lead needs calling
  reason: string;
  urgency_factors: string[];

  // What to say
  draft_message: string;
  recommended_channel: 'PHONE' | 'WHATSAPP' | 'EMAIL' | 'SMS';

  // Context
  health_zone: string;
  days_since_last_contact: number;
  days_since_last_session?: number;
  pattern_status?: string;
  risk_score: number;

  // Owner info
  current_owner?: string;
  owner_recently_changed: boolean;

  // Metadata
  calculated_at: string;
}

/**
 * Calculate AI priority score (1-10) based on multiple factors
 */
function calculateAIPriority(lead: any): number {
  let priority = 5; // Base priority

  // Health zone urgency
  if (lead.health_zone === 'RED') priority += 3;
  else if (lead.health_zone === 'YELLOW') priority += 2;
  else if (lead.health_zone === 'ORANGE') priority += 2.5;

  // Days since last contact (exponential urgency)
  const daysSinceContact = lead.days_since_last_contact || 0;
  if (daysSinceContact >= 14) priority += 2;
  else if (daysSinceContact >= 7) priority += 1.5;
  else if (daysSinceContact >= 3) priority += 1;

  // Pattern break is urgent
  if (lead.pattern_status === 'PATTERN_BREAK') priority += 2;

  // High risk score
  if (lead.risk_score >= 75) priority += 2;
  else if (lead.risk_score >= 60) priority += 1;

  // Owner recently changed (needs check-in)
  const ownerChangedRecently = lead.owner_changed_at &&
    (new Date().getTime() - new Date(lead.owner_changed_at).getTime()) < (7 * 24 * 60 * 60 * 1000); // 7 days
  if (ownerChangedRecently) priority += 1.5;

  // Sessions ending soon
  if (lead.outstanding_sessions && lead.outstanding_sessions < 5 && lead.outstanding_sessions > 0) {
    priority += 1;
  }

  // Cap between 1-10
  return Math.max(1, Math.min(10, Math.round(priority)));
}

/**
 * Generate reason string explaining why this lead needs calling
 */
function generateReason(lead: any, priority: number): { reason: string; urgency_factors: string[] } {
  const factors: string[] = [];

  if (lead.health_zone === 'RED') {
    factors.push('RED health zone - critical');
  }

  const daysSinceContact = lead.days_since_last_contact || 0;
  if (daysSinceContact >= 14) {
    factors.push(`${daysSinceContact} days no contact`);
  } else if (daysSinceContact >= 7) {
    factors.push(`${daysSinceContact} days since last call`);
  }

  if (lead.pattern_status === 'PATTERN_BREAK') {
    factors.push('Booking pattern broken');
  }

  if (lead.risk_score >= 75) {
    factors.push('High churn risk');
  }

  const ownerChangedRecently = lead.owner_changed_at &&
    (new Date().getTime() - new Date(lead.owner_changed_at).getTime()) < (7 * 24 * 60 * 60 * 1000);
  if (ownerChangedRecently) {
    factors.push(`Owner changed to ${lead.current_owner || 'new coach'}`);
  }

  if (lead.outstanding_sessions && lead.outstanding_sessions < 5 && lead.outstanding_sessions > 0) {
    factors.push(`Only ${lead.outstanding_sessions} sessions left`);
  }

  if (lead.days_since_last_session && lead.days_since_last_session > 14) {
    factors.push(`${lead.days_since_last_session} days since last session`);
  }

  // Build reason string
  let reason = '';
  if (priority >= 8) {
    reason = 'URGENT: ';
  } else if (priority >= 6) {
    reason = 'High Priority: ';
  }

  reason += factors.length > 0 ? factors.join(' • ') : 'Follow-up needed';

  return { reason, urgency_factors: factors };
}

/**
 * Determine best communication channel based on context
 */
function recommendChannel(lead: any, priority: number): 'PHONE' | 'WHATSAPP' | 'EMAIL' | 'SMS' {
  // Critical situations require phone call
  if (priority >= 8 || lead.health_zone === 'RED') {
    return 'PHONE';
  }

  // Pattern breaks and medium priority: WhatsApp (personal but not intrusive)
  if (priority >= 6 || lead.pattern_status === 'PATTERN_BREAK') {
    return 'WHATSAPP';
  }

  // Owner changes: Personal message via WhatsApp
  const ownerChangedRecently = lead.owner_changed_at &&
    (new Date().getTime() - new Date(lead.owner_changed_at).getTime()) < (7 * 24 * 60 * 60 * 1000);
  if (ownerChangedRecently) {
    return 'WHATSAPP';
  }

  // Default to WhatsApp for fitness industry (more personal than email)
  return 'WHATSAPP';
}

/**
 * Generate draft message using AI or template
 */
async function generateDraftMessage(lead: any, priority: number, channel: string, urgencyFactors: string[]): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return getTemplateMessage(lead, priority, channel, urgencyFactors);
  }

  try {
    const ownerChangedRecently = lead.owner_changed_at &&
      (new Date().getTime() - new Date(lead.owner_changed_at).getTime()) < (7 * 24 * 60 * 60 * 1000);

    const context = `
Client: ${lead.firstname || 'Client'}
Priority: ${priority}/10
Channel: ${channel}
Health Zone: ${lead.health_zone}
Days Since Contact: ${lead.days_since_last_contact || 'Unknown'}
Urgency Factors: ${urgencyFactors.join(', ')}
Owner Changed: ${ownerChangedRecently ? `Yes, now with ${lead.current_owner}` : 'No'}
Sessions Remaining: ${lead.outstanding_sessions || 'Unknown'}
`;

    const prompt = `Generate a warm, personalized outreach message for this fitness client who needs to be called.

${context}

Requirements:
- Warm and personal (not salesy)
- Address the specific situation (don't be generic)
- Show genuine care for their wellbeing
- Clear call-to-action
- Under 80 words
- For ${channel} (use appropriate tone)
${channel === 'WHATSAPP' ? '- Can use 1-2 emojis sparingly' : ''}

Write only the message (no subject line):`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }]
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return data.content[0]?.text || getTemplateMessage(lead, priority, channel, urgencyFactors);
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.warn("[AI Message] Failed, using template:", fetchError);
    }
  } catch (error) {
    console.error("[AI Message] Error:", error);
  }

  return getTemplateMessage(lead, priority, channel, urgencyFactors);
}

/**
 * Template messages for when AI is unavailable
 */
function getTemplateMessage(lead: any, priority: number, channel: string, urgencyFactors: string[]): string {
  const name = lead.firstname || 'there';
  const owner = lead.current_owner || 'the team';

  const ownerChangedRecently = lead.owner_changed_at &&
    (new Date().getTime() - new Date(lead.owner_changed_at).getTime()) < (7 * 24 * 60 * 60 * 1000);

  // Owner change message
  if (ownerChangedRecently) {
    return `Hi ${name}! This is ${owner}, your new coach at PTD. I wanted to reach out personally and see how you're doing. I'd love to chat about your fitness goals and how I can best support you. When's a good time to connect?`;
  }

  // Critical/urgent
  if (priority >= 8) {
    return `Hi ${name}! I noticed it's been a while since we connected. I want to make sure everything is okay and see if there's anything we can do to support you better. Can we have a quick chat today? Your wellbeing matters to us!`;
  }

  // High priority
  if (priority >= 6) {
    return `Hey ${name}! Just checking in - I haven't seen you around lately and wanted to reach out. How have you been? Is there anything we can help with to get you back on track?`;
  }

  // Medium priority
  if (lead.pattern_status === 'PATTERN_BREAK') {
    return `Hi ${name}! I noticed your usual booking pattern has changed. Just wanted to check in and see if everything's alright. Sometimes life gets busy - how can we help you stay consistent?`;
  }

  // Sessions running low
  if (lead.outstanding_sessions && lead.outstanding_sessions < 5) {
    return `Hey ${name}! I saw you're running low on sessions. Let's chat about your progress and plan your next phase together. When works for you this week?`;
  }

  // Default
  return `Hi ${name}! Just wanted to check in and see how you're doing. It's been a bit since we connected. Let's catch up soon - when's a good time for you?`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const {
      owner = null, // Filter by specific owner/coach
      days_threshold = 3, // Minimum days since last contact
      include_all_zones = false, // If false, only RED/YELLOW/ORANGE
      limit = 50,
      generate_ai_messages = true
    } = await req.json().catch(() => ({}));

    console.log("[Get Leads] Fetching leads needing action...", { owner, days_threshold, limit });

    // Build query for leads needing attention
    let query = supabase
      .from("client_health_scores")
      .select("*")
      .gte("days_since_last_session", days_threshold);

    // Filter by owner if specified
    if (owner) {
      query = query.eq("hubspot_owner_name", owner);
    }

    // Filter by health zones unless all zones requested
    if (!include_all_zones) {
      query = query.in("health_zone", ["RED", "YELLOW", "ORANGE"]);
    }

    query = query.order("predictive_risk_score", { ascending: false }).limit(limit);

    const { data: healthScores, error: healthError } = await query;
    if (healthError) throw healthError;

    if (!healthScores || healthScores.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        duration_ms: Date.now() - startTime,
        count: 0,
        leads: [],
        message: "No leads found needing action"
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Get lead tracker data for days since contact
    const { data: leadTracker, error: trackerError } = await supabase
      .from("lead_status_tracker")
      .select("*")
      .in("client_email", healthScores.map(h => h.email));

    if (trackerError) {
      console.warn("[Get Leads] Lead tracker query failed:", trackerError);
    }

    // Create map for quick lookup
    const trackerMap = new Map(
      (leadTracker || []).map(t => [t.client_email, t])
    );

    // Process each lead
    const enrichedLeads: LeadAction[] = [];

    for (const health of healthScores) {
      const tracker = trackerMap.get(health.email);

      // Merge health score and tracker data
      const lead = {
        ...health,
        days_since_last_contact: tracker?.days_since_last_contact || health.days_since_last_session || 0,
        current_owner: health.hubspot_owner_name || tracker?.current_owner,
        owner_changed_at: health.owner_changed_at || tracker?.owner_changed_at,
        risk_score: health.predictive_risk_score || 50
      };

      // Calculate priority
      const priority = calculateAIPriority(lead);

      // Generate reason
      const { reason, urgency_factors } = generateReason(lead, priority);

      // Recommend channel
      const channel = recommendChannel(lead, priority);

      // Generate draft message
      let draftMessage = '';
      if (generate_ai_messages) {
        draftMessage = await generateDraftMessage(lead, priority, channel, urgency_factors);
      }

      const ownerChangedRecently = lead.owner_changed_at &&
        (new Date().getTime() - new Date(lead.owner_changed_at).getTime()) < (7 * 24 * 60 * 60 * 1000);

      enrichedLeads.push({
        client_email: lead.email,
        client_name: `${lead.firstname || ''} ${lead.lastname || ''}`.trim(),
        firstname: lead.firstname,
        lastname: lead.lastname,
        ai_priority: priority,
        reason,
        urgency_factors,
        draft_message: draftMessage,
        recommended_channel: channel,
        health_zone: lead.health_zone,
        days_since_last_contact: lead.days_since_last_contact,
        days_since_last_session: lead.days_since_last_session,
        pattern_status: lead.pattern_status,
        risk_score: lead.risk_score,
        current_owner: lead.current_owner,
        owner_recently_changed: ownerChangedRecently,
        calculated_at: new Date().toISOString()
      });

      // Update lead tracker with AI recommendation
      if (tracker && generate_ai_messages) {
        await supabase
          .from("lead_status_tracker")
          .update({
            ai_priority_score: priority,
            ai_recommendation: reason,
            ai_draft_message: draftMessage,
            ai_recommended_channel: channel,
            ai_reasoning: urgency_factors.join(' • '),
            ai_last_updated: new Date().toISOString()
          })
          .eq("client_email", lead.email);
      }
    }

    // Sort by priority (highest first)
    enrichedLeads.sort((a, b) => b.ai_priority - a.ai_priority);

    const duration = Date.now() - startTime;
    console.log(`[Get Leads] Complete in ${duration}ms - ${enrichedLeads.length} leads prioritized`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      count: enrichedLeads.length,
      leads: enrichedLeads,
      filters_applied: {
        owner: owner || 'all',
        days_threshold,
        include_all_zones
      }
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error("[Get Leads] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
