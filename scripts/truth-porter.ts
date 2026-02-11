import pkg from 'pg';
const { Client: PostgresClient } = pkg;
import { createClient } from "@supabase/supabase-js";

/**
 * PTD TRUTH PORTER (v5.5)
 * Runs locally from office (allowlisted IP) to bridge BOTH AWS RDS Replicas -> Supabase Cache.
 */

const REPLICAS = {
  backoffice: {
    host: "ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com",
    port: 5432,
    user: "ptd-milos",
    password: process.env.RDS_BACKOFFICE_PASSWORD,
    database: "ptd",
    ssl: { rejectUnauthorized: false }
  },
  powerbi: {
    host: "ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com",
    port: 5432,
    user: "4revops",
    password: process.env.RDS_POWERBI_PASSWORD,
    database: "ptd",
    ssl: { rejectUnauthorized: false }
  }
};

const SUPABASE_URL = "https://ztjndilxurtsfqdsvfds.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!REPLICAS.backoffice.password || !REPLICAS.powerbi.password || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing environment variables: RDS_BACKOFFICE_PASSWORD, RDS_POWERBI_PASSWORD or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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
    const performanceResult = await powerbiClient.query(`
      SELECT 
        m.email,
        COUNT(CASE WHEN s.status IN ('Completed', 'Attended') THEN 1 END) as total_sessions_attended,
        COUNT(CASE WHEN s.status = 'Cancelled' THEN 1 END) as total_sessions_cancelled,
        SUM(p.amounttotal) as lifetime_revenue
      FROM enhancesch.vw_client_master m
      LEFT JOIN enhancesch.vw_schedulers s ON m.id_client = s.id_client
      LEFT JOIN enhancesch.vw_client_packages p ON m.id_client = p.id_client
      GROUP BY m.email
      LIMIT 1000
    `);

    const performanceMap = new Map(performanceResult.rows.map((r: any) => [r.email, r]));
    console.log(`✅ Extracted data for ${sessionResult.rows.length} clients.`);

    // 3. Push to Supabase Cache (Batch)
    console.log("📤 Pushing Calibrated Truth to Supabase Mirror...");
    
    // Deduplicate by email
    const uniqueBatch = Array.from(new Map(
      (sessionResult.rows as any[]).map(row => [row.email, {
        email: row.email,
        full_name: row.full_name,
        outstanding_sessions: row.outstanding_sessions,
        package_name: row.package_name,
        last_session_date: row.last_session_date,
        updated_at: new Date().toISOString()
      }])
    ).values());

    console.log(`📤 Pushing ${uniqueBatch.length} unique CORE Truth records...`);
    const { error: coreError } = await supabase
      .from('aws_truth_cache')
      .upsert(uniqueBatch, { onConflict: 'email' });

    if (coreError) {
      console.error(`❌ Core Sync Failed:`, coreError.message);
    } else {
      console.log(`✅ Successfully synced CORE records.`);
    }

    console.log("🏆 Truth Alignment Complete. Dashboards are now SUPREME.");

  } catch (error) {
    console.error("❌ Fatal Porter Error:", error.message);
  } finally {
    await Promise.all([backofficeClient.end(), powerbiClient.end()]);
  }
}

portTruth();
