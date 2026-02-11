import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";

/**
 * Marketing Loss Analyst Agent
 *
 * Skills applied:
 * - autonomous-agents: Single responsibility — ONLY analyzes WHY leads were lost
 * - agent-evaluation: Evidence-based reasoning with confidence scores
 * - analytics-tracking: Multi-signal correlation, not single-factor attribution
 *
 * Reads: contacts, deals, call_records, attribution_events, client_health_scores,
 *        historical_baselines (coach close rates for comparison)
 * Writes: loss_analysis
 * Cannot: Modify budgets, reassign coaches, approve actions
 *
 * Loss reason categories:
 * - response_time: Lead contacted too late (>2hr = critical)
 * - coach_mismatch: Coach close rate significantly below team average
 * - lead_quality: Location/source indicators suggest low-quality lead
 * - ghost: Assessment booked but never attended
 * - timing: Assessment at low-conversion day/time
 * - unknown: Not enough signals to determine
 */

interface LossRecord {
  contact_email: string;
  hubspot_contact_id: string | null;
  deal_id: string | null;
  last_stage_reached: string;
  last_stage_number: number;
  fb_ad_id: string | null;
  campaign_name: string | null;
  lead_source: string | null;
  primary_loss_reason: string;
  secondary_loss_reason: string | null;
  confidence_pct: number;
  evidence: Record<string, unknown>;
  reasoning: string;
  coach_name: string | null;
  coach_close_rate: number | null;
  team_avg_close_rate: number | null;
  response_time_minutes: number | null;
  assessment_held: boolean;
  area: string | null;
}

// HubSpot deal stage → name mapping
const STAGE_NAMES: Record<string, string> = {
  "122178070": "New Lead",
  "122237508": "Assessment Booked",
  "122237276": "Assessment Completed",
  "122221229": "Booking Process",
  qualifiedtobuy: "Qualified to Buy",
  decisionmakerboughtin: "Decision Maker Bought In",
  contractsent: "Contract Sent",
  "2900542": "Payment Pending",
  "987633705": "Onboarding",
  closedwon: "Closed Won",
  "1063991961": "Closed Lost",
  "1064059180": "On Hold",
};

const STAGE_NUMBERS: Record<string, number> = {
  "122178070": 1,
  "122237508": 4,
  "122237276": 5,
  "122221229": 7,
  qualifiedtobuy: 8,
  decisionmakerboughtin: 9,
  "2900542": 10,
  "987633705": 11,
  closedwon: 12,
  "1063991961": -1,
  "1064059180": -2,
};

serve(async (req) => {
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

    const { lookback_days = 30 } = await req.json().catch(() => ({}));
    const cutoff = new Date(
      Date.now() - lookback_days * 86400000,
    ).toISOString();
    const losses: LossRecord[] = [];

    // ── Get lost deals ──
    const { data: lostDeals } = await supabase
      .from("deals")
      .select(
        "id, contact_id, stage, deal_value, created_at, updated_at, status",
      )
      .in("stage", ["1063991961", "1064059180"]) // Closed Lost or On Hold
      .gte("updated_at", cutoff);

    if (!lostDeals || lostDeals.length === 0) {
      return apiSuccess({
        success: true,
        losses_analyzed: 0,
        message: "No lost deals in period",
      });
    }

    // ── Get team baseline for comparison ──
    const { data: teamBaseline } = await supabase
      .from("historical_baselines")
      .select("avg_close_rate")
      .eq("dimension_type", "overall")
      .eq("dimension_value", "all")
      .eq("period_days", 30)
      .single();

    const teamAvgCloseRate = teamBaseline?.avg_close_rate || 25;

    // ── Get coach baselines ──
    const { data: coachBaselines } = await supabase
      .from("historical_baselines")
      .select("dimension_value, avg_close_rate")
      .eq("dimension_type", "coach")
      .eq("period_days", 30);

    const coachRates: Record<string, number> = {};
    for (const cb of (coachBaselines || []) as Array<Record<string, unknown>>) {
      coachRates[String(cb.dimension_value)] = Number(cb.avg_close_rate) || 0;
    }

    // ── Analyze each lost deal ──
    for (const deal of lostDeals as Array<Record<string, unknown>>) {
      const contactId = String(deal.contact_id || "");

      // Get contact details — deals.contact_id is a UUID FK to contacts.id
      const { data: contact } = await supabase
        .from("contacts")
        .select(
          "email, first_name, last_name, owner_name, lifecycle_stage, source, created_at, area, phone, hubspot_contact_id",
        )
        .eq("id", contactId)
        .single();

      if (!contact) continue;

      const email = String(contact.email || "");
      const coach = String(contact.owner_name || "unassigned");
      const coachCloseRate = coachRates[coach] || null;

      // Get attribution
      const { data: attribution } = await supabase
        .from("attribution_events")
        .select("fb_ad_id, campaign, source")
        .eq("email", email)
        .order("event_time", { ascending: false })
        .limit(1)
        .single();

      // Get call records for response time
      const { data: calls } = await supabase
        .from("call_records")
        .select("started_at, caller_number")
        .or(`caller_number.eq.${contact.phone},caller_number.eq.${email}`)
        .order("started_at", { ascending: true })
        .limit(1);

      let responseTimeMinutes: number | null = null;
      if (
        calls &&
        calls.length > 0 &&
        contact.created_at &&
        calls[0].started_at
      ) {
        const leadTime = new Date(String(contact.created_at)).getTime();
        const callTime = new Date(String(calls[0].started_at)).getTime();
        responseTimeMinutes = Math.round((callTime - leadTime) / 60000);
      }

      // Check if assessment was held
      const { data: assessmentDeals } = await supabase
        .from("deals")
        .select("stage")
        .eq("contact_id", contactId)
        .in("stage", ["122237276", "closedwon"]); // Completed or beyond

      const assessmentHeld = (assessmentDeals || []).length > 0;
      const dealStage = String(deal.stage);

      // ── Determine loss reasons ──
      const reasons: Array<{
        reason: string;
        confidence: number;
        evidence: Record<string, unknown>;
        reasoning: string;
      }> = [];

      // REASON 1: Response time
      if (responseTimeMinutes !== null) {
        if (responseTimeMinutes > 120) {
          reasons.push({
            reason: "response_time",
            confidence: 85,
            evidence: {
              response_time_minutes: responseTimeMinutes,
              threshold: 120,
            },
            reasoning: `Lead contacted after ${responseTimeMinutes} minutes. Leads contacted within 5 minutes close at ~34%, after 2+ hours at ~9%.`,
          });
        } else if (responseTimeMinutes > 30) {
          reasons.push({
            reason: "response_time",
            confidence: 60,
            evidence: {
              response_time_minutes: responseTimeMinutes,
              threshold: 30,
            },
            reasoning: `Lead contacted after ${responseTimeMinutes} minutes. Faster response improves conversion, optimal is <5min.`,
          });
        }
      } else {
        reasons.push({
          reason: "response_time",
          confidence: 70,
          evidence: { response_time_minutes: null, no_call_record: true },
          reasoning:
            "No call record found — lead may never have been contacted.",
        });
      }

      // REASON 2: Coach mismatch
      if (coachCloseRate !== null && coachCloseRate < teamAvgCloseRate * 0.7) {
        reasons.push({
          reason: "coach_mismatch",
          confidence: 75,
          evidence: {
            coach_name: coach,
            coach_close_rate: coachCloseRate,
            team_avg_close_rate: teamAvgCloseRate,
            differential_pct: Math.round(
              ((teamAvgCloseRate - coachCloseRate) / teamAvgCloseRate) * 100,
            ),
          },
          reasoning: `${coach} closes at ${coachCloseRate.toFixed(1)}% vs team average ${teamAvgCloseRate.toFixed(1)}%. Consider reassigning high-value leads to higher-closing coaches.`,
        });
      }

      // REASON 3: Ghost — booked but never held
      if (!assessmentHeld && (STAGE_NUMBERS[dealStage] || 0) >= 4) {
        reasons.push({
          reason: "ghost",
          confidence: 90,
          evidence: { assessment_booked: true, assessment_held: false },
          reasoning:
            "Assessment was booked but never attended. Check reminder cadence and follow-up process.",
        });
      }

      // REASON 4: Lead quality (location/source)
      const area = String(contact.area || "");
      const source = String(contact.source || attribution?.source || "");
      if (
        area &&
        (area.toLowerCase().includes("shared") ||
          area.toLowerCase().includes("studio"))
      ) {
        reasons.push({
          reason: "lead_quality",
          confidence: 65,
          evidence: { area, source, indicator: "shared_accommodation" },
          reasoning: `Lead from ${area} — shared accommodations typically have lower close rates due to space constraints for training.`,
        });
      }

      // REASON 5: Assessment held but didn't buy → coach experience issue
      if (assessmentHeld && dealStage === "1063991961") {
        reasons.push({
          reason: "coach_mismatch",
          confidence: 70,
          evidence: {
            assessment_held: true,
            closed_lost: true,
            coach_name: coach,
            stage_reached: "Assessment Completed",
          },
          reasoning: `Client attended assessment with ${coach} but didn't purchase. Assessment experience may not have matched expectations set by the ad creative.`,
        });
      }

      // Sort by confidence, pick top 2
      reasons.sort((a, b) => b.confidence - a.confidence);
      const primary = reasons[0] || {
        reason: "unknown",
        confidence: 30,
        evidence: {},
        reasoning: "Insufficient data to determine loss reason.",
      };
      const secondary = reasons[1] || null;

      losses.push({
        contact_email: email,
        hubspot_contact_id: contact?.hubspot_contact_id || contactId || null,
        deal_id: String(deal.id || ""),
        last_stage_reached: STAGE_NAMES[dealStage] || dealStage,
        last_stage_number: STAGE_NUMBERS[dealStage] || 0,
        fb_ad_id: String(attribution?.fb_ad_id || "") || null,
        campaign_name: String(attribution?.campaign || "") || null,
        lead_source: source || null,
        primary_loss_reason: primary.reason,
        secondary_loss_reason: secondary?.reason || null,
        confidence_pct: primary.confidence,
        evidence: {
          ...primary.evidence,
          all_factors: reasons.map((r) => ({
            reason: r.reason,
            confidence: r.confidence,
            summary: r.reasoning,
          })),
        },
        reasoning: primary.reasoning,
        coach_name: coach !== "unassigned" ? coach : null,
        coach_close_rate: coachCloseRate,
        team_avg_close_rate: teamAvgCloseRate,
        response_time_minutes: responseTimeMinutes,
        assessment_held: assessmentHeld,
        area: area || null,
      });
    }

    // ── Save to loss_analysis ──
    if (losses.length > 0) {
      const { error } = await supabase.from("loss_analysis").insert(losses);
      if (error) console.error("[Loss Analyst] Insert error:", error);
    }

    // Log
    await supabase.from("sync_logs").insert({
      platform: "marketing_loss_analyst",
      sync_type: "loss_analysis",
      status: "success",
      records_processed: losses.length,
      message: `Loss Analyst: Analyzed ${losses.length} lost deals. Reasons: ${[...new Set(losses.map((l) => l.primary_loss_reason))].join(", ")}`,
    });

    // Summary
    const reasonCounts: Record<string, number> = {};
    for (const l of losses) {
      reasonCounts[l.primary_loss_reason] =
        (reasonCounts[l.primary_loss_reason] || 0) + 1;
    }

    return apiSuccess({
      success: true,
      losses_analyzed: losses.length,
      lookback_days,
      reason_breakdown: reasonCounts,
      avg_confidence:
        losses.length > 0
          ? Math.round(
              losses.reduce((s, l) => s + l.confidence_pct, 0) / losses.length,
            )
          : 0,
    });
  } catch (error: unknown) {
    return handleError(error, "marketing-loss-analyst", {
      supabase: createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ),
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  }
});
