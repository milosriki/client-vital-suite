import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Haversine distance in meters
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const targetDate = body.date || new Date().toISOString().split("T")[0];

    // 1. Get today's confirmed sessions
    const { data: sessions, error: sessErr } = await supabase
      .from("training_sessions_live")
      .select("id, client_name, coach_name, training_date, time_slot, status")
      .in("status", ["Confirmed", "Completed"])
      .gte("training_date", `${targetDate}T00:00:00`)
      .lte("training_date", `${targetDate}T23:59:59`);

    if (sessErr) throw sessErr;

    // 2. Get all devices (coach_name → device_id mapping)
    const { data: devices } = await supabase
      .from("mdm_devices")
      .select("tinymdm_device_id, coach_name");

    const coachDeviceMap = new Map<string, string[]>();
    for (const d of devices || []) {
      const name = d.coach_name?.trim().toLowerCase();
      if (!name) continue;
      const existing = coachDeviceMap.get(name) || [];
      existing.push(d.tinymdm_device_id);
      coachDeviceMap.set(name, existing);
    }

    // 3. Get all GPS pings for today
    const { data: pings } = await supabase
      .from("mdm_location_events")
      .select("device_id, recorded_at, lat, lng, address")
      .gte("recorded_at", `${targetDate}T00:00:00`)
      .lte("recorded_at", `${targetDate}T23:59:59`);

    // Index pings by device_id
    const pingsByDevice = new Map<string, typeof pings>();
    for (const p of pings || []) {
      const existing = pingsByDevice.get(p.device_id) || [];
      existing.push(p);
      pingsByDevice.set(p.device_id, existing);
    }

    // 4. Get POIs
    const { data: pois } = await supabase.from("mdm_pois").select("*");

    // 5. Cross-reference each session
    const results: any[] = [];
    let verified = 0, mismatch = 0, noGps = 0, noDevice = 0;

    for (const session of sessions || []) {
      const coachNameLower = session.coach_name?.trim().toLowerCase() || "";
      const deviceIds = coachDeviceMap.get(coachNameLower) || [];

      if (deviceIds.length === 0) {
        // Try fuzzy match — first name only
        const firstName = coachNameLower.split(" ")[0];
        for (const [name, ids] of coachDeviceMap.entries()) {
          if (name.startsWith(firstName)) {
            deviceIds.push(...ids);
            break;
          }
        }
      }

      if (deviceIds.length === 0) {
        noDevice++;
        results.push({
          session_id: session.id,
          client_name: session.client_name,
          coach_name: session.coach_name,
          session_time: session.training_date,
          verification: "NO_DEVICE",
          detail: "No MDM device found for this coach",
        });
        continue;
      }

      // Find GPS ping within ±60 min of session time
      const sessionTime = new Date(session.training_date).getTime();
      const windowMs = 60 * 60 * 1000; // 60 min

      let closestPing: any = null;
      let closestDiff = Infinity;

      for (const deviceId of deviceIds) {
        const devicePings = pingsByDevice.get(deviceId) || [];
        for (const ping of devicePings) {
          const pingTime = new Date(ping.recorded_at).getTime();
          const diff = Math.abs(pingTime - sessionTime);
          if (diff < windowMs && diff < closestDiff) {
            closestDiff = diff;
            closestPing = ping;
          }
        }
      }

      if (!closestPing) {
        noGps++;
        results.push({
          session_id: session.id,
          client_name: session.client_name,
          coach_name: session.coach_name,
          session_time: session.training_date,
          verification: "NO_GPS",
          detail: "No GPS ping found within ±60 min of session",
        });
        continue;
      }

      // Check if GPS is near any POI
      let nearestPoi: any = null;
      let nearestDist = Infinity;

      for (const poi of pois || []) {
        const dist = haversineM(closestPing.lat, closestPing.lng, poi.lat, poi.lng);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestPoi = poi;
        }
      }

      const isNearPoi = nearestDist <= (nearestPoi?.radius_m || 500);

      if (isNearPoi) {
        verified++;
        results.push({
          session_id: session.id,
          client_name: session.client_name,
          coach_name: session.coach_name,
          session_time: session.training_date,
          verification: "VERIFIED",
          gps_lat: closestPing.lat,
          gps_lng: closestPing.lng,
          gps_address: closestPing.address,
          gps_time: closestPing.recorded_at,
          time_diff_min: Math.round(closestDiff / 60000),
          nearest_poi: nearestPoi?.name,
          distance_m: Math.round(nearestDist),
        });
      } else {
        mismatch++;
        results.push({
          session_id: session.id,
          client_name: session.client_name,
          coach_name: session.coach_name,
          session_time: session.training_date,
          verification: "LOCATION_MISMATCH",
          gps_lat: closestPing.lat,
          gps_lng: closestPing.lng,
          gps_address: closestPing.address,
          gps_time: closestPing.recorded_at,
          time_diff_min: Math.round(closestDiff / 60000),
          nearest_poi: nearestPoi?.name,
          distance_m: Math.round(nearestDist),
          detail: `Coach was ${Math.round(nearestDist)}m from nearest POI (${nearestPoi?.name})`,
        });
      }
    }

    // 6. Store verification results in existing schema
    for (const r of results) {
      const sessionTime = new Date(r.session_time);
      const windowStart = new Date(sessionTime.getTime() - 60 * 60 * 1000);
      const windowEnd = new Date(sessionTime.getTime() + 60 * 60 * 1000);

      await supabase.from("mdm_session_verifications").upsert({
        session_id: r.session_id,
        status: r.verification,
        points_in_geofence: r.verification === "VERIFIED" ? 1 : 0,
        max_distance_m: r.distance_m || null,
        evidence_window: `[${windowStart.toISOString()},${windowEnd.toISOString()}]`,
      }, { onConflict: "session_id" });
    }

    return new Response(JSON.stringify({
      success: true,
      date: targetDate,
      total_sessions: (sessions || []).length,
      summary: { verified, mismatch, noGps, noDevice },
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
