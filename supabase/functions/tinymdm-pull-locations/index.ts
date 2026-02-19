import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const TINYMDM_BASE = "https://www.tinymdm.net/api/v1";
const TINYMDM_PUBLIC_KEY = Deno.env.get("TINYMDM_API_KEY_PUBLIC")!;
const TINYMDM_SECRET_KEY = Deno.env.get("TINYMDM_API_KEY_SECRET")!;
const TINYMDM_ACCOUNT_ID = Deno.env.get("TINYMDM_ACCOUNT_ID")!;

async function fetchTinyMDM(endpoint: string) {
  const res = await fetch(`${TINYMDM_BASE}${endpoint}`, {
    headers: {
      "X-Tinymdm-Manager-Apikey-Public": TINYMDM_PUBLIC_KEY,
      "X-Tinymdm-Manager-Apikey-Secret": TINYMDM_SECRET_KEY,
      "X-Account-Id": TINYMDM_ACCOUNT_ID,
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

    // Fetch all devices with their embedded geolocation_positions
    const devicesResp = await fetchTinyMDM("/devices?per_page=1000");
    const deviceList = devicesResp.results || [];

    if (!deviceList.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No devices found", inserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalInserted = 0;
    const errors: string[] = [];

    for (const device of deviceList) {
      try {
        const positions = device.geolocation_positions || [];
        if (!positions.length) continue;

        const rows = positions.map((loc: any) => {
          const deviceId = String(device.id);
          const timestamp = loc.timestamp;
          const recordedAt = timestamp ? new Date(timestamp * 1000).toISOString() : loc.date;
          const lat = parseFloat(loc.latitude);
          const lng = parseFloat(loc.longitude);

          return {
            device_id: deviceId,
            recorded_at: recordedAt,
            lat,
            lng,
            accuracy_m: null,
            address: loc.address || null,
            raw_hash: md5Hash(`${deviceId}${timestamp}${lat}${lng}`),
          };
        }).filter((r: any) => r.recorded_at && !isNaN(r.lat) && !isNaN(r.lng));

        if (rows.length > 0) {
          const { error: insertErr, count } = await supabase
            .from("mdm_location_events")
            .upsert(rows, { onConflict: "raw_hash", ignoreDuplicates: true, count: "exact" });
          
          if (insertErr) {
            errors.push(`Device ${device.id}: ${insertErr.message}`);
          } else {
            totalInserted += count || rows.length;
          }
        }
      } catch (e) {
        errors.push(`Device ${device.id}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        devices_polled: deviceList.length, 
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
