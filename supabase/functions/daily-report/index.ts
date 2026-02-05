import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import {
  handleError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";

// ============================================
// DAILY REPORT AGENT
// Generates daily summary and sends notifications
// Daily summary email report generation
// ============================================

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

interface DailyReport {
  date: string;
  summary: {
    totalClients: number;
    avgHealthScore: number;
    zones: { RED: number; YELLOW: number; GREEN: number; PURPLE: number };
    healthyRate: number;
    atRiskRevenue: number;
  };
  changes: {
    newRed: string[];
    improvedToGreen: string[];
    criticalDrops: string[];
  };
  topRisks: Array<{
    name: string;
    email: string;
    score: number;
    risk: number;
    reason: string;
  }>;
  coachAlerts: Array<{
    coach: string;
    issue: string;
    clients: number;
  }>;
  recommendations: string[];
}

async function generateReport(): Promise<DailyReport> {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // Get today's health scores
  const { data: todayScores, error: todayError } = await supabase
    .from("client_health_scores")
    .select("*")
    .gte("calculated_on", today);

  if (todayError) {
    console.error("Error fetching today's scores:", todayError);
    throw todayError;
  }

  // Get yesterday's for comparison
  const { data: yesterdayScores, error: yesterdayError } = await supabase
    .from("client_health_scores")
    .select("email, health_zone, health_score")
    .eq("calculated_on", yesterday);

  if (yesterdayError) {
    console.error("Error fetching yesterday's scores:", yesterdayError);
    // Non-fatal - continue without comparison data
  }

  const yesterdayMap = new Map(
    (yesterdayScores || []).map((c) => [c.email, c]),
  );

  // Calculate summary
  const clients = todayScores || [];
  const zones = { RED: 0, YELLOW: 0, GREEN: 0, PURPLE: 0 };
  let totalScore = 0;
  let totalAtRiskRevenue = 0;

  const newRed: string[] = [];
  const improvedToGreen: string[] = [];
  const criticalDrops: string[] = [];
  const topRisks: DailyReport["topRisks"] = [];

  for (const client of clients) {
    zones[client.health_zone as keyof typeof zones]++;
    totalScore += client.health_score || 0;

    // Check for zone changes
    const yesterday = yesterdayMap.get(client.email);
    if (yesterday) {
      if (client.health_zone === "RED" && yesterday.health_zone !== "RED") {
        newRed.push(`${client.firstname} ${client.lastname}`);
      }
      if (
        (client.health_zone === "GREEN" || client.health_zone === "PURPLE") &&
        (yesterday.health_zone === "RED" || yesterday.health_zone === "YELLOW")
      ) {
        improvedToGreen.push(`${client.firstname} ${client.lastname}`);
      }
      if ((client.health_score || 0) < (yesterday.health_score || 0) - 15) {
        criticalDrops.push(
          `${client.firstname} ${client.lastname} (${yesterday.health_score} → ${client.health_score})`,
        );
      }
    }

    // Track at-risk revenue
    if (client.health_zone === "RED" || client.health_zone === "YELLOW") {
      totalAtRiskRevenue += client.package_value_aed || 0;
    }

    // Collect top risks
    if (client.predictive_risk_score >= 60) {
      let reason = "";
      if (client.days_since_last_session > 14)
        reason = `No session in ${client.days_since_last_session} days`;
      else if (client.momentum_indicator === "DECLINING")
        reason = "Declining momentum";
      else if ((client.outstanding_sessions || 0) < 5)
        reason = "Package almost depleted";
      else reason = "Multiple risk factors";

      topRisks.push({
        name: `${client.firstname} ${client.lastname}`,
        email: client.email,
        score: client.health_score,
        risk: client.predictive_risk_score,
        reason,
      });
    }
  }

  // Sort and limit top risks
  topRisks.sort((a, b) => b.risk - a.risk);
  const topRisksLimited = topRisks.slice(0, 10);

  // Coach analysis
  const coachClients = new Map<string, any[]>();
  for (const client of clients) {
    const coach = client.assigned_coach || "Unassigned";
    if (!coachClients.has(coach)) coachClients.set(coach, []);
    coachClients.get(coach)!.push(client);
  }

  const coachAlerts: DailyReport["coachAlerts"] = [];
  coachClients.forEach((clientList, coach) => {
    if (coach === "Unassigned") return;
    const redCount = clientList.filter((c) => c.health_zone === "RED").length;
    const redPct = (redCount / clientList.length) * 100;

    if (redPct >= 20) {
      coachAlerts.push({
        coach,
        issue: `${Math.round(redPct)}% clients in RED zone`,
        clients: redCount,
      });
    }

    const decliningCount = clientList.filter(
      (c) => c.momentum_indicator === "DECLINING",
    ).length;
    const decliningPct = (decliningCount / clientList.length) * 100;
    if (decliningPct >= 50) {
      coachAlerts.push({
        coach,
        issue: `${Math.round(decliningPct)}% clients declining`,
        clients: decliningCount,
      });
    }
  });

  // Generate recommendations
  const recommendations: string[] = [];
  const totalClients = clients.length;
  const healthyRate =
    totalClients > 0 ? ((zones.GREEN + zones.PURPLE) / totalClients) * 100 : 0;

  if (zones.RED > 10) {
    recommendations.push(
      `URGENT: ${zones.RED} clients in RED zone need immediate attention`,
    );
  }
  if (newRed.length > 0) {
    recommendations.push(
      `${newRed.length} clients dropped to RED today - prioritize outreach`,
    );
  }
  if (healthyRate < 60) {
    recommendations.push(
      `Healthy rate at ${Math.round(healthyRate)}% - below 70% target`,
    );
  }
  if (coachAlerts.length > 0) {
    recommendations.push(
      `${coachAlerts.length} coach(es) need performance review`,
    );
  }
  if (totalAtRiskRevenue > 50000) {
    recommendations.push(
      `AED ${totalAtRiskRevenue.toLocaleString()} at-risk revenue requires protection`,
    );
  }

  return {
    date: today,
    summary: {
      totalClients,
      avgHealthScore:
        totalClients > 0 ? Math.round(totalScore / totalClients) : 0,
      zones,
      healthyRate: Math.round(healthyRate),
      atRiskRevenue: totalAtRiskRevenue,
    },
    changes: {
      newRed,
      improvedToGreen,
      criticalDrops,
    },
    topRisks: topRisksLimited,
    coachAlerts,
    recommendations,
  };
}

serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const {
      send_slack = false,
      send_email = false,
      webhook_url,
    } = await req.json().catch(() => ({}));

    // Security Prevent SSRF: Validate webhook_url
    if (send_slack && webhook_url) {
      if (!webhook_url.startsWith("https://hooks.slack.com/services/")) {
        throw new Error(
          "Invalid webhook URL. Only Slack webhooks are allowed.",
        );
      }
    }

    console.log("[Daily Report] Generating report...");

    const report = await generateReport();

    // Save to database
    await supabase.from("daily_summary").upsert(
      {
        summary_date: report.date,
        total_clients: report.summary.totalClients,
        avg_health_score: report.summary.avgHealthScore,
        red_count: report.summary.zones.RED,
        yellow_count: report.summary.zones.YELLOW,
        green_count: report.summary.zones.GREEN,
        purple_count: report.summary.zones.PURPLE,
        total_at_risk: report.topRisks.length,
        at_risk_revenue_aed: report.summary.atRiskRevenue,
        zone_changes_24h: report.changes,
        top_risks: report.topRisks,
        patterns_detected: report.coachAlerts,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "summary_date" },
    );

    // Send to Slack if configured
    if (send_slack && webhook_url) {
      const slackMessage = {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `PTD Daily Report - ${report.date}`,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Total Clients:* ${report.summary.totalClients}`,
              },
              {
                type: "mrkdwn",
                text: `*Avg Health:* ${report.summary.avgHealthScore}`,
              },
              {
                type: "mrkdwn",
                text: `*Healthy Rate:* ${report.summary.healthyRate}%`,
              },
              {
                type: "mrkdwn",
                text: `*At-Risk Revenue:* AED ${report.summary.atRiskRevenue.toLocaleString()}`,
              },
            ],
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Zone Distribution:*\n:purple_heart: PURPLE: ${report.summary.zones.PURPLE} | :green_circle: GREEN: ${report.summary.zones.GREEN} | :yellow_circle: YELLOW: ${report.summary.zones.YELLOW} | :red_circle: RED: ${report.summary.zones.RED}`,
            },
          },
        ],
      };

      if (report.recommendations.length > 0) {
        slackMessage.blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Recommendations:*\n${report.recommendations.map((r) => `• ${r}`).join("\n")}`,
          },
        });
      }

      try {
        const webhookResponse = await fetch(webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slackMessage),
        });

        if (!webhookResponse.ok) {
          console.error(
            "Slack webhook failed:",
            webhookResponse.status,
            await webhookResponse.text(),
          );
        } else {
          console.log("Slack notification sent successfully");
        }
      } catch (webhookError) {
        console.error("Error sending Slack notification:", webhookError);
        // Don't throw - report generation succeeded, just notification failed
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Daily Report] Complete in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: duration,
        report,
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error) {
    return handleError(error, "daily-report", {
      supabase,
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  }
});
