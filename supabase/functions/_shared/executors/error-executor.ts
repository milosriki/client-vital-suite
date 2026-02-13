import { ErrorService } from "../error-service.ts";

export async function executeErrorTools(
  supabase: any,
  toolName: string,
  input: any,
): Promise<string> {
  const service = new ErrorService(supabase);

  // 1. System Error Audit (Pattern Analysis)
  if (
    toolName === "system_error_audit" ||
    toolName === "analyze_error_patterns"
  ) {
    // Determine scope
    const days = input.days || 1;
    const { data: errors } = await supabase
      .from("sync_errors")
      .select("id, error_type, error_message, platform, object_type, object_id, operation, error_details, created_at, resolved_at")
      .gte(
        "created_at",
        new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
      );

    const patterns = service.detectPatterns(errors || []);

    // Auto-generate AI summary if critical (Using UnifiedAI inside service would vary,
    // but here we return JSON and let the Agent summarize it, OR we do it here)
    // The previous implementation in error-resolution-agent had the AI call.
    // Since we are running in shared context, we can replicate that or just return raw patterns.
    // The user wants the AGENT to audit, so returning raw patterns for the Agent to think about is good.

    return JSON.stringify({
      success: true,
      patterns_detected: patterns.length,
      patterns,
      analyzed_count: (errors || []).length,
    });
  }

  // 2. Triage Batch
  if (toolName === "triage_error_batch") {
    const { data: errors } = await supabase
      .from("sync_errors")
      .select("id, error_type, error_message, platform, object_type, object_id, operation, error_details, created_at, resolved_at")
      .is("resolved_at", null)
      .limit(input.limit || 50);

    const results = [];
    for (const error of errors || []) {
      const cat = service.categorizeError(error);
      const prio = service.calculatePriority(error, cat.category);

      // Update DB
      await supabase
        .from("sync_errors")
        .update({
          error_details: {
            ...error.error_details,
            triage: { ...cat, priority: prio },
          },
        })
        .eq("id", error.id);
      results.push({ id: error.id, ...cat, priority: prio });
    }
    return JSON.stringify({ success: true, triaged: results.length, results });
  }

  // 3. Resolve Batch
  if (toolName === "resolve_error_batch") {
    const { data: errors } = await supabase
      .from("sync_errors")
      .select("id, error_type, error_message, platform, object_type, object_id, operation, error_details, created_at, resolved_at")
      .is("resolved_at", null)
      .limit(input.limit || 50);

    const results = [];
    for (const error of errors || []) {
      const res = await service.attemptAutoResolve(error);
      if (res.resolved || res.action) {
        results.push({ id: error.id, ...res });
      }
    }
    return JSON.stringify({
      success: true,
      resolved: results.filter((r: any) => r.resolved).length,
      results,
    });
  }

  return `Tool ${toolName} not found in error executor.`;
}
