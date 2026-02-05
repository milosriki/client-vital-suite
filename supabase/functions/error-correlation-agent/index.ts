import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";

// ============================================
// ERROR CORRELATION AGENT
// Finds correlated errors across systems
// Identifies root causes by detecting error chains
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
  console.error("[Error Correlation Agent] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

interface ErrorCorrelation {
  correlation_id: string;
  correlation_type: "temporal" | "causal" | "shared_resource" | "dependency_chain";
  confidence: number;  // 0-100
  primary_error_id: string;
  secondary_error_ids: string[];
  sources_involved: string[];
  time_window_seconds: number;
  correlation_evidence: string[];
  likely_root_cause: string;
  recommended_investigation: string[];
}

interface CorrelationReport {
  timestamp: string;
  errors_analyzed: number;
  correlations_found: number;
  high_confidence_correlations: number;
  correlations: ErrorCorrelation[];
  root_cause_summary: string[];
}

// Known dependency relationships
const dependencyMap: Record<string, string[]> = {
  hubspot: ["stripe", "meta", "callgear"],
  stripe: ["hubspot"],
  meta: ["hubspot", "anytrack"],
  facebook: ["hubspot", "anytrack"],
  callgear: ["hubspot"],
  anytrack: ["meta", "hubspot"],
};

function generateCorrelationId(type: string, errorIds: string[]): string {
  const idPart = errorIds.slice(0, 2).map(id => id.substring(0, 8)).join("_");
  return `${type}_${idPart}`;
}

function findTemporalCorrelations(errors: Record<string, unknown>[]): ErrorCorrelation[] {
  const correlations: ErrorCorrelation[] = [];
  const timeWindowMs = 60 * 1000; // 1 minute window

  // Group errors by time proximity
  const processedPairs = new Set<string>();

  for (let i = 0; i < errors.length; i++) {
    const error1 = errors[i];
    const time1 = new Date(String(error1.created_at)).getTime();
    const source1 = String(error1.source || "unknown");

    const nearbyErrors = errors.filter((error2, j) => {
      if (i === j) return false;
      const time2 = new Date(String(error2.created_at)).getTime();
      const source2 = String(error2.source || "unknown");
      return Math.abs(time2 - time1) <= timeWindowMs && source2 !== source1;
    });

    if (nearbyErrors.length >= 2) {
      const errorIds = [error1.id as string, ...nearbyErrors.map(e => e.id as string)];
      const pairKey = errorIds.sort().join(",");

      if (!processedPairs.has(pairKey)) {
        processedPairs.add(pairKey);

        const sources = [...new Set([source1, ...nearbyErrors.map(e => String(e.source || "unknown"))])];

        correlations.push({
          correlation_id: generateCorrelationId("temporal", errorIds),
          correlation_type: "temporal",
          confidence: Math.min(90, 60 + nearbyErrors.length * 10),
          primary_error_id: error1.id as string,
          secondary_error_ids: nearbyErrors.map(e => e.id as string),
          sources_involved: sources,
          time_window_seconds: 60,
          correlation_evidence: [
            `${errorIds.length} errors occurred within 1 minute`,
            `Involved sources: ${sources.join(", ")}`,
          ],
          likely_root_cause: "Shared trigger or cascading failure",
          recommended_investigation: [
            "Check for common external event at this time",
            "Review system logs for cascade triggers",
            "Check shared infrastructure (database, network)",
          ],
        });
      }
    }
  }

  return correlations;
}

function findDependencyChainCorrelations(errors: Record<string, unknown>[]): ErrorCorrelation[] {
  const correlations: ErrorCorrelation[] = [];
  const processedChains = new Set<string>();

  for (const error of errors) {
    const source = String(error.source || "unknown").toLowerCase();
    const dependencies = dependencyMap[source] || [];

    // Find errors in dependent systems within 5 minutes
    const errorTime = new Date(String(error.created_at)).getTime();
    const dependentErrors = errors.filter(e => {
      const eSource = String(e.source || "unknown").toLowerCase();
      const eTime = new Date(String(e.created_at)).getTime();
      return dependencies.includes(eSource) && Math.abs(eTime - errorTime) <= 5 * 60 * 1000;
    });

    if (dependentErrors.length > 0) {
      const chainSources = [source, ...dependentErrors.map(e => String(e.source || "unknown"))];
      const chainKey = chainSources.sort().join(",");

      if (!processedChains.has(chainKey)) {
        processedChains.add(chainKey);

        const errorIds = [error.id as string, ...dependentErrors.map(e => e.id as string)];

        correlations.push({
          correlation_id: generateCorrelationId("dependency", errorIds),
          correlation_type: "dependency_chain",
          confidence: 75,
          primary_error_id: error.id as string,
          secondary_error_ids: dependentErrors.map(e => e.id as string),
          sources_involved: chainSources,
          time_window_seconds: 300,
          correlation_evidence: [
            `${source} error followed by errors in dependent systems`,
            `Known dependencies: ${dependencies.join(", ")}`,
          ],
          likely_root_cause: `${source} failure causing cascade`,
          recommended_investigation: [
            `Investigate ${source} error first`,
            "Check API credentials and rate limits",
            "Review integration configuration",
          ],
        });
      }
    }
  }

  return correlations;
}

function findSharedResourceCorrelations(errors: Record<string, unknown>[]): ErrorCorrelation[] {
  const correlations: ErrorCorrelation[] = [];

  // Group by error type (indicates shared resource issue)
  const errorsByType = new Map<string, typeof errors>();
  for (const error of errors) {
    const errorType = String(error.error_type || "unknown");
    if (!errorsByType.has(errorType)) {
      errorsByType.set(errorType, []);
    }
    errorsByType.get(errorType)!.push(error);
  }

  for (const [errorType, typeErrors] of errorsByType) {
    const sources = [...new Set(typeErrors.map(e => String(e.source || "unknown")))];

    if (sources.length >= 2 && typeErrors.length >= 3) {
      const errorIds = typeErrors.map(e => e.id as string);

      // Determine shared resource based on error type
      let sharedResource = "unknown shared resource";
      if (errorType === "auth") sharedResource = "authentication service";
      else if (errorType === "network") sharedResource = "network infrastructure";
      else if (errorType === "timeout") sharedResource = "database or API gateway";
      else if (errorType === "rate_limit") sharedResource = "API rate limiting";

      correlations.push({
        correlation_id: generateCorrelationId("shared", errorIds),
        correlation_type: "shared_resource",
        confidence: 80,
        primary_error_id: typeErrors[0].id as string,
        secondary_error_ids: typeErrors.slice(1).map(e => e.id as string),
        sources_involved: sources,
        time_window_seconds: 3600,
        correlation_evidence: [
          `Same error type (${errorType}) across ${sources.length} sources`,
          `Total occurrences: ${typeErrors.length}`,
        ],
        likely_root_cause: `Shared ${sharedResource} issue`,
        recommended_investigation: [
          `Check ${sharedResource} status`,
          "Review infrastructure monitoring",
          "Check for configuration changes",
        ],
      });
    }
  }

  return correlations;
}

function findCausalCorrelations(errors: Record<string, unknown>[]): ErrorCorrelation[] {
  const correlations: ErrorCorrelation[] = [];

  // Look for auth errors causing other errors
  const authErrors = errors.filter(e =>
    String(e.error_type || "").toLowerCase() === "auth" ||
    String(e.error_message || "").toLowerCase().includes("unauthorized")
  );

  for (const authError of authErrors) {
    const authSource = String(authError.source || "unknown");
    const authTime = new Date(String(authError.created_at)).getTime();

    // Find subsequent errors from same source
    const subsequentErrors = errors.filter(e => {
      if (e.id === authError.id) return false;
      const eSource = String(e.source || "unknown");
      const eTime = new Date(String(e.created_at)).getTime();
      const eType = String(e.error_type || "");
      return eSource === authSource && eTime > authTime && eTime - authTime <= 30 * 60 * 1000 && eType !== "auth";
    });

    if (subsequentErrors.length >= 2) {
      const errorIds = [authError.id as string, ...subsequentErrors.map(e => e.id as string)];

      correlations.push({
        correlation_id: generateCorrelationId("causal", errorIds),
        correlation_type: "causal",
        confidence: 85,
        primary_error_id: authError.id as string,
        secondary_error_ids: subsequentErrors.map(e => e.id as string),
        sources_involved: [authSource],
        time_window_seconds: 1800,
        correlation_evidence: [
          `Auth error preceded ${subsequentErrors.length} other errors`,
          `All errors from ${authSource}`,
        ],
        likely_root_cause: `${authSource} authentication failure`,
        recommended_investigation: [
          "Check API credentials and tokens",
          "Verify OAuth configuration",
          "Check for credential expiration",
        ],
      });
    }
  }

  return correlations;
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

    console.log("[Error Correlation Agent] Starting correlation analysis...");

    // Fetch recent errors
    const hoursBack = 24;
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    const { data: errors, error: fetchError } = await supabase
      .from("sync_errors")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch errors: ${fetchError.message}`);
    }

    const errorList = errors || [];

    if (errorList.length < 2) {
      return new Response(JSON.stringify({
        success: true,
        duration_ms: Date.now() - startTime,
        report: {
          timestamp: new Date().toISOString(),
          errors_analyzed: errorList.length,
          correlations_found: 0,
          high_confidence_correlations: 0,
          correlations: [],
          root_cause_summary: ["Insufficient errors for correlation analysis"],
        },
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Find all correlation types
    const allCorrelations: ErrorCorrelation[] = [
      ...findTemporalCorrelations(errorList),
      ...findDependencyChainCorrelations(errorList),
      ...findSharedResourceCorrelations(errorList),
      ...findCausalCorrelations(errorList),
    ];

    // Deduplicate and sort by confidence
    const uniqueCorrelations = allCorrelations.filter((corr, index, self) =>
      index === self.findIndex(c => c.correlation_id === corr.correlation_id)
    );
    uniqueCorrelations.sort((a, b) => b.confidence - a.confidence);

    const highConfidenceCount = uniqueCorrelations.filter(c => c.confidence >= 75).length;

    // Generate root cause summary
    const rootCauses = [...new Set(uniqueCorrelations.map(c => c.likely_root_cause))];

    const report: CorrelationReport = {
      timestamp: new Date().toISOString(),
      errors_analyzed: errorList.length,
      correlations_found: uniqueCorrelations.length,
      high_confidence_correlations: highConfidenceCount,
      correlations: uniqueCorrelations,
      root_cause_summary: rootCauses.length > 0 ? rootCauses : ["No clear root causes identified"],
    };

    // Store high-confidence correlations as insights
    for (const corr of uniqueCorrelations.filter(c => c.confidence >= 75)) {
      await supabase.from("proactive_insights").upsert({
        insight_type: "error_correlation",
        priority: corr.confidence >= 85 ? "critical" : "high",
        title: `Error Correlation: ${corr.correlation_type} - ${corr.sources_involved.join(", ")}`,
        content: `${corr.likely_root_cause}. Confidence: ${corr.confidence}%`,
        action_items: corr.recommended_investigation,
        affected_entities: {
          primary_error: corr.primary_error_id,
          secondary_errors: corr.secondary_error_ids,
          sources: corr.sources_involved,
        },
        source_agent: "error_correlation_agent",
        dedup_key: `correlation_${corr.correlation_id}`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "dedup_key", ignoreDuplicates: true });
    }

    const duration = Date.now() - startTime;
    console.log(`[Error Correlation Agent] Complete in ${duration}ms - Found ${uniqueCorrelations.length} correlations`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[Error Correlation Agent] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
