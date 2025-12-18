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

  try {
    // Check for duplicate emails in client_health_scores using RPC or direct query
    const { data: duplicateClients, error: dupError } = await supabase.rpc('get_duplicate_emails', {
      table_name: 'client_health_scores'
    }).catch(async () => {
      // Fallback: Use aggregation query
      const { data } = await supabase
        .from("client_health_scores")
        .select("email");

      if (!data) return { data: null, error: null };

      const emailCounts = new Map<string, number>();
      for (const client of data) {
        const email = client.email?.toLowerCase();
        if (email) {
          emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
        }
      }

      const duplicates = Array.from(emailCounts.entries())
        .filter(([_, count]) => count > 1)
        .map(([email, count]) => ({ email, count }));

      return { data: duplicates, error: null };
    });

    if (duplicateClients && duplicateClients.length > 0) {
      issues.push({
        table: "client_health_scores",
        issue_type: "duplicate",
        severity: "high",
        description: "Duplicate email addresses found",
        affected_count: duplicateClients.length,
        sample_records: duplicateClients.slice(0, 10).map((d: any) => `${d.email} (${d.count}x)`),
        recommendation: "Deduplicate client records, keep most recent by calculated_at."
      });
    }

    // Check for duplicate contact emails
    const { data: contactDuplicates } = await supabase
      .from("contacts")
      .select("email");

    if (contactDuplicates) {
      const emailCounts = new Map<string, number>();
      for (const contact of contactDuplicates) {
        const email = contact.email?.toLowerCase();
        if (email) {
          emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
        }
      }

      const duplicates = Array.from(emailCounts.entries())
        .filter(([_, count]) => count > 1);

      if (duplicates.length > 0) {
        issues.push({
          table: "contacts",
          issue_type: "duplicate",
          severity: "medium",
          description: "Duplicate contact emails found",
          affected_count: duplicates.length,
          sample_records: duplicates.slice(0, 10).map(([email, count]) => `${email} (${count}x)`),
          recommendation: "Deduplicate contacts, merge or remove duplicates."
        });
      }
    }
  } catch (error) {
    console.error("[Data Quality] Error checking duplicates:", error);
  }

  return issues;
}

async function checkOrphanedRecords(): Promise<DataIssue[]> {
  const issues: DataIssue[] = [];

  try {
    // Check for intervention_log entries with no matching client
    const { data: orphanedInterventions } = await supabase
      .from("intervention_log")
      .select("id, client_email")
      .limit(1000);

    if (orphanedInterventions) {
      const clientEmails = new Set(
        (await supabase.from("client_health_scores").select("email")).data?.map(c => c.email.toLowerCase()) || []
      );

      const orphaned = orphanedInterventions.filter(
        i => i.client_email && !clientEmails.has(i.client_email.toLowerCase())
      );

      if (orphaned.length > 0) {
        issues.push({
          table: "intervention_log",
          issue_type: "inconsistent",
          severity: "medium",
          description: "Interventions for non-existent clients",
          affected_count: orphaned.length,
          sample_records: orphaned.slice(0, 10).map(i => i.client_email),
          recommendation: "Remove orphaned intervention records or sync missing clients from HubSpot."
        });
      }
    }

    // Check for CAPI events with invalid or missing client data
    const { count: orphanedCAPI } = await supabase
      .from("capi_events_enriched")
      .select("*", { count: "exact", head: true })
      .not("email", "is", null)
      .eq("send_status", "pending")
      .limit(100);

    if (orphanedCAPI && orphanedCAPI > 0) {
      // Sample some to check if clients exist
      const { data: sampleCAPI } = await supabase
        .from("capi_events_enriched")
        .select("email")
        .eq("send_status", "pending")
        .limit(50);

      if (sampleCAPI) {
        const clientEmails = new Set(
          (await supabase.from("client_health_scores").select("email")).data?.map(c => c.email.toLowerCase()) || []
        );

        const orphanedSample = sampleCAPI.filter(
          e => e.email && !clientEmails.has(e.email.toLowerCase())
        );

        if (orphanedSample.length > 0) {
          issues.push({
            table: "capi_events_enriched",
            issue_type: "inconsistent",
            severity: "low",
            description: "CAPI events for contacts not in health scores",
            affected_count: orphanedSample.length,
            sample_records: orphanedSample.slice(0, 5).map(e => e.email),
            recommendation: "This is normal for new contacts. Ensure health calculator runs regularly."
          });
        }
      }
    }
  } catch (error) {
    console.error("[Data Quality] Error checking orphaned records:", error);
  }

  return issues;
}

async function checkRequiredFields(): Promise<DataIssue[]> {
  const issues: DataIssue[] = [];

  try {
    // Check contacts for required fields
    const { count: contactsMissingName } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .or("firstname.is.null,lastname.is.null");

    if (contactsMissingName && contactsMissingName > 0) {
      issues.push({
        table: "contacts",
        issue_type: "missing",
        severity: "medium",
        description: "Contacts missing first or last name",
        affected_count: contactsMissingName,
        sample_records: [],
        recommendation: "Update contact names from HubSpot or mark for review."
      });
    }

    // Check for contacts without HubSpot IDs
    const { count: contactsMissingHubSpot } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .or("hubspot_contact_id.is.null,hubspot_contact_id.eq.");

    if (contactsMissingHubSpot && contactsMissingHubSpot > 0) {
      issues.push({
        table: "contacts",
        issue_type: "missing",
        severity: "high",
        description: "Contacts without HubSpot ID",
        affected_count: contactsMissingHubSpot,
        sample_records: [],
        recommendation: "Sync from HubSpot or link to existing HubSpot contacts."
      });
    }

    // Check deals for required fields
    const { count: dealsMissingAmount } = await supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .or("amount.is.null,amount.eq.0");

    if (dealsMissingAmount && dealsMissingAmount > 0) {
      issues.push({
        table: "deals",
        issue_type: "missing",
        severity: "low",
        description: "Deals with no amount set",
        affected_count: dealsMissingAmount,
        sample_records: [],
        recommendation: "Review deals and set appropriate amounts in HubSpot."
      });
    }

    // Check leads for required fields
    const { count: leadsMissingEmail } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .or("email.is.null,email.eq.");

    if (leadsMissingEmail && leadsMissingEmail > 0) {
      issues.push({
        table: "leads",
        issue_type: "missing",
        severity: "critical",
        description: "Leads without email addresses",
        affected_count: leadsMissingEmail,
        sample_records: [],
        recommendation: "Email is required for lead processing. Update or remove invalid leads."
      });
    }
  } catch (error) {
    console.error("[Data Quality] Error checking required fields:", error);
  }

  return issues;
}

async function checkDataConsistency(): Promise<DataIssue[]> {
  const issues: DataIssue[] = [];

  try {
    // Check for contacts in client_health_scores but not in contacts table
    const { data: healthClients } = await supabase
      .from("client_health_scores")
      .select("email")
      .limit(1000);

    const { data: contacts } = await supabase
      .from("contacts")
      .select("email")
      .limit(5000);

    if (healthClients && contacts) {
      const contactEmails = new Set(contacts.map(c => c.email?.toLowerCase()));
      const missingInContacts = healthClients.filter(
        h => h.email && !contactEmails.has(h.email.toLowerCase())
      );

      if (missingInContacts.length > 0) {
        issues.push({
          table: "client_health_scores",
          issue_type: "inconsistent",
          severity: "medium",
          description: "Health scores for contacts not in contacts table",
          affected_count: missingInContacts.length,
          sample_records: missingInContacts.slice(0, 10).map(c => c.email),
          recommendation: "Sync contacts from HubSpot or remove orphaned health scores."
        });
      }
    }

    // Check for invalid enum values
    const { data: invalidZones } = await supabase
      .from("client_health_scores")
      .select("email, health_zone")
      .not("health_zone", "in", "(RED,YELLOW,GREEN,PURPLE)");

    if (invalidZones && invalidZones.length > 0) {
      issues.push({
        table: "client_health_scores",
        issue_type: "invalid",
        severity: "high",
        description: "Invalid health zone values",
        affected_count: invalidZones.length,
        sample_records: invalidZones.slice(0, 10).map(c => `${c.email}: ${c.health_zone}`),
        recommendation: "Recalculate health zones to valid values (RED, YELLOW, GREEN, PURPLE)."
      });
    }
  } catch (error) {
    console.error("[Data Quality] Error checking consistency:", error);
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

      try {
        const orphanedIssues = await checkOrphanedRecords();
        allIssues.push(...orphanedIssues);
      } catch (e) {
        console.error("[Data Quality] Error in checkOrphanedRecords:", e);
      }

      try {
        const requiredFieldIssues = await checkRequiredFields();
        allIssues.push(...requiredFieldIssues);
      } catch (e) {
        console.error("[Data Quality] Error in checkRequiredFields:", e);
      }

      try {
        const consistencyIssues = await checkDataConsistency();
        allIssues.push(...consistencyIssues);
      } catch (e) {
        console.error("[Data Quality] Error in checkDataConsistency:", e);
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
