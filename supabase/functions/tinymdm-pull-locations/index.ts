import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const TINYMDM_BASE = "https://www.tinymdm.net/api/v1";
const TINYMDM_PUBLIC_KEY = Deno.env.get("TINYMDM_PUBLIC_KEY")!;
const TINYMDM_SECRET_KEY = Deno.env.get("TINYMDM_SECRET_KEY")!;

async function fetchTinyMDM(endpoint: string) {
  const res = await fetch(`${TINYMDM_BASE}${endpoint}`, {
    headers: {
      "X-Tinymdm-Apikey-Public": TINYMDM_PUBLIC_KEY,
      "X-Tinymdm-Apikey-Secret": TINYMDM_SECRET_KEY,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TinyMDM API ${res.status}: ${body}`);
  }
  return res.json();
}

function md5Hash(input: string): string {
  // Simple hash for dedup - using Web Crypto
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
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

    // Get all tracked devices
    const { data: devices, error: devErr } = await supabase
      .from("mdm_devices")
      .select("tinymdm_device_id");
    
    if (devErr) throw devErr;
    if (!devices?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No devices to poll", inserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalInserted = 0;
    const errors: string[] = [];

    for (const device of devices) {
      try {
        const locations = await fetchTinyMDM(`/devices/${device.tinymdm_device_id}/locations`);
        const locList = Array.isArray(locations) ? locations : locations.data || locations.locations || [];

        const rows = locList.map((loc: any) => {
          const deviceId = device.tinymdm_device_id;
          const recordedAt = loc.recorded_at || loc.recordedAt || loc.timestamp || loc.date;
          const lat = parseFloat(loc.latitude || loc.lat);
          const lng = parseFloat(loc.longitude || loc.lng || loc.lon);
          const accuracy = loc.accuracy || loc.accuracy_m || null;

          return {
            device_id: deviceId,
            recorded_at: recordedAt,
            lat,
            lng,
            accuracy_m: accuracy ? parseFloat(accuracy) : null,
            raw_hash: md5Hash(`${deviceId}${recordedAt}${lat}${lng}`),
          };
        }).filter((r: any) => r.recorded_at && !isNaN(r.lat) && !isNaN(r.lng));

        if (rows.length > 0) {
          const { error: insertErr, count } = await supabase
            .from("mdm_location_events")
            .upsert(rows, { onConflict: "device_id,recorded_at", ignoreDuplicates: true, count: "exact" });
          
          if (insertErr) {
            errors.push(`Device ${deviceId}: ${insertErr.message}`);
          } else {
            totalInserted += count || rows.length;
          }
        }
      } catch (e) {
        errors.push(`Device ${device.tinymdm_device_id}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        devices_polled: devices.length, 
        total_inserted: totalInserted,
        errors: errors.length > 0 ? errors : undefined 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
