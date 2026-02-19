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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch users list for name mapping
    const usersResp = await fetchTinyMDM("/users?per_page=1000");
    const userMap = new Map<string, string>();
    for (const u of (usersResp.results || [])) {
      if (u.id && u.name) userMap.set(u.id, u.name.trim());
    }

    // Fetch all devices (paginate up to 1000)
    const devicesResp = await fetchTinyMDM("/devices?per_page=1000");
    const deviceList = devicesResp.results || [];

    let upserted = 0;
    for (const d of deviceList) {
      const deviceId = String(d.id);
      const deviceName = d.nickname || d.name || "";
      // Resolve coach name from user_id → users list, fallback to nickname/device name
      const coachName = (d.user_id && userMap.get(d.user_id)) || deviceName.replace(/[-_](phone|device|tablet|mdm)/gi, "").trim();
      
      // Get latest GPS position
      const positions = d.geolocation_positions || [];
      const lastPos = positions.length > 0 ? positions[positions.length - 1] : null;

      const { error } = await supabase.from("mdm_devices").upsert(
        {
          tinymdm_device_id: deviceId,
          device_name: deviceName,
          coach_name: coachName,
          policy_id: d.policy_id || null,
          last_sync_at: d.last_sync_timestamp ? new Date(d.last_sync_timestamp * 1000).toISOString() : null,
          battery_level: d.battery_level ?? null,
          is_online: d.geolocation_activated ?? false,
          os_version: d.os_version || null,
          imei: d.imei || null,
          serial_number: d.serial_number || null,
          manufacturer: d.manufacturer || null,
          phone_number: d.phone_number || null,
          enrollment_type: d.enrollment_type || null,
          user_id: d.user_id || null,
          group_id: d.group_id || null,
          last_lat: lastPos?.latitude ?? null,
          last_lng: lastPos?.longitude ?? null,
          last_address: lastPos?.address ?? null,
          last_location_at: lastPos?.timestamp ? new Date(lastPos.timestamp * 1000).toISOString() : null,
        },
        { onConflict: "tinymdm_device_id" }
      );
      if (!error) upserted++;
    }

    return new Response(
      JSON.stringify({ success: true, total: deviceList.length, upserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
