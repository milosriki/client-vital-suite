import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// ANOMALY DETECTOR AGENT
// Detects unusual patterns that indicate problems
// Catches issues before they become visible
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface Anomaly {
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  metric: string;
  expected_value: number | string;
  actual_value: number | string;
  deviation_percent: number | null;
  affected_entities: string[];
  detected_at: string;
  recommendation: string;
}

interface AnomalyReport {
  timestamp: string;
  anomalies_found: number;
  critical_count: number;
  anomalies: Anomaly[];
  system_status: "normal" | "attention_needed" | "critical";
}

async function detectZoneDistributionAnomalies(): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  // Get current zone distribution
  const { data: clients } = await supabase
    .from("client_health_scores")
    .select("health_zone, email");

  if (!clients?.length) return anomalies;

  const zones = { RED: 0, YELLOW: 0, GREEN: 0, PURPLE: 0 };
  clients.forEach(c => {
    if (c.health_zone in zones) {
      zones[c.health_zone as keyof typeof zones]++;
    }
  });

  const total = clients.length;

  // Expected distribution (based on healthy business)
  const expected = {
    RED: 0.10,     // Max 10%
    YELLOW: 0.20,  // Max 20%
    GREEN: 0.50,   // At least 50%
    PURPLE: 0.20   // Ideal champions
  };

  // Check RED zone anomaly
  const redPct = zones.RED / total;
  if (redPct > 0.15) {
    anomalies.push({
      type: "zone_distribution",
      severity: redPct > 0.25 ? "critical" : "high",
      title: "Abnormally High RED Zone",
      description: `${Math.round(redPct * 100)}% of clients are in RED zone, expected max 10%`,
      metric: "red_zone_percentage",
      expected_value: "≤10%",
      actual_value: `${Math.round(redPct * 100)}%`,
      deviation_percent: Math.round((redPct - 0.10) / 0.10 * 100),
      affected_entities: clients.filter(c => c.health_zone === "RED").map(c => c.email).slice(0, 10),
      detected_at: new Date().toISOString(),
      recommendation: "Investigate root cause - check for system issues or external factors"
    });
  }

  // Check GREEN+PURPLE anomaly
  const healthyPct = (zones.GREEN + zones.PURPLE) / total;
  if (healthyPct < 0.50) {
    anomalies.push({
      type: "zone_distribution",
      severity: healthyPct < 0.30 ? "critical" : "high",
      title: "Low Healthy Client Rate",
      description: `Only ${Math.round(healthyPct * 100)}% of clients are GREEN/PURPLE, expected 70%+`,
      metric: "healthy_rate",
      expected_value: "≥70%",
      actual_value: `${Math.round(healthyPct * 100)}%`,
      deviation_percent: Math.round((0.70 - healthyPct) / 0.70 * 100),
      affected_entities: [],
      detected_at: new Date().toISOString(),
      recommendation: "Review engagement strategies and intervention effectiveness"
    });
  }

  return anomalies;
}

async function detectScoreAnomalies(): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  // Get historical daily summaries for comparison
  const { data: summaries } = await supabase
    .from("daily_summary")
    .select("summary_date, avg_health_score, total_clients, red_count")
    .order("summary_date", { ascending: false })
    .limit(14);

  if (!summaries || summaries.length < 7) return anomalies;

  const recent = summaries.slice(0, 3);
  const historical = summaries.slice(3, 10);

  // Calculate averages
  const recentAvgScore = recent.reduce((sum, s) => sum + (s.avg_health_score || 0), 0) / recent.length;
  const historicalAvgScore = historical.reduce((sum, s) => sum + (s.avg_health_score || 0), 0) / historical.length;

  // Check for sudden drop in average health score
  const scoreDrop = historicalAvgScore - recentAvgScore;
  if (scoreDrop > 5) {
    anomalies.push({
      type: "score_trend",
      severity: scoreDrop > 10 ? "critical" : "high",
      title: "Sudden Health Score Drop",
      description: `Average health score dropped ${scoreDrop.toFixed(1)} points in the last 3 days`,
      metric: "avg_health_score",
      expected_value: historicalAvgScore.toFixed(1),
      actual_value: recentAvgScore.toFixed(1),
      deviation_percent: Math.round(scoreDrop / historicalAvgScore * 100),
      affected_entities: [],
      detected_at: new Date().toISOString(),
      recommendation: "Investigate what changed - new clients, data issues, or real engagement drop"
    });
  }

  // Check for client count anomaly
  const recentClientCount = recent[0]?.total_clients || 0;
  const historicalClientCount = historical[0]?.total_clients || 0;

  if (historicalClientCount > 0) {
    const clientChange = (recentClientCount - historicalClientCount) / historicalClientCount * 100;

    if (Math.abs(clientChange) > 20) {
      anomalies.push({
        type: "client_count",
        severity: "medium",
        title: clientChange > 0 ? "Unusual Client Count Increase" : "Unusual Client Count Decrease",
        description: `Client count changed by ${clientChange.toFixed(1)}% in a week`,
        metric: "total_clients",
        expected_value: historicalClientCount,
        actual_value: recentClientCount,
        deviation_percent: Math.round(clientChange),
        affected_entities: [],
        detected_at: new Date().toISOString(),
        recommendation: clientChange > 0
          ? "Verify new clients are valid (not duplicates)"
          : "Check for data sync issues or mass unsubscribes"
      });
    }
  }

  return anomalies;
}

async function detectCoachAnomalies(): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  // Get coach performance data
  const { data: coachData } = await supabase
    .from("client_health_scores")
    .select("assigned_coach, health_zone, momentum_indicator, health_score")
    .not("assigned_coach", "is", null);

  if (!coachData?.length) return anomalies;

  // Group by coach
  const coachStats = new Map<string, { total: number; red: number; declining: number; avgScore: number }>();

  coachData.forEach(client => {
    const coach = client.assigned_coach;
    if (!coach || coach === "Unassigned") return;

    if (!coachStats.has(coach)) {
      coachStats.set(coach, { total: 0, red: 0, declining: 0, avgScore: 0 });
    }

    const stats = coachStats.get(coach)!;
    stats.total++;
    if (client.health_zone === "RED") stats.red++;
    if (client.momentum_indicator === "DECLINING") stats.declining++;
    stats.avgScore += client.health_score || 0;
  });

  // Check each coach for anomalies
  coachStats.forEach((stats, coach) => {
    if (stats.total < 5) return; // Not enough clients to detect anomalies

    stats.avgScore = stats.avgScore / stats.total;
    const redPct = stats.red / stats.total * 100;
    const decliningPct = stats.declining / stats.total * 100;

    // Check for coach with abnormally high RED rate
    if (redPct > 30) {
      anomalies.push({
        type: "coach_performance",
        severity: redPct > 50 ? "critical" : "high",
        title: `Coach ${coach}: High RED Rate`,
        description: `${Math.round(redPct)}% of ${coach}'s clients are in RED zone`,
        metric: "coach_red_rate",
        expected_value: "≤15%",
        actual_value: `${Math.round(redPct)}%`,
        deviation_percent: Math.round((redPct - 15) / 15 * 100),
        affected_entities: [coach],
        detected_at: new Date().toISOString(),
        recommendation: "Review coach's client list, consider reassigning critical cases"
      });
    }

    // Check for coach with abnormally high declining rate
    if (decliningPct > 50) {
      anomalies.push({
        type: "coach_performance",
        severity: "high",
        title: `Coach ${coach}: High Decline Rate`,
        description: `${Math.round(decliningPct)}% of ${coach}'s clients are declining`,
        metric: "coach_declining_rate",
        expected_value: "≤30%",
        actual_value: `${Math.round(decliningPct)}%`,
        deviation_percent: Math.round((decliningPct - 30) / 30 * 100),
        affected_entities: [coach],
        detected_at: new Date().toISOString(),
        recommendation: "Schedule coach performance review and provide support"
      });
    }
  });

  return anomalies;
}

async function detectCAPIAnomalies(): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  // Check CAPI event patterns
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: events } = await supabase
    .from("capi_events_enriched")
    .select("send_status, event_name, created_at")
    .gte("created_at", dayAgo);

  if (!events?.length) {
    anomalies.push({
      type: "capi_activity",
      severity: "high",
      title: "No CAPI Events in 24 Hours",
      description: "No conversion events have been processed in the last 24 hours",
      metric: "capi_event_count",
      expected_value: ">0",
      actual_value: "0",
      deviation_percent: null,
      affected_entities: [],
      detected_at: new Date().toISOString(),
      recommendation: "Check HubSpot sync and event generation pipeline"
    });
    return anomalies;
  }

  const total = events.length;
  const failed = events.filter(e => e.send_status === "failed").length;
  const failRate = (failed / total) * 100;

  if (failRate > 20) {
    anomalies.push({
      type: "capi_failures",
      severity: failRate > 50 ? "critical" : "high",
      title: "High CAPI Failure Rate",
      description: `${Math.round(failRate)}% of CAPI events are failing to send`,
      metric: "capi_fail_rate",
      expected_value: "≤5%",
      actual_value: `${Math.round(failRate)}%`,
      deviation_percent: Math.round((failRate - 5) / 5 * 100),
      affected_entities: [],
      detected_at: new Date().toISOString(),
      recommendation: "Run capi-validator to identify and fix event issues"
    });
  }

  return anomalies;
}

async function detectDataPatternAnomalies(): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  // Check for unusual patterns in client data
  const { data: clients } = await supabase
    .from("client_health_scores")
    .select("email, sessions_last_7d, sessions_last_30d, days_since_last_session");

  if (!clients?.length) return anomalies;

  // Check for data consistency - sessions_7d should never exceed sessions_30d
  const inconsistent = clients.filter(c =>
    (c.sessions_last_7d || 0) > (c.sessions_last_30d || 0)
  );

  if (inconsistent.length > 0) {
    anomalies.push({
      type: "data_consistency",
      severity: "high",
      title: "Session Data Inconsistency",
      description: `${inconsistent.length} clients have more sessions in 7 days than in 30 days`,
      metric: "session_consistency",
      expected_value: "sessions_7d ≤ sessions_30d",
      actual_value: `${inconsistent.length} violations`,
      deviation_percent: null,
      affected_entities: inconsistent.slice(0, 5).map(c => c.email),
      detected_at: new Date().toISOString(),
      recommendation: "Check HubSpot sync and session calculation logic"
    });
  }

  // Check for impossible values
  const impossible = clients.filter(c =>
    (c.sessions_last_7d || 0) > 21 || // More than 3 sessions/day
    (c.days_since_last_session || 0) < 0
  );

  if (impossible.length > 0) {
    anomalies.push({
      type: "data_validity",
      severity: "medium",
      title: "Impossible Data Values",
      description: `${impossible.length} clients have impossible session or date values`,
      metric: "data_validity",
      expected_value: "Valid ranges",
      actual_value: `${impossible.length} violations`,
      deviation_percent: null,
      affected_entities: impossible.slice(0, 5).map(c => c.email),
      detected_at: new Date().toISOString(),
      recommendation: "Review data source and validation rules"
    });
  }

  return anomalies;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log("[Anomaly Detector] Scanning for anomalies...");

    // Run all detection algorithms in parallel
    const [zoneAnomalies, scoreAnomalies, coachAnomalies, capiAnomalies, dataAnomalies] = await Promise.all([
      detectZoneDistributionAnomalies(),
      detectScoreAnomalies(),
      detectCoachAnomalies(),
      detectCAPIAnomalies(),
      detectDataPatternAnomalies()
    ]);

    const allAnomalies = [
      ...zoneAnomalies,
      ...scoreAnomalies,
      ...coachAnomalies,
      ...capiAnomalies,
      ...dataAnomalies
    ];

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    allAnomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const criticalCount = allAnomalies.filter(a => a.severity === "critical").length;
    const highCount = allAnomalies.filter(a => a.severity === "high").length;

    // Determine system status
    let systemStatus: AnomalyReport["system_status"] = "normal";
    if (criticalCount > 0) systemStatus = "critical";
    else if (highCount > 0 || allAnomalies.length > 3) systemStatus = "attention_needed";

    const report: AnomalyReport = {
      timestamp: new Date().toISOString(),
      anomalies_found: allAnomalies.length,
      critical_count: criticalCount,
      anomalies: allAnomalies,
      system_status: systemStatus
    };

    // Store anomalies as proactive insights
    for (const anomaly of allAnomalies.filter(a => a.severity === "critical" || a.severity === "high")) {
      await supabase.from("proactive_insights").upsert({
        insight_type: "anomaly",
        priority: anomaly.severity,
        title: anomaly.title,
        content: anomaly.description,
        action_items: [anomaly.recommendation],
        affected_entities: { entities: anomaly.affected_entities, metric: anomaly.metric },
        source_agent: "anomaly_detector",
        dedup_key: `anomaly_${anomaly.type}_${anomaly.metric}_${new Date().toISOString().split("T")[0]}`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }, {
        onConflict: "dedup_key",
        ignoreDuplicates: true
      });
    }

    // Log the scan
    await supabase.from("sync_logs").insert({
      platform: "anomaly_detector",
      sync_type: "anomaly_scan",
      status: systemStatus === "normal" ? "success" : "completed_with_errors",
      records_processed: allAnomalies.length,
      records_failed: criticalCount,
      error_details: { anomalies: allAnomalies.map(a => ({ type: a.type, severity: a.severity })) },
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime
    });

    const duration = Date.now() - startTime;
    console.log(`[Anomaly Detector] Complete in ${duration}ms - Found ${allAnomalies.length} anomalies`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error("[Anomaly Detector] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
