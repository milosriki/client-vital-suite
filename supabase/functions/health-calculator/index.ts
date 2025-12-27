/// <reference lib="deno.ns" />
import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// HEALTH CALCULATOR AGENT
// Recalculates all client health scores
// Daily health score calculation for all clients
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validate required environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL environment variable is required");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Domains used for test/mock data that should be excluded from calculations
const TEST_EMAIL_PATTERNS = ["%@example.com", "%@test.com", "%@email.com"];

// ============================================
// SCORING ALGORITHMS (PENALTY-BASED FORMULA - OWNER APPROVED)
// BASE: 100 points, then subtract penalties and add bonuses
// ============================================

interface ScoreFactors {
  inactivityPenalty: number;
  frequencyDropPenalty: number;
  utilizationPenalty: number;
  commitmentBonus: number;
}

// Helper function to calculate days since a date
function getDaysSince(dateValue: string | number | null | undefined): number {
  if (!dateValue) return 999;
  
  let date: Date;
  if (typeof dateValue === 'number') {
    // HubSpot sometimes returns millisecond timestamps
    date = new Date(dateValue);
  } else if (typeof dateValue === 'string') {
    // Try parsing as ISO string or timestamp
    const parsed = Date.parse(dateValue);
    if (isNaN(parsed)) return 999;
    date = new Date(parsed);
  } else {
    return 999;
  }
  
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Calculate engagement score (kept for backwards compatibility with UI)
function calculateEngagementScore(client: any): number {
  let score = 50;
  const sessions7d = client.sessions_last_7d || 0;
  if (sessions7d >= 3) score += 30;
  else if (sessions7d >= 2) score += 20;
  else if (sessions7d >= 1) score += 10;

  const sessions30d = client.sessions_last_30d || 0;
  if (sessions30d >= 12) score += 15;
  else if (sessions30d >= 8) score += 10;

  let daysSince = getDaysSince(client.last_paid_session_date || client.last_activity_date);
  if (client.days_since_last_session && client.days_since_last_session < daysSince) {
    daysSince = client.days_since_last_session;
  }

  if (daysSince > 30) score -= 30;
  else if (daysSince > 14) score -= 15;
  else if (daysSince > 7) score -= 5;

  return Math.max(0, Math.min(100, score));
}

// Calculate package health score (kept for backwards compatibility with UI)
function calculatePackageHealthScore(client: any): number {
  const outstanding = client.outstanding_sessions || 0;
  const purchased = client.sessions_purchased || 1;
  const remainingPct = (outstanding / purchased) * 100;

  if (remainingPct >= 50) return 90;
  if (remainingPct >= 30) return 70;
  if (remainingPct >= 10) return 50;
  return 30;
}

// Calculate momentum score (kept for backwards compatibility with UI)
function calculateMomentumScore(client: any): number {
  const avgWeekly7d = client.sessions_last_7d || 0;
  const avgWeekly30d = (client.sessions_last_30d || 0) / 4.3;

  if (avgWeekly30d === 0) {
    return client.sessions_last_7d > 0 ? 70 : 30;
  }

  const rateOfChange = ((avgWeekly7d - avgWeekly30d) / avgWeekly30d) * 100;

  if (rateOfChange > 20) return 90;
  if (rateOfChange > 0) return 70;
  if (rateOfChange > -20) return 50;
  return 30;
}

function getMomentumIndicator(client: any): string {
  const avgWeekly7d = client.sessions_last_7d || 0;
  const avgWeekly30d = (client.sessions_last_30d || 0) / 4.3;

  if (avgWeekly30d === 0) {
    return client.sessions_last_7d > 0 ? "STABLE" : "DECLINING";
  }

  const rateOfChange = ((avgWeekly7d - avgWeekly30d) / avgWeekly30d) * 100;

  if (rateOfChange > 20) return "ACCELERATING";
  if (rateOfChange > -20) return "STABLE";
  return "DECLINING";
}

// NEW: Penalty-based health score calculation (Owner Approved Formula)
function calculateHealthScoreWithFactors(client: any): { score: number; factors: ScoreFactors } {
  let score = 100;
  const factors: ScoreFactors = {
    inactivityPenalty: 0,
    frequencyDropPenalty: 0,
    utilizationPenalty: 0,
    commitmentBonus: 0,
  };

  // 1. INACTIVITY PENALTY (max -40)
  let daysSinceSession = getDaysSince(client.last_paid_session_date || client.last_activity_date);
  if (client.days_since_last_session && client.days_since_last_session < daysSinceSession) {
    daysSinceSession = client.days_since_last_session;
  }
  
  if (daysSinceSession > 30) {
    factors.inactivityPenalty = 40;
  } else if (daysSinceSession > 14) {
    factors.inactivityPenalty = 30;
  } else if (daysSinceSession > 7) {
    factors.inactivityPenalty = 20;
  } else if (daysSinceSession > 2) {
    factors.inactivityPenalty = 10;
  }
  score -= factors.inactivityPenalty;

  // 2. FREQUENCY DROP PENALTY (max -25)
  const sessions7d = client.sessions_last_7d || 0;
  const sessions30d = client.sessions_last_30d || 0;
  const expectedWeekly = sessions30d / 4;
  
  if (expectedWeekly > 0) {
    const dropPercent = ((expectedWeekly - sessions7d) / expectedWeekly) * 100;
    if (dropPercent >= 50) {
      factors.frequencyDropPenalty = 25;
    } else if (dropPercent >= 25) {
      factors.frequencyDropPenalty = 15;
    }
  }
  score -= factors.frequencyDropPenalty;

  // 3. PACKAGE UTILIZATION PENALTY (max -15)
  const purchased = client.sessions_purchased || 0;
  const remaining = client.outstanding_sessions || 0;
  const used = purchased - remaining;
  const utilization = purchased > 0 ? (used / purchased) * 100 : 0;
  
  if (utilization < 20) {
    factors.utilizationPenalty = 15;
  } else if (utilization < 50) {
    factors.utilizationPenalty = 5;
  }
  score -= factors.utilizationPenalty;

  // 4. COMMITMENT BONUS (max +10)
  const nextSessionBooked = client.next_session_is_booked;
  const isBooked = nextSessionBooked === true || 
                   nextSessionBooked === 'Y' || 
                   nextSessionBooked === 'Yes' || 
                   nextSessionBooked === 'true' || 
                   nextSessionBooked === '1';
  
  if (isBooked) {
    const futureBooked = client.future_booked_sessions || 0;
    factors.commitmentBonus = futureBooked > 1 ? 10 : 5;
  }
  score += factors.commitmentBonus;

  // Cap 0-100
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  return { score: finalScore, factors };
}

// Main health score function (uses new penalty-based formula)
function calculateHealthScore(client: any): number {
  const { score } = calculateHealthScoreWithFactors(client);
  return score;
}

function getHealthZone(score: number): string {
  if (score >= 85) return "PURPLE";
  if (score >= 70) return "GREEN";
  if (score >= 50) return "YELLOW";
  return "RED";
}

function calculatePredictiveRisk(client: any, healthZone: string, momentum: string): number {
  let risk = 50;

  // Momentum impact
  if (momentum === "DECLINING") risk += 30;
  else if (momentum === "ACCELERATING") risk -= 15;

  // Recent activity
  const sessions7d = client.sessions_last_7d || 0;
  if (sessions7d === 0) risk += 25;
  else if (sessions7d < 1) risk += 15;
  else if (sessions7d >= 2) risk -= 10;

  // Gap impact
  // Calculate days since last activity if we have a date
  let daysSince = 999;
  if (client.last_activity_date) {
    const lastDate = new Date(client.last_activity_date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastDate.getTime());
    daysSince = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } else if (client.days_since_last_session) {
    daysSince = client.days_since_last_session;
  }

  if (daysSince > 30) risk += 25;
  else if (daysSince > 14) risk += 15;
  else if (daysSince <= 7) risk -= 10;

  // Package depletion
  const outstanding = client.outstanding_sessions || 0;
  const purchased = client.sessions_purchased || 1; // Prevent division by zero
  const remainingPct = (outstanding / purchased) * 100;
  if (remainingPct < 10 && sessions7d < 2) risk += 20;
  else if (remainingPct > 50) risk -= 10;

  // Zone mismatch
  if (healthZone === "GREEN" && momentum === "DECLINING") risk += 10;

  return Math.max(0, Math.min(100, risk));
}

function getInterventionPriority(zone: string, risk: number, momentum: string): string {
  if (zone === "RED" && risk > 75) return "CRITICAL";
  if (zone === "RED" || risk > 60) return "HIGH";
  if (zone === "YELLOW" && momentum === "DECLINING") return "HIGH";
  if (zone === "GREEN" && momentum === "DECLINING") return "MEDIUM";
  if (zone === "YELLOW") return "MEDIUM";
  return "LOW";
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const debugLogs: any[] = [];

  try {
    const { mode = "full", client_emails = [] } = await req.json().catch(() => ({}));

    console.log(`[Health Calculator] Starting ${mode} calculation...`);
    debugLogs.push({ location: 'health-calculator/index.ts:191', message: 'Starting calculation', data: { mode }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H1' });

    // Fetch only real customers from CONTACTS table (Source of Truth)
    let query = supabase
      .from("contacts")
      .select("*")
      .eq("lifecycle_stage", "customer");

    for (const pattern of TEST_EMAIL_PATTERNS) {
      query = query.not("email", "ilike", pattern);
    }

    if (client_emails.length > 0) {
      query = query.in("email", client_emails);
    }

    const { data: contacts, error: fetchError } = await query;

    debugLogs.push({ location: 'health-calculator/index.ts:202', message: 'Contacts fetched', data: { count: contacts?.length, error: fetchError }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H1' });

    if (fetchError) {
      console.error("Error fetching contacts:", fetchError);
      throw fetchError;
    }

    // Process all contacts
    console.log(`[Health Calculator] Processing ${contacts?.length || 0} clients from contacts table`);

    const results = {
      processed: 0,
      updated: 0,
      errors: 0,
      zones: { RED: 0, YELLOW: 0, GREEN: 0, PURPLE: 0 },
      avgHealthScore: 0,
      criticalInterventions: 0
    };

    const upsertPayloads: any[] = [];
    let totalScore = 0;

    for (const client of contacts || []) {
      try {
        if (!client.email) continue;

        const engagement = calculateEngagementScore(client);
        const packageHealth = calculatePackageHealthScore(client);
        const momentumScore = calculateMomentumScore(client);
        const healthScore = calculateHealthScore(client);
        const healthZone = getHealthZone(healthScore);
        const momentum = getMomentumIndicator(client);
        const predictiveRisk = calculatePredictiveRisk(client, healthZone, momentum);
        const interventionPriority = getInterventionPriority(healthZone, predictiveRisk, momentum);

        if (results.processed === 0) {
          debugLogs.push({ location: 'health-calculator/index.ts:238', message: 'Calculated score for first client', data: { email: client.email, score: healthScore, zone: healthZone }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H2' });
        }

        upsertPayloads.push({
          email: client.email,
          firstname: client.first_name,
          lastname: client.last_name,
          hubspot_contact_id: client.hubspot_contact_id,
          health_score: healthScore,
          health_zone: healthZone,
          engagement_score: engagement,
          package_health_score: packageHealth,
          momentum_score: momentumScore,
          health_trend: momentum,
          churn_risk_score: predictiveRisk,
          intervention_priority: interventionPriority,
          sessions_last_7d: client.sessions_last_7d || 0,
          sessions_last_30d: client.sessions_last_30d || 0,
          outstanding_sessions: client.outstanding_sessions || 0,
          sessions_purchased: client.sessions_purchased || 0,
          days_since_last_session: client.days_since_last_session || 0,
          assigned_coach: client.assigned_coach,
          calculated_at: new Date().toISOString(),
          calculated_on: new Date().toISOString().split("T")[0],
          calculation_version: "PENALTY_v3"
        });

        results.processed++;
        results.zones[healthZone as keyof typeof results.zones]++;
        totalScore += healthScore;

        if (interventionPriority === "CRITICAL") {
          results.criticalInterventions++;
        }

      } catch (clientError) {
        console.error(`Error processing client ${client.email}:`, clientError);
        results.errors++;
        continue;
      }
    }

    // Batch upsert for performance
    const batchSize = 100;
    let batchIndex = 0;
    let batchFailures = 0;
    while (batchIndex * batchSize < upsertPayloads.length) {
      const start = batchIndex * batchSize;
      const batch = upsertPayloads.slice(start, start + batchSize);
      console.log(`[Health Calculator] Upserting batch ${batchIndex + 1} with ${batch.length} records`);

      const { error: upsertError } = await supabase
        .from("client_health_scores")
        .upsert(batch, { onConflict: "email" });

      if (upsertError) {
        batchFailures += batch.length;
        console.error("Batch upsert error:", upsertError);
      } else {
        results.updated += batch.length;
      }

      batchIndex++;
    }

    console.log(`[Health Calculator] Processed ${results.processed} contacts across ${batchIndex} batches with ${batchFailures} failures`);

    results.avgHealthScore = results.processed > 0
      ? Math.round(totalScore / results.processed)
      : 0;

    // Update daily summary
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("daily_summary").upsert({
      summary_date: today,
      total_active_clients: results.processed,
      avg_health_score: results.avgHealthScore,
      red_clients: results.zones.RED,
      yellow_clients: results.zones.YELLOW,
      green_clients: results.zones.GREEN,
      purple_clients: results.zones.PURPLE,
      critical_interventions: results.criticalInterventions,
      updated_at: new Date().toISOString()
    }, { onConflict: "summary_date" });

    const duration = Date.now() - startTime;
    console.log(`[Health Calculator] Complete in ${duration}ms:`, results);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      results,
      debugLogs
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    debugLogs.push({ location: 'health-calculator/index.ts:317', message: 'Global error', data: { error: String(error) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H3' });
    console.error("[Health Calculator] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      debugLogs
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
