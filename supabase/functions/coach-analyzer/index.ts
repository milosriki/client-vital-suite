import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

// ============================================
// COACH ANALYZER AGENT
// Analyzes coach performance and generates insights
// Monthly coach performance analysis
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface CoachMetrics {
  coach_name: string;
  total_clients: number;
  active_clients: number;
  zones: { RED: number; YELLOW: number; GREEN: number; PURPLE: number };
  avg_health_score: number;
  declining_count: number;
  improving_count: number;
  at_risk_revenue: number;
  performance_score: number;
  rank: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

async function analyzeCoaches(): Promise<CoachMetrics[]> {
  // Get all clients with health scores
  const { data: clients, error } = await supabase
    .from("client_health_scores")
    .select("*")
    .not("assigned_coach", "is", null);

  if (error) {
    console.error("Error fetching clients:", error);
    throw error;
  }

  if (!clients?.length) {
    console.log("No clients with assigned coaches found");
    return [];
  }

  // Group by coach with null check
  const coachMap = new Map<string, any[]>();
  for (const client of clients) {
    const coach = client.assigned_coach;
    if (!coach || coach === "Unassigned" || coach.trim() === "") continue;
    if (!coachMap.has(coach)) coachMap.set(coach, []);
    coachMap.get(coach)!.push(client);
  }

  const coachMetrics: CoachMetrics[] = [];

  coachMap.forEach((clientList, coachName) => {
    const total = clientList.length || 1; // Prevent division by zero
    const active = clientList.filter(c => (c.sessions_last_30d || 0) > 0).length;

    const zones = { RED: 0, YELLOW: 0, GREEN: 0, PURPLE: 0 };
    let totalScore = 0;
    let declining = 0;
    let improving = 0;
    let atRiskRevenue = 0;

    for (const client of clientList) {
      zones[client.health_zone as keyof typeof zones]++;
      totalScore += client.health_score || 0;

      if (client.momentum_indicator === "DECLINING") declining++;
      if (client.momentum_indicator === "ACCELERATING") improving++;

      if (client.health_zone === "RED" || client.health_zone === "YELLOW") {
        atRiskRevenue += client.package_value_aed || 0;
      }
    }

    const avgHealth = total > 0 ? Math.round(totalScore / total) : 0;
    const healthyRate = total > 0 ? ((zones.GREEN + zones.PURPLE) / total) * 100 : 0;
    const redRate = total > 0 ? (zones.RED / total) * 100 : 0;
    const decliningRate = total > 0 ? (declining / total) * 100 : 0;

    // Calculate performance score (0-100)
    let performanceScore = 50;
    performanceScore += (healthyRate - 60) * 0.5; // Bonus/penalty for healthy rate vs 60% baseline
    performanceScore -= redRate * 1.5; // Penalty for RED clients
    performanceScore -= decliningRate * 0.5; // Penalty for declining clients
    performanceScore += (avgHealth - 65) * 0.3; // Bonus for above-average health
    performanceScore = Math.max(0, Math.min(100, performanceScore));

    // Identify strengths
    const strengths: string[] = [];
    if (healthyRate >= 75) strengths.push("High healthy client rate");
    if (zones.PURPLE >= 3) strengths.push(`${zones.PURPLE} champion clients`);
    if (redRate < 10) strengths.push("Excellent risk management");
    if (improving > declining) strengths.push("More clients improving than declining");
    if (avgHealth >= 75) strengths.push("Above-average client health");

    // Identify weaknesses
    const weaknesses: string[] = [];
    if (redRate >= 20) weaknesses.push(`${Math.round(redRate)}% clients in RED zone`);
    if (decliningRate >= 40) weaknesses.push(`${Math.round(decliningRate)}% clients declining`);
    if (avgHealth < 60) weaknesses.push(`Low average health score (${avgHealth})`);
    if (zones.YELLOW > zones.GREEN) weaknesses.push("More YELLOW than GREEN clients");
    if (active < total * 0.7) weaknesses.push(`Only ${Math.round((active/total)*100)}% clients active`);

    // Generate recommendations
    const recommendations: string[] = [];
    if (zones.RED > 0) {
      recommendations.push(`Review ${zones.RED} RED clients immediately`);
    }
    if (decliningRate >= 30) {
      recommendations.push("Implement proactive check-ins for declining clients");
    }
    if (atRiskRevenue > 20000) {
      recommendations.push(`Protect AED ${atRiskRevenue.toLocaleString()} at-risk revenue`);
    }
    if (weaknesses.length > 2) {
      recommendations.push("Schedule performance review meeting");
    }

    coachMetrics.push({
      coach_name: coachName,
      total_clients: total,
      active_clients: active,
      zones,
      avg_health_score: avgHealth,
      declining_count: declining,
      improving_count: improving,
      at_risk_revenue: atRiskRevenue,
      performance_score: Math.round(performanceScore),
      rank: 0, // Will be set after sorting
      strengths,
      weaknesses,
      recommendations
    });
  });

  // Sort by performance and assign ranks
  coachMetrics.sort((a, b) => b.performance_score - a.performance_score);
  coachMetrics.forEach((coach, idx) => {
    coach.rank = idx + 1;
  });

  return coachMetrics;
}

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  const startTime = Date.now();

  try {
    const { coach_name, save_to_db = true } = await req.json().catch(() => ({}));

    console.log("[Coach Analyzer] Analyzing coaches...");

    let coaches = await analyzeCoaches();

    // Filter to specific coach if requested
    if (coach_name) {
      coaches = coaches.filter(c =>
        c.coach_name.toLowerCase().includes(coach_name.toLowerCase())
      );
    }

    // Save to database
    if (save_to_db) {
      const today = new Date().toISOString().split("T")[0];

      for (const coach of coaches) {
        await supabase.from("coach_performance").upsert({
          coach_name: coach.coach_name,
          report_date: today,
          total_clients: coach.total_clients,
          active_clients: coach.active_clients,
          clients_red: coach.zones.RED,
          clients_yellow: coach.zones.YELLOW,
          clients_green: coach.zones.GREEN,
          clients_purple: coach.zones.PURPLE,
          avg_client_health: coach.avg_health_score,
          clients_declining: coach.declining_count,
          clients_improving: coach.improving_count,
          at_risk_revenue_aed: coach.at_risk_revenue,
          performance_score: coach.performance_score,
          coach_rank: coach.rank,
          strengths: coach.strengths.join("; "),
          weaknesses: coach.weaknesses.join("; "),
          created_at: new Date().toISOString()
        }, {
          onConflict: "coach_name,report_date",
          ignoreDuplicates: false
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Coach Analyzer] Complete in ${duration}ms - ${coaches.length} coaches analyzed`);

    // Summary stats
    const summary = {
      total_coaches: coaches.length,
      avg_performance: coaches.length > 0 ? Math.round(coaches.reduce((sum, c) => sum + c.performance_score, 0) / coaches.length) : 0,
      top_performer: coaches[0]?.coach_name || "N/A",
      needs_attention: coaches.filter(c => c.performance_score < 50).map(c => c.coach_name)
    };

    return apiError("INTERNAL_ERROR", JSON.stringify({
      success: true,
      duration_ms: duration,
      summary,
      coaches
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error: unknown) {
    console.error("[Coach Analyzer] Error:", error);
    return apiSuccess({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
