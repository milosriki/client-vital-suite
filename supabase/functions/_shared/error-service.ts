import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

// ============================================
// ERROR SERVICE (CONSOLIDATED LOGIC)
// Merges: Triage, Pattern, Root Cause, Auto-Resolver
// ============================================

export interface ErrorRecord {
  id: string;
  source: string;
  error_type: string;
  error_message: string;
  retry_count: number;
  created_at: string;
  error_details: any;
}

export class ErrorService {
  private supabase: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  // --------------------------------------------------------------------------
  // 1. TRIAGE LOGIC
  // --------------------------------------------------------------------------
  categorizeError(error: ErrorRecord): { category: string; handler: string } {
    const errorType = String(error.error_type || "").toLowerCase();
    const source = String(error.source || "").toLowerCase();
    const message = String(error.error_message || "").toLowerCase();

    if (
      ["hubspot", "stripe", "meta", "facebook", "callgear"].includes(source)
    ) {
      return { category: "integration", handler: `${source}-executor` }; // Updated to use new executors
    }
    if (
      errorType === "rate_limit" ||
      message.includes("429") ||
      message.includes("rate limit")
    ) {
      return { category: "integration", handler: "system-executor" };
    }
    if (
      errorType === "auth" ||
      message.includes("401") ||
      message.includes("403")
    ) {
      return { category: "security", handler: "forensic-executor" };
    }
    if (errorType === "validation" || message.includes("invalid")) {
      return { category: "data", handler: "error-resolution-agent" };
    }
    return { category: "system", handler: "error-resolution-agent" };
  }

  calculatePriority(error: ErrorRecord, category: string): string {
    const source = String(error.source || "").toLowerCase();
    if (source === "stripe" || error.retry_count >= 3) return "critical";
    if (category === "security") return "critical";
    if (category === "integration" && ["hubspot", "meta"].includes(source))
      return "high";
    return "low";
  }

  // --------------------------------------------------------------------------
  // 2. ROOT CAUSE ANALYZER LOGIC
  // --------------------------------------------------------------------------
  analyzeRootCause(error: ErrorRecord): any {
    const msg = String(error.error_message || "").toLowerCase();
    const patterns = [
      {
        regex: /rate.?limit|429/i,
        cause: "Rate Limit Exceeded",
        fix: "Backoff",
      },
      {
        regex: /unauthorized|401|token/i,
        cause: "Auth Failure",
        fix: "Refresh Token",
      },
      {
        regex: /timeout|etimedout/i,
        cause: "Network Timeout",
        fix: "Retry",
      },
      {
        regex: /duplicate|constraint/i,
        cause: "Duplicate Data",
        fix: "Idempotency Check",
      },
      {
        regex: /not found|404/i,
        cause: "Missing Resource",
        fix: "Verify ID",
      },
    ];

    for (const p of patterns) {
      if (p.regex.test(msg)) {
        return {
          primary_cause: p.cause,
          resolution: p.fix,
          confidence: 90,
        };
      }
    }

    return {
      primary_cause: "Unknown internal error",
      resolution: "Investigate logs",
      confidence: 30,
    };
  }

  // --------------------------------------------------------------------------
  // 3. AUTO RESOLVER LOGIC
  // --------------------------------------------------------------------------
  async attemptAutoResolve(error: ErrorRecord): Promise<{
    resolved: boolean;
    action: string;
  }> {
    const msg = String(error.error_message || "").toLowerCase();

    // Rule 1: Stale Data
    if (msg.includes("not found") || msg.includes("stale")) {
      await this.supabase
        .from("sync_errors")
        .update({
          resolved_at: new Date().toISOString(),
          error_details: { ...error.error_details, note: "Stale data ignored" },
        })
        .eq("id", error.id);
      return { resolved: true, action: "Ignored stale data" };
    }

    // Rule 2: Duplicates
    if (msg.includes("duplicate") || msg.includes("already exists")) {
      await this.supabase
        .from("sync_errors")
        .update({
          resolved_at: new Date().toISOString(),
          error_details: {
            ...error.error_details,
            note: "Duplicate handled",
          },
        })
        .eq("id", error.id);
      return { resolved: true, action: "Marked duplicate as resolved" };
    }

    // Rule 3: Transient Retry (Network/Timeout)
    if (
      (msg.includes("timeout") || msg.includes("network")) &&
      error.retry_count < 3
    ) {
      const backoff = Math.pow(2, error.retry_count) * 1000;
      await this.supabase
        .from("sync_errors")
        .update({
          retry_count: error.retry_count + 1,
          next_retry_at: new Date(Date.now() + backoff).toISOString(),
        })
        .eq("id", error.id);
      return { resolved: false, action: `Scheduled retry in ${backoff}ms` };
    }

    return { resolved: false, action: "Manual intervention required" };
  }

  // --------------------------------------------------------------------------
  // 4. PATTERN DETECTION LOGIC
  // --------------------------------------------------------------------------
  detectPatterns(errors: ErrorRecord[]): any[] {
    const groups: Record<string, ErrorRecord[]> = {};
    const patterns: any[] = [];

    // Group by source + type
    for (const e of errors) {
      const key = `${e.source}_${e.error_type}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }

    // Analyze groups
    for (const [key, group] of Object.entries(groups)) {
      if (group.length > 5) {
        patterns.push({
          pattern_type: "recurring_spike",
          description: `High volume (${group.length}) of ${key} errors`,
          severity: group.length > 20 ? "critical" : "high",
          affected_ids: group.map((e) => e.id).slice(0, 5),
        });
      }
    }

    return patterns;
  }
}
