/**
 * Setter Performance - Daily aggregation of call data per setter
 * Stores snapshots in setter_daily_stats table
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { apiSuccess, apiError } from "../_shared/api-response.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse optional date param, default to today
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const targetDate = dateParam || new Date().toISOString().split("T")[0];
    const dayStart = `${targetDate}T00:00:00Z`;
    const dayEnd = `${targetDate}T23:59:59Z`;

    // Get all calls for the target date
    const { data: calls, error: callsError } = await supabase
      .from("call_records")
      .select("hubspot_owner_id, call_status, call_outcome, duration_seconds, appointment_set, started_at")
      .gte("started_at", dayStart)
      .lte("started_at", dayEnd);

    if (callsError) throw callsError;
    if (!calls?.length) {
      return apiSuccess({ message: "No calls for date", date: targetDate, processed: 0 });
    }

    // Get staff lookup for owner names
    const { data: staffList } = await supabase
      .from("staff")
      .select("hubspot_owner_id, full_name");

    const staffMap = new Map<string, string>();
    staffList?.forEach((s) => {
      if (s.hubspot_owner_id) staffMap.set(s.hubspot_owner_id, s.full_name || "Unknown");
    });

    // Group by hubspot_owner_id
    const ownerStats = new Map<string, {
      total: number;
      answered: number;
      missed: number;
      totalDuration: number;
      appointments: number;
    }>();

    for (const call of calls) {
      const ownerId = call.hubspot_owner_id || "unassigned";
      const stats = ownerStats.get(ownerId) || { total: 0, answered: 0, missed: 0, totalDuration: 0, appointments: 0 };

      stats.total++;
      if (call.call_status === "completed" || call.call_outcome === "answered") {
        stats.answered++;
        stats.totalDuration += call.duration_seconds || 0;
      } else {
        stats.missed++;
      }
      if (call.appointment_set) stats.appointments++;

      ownerStats.set(ownerId, stats);
    }

    // Get lost lead counts per owner
    const { data: lostLeads } = await supabase
      .from("lost_leads")
      .select("assigned_owner")
      .eq("status", "new");

    const lostCountMap = new Map<string, number>();
    lostLeads?.forEach((l) => {
      const owner = l.assigned_owner || "unassigned";
      lostCountMap.set(owner, (lostCountMap.get(owner) || 0) + 1);
    });

    // Upsert daily stats
    const records = Array.from(ownerStats.entries()).map(([ownerId, stats]) => ({
      hubspot_owner_id: ownerId === "unassigned" ? null : ownerId,
      owner_name: staffMap.get(ownerId) || ownerId,
      date: targetDate,
      total_calls: stats.total,
      answered_calls: stats.answered,
      missed_calls: stats.missed,
      avg_duration: stats.answered > 0 ? Math.round((stats.totalDuration / stats.answered) * 100) / 100 : 0,
      total_talk_time: stats.totalDuration,
      lost_lead_count: lostCountMap.get(ownerId) || 0,
      appointments_set: stats.appointments,
      conversion_rate: stats.answered > 0 ? Math.round((stats.appointments / stats.answered) * 10000) / 100 : 0,
    }));

    const { error: upsertError } = await supabase
      .from("setter_daily_stats")
      .upsert(records, { onConflict: "hubspot_owner_id,date" });

    if (upsertError) throw upsertError;

    console.log(`Setter performance: ${records.length} setters for ${targetDate}`);
    return apiSuccess({ date: targetDate, setters: records.length, records });
  } catch (err) {
    console.error("Setter performance error:", err);
    return apiError(
      "INTERNAL_ERROR",
      String(err),
      crypto.randomUUID(),
      500
    );
  }
});
