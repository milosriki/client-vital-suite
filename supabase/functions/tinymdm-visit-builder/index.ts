import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Haversine distance in meters
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all POIs
    const { data: pois, error: poiErr } = await supabase.from("mdm_pois").select("*");
    if (poiErr) throw poiErr;
    if (!pois?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No POIs defined yet", visits_created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unprocessed location events from last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: events, error: evtErr } = await supabase
      .from("mdm_location_events")
      .select("*")
      .gte("recorded_at", since)
      .order("device_id")
      .order("recorded_at", { ascending: true });

    if (evtErr) throw evtErr;
    if (!events?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No recent events", visits_created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group events by device
    const byDevice = new Map<string, typeof events>();
    for (const evt of events) {
      const arr = byDevice.get(evt.device_id) || [];
      arr.push(evt);
      byDevice.set(evt.device_id, arr);
    }

    // Get device→coach mapping
    const { data: deviceMap } = await supabase
      .from("mdm_devices")
      .select("tinymdm_device_id, coach_id, coach_name");
    const coachLookup = new Map<string, { coach_id: string; coach_name: string }>();
    for (const d of deviceMap || []) {
      coachLookup.set(d.tinymdm_device_id, { coach_id: d.coach_id, coach_name: d.coach_name });
    }

    let visitsCreated = 0;
    const MIN_DWELL_POINTS = 2; // At least 2 consecutive points in POI
    const MIN_DWELL_MINUTES = 5;

    for (const [deviceId, deviceEvents] of byDevice) {
      const coach = coachLookup.get(deviceId);

      for (const poi of pois) {
        // Find consecutive points within POI radius
        let dwellStart: string | null = null;
        let dwellEnd: string | null = null;
        let pointsInFence = 0;

        for (let i = 0; i < deviceEvents.length; i++) {
          const evt = deviceEvents[i];
          const dist = haversineM(evt.lat, evt.lng, poi.lat, poi.lng);

          if (dist <= poi.radius_m) {
            if (!dwellStart) dwellStart = evt.recorded_at;
            dwellEnd = evt.recorded_at;
            pointsInFence++;
          } else {
            // Exited POI - check if we have a valid visit
            if (dwellStart && dwellEnd && pointsInFence >= MIN_DWELL_POINTS) {
              const durationMin = Math.round(
                (new Date(dwellEnd).getTime() - new Date(dwellStart).getTime()) / 60000
              );

              if (durationMin >= MIN_DWELL_MINUTES) {
                const confidence = Math.min(1, pointsInFence / 10);
                const { error } = await supabase.from("mdm_visits").insert({
                  coach_id: coach?.coach_id || null,
                  device_id: deviceId,
                  poi_id: poi.id,
                  start_ts: dwellStart,
                  end_ts: dwellEnd,
                  duration_min: durationMin,
                  confidence,
                });
                if (!error) visitsCreated++;
              }
            }
            dwellStart = null;
            dwellEnd = null;
            pointsInFence = 0;
          }
        }

        // Handle case where device is still at POI at end of data
        if (dwellStart && dwellEnd && pointsInFence >= MIN_DWELL_POINTS) {
          const durationMin = Math.round(
            (new Date(dwellEnd).getTime() - new Date(dwellStart).getTime()) / 60000
          );
          if (durationMin >= MIN_DWELL_MINUTES) {
            const confidence = Math.min(1, pointsInFence / 10);
            await supabase.from("mdm_visits").insert({
              coach_id: coach?.coach_id || null,
              device_id: deviceId,
              poi_id: poi.id,
              start_ts: dwellStart,
              end_ts: dwellEnd,
              duration_min: durationMin,
              confidence,
            });
            visitsCreated++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, visits_created: visitsCreated, devices_processed: byDevice.size }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
