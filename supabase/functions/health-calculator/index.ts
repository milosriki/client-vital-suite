import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// HEALTH CALCULATOR AGENT
// Recalculates all client health scores
// Replaces n8n Daily Calculator workflow
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ============================================
// SCORING ALGORITHMS
// ============================================

function calculateEngagementScore(client: any): number {
  let score = 50;

  // Recent activity bonus
  const sessions7d = client.sessions_last_7d || 0;
  if (sessions7d >= 3) score += 30;
  else if (sessions7d >= 2) score += 20;
  else if (sessions7d >= 1) score += 10;

  // Consistency bonus (30 days)
  const sessions30d = client.sessions_last_30d || 0;
  if (sessions30d >= 12) score += 15;
  else if (sessions30d >= 8) score += 10;

  // Recency penalty
  const daysSince = client.days_since_last_session || 999;
  if (daysSince > 30) score -= 30;
  else if (daysSince > 14) score -= 15;
  else if (daysSince > 7) score -= 5;

  return Math.max(0, Math.min(100, score));
}

function calculatePackageHealthScore(client: any): number {
  const outstanding = client.outstanding_sessions || 0;
  const purchased = client.sessions_purchased || 1;
  const remainingPct = (outstanding / purchased) * 100;

  if (remainingPct >= 50) return 90;
  if (remainingPct >= 30) return 70;
  if (remainingPct >= 10) return 50;
  return 30;
}

function calculateMomentumScore(client: any): number {
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

function calculateHealthScore(client: any): number {
  const engagement = calculateEngagementScore(client);
  const packageHealth = calculatePackageHealthScore(client);
  const momentum = calculateMomentumScore(client);

  return Math.round(engagement * 0.40 + packageHealth * 0.30 + momentum * 0.30);
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
  const daysSince = client.days_since_last_session || 999;
  if (daysSince > 30) risk += 25;
  else if (daysSince > 14) risk += 15;
  else if (daysSince <= 7) risk -= 10;

  // Package depletion
  const outstanding = client.outstanding_sessions || 0;
  const purchased = client.sessions_purchased || 1;
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

  try {
    const { mode = "full", client_emails = [] } = await req.json().catch(() => ({}));

    console.log(`[Health Calculator] Starting ${mode} calculation...`);

    // Fetch clients from HubSpot data or existing records
    let query = supabase
      .from("client_health_scores")
      .select("*")
      .order("calculated_at", { ascending: false });

    if (client_emails.length > 0) {
      query = query.in("email", client_emails);
    }

    const { data: existingClients, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching clients:", fetchError);
      throw fetchError;
    }

    // Get unique clients by email (latest record)
    const clientMap = new Map<string, any>();
    for (const client of existingClients || []) {
      if (!clientMap.has(client.email)) {
        clientMap.set(client.email, client);
      }
    }

    const clients = Array.from(clientMap.values());
    console.log(`[Health Calculator] Processing ${clients.length} clients`);

    const results = {
      processed: 0,
      updated: 0,
      errors: 0,
      zones: { RED: 0, YELLOW: 0, GREEN: 0, PURPLE: 0 },
      avgHealthScore: 0,
      criticalInterventions: 0
    };

    let totalScore = 0;

    for (const client of clients) {
      try {
        const engagement = calculateEngagementScore(client);
        const packageHealth = calculatePackageHealthScore(client);
        const momentumScore = calculateMomentumScore(client);
        const healthScore = calculateHealthScore(client);
        const healthZone = getHealthZone(healthScore);
        const momentum = getMomentumIndicator(client);
        const predictiveRisk = calculatePredictiveRisk(client, healthZone, momentum);
        const interventionPriority = getInterventionPriority(healthZone, predictiveRisk, momentum);

        // Update or insert new record
        const { error: upsertError } = await supabase
          .from("client_health_scores")
          .upsert({
            email: client.email,
            firstname: client.firstname,
            lastname: client.lastname,
            hubspot_contact_id: client.hubspot_contact_id,
            health_score: healthScore,
            health_zone: healthZone,
            engagement_score: engagement,
            package_health_score: packageHealth,
            momentum_score: momentumScore,
            momentum_indicator: momentum,
            predictive_risk_score: predictiveRisk,
            intervention_priority: interventionPriority,
            sessions_last_7d: client.sessions_last_7d,
            sessions_last_30d: client.sessions_last_30d,
            outstanding_sessions: client.outstanding_sessions,
            sessions_purchased: client.sessions_purchased,
            days_since_last_session: client.days_since_last_session,
            assigned_coach: client.assigned_coach,
            calculated_at: new Date().toISOString(),
            calculated_on: new Date().toISOString().split("T")[0],
            calculation_version: "AGENT_v1"
          }, {
            onConflict: "email"
          });

        if (upsertError) throw upsertError;

        results.processed++;
        results.updated++;
        results.zones[healthZone as keyof typeof results.zones]++;
        totalScore += healthScore;

        if (interventionPriority === "CRITICAL") {
          results.criticalInterventions++;
        }

      } catch (err) {
        console.error(`Error processing ${client.email}:`, err);
        results.errors++;
      }
    }

    results.avgHealthScore = results.processed > 0
      ? Math.round(totalScore / results.processed)
      : 0;

    // Update daily summary
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("daily_summary").upsert({
      summary_date: today,
      total_clients: results.processed,
      avg_health_score: results.avgHealthScore,
      red_count: results.zones.RED,
      yellow_count: results.zones.YELLOW,
      green_count: results.zones.GREEN,
      purple_count: results.zones.PURPLE,
      critical_interventions: results.criticalInterventions,
      generated_at: new Date().toISOString()
    }, { onConflict: "summary_date" });

    const duration = Date.now() - startTime;
    console.log(`[Health Calculator] Complete in ${duration}ms:`, results);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      results
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error("[Health Calculator] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
