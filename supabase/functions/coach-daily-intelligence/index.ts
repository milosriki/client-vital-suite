import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface CoachDay {
  coach_name: string;
  sessions_scheduled: number;
  sessions_completed: number;
  sessions_cancelled: number;
  cancel_rate: number;
  completion_rate: number;
}

interface GPSPattern {
  coach_name: string;
  gps_verified: number;
  gps_mismatch: number;
  no_gps: number;
  ghost_session_count: number;
  verification_rate: number;
  late_arrival_count: number;
  early_departure_count: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const targetDate = new URL(req.url).searchParams.get("date") || 
    new Date().toISOString().split("T")[0];

  const results: string[] = [];

  try {
    // 1. Get session stats for the target date
    const { data: sessions } = await supabase
      .from("training_sessions_live")
      .select("coach_name, status, time_slot, training_date, location, client_name")
      .gte("training_date", `${targetDate}T00:00:00`)
      .lte("training_date", `${targetDate}T23:59:59`);

    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({ 
        date: targetDate, message: "No sessions found", results: [] 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Group by coach
    const byCoach: Record<string, typeof sessions> = {};
    for (const s of sessions) {
      if (!byCoach[s.coach_name]) byCoach[s.coach_name] = [];
      byCoach[s.coach_name].push(s);
    }

    // 2. Get GPS patterns (latest analysis)
    const { data: gpsPatterns } = await supabase
      .from("coach_gps_patterns")
      .select("coach_name, gps_verified, gps_mismatch, no_gps, ghost_session_count, verification_rate, late_arrival_count, early_departure_count")
      .eq("analysis_date", targetDate);

    const gpsMap: Record<string, GPSPattern> = {};
    for (const g of (gpsPatterns || [])) {
      gpsMap[g.coach_name.toLowerCase().trim()] = g;
    }

    // 3. Get name mappings for fuzzy match
    const { data: nameMaps } = await supabase
      .from("coach_name_map")
      .select("gps_name, session_name");

    const sessionToGPS: Record<string, string> = {};
    for (const m of (nameMaps || [])) {
      sessionToGPS[m.session_name.toLowerCase().trim()] = m.gps_name.toLowerCase().trim();
    }

    // 4. Build trust ledger entries
    const ledgerEntries = [];
    const alerts: Array<{coach: string; type: string; detail: string; severity: string}> = [];

    for (const [coach, coachSessions] of Object.entries(byCoach)) {
      const total = coachSessions.length;
      const completed = coachSessions.filter(s => s.status === "Completed").length;
      const cancelled = coachSessions.filter(s => (s.status || "").includes("Cancel")).length;
      const cancelRate = total > 0 ? (cancelled / total) * 100 : 0;
      const completionRate = total > 0 ? (completed / total) * 100 : 0;

      // Find GPS data (try exact match, then fuzzy)
      const coachKey = coach.toLowerCase().trim();
      const gpsKey = sessionToGPS[coachKey] || coachKey;
      const gps = gpsMap[gpsKey] || gpsMap[coachKey];

      const ghosts = gps?.ghost_session_count || 0;
      const verified = gps?.gps_verified || 0;
      const mismatch = gps?.gps_mismatch || 0;
      const noGps = gps?.no_gps || 0;
      const vfyRate = gps?.verification_rate || 0;
      const lateArrivals = gps?.late_arrival_count || 0;
      const earlyDepartures = gps?.early_departure_count || 0;

      // Trust score calculation (0-100)
      let trustScore = 100;
      trustScore -= ghosts * 10;          // -10 per ghost
      trustScore -= mismatch * 3;         // -3 per mismatch
      trustScore -= noGps * 2;            // -2 per no-GPS
      trustScore -= cancelled * 5;        // -5 per cancel
      trustScore += verified * 5;         // +5 per verified
      trustScore += completed * 2;        // +2 per completed
      trustScore = Math.max(0, Math.min(100, trustScore));

      const riskLevel = ghosts > 5 ? "critical" : ghosts > 2 ? "high" : 
        cancelRate > 30 ? "high" : cancelRate > 15 ? "medium" : "normal";

      // Generate anomalies
      const anomalies: string[] = [];
      if (ghosts > 0) anomalies.push(`${ghosts} ghost sessions`);
      if (cancelRate > 30) anomalies.push(`${cancelRate.toFixed(0)}% cancel rate`);
      if (noGps > total * 0.5) anomalies.push(`${noGps}/${total} sessions with no GPS`);
      if (lateArrivals > 0) anomalies.push(`${lateArrivals} late arrivals`);

      // Generate alerts
      if (ghosts >= 3) {
        alerts.push({ coach, type: "GHOST_SESSIONS", 
          detail: `${ghosts} ghost sessions detected — device inactive during booked sessions`, 
          severity: "critical" });
      }
      if (cancelRate > 40) {
        alerts.push({ coach, type: "HIGH_CANCELLATION",
          detail: `${cancelRate.toFixed(0)}% cancel rate (${cancelled}/${total} sessions)`,
          severity: "high" });
      }
      if (noGps === total && total > 2) {
        alerts.push({ coach, type: "GPS_DARK",
          detail: `Zero GPS data for ALL ${total} sessions — device may be disabled`,
          severity: "critical" });
      }

      // AI insights based on patterns
      const aiInsights: string[] = [];
      if (ghosts > 0 && cancelRate > 20) {
        aiInsights.push(`Combined ghost sessions (${ghosts}) and cancellations (${cancelRate.toFixed(0)}%) suggest potential attendance issues`);
      }
      if (verified > 0 && mismatch > verified * 3) {
        aiInsights.push(`Only ${verified} verified vs ${mismatch} mismatches — coach may be consistently at non-POI locations (home visits?)`);
      }
      if (completed > 5 && ghosts === 0 && cancelRate < 10) {
        aiInsights.push(`Strong performer: ${completed} completions, 0 ghosts, low cancellation`);
      }

      ledgerEntries.push({
        coach_name: coach,
        ledger_date: targetDate,
        sessions_scheduled: total,
        sessions_completed: completed,
        sessions_cancelled: cancelled,
        gps_verified: verified,
        gps_mismatch: mismatch,
        gps_no_data: noGps,
        ghost_sessions: ghosts,
        late_arrivals: lateArrivals,
        early_departures: earlyDepartures,
        trust_score: trustScore,
        risk_level: riskLevel,
        cancel_rate: cancelRate,
        completion_rate: completionRate,
        verification_rate: vfyRate,
        anomalies: JSON.stringify(anomalies),
        ai_insights: JSON.stringify(aiInsights),
      });
    }

    // 5. Upsert to trust ledger
    const { error: upsertError } = await supabase
      .from("coach_trust_ledger")
      .upsert(ledgerEntries, { onConflict: "coach_name,ledger_date" });

    if (upsertError) {
      results.push(`❌ Ledger upsert error: ${upsertError.message}`);
    } else {
      results.push(`✅ ${ledgerEntries.length} coach-days written to trust ledger`);
    }

    // 6. Build daily intelligence report
    const report = {
      date: targetDate,
      total_sessions: sessions.length,
      total_coaches: Object.keys(byCoach).length,
      completed: sessions.filter(s => s.status === "Completed").length,
      cancelled: sessions.filter(s => (s.status || "").includes("Cancel")).length,
      cancel_rate: (sessions.filter(s => (s.status || "").includes("Cancel")).length / sessions.length * 100).toFixed(1),
      alerts_critical: alerts.filter(a => a.severity === "critical").length,
      alerts_high: alerts.filter(a => a.severity === "high").length,
      fraud_suspects: ledgerEntries.filter(e => e.ghost_sessions > 5).map(e => ({
        coach: e.coach_name, ghosts: e.ghost_sessions, trust_score: e.trust_score
      })),
      high_risk: ledgerEntries.filter(e => e.risk_level === "high" || e.risk_level === "critical").map(e => ({
        coach: e.coach_name, ghosts: e.ghost_sessions, cancel_rate: e.cancel_rate.toFixed(0),
        trust_score: e.trust_score
      })),
      top_performers: ledgerEntries.filter(e => e.trust_score >= 80).map(e => ({
        coach: e.coach_name, completed: e.sessions_completed, trust: e.trust_score
      })),
      alerts,
      results,
    };

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
