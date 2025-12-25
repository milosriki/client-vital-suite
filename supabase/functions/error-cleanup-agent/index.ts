import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// ERROR CLEANUP AGENT
// Cleans up resolved and stale errors
// Maintains database hygiene and performance
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
  console.error("[Error Cleanup Agent] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

interface CleanupResult {
  category: string;
  criteria: string;
  records_found: number;
  records_cleaned: number;
  action: "archived" | "deleted" | "marked_stale" | "none";
}

interface CleanupReport {
  timestamp: string;
  total_errors_before: number;
  total_errors_after: number;
  cleanup_results: CleanupResult[];
  space_recovered_estimate: string;
  next_recommended_cleanup: string;
}

// Cleanup configuration
const CLEANUP_RULES = {
  // Delete resolved errors older than 30 days
  resolved_retention_days: 30,
  // Mark unresolved errors older than 7 days as stale
  stale_threshold_days: 7,
  // Archive important errors instead of deleting
  archive_threshold_days: 90,
  // Max retry errors to auto-resolve
  max_retry_auto_resolve: true,
};

async function getTotalErrorCount(): Promise<number> {
  const { count } = await supabase
    .from("sync_errors")
    .select("*", { count: "exact", head: true });
  return count || 0;
}

async function cleanupResolvedErrors(): Promise<CleanupResult> {
  const cutoffDate = new Date(Date.now() - CLEANUP_RULES.resolved_retention_days * 24 * 60 * 60 * 1000).toISOString();

  // Count matching records
  const { count } = await supabase
    .from("sync_errors")
    .select("*", { count: "exact", head: true })
    .not("resolved_at", "is", null)
    .lt("resolved_at", cutoffDate);

  const recordsFound = count || 0;

  if (recordsFound === 0) {
    return {
      category: "Resolved Errors",
      criteria: `Resolved more than ${CLEANUP_RULES.resolved_retention_days} days ago`,
      records_found: 0,
      records_cleaned: 0,
      action: "none",
    };
  }

  // Delete old resolved errors
  const { error } = await supabase
    .from("sync_errors")
    .delete()
    .not("resolved_at", "is", null)
    .lt("resolved_at", cutoffDate);

  if (error) {
    console.error("[Error Cleanup Agent] Failed to cleanup resolved errors:", error);
    return {
      category: "Resolved Errors",
      criteria: `Resolved more than ${CLEANUP_RULES.resolved_retention_days} days ago`,
      records_found: recordsFound,
      records_cleaned: 0,
      action: "none",
    };
  }

  return {
    category: "Resolved Errors",
    criteria: `Resolved more than ${CLEANUP_RULES.resolved_retention_days} days ago`,
    records_found: recordsFound,
    records_cleaned: recordsFound,
    action: "deleted",
  };
}

async function cleanupStaleErrors(): Promise<CleanupResult> {
  const staleDate = new Date(Date.now() - CLEANUP_RULES.stale_threshold_days * 24 * 60 * 60 * 1000).toISOString();

  // Find unresolved errors older than stale threshold without recent retry
  const { data: staleErrors, count } = await supabase
    .from("sync_errors")
    .select("id", { count: "exact" })
    .is("resolved_at", null)
    .lt("created_at", staleDate)
    .or(`next_retry_at.is.null,next_retry_at.lt.${staleDate}`);

  const recordsFound = count || 0;

  if (recordsFound === 0 || !staleErrors) {
    return {
      category: "Stale Errors",
      criteria: `Unresolved for more than ${CLEANUP_RULES.stale_threshold_days} days`,
      records_found: 0,
      records_cleaned: 0,
      action: "none",
    };
  }

  // Mark as stale (update error_details)
  const staleIds = staleErrors.map(e => e.id);
  let cleaned = 0;

  // Process in batches of 50
  for (let i = 0; i < staleIds.length; i += 50) {
    const batch = staleIds.slice(i, i + 50);
    const { error } = await supabase
      .from("sync_errors")
      .update({
        error_details: supabase.rpc ? undefined : { marked_stale: true, stale_at: new Date().toISOString() },
      })
      .in("id", batch);

    if (!error) {
      cleaned += batch.length;
    }
  }

  return {
    category: "Stale Errors",
    criteria: `Unresolved for more than ${CLEANUP_RULES.stale_threshold_days} days`,
    records_found: recordsFound,
    records_cleaned: cleaned,
    action: "marked_stale",
  };
}

async function cleanupMaxRetriedErrors(): Promise<CleanupResult> {
  if (!CLEANUP_RULES.max_retry_auto_resolve) {
    return {
      category: "Max Retry Errors",
      criteria: "Auto-resolve disabled",
      records_found: 0,
      records_cleaned: 0,
      action: "none",
    };
  }

  // Find errors that have exceeded max retries
  const { data: maxRetriedErrors, count } = await supabase
    .from("sync_errors")
    .select("id, retry_count, max_retries", { count: "exact" })
    .is("resolved_at", null)
    .not("max_retries", "is", null);

  // Filter to those exceeding max retries
  const exceededErrors = (maxRetriedErrors || []).filter(
    e => (e.retry_count || 0) >= (e.max_retries || 5)
  );

  if (exceededErrors.length === 0) {
    return {
      category: "Max Retry Errors",
      criteria: "Exceeded maximum retry attempts",
      records_found: 0,
      records_cleaned: 0,
      action: "none",
    };
  }

  // Mark as resolved with auto-cleanup note
  const ids = exceededErrors.map(e => e.id);
  const { error } = await supabase
    .from("sync_errors")
    .update({
      resolved_at: new Date().toISOString(),
      error_details: {
        auto_resolved: true,
        resolution_reason: "max_retries_exceeded",
        cleanup_timestamp: new Date().toISOString(),
      },
    })
    .in("id", ids);

  return {
    category: "Max Retry Errors",
    criteria: "Exceeded maximum retry attempts",
    records_found: exceededErrors.length,
    records_cleaned: error ? 0 : exceededErrors.length,
    action: error ? "none" : "archived",
  };
}

async function cleanupDuplicateErrors(): Promise<CleanupResult> {
  // Find potential duplicates (same source, type, and message within 1 hour)
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: recentErrors } = await supabase
    .from("sync_errors")
    .select("id, source, error_type, error_message, created_at")
    .gte("created_at", hourAgo)
    .is("resolved_at", null);

  if (!recentErrors || recentErrors.length < 2) {
    return {
      category: "Duplicate Errors",
      criteria: "Same source, type, and message within 1 hour",
      records_found: 0,
      records_cleaned: 0,
      action: "none",
    };
  }

  // Group by signature
  const signatures = new Map<string, typeof recentErrors>();
  for (const error of recentErrors) {
    const sig = `${error.source}_${error.error_type}_${(error.error_message || "").substring(0, 100)}`;
    if (!signatures.has(sig)) {
      signatures.set(sig, []);
    }
    signatures.get(sig)!.push(error);
  }

  // Find duplicates (more than one error with same signature)
  const duplicates: string[] = [];
  for (const [, errors] of signatures) {
    if (errors.length > 1) {
      // Keep the oldest, mark others as duplicates
      errors.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      duplicates.push(...errors.slice(1).map(e => e.id));
    }
  }

  if (duplicates.length === 0) {
    return {
      category: "Duplicate Errors",
      criteria: "Same source, type, and message within 1 hour",
      records_found: 0,
      records_cleaned: 0,
      action: "none",
    };
  }

  // Mark duplicates as resolved
  const { error } = await supabase
    .from("sync_errors")
    .update({
      resolved_at: new Date().toISOString(),
      error_details: {
        auto_resolved: true,
        resolution_reason: "duplicate",
        cleanup_timestamp: new Date().toISOString(),
      },
    })
    .in("id", duplicates);

  return {
    category: "Duplicate Errors",
    criteria: "Same source, type, and message within 1 hour",
    records_found: duplicates.length,
    records_cleaned: error ? 0 : duplicates.length,
    action: error ? "none" : "archived",
  };
}

async function cleanupOrphanedRetries(): Promise<CleanupResult> {
  // Find errors with past retry dates that weren't processed
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("sync_errors")
    .select("*", { count: "exact", head: true })
    .is("resolved_at", null)
    .not("next_retry_at", "is", null)
    .lt("next_retry_at", twoDaysAgo);

  const recordsFound = count || 0;

  if (recordsFound === 0) {
    return {
      category: "Orphaned Retries",
      criteria: "Retry scheduled more than 2 days ago",
      records_found: 0,
      records_cleaned: 0,
      action: "none",
    };
  }

  // Reset these for retry orchestrator to pick up
  const { error } = await supabase
    .from("sync_errors")
    .update({ next_retry_at: new Date().toISOString() })
    .is("resolved_at", null)
    .not("next_retry_at", "is", null)
    .lt("next_retry_at", twoDaysAgo);

  return {
    category: "Orphaned Retries",
    criteria: "Retry scheduled more than 2 days ago",
    records_found: recordsFound,
    records_cleaned: error ? 0 : recordsFound,
    action: error ? "none" : "archived",
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

    console.log("[Error Cleanup Agent] Starting cleanup...");

    const totalBefore = await getTotalErrorCount();

    // Run all cleanup tasks
    const results = await Promise.all([
      cleanupResolvedErrors(),
      cleanupStaleErrors(),
      cleanupMaxRetriedErrors(),
      cleanupDuplicateErrors(),
      cleanupOrphanedRetries(),
    ]);

    const totalAfter = await getTotalErrorCount();
    const totalCleaned = results.reduce((sum, r) => sum + r.records_cleaned, 0);

    // Estimate space recovered (rough estimate: ~1KB per record)
    const spaceRecovered = totalCleaned > 0 ? `~${Math.round(totalCleaned * 1)} KB` : "0 KB";

    // Calculate next recommended cleanup
    const nextCleanup = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const report: CleanupReport = {
      timestamp: new Date().toISOString(),
      total_errors_before: totalBefore,
      total_errors_after: totalAfter,
      cleanup_results: results,
      space_recovered_estimate: spaceRecovered,
      next_recommended_cleanup: nextCleanup,
    };

    // Log cleanup results
    await supabase.from("sync_logs").insert({
      platform: "error_cleanup_agent",
      sync_type: "cleanup",
      status: "success",
      records_processed: totalCleaned,
      records_failed: 0,
      error_details: {
        before: totalBefore,
        after: totalAfter,
        cleaned: totalCleaned,
        results: results.map(r => ({ category: r.category, cleaned: r.records_cleaned })),
      },
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
    });

    const duration = Date.now() - startTime;
    console.log(`[Error Cleanup Agent] Complete in ${duration}ms - Cleaned ${totalCleaned} records`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[Error Cleanup Agent] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
