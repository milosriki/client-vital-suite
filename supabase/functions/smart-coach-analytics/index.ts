import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

// ============================================
// SMART COACH ANALYTICS
// Advanced coach performance analysis with:
// - Predictive metrics (churn prediction, revenue at risk)
// - Leading indicators (forward booking rate, adherence gap)
// - Actionable outputs (priority clients, recommended actions)
// - Fair comparisons (confidence-adjusted rankings)
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

// ============================================
// TYPES
// ============================================

type MomentumDirection = "ACCELERATING" | "STABLE" | "DECLINING";
type InterventionType = "BOOK_NEXT_SESSION" | "REACTIVATE_INACTIVE" | "RENEWAL_PUSH" | "PACKAGE_UPSELL";
type HealthZone = "RED" | "YELLOW" | "GREEN" | "PURPLE";

interface PriorityClient {
  contact_id: string;
  name: string;
  email: string;
  health_score: number;
  sessions_7d: number;
  sessions_30d: number;
  outstanding_sessions: number;
  revenue_at_risk: number;
  days_inactive: number;
  intervention_type: InterventionType;
  urgency_score: number;
  reason: string;
  next_session_booked: boolean;
}

interface SmartCoachMetrics {
  // Identity
  coach_name: string;
  
  // Portfolio Size
  total_clients: number;
  active_clients: number;
  inactive_clients: number;
  churned_clients: number;
  
  // Data Quality
  clients_with_session_data: number;
  clients_with_package_data: number;
  data_completeness_score: number;
  
  // Health Distribution
  red_zone_count: number;
  yellow_zone_count: number;
  green_zone_count: number;
  purple_zone_count: number;
  
  // Distributional Metrics
  avg_health_score: number;
  median_health_score: number;
  p10_health_score: number;
  p90_health_score: number;
  health_score_stddev: number;
  
  // Concentration Risk
  red_zone_share: number;
  high_risk_revenue_share: number;
  
  // Activity Metrics
  avg_sessions_7d: number;
  avg_sessions_30d: number;
  avg_sessions_90d: number;
  avg_utilization: number;
  
  // Leading Indicators
  forward_booking_rate: number;
  avg_future_booked_sessions: number;
  adherence_gap: number;
  
  // Trend Analysis
  momentum_direction: MomentumDirection;
  week_over_week_change: number;
  
  // Revenue Intelligence
  total_outstanding_sessions: number;
  total_revenue_at_risk: number;
  revenue_at_risk_critical: number;
  
  // Predictive Metrics
  predicted_churn_count_30d: number;
  predicted_revenue_loss_30d: number;
  intervention_urgency_score: number;
  
  // Comparative Analytics
  rank_vs_peers: number;
  percentile_health_score: number;
  benchmark_gap: number;
  adjusted_health_score: number;
  
  // Rates
  retention_rate: number;
  engagement_rate: number;
  booking_rate: number;
  
  // Actionable Outputs
  top_priority_clients: PriorityClient[];
  recommended_focus: InterventionType;
  recommended_actions: string[];
  
  // Strengths & Weaknesses
  strengths: string[];
  weaknesses: string[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getHealthZone(score: number): HealthZone {
  if (score >= 85) return "PURPLE";
  if (score >= 70) return "GREEN";
  if (score >= 50) return "YELLOW";
  return "RED";
}

function calculateChurnRisk(client: any): number {
  let risk = 50;
  
  const sessions7d = client.sessions_last_7d || 0;
  const sessions30d = client.sessions_last_30d || 0;
  const outstanding = client.outstanding_sessions || 0;
  const purchased = client.sessions_purchased || 1;
  const nextBooked = client.next_session_is_booked === "Y";
  
  // No sessions in 7 days = high risk
  if (sessions7d === 0) risk += 25;
  else if (sessions7d < 1) risk += 15;
  else if (sessions7d >= 2) risk -= 10;
  
  // Not booked = very high risk
  if (!nextBooked && outstanding > 0) risk += 20;
  
  // Package almost depleted
  const utilization = purchased > 0 ? (purchased - outstanding) / purchased : 0;
  if (utilization > 0.9 && outstanding > 0) risk += 15;
  
  // Declining momentum
  const weeklyAvg30d = sessions30d / 4.3;
  if (weeklyAvg30d > 0 && sessions7d < weeklyAvg30d * 0.5) risk += 15;
  
  // No activity in 30 days but has sessions
  if (sessions30d === 0 && outstanding > 0) risk += 20;
  
  return Math.max(0, Math.min(100, risk));
}

function getMomentumDirection(sessions7d: number, sessions30d: number): MomentumDirection {
  const weeklyAvg30d = sessions30d / 4.3;
  
  if (weeklyAvg30d === 0) {
    return sessions7d > 0 ? "STABLE" : "DECLINING";
  }
  
  const rateOfChange = ((sessions7d - weeklyAvg30d) / weeklyAvg30d) * 100;
  
  if (rateOfChange > 20) return "ACCELERATING";
  if (rateOfChange > -20) return "STABLE";
  return "DECLINING";
}

function getInterventionType(client: any): InterventionType {
  const sessions7d = client.sessions_last_7d || 0;
  const sessions30d = client.sessions_last_30d || 0;
  const outstanding = client.outstanding_sessions || 0;
  const purchased = client.sessions_purchased || 1;
  const nextBooked = client.next_session_is_booked === "Y";
  
  // Package almost depleted - renewal push
  if (outstanding < 5 && outstanding > 0) {
    return "RENEWAL_PUSH";
  }
  
  // Inactive but has sessions - reactivate
  if (sessions30d === 0 && outstanding > 0) {
    return "REACTIVATE_INACTIVE";
  }
  
  // Active but not booked - book next session
  if (!nextBooked && outstanding > 0) {
    return "BOOK_NEXT_SESSION";
  }
  
  // Healthy client - upsell
  const utilization = purchased > 0 ? (purchased - outstanding) / purchased : 0;
  if (utilization < 0.5 && sessions7d >= 2) {
    return "PACKAGE_UPSELL";
  }
  
  return "BOOK_NEXT_SESSION";
}

function calculateUrgencyScore(client: any): number {
  let urgency = 0;
  
  const sessions7d = client.sessions_last_7d || 0;
  const sessions30d = client.sessions_last_30d || 0;
  const outstanding = client.outstanding_sessions || 0;
  const packageCost = client.last_package_cost || 4500;
  const nextBooked = client.next_session_is_booked === "Y";
  const healthScore = client.health_score || 26;
  
  // No sessions + not booked + has sessions remaining
  if (sessions7d === 0 && !nextBooked && outstanding > 0) {
    urgency += 40;
  }
  
  // High package value at risk
  if (packageCost > 10000 && sessions30d < 4) {
    urgency += 30;
  }
  
  // Package almost depleted
  if (outstanding < 5 && outstanding > 0) {
    urgency += 20;
  }
  
  // RED zone
  if (healthScore < 50) {
    urgency += 15;
  }
  
  // No activity in 30 days
  if (sessions30d === 0 && outstanding > 0) {
    urgency += 25;
  }
  
  return Math.min(100, urgency);
}

function generateReason(client: any): string {
  const reasons: string[] = [];
  
  const sessions7d = client.sessions_last_7d || 0;
  const sessions30d = client.sessions_last_30d || 0;
  const outstanding = client.outstanding_sessions || 0;
  const packageCost = client.last_package_cost || 0;
  const nextBooked = client.next_session_is_booked === "Y";
  
  if (sessions7d === 0 && outstanding > 0) {
    reasons.push("No sessions in 7 days");
  }
  
  if (!nextBooked && outstanding > 0) {
    reasons.push("No next session booked");
  }
  
  if (packageCost > 10000 && sessions30d < 4) {
    reasons.push(`High value (AED ${packageCost.toLocaleString()}) at risk`);
  }
  
  if (outstanding < 5 && outstanding > 0) {
    reasons.push(`Only ${outstanding} sessions remaining`);
  }
  
  if (sessions30d === 0 && outstanding > 0) {
    reasons.push("Inactive for 30+ days");
  }
  
  return reasons.join(" | ") || "Routine check-in";
}

function calculatePercentile(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  const index = sortedValues.findIndex(v => v >= value);
  if (index === -1) return 100;
  return Math.round((index / sortedValues.length) * 100);
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function getPercentileValue(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.floor((percentile / 100) * sortedValues.length);
  return sortedValues[Math.min(index, sortedValues.length - 1)];
}

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

async function analyzeCoachesSmartly(): Promise<SmartCoachMetrics[]> {
  // Fetch all clients with health scores
  const { data: clients, error } = await supabase
    .from("client_health_scores")
    .select("*");

  if (error) {
    console.error("Error fetching clients:", error);
    throw error;
  }

  if (!clients?.length) {
    console.log("No clients found");
    return [];
  }

  // Group by coach
  const coachMap = new Map<string, any[]>();
  for (const client of clients) {
    const coach = client.assigned_coach;
    if (!coach || coach === "Unassigned" || coach.trim() === "" || coach === "Not Booked/Nurture") continue;
    if (!coachMap.has(coach)) coachMap.set(coach, []);
    coachMap.get(coach)!.push(client);
  }

  const coachMetrics: SmartCoachMetrics[] = [];
  const allHealthScores: number[] = [];

  // First pass: collect all health scores for org-wide calculations
  coachMap.forEach((clientList) => {
    for (const client of clientList) {
      if (client.health_score) allHealthScores.push(client.health_score);
    }
  });

  const orgAvgHealth = allHealthScores.length > 0 
    ? allHealthScores.reduce((a, b) => a + b, 0) / allHealthScores.length 
    : 50;

  // Second pass: calculate metrics for each coach
  coachMap.forEach((clientList, coachName) => {
    const total = clientList.length || 1;
    
    // Health scores for this coach
    const healthScores = clientList.map(c => c.health_score || 0).sort((a, b) => a - b);
    
    // Activity metrics
    const sessions7dValues = clientList.map(c => c.sessions_last_7d || 0);
    const sessions30dValues = clientList.map(c => c.sessions_last_30d || 0);
    const sessions90dValues = clientList.map(c => c.sessions_last_90d || 0);
    
    // Count by zone
    const zones = { RED: 0, YELLOW: 0, GREEN: 0, PURPLE: 0 };
    let activeClients = 0;
    let inactiveClients = 0;
    let churnedClients = 0;
    let clientsWithSessionData = 0;
    let clientsWithPackageData = 0;
    let totalOutstanding = 0;
    let totalRevenueAtRisk = 0;
    let criticalRevenueAtRisk = 0;
    let clientsWithNextBooked = 0;
    let totalFutureBooked = 0;
    let predictedChurn = 0;
    let predictedRevenueLoss = 0;
    
    const priorityClients: PriorityClient[] = [];
    
    for (const client of clientList) {
      const zone = getHealthZone(client.health_score || 0);
      zones[zone]++;
      
      const sessions30d = client.sessions_last_30d || 0;
      const outstanding = client.outstanding_sessions || 0;
      const purchased = client.sessions_purchased || 0;
      const packageCost = client.last_package_cost || 4500;
      const nextBooked = client.next_session_is_booked === "Y";
      
      // Activity classification
      if (sessions30d > 0) activeClients++;
      else if (outstanding > 0) inactiveClients++;
      else churnedClients++;
      
      // Data quality
      if (client.sessions_last_7d !== null || client.sessions_last_30d !== null) clientsWithSessionData++;
      if (purchased > 0) clientsWithPackageData++;
      
      // Revenue calculations
      totalOutstanding += outstanding;
      const clientRevenueAtRisk = outstanding > 0 ? (outstanding / Math.max(purchased, 1)) * packageCost : 0;
      totalRevenueAtRisk += clientRevenueAtRisk;
      if (zone === "RED") criticalRevenueAtRisk += clientRevenueAtRisk;
      
      // Forward booking
      if (nextBooked) clientsWithNextBooked++;
      totalFutureBooked += client.of_future_booked_sessions || 0;
      
      // Churn prediction
      const churnRisk = calculateChurnRisk(client);
      if (churnRisk >= 70) {
        predictedChurn++;
        predictedRevenueLoss += clientRevenueAtRisk;
      }
      
      // Priority client calculation
      const urgency = calculateUrgencyScore(client);
      if (urgency >= 30) {
        priorityClients.push({
          contact_id: client.hubspot_contact_id || client.email,
          name: `${client.firstname || ""} ${client.lastname || ""}`.trim() || client.email,
          email: client.email,
          health_score: client.health_score || 0,
          sessions_7d: client.sessions_last_7d || 0,
          sessions_30d: sessions30d,
          outstanding_sessions: outstanding,
          revenue_at_risk: clientRevenueAtRisk,
          days_inactive: sessions30d === 0 ? 30 : (client.sessions_last_7d === 0 ? 7 : 0),
          intervention_type: getInterventionType(client),
          urgency_score: urgency,
          reason: generateReason(client),
          next_session_booked: nextBooked
        });
      }
    }
    
    // Sort priority clients by urgency
    priorityClients.sort((a, b) => b.urgency_score - a.urgency_score);
    
    // Calculate averages
    const avgHealth = healthScores.length > 0 ? healthScores.reduce((a, b) => a + b, 0) / healthScores.length : 0;
    const avgSessions7d = sessions7dValues.reduce((a, b) => a + b, 0) / total;
    const avgSessions30d = sessions30dValues.reduce((a, b) => a + b, 0) / total;
    const avgSessions90d = sessions90dValues.reduce((a, b) => a + b, 0) / total;
    
    // Utilization
    let totalUtilization = 0;
    let utilizationCount = 0;
    for (const client of clientList) {
      const purchased = client.sessions_purchased || 0;
      const outstanding = client.outstanding_sessions || 0;
      if (purchased > 0) {
        totalUtilization += (purchased - outstanding) / purchased;
        utilizationCount++;
      }
    }
    const avgUtilization = utilizationCount > 0 ? totalUtilization / utilizationCount : 0;
    
    // Leading indicators
    const forwardBookingRate = total > 0 ? (clientsWithNextBooked / total) * 100 : 0;
    const avgFutureBooked = total > 0 ? totalFutureBooked / total : 0;
    
    // Adherence gap (expected - actual)
    const expectedWeekly = 2; // Assume 2 sessions/week is target
    const adherenceGap = expectedWeekly - avgSessions7d;
    
    // Momentum direction
    const momentumDirection = getMomentumDirection(avgSessions7d, avgSessions30d);
    
    // Week over week change (simplified)
    const weekOverWeekChange = avgSessions30d > 0 
      ? ((avgSessions7d - (avgSessions30d / 4.3)) / (avgSessions30d / 4.3)) * 100 
      : 0;
    
    // Confidence-adjusted health score (shrink toward org mean for small portfolios)
    const shrinkageFactor = Math.min(1.0, total / 20);
    const adjustedHealthScore = shrinkageFactor * avgHealth + (1 - shrinkageFactor) * orgAvgHealth;
    
    // Data completeness
    const dataCompleteness = ((clientsWithSessionData + clientsWithPackageData) / (total * 2)) * 100;
    
    // Concentration risk
    const redZoneShare = total > 0 ? (zones.RED / total) * 100 : 0;
    const top3RiskClients = priorityClients.slice(0, 3);
    const top3Revenue = top3RiskClients.reduce((sum, c) => sum + c.revenue_at_risk, 0);
    const highRiskRevenueShare = totalRevenueAtRisk > 0 ? (top3Revenue / totalRevenueAtRisk) * 100 : 0;
    
    // Intervention urgency score (coach level)
    const interventionUrgency = Math.min(100, 
      (zones.RED * 10) + 
      (inactiveClients * 5) + 
      (predictedChurn * 8) +
      (100 - forwardBookingRate) * 0.3
    );
    
    // Rates
    const retentionRate = total > 0 ? ((total - churnedClients) / total) * 100 : 0;
    const engagementRate = total > 0 ? (activeClients / total) * 100 : 0;
    const bookingRate = forwardBookingRate;
    
    // Recommended focus
    let recommendedFocus: InterventionType = "BOOK_NEXT_SESSION";
    if (forwardBookingRate < 50) recommendedFocus = "BOOK_NEXT_SESSION";
    else if (inactiveClients / total > 0.3) recommendedFocus = "REACTIVATE_INACTIVE";
    else if (priorityClients.filter(c => c.intervention_type === "RENEWAL_PUSH").length > 3) recommendedFocus = "RENEWAL_PUSH";
    else if (avgHealth > 70) recommendedFocus = "PACKAGE_UPSELL";
    
    // Generate recommended actions
    const recommendedActions: string[] = [];
    if (zones.RED > 0) recommendedActions.push(`Review ${zones.RED} RED zone clients immediately`);
    if (forwardBookingRate < 50) recommendedActions.push(`Book next sessions for ${Math.round(total - clientsWithNextBooked)} clients`);
    if (inactiveClients > 0) recommendedActions.push(`Reactivate ${inactiveClients} inactive clients`);
    if (criticalRevenueAtRisk > 10000) recommendedActions.push(`Protect AED ${Math.round(criticalRevenueAtRisk).toLocaleString()} critical revenue`);
    if (predictedChurn > 0) recommendedActions.push(`Prevent ${predictedChurn} predicted churns (AED ${Math.round(predictedRevenueLoss).toLocaleString()})`);
    
    // Strengths
    const strengths: string[] = [];
    const healthyRate = ((zones.GREEN + zones.PURPLE) / total) * 100;
    if (healthyRate >= 75) strengths.push("High healthy client rate");
    if (zones.PURPLE >= 3) strengths.push(`${zones.PURPLE} champion clients`);
    if (redZoneShare < 10) strengths.push("Excellent risk management");
    if (forwardBookingRate >= 70) strengths.push("Strong forward booking");
    if (avgHealth >= 75) strengths.push("Above-average client health");
    if (engagementRate >= 80) strengths.push("High engagement rate");
    
    // Weaknesses
    const weaknesses: string[] = [];
    if (redZoneShare >= 20) weaknesses.push(`${Math.round(redZoneShare)}% clients in RED zone`);
    if (forwardBookingRate < 40) weaknesses.push(`Only ${Math.round(forwardBookingRate)}% clients have next session booked`);
    if (avgHealth < 60) weaknesses.push(`Low average health score (${Math.round(avgHealth)})`);
    if (inactiveClients / total > 0.3) weaknesses.push(`${Math.round((inactiveClients / total) * 100)}% clients inactive`);
    if (predictedChurn > total * 0.2) weaknesses.push(`${predictedChurn} clients predicted to churn`);
    
    coachMetrics.push({
      coach_name: coachName,
      total_clients: total,
      active_clients: activeClients,
      inactive_clients: inactiveClients,
      churned_clients: churnedClients,
      clients_with_session_data: clientsWithSessionData,
      clients_with_package_data: clientsWithPackageData,
      data_completeness_score: Math.round(dataCompleteness),
      red_zone_count: zones.RED,
      yellow_zone_count: zones.YELLOW,
      green_zone_count: zones.GREEN,
      purple_zone_count: zones.PURPLE,
      avg_health_score: Math.round(avgHealth),
      median_health_score: healthScores.length > 0 ? healthScores[Math.floor(healthScores.length / 2)] : 0,
      p10_health_score: getPercentileValue(healthScores, 10),
      p90_health_score: getPercentileValue(healthScores, 90),
      health_score_stddev: Math.round(calculateStdDev(healthScores)),
      red_zone_share: Math.round(redZoneShare),
      high_risk_revenue_share: Math.round(highRiskRevenueShare),
      avg_sessions_7d: Math.round(avgSessions7d * 10) / 10,
      avg_sessions_30d: Math.round(avgSessions30d * 10) / 10,
      avg_sessions_90d: Math.round(avgSessions90d * 10) / 10,
      avg_utilization: Math.round(avgUtilization * 100),
      forward_booking_rate: Math.round(forwardBookingRate),
      avg_future_booked_sessions: Math.round(avgFutureBooked * 10) / 10,
      adherence_gap: Math.round(adherenceGap * 10) / 10,
      momentum_direction: momentumDirection,
      week_over_week_change: Math.round(weekOverWeekChange),
      total_outstanding_sessions: totalOutstanding,
      total_revenue_at_risk: Math.round(totalRevenueAtRisk),
      revenue_at_risk_critical: Math.round(criticalRevenueAtRisk),
      predicted_churn_count_30d: predictedChurn,
      predicted_revenue_loss_30d: Math.round(predictedRevenueLoss),
      intervention_urgency_score: Math.round(interventionUrgency),
      rank_vs_peers: 0, // Set after sorting
      percentile_health_score: 0, // Set after sorting
      benchmark_gap: 0, // Set after sorting
      adjusted_health_score: Math.round(adjustedHealthScore),
      retention_rate: Math.round(retentionRate),
      engagement_rate: Math.round(engagementRate),
      booking_rate: Math.round(bookingRate),
      top_priority_clients: priorityClients.slice(0, 5),
      recommended_focus: recommendedFocus,
      recommended_actions: recommendedActions,
      strengths,
      weaknesses
    });
  });

  // Sort by adjusted health score and assign ranks
  coachMetrics.sort((a, b) => b.adjusted_health_score - a.adjusted_health_score);
  
  const topPerformerScore = coachMetrics[0]?.adjusted_health_score || 0;
  const allAdjustedScores = coachMetrics.map(c => c.adjusted_health_score).sort((a, b) => a - b);
  
  coachMetrics.forEach((coach, idx) => {
    coach.rank_vs_peers = idx + 1;
    coach.percentile_health_score = calculatePercentile(coach.adjusted_health_score, allAdjustedScores);
    coach.benchmark_gap = Math.round(topPerformerScore - coach.adjusted_health_score);
  });

  return coachMetrics;
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  const startTime = Date.now();

  try {
    const { coach_name, save_to_db = true } = await req.json().catch(() => ({}));

    console.log("[Smart Coach Analytics] Starting analysis...");

    let coaches = await analyzeCoachesSmartly();

    // Filter to specific coach if requested
    if (coach_name) {
      coaches = coaches.filter(c =>
        c.coach_name.toLowerCase().includes(coach_name.toLowerCase())
      );
    }

    // Save to database
    if (save_to_db && coaches.length > 0) {
      const today = new Date().toISOString().split("T")[0];

      for (const coach of coaches) {
        await supabase.from("smart_coach_analytics").upsert({
          coach_name: coach.coach_name,
          report_date: today,
          total_clients: coach.total_clients,
          active_clients: coach.active_clients,
          inactive_clients: coach.inactive_clients,
          churned_clients: coach.churned_clients,
          data_completeness_score: coach.data_completeness_score,
          red_zone_count: coach.red_zone_count,
          yellow_zone_count: coach.yellow_zone_count,
          green_zone_count: coach.green_zone_count,
          purple_zone_count: coach.purple_zone_count,
          avg_health_score: coach.avg_health_score,
          median_health_score: coach.median_health_score,
          health_score_stddev: coach.health_score_stddev,
          red_zone_share: coach.red_zone_share,
          avg_sessions_7d: coach.avg_sessions_7d,
          avg_sessions_30d: coach.avg_sessions_30d,
          avg_utilization: coach.avg_utilization,
          forward_booking_rate: coach.forward_booking_rate,
          adherence_gap: coach.adherence_gap,
          momentum_direction: coach.momentum_direction,
          total_outstanding_sessions: coach.total_outstanding_sessions,
          total_revenue_at_risk: coach.total_revenue_at_risk,
          revenue_at_risk_critical: coach.revenue_at_risk_critical,
          predicted_churn_count_30d: coach.predicted_churn_count_30d,
          predicted_revenue_loss_30d: coach.predicted_revenue_loss_30d,
          intervention_urgency_score: coach.intervention_urgency_score,
          rank_vs_peers: coach.rank_vs_peers,
          adjusted_health_score: coach.adjusted_health_score,
          retention_rate: coach.retention_rate,
          engagement_rate: coach.engagement_rate,
          booking_rate: coach.booking_rate,
          recommended_focus: coach.recommended_focus,
          recommended_actions: coach.recommended_actions,
          strengths: coach.strengths,
          weaknesses: coach.weaknesses,
          top_priority_clients: coach.top_priority_clients,
          created_at: new Date().toISOString()
        }, {
          onConflict: "coach_name,report_date",
          ignoreDuplicates: false
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Smart Coach Analytics] Complete in ${duration}ms - ${coaches.length} coaches analyzed`);

    // Summary stats
    const summary = {
      total_coaches: coaches.length,
      avg_health_score: coaches.length > 0 
        ? Math.round(coaches.reduce((sum, c) => sum + c.avg_health_score, 0) / coaches.length) 
        : 0,
      total_clients: coaches.reduce((sum, c) => sum + c.total_clients, 0),
      total_at_risk_revenue: coaches.reduce((sum, c) => sum + c.total_revenue_at_risk, 0),
      total_predicted_churn: coaches.reduce((sum, c) => sum + c.predicted_churn_count_30d, 0),
      avg_forward_booking_rate: coaches.length > 0
        ? Math.round(coaches.reduce((sum, c) => sum + c.forward_booking_rate, 0) / coaches.length)
        : 0,
      top_performer: coaches[0]?.coach_name || "N/A",
      needs_attention: coaches.filter(c => c.intervention_urgency_score > 60).map(c => c.coach_name)
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
    console.error("[Smart Coach Analytics] Error:", error);
    return apiSuccess({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
