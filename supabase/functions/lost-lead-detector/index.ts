/**
 * Lost Lead Detector - Identifies missed/lost calls with no follow-up
 * Runs on schedule to populate lost_leads table
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { apiSuccess, apiError } from "../_shared/api-response.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface MissedCallGroup {
  caller_number: string;
  missed_count: number;
  last_missed_at: string;
  hubspot_owner_id: string | null;
}

function calculateLeadScore(
  missedCount: number,
  hoursSinceLastContact: number,
  lifecycleStage: string | null
): number {
  let score = 0;

  // More missed calls = higher urgency
  score += Math.min(missedCount * 15, 45);

  // Longer time without contact = higher urgency
  if (hoursSinceLastContact > 48) score += 30;
  else if (hoursSinceLastContact > 24) score += 20;
  else if (hoursSinceLastContact > 12) score += 10;

  // Lifecycle stage weight
  const stageWeights: Record<string, number> = {
    opportunity: 25,
    salesqualifiedlead: 20,
    marketingqualifiedlead: 15,
    lead: 10,
    subscriber: 5,
  };
  score += stageWeights[lifecycleStage?.toLowerCase() || ""] || 5;

  return Math.min(score, 100);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Find missed/lost calls in last 24h grouped by caller
    const { data: missedCalls, error: missedError } = await supabase
      .from("call_records")
      .select("caller_number, call_status, started_at, hubspot_owner_id")
      .in("call_status", ["missed", "no_answer", "busy"])
      .gte("started_at", twentyFourHoursAgo)
      .not("caller_number", "eq", "unknown");

    if (missedError) throw missedError;
    if (!missedCalls?.length) {
      return apiSuccess({ message: "No missed calls in last 24h", processed: 0 });
    }

    // Group by caller_number
    const grouped = new Map<string, MissedCallGroup>();
    for (const call of missedCalls) {
      const existing = grouped.get(call.caller_number);
      if (existing) {
        existing.missed_count++;
        if (call.started_at > existing.last_missed_at) {
          existing.last_missed_at = call.started_at;
        }
      } else {
        grouped.set(call.caller_number, {
          caller_number: call.caller_number,
          missed_count: 1,
          last_missed_at: call.started_at,
          hubspot_owner_id: call.hubspot_owner_id,
        });
      }
    }

    // Check which callers were never followed up (no completed call after the missed one)
    const lostLeads: Array<Record<string, unknown>> = [];

    for (const [number, group] of grouped) {
      // Check for any completed follow-up call
      const { data: followUp } = await supabase
        .from("call_records")
        .select("id")
        .eq("caller_number", number)
        .eq("call_status", "completed")
        .gte("started_at", group.last_missed_at)
        .limit(1);

      if (followUp?.length) continue; // Has follow-up, skip

      // Find contact for enrichment
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, lifecycle_stage, owner_name")
        .eq("phone", number)
        .limit(1)
        .maybeSingle();

      const hoursSince = (now.getTime() - new Date(group.last_missed_at).getTime()) / (1000 * 60 * 60);
      const leadScore = calculateLeadScore(group.missed_count, hoursSince, contact?.lifecycle_stage || null);

      lostLeads.push({
        caller_number: number,
        contact_id: contact?.id || null,
        missed_call_count: group.missed_count,
        last_missed_at: group.last_missed_at,
        lead_score: leadScore,
        lifecycle_stage: contact?.lifecycle_stage || null,
        assigned_owner: contact?.owner_name || group.hubspot_owner_id || null,
        status: "new",
        updated_at: now.toISOString(),
      });
    }

    if (!lostLeads.length) {
      return apiSuccess({ message: "All missed calls have follow-ups", processed: 0 });
    }

    // Upsert into lost_leads (update existing by caller_number)
    for (const lead of lostLeads) {
      const { data: existing } = await supabase
        .from("lost_leads")
        .select("id, status")
        .eq("caller_number", lead.caller_number)
        .eq("status", "new")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("lost_leads")
          .update({
            missed_call_count: lead.missed_call_count,
            last_missed_at: lead.last_missed_at,
            lead_score: lead.lead_score,
            updated_at: lead.updated_at,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("lost_leads").insert(lead);
      }
    }

    console.log(`Detected ${lostLeads.length} lost leads`);
    return apiSuccess({ message: `Detected ${lostLeads.length} lost leads`, processed: lostLeads.length });
  } catch (err) {
    console.error("Lost lead detector error:", err);
    return apiError(
      "INTERNAL_ERROR",
      String(err),
      crypto.randomUUID(),
      500
    );
  }
});
