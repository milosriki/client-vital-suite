import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// DATA QUALITY AGENT
// Checks for missing, invalid, or inconsistent data
// Identifies data issues before they cause problems
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validate required environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[Data Quality] Missing required environment variables");
  throw new Error("Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface DataIssue {
  table: string;
  issue_type: "missing" | "invalid" | "inconsistent" | "duplicate" | "stale";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  affected_count: number;
  sample_records: string[];
  recommendation: string;
}

interface DataQualityReport {
  timestamp: string;
  overall_score: number;
  issues: DataIssue[];
  table_health: Record<string, number>;
  recommendations: string[];
}

async function checkClientHealthScores(): Promise<DataIssue[]> {
  const issues: DataIssue[] = [];

  // Check for missing emails
  const { data: missingEmails, count: missingEmailCount } = await supabase
    .from("client_health_scores")
    .select("id, firstname, lastname", { count: "exact" })
    .or("email.is.null,email.eq.")
    .limit(10);

  if ((missingEmailCount || 0) > 0) {
    issues.push({
      table: "client_health_scores",
      issue_type: "missing",
      severity: "critical",
      description: "Clients without email addresses",
      affected_count: missingEmailCount || 0,
      sample_records: (missingEmails || []).map(c => `${c.firstname} ${c.lastname}`),
      recommendation: "Email is required for CAPI and interventions. Update from HubSpot source."
    });
  }

  // Check for invalid health scores
  const { data: invalidScores, count: invalidScoreCount } = await supabase
    .from("client_health_scores")
    .select("email, health_score", { count: "exact" })
    .or("health_score.lt.0,health_score.gt.100")
    .limit(10);

  if ((invalidScoreCount || 0) > 0) {
    issues.push({
      table: "client_health_scores",
      issue_type: "invalid",
      severity: "high",
      description: "Health scores outside valid range (0-100)",
      affected_count: invalidScoreCount || 0,
      sample_records: (invalidScores || []).map(c => `${c.email}: ${c.health_score}`),
      recommendation: "Recalculate health scores using health-calculator agent."
    });
  }

  // Check for stale data (not updated in 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: staleCount } = await supabase
    .from("client_health_scores")
    .select("*", { count: "exact", head: true })
    .lt("calculated_at", weekAgo);

  if ((staleCount || 0) > 10) {
    issues.push({
      table: "client_health_scores",
      issue_type: "stale",
      severity: "medium",
      description: "Health scores not updated in 7+ days",
      affected_count: staleCount || 0,
      sample_records: [],
      recommendation: "Run health-calculator agent to refresh scores."
    });
  }

  // Check for zone inconsistencies
  const { data: inconsistentZones } = await supabase
    .from("client_health_scores")
    .select("email, health_score, health_zone")
    .or("and(health_score.gte.85,health_zone.neq.PURPLE),and(health_score.lt.50,health_zone.neq.RED)")
    .limit(10);

  if ((inconsistentZones || []).length > 0) {
    issues.push({
      table: "client_health_scores",
      issue_type: "inconsistent",
      severity: "high",
      description: "Health zone doesn't match health score",
      affected_count: inconsistentZones?.length || 0,
      sample_records: (inconsistentZones || []).map(c => `${c.email}: score=${c.health_score}, zone=${c.health_zone}`),
      recommendation: "Recalculate zones or fix zone assignment logic."
    });
  }

  // Check for missing coach assignments
  const { data: missingCoach, count: missingCoachCount } = await supabase
    .from("client_health_scores")
    .select("email, firstname", { count: "exact" })
    .or("assigned_coach.is.null,assigned_coach.eq.")
    .in("health_zone", ["RED", "YELLOW"])
    .limit(10);

  if ((missingCoachCount || 0) > 0) {
    issues.push({
      table: "client_health_scores",
      issue_type: "missing",
      severity: "high",
      description: "At-risk clients without assigned coach",
      affected_count: missingCoachCount || 0,
      sample_records: (missingCoach || []).map(c => c.email),
      recommendation: "Assign coaches to at-risk clients for intervention."
    });
  }

  return issues;
}

async function checkCAPIEvents(): Promise<DataIssue[]> {
  const issues: DataIssue[] = [];

  // Check for failed events
  const { count: failedCount } = await supabase
    .from("capi_events_enriched")
    .select("*", { count: "exact", head: true })
    .eq("send_status", "failed");

  if ((failedCount || 0) > 0) {
    issues.push({
      table: "capi_events_enriched",
      issue_type: "invalid",
      severity: "critical",
      description: "CAPI events failed to send",
      affected_count: failedCount || 0,
      sample_records: [],
      recommendation: "Review failed events, fix validation issues, retry."
    });
  }

  // Check for stuck pending events (older than 24h)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: stuckCount } = await supabase
    .from("capi_events_enriched")
    .select("*", { count: "exact", head: true })
    .eq("send_status", "pending")
    .lt("created_at", dayAgo);

  if ((stuckCount || 0) > 0) {
    issues.push({
      table: "capi_events_enriched",
      issue_type: "stale",
      severity: "high",
      description: "CAPI events pending for 24+ hours",
      affected_count: stuckCount || 0,
      sample_records: [],
      recommendation: "Run process-capi-batch to clear pending queue."
    });
  }

  // Check for missing required fields
  const { count: missingFields } = await supabase
    .from("capi_events_enriched")
    .select("*", { count: "exact", head: true })
    .eq("send_status", "pending")
    .or("email.is.null,event_name.is.null");

  if ((missingFields || 0) > 0) {
    issues.push({
      table: "capi_events_enriched",
      issue_type: "missing",
      severity: "high",
      description: "CAPI events missing email or event_name",
      affected_count: missingFields || 0,
      sample_records: [],
      recommendation: "Validate events with capi-validator before queuing."
    });
  }

  return issues;
}

async function checkInterventionLog(): Promise<DataIssue[]> {
  const issues: DataIssue[] = [];

  // Check for stale pending interventions
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: stalePending, count: staleCount } = await supabase
    .from("intervention_log")
    .select("client_email, priority, triggered_at", { count: "exact" })
    .eq("status", "PENDING")
    .lt("triggered_at", weekAgo)
    .limit(10);

  if ((staleCount || 0) > 0) {
    issues.push({
      table: "intervention_log",
      issue_type: "stale",
      severity: "high",
      description: "Interventions pending for 7+ days",
      affected_count: staleCount || 0,
      sample_records: (stalePending || []).map(i => `${i.client_email} (${i.priority})`),
      recommendation: "Review and action or close stale interventions."
    });
  }

  // Check for CRITICAL interventions not actioned
  const { count: criticalCount } = await supabase
    .from("intervention_log")
    .select("*", { count: "exact", head: true })
    .eq("priority", "CRITICAL")
    .eq("status", "PENDING");

  if ((criticalCount || 0) > 0) {
    issues.push({
      table: "intervention_log",
      issue_type: "invalid",
      severity: "critical",
      description: "CRITICAL interventions not actioned",
      affected_count: criticalCount || 0,
      sample_records: [],
      recommendation: "Immediately review and action CRITICAL interventions."
    });
  }

  return issues;
}

async function checkDuplicates(): Promise<DataIssue[]> {
  const issues: DataIssue[] = [];

  // This would need a raw SQL query for proper duplicate detection
  // For now, we do a simple check
  const { data: allClients } = await supabase
    .from("client_health_scores")
    .select("email")
    .limit(1000);

  if (allClients) {
    const emailCounts = new Map<string, number>();
    for (const client of allClients) {
      const email = client.email?.toLowerCase();
      if (email) {
        emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
      }
    }

    const duplicates = Array.from(emailCounts.entries())
      .filter(([_, count]) => count > 1);

    if (duplicates.length > 0) {
      issues.push({
        table: "client_health_scores",
        issue_type: "duplicate",
        severity: "medium",
        description: "Duplicate email addresses found",
        affected_count: duplicates.length,
        sample_records: duplicates.slice(0, 5).map(([email, count]) => `${email} (${count}x)`),
        recommendation: "Deduplicate client records, keep most recent."
      });
    }
  }

  return issues;
}

function calculateOverallScore(issues: DataIssue[]): number {
  let score = 100;

  for (const issue of issues) {
    const penalty = {
      critical: 20,
      high: 10,
      medium: 5,
      low: 2
    }[issue.severity];

    score -= penalty * Math.min(issue.affected_count / 10, 1);
  }

  return Math.max(0, Math.round(score));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { tables = ["all"] } = await req.json().catch(() => ({}));

    console.log("[Data Quality] Starting data quality check...");

    const allIssues: DataIssue[] = [];

    // Run checks based on requested tables
    const checkAll = tables.includes("all");

    // Run checks with individual error handling
    if (checkAll || tables.includes("client_health_scores")) {
      try {
        const healthIssues = await checkClientHealthScores();
        allIssues.push(...healthIssues);
      } catch (e) {
        console.error("[Data Quality] Error in checkClientHealthScores:", e);
        allIssues.push({
          table: "client_health_scores",
          issue_type: "invalid",
          severity: "high",
          description: "Failed to check table: " + (e instanceof Error ? e.message : "Unknown error"),
          affected_count: 0,
          sample_records: [],
          recommendation: "Check database connectivity and table existence"
        });
      }
    }

    if (checkAll || tables.includes("capi_events_enriched")) {
      try {
        const capiIssues = await checkCAPIEvents();
        allIssues.push(...capiIssues);
      } catch (e) {
        console.error("[Data Quality] Error in checkCAPIEvents:", e);
        allIssues.push({
          table: "capi_events_enriched",
          issue_type: "invalid",
          severity: "high",
          description: "Failed to check table: " + (e instanceof Error ? e.message : "Unknown error"),
          affected_count: 0,
          sample_records: [],
          recommendation: "Check database connectivity and table existence"
        });
      }
    }

    if (checkAll || tables.includes("intervention_log")) {
      try {
        const interventionIssues = await checkInterventionLog();
        allIssues.push(...interventionIssues);
      } catch (e) {
        console.error("[Data Quality] Error in checkInterventionLog:", e);
        allIssues.push({
          table: "intervention_log",
          issue_type: "invalid",
          severity: "high",
          description: "Failed to check table: " + (e instanceof Error ? e.message : "Unknown error"),
          affected_count: 0,
          sample_records: [],
          recommendation: "Check database connectivity and table existence"
        });
      }
    }

    if (checkAll) {
      try {
        const duplicateIssues = await checkDuplicates();
        allIssues.push(...duplicateIssues);
      } catch (e) {
        console.error("[Data Quality] Error in checkDuplicates:", e);
        allIssues.push({
          table: "client_health_scores",
          issue_type: "invalid",
          severity: "high",
          description: "Failed to check duplicates: " + (e instanceof Error ? e.message : "Unknown error"),
          affected_count: 0,
          sample_records: [],
          recommendation: "Check database connectivity and table existence"
        });
      }
    }

    // Calculate table health scores
    const tableHealth: Record<string, number> = {};
    const issuesByTable = new Map<string, DataIssue[]>();

    for (const issue of allIssues) {
      if (!issuesByTable.has(issue.table)) {
        issuesByTable.set(issue.table, []);
      }
      issuesByTable.get(issue.table)!.push(issue);
    }

    issuesByTable.forEach((issues, table) => {
      tableHealth[table] = calculateOverallScore(issues);
    });

    // Generate recommendations
    const recommendations: string[] = [];
    const criticalIssues = allIssues.filter(i => i.severity === "critical");
    const highIssues = allIssues.filter(i => i.severity === "high");

    if (criticalIssues.length > 0) {
      recommendations.push(`URGENT: ${criticalIssues.length} critical issues require immediate attention`);
    }
    if (highIssues.length > 0) {
      recommendations.push(`${highIssues.length} high-priority issues should be resolved today`);
    }

    const report: DataQualityReport = {
      timestamp: new Date().toISOString(),
      overall_score: calculateOverallScore(allIssues),
      issues: allIssues,
      table_health: tableHealth,
      recommendations
    };

    // Log the check
    await supabase.from("sync_logs").insert({
      platform: "data_quality",
      sync_type: "quality_check",
      status: report.overall_score >= 80 ? "success" : "completed_with_errors",
      records_processed: allIssues.length,
      records_failed: criticalIssues.length + highIssues.length,
      error_details: { issues_by_severity: { critical: criticalIssues.length, high: highIssues.length } },
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime
    });

    const duration = Date.now() - startTime;
    console.log(`[Data Quality] Complete in ${duration}ms - Score: ${report.overall_score}/100`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error("[Data Quality] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
