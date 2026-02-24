import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";

const PTD_LOCATIONS = [
  { name: "PTD Marina", lat: 25.0801, lng: 55.1408, radius: 200 },
  { name: "PTD JBR", lat: 25.0780, lng: 55.1330, radius: 200 },
  { name: "PTD Downtown", lat: 25.1972, lng: 55.2744, radius: 200 },
  { name: "PTD Abu Dhabi", lat: 24.4539, lng: 54.3773, radius: 200 },
];

const DWELL_RADIUS_M = 100;
const MIN_DWELL_MINUTES = 15;

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function tagLocation(lat: number, lng: number): { name: string; isPtd: boolean } {
  for (const loc of PTD_LOCATIONS) {
    if (haversineM(lat, lng, loc.lat, loc.lng) <= loc.radius) return { name: loc.name, isPtd: true };
  }
  return { name: "External Location", isPtd: false };
}

interface RawPoint { device_id: string; latitude: number; longitude: number; timestamp: string; }
interface Visit { device_id: string; coach_name: string | null; location_name: string; latitude: number; longitude: number; arrival_time: string; departure_time: string; dwell_minutes: number; is_ptd_location: boolean; }

function computeVisits(points: RawPoint[], coachMap: Map<string, string>): Visit[] {
  const byDevice = new Map<string, RawPoint[]>();
  for (const p of points) {
    if (!byDevice.has(p.device_id)) byDevice.set(p.device_id, []);
    byDevice.get(p.device_id)!.push(p);
  }
  const visits: Visit[] = [];
  for (const [deviceId, pts] of byDevice) {
    pts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    if (pts.length === 0) continue;
    let clusterStart = 0, sumLat = pts[0].latitude, sumLng = pts[0].longitude, count = 1;
    const flush = (end: number) => {
      const centerLat = sumLat / count, centerLng = sumLng / count;
      const arrival = new Date(pts[clusterStart].timestamp), departure = new Date(pts[end].timestamp);
      const dwellMin = Math.round((departure.getTime() - arrival.getTime()) / 60000);
      if (dwellMin >= MIN_DWELL_MINUTES) {
        const tag = tagLocation(centerLat, centerLng);
        visits.push({ device_id: deviceId, coach_name: coachMap.get(deviceId) || null, location_name: tag.name, latitude: Math.round(centerLat * 1e6) / 1e6, longitude: Math.round(centerLng * 1e6) / 1e6, arrival_time: arrival.toISOString(), departure_time: departure.toISOString(), dwell_minutes: dwellMin, is_ptd_location: tag.isPtd });
      }
    };
    for (let i = 1; i < pts.length; i++) {
      const cLat = sumLat / count, cLng = sumLng / count;
      if (haversineM(cLat, cLng, pts[i].latitude, pts[i].longitude) <= DWELL_RADIUS_M) {
        sumLat += pts[i].latitude; sumLng += pts[i].longitude; count++;
      } else { flush(i - 1); clusterStart = i; sumLat = pts[i].latitude; sumLng = pts[i].longitude; count = 1; }
    }
    flush(pts.length - 1);
  }
  return visits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    verifyAuth(req);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch GPS data — NO postgres client, pure supabase-js
    const { data: locationEvents, error: locErr } = await sb
      .from("mdm_location_events")
      .select("device_id,lat,lng,recorded_at")
      .order("device_id").order("recorded_at").limit(50000);
    if (locErr) throw locErr;

    const { data: devicesData, error: devErr } = await sb
      .from("mdm_devices").select("tinymdm_device_id,coach_name");
    if (devErr) throw devErr;

    const coachMap = new Map<string, string>();
    for (const d of devicesData || []) if (d.coach_name) coachMap.set(d.tinymdm_device_id, d.coach_name);

    const rawPoints: RawPoint[] = (locationEvents || []).map((e: any) => ({
      device_id: e.device_id, latitude: e.lat, longitude: e.lng, timestamp: e.recorded_at,
    }));
    const visits = computeVisits(rawPoints, coachMap);

    // Clear old and insert new
    await sb.from("coach_visits").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (visits.length > 0) {
      for (let i = 0; i < visits.length; i += 500) {
        const { error: insErr } = await sb.from("coach_visits").insert(visits.slice(i, i + 500));
        if (insErr) throw insErr;
      }
    }

    const totalVisits = visits.length;
    const avgDwell = totalVisits > 0 ? Math.round(visits.reduce((s, v) => s + v.dwell_minutes, 0) / totalVisits) : 0;
    const locCount = new Map<string, number>();
    for (const v of visits) locCount.set(v.location_name, (locCount.get(v.location_name) || 0) + 1);
    const topLocations = [...locCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    return new Response(JSON.stringify({
      success: true, total_visits: totalVisits, avg_dwell_minutes: avgDwell,
      top_locations: topLocations.map(([name, count]) => ({ name, count })),
      ptd_visits: visits.filter(v => v.is_ptd_location).length,
      external_visits: visits.filter(v => !v.is_ptd_location).length,
      coaches: [...coachMap.values()].length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    const status = err?.statusCode ?? 500;
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
