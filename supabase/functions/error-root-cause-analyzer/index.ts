import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";

// ============================================
// ERROR ROOT CAUSE ANALYZER AGENT
// AI-powered root cause analysis for complex errors
// Provides actionable insights for resolution
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
  console.error("[Error Root Cause Analyzer] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

interface RootCauseAnalysis {
  error_id: string;
  analysis_confidence: number;
  primary_cause: string;
  contributing_factors: string[];
  evidence: string[];
  affected_systems: string[];
  resolution_steps: string[];
  prevention_measures: string[];
  estimated_effort: "minimal" | "moderate" | "significant" | "major";
  requires_external_action: boolean;
  external_action_details: string | null;
}

interface AnalysisReport {
  timestamp: string;
  errors_analyzed: number;
  high_confidence_analyses: number;
  analyses: RootCauseAnalysis[];
  common_root_causes: { cause: string; count: number }[];
  system_health_assessment: string;
}

// Known error patterns and their root causes
const errorPatterns: { pattern: RegExp; cause: string; resolution: string[]; prevention: string[] }[] = [
  {
    pattern: /rate.?limit|429|too many requests/i,
    cause: "API rate limiting exceeded",
    resolution: ["Implement exponential backoff", "Reduce request frequency", "Request rate limit increase"],
    prevention: ["Add request queuing", "Monitor API usage", "Set up usage alerts"],
  },
  {
    pattern: /unauthorized|401|invalid.*token|expired.*token/i,
    cause: "Authentication failure or expired credentials",
    resolution: ["Refresh API tokens", "Verify credentials", "Check OAuth flow"],
    prevention: ["Implement token refresh automation", "Set up credential expiration alerts", "Use longer-lived tokens"],
  },
  {
    pattern: /forbidden|403|permission|access denied/i,
    cause: "Insufficient permissions or access revoked",
    resolution: ["Review API permissions", "Check scope configuration", "Verify user access"],
    prevention: ["Document required permissions", "Set up permission monitoring", "Regular access audits"],
  },
  {
    pattern: /timeout|ETIMEDOUT|connection.*time|request.*time/i,
    cause: "Network timeout or slow response",
    resolution: ["Increase timeout values", "Check network connectivity", "Verify endpoint availability"],
    prevention: ["Add retry logic", "Monitor response times", "Set up availability alerts"],
  },
  {
    pattern: /connection.*refused|ECONNREFUSED|network.*error/i,
    cause: "Network connectivity issue or service down",
    resolution: ["Check service status", "Verify network configuration", "Check firewall rules"],
    prevention: ["Monitor service availability", "Implement circuit breaker", "Set up failover"],
  },
  {
    pattern: /invalid.*json|parse.*error|unexpected.*token/i,
    cause: "Malformed response or data format mismatch",
    resolution: ["Validate response format", "Check API version", "Review data transformation"],
    prevention: ["Add response validation", "Version API integrations", "Implement schema validation"],
  },
  {
    pattern: /field.*mapping|missing.*field|required.*field/i,
    cause: "Data schema mismatch or missing required data",
    resolution: ["Update field mappings", "Add missing data sources", "Fix data transformation"],
    prevention: ["Document schema requirements", "Add validation layer", "Monitor schema changes"],
  },
  {
    pattern: /duplicate|unique.*constraint|already.*exists/i,
    cause: "Duplicate data or constraint violation",
    resolution: ["Remove duplicates", "Update conflict resolution", "Review upsert logic"],
    prevention: ["Implement deduplication", "Use proper upsert strategies", "Add unique constraints"],
  },
  {
    pattern: /quota|limit.*exceeded|resource.*exhausted/i,
    cause: "Resource quota or limit exceeded",
    resolution: ["Request quota increase", "Optimize resource usage", "Implement caching"],
    prevention: ["Monitor quota usage", "Set usage alerts", "Implement usage optimization"],
  },
  {
    pattern: /ssl|tls|certificate|https/i,
    cause: "SSL/TLS certificate or security issue",
    resolution: ["Update SSL certificates", "Check certificate chain", "Verify TLS configuration"],
    prevention: ["Monitor certificate expiration", "Use auto-renewal", "Regular security audits"],
  },
];

function analyzeError(error: Record<string, unknown>): RootCauseAnalysis {
  const errorMessage = String(error.error_message || "").toLowerCase();
  const errorType = String(error.error_type || "").toLowerCase();
  const source = String(error.source || error.platform || "unknown");
  const retryCount = Number(error.retry_count || 0);

  let primaryCause = "Unknown root cause";
  let resolutionSteps: string[] = [];
  let preventionMeasures: string[] = [];
  let confidence = 50;

  // Match against known patterns
  for (const patternDef of errorPatterns) {
    if (patternDef.pattern.test(errorMessage) || patternDef.pattern.test(errorType)) {
      primaryCause = patternDef.cause;
      resolutionSteps = [...patternDef.resolution];
      preventionMeasures = [...patternDef.prevention];
      confidence = 80;
      break;
    }
  }

  // Build evidence
  const evidence: string[] = [];
  evidence.push(`Error type: ${errorType || "not specified"}`);
  evidence.push(`Source system: ${source}`);
  evidence.push(`Retry attempts: ${retryCount}`);
  if (error.error_message) {
    evidence.push(`Message excerpt: "${String(error.error_message).substring(0, 100)}..."`);
  }

  // Contributing factors based on context
  const contributingFactors: string[] = [];
  if (retryCount > 0) {
    contributingFactors.push("Multiple retry attempts indicate persistent issue");
  }
  if (errorType === "rate_limit") {
    contributingFactors.push("High request volume or aggressive polling");
  }
  if (errorType === "auth") {
    contributingFactors.push("Possible credential rotation or expiration");
  }
  if (source === "hubspot" || source === "stripe") {
    contributingFactors.push("External API dependency");
  }

  // Determine effort and external action needs
  let estimatedEffort: RootCauseAnalysis["estimated_effort"] = "moderate";
  let requiresExternalAction = false;
  let externalActionDetails: string | null = null;

  if (primaryCause.includes("rate limit")) {
    estimatedEffort = "minimal";
    requiresExternalAction = true;
    externalActionDetails = `Contact ${source} support to request rate limit increase`;
  } else if (primaryCause.includes("permission") || primaryCause.includes("credentials")) {
    estimatedEffort = "minimal";
    requiresExternalAction = true;
    externalActionDetails = `Review and update ${source} API permissions`;
  } else if (primaryCause.includes("schema") || primaryCause.includes("mapping")) {
    estimatedEffort = "significant";
  } else if (primaryCause.includes("network") || primaryCause.includes("timeout")) {
    estimatedEffort = "minimal";
  }

  // Add source-specific resolution steps
  resolutionSteps.push(`Check ${source} API status and documentation`);
  resolutionSteps.push(`Review recent changes to ${source} integration`);

  return {
    error_id: error.id as string,
    analysis_confidence: confidence,
    primary_cause: primaryCause,
    contributing_factors: contributingFactors,
    evidence,
    affected_systems: [source],
    resolution_steps: resolutionSteps,
    prevention_measures: preventionMeasures,
    estimated_effort: estimatedEffort,
    requires_external_action: requiresExternalAction,
    external_action_details: externalActionDetails,
  };
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

    console.log("[Error Root Cause Analyzer] Starting root cause analysis...");

    // Fetch unresolved errors
    const { data: errors, error: fetchError } = await supabase
      .from("sync_errors")
      .select("*")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch errors: ${fetchError.message}`);
    }

    const errorList = errors || [];
    const analyses: RootCauseAnalysis[] = [];

    for (const error of errorList) {
      const analysis = analyzeError(error);
      analyses.push(analysis);

      // Update error with analysis
      await supabase
        .from("sync_errors")
        .update({
          error_details: {
            ...error.error_details,
            root_cause_analysis: {
              primary_cause: analysis.primary_cause,
              confidence: analysis.analysis_confidence,
              resolution_steps: analysis.resolution_steps,
              analyzed_at: new Date().toISOString(),
            },
          },
        })
        .eq("id", error.id);
    }

    // Count common root causes
    const causeCounts = new Map<string, number>();
    for (const analysis of analyses) {
      causeCounts.set(analysis.primary_cause, (causeCounts.get(analysis.primary_cause) || 0) + 1);
    }
    const commonRootCauses = Array.from(causeCounts.entries())
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Assess system health
    const highConfidenceCount = analyses.filter(a => a.analysis_confidence >= 70).length;
    const criticalIssues = analyses.filter(a => a.estimated_effort === "major" || a.requires_external_action).length;

    let healthAssessment = "System appears healthy with minor issues";
    if (analyses.length === 0) {
      healthAssessment = "No unresolved errors - system is healthy";
    } else if (criticalIssues > 5) {
      healthAssessment = "Multiple critical issues require immediate attention";
    } else if (analyses.length > 20) {
      healthAssessment = "High error volume indicates systemic issues";
    } else if (analyses.length > 10) {
      healthAssessment = "Moderate error volume - investigation recommended";
    }

    const report: AnalysisReport = {
      timestamp: new Date().toISOString(),
      errors_analyzed: analyses.length,
      high_confidence_analyses: highConfidenceCount,
      analyses,
      common_root_causes: commonRootCauses,
      system_health_assessment: healthAssessment,
    };

    // Store critical analyses as insights
    const criticalAnalyses = analyses.filter(a => a.analysis_confidence >= 75 || a.requires_external_action);
    for (const analysis of criticalAnalyses.slice(0, 10)) {
      await supabase.from("proactive_insights").upsert({
        insight_type: "root_cause_analysis",
        priority: analysis.requires_external_action ? "critical" : "high",
        title: `Root Cause: ${analysis.primary_cause}`,
        content: `Analysis confidence: ${analysis.analysis_confidence}%. ${analysis.contributing_factors.join(". ")}`,
        action_items: analysis.resolution_steps,
        affected_entities: {
          error_id: analysis.error_id,
          systems: analysis.affected_systems,
          external_action: analysis.external_action_details,
        },
        source_agent: "error_root_cause_analyzer",
        dedup_key: `rca_${analysis.error_id}`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "dedup_key", ignoreDuplicates: true });
    }

    const duration = Date.now() - startTime;
    console.log(`[Error Root Cause Analyzer] Complete in ${duration}ms - Analyzed ${analyses.length} errors`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[Error Root Cause Analyzer] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
