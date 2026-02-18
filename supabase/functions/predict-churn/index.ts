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
        CREATE TABLE IF NOT EXISTS client_predictions (
          client_id text UNIQUE NOT NULL PRIMARY KEY,
          client_name text,
          churn_score integer DEFAULT 0,
          churn_factors jsonb DEFAULT '{}',
          revenue_at_risk numeric DEFAULT 0,
          predicted_churn_date timestamptz,
          updated_at timestamptz DEFAULT now()
        )
      `);
      await pg.queryArray(`ALTER TABLE client_predictions ENABLE ROW LEVEL SECURITY`);
      await pg.queryArray(`DROP POLICY IF EXISTS "anon_read_cp" ON client_predictions`);
      await pg.queryArray(`CREATE POLICY "anon_read_cp" ON client_predictions FOR SELECT TO anon USING (true)`);
      await pg.queryArray(`DROP POLICY IF EXISTS "service_write_cp" ON client_predictions`);
      await pg.queryArray(`CREATE POLICY "service_write_cp" ON client_predictions FOR ALL TO service_role USING (true)`);
    } finally {
      await pg.end();
    }

    // ── Read data ──
    const { data: packages, error: pkgErr } = await supabase
      .from("client_packages_live")
      .select("*");
    if (pkgErr) throw pkgErr;

    const { data: sessions, error: sessErr } = await supabase
      .from("training_sessions_live")
      .select("*");
    if (sessErr) throw sessErr;

    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
    const fourWeeksAgo = new Date(now.getTime() - 28 * 86400000);

    // Group sessions by client
    const sessionsByClient: Record<string, any[]> = {};
    for (const s of sessions ?? []) {
      const cid = s.client_id || s.client_name;
      if (!cid) continue;
      if (!sessionsByClient[cid]) sessionsByClient[cid] = [];
      sessionsByClient[cid].push(s);
    }

    // ── Calculate churn per client ──
    const predictions: any[] = [];

    for (const pkg of packages ?? []) {
      const clientId = pkg.client_id || pkg.client_name;
      if (!clientId) continue;

      const clientSessions = sessionsByClient[clientId] ?? sessionsByClient[pkg.client_name] ?? [];

      // days_since_last_session
      const lastDate = pkg.last_session_date ? new Date(pkg.last_session_date) : null;
      const daysSinceLast = lastDate ? Math.floor((now.getTime() - lastDate.getTime()) / 86400000) : 90;

      // sessions_ratio: remaining / pack_size
      const remaining = pkg.remaining_sessions ?? 0;
      const packSize = pkg.pack_size ?? 1;
      const sessionsRatio = packSize > 0 ? remaining / packSize : 1;

      // decline: recent 2w vs prior 2w
      const recent2w = clientSessions.filter((s: any) => {
        const d = new Date(s.session_date || s.date);
        return d >= twoWeeksAgo && d <= now;
      }).length;
      const prior2w = clientSessions.filter((s: any) => {
        const d = new Date(s.session_date || s.date);
        return d >= fourWeeksAgo && d < twoWeeksAgo;
      }).length;
      const decline = prior2w > 0 ? Math.max(0, (prior2w - recent2w) / prior2w) : (recent2w === 0 ? 0.5 : 0);

      // future_booked
      const futureBooked = pkg.future_booked ?? 0;

      // cancel_rate
      const totalSessions = clientSessions.length;
      const cancelled = clientSessions.filter((s: any) =>
        (s.status || "").toLowerCase().includes("cancel")
      ).length;
      const cancelRate = totalSessions > 0 ? cancelled / totalSessions : 0;

      // ── Composite score (0-100) ──
      // Weights: daysSinceLast(30%), sessionsRatio(15%), decline(25%), futureBooked(15%), cancelRate(15%)
      const dayScore = Math.min(daysSinceLast / 60, 1) * 100; // 60+ days = max risk
      const ratioScore = (1 - sessionsRatio) * 100; // fewer remaining = less risk? Actually more remaining = less urgent... low ratio = almost done = higher churn risk
      const lowRatioScore = sessionsRatio < 0.2 ? 100 : sessionsRatio < 0.5 ? 60 : 20;
      const declineScore = decline * 100;
      const bookedScore = futureBooked >= 3 ? 0 : futureBooked >= 1 ? 30 : 80;
      const cancelScore = cancelRate * 100;

      const churnScore = Math.round(
        dayScore * 0.30 +
        lowRatioScore * 0.15 +
        declineScore * 0.25 +
        bookedScore * 0.15 +
        cancelScore * 0.15
      );
      const clampedScore = Math.min(100, Math.max(0, churnScore));

      // Predicted churn date: if high risk, estimate based on remaining sessions & frequency
      const sessionsPerWeek = pkg.sessions_per_week ?? 1;
      const weeksLeft = sessionsPerWeek > 0 ? remaining / sessionsPerWeek : 8;
      const predictedChurn = new Date(now.getTime() + weeksLeft * 7 * 86400000);

      const packageValue = pkg.package_value ?? 0;

      predictions.push({
        client_id: clientId,
        client_name: pkg.client_name || clientId,
        churn_score: clampedScore,
        churn_factors: {
          days_since_last_session: daysSinceLast,
          sessions_ratio: Math.round(sessionsRatio * 100) / 100,
          decline_rate: Math.round(decline * 100) / 100,
          future_booked: futureBooked,
          cancel_rate: Math.round(cancelRate * 100) / 100,
          remaining_sessions: remaining,
          coach: pkg.last_coach || null,
          phone: pkg.client_phone || null,
        },
        revenue_at_risk: packageValue,
        predicted_churn_date: predictedChurn.toISOString(),
        updated_at: now.toISOString(),
      });
    }

    // ── Upsert predictions ──
    if (predictions.length > 0) {
      const { error: upsertErr } = await supabase
        .from("client_predictions" as never)
        .upsert(predictions as never, { onConflict: "client_id" });
      if (upsertErr) throw upsertErr;
    }

    return new Response(
      JSON.stringify({ ok: true, clients_scored: predictions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
