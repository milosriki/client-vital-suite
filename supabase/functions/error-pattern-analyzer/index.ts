import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// ERROR PATTERN ANALYZER AGENT
// Identifies recurring error patterns across systems
// Detects systematic issues before they escalate
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
  console.error("[Error Pattern Analyzer] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

interface ErrorPattern {
  pattern_id: string;
  pattern_type: "recurring" | "spike" | "cascade" | "periodic" | "correlated";
  description: string;
  error_count: number;
  first_occurrence: string;
  last_occurrence: string;
  frequency: string;
  affected_sources: string[];
  affected_types: string[];
  sample_errors: string[];
  severity: "critical" | "high" | "medium" | "low";
  recommended_action: string;
}

interface PatternReport {
  timestamp: string;
  analysis_period: string;
  patterns_detected: number;
  critical_patterns: number;
  patterns: ErrorPattern[];
  trend_summary: string;
}

function generatePatternId(type: string, sources: string[], errorTypes: string[]): string {
  const key = `${type}_${sources.sort().join("_")}_${errorTypes.sort().join("_")}`;
  return key.substring(0, 50).replace(/[^a-zA-Z0-9_]/g, "_");
}

function calculateFrequency(count: number, hoursSpan: number): string {
  const perHour = count / hoursSpan;
  if (perHour >= 60) return `${Math.round(perHour)} per hour (every minute)`;
  if (perHour >= 1) return `${Math.round(perHour)} per hour`;
  if (perHour >= 0.04) return `${Math.round(perHour * 24)} per day`;
  return `${Math.round(perHour * 24 * 7)} per week`;
}

function determineSeverity(pattern: { count: number; sources: string[]; types: string[] }): ErrorPattern["severity"] {
  // Critical: High frequency or affecting critical systems
  if (pattern.count > 50 || pattern.sources.includes("stripe")) {
    return "critical";
  }
  // High: Moderate frequency or multiple sources
  if (pattern.count > 20 || pattern.sources.length > 2) {
    return "high";
  }
  // Medium: Low-moderate frequency
  if (pattern.count > 5) {
    return "medium";
  }
  return "low";
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

    console.log("[Error Pattern Analyzer] Starting pattern analysis...");

    // Fetch errors from last 24 hours
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: errors, error: fetchError } = await supabase
      .from("sync_errors")
      .select("*")
      .gte("created_at", dayAgo)
      .order("created_at", { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch errors: ${fetchError.message}`);
    }

    const patterns: ErrorPattern[] = [];
    const errorList = errors || [];

    if (errorList.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        duration_ms: Date.now() - startTime,
        report: {
          timestamp: new Date().toISOString(),
          analysis_period: "24 hours",
          patterns_detected: 0,
          critical_patterns: 0,
          patterns: [],
          trend_summary: "No errors detected in the analysis period.",
        },
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Group errors by source and type
    const groupedErrors = new Map<string, typeof errorList>();
    for (const error of errorList) {
      const key = `${error.source || "unknown"}_${error.error_type || "unknown"}`;
      if (!groupedErrors.has(key)) {
        groupedErrors.set(key, []);
      }
      groupedErrors.get(key)!.push(error);
    }

    // Detect recurring patterns (same source+type multiple times)
    for (const [key, group] of groupedErrors) {
      if (group.length >= 3) {
        const [source, errorType] = key.split("_");
        const firstOccurrence = new Date(group[0].created_at);
        const lastOccurrence = new Date(group[group.length - 1].created_at);
        const hoursSpan = Math.max(1, (lastOccurrence.getTime() - firstOccurrence.getTime()) / (1000 * 60 * 60));

        patterns.push({
          pattern_id: generatePatternId("recurring", [source], [errorType]),
          pattern_type: "recurring",
          description: `Recurring ${errorType} errors from ${source}`,
          error_count: group.length,
          first_occurrence: firstOccurrence.toISOString(),
          last_occurrence: lastOccurrence.toISOString(),
          frequency: calculateFrequency(group.length, hoursSpan),
          affected_sources: [source],
          affected_types: [errorType],
          sample_errors: group.slice(0, 3).map(e => e.id),
          severity: determineSeverity({ count: group.length, sources: [source], types: [errorType] }),
          recommended_action: `Investigate root cause of ${errorType} errors in ${source} integration`,
        });
      }
    }

    // Detect spike patterns (sudden increase in errors)
    const hourlyBuckets = new Map<string, typeof errorList>();
    for (const error of errorList) {
      const hour = new Date(error.created_at).toISOString().substring(0, 13);
      if (!hourlyBuckets.has(hour)) {
        hourlyBuckets.set(hour, []);
      }
      hourlyBuckets.get(hour)!.push(error);
    }

    const bucketCounts = Array.from(hourlyBuckets.entries()).map(([hour, errs]) => ({
      hour,
      count: errs.length,
      errors: errs,
    }));

    if (bucketCounts.length >= 2) {
      const avgCount = bucketCounts.reduce((sum, b) => sum + b.count, 0) / bucketCounts.length;
      for (const bucket of bucketCounts) {
        if (bucket.count > avgCount * 3 && bucket.count >= 5) {
          const sources = [...new Set(bucket.errors.map(e => e.source || "unknown"))];
          const types = [...new Set(bucket.errors.map(e => e.error_type || "unknown"))];

          patterns.push({
            pattern_id: generatePatternId("spike", sources, types),
            pattern_type: "spike",
            description: `Error spike detected at ${bucket.hour}:00 UTC`,
            error_count: bucket.count,
            first_occurrence: bucket.hour + ":00:00.000Z",
            last_occurrence: bucket.hour + ":59:59.999Z",
            frequency: `${bucket.count} errors in 1 hour (${Math.round(bucket.count / avgCount)}x normal)`,
            affected_sources: sources,
            affected_types: types,
            sample_errors: bucket.errors.slice(0, 3).map(e => e.id),
            severity: bucket.count > avgCount * 5 ? "critical" : "high",
            recommended_action: "Investigate external factors or system changes during spike period",
          });
        }
      }
    }

    // Detect cascade patterns (errors across multiple sources in short timeframe)
    const timeWindows: { start: Date; errors: typeof errorList }[] = [];
    for (let i = 0; i < errorList.length; i++) {
      const windowStart = new Date(errorList[i].created_at);
      const windowEnd = new Date(windowStart.getTime() + 5 * 60 * 1000); // 5 minute window
      const windowErrors = errorList.filter(e => {
        const t = new Date(e.created_at);
        return t >= windowStart && t <= windowEnd;
      });

      const uniqueSources = new Set(windowErrors.map(e => e.source || "unknown"));
      if (uniqueSources.size >= 3 && windowErrors.length >= 5) {
        timeWindows.push({ start: windowStart, errors: windowErrors });
      }
    }

    // Deduplicate overlapping windows
    const cascadeWindows = timeWindows.filter((w, i) => {
      return !timeWindows.slice(0, i).some(prev =>
        Math.abs(w.start.getTime() - prev.start.getTime()) < 5 * 60 * 1000
      );
    });

    for (const window of cascadeWindows.slice(0, 5)) {
      const sources = [...new Set(window.errors.map(e => e.source || "unknown"))];
      const types = [...new Set(window.errors.map(e => e.error_type || "unknown"))];

      patterns.push({
        pattern_id: generatePatternId("cascade", sources, types),
        pattern_type: "cascade",
        description: `Cascade failure across ${sources.length} systems`,
        error_count: window.errors.length,
        first_occurrence: window.start.toISOString(),
        last_occurrence: new Date(window.start.getTime() + 5 * 60 * 1000).toISOString(),
        frequency: `${window.errors.length} errors across ${sources.length} sources in 5 minutes`,
        affected_sources: sources,
        affected_types: types,
        sample_errors: window.errors.slice(0, 3).map(e => e.id),
        severity: "critical",
        recommended_action: "Check shared dependencies (network, database, authentication)",
      });
    }

    // Sort patterns by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    patterns.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const criticalCount = patterns.filter(p => p.severity === "critical").length;

    // Generate trend summary
    let trendSummary = `Analyzed ${errorList.length} errors from last 24 hours. `;
    if (patterns.length === 0) {
      trendSummary += "No significant patterns detected.";
    } else {
      trendSummary += `Found ${patterns.length} patterns: ${criticalCount} critical, ${patterns.filter(p => p.severity === "high").length} high priority.`;
      if (criticalCount > 0) {
        trendSummary += " Immediate attention required.";
      }
    }

    const report: PatternReport = {
      timestamp: new Date().toISOString(),
      analysis_period: "24 hours",
      patterns_detected: patterns.length,
      critical_patterns: criticalCount,
      patterns,
      trend_summary: trendSummary,
    };

    // Store critical patterns as insights
    for (const pattern of patterns.filter(p => p.severity === "critical")) {
      await supabase.from("proactive_insights").upsert({
        insight_type: "error_pattern",
        priority: "critical",
        title: `Error Pattern: ${pattern.pattern_type} - ${pattern.description}`,
        content: `${pattern.error_count} errors detected. ${pattern.recommended_action}`,
        action_items: [pattern.recommended_action, `Review sample errors: ${pattern.sample_errors.join(", ")}`],
        affected_entities: { sources: pattern.affected_sources, types: pattern.affected_types },
        source_agent: "error_pattern_analyzer",
        dedup_key: `pattern_${pattern.pattern_id}`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "dedup_key", ignoreDuplicates: true });
    }

    const duration = Date.now() - startTime;
    console.log(`[Error Pattern Analyzer] Complete in ${duration}ms - Found ${patterns.length} patterns`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[Error Pattern Analyzer] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
