import pkg from "pg";
const { Client: PostgresClient } = pkg;
import { createClient } from "@supabase/supabase-js";

/**
 * PTD TRUTH PORTER SUPREME (v6.0)
 * Bridges BOTH AWS RDS Replicas -> Supabase Cache.
 * - Backoffice Replica: Core Session Truth
 * - PowerBI Replica: Financial DNA & Granular Metrics
 */

const REPLICAS = {
  backoffice: {
    host: "ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com",
    port: 5432,
    user: "ptd-milos",
    password: process.env.RDS_BACKOFFICE_PASSWORD,
    database: "ptd",
    ssl: { rejectUnauthorized: false },
  },
  powerbi: {
    host: "ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com",
    port: 5432,
    user: "4revops",
    password: process.env.RDS_POWERBI_PASSWORD,
    database: "ptd",
    ssl: { rejectUnauthorized: false },
  },
};

const SUPABASE_URL = "https://ztjndilxurtsfqdsvfds.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (
  !REPLICAS.backoffice.password ||
  !REPLICAS.powerbi.password ||
  !SUPABASE_SERVICE_KEY
) {
  console.error(
    "❌ Missing environment variables: RDS_BACKOFFICE_PASSWORD, RDS_POWERBI_PASSWORD or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ClientTruth {
  email: string;
  full_name: string;
  outstanding_sessions: number;
  package_name: string;
  last_session_date: string;
  // Enhanced Metrics
  total_sessions_attended: number;
  total_sessions_cancelled: number;
  lifetime_revenue: number;
  updated_at: string;
}

async function portTruth() {
  console.log("🚀 Starting Supreme Multi-Replica Truth Porter...");

  const backofficeClient = new PostgresClient(REPLICAS.backoffice);
  const powerbiClient = new PostgresClient(REPLICAS.powerbi);

  try {
    console.log("🔗 Connecting to AWS Replicas (Backoffice & PowerBI)...");
    await Promise.all([backofficeClient.connect(), powerbiClient.connect()]);
    console.log("✅ All AWS Replicas Connected.");

    // 1. Fetch Ground Truth from Backoffice
    console.log("📥 Extracting Session Truth (Backoffice)...");
    const sessionResult = await backofficeClient.query(`
      SELECT 
        m.email,
        m.full_name,
        p.remainingsessions as outstanding_sessions,
        p.name_packet as package_name,
        (SELECT MAX(s.training_date_utc) 
         FROM enhancesch.vw_schedulers s 
         WHERE s.id_client = m.id_client 
         AND s.status IN ('Completed', 'Attended')
        ) as last_session_date
      FROM enhancesch.vw_client_master m
      JOIN enhancesch.vw_client_packages p ON m.id_client = p.id_client
      WHERE p.remainingsessions > 0
      LIMIT 1000
    `);

    // 2. Fetch Additional Analytical DNA from PowerBI
    console.log("📥 Extracting Performance DNA (PowerBI)...");
    // Note: Using 'amounttotal' as discovered in previous exploration
    const performanceResult = await powerbiClient.query(`
      SELECT 
        m.email,
        COALESCE(sess.attended, 0) as total_sessions_attended,
        COALESCE(sess.cancelled, 0) as total_sessions_cancelled,
        COALESCE(rev.lifetime_revenue, 0) as lifetime_revenue
      FROM enhancesch.vw_client_master m
      LEFT JOIN (
        SELECT s.id_client,
          COUNT(CASE WHEN s.status IN ('Completed', 'Attended') THEN 1 END) as attended,
          COUNT(CASE WHEN s.status = 'Cancelled' THEN 1 END) as cancelled
        FROM enhancesch.vw_schedulers s
        GROUP BY s.id_client
      ) sess ON m.id_client = sess.id_client
      LEFT JOIN (
        SELECT p.id_client,
          SUM(p.amounttotal) as lifetime_revenue
        FROM enhancesch.vw_client_packages p
        GROUP BY p.id_client
      ) rev ON m.id_client = rev.id_client
      LIMIT 1000
    `);

    const performanceMap = new Map(
      performanceResult.rows.map((r: any) => [r.email, r]),
    );
    console.log(`✅ Extracted data for ${sessionResult.rows.length} clients.`);

    // 3. Merge & Deduplicate
    console.log("🧬 Merging DNA Sequences...");
    const mergedDataMap = new Map<string, ClientTruth>();

    for (const row of sessionResult.rows) {
      if (mergedDataMap.has(row.email)) continue; // Skip duplicates from session query if any

      const perf: Record<string, any> = performanceMap.get(row.email) || {};

      mergedDataMap.set(row.email, {
        email: row.email,
        full_name: row.full_name,
        outstanding_sessions: row.outstanding_sessions,
        package_name: row.package_name,
        last_session_date: row.last_session_date,
        // Merged DNA
        total_sessions_attended: parseInt(perf.total_sessions_attended || "0"),
        total_sessions_cancelled: parseInt(
          perf.total_sessions_cancelled || "0",
        ),
        lifetime_revenue: parseFloat(perf.lifetime_revenue || "0"),
        updated_at: new Date().toISOString(),
      });
    }

    const uniqueBatch = Array.from(mergedDataMap.values());

    // 4. Push to Supabase
    console.log(
      `📤 Pushing ${uniqueBatch.length} unique SUPREME Truth records...`,
    );

    const { error: coreError } = await supabase
      .from("aws_truth_cache")
      .upsert(uniqueBatch, { onConflict: "email" });

    if (coreError) {
      console.error(`❌ Sync Failed:`, coreError.message);
    } else {
      console.log(`✅ Successfully synced SUPREME records.`);
    }

    console.log("🏆 Truth Alignment Complete. Dashboards are now SUPREME.");
  } catch (error: any) {
    console.error("❌ Fatal Porter Error:", error.message);
  } finally {
    await Promise.all([backofficeClient.end(), powerbiClient.end()]);
  }
}

portTruth();
