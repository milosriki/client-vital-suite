import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Haversine distance in meters
function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface GPSPoint {
  lat: number;
  lng: number;
  recorded_at: string;
  address: string | null;
}

interface SessionRecord {
  coach_name: string;
  training_date: string;
  time_slot: string | null;
  status: string;
  location: string | null;
  client_name: string;
}

interface DwellCluster {
  centroidLat: number;
  centroidLng: number;
  address: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  pointCount: number;
}

interface CoachDayAnalytics {
  coach_name: string;
  device_id: string;
  date: string;
  total_gps_points: number;
  first_ping: string;
  last_ping: string;
  active_hours: number;
  dwell_clusters: DwellCluster[];
  total_dwell_min: number;
  total_travel_min: number;
  total_idle_min: number;
  sessions_scheduled: number;
  sessions_completed: number;
  sessions_cancelled: number;
  session_location_matches: number;
  utilization_pct: number;
  travel_km: number;
  insights: string[];
  predictions: string[];
}

function clusterDwellPoints(
  points: GPSPoint[],
  radiusM = 150,
  minDwellMin = 10
): DwellCluster[] {
  if (points.length < 2) return [];

  const clusters: DwellCluster[] = [];
  let i = 0;

  while (i < points.length) {
    const anchor = points[i];
    const clusterPts: GPSPoint[] = [anchor];
    let j = i + 1;

    while (j < points.length) {
      const dist = haversineM(anchor.lat, anchor.lng, points[j].lat, points[j].lng);
      if (dist <= radiusM) {
        clusterPts.push(points[j]);
        j++;
      } else {
        break;
      }
    }

    const startT = new Date(clusterPts[0].recorded_at).getTime();
    const endT = new Date(clusterPts[clusterPts.length - 1].recorded_at).getTime();
    const durationMin = (endT - startT) / 60000;

    if (durationMin >= minDwellMin && clusterPts.length >= 2) {
      const avgLat =
        clusterPts.reduce((s, p) => s + p.lat, 0) / clusterPts.length;
      const avgLng =
        clusterPts.reduce((s, p) => s + p.lng, 0) / clusterPts.length;

      clusters.push({
        centroidLat: avgLat,
        centroidLng: avgLng,
        address:
          clusterPts.find((p) => p.address)?.address || "Unknown location",
        startTime: clusterPts[0].recorded_at,
        endTime: clusterPts[clusterPts.length - 1].recorded_at,
        durationMin: Math.round(durationMin),
        pointCount: clusterPts.length,
      });
    }

    i = j;
  }

  return clusters;
}

function calculateTravelKm(points: GPSPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineM(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng
    );
  }
  return total / 1000;
}

function generateInsights(analytics: CoachDayAnalytics): string[] {
  const insights: string[] = [];

  // Utilization
  if (analytics.utilization_pct < 40) {
    insights.push(
      `LOW UTILIZATION: ${analytics.coach_name} only ${analytics.utilization_pct}% productive time — ${analytics.total_idle_min}min idle`
    );
  } else if (analytics.utilization_pct > 80) {
    insights.push(
      `HIGH PERFORMER: ${analytics.coach_name} at ${analytics.utilization_pct}% utilization`
    );
  }

  // Cancellation rate
  if (analytics.sessions_scheduled > 0) {
    const cancelRate =
      analytics.sessions_cancelled / analytics.sessions_scheduled;
    if (cancelRate > 0.3) {
      insights.push(
        `HIGH CANCEL RATE: ${Math.round(cancelRate * 100)}% sessions cancelled (${analytics.sessions_cancelled}/${analytics.sessions_scheduled})`
      );
    }
  }

  // Travel
  if (analytics.travel_km > 50) {
    insights.push(
      `EXCESSIVE TRAVEL: ${analytics.travel_km.toFixed(1)}km — consider schedule optimization for geography`
    );
  }

  // GPS gaps
  if (analytics.active_hours < 4 && analytics.sessions_scheduled > 2) {
    insights.push(
      `GPS GAP: Only ${analytics.active_hours.toFixed(1)}h tracked but ${analytics.sessions_scheduled} sessions scheduled — phone off or GPS disabled?`
    );
  }

  // Location mismatch
  if (
    analytics.sessions_completed > 0 &&
    analytics.session_location_matches === 0
  ) {
    insights.push(
      `LOCATION MISMATCH: Completed ${analytics.sessions_completed} sessions but GPS doesn't match any session location`
    );
  }

  // No sessions but active GPS
  if (analytics.sessions_scheduled === 0 && analytics.total_gps_points > 5) {
    insights.push(
      `NO SESSIONS: Coach was moving (${analytics.total_gps_points} GPS points) but had 0 sessions — day off or unlogged?`
    );
  }

  return insights;
}

function generatePredictions(
  analytics: CoachDayAnalytics,
  historicalDays: CoachDayAnalytics[]
): string[] {
  const predictions: string[] = [];

  if (historicalDays.length < 3) {
    predictions.push(
      `BUILDING BASELINE: Need ${3 - historicalDays.length} more days to predict patterns (have ${historicalDays.length})`
    );
    return predictions;
  }

  // Trend: utilization
  const recentUtil = historicalDays.slice(-3).map((d) => d.utilization_pct);
  const avgUtil = recentUtil.reduce((s, v) => s + v, 0) / recentUtil.length;
  if (avgUtil < 50) {
    predictions.push(
      `UTILIZATION TREND: Averaging ${avgUtil.toFixed(0)}% over last ${recentUtil.length} days — at risk of underperformance`
    );
  }

  // Trend: cancellations increasing
  const recentCancels = historicalDays.slice(-5).map((d) => d.sessions_cancelled);
  const cancelTrend =
    recentCancels.length > 2
      ? recentCancels[recentCancels.length - 1] - recentCancels[0]
      : 0;
  if (cancelTrend > 1) {
    predictions.push(
      `CANCEL TREND UP: Cancellations increasing over last ${recentCancels.length} days — investigate coach or client issues`
    );
  }

  // Prediction: travel optimization
  const avgTravel =
    historicalDays.reduce((s, d) => s + d.travel_km, 0) / historicalDays.length;
  if (avgTravel > 30) {
    predictions.push(
      `ROUTE OPTIMIZATION: Avg ${avgTravel.toFixed(0)}km/day travel — grouping nearby clients could save ${(avgTravel * 0.3).toFixed(0)}km/day`
    );
  }

  // Prediction: active window
  const avgActiveHrs =
    historicalDays.reduce((s, d) => s + d.active_hours, 0) /
    historicalDays.length;
  predictions.push(
    `CAPACITY: Coach averages ${avgActiveHrs.toFixed(1)}h active/day — can fit ~${Math.floor(avgActiveHrs)} sessions max`
  );

  return predictions;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const targetDate =
      body.date || new Date().toISOString().split("T")[0];
    const coachFilter = body.coach_name || null;
    const daysBack = body.days_back || 7;

    // 1. Get all devices with coach mapping
    const { data: devices, error: devErr } = await supabase
      .from("mdm_devices")
      .select("tinymdm_device_id, coach_name");
    if (devErr) throw devErr;

    const deviceMap = new Map<string, string>();
    for (const d of devices || []) {
      if (d.coach_name && d.tinymdm_device_id) {
        deviceMap.set(d.tinymdm_device_id, d.coach_name);
      }
    }

    // Filter to one coach if requested
    const targetDevices = coachFilter
      ? [...deviceMap.entries()].filter(([, name]) =>
          name.toLowerCase().includes(coachFilter.toLowerCase())
        )
      : [...deviceMap.entries()];

    if (targetDevices.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No devices found for coach filter",
          available_coaches: [...new Set(deviceMap.values())],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: CoachDayAnalytics[] = [];

    for (const [deviceId, coachName] of targetDevices) {
      // Get GPS for date range
      const startDate = new Date(targetDate);
      startDate.setDate(startDate.getDate() - daysBack + 1);

      const { data: gpsPoints, error: gpsErr } = await supabase
        .from("mdm_location_events")
        .select("lat, lng, recorded_at, address")
        .eq("device_id", deviceId)
        .gte("recorded_at", startDate.toISOString())
        .lte("recorded_at", `${targetDate}T23:59:59Z`)
        .order("recorded_at", { ascending: true });

      if (gpsErr) throw gpsErr;
      if (!gpsPoints?.length) continue;

      // Group by date
      const byDate = new Map<string, GPSPoint[]>();
      for (const p of gpsPoints) {
        // Convert to Dubai time (UTC+4)
        const dubaiTime = new Date(
          new Date(p.recorded_at).getTime() + 4 * 3600000
        );
        const day = dubaiTime.toISOString().split("T")[0];
        if (!byDate.has(day)) byDate.set(day, []);
        byDate.get(day)!.push(p);
      }

      // Get sessions for this coach in date range
      const { data: sessions } = await supabase
        .from("training_sessions_live")
        .select(
          "coach_name, training_date, time_slot, status, location, client_name"
        )
        .ilike("coach_name", `%${coachName}%`)
        .gte("training_date", startDate.toISOString())
        .lte("training_date", `${targetDate}T23:59:59Z`);

      const sessionsByDate = new Map<string, SessionRecord[]>();
      for (const s of sessions || []) {
        const day = (s.training_date || "").split("T")[0];
        if (!sessionsByDate.has(day)) sessionsByDate.set(day, []);
        sessionsByDate.get(day)!.push(s);
      }

      // Analyze each day
      const dailyResults: CoachDayAnalytics[] = [];
      for (const [day, points] of byDate) {
        const daySessions = sessionsByDate.get(day) || [];

        const firstPing = new Date(points[0].recorded_at).getTime();
        const lastPing = new Date(
          points[points.length - 1].recorded_at
        ).getTime();
        const activeHours = (lastPing - firstPing) / 3600000;

        const dwellClusters = clusterDwellPoints(points);
        const totalDwellMin = dwellClusters.reduce(
          (s, c) => s + c.durationMin,
          0
        );
        const totalActiveMin = activeHours * 60;
        const travelMin = Math.max(0, totalActiveMin - totalDwellMin);

        const scheduled = daySessions.length;
        const completed = daySessions.filter(
          (s) => s.status === "Completed" || s.status === "Confirmed"
        ).length;
        const cancelled = daySessions.filter((s) =>
          (s.status || "").toLowerCase().includes("cancel")
        ).length;

        // Location match: check if any dwell cluster is near a session location
        // (simplified — just count matches)
        const locationMatches = 0; // TODO: cross-ref GPS clusters with session locations via geocoding

        const utilizationPct =
          totalActiveMin > 0
            ? Math.round(
                ((completed * 60 + totalDwellMin) /
                  Math.max(totalActiveMin, 1)) *
                  100
              )
            : 0;

        const dayAnalytics: CoachDayAnalytics = {
          coach_name: coachName,
          device_id: deviceId,
          date: day,
          total_gps_points: points.length,
          first_ping: points[0].recorded_at,
          last_ping: points[points.length - 1].recorded_at,
          active_hours: Math.round(activeHours * 10) / 10,
          dwell_clusters: dwellClusters,
          total_dwell_min: totalDwellMin,
          total_travel_min: Math.round(travelMin),
          total_idle_min: Math.round(
            Math.max(0, totalActiveMin - totalDwellMin - completed * 60)
          ),
          sessions_scheduled: scheduled,
          sessions_completed: completed,
          sessions_cancelled: cancelled,
          session_location_matches: locationMatches,
          utilization_pct: Math.min(100, utilizationPct),
          travel_km: Math.round(calculateTravelKm(points) * 10) / 10,
          insights: [],
          predictions: [],
        };

        dayAnalytics.insights = generateInsights(dayAnalytics);
        dailyResults.push(dayAnalytics);
      }

      // Generate predictions using historical context
      for (const day of dailyResults) {
        const prior = dailyResults.filter((d) => d.date < day.date);
        day.predictions = generatePredictions(day, prior);
      }

      results.push(...dailyResults);
    }

    // Summary across all coaches
    const summary = {
      date_range: `${new Date(targetDate).toISOString().split("T")[0]} (${daysBack} days)`,
      coaches_analyzed: new Set(results.map((r) => r.coach_name)).size,
      total_days_analyzed: results.length,
      avg_utilization:
        results.length > 0
          ? Math.round(
              results.reduce((s, r) => s + r.utilization_pct, 0) /
                results.length
            )
          : 0,
      total_insights: results.reduce((s, r) => s + r.insights.length, 0),
      total_predictions: results.reduce(
        (s, r) => s + r.predictions.length,
        0
      ),
      critical_alerts: results
        .flatMap((r) => r.insights)
        .filter(
          (i) =>
            i.startsWith("LOW UTILIZATION") ||
            i.startsWith("HIGH CANCEL") ||
            i.startsWith("LOCATION MISMATCH")
        ),
    };

    return new Response(
      JSON.stringify({ summary, analytics: results }, null, 2),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
