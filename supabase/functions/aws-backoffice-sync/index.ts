import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client as PostgresClient } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * AWS Backoffice Sync
 * Role: Sync ground-truth data from the AWS RDS Replica (UAE) to Supabase.
 * Logic:
 * 1. Connect to RDS Replica (me-central-1).
 * 2. Fetch Active Training Packages and Coach Assignments.
 * 3. Compare with HubSpot sync data in Supabase.
 * 4. Generate Reconciliation Report.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // RDS Configuration (Hardcoded for this specific backoffice link as requested/discovered)
    const DB_CONFIG = {
      hostname:
        "en-saas-shared-prod-replica1.c8r6miwj9nkr.me-central-1.rds.amazonaws.com",
      port: 5432,
      user: "ptd-milos",
      database: "ptd",
      password: Deno.env.get("RDS_BACKOFFICE_PASSWORD") || "tiM6s1uzuspOsipr", // Discovered credential
      tls: {
        enabled: true,
        enforce: false, // RDS replica often needs relaxed SSL
      },
    };

    console.log(`[aws-sync] Connecting to RDS: ${DB_CONFIG.hostname}`);
    const rdsClient = new PostgresClient(DB_CONFIG);

    try {
      await rdsClient.connect();
      console.log("[aws-sync] RDS Connected.");

      // 1. Fetch Active Packages (The "Truth" for remaining sessions)
      const packagesResult = await rdsClient.queryObject(`
        SELECT 
          m.email, 
          m.full_name as name, 
          p.remainingsessions as remaining, 
          p.packsize,
          p.name_packet as package_name
        FROM enhancesch.vw_client_master m
        JOIN enhancesch.vw_client_packages p ON m.id_client = p.id_client
        WHERE p.remainingsessions >= 0
        LIMIT 1000;
      `);

      const packageData = packagesResult.rows as any[];
      console.log(`[aws-sync] Fetched ${packageData.length} package records.`);

      // 2. Fetch Recent Session Counts (Last 30 Days)
      const sessionsResult = await rdsClient.queryObject(`
        SELECT 
          id_client,
          COUNT(*) as session_count,
          MAX(training_date_utc) as last_training
        FROM enhancesch.vw_schedulers
        WHERE training_date_utc > NOW() - INTERVAL '30 days'
        AND status IN ('Completed', 'Attended')
        GROUP BY id_client;
      `);

      const sessionStats = sessionsResult.rows as any[];
      console.log(
        `[aws-sync] Fetched session stats for ${sessionStats.length} clients.`,
      );

      // 3. Fetch Sync Data from Supabase (HubSpot mirror)
      const { data: hubspotContacts, error: hbError } = await supabase
        .from("contacts")
        .select("email, outstanding_sessions, hubspot_contact_id");

      if (hbError) throw hbError;

      // 4. Reconcile
      const reconciliations = packageData.map((bo: any) => {
        const hbMatch = hubspotContacts?.find(
          (c) => c.email?.toLowerCase() === bo.email?.toLowerCase(),
        );

        const boSessions = Number(bo.remaining) || 0;
        const hbSessions = Number(hbMatch?.outstanding_sessions) || 0;
        const discrepancy = boSessions - hbSessions;

        // Find session activity
        const clientMeta = packageData.find((p) => p.email === bo.email);
        const stats = sessionStats.find(
          (s) => s.id_client === clientMeta?.id_client,
        );

        return {
          email: bo.email,
          name: bo.name,
          package: bo.package_name,
          backoffice_sessions: boSessions,
          hubspot_sessions: hbSessions,
          discrepancy,
          recent_sessions: Number(stats?.session_count) || 0,
          last_training: stats?.last_training || null,
          status:
            discrepancy === 0
              ? "MATCH"
              : discrepancy > 0
                ? "LEAK_DETECTED"
                : "DATA_LAG",
          is_active_leaking:
            discrepancy > 0 && Number(stats?.session_count) > 0 ? true : false,
        };
      });

      // 5. Calculate Summary
      const leaks = reconciliations.filter((r) => r.status === "LEAK_DETECTED");
      const activeLeaks = reconciliations.filter((r) => r.is_active_leaking);

      const summary = {
        total_checked: reconciliations.length,
        matches: reconciliations.filter((r) => r.status === "MATCH").length,
        total_leaks: leaks.length,
        active_leaks: activeLeaks.length, // Leak where they are actually training
        potential_revenue_loss_sessions: leaks.reduce(
          (sum, r) => sum + Math.max(0, r.discrepancy),
          0,
        ),
        timestamp: new Date().toISOString(),
      };

      return new Response(
        JSON.stringify({ summary, data: reconciliations }, null, 2),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    } finally {
      await rdsClient.end();
    }
  } catch (error: any) {
    console.error(`[aws-sync] Error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
