import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";

/**
 * Funnel Stage Tracker Agent
 *
 * Skills applied:
 * - analytics-tracking: Decision-grade funnel metrics
 * - autonomous-agents: Single responsibility — ONLY computes stage-to-stage rates
 *
 * The 12-stage PTD funnel (from lead_lifecycle_view):
 *   1: Lead Created           (lifecycle_stage = 'lead')
 *   4: Assessment Booked      (deal.stage = '122237508')
 *   5: Assessment Completed   (deal.stage = '122237276')
 *   7: Booking Process        (deal.stage = '122221229')
 *   8: Package Selected       (deal.stage = 'qualifiedtobuy')
 *   9: Decision Maker         (deal.stage = 'decisionmakerboughtin')
 *  10: Payment Pending        (deal.stage = '2900542')
 *  11: Onboarding             (deal.stage = '987633705')
 *  12: Closed Won             (deal.stage = 'closedwon')
 *  -1: Closed Lost            (deal.stage = '1063991961')
 *  -2: On Hold                (deal.stage = '1064059180')
 *
 * Root cause owners per drop-off:
 *   Lead → Booked:    MARKETING (targeting quality)
 *   Booked → Held:    SALES (follow-up + reminders)
 *   Held → Deal:      COACH (assessment experience)
 *   Deal → Payment:   OPS (payment friction)
 *
 * Reads: contacts, deals, attribution_events
 * Writes: funnel_metrics
 * Cannot: Modify any data, only compute and store
 */

// Deal stage groupings
const BOOKED_STAGES = ["122237508"];
const HELD_STAGES = ["122237276"];
const DEAL_STAGES = ["122221229", "qualifiedtobuy", "decisionmakerboughtin"];
const PAYMENT_STAGES = ["2900542", "987633705"];
const WON_STAGE = "closedwon";
const LOST_STAGE = "1063991961";
const HOLD_STAGE = "1064059180";

// All stages from booked onward (a contact who reached closedwon also passed through booked, held, etc.)
const PROGRESSIVE_STAGES: Record<string, number> = {
  "122237508": 4,
  "122237276": 5,
  "122221229": 7,
  qualifiedtobuy: 8,
  decisionmakerboughtin: 9,
  "2900542": 10,
  "987633705": 11,
  closedwon: 12,
};

function stageReached(stage: string, minStage: number): boolean {
  return (PROGRESSIVE_STAGES[stage] || 0) >= minStage;
}

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
    const today = new Date().toISOString().split("T")[0];

    // ── Get contacts ──
    const { data: contacts } = await supabase
      .from("contacts")
      .select(
        "email, hubspot_contact_id, owner_name, lifecycle_stage, created_at",
      )
      .gte("created_at", cutoff);

    // ── Get all deals for these contacts ──
    const { data: allDeals } = await supabase
      .from("deals")
      .select("hubspot_contact_id, stage, deal_value, created_at, status")
      .gte("created_at", cutoff);

    // ── Get attribution for creative dimension ──
    const { data: attributions } = await supabase
      .from("attribution_events")
      .select("email, fb_ad_id, campaign")
      .gte("event_time", cutoff);

    // Build contact-to-deal mapping
    const contactDeals: Record<string, string> = {}; // hubspot_contact_id → highest stage
    for (const d of (allDeals || []) as Array<Record<string, unknown>>) {
      const cId = String(d.hubspot_contact_id || "");
      const stage = String(d.stage || "");
      const currentMax = contactDeals[cId];
      if (
        !currentMax ||
        (PROGRESSIVE_STAGES[stage] || 0) > (PROGRESSIVE_STAGES[currentMax] || 0)
      ) {
        contactDeals[cId] = stage;
      }
    }

    // Contact-to-attribution mapping
    const contactAttribution: Record<string, string> = {}; // email → fb_ad_id
    for (const a of (attributions || []) as Array<Record<string, unknown>>) {
      if (a.fb_ad_id) contactAttribution[String(a.email)] = String(a.fb_ad_id);
    }

    // ── Compute funnel for different dimensions ──
    type Dim = { type: string; value: string };
    const dimensionsToCompute: Dim[] = [{ type: "overall", value: "all" }];

    // Collect unique coaches
    const coaches = new Set(
      (contacts || []).map((c: Record<string, unknown>) =>
        String(c.owner_name || "unassigned"),
      ),
    );
    for (const coach of coaches) {
      if (coach !== "unassigned")
        dimensionsToCompute.push({ type: "coach", value: coach });
    }

    // Collect unique creatives (top 10 by volume)
    const creativeCounts: Record<string, number> = {};
    for (const email of Object.keys(contactAttribution)) {
      const creative = contactAttribution[email];
      creativeCounts[creative] = (creativeCounts[creative] || 0) + 1;
    }
    const topCreatives = Object.entries(creativeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);
    for (const creative of topCreatives) {
      dimensionsToCompute.push({ type: "creative", value: creative });
    }

    const results = [];

    for (const dim of dimensionsToCompute) {
      // Filter contacts for this dimension
      let filteredContacts = (contacts || []) as Array<Record<string, unknown>>;

      if (dim.type === "coach") {
        filteredContacts = filteredContacts.filter(
          (c) => String(c.owner_name) === dim.value,
        );
      } else if (dim.type === "creative") {
        filteredContacts = filteredContacts.filter(
          (c) => contactAttribution[String(c.email)] === dim.value,
        );
      }

      // Count stages
      const leadsCreated = filteredContacts.length;
      let assessmentsBooked = 0;
      let assessmentsHeld = 0;
      let dealsCreated = 0;
      let packagesSelected = 0;
      let paymentsPending = 0;
      let closedWon = 0;
      let closedLost = 0;
      let onHold = 0;

      for (const c of filteredContacts) {
        const contactId = String(c.hubspot_contact_id || "");
        const highestStage = contactDeals[contactId];
        if (!highestStage) continue;

        // If they reached closedwon, they also went through all prior stages
        if (stageReached(highestStage, 4)) assessmentsBooked++;
        if (stageReached(highestStage, 5)) assessmentsHeld++;
        if (stageReached(highestStage, 7)) dealsCreated++;
        if (stageReached(highestStage, 8)) packagesSelected++;
        if (stageReached(highestStage, 10)) paymentsPending++;
        if (highestStage === WON_STAGE) closedWon++;
        if (highestStage === LOST_STAGE) closedLost++;
        if (highestStage === HOLD_STAGE) onHold++;
      }

      // Conversion rates
      const leadToBooked =
        leadsCreated > 0 ? (assessmentsBooked / leadsCreated) * 100 : 0;
      const bookedToHeld =
        assessmentsBooked > 0 ? (assessmentsHeld / assessmentsBooked) * 100 : 0;
      const heldToDeal =
        assessmentsHeld > 0 ? (dealsCreated / assessmentsHeld) * 100 : 0;
      const dealToPayment =
        dealsCreated > 0 ? (paymentsPending / dealsCreated) * 100 : 0;
      const paymentToWon =
        paymentsPending > 0 ? (closedWon / paymentsPending) * 100 : 0;
      const overallRate =
        leadsCreated > 0 ? (closedWon / leadsCreated) * 100 : 0;

      // Health verdicts based on benchmarks
      const marketingHealth =
        leadToBooked >= 40
          ? "healthy"
          : leadToBooked >= 25
            ? "warning"
            : "critical";
      const salesHealth =
        bookedToHeld >= 65
          ? "healthy"
          : bookedToHeld >= 50
            ? "warning"
            : "critical";
      const coachHealth =
        heldToDeal >= 25
          ? "healthy"
          : heldToDeal >= 15
            ? "warning"
            : "critical";
      const opsHealth =
        dealToPayment >= 70
          ? "healthy"
          : dealToPayment >= 50
            ? "warning"
            : "critical";

      const record = {
        metric_date: today,
        dimension_type: dim.type,
        dimension_value: dim.value,
        leads_created: leadsCreated,
        assessments_booked: assessmentsBooked,
        assessments_held: assessmentsHeld,
        deals_created: dealsCreated,
        packages_selected: packagesSelected,
        payments_pending: paymentsPending,
        closed_won: closedWon,
        closed_lost: closedLost,
        on_hold: onHold,
        lead_to_booked_pct: Math.round(leadToBooked * 100) / 100,
        booked_to_held_pct: Math.round(bookedToHeld * 100) / 100,
        held_to_deal_pct: Math.round(heldToDeal * 100) / 100,
        deal_to_payment_pct: Math.round(dealToPayment * 100) / 100,
        payment_to_won_pct: Math.round(paymentToWon * 100) / 100,
        overall_lead_to_customer_pct: Math.round(overallRate * 100) / 100,
        marketing_health: marketingHealth,
        sales_health: salesHealth,
        coach_health: coachHealth,
        ops_health: opsHealth,
        computed_at: new Date().toISOString(),
      };

      results.push(record);
    }

    // ── Upsert all funnel metrics ──
    for (const r of results) {
      await supabase.from("funnel_metrics").upsert(r, {
        onConflict: "metric_date,dimension_type,dimension_value",
      });
    }

    // Log
    await supabase.from("sync_logs").insert({
      platform: "funnel_stage_tracker",
      sync_type: "funnel_metrics",
      status: "success",
      records_processed: results.length,
      message: `Funnel Tracker: Computed ${results.length} funnel metrics (${dimensionsToCompute.length} dimensions) over ${lookback_days}d`,
    });

    // Overall summary for response
    const overall = results.find((r) => r.dimension_type === "overall");

    return apiSuccess({
      success: true,
      dimensions_computed: results.length,
      lookback_days,
      overall_funnel: overall
        ? {
            leads: overall.leads_created,
            booked: overall.assessments_booked,
            held: overall.assessments_held,
            deals: overall.deals_created,
            won: overall.closed_won,
            lost: overall.closed_lost,
            rates: {
              lead_to_booked: `${overall.lead_to_booked_pct}%`,
              booked_to_held: `${overall.booked_to_held_pct}%`,
              held_to_deal: `${overall.held_to_deal_pct}%`,
              deal_to_payment: `${overall.deal_to_payment_pct}%`,
              overall: `${overall.overall_lead_to_customer_pct}%`,
            },
            health: {
              marketing: overall.marketing_health,
              sales: overall.sales_health,
              coach: overall.coach_health,
              ops: overall.ops_health,
            },
          }
        : null,
    });
  } catch (error: unknown) {
    return handleError(error, "funnel-stage-tracker", {
      supabase: createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ),
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  }
});
