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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const devices = await fetchTinyMDM("/devices");
    const deviceList = Array.isArray(devices) ? devices : devices.data || devices.devices || [];

    let upserted = 0;
    for (const d of deviceList) {
      const deviceId = String(d.id || d.device_id || d.deviceId);
      const deviceName = d.device_name || d.deviceName || d.name || "";
      // Map device name to coach name (device names often contain coach names)
      const coachName = deviceName.replace(/[-_](phone|device|tablet|mdm)/gi, "").trim();

      const { error } = await supabase.from("mdm_devices").upsert(
        {
          tinymdm_device_id: deviceId,
          device_name: deviceName,
          coach_name: coachName,
          policy_id: d.policy_id || d.policyId || null,
          last_sync_at: d.last_sync || d.lastSync || d.updated_at || null,
          battery_level: d.battery_level ?? d.batteryLevel ?? null,
          is_online: d.is_online ?? d.isOnline ?? d.online ?? false,
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
