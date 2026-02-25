import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";

// ─── PTD Gym Locations ────────────────────────────────────────────────────────
const PTD_LOCATIONS = [
  { name: "PTD Marina",    lat: 25.0801, lng: 55.1408, radius: 500 },
  { name: "PTD JBR",      lat: 25.0780, lng: 55.1330, radius: 500 },
  { name: "PTD Downtown", lat: 25.1972, lng: 55.2744, radius: 500 },
  { name: "PTD Abu Dhabi",lat: 24.4539, lng: 54.3773, radius: 500 },
];

// ─── Haversine ────────────────────────────────────────────────────────────────
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearAnyPtd(lat: number, lng: number, radiusOverride?: number): boolean {
  return PTD_LOCATIONS.some(
    (loc) => haversineM(lat, lng, loc.lat, loc.lng) <= (radiusOverride ?? loc.radius)
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface LocationEvent {
  device_id: string;
  recorded_at: string;
  lat: number;
  lng: number;
}

interface Session {
  id: string;
  coach_name: string;
  client_name: string;
  training_date: string;
  status: string;
  time_slot: string | null;
  session_start?: string | null;
  session_end?: string | null;
}

interface Device {
  tinymdm_device_id: string;
  coach_name: string | null;
  last_location_at: string | null;
}

interface PatternResult {
  coach_name: string;
  analysis_date: string;
  total_sessions: number;
  gps_verified: number;
  gps_mismatch: number;
  no_gps: number;
  avg_arrival_offset_min: number;
  avg_dwell_vs_scheduled_min: number;
  ghost_session_count: number;
  late_arrival_count: number;
  early_departure_count: number;
  verification_rate: number;
  pattern_score: number;
  risk_level: string;
  anomalies: object[];
}

// ─── Parse time slot → session window ────────────────────────────────────────
function parseSessionWindow(
  session: Session
): { start: Date; end: Date; scheduledMin: number } | null {
  try {
    // Prefer explicit start/end
    if (session.session_start && session.session_end) {
      const s = new Date(session.session_start);
      const e = new Date(session.session_end);
      return { start: s, end: e, scheduledMin: (e.getTime() - s.getTime()) / 60000 };
    }
    // Parse time_slot like "09:00-10:00" or "9:00 AM - 10:00 AM"
    const base = new Date(session.training_date);
    if (!session.time_slot) return null;

    const slot = session.time_slot.trim();
    const rangeMatch = slot.match(
      /^(\d{1,2}):(\d{2})\s*(?:AM|PM)?\s*[-–]\s*(\d{1,2}):(\d{2})\s*(?:AM|PM)?/i
    );
    if (rangeMatch) {
      const [, h1, m1, h2, m2] = rangeMatch;
      const start = new Date(base);
      start.setHours(parseInt(h1), parseInt(m1), 0, 0);
      const end = new Date(base);
      end.setHours(parseInt(h2), parseInt(m2), 0, 0);
      // Adjust for Dubai UTC+4
      const startUtc = new Date(start.getTime() - 4 * 3600000);
      const endUtc = new Date(end.getTime() - 4 * 3600000);
      return {
        start: startUtc,
        end: endUtc,
        scheduledMin: (endUtc.getTime() - startUtc.getTime()) / 60000,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Core pattern analysis for ONE coach ─────────────────────────────────────
function analyzeCoach(
  coachName: string,
  sessions: Session[],
  pingsByDevice: Map<string, LocationEvent[]>,
  deviceIds: string[],
  analysisDateStr: string
): PatternResult {
  const anomalies: object[] = [];
  let gpsVerified = 0;
  let gpsMismatch = 0;
  let noGps = 0;
  let ghostCount = 0;
  let lateCount = 0;
  let earlyCount = 0;
  const arrivalOffsets: number[] = [];
  const dwellDeltas: number[] = [];

  // Collect all pings for this coach across devices
  const allPings: LocationEvent[] = [];
  for (const devId of deviceIds) {
    allPings.push(...(pingsByDevice.get(devId) || []));
  }
  allPings.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));

  for (const session of sessions) {
    const window = parseSessionWindow(session);
    if (!window) continue;

    const { start, end, scheduledMin } = window;
    // ±60 min search window around session
    const searchStart = new Date(start.getTime() - 60 * 60000);
    const searchEnd   = new Date(end.getTime()   + 60 * 60000);

    const pingsNear = allPings.filter((p) => {
      const t = new Date(p.recorded_at);
      return t >= searchStart && t <= searchEnd && nearAnyPtd(p.lat, p.lng, 500);
    });

    const pingsAtLocation = allPings.filter((p) => {
      const t = new Date(p.recorded_at);
      return t >= searchStart && t <= searchEnd;
    });

    const isCompleted = ["Completed", "completed"].includes(session.status);

    if (pingsNear.length === 0) {
      // Check if we even had ANY pings in this window
      if (pingsAtLocation.length === 0) {
        noGps++;
        if (isCompleted) {
          ghostCount++;
          anomalies.push({
            type: "ghost_session",
            session_id: session.id,
            client: session.client_name,
            date: session.training_date,
            status: session.status,
            detail: `Session marked ${session.status} but ZERO GPS in ${Math.round(scheduledMin)}min window`,
          });
        }
      } else {
        // Had GPS pings but not at PTD — mismatch
        gpsMismatch++;
        anomalies.push({
          type: "location_mismatch",
          session_id: session.id,
          client: session.client_name,
          date: session.training_date,
          detail: "GPS active but not near any PTD location during session",
        });
      }
      continue;
    }

    gpsVerified++;

    // Arrival offset: first ping near location vs. scheduled start
    const firstNear = pingsNear[0];
    const firstNearTime = new Date(firstNear.recorded_at);
    const arrivalOffsetMin = (firstNearTime.getTime() - start.getTime()) / 60000;
    arrivalOffsets.push(arrivalOffsetMin);

    if (arrivalOffsetMin > 15) {
      lateCount++;
      anomalies.push({
        type: "late_arrival",
        session_id: session.id,
        client: session.client_name,
        date: session.training_date,
        minutes_late: Math.round(arrivalOffsetMin),
        detail: `Arrived ${Math.round(arrivalOffsetMin)}min late`,
      });
    }

    // Dwell delta: last ping vs. scheduled end
    const lastNear = pingsNear[pingsNear.length - 1];
    const lastNearTime = new Date(lastNear.recorded_at);
    const actualDwellMin = (lastNearTime.getTime() - firstNearTime.getTime()) / 60000;
    const dwellDelta = actualDwellMin - scheduledMin;
    dwellDeltas.push(dwellDelta);

    if (dwellDelta < -10) {
      earlyCount++;
      anomalies.push({
        type: "early_departure",
        session_id: session.id,
        client: session.client_name,
        date: session.training_date,
        minutes_early: Math.round(Math.abs(dwellDelta)),
        detail: `Left ${Math.round(Math.abs(dwellDelta))}min early (stayed ${Math.round(actualDwellMin)}min of ${Math.round(scheduledMin)}min)`,
      });
    }
  }

  const total = sessions.length;
  const verificationRate = total > 0 ? (gpsVerified / total) * 100 : 0;

  // ── Pattern Score (0-100, higher = more trustworthy) ─────────────────────
  let score = 100;

  // Ghost sessions: -15 each
  score -= ghostCount * 15;
  // Mismatch: -5 each
  score -= gpsMismatch * 5;
  // No-GPS (non-ghost): -3 each
  score -= (noGps - ghostCount) * 3;
  // Late arrivals: -3 each
  score -= lateCount * 3;
  // Early departures: -2 each
  score -= earlyCount * 2;
  // Bonus for high verification rate
  score += verificationRate * 0.1;

  score = Math.max(0, Math.min(100, Math.round(score)));

  // ── Risk Level ────────────────────────────────────────────────────────────
  let riskLevel = "normal";
  if (score < 40 || ghostCount >= 3 || verificationRate < 40) riskLevel = "critical";
  else if (score < 70 || ghostCount >= 1 || verificationRate < 70) riskLevel = "review";

  return {
    coach_name: coachName,
    analysis_date: analysisDateStr,
    total_sessions: total,
    gps_verified: gpsVerified,
    gps_mismatch: gpsMismatch,
    no_gps: noGps,
    avg_arrival_offset_min:
      arrivalOffsets.length > 0
        ? parseFloat(
            (arrivalOffsets.reduce((s, v) => s + v, 0) / arrivalOffsets.length).toFixed(1)
          )
        : 0,
    avg_dwell_vs_scheduled_min:
      dwellDeltas.length > 0
        ? parseFloat(
            (dwellDeltas.reduce((s, v) => s + v, 0) / dwellDeltas.length).toFixed(1)
          )
        : 0,
    ghost_session_count: ghostCount,
    late_arrival_count: lateCount,
    early_departure_count: earlyCount,
    verification_rate: parseFloat(verificationRate.toFixed(1)),
    pattern_score: score,
    risk_level: riskLevel,
    anomalies,
  };
}

// ─── Prediction Engine ────────────────────────────────────────────────────────
interface PatternHistory {
  coach_name: string;
  analysis_date: string;
  ghost_session_count: number;
  verification_rate: number;
  pattern_score: number;
  risk_level: string;
}

function generatePredictions(coachName: string, history: PatternHistory[]): object[] {
  const predictions: object[] = [];
  if (history.length < 3) return predictions;

  const recent = [...history].sort((a, b) => b.analysis_date.localeCompare(a.analysis_date)).slice(0, 7);

  // Declining verification rate (ghost risk)
  const rates = recent.map((h) => h.verification_rate);
  const avgFirst3 = rates.slice(0, 3).reduce((s, v) => s + v, 0) / 3;
  const avgLast3  = rates.slice(-3).reduce((s, v) => s + v, 0) / 3;
  const trend = avgFirst3 - avgLast3; // positive means declining

  if (trend > 15) {
    predictions.push({
      type: "flight_risk",
      confidence: Math.min(95, Math.round(trend * 2)),
      detail: `Verification rate declining ${trend.toFixed(0)}% over last 7 days — high ghost-session risk this week`,
    });
  }

  // Ghost session pattern
  const totalGhosts = recent.reduce((s, h) => s + h.ghost_session_count, 0);
  if (totalGhosts > 0) {
    const ghostRate = totalGhosts / recent.length;
    if (ghostRate >= 1) {
      predictions.push({
        type: "predicted_ghost_this_week",
        confidence: Math.min(90, Math.round(ghostRate * 40)),
        detail: `Avg ${ghostRate.toFixed(1)} ghost sessions/day in recent history — expect ghost sessions this week`,
      });
    }
  }

  // Score improvement trend
  const scores = recent.map((h) => h.pattern_score);
  const scoreTrend = scores[0] - scores[scores.length - 1]; // negative = worsening
  if (scoreTrend < -20) {
    predictions.push({
      type: "risk_escalating",
      confidence: 80,
      detail: `Pattern score dropped ${Math.abs(Math.round(scoreTrend))} points — risk escalating, review recommended`,
    });
  } else if (scoreTrend > 20) {
    predictions.push({
      type: "improving",
      confidence: 75,
      detail: `Pattern score improved ${Math.round(scoreTrend)} points — coach showing improvement`,
    });
  }

  return predictions;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    verifyAuth(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const daysBack: number = body.days_back ?? 30;
    const targetDate: string = body.date ?? new Date().toISOString().split("T")[0];
    const specificCoach: string | null = body.coach_name ?? null;

    const since = new Date(
      new Date(targetDate).getTime() - daysBack * 24 * 3600000
    ).toISOString();

    console.log(`[gps-pattern-analyzer] Analyzing ${daysBack} days back from ${targetDate}`);

    // 1. Fetch devices
    const { data: devices, error: devErr } = await supabase
      .from("mdm_devices")
      .select("tinymdm_device_id, coach_name, last_location_at");
    if (devErr) throw devErr;

    const allDevices = (devices || []) as Device[];

    // Build coach → device_ids map
    const coachDeviceMap = new Map<string, string[]>();
    for (const d of allDevices) {
      const name = d.coach_name?.trim();
      if (!name || name.startsWith("SM-")) continue;
      const existing = coachDeviceMap.get(name) || [];
      existing.push(d.tinymdm_device_id);
      coachDeviceMap.set(name, existing);
    }

    // 2. Fetch GPS pings for last N days
    const { data: pings, error: pingsErr } = await supabase
      .from("mdm_location_events")
      .select("device_id, recorded_at, lat, lng")
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true });
    if (pingsErr) throw pingsErr;

    const pingsByDevice = new Map<string, LocationEvent[]>();
    for (const p of pings || []) {
      const existing = pingsByDevice.get(p.device_id) || [];
      existing.push(p as LocationEvent);
      pingsByDevice.set(p.device_id, existing);
    }

    // 3. Fetch training sessions for last N days
    const { data: sessions, error: sessErr } = await supabase
      .from("training_sessions_live")
      .select("id, coach_name, client_name, training_date, status, time_slot")
      .gte("training_date", since)
      .lte("training_date", `${targetDate}T23:59:59`);
    if (sessErr) throw sessErr;

    // Group sessions by coach
    const sessionsByCoach = new Map<string, Session[]>();
    for (const s of sessions || []) {
      const name = s.coach_name?.trim();
      if (!name) continue;
      if (specificCoach && name.toLowerCase() !== specificCoach.toLowerCase()) continue;
      const existing = sessionsByCoach.get(name) || [];
      existing.push(s as Session);
      sessionsByCoach.set(name, existing);
    }

    // 4. Fetch historical patterns for prediction engine
    const { data: historicalPatterns } = await supabase
      .from("coach_gps_patterns")
      .select("coach_name, analysis_date, ghost_session_count, verification_rate, pattern_score, risk_level")
      .gte("analysis_date", new Date(new Date().getTime() - 30 * 24 * 3600000).toISOString().split("T")[0])
      .order("analysis_date", { ascending: true });

    const historyByCoach = new Map<string, PatternHistory[]>();
    for (const h of historicalPatterns || []) {
      const existing = historyByCoach.get(h.coach_name) || [];
      existing.push(h as PatternHistory);
      historyByCoach.set(h.coach_name, existing);
    }

    // 5. Analyze each coach
    const coachesToAnalyze = specificCoach
      ? [specificCoach]
      : [...new Set([...coachDeviceMap.keys(), ...sessionsByCoach.keys()])];

    const results: PatternResult[] = [];

    for (const coachName of coachesToAnalyze) {
      const deviceIds = coachDeviceMap.get(coachName) || [];
      // Fuzzy match on sessions too
      const coachSessions = sessionsByCoach.get(coachName) || [];

      if (coachSessions.length === 0 && deviceIds.length === 0) continue;

      const pattern = analyzeCoach(
        coachName,
        coachSessions,
        pingsByDevice,
        deviceIds,
        targetDate
      );

      // Add predictions from historical patterns
      const history = historyByCoach.get(coachName) || [];
      const predictions = generatePredictions(coachName, history);
      if (predictions.length > 0) {
        pattern.anomalies = [...pattern.anomalies, ...predictions.map((p) => ({ ...p as object, is_prediction: true }))];
      }

      results.push(pattern);
    }

    // 6. Upsert patterns into DB
    if (results.length > 0) {
      const { error: upsertErr } = await supabase
        .from("coach_gps_patterns")
        .upsert(results, { onConflict: "coach_name,analysis_date" });
      if (upsertErr) {
        console.error("[gps-pattern-analyzer] Upsert error:", upsertErr);
      }
    }

    // 7. GPS Staleness Alerts
    const staleAlerts: object[] = [];
    const now = new Date();
    const staleThresholdMs = 24 * 3600000;

    for (const device of allDevices) {
      if (!device.coach_name || device.coach_name.startsWith("SM-")) continue;
      if (!device.last_location_at) {
        staleAlerts.push({
          device_id: device.tinymdm_device_id,
          coach_name: device.coach_name,
          alert_type: "NO_GPS",
          severity: "critical",
          last_seen_at: null,
          hours_silent: null,
          message: `${device.coach_name}: No GPS data ever recorded on this device`,
        });
        continue;
      }
      const lastSeen = new Date(device.last_location_at);
      const silentMs = now.getTime() - lastSeen.getTime();
      if (silentMs > staleThresholdMs) {
        const hoursSilent = silentMs / 3600000;
        staleAlerts.push({
          device_id: device.tinymdm_device_id,
          coach_name: device.coach_name,
          alert_type: "STALENESS",
          severity: hoursSilent > 48 ? "critical" : "warning",
          last_seen_at: device.last_location_at,
          hours_silent: parseFloat(hoursSilent.toFixed(1)),
          message: `${device.coach_name}: No GPS for ${hoursSilent.toFixed(0)}h (last seen ${lastSeen.toISOString().split("T")[0]})`,
        });
      }
    }

    if (staleAlerts.length > 0) {
      // Use INSERT with ON CONFLICT DO NOTHING — the unique index handles dedup
      const { error: alertErr } = await supabase
        .from("gps_device_alerts")
        .upsert(staleAlerts, { onConflict: "device_id,alert_type", ignoreDuplicates: false });
      if (alertErr) {
        console.warn("[gps-pattern-analyzer] Alert upsert warning:", alertErr.message);
      }
    }

    // 8. Summary
    const critical = results.filter((r) => r.risk_level === "critical").length;
    const review   = results.filter((r) => r.risk_level === "review").length;
    const totalGhosts = results.reduce((s, r) => s + r.ghost_session_count, 0);

    const summary = {
      success: true,
      analysis_date: targetDate,
      days_analyzed: daysBack,
      coaches_analyzed: results.length,
      critical_coaches: critical,
      review_coaches: review,
      total_ghost_sessions: totalGhosts,
      stale_devices: staleAlerts.length,
      patterns_saved: results.length,
      risk_breakdown: {
        critical: results.filter((r) => r.risk_level === "critical").map((r) => r.coach_name),
        review: results.filter((r) => r.risk_level === "review").map((r) => r.coach_name),
      },
    };

    console.log("[gps-pattern-analyzer] Complete:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : typeof err === "object" ? JSON.stringify(err) : String(err);
    console.error("[gps-pattern-analyzer] Error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
