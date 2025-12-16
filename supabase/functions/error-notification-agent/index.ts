import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// ERROR NOTIFICATION AGENT
// Sends alerts for critical errors
// Manages notification thresholds and channels
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function validateEnv(): { valid: boolean; missing: string[] } {
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter(key => !Deno.env.get(key));
  return { valid: missing.length === 0, missing };
}

const envCheck = validateEnv();
if (!envCheck.valid) {
  console.error("[Error Notification Agent] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

interface NotificationThreshold {
  source: string;
  error_type: string;
  threshold_count: number;
  time_window_minutes: number;
  severity: "critical" | "high" | "medium" | "low";
}

const notificationThresholds: NotificationThreshold[] = [
  { source: "stripe", error_type: "*", threshold_count: 1, time_window_minutes: 60, severity: "critical" },
  { source: "hubspot", error_type: "auth", threshold_count: 1, time_window_minutes: 30, severity: "critical" },
  { source: "meta", error_type: "auth", threshold_count: 1, time_window_minutes: 30, severity: "critical" },
  { source: "*", error_type: "auth", threshold_count: 3, time_window_minutes: 30, severity: "high" },
  { source: "*", error_type: "rate_limit", threshold_count: 5, time_window_minutes: 60, severity: "medium" },
  { source: "*", error_type: "*", threshold_count: 10, time_window_minutes: 60, severity: "high" },
  { source: "*", error_type: "*", threshold_count: 50, time_window_minutes: 1440, severity: "critical" }, // 50 errors in 24h
];

interface NotificationAlert {
  alert_id: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  error_count: number;
  time_window: string;
  affected_sources: string[];
  affected_types: string[];
  sample_error_ids: string[];
  recommended_actions: string[];
  notification_channels: string[];
  notified: boolean;
}

interface NotificationReport {
  timestamp: string;
  errors_analyzed: number;
  thresholds_checked: number;
  alerts_generated: number;
  critical_alerts: number;
  alerts: NotificationAlert[];
  notification_summary: string;
}

async function checkThreshold(threshold: NotificationThreshold): Promise<NotificationAlert | null> {
  const windowStart = new Date(Date.now() - threshold.time_window_minutes * 60 * 1000).toISOString();

  // Build query based on threshold
  let query = supabase
    .from("sync_errors")
    .select("id, source, error_type, error_message")
    .gte("created_at", windowStart);

  if (threshold.source !== "*") {
    query = query.eq("source", threshold.source);
  }

  if (threshold.error_type !== "*") {
    query = query.eq("error_type", threshold.error_type);
  }

  const { data: errors, error } = await query;

  if (error || !errors) {
    return null;
  }

  if (errors.length >= threshold.threshold_count) {
    const sources = [...new Set(errors.map(e => e.source || "unknown"))];
    const types = [...new Set(errors.map(e => e.error_type || "unknown"))];

    // Generate alert
    const alertId = `alert_${threshold.source}_${threshold.error_type}_${Date.now()}`;

    return {
      alert_id: alertId,
      severity: threshold.severity,
      title: generateAlertTitle(threshold, errors.length),
      description: generateAlertDescription(threshold, errors.length, sources, types),
      error_count: errors.length,
      time_window: `${threshold.time_window_minutes} minutes`,
      affected_sources: sources,
      affected_types: types,
      sample_error_ids: errors.slice(0, 5).map(e => e.id),
      recommended_actions: generateRecommendedActions(threshold, sources, types),
      notification_channels: determineChannels(threshold.severity),
      notified: false,
    };
  }

  return null;
}

function generateAlertTitle(threshold: NotificationThreshold, count: number): string {
  const sourceText = threshold.source === "*" ? "Multiple sources" : threshold.source;
  const typeText = threshold.error_type === "*" ? "errors" : `${threshold.error_type} errors`;

  return `${threshold.severity.toUpperCase()}: ${count} ${typeText} from ${sourceText}`;
}

function generateAlertDescription(
  threshold: NotificationThreshold,
  count: number,
  sources: string[],
  types: string[]
): string {
  return `${count} errors detected in the last ${threshold.time_window_minutes} minutes. ` +
    `Sources: ${sources.join(", ")}. Types: ${types.join(", ")}.`;
}

function generateRecommendedActions(
  threshold: NotificationThreshold,
  sources: string[],
  types: string[]
): string[] {
  const actions: string[] = [];

  if (types.includes("auth")) {
    actions.push("Check API credentials and tokens");
    actions.push("Verify OAuth configurations");
  }

  if (types.includes("rate_limit")) {
    actions.push("Review API usage patterns");
    actions.push("Implement request throttling");
  }

  if (sources.includes("stripe")) {
    actions.push("URGENT: Review Stripe dashboard for issues");
    actions.push("Check payment processing status");
  }

  if (threshold.severity === "critical") {
    actions.push("Investigate immediately");
    actions.push("Consider pausing affected operations");
  }

  if (actions.length === 0) {
    actions.push("Review error logs");
    actions.push("Check integration health");
  }

  return actions;
}

function determineChannels(severity: string): string[] {
  switch (severity) {
    case "critical":
      return ["proactive_insights", "dashboard", "email", "slack"];
    case "high":
      return ["proactive_insights", "dashboard", "email"];
    case "medium":
      return ["proactive_insights", "dashboard"];
    default:
      return ["dashboard"];
  }
}

async function storeNotification(alert: NotificationAlert): Promise<void> {
  // Store in proactive_insights
  if (alert.notification_channels.includes("proactive_insights")) {
    await supabase.from("proactive_insights").upsert({
      insight_type: "error_alert",
      priority: alert.severity,
      title: alert.title,
      content: alert.description,
      action_items: alert.recommended_actions,
      affected_entities: {
        sources: alert.affected_sources,
        types: alert.affected_types,
        sample_errors: alert.sample_error_ids,
      },
      source_agent: "error_notification_agent",
      dedup_key: `notification_${alert.alert_id}`,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "dedup_key", ignoreDuplicates: true });
  }

  // Log the notification
  await supabase.from("sync_logs").insert({
    platform: "error_notification_agent",
    sync_type: "notification",
    status: "success",
    records_processed: 1,
    error_details: {
      alert_id: alert.alert_id,
      severity: alert.severity,
      channels: alert.notification_channels,
    },
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: 0,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    if (!envCheck.valid) {
      throw new Error(`Missing required environment variables: ${envCheck.missing.join(", ")}`);
    }

    console.log("[Error Notification Agent] Checking notification thresholds...");

    // Count total recent errors for context
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentErrorCount } = await supabase
      .from("sync_errors")
      .select("*", { count: "exact", head: true })
      .gte("created_at", hourAgo);

    const alerts: NotificationAlert[] = [];
    const checkedThresholds: string[] = [];

    // Check each threshold
    for (const threshold of notificationThresholds) {
      const thresholdKey = `${threshold.source}_${threshold.error_type}_${threshold.threshold_count}`;
      checkedThresholds.push(thresholdKey);

      const alert = await checkThreshold(threshold);
      if (alert) {
        // Check for duplicate alerts (same severity+sources within last hour)
        const isDuplicate = alerts.some(
          a =>
            a.severity === alert.severity &&
            a.affected_sources.sort().join(",") === alert.affected_sources.sort().join(",")
        );

        if (!isDuplicate) {
          alerts.push(alert);
          await storeNotification(alert);
          alert.notified = true;
        }
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const criticalCount = alerts.filter(a => a.severity === "critical").length;

    // Generate summary
    let summary = `Checked ${notificationThresholds.length} thresholds against ${recentErrorCount || 0} recent errors. `;
    if (alerts.length === 0) {
      summary += "No thresholds exceeded.";
    } else {
      summary += `Generated ${alerts.length} alerts (${criticalCount} critical).`;
    }

    const report: NotificationReport = {
      timestamp: new Date().toISOString(),
      errors_analyzed: recentErrorCount || 0,
      thresholds_checked: notificationThresholds.length,
      alerts_generated: alerts.length,
      critical_alerts: criticalCount,
      alerts,
      notification_summary: summary,
    };

    const duration = Date.now() - startTime;
    console.log(`[Error Notification Agent] Complete in ${duration}ms - Alerts: ${alerts.length} (${criticalCount} critical)`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[Error Notification Agent] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
