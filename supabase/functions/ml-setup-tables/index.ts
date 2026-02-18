import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATABASE_URL = Deno.env.get("SUPABASE_DB_URL") ??
  `postgresql://postgres.ztjndilxurtsfqdsvfds:${Deno.env.get("DB_PASSWORD") ?? ""}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const pool = new Pool(DATABASE_URL, 1);
  const conn = await pool.connect();

  try {
    // Create ml_client_features
    await conn.queryObject(`
      CREATE TABLE IF NOT EXISTS ml_client_features (
        client_email text PRIMARY KEY,
        client_name text,
        coach_name text,
        features jsonb NOT NULL DEFAULT '{}',
        feature_count integer DEFAULT 0,
        computed_at timestamptz DEFAULT now()
      );
    `);

    // Create ml_model_weights
    await conn.queryObject(`
      CREATE TABLE IF NOT EXISTS ml_model_weights (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        model_name text NOT NULL,
        version text NOT NULL,
        weights jsonb NOT NULL,
        metrics jsonb DEFAULT '{}',
        trained_at timestamptz DEFAULT now(),
        UNIQUE(model_name, version)
      );
    `);

    // Create ai_interventions
    await conn.queryObject(`
      CREATE TABLE IF NOT EXISTS ai_interventions (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        client_email text NOT NULL,
        client_name text,
        intervention_type text NOT NULL,
        urgency text DEFAULT 'MEDIUM',
        action_text text NOT NULL,
        context jsonb DEFAULT '{}',
        status text DEFAULT 'pending',
        created_at timestamptz DEFAULT now(),
        resolved_at timestamptz
      );
    `);

    // Add ML columns to client_predictions if they don't exist
    await conn.queryObject(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_predictions' AND column_name = 'ml_metadata') THEN
          ALTER TABLE client_predictions ADD COLUMN ml_metadata jsonb DEFAULT '{}';
        END IF;
      END $$;
    `);

    // RLS policies
    for (const table of ["ml_client_features", "ml_model_weights", "ai_interventions"]) {
      await conn.queryObject(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      await conn.queryObject(`DROP POLICY IF EXISTS "service_role_all_${table}" ON ${table};`);
      await conn.queryObject(`
        CREATE POLICY "service_role_all_${table}" ON ${table}
        FOR ALL USING (true) WITH CHECK (true);
      `);
      await conn.queryObject(`DROP POLICY IF EXISTS "anon_read_${table}" ON ${table};`);
      await conn.queryObject(`
        CREATE POLICY "anon_read_${table}" ON ${table}
        FOR SELECT USING (true);
      `);
    }

    // Insert default model weights
    await conn.queryObject(`
      INSERT INTO ml_model_weights (model_name, version, weights, metrics)
      VALUES ('churn_v1', '1.0.0', '{
        "bias": -1.5,
        "days_since_last_session": 0.04,
        "future_bookings_zero": 2.5,
        "sessions_7d_zero": 1.2,
        "sessions_30d_low": 0.8,
        "session_trend_negative": -1.5,
        "remaining_pct_low": 1.5,
        "cancellation_rate_high": 3.0,
        "burn_rate_good": -0.5,
        "loyalty_months": -0.05
      }'::jsonb, '{"type": "logistic_regression", "calibrated_from": "domain_knowledge"}'::jsonb)
      ON CONFLICT (model_name, version) DO NOTHING;
    `);

    return new Response(JSON.stringify({
      success: true,
      tables_created: ["ml_client_features", "ml_model_weights", "ai_interventions"],
      rls_enabled: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    conn.release();
    await pool.end();
  }
});
