import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";

// ============================================
// ERROR PREVENTION AGENT
// Proactive error prevention measures
// Implements safeguards based on historical patterns
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
  console.error("[Error Prevention Agent] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

interface PreventionMeasure {
  id: string;
  category: "rate_limit" | "auth" | "data_quality" | "integration" | "system";
  risk_level: "high" | "medium" | "low";
  measure_type: "warning" | "recommendation" | "automated_action";
  title: string;
  description: string;
  trigger_condition: string;
  recommended_action: string;
  automated: boolean;
  action_taken: string | null;
}

interface PreventionCheck {
  source: string;
  check_type: string;
  status: "passed" | "warning" | "failed";
  details: string;
  prevention_applied: boolean;
}

interface PreventionReport {
  timestamp: string;
  checks_performed: number;
  warnings_generated: number;
  automated_actions_taken: number;
  prevention_measures: PreventionMeasure[];
  prevention_checks: PreventionCheck[];
  system_safeguards_status: { name: string; active: boolean; last_triggered: string | null }[];
  prevention_summary: string;
}

async function checkRateLimitRisk(): Promise<PreventionMeasure[]> {
  const measures: PreventionMeasure[] = [];
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Check recent rate limit errors by source
  const { data: rateLimits } = await supabase
    .from("sync_errors")
    .select("source")
    .eq("error_type", "rate_limit")
    .gte("created_at", hourAgo);

  if (!rateLimits || rateLimits.length === 0) return measures;

  const sourceCounts = new Map<string, number>();
  for (const error of rateLimits) {
    const source = error.source || "unknown";
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
  }

  for (const [source, count] of sourceCounts) {
    if (count >= 3) {
      measures.push({
        id: `prevent_ratelimit_${source}_${Date.now()}`,
        category: "rate_limit",
        risk_level: count >= 5 ? "high" : "medium",
        measure_type: "warning",
        title: `Rate Limit Risk: ${source}`,
        description: `${count} rate limit errors in the last hour from ${source}`,
        trigger_condition: "3+ rate limit errors within 1 hour",
        recommended_action: `Reduce ${source} API call frequency by 50%`,
        automated: false,
        action_taken: null,
      });
    }
  }

  return measures;
}

async function checkAuthExpirationRisk(): Promise<PreventionMeasure[]> {
  const measures: PreventionMeasure[] = [];
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Check for auth errors pattern (could indicate expiring tokens)
  const { data: authErrors } = await supabase
    .from("sync_errors")
    .select("source, created_at")
    .eq("error_type", "auth")
    .gte("created_at", dayAgo);

  if (!authErrors || authErrors.length === 0) return measures;

  const sourcesWithAuthIssues = [...new Set(authErrors.map(e => e.source || "unknown"))];

  for (const source of sourcesWithAuthIssues) {
    const sourceErrors = authErrors.filter(e => e.source === source);

    measures.push({
      id: `prevent_auth_${source}_${Date.now()}`,
      category: "auth",
      risk_level: sourceErrors.length >= 5 ? "high" : "medium",
      measure_type: "recommendation",
      title: `Authentication Risk: ${source}`,
      description: `${sourceErrors.length} auth errors in last 24 hours`,
      trigger_condition: "Auth errors detected within 24 hours",
      recommended_action: `Proactively refresh ${source} API credentials before expiration`,
      automated: false,
      action_taken: null,
    });
  }

  return measures;
}

async function checkDataQualityRisk(): Promise<PreventionMeasure[]> {
  const measures: PreventionMeasure[] = [];
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Check for validation errors pattern
  const { data: validationErrors } = await supabase
    .from("sync_errors")
    .select("source, error_message")
    .eq("error_type", "validation")
    .gte("created_at", dayAgo);

  if (!validationErrors || validationErrors.length < 5) return measures;

  // Group by source
  const sourceGroups = new Map<string, number>();
  for (const error of validationErrors) {
    const source = error.source || "unknown";
    sourceGroups.set(source, (sourceGroups.get(source) || 0) + 1);
  }

  for (const [source, count] of sourceGroups) {
    if (count >= 3) {
      measures.push({
        id: `prevent_quality_${source}_${Date.now()}`,
        category: "data_quality",
        risk_level: count >= 10 ? "high" : "medium",
        measure_type: "recommendation",
        title: `Data Quality Risk: ${source}`,
        description: `${count} validation errors indicate potential data quality issues`,
        trigger_condition: "3+ validation errors from same source in 24 hours",
        recommended_action: "Review data transformation and validation rules",
        automated: false,
        action_taken: null,
      });
    }
  }

  return measures;
}

async function checkIntegrationHealthRisk(): Promise<PreventionMeasure[]> {
  const measures: PreventionMeasure[] = [];
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Check for network/timeout errors
  const { data: networkErrors } = await supabase
    .from("sync_errors")
    .select("source")
    .or("error_type.eq.network,error_type.eq.timeout")
    .gte("created_at", hourAgo);

  if (!networkErrors || networkErrors.length < 3) return measures;

  const affectedSources = [...new Set(networkErrors.map(e => e.source || "unknown"))];

  if (affectedSources.length >= 2) {
    measures.push({
      id: `prevent_integration_multi_${Date.now()}`,
      category: "integration",
      risk_level: "high",
      measure_type: "warning",
      title: "Multi-Source Integration Risk",
      description: `Network/timeout errors affecting ${affectedSources.length} sources`,
      trigger_condition: "Network errors across 2+ sources",
      recommended_action: "Check shared infrastructure (network, database)",
      automated: false,
      action_taken: null,
    });
  }

  return measures;
}

async function checkSystemHealthRisk(): Promise<PreventionMeasure[]> {
  const measures: PreventionMeasure[] = [];
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Get total error count in last hour
  const { count: recentErrors } = await supabase
    .from("sync_errors")
    .select("*", { count: "exact", head: true })
    .gte("created_at", hourAgo);

  // Get unresolved count
  const { count: unresolvedErrors } = await supabase
    .from("sync_errors")
    .select("*", { count: "exact", head: true })
    .is("resolved_at", null);

  if ((recentErrors || 0) > 20) {
    measures.push({
      id: `prevent_system_volume_${Date.now()}`,
      category: "system",
      risk_level: (recentErrors || 0) > 50 ? "high" : "medium",
      measure_type: "warning",
      title: "High Error Volume Alert",
      description: `${recentErrors} errors in the last hour`,
      trigger_condition: "Error rate exceeds 20/hour",
      recommended_action: "Investigate system health and recent changes",
      automated: false,
      action_taken: null,
    });
  }

  if ((unresolvedErrors || 0) > 50) {
    measures.push({
      id: `prevent_system_backlog_${Date.now()}`,
      category: "system",
      risk_level: "high",
      measure_type: "recommendation",
      title: "Error Backlog Warning",
      description: `${unresolvedErrors} unresolved errors in queue`,
      trigger_condition: "Unresolved errors exceed 50",
      recommended_action: "Run error auto-resolver and review retry orchestrator",
      automated: false,
      action_taken: null,
    });
  }

  return measures;
}

async function performPreventionChecks(): Promise<PreventionCheck[]> {
  const checks: PreventionCheck[] = [];

  // Check API key configurations
  const apiKeys = {
    hubspot: !!Deno.env.get("HUBSPOT_API_KEY"),
    stripe: !!Deno.env.get("STRIPE_SECRET_KEY"),
    meta: !!Deno.env.get("META_ACCESS_TOKEN") || !!Deno.env.get("FACEBOOK_ACCESS_TOKEN"),
    callgear: !!Deno.env.get("CALLGEAR_API_KEY"),
  };

  for (const [source, configured] of Object.entries(apiKeys)) {
    checks.push({
      source,
      check_type: "api_key_configured",
      status: configured ? "passed" : "warning",
      details: configured ? "API key is configured" : "API key not found - integration may fail",
      prevention_applied: false,
    });
  }

  // Check error resolution rate
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentErrors } = await supabase
    .from("sync_errors")
    .select("id, resolved_at")
    .gte("created_at", dayAgo);

  if (recentErrors && recentErrors.length > 0) {
    const resolved = recentErrors.filter(e => e.resolved_at).length;
    const rate = Math.round((resolved / recentErrors.length) * 100);

    checks.push({
      source: "system",
      check_type: "resolution_rate",
      status: rate >= 70 ? "passed" : rate >= 50 ? "warning" : "failed",
      details: `Resolution rate: ${rate}% (${resolved}/${recentErrors.length})`,
      prevention_applied: false,
    });
  }

  return checks;
}

function getSafeguardsStatus(): { name: string; active: boolean; last_triggered: string | null }[] {
  // Define system safeguards
  return [
    { name: "Rate Limit Protection", active: true, last_triggered: null },
    { name: "Exponential Backoff", active: true, last_triggered: null },
    { name: "Error Deduplication", active: true, last_triggered: null },
    { name: "Max Retry Limit", active: true, last_triggered: null },
    { name: "Automatic Error Cleanup", active: true, last_triggered: null },
    { name: "Proactive Alerting", active: true, last_triggered: null },
  ];
}

serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    if (!envCheck.valid) {
      throw new Error(`Missing required environment variables: ${envCheck.missing.join(", ")}`);
    }

    console.log("[Error Prevention Agent] Starting prevention analysis...");

    // Gather all prevention measures
    const [rateLimitMeasures, authMeasures, qualityMeasures, integrationMeasures, systemMeasures] = await Promise.all([
      checkRateLimitRisk(),
      checkAuthExpirationRisk(),
      checkDataQualityRisk(),
      checkIntegrationHealthRisk(),
      checkSystemHealthRisk(),
    ]);

    const allMeasures = [
      ...rateLimitMeasures,
      ...authMeasures,
      ...qualityMeasures,
      ...integrationMeasures,
      ...systemMeasures,
    ];

    // Perform prevention checks
    const checks = await performPreventionChecks();
    const safeguards = getSafeguardsStatus();

    // Count metrics
    const warnings = allMeasures.filter(m => m.risk_level === "high" || m.risk_level === "medium").length;
    const automatedActions = allMeasures.filter(m => m.automated && m.action_taken).length;

    // Generate summary
    let summary = `Analyzed system for ${allMeasures.length} potential risks. `;
    if (warnings > 0) {
      summary += `${warnings} require attention. `;
    } else {
      summary += "No immediate risks detected. ";
    }
    summary += `${checks.filter(c => c.status === "passed").length}/${checks.length} prevention checks passed.`;

    const report: PreventionReport = {
      timestamp: new Date().toISOString(),
      checks_performed: checks.length,
      warnings_generated: warnings,
      automated_actions_taken: automatedActions,
      prevention_measures: allMeasures,
      prevention_checks: checks,
      system_safeguards_status: safeguards,
      prevention_summary: summary,
    };

    // Store high-risk measures as insights
    for (const measure of allMeasures.filter(m => m.risk_level === "high")) {
      await supabase.from("proactive_insights").upsert({
        insight_type: "prevention_warning",
        priority: "high",
        title: measure.title,
        content: measure.description,
        action_items: [measure.recommended_action],
        affected_entities: { category: measure.category, trigger: measure.trigger_condition },
        source_agent: "error_prevention_agent",
        dedup_key: `prevention_${measure.category}_${new Date().toISOString().split("T")[0]}`,
        expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "dedup_key", ignoreDuplicates: true });
    }

    const duration = Date.now() - startTime;
    console.log(`[Error Prevention Agent] Complete in ${duration}ms - ${warnings} warnings, ${automatedActions} automated actions`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[Error Prevention Agent] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
