import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";

/**
 * Marketing Analyst Agent 📊
 *
 * Job: Cross-source intelligence — connects Scout signals + Revenue Genome
 *      to produce SCALE/HOLD/WATCH/KILL/REFRESH recommendations.
 * Runs: Daily at 05:15 UAE (after Scout)
 *
 * Reads: marketing_agent_signals (today's), revenue_genome_7d
 * Writes: marketing_recommendations
 *
 * Guardrail: Can only INSERT recommendations. Cannot execute them.
 * CEO must approve before any action is taken.
 */

interface AnalystRecommendation {
  ad_id: string;
  ad_name: string | null;
  action: "SCALE" | "HOLD" | "WATCH" | "KILL" | "REFRESH";
  confidence: number;
  reasoning: string;
  metrics: {
    roas_7d: number;
    show_rate: number;
    ghost_rate: number;
    health_avg: number;
    spend_7d: number;
    revenue_7d: number;
  };
  signal_id: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  try {
    verifyAuth(req);
  } catch {
    throw new UnauthorizedError();
  }
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const recommendations: AnalystRecommendation[] = [];
    const today = new Date().toISOString().split("T")[0];

    // 1. Get today's scout signals
    const { data: signals } = await supabase
      .from("marketing_agent_signals")
      .select("id, ad_id, signal_type, created_at")
      .gte("created_at", `${today}T00:00:00`)
      .eq("processed", false);

    // 2. Get revenue genome data
    const { data: genome } = await supabase
      .from("revenue_genome_7d")
      .select("*");

    if (!genome || genome.length === 0) {
      return apiSuccess({
        success: true,
        message: "No genome data available for analysis",
        recommendations_generated: 0,
      });
    }

    // 3. Apply decision rules (7-day sales cycle)
    for (const row of genome) {
      const roas = Number(row.roas_7d) || 0;
      const showRate = Number(row.show_rate_pct) || 0;
      const ghostRate = Number(row.ghost_rate_pct) || 0;
      const healthAvg = Number(row.avg_health_7d) || 0;
      const spend = Number(row.spend_7d) || 0;
      const revenue = Number(row.revenue_7d) || 0;
      const leads = Number(row.leads_7d) || 0;

      // Find any scout signals for this ad
      const adSignals = (signals || []).filter(
        (s: Record<string, unknown>) => String(s.ad_id) === String(row.ad_id),
      );
      const hasFatigue = adSignals.some(
        (s: Record<string, unknown>) => s.signal_type === "fatigue",
      );
      const topSignal = adSignals[0];

      const metrics = {
        roas_7d: Math.round(roas * 100) / 100,
        show_rate: Math.round(showRate * 10) / 10,
        ghost_rate: Math.round(ghostRate * 10) / 10,
        health_avg: Math.round(healthAvg),
        spend_7d: Math.round(spend),
        revenue_7d: Math.round(revenue),
      };

      // Skip creatives with insufficient data (< 3 days or < 3 leads)
      if (leads < 3 && spend < 500) {
        recommendations.push({
          ad_id: String(row.ad_id),
          ad_name: row.ad_name,
          action: "HOLD",
          confidence: 50,
          reasoning:
            "Insufficient data (< 3 leads, < AED 500 spend). Protecting new creative.",
          metrics,
          signal_id: topSignal ? String(topSignal.id) : null,
        });
        continue;
      }

      // Decision tree (from implementation plan)
      if (hasFatigue) {
        recommendations.push({
          ad_id: String(row.ad_id),
          ad_name: row.ad_name,
          action: "REFRESH",
          confidence: 75,
          reasoning: `Creative fatigue detected: CTR declining 3+ consecutive days. ${roas > 2 ? "Still profitable — refresh copy before killing." : "Low ROAS compounds the urgency."}`,
          metrics,
          signal_id: topSignal ? String(topSignal.id) : null,
        });
      } else if (roas >= 3 && showRate >= 50) {
        recommendations.push({
          ad_id: String(row.ad_id),
          ad_name: row.ad_name,
          action: "SCALE",
          confidence: 90,
          reasoning: `Strong performer: ${roas.toFixed(1)}x ROAS with ${showRate.toFixed(0)}% show rate. Health avg: ${healthAvg.toFixed(0)}. Safe to increase budget 20%.`,
          metrics,
          signal_id: topSignal ? String(topSignal.id) : null,
        });
      } else if (roas >= 2 && showRate >= 40) {
        recommendations.push({
          ad_id: String(row.ad_id),
          ad_name: row.ad_name,
          action: "HOLD",
          confidence: 70,
          reasoning: `Decent performer: ${roas.toFixed(1)}x ROAS, ${showRate.toFixed(0)}% show rate. Hold budget, monitor for improvement.`,
          metrics,
          signal_id: topSignal ? String(topSignal.id) : null,
        });
      } else if (roas >= 1.5 || (showRate < 40 && roas >= 1)) {
        recommendations.push({
          ad_id: String(row.ad_id),
          ad_name: row.ad_name,
          action: "WATCH",
          confidence: 60,
          reasoning: `Borderline: ${roas.toFixed(1)}x ROAS, ${showRate.toFixed(0)}% show rate. Ghost rate: ${ghostRate.toFixed(0)}%. Review in 2 days.`,
          metrics,
          signal_id: topSignal ? String(topSignal.id) : null,
        });
      } else {
        recommendations.push({
          ad_id: String(row.ad_id),
          ad_name: row.ad_name,
          action: "KILL",
          confidence: 85,
          reasoning: `Underperformer: ${roas.toFixed(1)}x ROAS${ghostRate > 60 ? `, ${ghostRate.toFixed(0)}% ghost rate` : ""}. Recommend pausing immediately.`,
          metrics,
          signal_id: topSignal ? String(topSignal.id) : null,
        });
      }
    }

    // 4. Validate + upsert recommendations
    const validRecs = recommendations.filter((r) => {
      if (!r.action || !["SCALE", "HOLD", "WATCH", "KILL", "REFRESH"].includes(r.action)) {
        console.warn("[Analyst] Dropping rec: invalid action", r.action);
        return false;
      }
      if (typeof r.confidence !== "number" || r.confidence < 0 || r.confidence > 100) {
        console.warn("[Analyst] Dropping rec: invalid confidence", r.confidence);
        return false;
      }
      if (!r.ad_id) {
        console.warn("[Analyst] Dropping rec: missing ad_id");
        return false;
      }
      return true;
    });

    if (validRecs.length > 0) {
      const { error: insertErr } = await supabase
        .from("marketing_recommendations")
        .upsert(
          validRecs.map((r) => ({
            ...r,
            status: "pending",
          })),
          { onConflict: "ad_id, action" },
        );

      if (insertErr) {
        console.error("[analyst] Failed to upsert recommendations:", insertErr);
      }
    }

    // 5. Mark Scout signals as processed
    if (signals && signals.length > 0) {
      const signalIds = signals.map((s: Record<string, unknown>) =>
        String(s.id),
      );
      await supabase
        .from("marketing_agent_signals")
        .update({ processed: true })
        .in("id", signalIds);
    }

    const actionCounts = {
      SCALE: recommendations.filter((r) => r.action === "SCALE").length,
      HOLD: recommendations.filter((r) => r.action === "HOLD").length,
      WATCH: recommendations.filter((r) => r.action === "WATCH").length,
      KILL: recommendations.filter((r) => r.action === "KILL").length,
      REFRESH: recommendations.filter((r) => r.action === "REFRESH").length,
    };

    structuredLog("marketing-analyst", "info", "Analyst run complete", {
      total_recommendations: recommendations.length,
      ...actionCounts,
    });

    return apiSuccess({
      success: true,
      recommendations_generated: recommendations.length,
      breakdown: actionCounts,
      recommendations,
    });
  } catch (error: unknown) {
    return handleError(error, "marketing-analyst", {
      supabase: createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ),
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  }
};

serve(
  withTracing(handler, {
    functionName: "marketing-analyst",
    runType: "chain",
    tags: ["marketing", "agent", "analyst"],
  }),
);
