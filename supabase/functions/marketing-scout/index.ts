import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";

/**
 * Marketing Scout Agent 🔍
 *
 * Job: Data collection and anomaly detection.
 * Runs: Daily at 05:00 UAE (after data refresh)
 *
 * Reads: revenue_genome_7d view, facebook_ads_insights (for trend data)
 * Writes: marketing_agent_signals
 *
 * Guardrail: Can only READ source data and INSERT signals.
 * Cannot modify budgets, pause ads, or call Meta API.
 */

interface ScoutSignal {
  signal_type: "fatigue" | "ghost_spike" | "new_winner" | "spend_anomaly";
  ad_id: string;
  ad_name: string | null;
  campaign_name: string | null;
  severity: "info" | "warning" | "critical" | "opportunity";
  evidence: Record<string, number>;
  agent_name: "scout";
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

    const signals: ScoutSignal[] = [];

    // 1. Pull 7-day revenue genome data
    const { data: genome, error: genomeErr } = await supabase
      .from("revenue_genome_7d")
      .select("*");

    if (genomeErr) {
      console.warn(
        "[scout] revenue_genome_7d not available, falling back to direct query",
      );
    }

    // 2. Detect creative fatigue (CTR declining 3+ days)
    const { data: dailyCtr } = await supabase
      .from("facebook_ads_insights")
      .select("ad_id, ad_name, campaign_name, ctr, date")
      .gte(
        "date",
        new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0],
      )
      .order("date", { ascending: true });

    // Group by ad_id and check for 3-day CTR decline
    const adDailyData: Record<
      string,
      {
        ad_name: string;
        campaign_name: string;
        daily: { date: string; ctr: number }[];
      }
    > = {};

    (dailyCtr || []).forEach((row: Record<string, unknown>) => {
      const adId = String(row.ad_id);
      if (!adDailyData[adId]) {
        adDailyData[adId] = {
          ad_name: String(row.ad_name || ""),
          campaign_name: String(row.campaign_name || ""),
          daily: [],
        };
      }
      adDailyData[adId].daily.push({
        date: String(row.date),
        ctr: Number(row.ctr) || 0,
      });
    });

    for (const [adId, data] of Object.entries(adDailyData)) {
      const sorted = data.daily.sort((a, b) => a.date.localeCompare(b.date));

      // Check last 3 days for declining CTR
      if (sorted.length >= 3) {
        const last3 = sorted.slice(-3);
        const declining =
          last3[0].ctr > last3[1].ctr && last3[1].ctr > last3[2].ctr;

        if (declining) {
          const dropPct = ((last3[0].ctr - last3[2].ctr) / last3[0].ctr) * 100;
          if (dropPct > 15) {
            signals.push({
              signal_type: "fatigue",
              ad_id: adId,
              ad_name: data.ad_name,
              campaign_name: data.campaign_name,
              severity: dropPct > 40 ? "critical" : "warning",
              evidence: {
                ctr_day1: last3[0].ctr,
                ctr_day2: last3[1].ctr,
                ctr_day3: last3[2].ctr,
                drop_pct: Math.round(dropPct * 100) / 100,
              },
              agent_name: "scout",
            });
          }
        }
      }
    }

    // 3. Detect ghost rate spikes (from genome view)
    if (genome) {
      for (const row of genome) {
        // High ghost rate
        if (Number(row.ghost_rate_pct) > 50 && Number(row.leads_7d) >= 3) {
          signals.push({
            signal_type: "ghost_spike",
            ad_id: String(row.ad_id),
            ad_name: row.ad_name,
            campaign_name: row.campaign_name,
            severity: Number(row.ghost_rate_pct) > 70 ? "critical" : "warning",
            evidence: {
              ghost_rate: Number(row.ghost_rate_pct),
              leads: Number(row.leads_7d),
              assessments: Number(row.assessments_7d),
              ghosts: Number(row.ghosts_7d),
            },
            agent_name: "scout",
          });
        }

        // New winner detection (ROAS > 3x, show rate > 50%)
        if (
          Number(row.roas_7d) > 3 &&
          Number(row.show_rate_pct) > 50 &&
          Number(row.paid_clients_7d) >= 2
        ) {
          signals.push({
            signal_type: "new_winner",
            ad_id: String(row.ad_id),
            ad_name: row.ad_name,
            campaign_name: row.campaign_name,
            severity: "opportunity",
            evidence: {
              roas_7d: Number(row.roas_7d),
              show_rate: Number(row.show_rate_pct),
              revenue: Number(row.revenue_7d),
              health_avg: Number(row.avg_health_7d),
              paid_clients: Number(row.paid_clients_7d),
            },
            agent_name: "scout",
          });
        }

        // Spend anomaly (spending > AED 500/day with ROAS < 1)
        if (Number(row.spend_7d) > 3500 && Number(row.roas_7d) < 1) {
          signals.push({
            signal_type: "spend_anomaly",
            ad_id: String(row.ad_id),
            ad_name: row.ad_name,
            campaign_name: row.campaign_name,
            severity: "critical",
            evidence: {
              spend_7d: Number(row.spend_7d),
              roas_7d: Number(row.roas_7d),
              revenue_7d: Number(row.revenue_7d),
              daily_avg_spend: Math.round(Number(row.spend_7d) / 7),
            },
            agent_name: "scout",
          });
        }
      }
    }

    // 4. Insert signals
    if (signals.length > 0) {
      const { error: insertErr } = await supabase
        .from("marketing_agent_signals")
        .insert(signals);

      if (insertErr) {
        console.error("[scout] Failed to insert signals:", insertErr);
      }
    }

    structuredLog("marketing-scout", "info", "Scout run complete", {
      total_signals: signals.length,
      fatigue: signals.filter((s) => s.signal_type === "fatigue").length,
      ghost_spikes: signals.filter((s) => s.signal_type === "ghost_spike")
        .length,
      winners: signals.filter((s) => s.signal_type === "new_winner").length,
      spend_anomalies: signals.filter((s) => s.signal_type === "spend_anomaly")
        .length,
    });

    return apiSuccess({
      success: true,
      signals_generated: signals.length,
      breakdown: {
        fatigue: signals.filter((s) => s.signal_type === "fatigue").length,
        ghost_spikes: signals.filter((s) => s.signal_type === "ghost_spike")
          .length,
        new_winners: signals.filter((s) => s.signal_type === "new_winner")
          .length,
        spend_anomalies: signals.filter(
          (s) => s.signal_type === "spend_anomaly",
        ).length,
      },
      signals,
    });
  } catch (error: unknown) {
    return handleError(error, "marketing-scout", {
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
    functionName: "marketing-scout",
    runType: "chain",
    tags: ["marketing", "agent", "scout"],
  }),
);
