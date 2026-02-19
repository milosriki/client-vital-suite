import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: "SUPABASE_DB_URL not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const client = new Client(dbUrl);
  const results: string[] = [];

  try {
    await client.connect();

    // 1. Expand facebook_ads_insights
    await client.queryArray(`
      ALTER TABLE facebook_ads_insights 
        ADD COLUMN IF NOT EXISTS reach BIGINT,
        ADD COLUMN IF NOT EXISTS frequency NUMERIC(10,4),
        ADD COLUMN IF NOT EXISTS quality_ranking TEXT,
        ADD COLUMN IF NOT EXISTS engagement_rate_ranking TEXT,
        ADD COLUMN IF NOT EXISTS conversion_rate_ranking TEXT,
        ADD COLUMN IF NOT EXISTS raw_actions JSONB,
        ADD COLUMN IF NOT EXISTS action_values JSONB,
        ADD COLUMN IF NOT EXISTS cost_per_action_type JSONB,
        ADD COLUMN IF NOT EXISTS attribution_window TEXT DEFAULT '7d_click_1d_view',
        ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT now(),
        ADD COLUMN IF NOT EXISTS link_clicks INTEGER,
        ADD COLUMN IF NOT EXISTS landing_page_views INTEGER,
        ADD COLUMN IF NOT EXISTS lead_form_submissions INTEGER,
        ADD COLUMN IF NOT EXISTS messaging_conversations INTEGER,
        ADD COLUMN IF NOT EXISTS video_views INTEGER,
        ADD COLUMN IF NOT EXISTS video_p25 INTEGER,
        ADD COLUMN IF NOT EXISTS video_p50 INTEGER,
        ADD COLUMN IF NOT EXISTS video_p75 INTEGER
    `);
    results.push("✅ facebook_ads_insights expanded (18 columns)");

    // 2. meta_ad_sets
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS meta_ad_sets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ad_set_id TEXT NOT NULL,
        ad_set_name TEXT,
        campaign_id TEXT,
        campaign_name TEXT,
        status TEXT,
        daily_budget NUMERIC(12,2),
        lifetime_budget NUMERIC(12,2),
        targeting JSONB,
        optimization_goal TEXT,
        bid_strategy TEXT,
        spend NUMERIC(12,2),
        impressions BIGINT,
        clicks INTEGER,
        conversions INTEGER,
        cpa NUMERIC(12,2),
        roas NUMERIC(10,4),
        reach BIGINT,
        frequency NUMERIC(10,4),
        date_start DATE,
        date_stop DATE,
        raw_actions JSONB,
        last_synced_at TIMESTAMPTZ DEFAULT now(),
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(ad_set_id, date_start)
      )
    `);
    results.push("✅ meta_ad_sets created");

    // 3. meta_ads
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS meta_ads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ad_id TEXT NOT NULL,
        ad_name TEXT,
        ad_set_id TEXT,
        ad_set_name TEXT,
        campaign_id TEXT,
        campaign_name TEXT,
        status TEXT,
        creative_thumbnail_url TEXT,
        creative_body TEXT,
        creative_title TEXT,
        creative_link_url TEXT,
        spend NUMERIC(12,2),
        impressions BIGINT,
        clicks INTEGER,
        conversions INTEGER,
        ctr NUMERIC(10,4),
        cpc NUMERIC(12,2),
        cpa NUMERIC(12,2),
        roas NUMERIC(10,4),
        reach BIGINT,
        frequency NUMERIC(10,4),
        quality_ranking TEXT,
        engagement_rate_ranking TEXT,
        conversion_rate_ranking TEXT,
        raw_actions JSONB,
        date_start DATE,
        date_stop DATE,
        last_synced_at TIMESTAMPTZ DEFAULT now(),
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(ad_id, date_start)
      )
    `);
    results.push("✅ meta_ads created");

    // 4. ptd_meta_entities
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS ptd_meta_entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type TEXT NOT NULL,
        entity_name TEXT NOT NULL,
        meta_id TEXT,
        brand TEXT NOT NULL,
        config JSONB,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    results.push("✅ ptd_meta_entities created");

    // 5. meta_cross_validation
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS meta_cross_validation (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        meta_spend NUMERIC(12,2),
        meta_conversions INTEGER,
        meta_cpa NUMERIC(12,2),
        meta_roas NUMERIC(10,4),
        hubspot_leads INTEGER,
        hubspot_new_contacts INTEGER,
        stripe_revenue NUMERIC(12,2),
        real_cpl NUMERIC(12,2),
        real_roas NUMERIC(10,4),
        real_vs_meta_cpa_diff_pct NUMERIC(10,2),
        real_vs_meta_roas_diff_pct NUMERIC(10,2),
        data_sources JSONB,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(period_start, period_end)
      )
    `);
    results.push("✅ meta_cross_validation created");

    // 6. RLS
    for (const table of ["meta_ad_sets", "meta_ads", "ptd_meta_entities", "meta_cross_validation"]) {
      await client.queryArray(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);

      await client.queryArray(`DROP POLICY IF EXISTS "auth_read_${table}" ON ${table}`);
      await client.queryArray(`CREATE POLICY "auth_read_${table}" ON ${table} FOR SELECT TO authenticated USING (true)`);

      await client.queryArray(`DROP POLICY IF EXISTS "service_write_${table}" ON ${table}`);
      await client.queryArray(`CREATE POLICY "service_write_${table}" ON ${table} FOR ALL TO service_role USING (true)`);
    }
    results.push("✅ RLS + policies applied");

    // 7. Seed ptd_meta_entities (idempotent)
    const seedCount = await client.queryArray(`SELECT count(*) FROM ptd_meta_entities`);
    if (Number(seedCount.rows[0][0]) === 0) {
      await client.queryArray(`
        INSERT INTO ptd_meta_entities (entity_type, entity_name, meta_id, brand) VALUES
          ('website', 'PTD Fitness UAE', NULL, 'ptd_fitness'),
          ('website', 'Personal Trainers Dubai', NULL, 'personal_trainers_dubai'),
          ('instagram', 'PTD Fitness Instagram', NULL, 'ptd_fitness'),
          ('instagram', 'Personal Trainers Dubai Instagram', NULL, 'personal_trainers_dubai'),
          ('ad_account', 'PTD Ad Account', 'act_349832333681399', 'ptd_fitness')
      `);
      results.push("✅ ptd_meta_entities seeded (5 rows)");
    } else {
      results.push("⏭️ ptd_meta_entities already seeded");
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error), results }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    await client.end();
  }
});
