/// <reference lib="deno.ns" />
import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildAgentPrompt } from "../_shared/unified-prompts.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import {
  handleError,
  ErrorCode,
  corsHeaders,
  logError,
} from "../_shared/error-handler.ts";

// Note: LangSmith/LangGraph not used in Deno edge functions - use direct AI calls instead

// This Agent answers: "How is my business actually doing today?"
serve(async (req) => {
  try {
    verifyAuth(req);
  } catch (e) {
    return new Response("Unauthorized", { status: 401 });
  } // Security Hardening
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 0. CHECK FOR STALE DATA (Task 9 requirement)
    const { data: lastSuccessSync } = await supabase
      .from("sync_logs")
      .select("started_at")
      .eq("status", "success")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const hoursSinceLastSync = lastSuccessSync
      ? (Date.now() - new Date(lastSuccessSync.started_at).getTime()) /
        (1000 * 60 * 60)
      : 999;

    const dataIsStale = hoursSinceLastSync > 24;
    const staleWarning = dataIsStale
      ? `⚠️ CRITICAL WARNING: Data is ${Math.round(hoursSinceLastSync)}h stale! Last sync: ${lastSuccessSync?.started_at || "Never"}. Analysis may be inaccurate.`
      : null;

    // 1. GET THE HARD DATA (The "Sensors")
    const today = new Date().toISOString().split("T")[0];

    // A. Operational: Utilization (Sessions Delivered / Capacity)
    const { data: opsData, error: opsError } = await supabase
      .from("coach_performance")
      .select("total_clients, coach_name")
      .limit(100);

    if (opsError) {
      await logError(
        supabase,
        "supabase",
        "query_error",
        "Failed to fetch coach_performance",
        { error: opsError },
      );
    }

    // B. Growth: Leads & Follow-ups
    const { data: leadData, error: leadError } = await supabase
      .from("leads")
      .select("id, status, created_at")
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      );

    if (leadError) {
      await logError(
        supabase,
        "supabase",
        "query_error",
        "Failed to fetch leads",
        { error: leadError },
      );
    }

    // C. System Health: Check sync_errors table
    const { data: recentErrors } = await supabase
      .from("sync_errors")
      .select("platform, error_message, severity, created_at")
      .eq("resolved", false)
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      )
      .order("created_at", { ascending: false })
      .limit(10);

    // D. Real-Time Financials: Payments from Stripe (Real Source of Truth)
    const { data: stripeRevenueData, error: stripeError } = await supabase
      .from("stripe_transactions")
      .select("amount, status, created_at")
      .eq("status", "succeeded")
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      );

    if (stripeError) {
      await logError(
        supabase,
        "stripe",
        "query_error",
        "Failed to fetch stripe_transactions",
        { error: stripeError },
      );
    }

    // 2. CALCULATE METRICS
    const totalClients =
      opsData?.reduce((sum, t) => sum + (t.total_clients || 0), 0) || 0;
    const activeTrainers = new Set(opsData?.map((t) => t.coach_name)).size || 1;
    const THEORETICAL_CAPACITY = activeTrainers * 20;
    const utilizationRate = Math.round(
      (totalClients / THEORETICAL_CAPACITY) * 100,
    );

    const newLeads = leadData?.length || 0;
    const missedFollowUps =
      leadData?.filter((l) => l.status === "NEW").length || 0;

    const criticalErrors =
      recentErrors?.filter((e) => e.severity === "critical").length || 0;
    const highErrors =
      recentErrors?.filter((e) => e.severity === "high").length || 0;

    // E. Crisis Metrics (Task 11 Fix)
    const { count: criticalPending } = await supabase
      .from("intervention_log")
      .select("*", { count: "exact", head: true })
      .eq("priority", "CRITICAL")
      .eq("status", "PENDING");

    const { count: unassignedAtRisk } = await supabase
      .from("client_health_scores")
      .select("*", { count: "exact", head: true })
      .in("health_zone", ["RED", "YELLOW"])
      .is("assigned_coach", null);

    const stripeRevenueToday =
      stripeRevenueData?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
    // HubSpot revenue removed to rely on Stripe as single source of truth

    // 3. THE "BRAIN" (AI Analysis)
    const basePrompt = buildAgentPrompt("BUSINESS_INTELLIGENCE", {
      includeROI: true,
      outputFormat: "EXECUTIVE_SUMMARY",
    });

    const prompt = `${basePrompt}

${staleWarning ? `\n${staleWarning}\n` : ""}

DATA CONTEXT:
- Utilization: ${utilizationRate}% (${totalClients} active clients managed by ${activeTrainers} coaches).
- Growth: ${newLeads} new leads. ${missedFollowUps} are potentially waiting for follow-up.
- Real-Time Revenue (Stripe): AED ${stripeRevenueToday.toLocaleString()} processed in last 24h.
- Real-Time Revenue (Stripe): AED ${stripeRevenueToday.toLocaleString()} processed in last 24h.

- System Health: ${criticalErrors} critical errors, ${highErrors} high-priority errors.

CRITICAL OPERATIONAL ALERTS (REQUIRES IMMEDIATE ACTION):
- ${criticalPending} PENDING CRITICAL INTERVENTIONS.
- ${unassignedAtRisk} At-Risk Clients (Red/Yellow) have NO COACH assigned.

RECENT SYSTEM ERRORS:
${JSON.stringify(recentErrors?.slice(0, 5) || [])}

OUTPUT FORMAT (JSON):
{
  "executive_summary": "A 3-sentence summary of the business health. Be direct. ${staleWarning ? "MENTION THE STALE DATA WARNING!" : ""}",
  "system_status": "${staleWarning ? "STALE DATA WARNING - " : ""}${criticalErrors + highErrors > 0 ? `${criticalErrors} critical, ${highErrors} high errors` : "Healthy"}",
  "data_freshness": "${dataIsStale ? "STALE" : "FRESH"}",
  "action_plan": ["Action 1", "Action 2", "Action 3"]
}`;

    // Call Unified AI Client
    let aiResponse;

    try {
      console.log("[BI Agent] Calling Unified AI for analysis...");

      const response = await unifiedAI.chat(
        [{ role: "user", content: prompt }],
        {
          max_tokens: 1000,
          jsonMode: true, // Request JSON output
        },
      );

      console.log(
        `[BI Agent] AI response received (Provider: ${response.provider})`,
      );
      const text = response.content;

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : text;
        aiResponse = JSON.parse(jsonString);
      } catch {
        aiResponse = {
          executive_summary: text.replace(/```json|```/g, "").trim(),
          system_status: "See summary",
          data_freshness: dataIsStale ? "STALE" : "FRESH",
          action_plan: ["Review full report"],
        };
      }
    } catch (e) {
      console.error("[BI Agent] AI Call failed", e);
      await logError(
        supabase,
        "unified_ai",
        "ai_failure",
        "Unified AI call failed",
        { error: String(e) },
      );
    }

    // Fallback if AI fails or no key
    if (!aiResponse) {
      aiResponse = {
        executive_summary: `${staleWarning ? "⚠️ STALE DATA WARNING. " : ""}Utilization is at ${utilizationRate}%. You have ${missedFollowUps} new leads to review. ${criticalErrors + highErrors > 0 ? `Alert: ${criticalErrors + highErrors} unresolved system errors.` : ""}`,
        system_status: dataIsStale
          ? "STALE DATA"
          : criticalErrors + highErrors > 0
            ? `${criticalErrors} critical, ${highErrors} high errors`
            : "All systems operational",
        data_freshness: dataIsStale ? "STALE" : "FRESH",
        action_plan: [
          dataIsStale ? "URGENT: Investigate why syncs are failing" : null,
          missedFollowUps > 0
            ? `Review ${missedFollowUps} new leads`
            : "Monitor lead flow",
          utilizationRate < 70
            ? "Focus on client acquisition"
            : "Maintain service quality",
          criticalErrors + highErrors > 0
            ? "Resolve system errors"
            : "Review weekly goals",
          (criticalPending || 0) > 0
            ? "URGENT: Action critical interventions"
            : null,
          (unassignedAtRisk || 0) > 100
            ? "URGENT: Assign coaches to at-risk clients"
            : null,
        ].filter(Boolean),
      };
    }

    // 4. SAVE TO DASHBOARD
    await supabase.from("daily_summary").upsert(
      {
        summary_date: today,
        executive_briefing: aiResponse.executive_summary,
        system_health_status: aiResponse.system_status,
        max_utilization_rate: utilizationRate,
        action_plan: aiResponse.action_plan,
      },
      { onConflict: "summary_date" },
    );

    // Log success
    await supabase.from("sync_logs").insert({
      platform: "business-intelligence",
      sync_type: "daily_analysis",
      status: "success",
      records_synced: 1,
      started_at: new Date().toISOString(),
    });

    console.log(
      `[BI Agent] Analysis complete. Data freshness: ${aiResponse.data_freshness}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        analysis: aiResponse,
        dataFreshness: aiResponse.data_freshness,
        staleWarning: staleWarning || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return handleError(error, "business-intelligence", {
      supabase,
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  }
});
