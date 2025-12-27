import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// PTD WATCHER AGENT
// Proactive monitoring and anomaly detection
// Runs on schedule to surface insights
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================
// THRESHOLD CONFIGURATIONS
// ============================================
const THRESHOLDS = {
  // Zone thresholds
  RED_ZONE_ALERT: 5, // Alert if more than 5 clients in RED
  RED_ZONE_CRITICAL: 10, // Critical if more than 10 in RED
  YELLOW_SURGE_PCT: 30, // Alert if YELLOW is more than 30%

  // Individual client thresholds
  RISK_SCORE_CRITICAL: 75,
  DAYS_SINCE_CRITICAL: 30,
  SCORE_DROP_THRESHOLD: 15, // Alert if score drops 15+ points

  // Coach thresholds
  COACH_RED_PCT: 20, // Alert if coach has >20% RED
  COACH_DECLINING_PCT: 50, // Alert if >50% of coach's clients declining

  // Company thresholds
  AVG_HEALTH_WARNING: 60,
  AVG_HEALTH_CRITICAL: 50
};

// ============================================
// INSIGHT GENERATORS
// ============================================

interface Insight {
  type: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  content: string;
  action_items: string[];
  affected_entities: any;
  dedup_key: string;
}

async function checkZoneDistribution(): Promise<Insight[]> {
  const insights: Insight[] = [];

  const { data: healthScores } = await supabase
    .from("client_health_scores")
    .select("email, firstname, lastname, health_zone, health_score, predictive_risk_score")
    .order("calculated_at", { ascending: false });

  if (!healthScores?.length) return insights;

  // Get unique clients (latest scores)
  const latestByEmail = new Map<string, any>();
  healthScores.forEach(hs => {
    if (!latestByEmail.has(hs.email)) {
      latestByEmail.set(hs.email, hs);
    }
  });

  const clients = Array.from(latestByEmail.values());
  const total = clients.length;

  const zones = {
    RED: clients.filter(c => c.health_zone === "RED"),
    YELLOW: clients.filter(c => c.health_zone === "YELLOW"),
    GREEN: clients.filter(c => c.health_zone === "GREEN"),
    PURPLE: clients.filter(c => c.health_zone === "PURPLE")
  };

  // Check RED zone threshold
  if (zones.RED.length >= THRESHOLDS.RED_ZONE_CRITICAL) {
    insights.push({
      type: "alert",
      priority: "critical",
      title: `CRITICAL: ${zones.RED.length} Clients in RED Zone`,
      content: `There are ${zones.RED.length} clients in RED zone, which exceeds the critical threshold of ${THRESHOLDS.RED_ZONE_CRITICAL}. Immediate action required to prevent mass churn.

Top at-risk clients:
${zones.RED.slice(0, 5).map(c => `- ${c.firstname} ${c.lastname}: Score ${c.health_score}, Risk ${c.predictive_risk_score}`).join('\n')}`,
      action_items: [
        "Review all RED zone clients immediately",
        "Prioritize clients with highest risk scores",
        "Schedule emergency interventions within 24 hours"
      ],
      affected_entities: {
        clients: zones.RED.map(c => c.email),
        count: zones.RED.length
      },
      dedup_key: `red_zone_critical_${new Date().toISOString().split('T')[0]}`
    });
  } else if (zones.RED.length >= THRESHOLDS.RED_ZONE_ALERT) {
    insights.push({
      type: "alert",
      priority: "high",
      title: `${zones.RED.length} Clients in RED Zone`,
      content: `RED zone client count (${zones.RED.length}) exceeds warning threshold. These clients need immediate attention.`,
      action_items: [
        "Review RED zone clients today",
        "Create intervention plans"
      ],
      affected_entities: {
        clients: zones.RED.map(c => c.email),
        count: zones.RED.length
      },
      dedup_key: `red_zone_alert_${new Date().toISOString().split('T')[0]}`
    });
  }

  // Check YELLOW surge
  const yellowPct = (zones.YELLOW.length / total) * 100;
  if (yellowPct >= THRESHOLDS.YELLOW_SURGE_PCT) {
    insights.push({
      type: "alert",
      priority: "medium",
      title: `YELLOW Zone Surge: ${Math.round(yellowPct)}% of Clients`,
      content: `${zones.YELLOW.length} clients (${Math.round(yellowPct)}%) are in YELLOW zone. This is higher than the ${THRESHOLDS.YELLOW_SURGE_PCT}% threshold and may indicate a systemic issue.`,
      action_items: [
        "Analyze common patterns among YELLOW clients",
        "Consider proactive outreach campaign",
        "Check for coach-related patterns"
      ],
      affected_entities: {
        clients: zones.YELLOW.map(c => c.email),
        count: zones.YELLOW.length
      },
      dedup_key: `yellow_surge_${new Date().toISOString().split('T')[0]}`
    });
  }

  return insights;
}

async function checkCoachPerformance(): Promise<Insight[]> {
  const insights: Insight[] = [];

  const { data: healthScores } = await supabase
    .from("client_health_scores")
    .select("email, assigned_coach, health_zone, momentum_indicator, health_score")
    .not("assigned_coach", "is", null);

  if (!healthScores?.length) return insights;

  // Group by coach
  const coachClients = new Map<string, any[]>();
  healthScores.forEach(hs => {
    const coach = hs.assigned_coach || "Unassigned";
    if (!coachClients.has(coach)) {
      coachClients.set(coach, []);
    }
    coachClients.get(coach)!.push(hs);
  });

  // Analyze each coach
  coachClients.forEach((clients, coach) => {
    if (coach === "Unassigned" || clients.length < 3) return;

    const redCount = clients.filter(c => c.health_zone === "RED").length;
    const decliningCount = clients.filter(c => c.momentum_indicator === "DECLINING").length;
    const total = clients.length;

    const redPct = (redCount / total) * 100;
    const decliningPct = (decliningCount / total) * 100;

    // High RED percentage
    if (redPct >= THRESHOLDS.COACH_RED_PCT) {
      insights.push({
        type: "alert",
        priority: "high",
        title: `Coach ${coach}: ${Math.round(redPct)}% Clients in RED`,
        content: `${coach} has ${redCount} out of ${total} clients in RED zone (${Math.round(redPct)}%). This is above the ${THRESHOLDS.COACH_RED_PCT}% threshold and may indicate:
- Coach needs support or training
- Client-coach fit issues
- External factors affecting this coach's clients`,
        action_items: [
          `Review ${coach}'s client list`,
          "Consider coach performance discussion",
          "Evaluate client reassignment for critical cases"
        ],
        affected_entities: {
          coach: coach,
          clients: clients.filter(c => c.health_zone === "RED").map(c => c.email),
          count: redCount
        },
        dedup_key: `coach_red_${coach}_${new Date().toISOString().split('T')[0]}`
      });
    }

    // High declining percentage
    if (decliningPct >= THRESHOLDS.COACH_DECLINING_PCT) {
      insights.push({
        type: "pattern",
        priority: "medium",
        title: `Coach ${coach}: ${Math.round(decliningPct)}% Clients Declining`,
        content: `${decliningCount} out of ${total} clients with ${coach} have DECLINING momentum. This pattern warrants investigation.`,
        action_items: [
          "Analyze what's causing the decline",
          "Consider coach training or support"
        ],
        affected_entities: {
          coach: coach,
          clients: clients.filter(c => c.momentum_indicator === "DECLINING").map(c => c.email),
          count: decliningCount
        },
        dedup_key: `coach_declining_${coach}_${new Date().toISOString().split('T')[0]}`
      });
    }
  });

  return insights;
}

async function checkEarlyWarnings(): Promise<Insight[]> {
  const insights: Insight[] = [];

  // Find GREEN clients with DECLINING momentum (early warning)
  const { data: earlyWarnings } = await supabase
    .from("client_health_scores")
    .select("email, firstname, lastname, health_score, momentum_indicator, rate_of_change_percent, sessions_last_7d")
    .eq("health_zone", "GREEN")
    .eq("momentum_indicator", "DECLINING")
    .order("rate_of_change_percent", { ascending: true });

  if (earlyWarnings && earlyWarnings.length >= 3) {
    insights.push({
      type: "pattern",
      priority: "medium",
      title: `Early Warning: ${earlyWarnings.length} GREEN Clients Declining`,
      content: `${earlyWarnings.length} clients are currently in GREEN zone but have DECLINING momentum. These clients look healthy but are trending down and may drop to YELLOW soon.

Clients to watch:
${earlyWarnings.slice(0, 5).map(c => `- ${c.firstname} ${c.lastname}: Score ${c.health_score}, Change ${c.rate_of_change_percent}%`).join('\n')}

This is an opportunity for proactive intervention before they become at-risk.`,
      action_items: [
        "Send proactive check-in messages",
        "Monitor these clients closely",
        "Consider scheduling wellness calls"
      ],
      affected_entities: {
        clients: earlyWarnings.map(c => c.email),
        count: earlyWarnings.length
      },
      dedup_key: `early_warning_${new Date().toISOString().split('T')[0]}`
    });
  }

  return insights;
}

async function checkPackageDepletion(): Promise<Insight[]> {
  const insights: Insight[] = [];

  // Find clients with low package remaining
  const { data: lowPackage } = await supabase
    .from("client_health_scores")
    .select("email, firstname, lastname, outstanding_sessions, sessions_purchased, sessions_last_7d, health_zone")
    .lt("outstanding_sessions", 5)
    .gt("outstanding_sessions", 0);

  if (lowPackage && lowPackage.length > 0) {
    // Split into opportunities (active) and risks (inactive)
    const opportunities = lowPackage.filter(c => c.sessions_last_7d >= 1);
    const risks = lowPackage.filter(c => c.sessions_last_7d === 0);

    if (opportunities.length >= 3) {
      insights.push({
        type: "recommendation",
        priority: "medium",
        title: `Renewal Opportunity: ${opportunities.length} Active Clients Low on Sessions`,
        content: `${opportunities.length} clients have fewer than 5 sessions remaining but are still actively training. This is a great renewal opportunity!

Top opportunities:
${opportunities.slice(0, 5).map(c => `- ${c.firstname} ${c.lastname}: ${c.outstanding_sessions} sessions left, ${c.sessions_last_7d} this week`).join('\n')}`,
        action_items: [
          "Start renewal conversations",
          "Prepare special renewal offers",
          "Schedule package review sessions"
        ],
        affected_entities: {
          clients: opportunities.map(c => c.email),
          count: opportunities.length,
          type: "opportunity"
        },
        dedup_key: `renewal_opp_${new Date().toISOString().split('T')[0]}`
      });
    }

    if (risks.length >= 2) {
      insights.push({
        type: "alert",
        priority: "high",
        title: `Risk: ${risks.length} Inactive Clients Almost Out of Sessions`,
        content: `${risks.length} clients have fewer than 5 sessions left and haven't trained in the last 7 days. High risk of package expiring without renewal.

At-risk:
${risks.slice(0, 5).map(c => `- ${c.firstname} ${c.lastname}: ${c.outstanding_sessions} sessions left, Zone: ${c.health_zone}`).join('\n')}`,
        action_items: [
          "Urgent outreach to re-engage",
          "Offer incentives to return",
          "Consider extending package deadline"
        ],
        affected_entities: {
          clients: risks.map(c => c.email),
          count: risks.length,
          type: "risk"
        },
        dedup_key: `package_risk_${new Date().toISOString().split('T')[0]}`
      });
    }
  }

  return insights;
}

async function checkCompanyHealth(): Promise<Insight[]> {
  const insights: Insight[] = [];

  const { data: summary } = await supabase
    .from("daily_summary")
    .select("*")
    .order("date", { ascending: false })
    .limit(7);

  if (!summary?.length) return insights;

  const today = summary[0];

  // Check average health score
  if (today.average_health_score < THRESHOLDS.AVG_HEALTH_CRITICAL) {
    insights.push({
      type: "alert",
      priority: "critical",
      title: `CRITICAL: Company Health at ${today.average_health_score}`,
      content: `Company average health score has dropped to ${today.average_health_score}, below the critical threshold of ${THRESHOLDS.AVG_HEALTH_CRITICAL}. This indicates a systemic problem.`,
      action_items: [
        "Emergency review of all operations",
        "Identify root cause of decline",
        "Implement immediate intervention program"
      ],
      affected_entities: {
        metric: "company_avg_health",
        value: today.average_health_score
      },
      dedup_key: `company_health_critical_${new Date().toISOString().split('T')[0]}`
    });
  } else if (today.average_health_score < THRESHOLDS.AVG_HEALTH_WARNING) {
    insights.push({
      type: "alert",
      priority: "high",
      title: `Company Health Declining: ${today.average_health_score}`,
      content: `Company average health score is ${today.average_health_score}, below the warning threshold of ${THRESHOLDS.AVG_HEALTH_WARNING}.`,
      action_items: [
        "Review declining clients",
        "Increase intervention frequency"
      ],
      affected_entities: {
        metric: "company_avg_health",
        value: today.average_health_score
      },
      dedup_key: `company_health_warning_${new Date().toISOString().split('T')[0]}`
    });
  }

  // Check week-over-week trend
  if (summary.length >= 7) {
    const weekAgo = summary[6];
    const weekChange = today.average_health_score - weekAgo.average_health_score;

    if (weekChange < -5) {
      insights.push({
        type: "pattern",
        priority: "high",
        title: `Company Health Down ${Math.abs(weekChange).toFixed(1)} Points This Week`,
        content: `Company average health has dropped from ${weekAgo.average_health_score} to ${today.average_health_score} over the past week. This is a concerning trend.`,
        action_items: [
          "Analyze what changed this week",
          "Check for external factors",
          "Increase proactive outreach"
        ],
        affected_entities: {
          metric: "weekly_change",
          value: weekChange
        },
        dedup_key: `company_weekly_decline_${new Date().toISOString().split('T')[0]}`
      });
    }
  }

  return insights;
}

// ============================================
// MAIN WATCHER HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log("[PTD Watcher] Starting proactive scan...");

    // Run all checks in parallel
    const [
      zoneInsights,
      coachInsights,
      earlyWarnings,
      packageInsights,
      companyInsights
    ] = await Promise.all([
      checkZoneDistribution(),
      checkCoachPerformance(),
      checkEarlyWarnings(),
      checkPackageDepletion(),
      checkCompanyHealth()
    ]);

    // Combine all insights
    const allInsights = [
      ...zoneInsights,
      ...coachInsights,
      ...earlyWarnings,
      ...packageInsights,
      ...companyInsights
    ];

    console.log(`[PTD Watcher] Found ${allInsights.length} insights`);

    // Insert insights (with dedup)
    let inserted = 0;
    for (const insight of allInsights) {
      const { error } = await supabase
        .from("proactive_insights")
        .upsert({
          insight_type: insight.type,
          priority: insight.priority,
          title: insight.title,
          content: insight.content,
          action_items: insight.action_items,
          affected_entities: insight.affected_entities,
          source_agent: "watcher",
          dedup_key: insight.dedup_key,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h expiry
        }, {
          onConflict: 'dedup_key'
        });

      if (error) {
        console.error("Error upserting insight:", error);
      } else {
        inserted++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[PTD Watcher] Complete. Inserted ${inserted} new insights in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      insights_found: allInsights.length,
      insights_inserted: inserted,
      duration_ms: duration,
      breakdown: {
        zone_alerts: zoneInsights.length,
        coach_alerts: coachInsights.length,
        early_warnings: earlyWarnings.length,
        package_alerts: packageInsights.length,
        company_alerts: companyInsights.length
      }
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error("[PTD Watcher] Error:", error);
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
