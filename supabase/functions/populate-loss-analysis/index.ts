import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// HubSpot stage → human-readable loss reason mapping
const LOSS_STAGE_REASONS: Record<string, string> = {
  "closedlost": "Closed Lost – did not convert after sales process",
  "closed_lost": "Closed Lost – did not convert after sales process",
  "lost": "Deal Lost – generic closed-lost stage",
  "1063991961": "Not Qualified – lead did not meet qualification criteria",
  "122237276": "Canceled – lead canceled or no follow-up possible",
  "1064059180": "On Hold / Call (AI Agent) – deal stalled in AI pipeline",
};

const LOSS_STAGES = Object.keys(LOSS_STAGE_REASONS);

const STAGE_NUMBERS: Record<string, number> = {
  "closedlost": -1,
  "closed_lost": -1,
  "lost": -1,
  "1063991961": -2,
  "122237276": 6,
  "1064059180": 0,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all closed-lost deals — using ALL known HubSpot lost stage codes
    const { data: lostDeals, error: dealsError } = await supabase
      .from("deals")
      .select("id, hubspot_deal_id, deal_name, stage, stage_label, pipeline, pipeline_name, amount, value_aed, owner_name, contact_id, close_date, created_at")
      .in("stage", LOSS_STAGES)
      .order("close_date", { ascending: false });

    if (dealsError) throw dealsError;

    if (!lostDeals || lostDeals.length === 0) {
      return new Response(
        JSON.stringify({ message: "No lost deals found with stages: " + LOSS_STAGES.join(", "), inserted: 0 }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch contacts for these deals
    const contactIds = [...new Set(lostDeals.map((d) => d.contact_id).filter(Boolean))];
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, email, first_name, last_name, assigned_coach, hubspot_contact_id, area, phone, attributed_campaign_id")
      .in("id", contactIds);

    const contactMap = new Map((contacts || []).map((c) => [c.id, c]));

    // Build loss_analysis entries matching the actual schema
    const entries = lostDeals.map((deal) => {
      const contact = contactMap.get(deal.contact_id);
      const email =
        contact?.email ||
        `deal-${deal.hubspot_deal_id || deal.id}@no-contact.local`;

      const stage = deal.stage || "unknown";
      const primaryReason = LOSS_STAGE_REASONS[stage] || `Lost at stage: ${stage}`;
      const stageNum = STAGE_NUMBERS[stage] ?? -1;

      // Determine lead source from pipeline
      let leadSource = "Sales";
      if (deal.pipeline === "729570995") leadSource = "AI Agent";
      else if (deal.pipeline === "657631654") leadSource = "Booking";

      // Amount in AED (value_aed preferred, fallback to amount)
      const amountAed = deal.value_aed || deal.amount || 0;

      return {
        contact_email: email,
        hubspot_contact_id: contact?.hubspot_contact_id || null,
        deal_id: deal.hubspot_deal_id || String(deal.id),
        last_stage_reached: deal.stage_label || stage,
        last_stage_number: stageNum,
        primary_loss_reason: primaryReason,
        secondary_loss_reason: null as string | null,
        reasoning: `Deal "${deal.deal_name || "Unknown"}" (pipeline: ${deal.pipeline_name || deal.pipeline || "default"}) lost at stage "${deal.stage_label || stage}". Value: AED ${amountAed}. Owner: ${deal.owner_name || "unassigned"}.`,
        evidence: {
          stage_code: stage,
          pipeline_id: deal.pipeline,
          amount_aed: amountAed,
          close_date: deal.close_date,
        },
        coach_name: contact?.assigned_coach || deal.owner_name || null,
        area: contact?.area || null,
        campaign_name: contact?.attributed_campaign_id || null,
        lead_source: leadSource,
        response_time_minutes: null as number | null,
        assessment_held: stage !== "1063991961" && stage !== "1064059180",
        confidence_pct: stage === "closedlost" || stage === "closed_lost" ? 90 : 70,
        analyzed_at: new Date().toISOString(),
      };
    });

    // Clear existing and insert fresh
    await supabase
      .from("loss_analysis")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    const { error: insertError } = await supabase
      .from("loss_analysis")
      .insert(entries);

    if (insertError) throw insertError;

    // Summary by reason
    const reasonCounts: Record<string, number> = {};
    for (const e of entries) {
      reasonCounts[e.primary_loss_reason] =
        (reasonCounts[e.primary_loss_reason] || 0) + 1;
    }

    return new Response(
      JSON.stringify({
        message: `Populated loss_analysis with ${entries.length} entries from ${lostDeals.length} lost deals`,
        inserted: entries.length,
        stages_queried: LOSS_STAGES,
        reason_breakdown: reasonCounts,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
