import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Coach Daily Intelligence v2.0
 * 
 * FIXES from engineering audit:
 * 1. GPS data is per-day (only counts sessions ON target date, not cumulative)
 * 2. Trust score ignores 'mismatch' (PTD is home-visit — not-at-POI is NORMAL)
 * 3. Formula based on ghost_rate + cancel_rate (ratios, not raw counts)
 * 4. Name normalization via coach_name_map table
 * 5. Properly separates daily metrics from cumulative patterns
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const targetDate = new URL(req.url).searchParams.get("date") ||
    new Date().toISOString().split("T")[0];

  try {
    // 1. Get ALL sessions for the target date
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

    // 2. Get name mappings for normalization
    const { data: nameMaps } = await supabase
      .from("coach_name_map")
      .select("gps_name, session_name");

    // Build bidirectional normalize map: any variant → canonical name
    const normalizeMap: Record<string, string> = {};
    for (const m of (nameMaps || [])) {
      // Use session_name as canonical (since sessions are the business truth)
      const canonical = m.session_name.trim();
      normalizeMap[m.gps_name.toLowerCase().trim()] = canonical;
      normalizeMap[m.session_name.toLowerCase().trim()] = canonical;
    }

    function normalize(name: string): string {
      const key = name.toLowerCase().trim();
      return normalizeMap[key] || name.trim();
    }

    // 3. Group sessions by NORMALIZED coach name
    const byCoach: Record<string, typeof sessions> = {};
    for (const s of sessions) {
      const name = normalize(s.coach_name);
      if (!byCoach[name]) byCoach[name] = [];
      byCoach[name].push(s);
    }

    // 4. Get GPS data FOR THIS DAY ONLY
    //    We need raw location events + device data, not the cumulative patterns
    const { data: devices } = await supabase
      .from("mdm_devices")
      .select("tinymdm_device_id, coach_name, last_location_at, battery_level, is_online")
      .not("coach_name", "like", "SM-%");

    // Build coach → device IDs map (normalized)
    const coachDevices: Record<string, string[]> = {};
    for (const d of (devices || [])) {
      const name = normalize(d.coach_name);
      if (!coachDevices[name]) coachDevices[name] = [];
      coachDevices[name].push(d.tinymdm_device_id);
    }

    // Get GPS pings for target date
    const { data: pings } = await supabase
      .from("mdm_location_events")
      .select("device_id, recorded_at, lat, lng")
      .gte("recorded_at", `${targetDate}T00:00:00`)
      .lte("recorded_at", `${targetDate}T23:59:59`);

    // Group pings by device
    const pingsByDevice: Record<string, Array<{ recorded_at: string; lat: number; lng: number }>> = {};
    for (const p of (pings || [])) {
      if (!pingsByDevice[p.device_id]) pingsByDevice[p.device_id] = [];
      pingsByDevice[p.device_id].push(p);
    }

    // 5. For each coach, count daily GPS metrics
    const ledgerEntries = [];
    const alerts: Array<{ coach: string; type: string; detail: string; severity: string }> = [];

    for (const [coach, coachSessions] of Object.entries(byCoach)) {
      const total = coachSessions.length;
      const completed = coachSessions.filter(s => s.status === "Completed").length;
      const cancelled = coachSessions.filter(s => (s.status || "").includes("Cancel")).length;
      const cancelRate = total > 0 ? (cancelled / total) * 100 : 0;
      const completionRate = total > 0 ? (completed / total) * 100 : 0;

      // Get this coach's pings for the day
      const deviceIds = coachDevices[coach] || [];
      const coachPings: Array<{ recorded_at: string; lat: number; lng: number }> = [];
      for (const devId of deviceIds) {
        coachPings.push(...(pingsByDevice[devId] || []));
      }

      // Count per-session GPS status (DAILY, not cumulative)
      let dailyVerified = 0;
      let dailyNoGps = 0;
      let dailyGhost = 0;
      let dailyActive = 0; // GPS active but not at POI — NORMAL for home visits

      // CRITICAL: Check if coach had ANY GPS pings today
      // If zero pings all day → infrastructure issue (no_data), NOT ghost
      // Ghost = device was ON that day but no pings near session window
      const coachHadGpsToday = coachPings.length > 0;

      for (const session of coachSessions) {
        // Parse session time window
        const timeSlot = session.time_slot || "";
        const trainingDate = session.training_date || "";

        // Build session window (±30min)
        let sessionStart: Date | null = null;
        let sessionEnd: Date | null = null;

        if (timeSlot && trainingDate) {
          const dateStr = trainingDate.split("T")[0];
          const timeMatch = timeSlot.match(/^(\d{2}):(\d{2})/);
          if (timeMatch) {
            // time_slot is in Dubai time (UTC+4), training_date is in UTC
            const h = parseInt(timeMatch[1]);
            const m = parseInt(timeMatch[2]);
            sessionStart = new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
            // Adjust from Dubai to UTC: subtract 4 hours
            sessionStart = new Date(sessionStart.getTime() - 4 * 3600000);
            sessionEnd = new Date(sessionStart.getTime() + 60 * 60000); // 60min session
          }
        }

        if (!sessionStart || !sessionEnd) {
          dailyNoGps++; // Can't verify without time
          continue;
        }

        // Search window: ±30 min
        const searchStart = new Date(sessionStart.getTime() - 30 * 60000);
        const searchEnd = new Date(sessionEnd.getTime() + 30 * 60000);

        // Filter pings in window
        const pingsInWindow = coachPings.filter(p => {
          const t = new Date(p.recorded_at);
          return t >= searchStart && t <= searchEnd;
        });

        const isCompleted = session.status === "Completed";

        if (pingsInWindow.length === 0) {
          if (!coachHadGpsToday) {
            // No GPS infrastructure that day — NOT a ghost, just missing data
            dailyNoGps++;
          } else {
            // Device was ON today but no pings during THIS session
            // This is a REAL ghost if session was marked Completed
            if (isCompleted) {
              dailyGhost++;
            } else {
              dailyNoGps++;
            }
          }
        } else {
          // GPS was active during session — for home visits, this IS verification
          // (coach is out and about, device is on)
          dailyActive++;
          dailyVerified++; // GPS active = verified presence (for home-visit model)
        }
      }

      // TRUST SCORE v2.0 — designed for home-visit PT business
      // Only penalize: ghosts (device OFF during completed session) + cancellations
      // Do NOT penalize 'mismatch' (not-at-POI is normal for home visits)
      let trustScore = 100;

      // Ghost penalty: -15 per ghost (device OFF during session is serious)
      trustScore -= dailyGhost * 15;

      // Cancel penalty: proportional to rate, not count
      if (cancelRate > 40) trustScore -= 30;
      else if (cancelRate > 25) trustScore -= 15;
      else if (cancelRate > 10) trustScore -= 5;

      // No-GPS penalty: -3 per session with no data (mild — could be network issue)
      trustScore -= dailyNoGps * 3;

      // Completion bonus: +3 per completed session
      trustScore += completed * 3;

      // Verification bonus: +2 per GPS-confirmed session
      trustScore += dailyVerified * 2;

      trustScore = Math.max(0, Math.min(100, trustScore));

      const ghostRate = total > 0 ? (dailyGhost / total) * 100 : 0;
      const riskLevel =
        dailyGhost >= 2 && ghostRate > 50 ? "critical" :
        dailyGhost >= 1 || cancelRate > 40 ? "high" :
        cancelRate > 20 || dailyNoGps > total * 0.5 ? "medium" :
        "normal";

      // Generate anomalies (DAILY)
      const anomalies: string[] = [];
      if (dailyGhost > 0) anomalies.push(`${dailyGhost} ghost sessions TODAY`);
      if (cancelRate > 30) anomalies.push(`${cancelRate.toFixed(0)}% cancel rate TODAY`);
      if (dailyNoGps > 0 && dailyNoGps === total) anomalies.push(`ALL ${total} sessions had no GPS`);

      // Generate insights
      const aiInsights: string[] = [];
      if (dailyGhost > 0 && cancelled > 0) {
        aiInsights.push(`Both ghost (${dailyGhost}) and cancel (${cancelled}) on same day — may indicate no-show pattern`);
      }
      if (completed > 3 && dailyGhost === 0 && cancelRate < 10) {
        aiInsights.push(`Strong day: ${completed} completions, GPS active, low cancellation`);
      }
      if (dailyNoGps === total && total > 0) {
        aiInsights.push(`Device may be off or out of battery — zero GPS all day (${total} sessions)`);
      }

      // Alerts
      if (dailyGhost >= 2) {
        alerts.push({
          coach, type: "GHOST_SESSIONS",
          detail: `${dailyGhost} ghost sessions TODAY — device offline during completed sessions`,
          severity: "critical"
        });
      }
      if (cancelRate > 50 && total >= 3) {
        alerts.push({
          coach, type: "HIGH_CANCELLATION",
          detail: `${cancelRate.toFixed(0)}% cancel rate today (${cancelled}/${total})`,
          severity: "high"
        });
      }

      ledgerEntries.push({
        coach_name: coach,
        ledger_date: targetDate,
        sessions_scheduled: total,
        sessions_completed: completed,
        sessions_cancelled: cancelled,
        gps_verified: dailyVerified,
        gps_mismatch: 0, // NOT used in home-visit model
        gps_no_data: dailyNoGps,
        ghost_sessions: dailyGhost,
        late_arrivals: 0,
        early_departures: 0,
        trust_score: trustScore,
        risk_level: riskLevel,
        cancel_rate: cancelRate,
        completion_rate: completionRate,
        verification_rate: total > 0 ? (dailyVerified / total) * 100 : 0,
        anomalies: JSON.stringify(anomalies),
        ai_insights: JSON.stringify(aiInsights),
      });
    }

    // 6. Upsert to trust ledger
    const { error: upsertError } = await supabase
      .from("coach_trust_ledger")
      .upsert(ledgerEntries, { onConflict: "coach_name,ledger_date" });

    const resultMessages: string[] = [];
    if (upsertError) {
      resultMessages.push(`❌ Ledger upsert error: ${upsertError.message}`);
    } else {
      resultMessages.push(`✅ ${ledgerEntries.length} coach-days written to trust ledger`);
    }

    // 7. Build report
    const report = {
      date: targetDate,
      version: "2.0",
      model: "home-visit-pt",
      total_sessions: sessions.length,
      total_coaches: Object.keys(byCoach).length,
      completed: sessions.filter(s => s.status === "Completed").length,
      cancelled: sessions.filter(s => (s.status || "").includes("Cancel")).length,
      gps_pings_today: (pings || []).length,
      devices_with_data: Object.keys(pingsByDevice).length,
      alerts_critical: alerts.filter(a => a.severity === "critical").length,
      alerts_high: alerts.filter(a => a.severity === "high").length,
      high_risk: ledgerEntries
        .filter(e => e.risk_level === "high" || e.risk_level === "critical")
        .map(e => ({
          coach: e.coach_name, ghosts: e.ghost_sessions, noGps: e.gps_no_data,
          cancel_rate: e.cancel_rate.toFixed(0), trust: e.trust_score, risk: e.risk_level
        })),
      top_performers: ledgerEntries
        .filter(e => e.trust_score >= 80 && e.sessions_completed > 0)
        .map(e => ({ coach: e.coach_name, completed: e.sessions_completed, trust: e.trust_score })),
      formula_notes: [
        "Trust v2.0: ghost=-15, cancel(>40%)=-30, noGPS=-3, completed=+3, verified=+2",
        "Mismatch NOT penalized (home-visit model: not-at-POI is expected)",
        "Ghost = device OFF during Completed session (most serious signal)",
        "All metrics are PER-DAY (not cumulative)"
      ],
      alerts,
      results: resultMessages,
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
