import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
    db: { schema: "public" },
  });

  try {
    // ── Create table if not exists ──
    if (!dbUrl) throw new Error("No SUPABASE_DB_URL");
    const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
    const pg = new Client(dbUrl);
    await pg.connect();
    try {
      await pg.queryArray(`
        CREATE TABLE IF NOT EXISTS revenue_forecasts (
          forecast_date date UNIQUE NOT NULL PRIMARY KEY,
          revenue_30d numeric DEFAULT 0,
          revenue_60d numeric DEFAULT 0,
          revenue_90d numeric DEFAULT 0,
          at_risk_30d numeric DEFAULT 0,
          at_risk_60d numeric DEFAULT 0,
          at_risk_90d numeric DEFAULT 0,
          total_pipeline numeric DEFAULT 0,
          updated_at timestamptz DEFAULT now()
        )
      `);
      await pg.queryArray(`ALTER TABLE revenue_forecasts ENABLE ROW LEVEL SECURITY`);
      await pg.queryArray(`DROP POLICY IF EXISTS "anon_read_rf" ON revenue_forecasts`);
      await pg.queryArray(`CREATE POLICY "anon_read_rf" ON revenue_forecasts FOR SELECT TO anon USING (true)`);
      await pg.queryArray(`DROP POLICY IF EXISTS "service_write_rf" ON revenue_forecasts`);
      await pg.queryArray(`CREATE POLICY "service_write_rf" ON revenue_forecasts FOR ALL TO service_role USING (true)`);
    } finally {
      await pg.end();
    }

    // ── Read packages ──
    const { data: packages, error: pkgErr } = await supabase
      .from("client_packages_live")
      .select("*");
    if (pkgErr) throw pkgErr;

    const RENEWAL_PROB = 0.65;
    let revenue30 = 0, revenue60 = 0, revenue90 = 0;
    let atRisk30 = 0, atRisk60 = 0, atRisk90 = 0;
    let totalPipeline = 0;

    for (const pkg of packages ?? []) {
      const value = pkg.package_value ?? 0;
      const daysLeft = pkg.days_until_depleted ?? 999;

      totalPipeline += value;

      if (daysLeft <= 30) {
        revenue30 += value * RENEWAL_PROB;
        atRisk30 += value * (1 - RENEWAL_PROB);
      } else if (daysLeft <= 60) {
        revenue60 += value * RENEWAL_PROB;
        atRisk60 += value * (1 - RENEWAL_PROB);
      } else if (daysLeft <= 90) {
        revenue90 += value * RENEWAL_PROB;
        atRisk90 += value * (1 - RENEWAL_PROB);
      }
    }

    const today = new Date().toISOString().split("T")[0];

    const { error: upsertErr } = await supabase
      .from("revenue_forecasts" as never)
      .upsert({
        forecast_date: today,
        revenue_30d: Math.round(revenue30),
        revenue_60d: Math.round(revenue60),
        revenue_90d: Math.round(revenue90),
        at_risk_30d: Math.round(atRisk30),
        at_risk_60d: Math.round(atRisk60),
        at_risk_90d: Math.round(atRisk90),
        total_pipeline: Math.round(totalPipeline),
        updated_at: new Date().toISOString(),
      } as never, { onConflict: "forecast_date" });
    if (upsertErr) throw upsertErr;

    return new Response(
      JSON.stringify({ ok: true, forecast_date: today, total_pipeline: totalPipeline }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
