import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/error-handler.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL") ??
      `postgresql://postgres:${Deno.env.get("SUPABASE_DB_PASSWORD") ?? "Pazi1stazelis"}@db.ztjndilxurtsfqdsvfds.supabase.co:5432/postgres`;

    const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
    const client = new Client(dbUrl);
    await client.connect();

    // ALL tables used by dashboard pages/hooks that need anon SELECT
    const dashboardTables = [
      "agent_decisions",
      "agent_knowledge",
      "agent_memory",
      "agent_patterns",
      "ai_execution_metrics",
      "appointments",
      "aws_truth_cache",
      "business_calibration",
      "business_goals",
      "call_records",
      "client_health_scores",
      "client_payment_history",
      "coach_client_notes",
      "coach_performance",
      "coach_visits",
      "contacts",
      "daily_summary",
      "deals",
      "enhanced_leads",
      "facebook_ads_insights",
      "facebook_campaigns",
      "facebook_creatives",
      "funnel_metrics",
      "historical_baselines",
      "intervention_log",
      "knowledge_base",
      "leads",
      "lost_leads",
      "notifications",
      "prepared_actions",
      "proactive_insights",
      "setter_daily_stats",
      "staff",
      "stripe_transactions",
      "stripe_invoices",
      "stripe_subscriptions",
      "stripe_events",
      "stripe_payouts",
      "stripe_refunds",
      "stripe_fraud_alerts",
      "sync_errors",
      "sync_logs",
      "daily_business_metrics",
      "kpi_tracking",
      "business_forecasts",
      "conversion_tracking",
      "marketing_costs",
      "reassignment_log",
      "lead_delegation_history",
      "ml_client_features",
      "whatsapp_interactions",
      "agent_conversations",
      "member_analytics",
      "token_usage_metrics",
    ];

    const results: string[] = [];
    let fixed = 0;
    let skipped = 0;

    for (const table of dashboardTables) {
      const policyName = `anon_read_${table}`;
      try {
        // Check if table exists
        const check = await client.queryObject(
          `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
          [table]
        );
        if (check.rows.length === 0) {
          results.push(`⏭️ ${table} — table not found, skipped`);
          skipped++;
          continue;
        }

        // Enable RLS if not already
        await client.queryObject(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
        
        // Drop existing anon policy if any
        await client.queryObject(`DROP POLICY IF EXISTS "${policyName}" ON "${table}"`);
        
        // Create anon SELECT policy
        await client.queryObject(
          `CREATE POLICY "${policyName}" ON "${table}" FOR SELECT TO anon USING (true)`
        );
        
        results.push(`✅ ${table}`);
        fixed++;
      } catch (e) {
        results.push(`⚠️ ${table} → ${(e as Error).message.substring(0, 80)}`);
      }
    }

    await client.end();

    return new Response(JSON.stringify({
      success: true,
      fixed,
      skipped,
      total: dashboardTables.length,
      results,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
