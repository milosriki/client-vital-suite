import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";

serve(async (req) => {
  try { verifyAuth(req); } catch { throw new UnauthorizedError(); }
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { since_minutes = 60 } = await req.json().catch(() => ({}));
    const sinceTime = new Date(Date.now() - since_minutes * 60 * 1000).toISOString();

    // Get recent calls
    const { data: recentCalls, error: callsError } = await supabase
      .from("call_records")
      .select("*")
      .gte("started_at", sinceTime);

    if (callsError) throw new Error(`Failed to fetch calls: ${callsError.message}`);
    if (!recentCalls || recentCalls.length === 0) {
      return apiSuccess({ message: "No recent calls to process", actions: [] });
    }

    const actions: string[] = [];

    // Action 1: Flag 3+ missed calls as "No Contact" in lost_leads
    const missedByNumber: Record<string, number> = {};
    for (const call of recentCalls) {
      if (call.call_status === "missed" && call.caller_number && call.caller_number !== "unknown") {
        missedByNumber[call.caller_number] = (missedByNumber[call.caller_number] || 0) + 1;
      }
    }

    for (const [phone, count] of Object.entries(missedByNumber)) {
      if (count >= 3) {
        // Check if already in lost_leads
        const { data: existing } = await supabase
          .from("lost_leads")
          .select("id")
          .eq("caller_number", phone)
          .eq("status", "new")
          .single();

        if (!existing) {
          const { error: insertErr } = await supabase
            .from("lost_leads")
            .insert({
              caller_number: phone,
              reason: "No Contact - 3+ missed calls",
              status: "new",
              missed_count: count,
              first_missed_at: sinceTime,
              last_missed_at: new Date().toISOString(),
            });
          if (!insertErr) actions.push(`Flagged ${phone} as No Contact (${count} missed)`);
        }
      }
    }

    // Action 2: Mark quality calls (completed, > 5 min)
    for (const call of recentCalls) {
      if (
        call.call_status === "completed" &&
        call.duration_seconds > 300 &&
        !call.call_score
      ) {
        const { error: updateErr } = await supabase
          .from("call_records")
          .update({ call_score: 80, lead_quality: "quality_call" })
          .eq("id", call.id);
        if (!updateErr) actions.push(`Marked call ${call.provider_call_id} as quality call`);
      }
    }

    // Action 3: Flag interested calls without deals
    for (const call of recentCalls) {
      if (call.ptd_outcome === "Interested" || call.ptd_outcome === "Assessment Booked") {
        // Check if a deal exists for this contact
        const { data: existingDeal } = await supabase
          .from("deals")
          .select("id")
          .eq("phone", call.caller_number)
          .limit(1)
          .single();

        if (!existingDeal && call.caller_number !== "unknown") {
          // Create a note/flag for follow-up
          const { error: noteErr } = await supabase
            .from("call_records")
            .update({
              ai_summary: `${call.ai_summary || ''} [AUTO] Interested call - no deal found. Follow up required.`.trim(),
              lead_quality: "hot",
            })
            .eq("id", call.id);
          if (!noteErr) actions.push(`Flagged interested call ${call.provider_call_id} - no deal found`);
        }
      }
    }

    return apiSuccess({
      message: `Processed ${recentCalls.length} calls`,
      actions,
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    return apiError("INTERNAL_ERROR", error instanceof Error ? error.message : "Unknown error", 500);
  }
});
