import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    // Get at-risk packages with no future bookings
    const { data: atRisk, error: fetchErr } = await supabase
      .from("client_packages_live")
      .select("client_name, client_phone, client_email, package_id, remaining_sessions, last_coach, depletion_priority")
      .in("depletion_priority", ["CRITICAL", "HIGH"])
      .eq("future_booked", 0);

    if (fetchErr) throw fetchErr;
    if (!atRisk?.length) {
      return new Response(JSON.stringify({ ok: true, upserted: 0, message: "No at-risk packages" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert alerts one by one (session_depletion_alerts table)
    let upserted = 0;
    for (const pkg of atRisk) {
      const { error } = await supabase
        .from("session_depletion_alerts")
        .upsert({
          client_name: pkg.client_name,
          client_phone: pkg.client_phone,
          client_email: pkg.client_email,
          package_id: pkg.package_id,
          remaining_sessions: pkg.remaining_sessions,
          last_coach: pkg.last_coach,
          priority: pkg.depletion_priority,
          alert_status: "pending",
          updated_at: new Date().toISOString(),
        }, { onConflict: "package_id" });
      
      if (!error) upserted++;
    }

    return new Response(
      JSON.stringify({ ok: true, upserted, total_at_risk: atRisk.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
