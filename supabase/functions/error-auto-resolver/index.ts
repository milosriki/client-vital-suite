import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// ERROR AUTO RESOLVER AGENT
// Automatically resolves known errors using predefined solutions
// Reduces manual intervention for common issues
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
  console.error("[Error Auto Resolver] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

interface ResolutionRule {
  id: string;
  name: string;
  pattern: RegExp;
  sources?: string[];
  errorTypes?: string[];
  resolver: (error: Record<string, unknown>) => Promise<ResolutionResult>;
}

interface ResolutionResult {
  resolved: boolean;
  action_taken: string;
  details: Record<string, unknown>;
  manual_steps?: string[];
}

interface AutoResolution {
  error_id: string;
  rule_matched: string | null;
  resolved: boolean;
  action_taken: string;
  details: Record<string, unknown>;
  manual_steps: string[];
}

interface ResolverReport {
  timestamp: string;
  errors_analyzed: number;
  auto_resolved: number;
  manual_required: number;
  resolutions: AutoResolution[];
  rule_effectiveness: { rule: string; matches: number; resolved: number }[];
}

// Define auto-resolution rules
const resolutionRules: ResolutionRule[] = [
  {
    id: "transient_network",
    name: "Transient Network Error",
    pattern: /connection reset|ECONNRESET|socket hang up|network.*temporarily/i,
    resolver: async (error) => {
      const retryCount = Number(error.retry_count || 0);
      if (retryCount < 3) {
        // Schedule immediate retry
        await supabase
          .from("sync_errors")
          .update({
            retry_count: retryCount + 1,
            next_retry_at: new Date(Date.now() + 5000).toISOString(), // 5 second retry
          })
          .eq("id", error.id);

        return {
          resolved: false,
          action_taken: "Scheduled immediate retry (transient error)",
          details: { retry_count: retryCount + 1, retry_in_ms: 5000 },
        };
      }
      // After 3 retries, mark as resolved if error persists
      await supabase
        .from("sync_errors")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", error.id);

      return {
        resolved: true,
        action_taken: "Resolved after max transient retries",
        details: { final_retry_count: retryCount },
      };
    },
  },
  {
    id: "stale_data",
    name: "Stale Data Reference",
    pattern: /stale|outdated|not found|404|does not exist/i,
    errorTypes: ["validation", "not_found"],
    resolver: async (error) => {
      // Mark stale data errors as resolved with note
      await supabase
        .from("sync_errors")
        .update({
          resolved_at: new Date().toISOString(),
          error_details: {
            ...error.error_details,
            auto_resolution: "stale_data",
            resolution_note: "Data may have been deleted or updated externally",
          },
        })
        .eq("id", error.id);

      return {
        resolved: true,
        action_taken: "Resolved as stale data reference",
        details: { reason: "External data change" },
      };
    },
  },
  {
    id: "duplicate_request",
    name: "Duplicate Request",
    pattern: /duplicate|already exists|conflict|unique constraint/i,
    resolver: async (error) => {
      // Duplicates are typically safe to mark as resolved
      await supabase
        .from("sync_errors")
        .update({
          resolved_at: new Date().toISOString(),
          error_details: {
            ...error.error_details,
            auto_resolution: "duplicate_handled",
            resolution_note: "Duplicate request - original succeeded",
          },
        })
        .eq("id", error.id);

      return {
        resolved: true,
        action_taken: "Resolved duplicate request error",
        details: { reason: "Original request succeeded" },
      };
    },
  },
  {
    id: "expired_cache",
    name: "Expired Cache/Session",
    pattern: /cache.*expired|session.*expired|token.*expired|jwt.*expired/i,
    resolver: async (error) => {
      // Schedule retry to use refreshed credentials
      await supabase
        .from("sync_errors")
        .update({
          retry_count: (Number(error.retry_count) || 0) + 1,
          next_retry_at: new Date(Date.now() + 1000).toISOString(),
          error_details: {
            ...error.error_details,
            resolution_note: "Scheduled retry after token refresh",
          },
        })
        .eq("id", error.id);

      return {
        resolved: false,
        action_taken: "Scheduled retry for token refresh",
        details: { retry_scheduled: true },
        manual_steps: ["Verify token refresh mechanism is working"],
      };
    },
  },
  {
    id: "rate_limit_soft",
    name: "Soft Rate Limit",
    pattern: /rate limit|throttl|slow down|429/i,
    resolver: async (error) => {
      const retryCount = Number(error.retry_count || 0);
      const backoffMs = Math.min(Math.pow(2, retryCount) * 1000, 60000);

      await supabase
        .from("sync_errors")
        .update({
          retry_count: retryCount + 1,
          next_retry_at: new Date(Date.now() + backoffMs).toISOString(),
        })
        .eq("id", error.id);

      return {
        resolved: false,
        action_taken: `Exponential backoff scheduled (${backoffMs}ms)`,
        details: { backoff_ms: backoffMs, retry_count: retryCount + 1 },
      };
    },
  },
  {
    id: "empty_response",
    name: "Empty Response",
    pattern: /empty.*response|no data|null response|undefined/i,
    resolver: async (error) => {
      // Empty responses are often transient
      const retryCount = Number(error.retry_count || 0);
      if (retryCount < 2) {
        await supabase
          .from("sync_errors")
          .update({
            retry_count: retryCount + 1,
            next_retry_at: new Date(Date.now() + 10000).toISOString(),
          })
          .eq("id", error.id);

        return {
          resolved: false,
          action_taken: "Scheduled retry for empty response",
          details: { retry_count: retryCount + 1 },
        };
      }

      // Mark as resolved - data may legitimately be empty
      await supabase
        .from("sync_errors")
        .update({
          resolved_at: new Date().toISOString(),
          error_details: {
            ...error.error_details,
            auto_resolution: "empty_response_accepted",
          },
        })
        .eq("id", error.id);

      return {
        resolved: true,
        action_taken: "Accepted empty response as valid",
        details: { reason: "Data may be legitimately empty" },
      };
    },
  },
  {
    id: "timeout_short",
    name: "Short Timeout",
    pattern: /timeout|ETIMEDOUT|request timed out/i,
    errorTypes: ["timeout"],
    resolver: async (error) => {
      const retryCount = Number(error.retry_count || 0);
      if (retryCount < 3) {
        const backoffMs = Math.pow(2, retryCount) * 5000; // Longer backoff for timeouts

        await supabase
          .from("sync_errors")
          .update({
            retry_count: retryCount + 1,
            next_retry_at: new Date(Date.now() + backoffMs).toISOString(),
          })
          .eq("id", error.id);

        return {
          resolved: false,
          action_taken: `Timeout retry scheduled (${backoffMs}ms backoff)`,
          details: { backoff_ms: backoffMs, retry_count: retryCount + 1 },
        };
      }

      return {
        resolved: false,
        action_taken: "Max timeout retries reached",
        details: { retry_count: retryCount },
        manual_steps: ["Check target service availability", "Consider increasing timeout threshold"],
      };
    },
  },
  {
    id: "old_error",
    name: "Old Unresolved Error",
    pattern: /.*/,  // Matches anything - used as fallback for old errors
    resolver: async (error) => {
      const createdAt = new Date(String(error.created_at));
      const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

      // Auto-resolve errors older than 72 hours
      if (ageHours > 72) {
        await supabase
          .from("sync_errors")
          .update({
            resolved_at: new Date().toISOString(),
            error_details: {
              ...error.error_details,
              auto_resolution: "aged_out",
              resolution_note: `Auto-resolved after ${Math.round(ageHours)} hours`,
            },
          })
          .eq("id", error.id);

        return {
          resolved: true,
          action_taken: `Auto-resolved aged error (${Math.round(ageHours)}h old)`,
          details: { age_hours: Math.round(ageHours) },
        };
      }

      return {
        resolved: false,
        action_taken: "No matching resolution rule",
        details: { age_hours: Math.round(ageHours) },
        manual_steps: ["Review error manually", "Check if issue persists"],
      };
    },
  },
];

async function attemptAutoResolve(error: Record<string, unknown>): Promise<AutoResolution> {
  const message = String(error.error_message || "");
  const errorType = String(error.error_type || "");

  for (const rule of resolutionRules) {
    // Check if rule applies
    if (rule.errorTypes && !rule.errorTypes.includes(errorType)) {
      continue;
    }

    if (rule.sources) {
      const source = String(error.source || "").toLowerCase();
      if (!rule.sources.includes(source)) {
        continue;
      }
    }

    // Check pattern match
    if (rule.pattern.test(message) || rule.pattern.test(errorType)) {
      try {
        const result = await rule.resolver(error);
        return {
          error_id: error.id as string,
          rule_matched: rule.name,
          resolved: result.resolved,
          action_taken: result.action_taken,
          details: result.details,
          manual_steps: result.manual_steps || [],
        };
      } catch (e) {
        console.error(`[Error Auto Resolver] Rule ${rule.name} failed:`, e);
      }
    }
  }

  return {
    error_id: error.id as string,
    rule_matched: null,
    resolved: false,
    action_taken: "No matching rule found",
    details: {},
    manual_steps: ["Manual investigation required"],
  };
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

    console.log("[Error Auto Resolver] Starting auto-resolution...");

    // Fetch unresolved errors
    const { data: errors, error: fetchError } = await supabase
      .from("sync_errors")
      .select("*")
      .is("resolved_at", null)
      .order("created_at", { ascending: true }) // Process oldest first
      .limit(100);

    if (fetchError) {
      throw new Error(`Failed to fetch errors: ${fetchError.message}`);
    }

    const resolutions: AutoResolution[] = [];
    const ruleStats = new Map<string, { matches: number; resolved: number }>();

    for (const error of errors || []) {
      const resolution = await attemptAutoResolve(error);
      resolutions.push(resolution);

      // Track rule effectiveness
      const ruleName = resolution.rule_matched || "no_match";
      if (!ruleStats.has(ruleName)) {
        ruleStats.set(ruleName, { matches: 0, resolved: 0 });
      }
      const stats = ruleStats.get(ruleName)!;
      stats.matches++;
      if (resolution.resolved) stats.resolved++;
    }

    const autoResolved = resolutions.filter(r => r.resolved).length;
    const manualRequired = resolutions.filter(r => !r.resolved && r.manual_steps.length > 0).length;

    const ruleEffectiveness = Array.from(ruleStats.entries())
      .map(([rule, stats]) => ({ rule, matches: stats.matches, resolved: stats.resolved }))
      .sort((a, b) => b.matches - a.matches);

    const report: ResolverReport = {
      timestamp: new Date().toISOString(),
      errors_analyzed: (errors || []).length,
      auto_resolved: autoResolved,
      manual_required: manualRequired,
      resolutions,
      rule_effectiveness: ruleEffectiveness,
    };

    // Log successful auto-resolutions
    if (autoResolved > 0) {
      await supabase.from("sync_logs").insert({
        platform: "error_auto_resolver",
        sync_type: "auto_resolution",
        status: "success",
        records_processed: (errors || []).length,
        records_failed: manualRequired,
        error_details: { auto_resolved: autoResolved, rules_used: ruleEffectiveness.filter(r => r.resolved > 0).map(r => r.rule) },
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[Error Auto Resolver] Complete in ${duration}ms - Auto-resolved: ${autoResolved}, Manual: ${manualRequired}`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[Error Auto Resolver] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
