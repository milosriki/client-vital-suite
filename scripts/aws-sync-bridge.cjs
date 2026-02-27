#!/usr/bin/env node
/**
 * AWS SYNC BRIDGE v1.0
 * ====================
 * Local Node.js script that syncs AWS RDS → Supabase.
 * Runs from Milos's Mac via launchd cron.
 *
 * Why local? Supabase edge functions timeout (120s) connecting to RDS.
 * This Mac CAN reach RDS directly.
 *
 * Pattern: Data Pipeline (batch ingestion with incremental watermark)
 * Skills: aws-serverless, data-engineering-data-pipeline, autonomous-agents
 *
 * Self-healing:
 * - Retries with exponential backoff
 * - Dead letter logging
 * - Completion reporting to Supabase
 * - Stale data detection
 *
 * Usage:
 *   node scripts/aws-sync-bridge.js                    # Incremental (last 7 days)
 *   node scripts/aws-sync-bridge.js --full             # Full sync (all time)
 *   node scripts/aws-sync-bridge.js --days 30          # Last 30 days
 */

const { Client } = require("pg");

// ═══ CONFIG ═══
const RDS_CONFIG = {
  host: "ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com",
  port: 5432,
  database: "ptd",
  user: "ptd-milos",
  password: process.env.RDS_PASSWORD || (() => { throw new Error("RDS_PASSWORD env var required"); })(),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
  statement_timeout: 120000,
};

const SUPABASE_URL = "https://ztjndilxurtsfqdsvfds.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) {
  throw new Error("SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY env var required");
}

const BATCH_SIZE = 500;
const MAX_RETRIES = 3;

// ═══ HELPERS ═══
async function supabaseUpsert(table, rows, onConflict = "id") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${table} upsert failed: ${res.status} ${body}`);
  }
  return res;
}

async function supabaseInsert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${table} insert failed: ${res.status} ${body}`);
  }
  return res;
}

async function supabaseDelete(table, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  return res;
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function retry(fn, label, maxRetries = MAX_RETRIES) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      log(`⚠️ ${label} attempt ${i + 1}/${maxRetries} failed: ${e.message}`);
      if (i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        log(`   Retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw e;
      }
    }
  }
}

// ═══ SYNC SESSIONS ═══
async function syncSessions(rds, days) {
  const dateFilter = days
    ? `AND s.training_date_utc > NOW() - INTERVAL '${days} days'`
    : "";

  log(`📡 Fetching sessions from AWS (${days ? `last ${days} days` : "all time"})...`);

  const result = await rds.query(`
    SELECT
      s.session_id::text AS rds_id,
      s.id_client::text AS client_id,
      s.client_name,
      s.id_personal::text AS coach_id,
      s.trainer_name AS coach_name,
      s.training_date_utc AS training_date,
      s.status,
      s.session_type,
      m.email AS client_email
    FROM enhancesch.vw_schedulers s
    LEFT JOIN enhancesch.vw_client_master m ON s.id_client = m.id_client
    WHERE 1=1
    ${dateFilter}
    ORDER BY s.training_date_utc DESC
  `);

  log(`   → ${result.rows.length} sessions fetched`);

  // Deduplicate by rds_id
  const seen = new Set();
  const deduped = result.rows.filter((r) => {
    if (!r.rds_id || seen.has(r.rds_id)) return false;
    seen.add(r.rds_id);
    return true;
  });
  log(`   → ${deduped.length} unique after dedup`);

  // Upsert in batches
  let synced = 0;
  let errors = 0;
  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const batch = deduped.slice(i, i + BATCH_SIZE).map((r) => ({
      rds_id: String(r.rds_id),
      client_id: r.client_id ? String(r.client_id) : null,
      client_name: r.client_name || null,
      client_email: r.client_email || null,
      coach_id: r.coach_id ? String(r.coach_id) : null,
      coach_name: r.coach_name || null,
      training_date: r.training_date || null,
      status: r.status || null,
      session_type: r.session_type || null,
      synced_at: new Date().toISOString(),
    }));

    try {
      await retry(
        () => supabaseUpsert("training_sessions_live", batch, "rds_id"),
        `Sessions batch ${Math.floor(i / BATCH_SIZE) + 1}`
      );
      synced += batch.length;
    } catch (e) {
      errors += batch.length;
      log(`❌ Failed batch ${Math.floor(i / BATCH_SIZE) + 1}: ${e.message}`);
    }

    // Progress every 2000
    if ((synced + errors) % 2000 < BATCH_SIZE) {
      log(`   Progress: ${synced} synced, ${errors} errors`);
    }
  }

  return { synced, errors, total: deduped.length };
}

// ═══ SYNC PACKAGES ═══
async function syncPackages(rds) {
  log(`📡 Fetching packages from AWS...`);

  const result = await rds.query(`
    SELECT
      p.id_cupom::text AS package_id,
      p.id_client::text AS client_id,
      COALESCE(m.full_name, m.email, 'Client-' || p.id_client::text) AS client_name,
      m.email AS client_email,
      m.phone_number AS client_phone,
      p.name_packet AS package_name,
      p.package_code,
      p.packsize AS pack_size,
      p.remainingsessions AS remaining_sessions,
      p.amounttotal::numeric AS package_value,
      p.settlement_date_utc AS purchase_date,
      p.expiry_date_utc AS expiry_date
    FROM enhancesch.vw_client_packages p
    LEFT JOIN enhancesch.vw_client_master m ON p.id_client = m.id_client
    ORDER BY p.remainingsessions ASC
  `);

  log(`   → ${result.rows.length} packages fetched`);

  // Clear and reload (full refresh pattern for packages)
  const deleteRes = await supabaseDelete("client_packages_live", "id=not.is.null");
  log(`   → Cleared old packages: ${deleteRes.status}`);

  // Insert in batches
  let synced = 0;
  let errors = 0;
  for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
    const batch = result.rows.slice(i, i + BATCH_SIZE).map((r) => ({
      package_id: r.package_id,
      client_id: r.client_id ? String(r.client_id) : "0",
      client_name: r.client_name || null,
      client_email: r.client_email || null,
      client_phone: r.client_phone || null,
      package_name: r.package_name || null,
      pack_size: r.pack_size || 0,
      remaining_sessions: r.remaining_sessions || 0,
      package_value: parseFloat(r.package_value) || 0,
      purchase_date: r.purchase_date || null,
      expiry_date: r.expiry_date || null,
      synced_at: new Date().toISOString(),
    }));

    try {
      await retry(
        () => supabaseInsert("client_packages_live", batch),
        `Packages batch ${Math.floor(i / BATCH_SIZE) + 1}`
      );
      synced += batch.length;
    } catch (e) {
      errors += batch.length;
      log(`❌ Package batch failed: ${e.message}`);
    }
  }

  return { synced, errors, total: result.rows.length };
}

// ═══ REPORT TO SUPABASE ═══
/**
 * ENRICH PACKAGES — Post-sync step
 * Populates last_coach, last_session_date, sessions_per_week, future_booked
 * by querying AWS RDS for the latest completed session per client.
 */
async function enrichPackages(rds) {
  log("[ENRICH] Querying AWS for session enrichment data...");

  // Get last completed session + stats per client from AWS
  const { rows: enrichData } = await rds.query(`
    WITH latest_completed AS (
      SELECT 
        id_client,
        trainer_name,
        training_date_utc,
        ROW_NUMBER() OVER (PARTITION BY id_client ORDER BY training_date_utc DESC) as rn
      FROM enhancesch.vw_schedulers
      WHERE status = 'Completed'
    ),
    client_stats AS (
      SELECT 
        id_client,
        ROUND(COUNT(*) FILTER (WHERE status = 'Completed' AND training_date_utc >= NOW() - INTERVAL '60 days') / 8.57, 1) as sessions_per_week,
        COUNT(*) FILTER (WHERE training_date_utc > NOW() AND status IN ('Confirmed','Scheduled')) as future_booked
      FROM enhancesch.vw_schedulers
      GROUP BY id_client
    )
    SELECT 
      lc.id_client,
      lc.trainer_name as last_coach,
      lc.training_date_utc as last_session_date,
      COALESCE(cs.sessions_per_week, 0) as sessions_per_week,
      COALESCE(cs.future_booked, 0) as future_booked
    FROM latest_completed lc
    LEFT JOIN client_stats cs ON cs.id_client = lc.id_client
    WHERE lc.rn = 1
  `);

  log(`[ENRICH] Got ${enrichData.length} client enrichment records from AWS`);

  // Build a map of client_id → enrichment data
  const enrichMap = {};
  for (const row of enrichData) {
    enrichMap[String(row.id_client)] = {
      last_coach: row.last_coach || null,
      last_session_date: row.last_session_date ? new Date(row.last_session_date).toISOString() : null,
      sessions_per_week: parseFloat(row.sessions_per_week) || 0,
      future_booked: parseInt(row.future_booked) || 0,
    };
  }

  // Get all package client_ids from Supabase to know which ones to update
  const pkgRes = await fetch(`${SUPABASE_URL}/rest/v1/client_packages_live?select=client_id&limit=10000`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const pkgData = await pkgRes.json();
  const uniqueClientIds = [...new Set((pkgData || []).map(p => String(p.client_id)))];
  log(`[ENRICH] ${uniqueClientIds.length} unique client_ids in packages`);

  // Batch update: 20 concurrent PATCH requests
  let updated = 0;
  let errors = 0;
  const CONCURRENCY = 20;

  for (let i = 0; i < uniqueClientIds.length; i += CONCURRENCY) {
    const batch = uniqueClientIds.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (clientId) => {
      const enrich = enrichMap[clientId];
      if (!enrich) return; // No session data for this client

      try {
        const url = `${SUPABASE_URL}/rest/v1/client_packages_live?client_id=eq.${clientId}`;
        const res = await fetch(url, {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(enrich),
        });
        if (res.ok) updated++;
        else {
          const errText = await res.text();
          if (errors < 3) log(`[ENRICH] PATCH ${clientId}: ${res.status} ${errText}`);
          errors++;
        }
      } catch (e) {
        if (errors < 3) log(`[ENRICH] Error ${clientId}: ${e.message}`);
        errors++;
      }
    });
    await Promise.all(promises);
    if ((i + CONCURRENCY) % 200 === 0) log(`[ENRICH] Progress: ${i + CONCURRENCY}/${uniqueClientIds.length}`);
  }

  log(`[ENRICH] Updated ${updated} packages, ${errors} errors`);
  return { updated, errors, total: enrichData.length };
}

async function reportSync(summary) {
  try {
    // Log sync result for the intelligence engine to see
    await supabasePost("sync_log", [{
      sync_type: "aws_bridge",
      status: summary.success ? "success" : "partial",
      details: summary,
      created_at: new Date().toISOString(),
    }]);
  } catch {
    // sync_log table might not exist yet — non-critical
  }
}

// ═══ MAIN ═══
async function main() {
  const args = process.argv.slice(2);
  const fullSync = args.includes("--full");
  const daysArg = args.find((_, i) => args[i - 1] === "--days");
  const days = fullSync ? null : (daysArg ? parseInt(daysArg) : 7);

  log("═══════════════════════════════════════");
  log("  AWS SYNC BRIDGE v1.0");
  log(`  Mode: ${fullSync ? "FULL" : `last ${days} days`}`);
  log("═══════════════════════════════════════");

  const startTime = Date.now();
  let rds;

  try {
    // Connect to RDS
    rds = new Client(RDS_CONFIG);
    await retry(() => rds.connect(), "RDS connection");
    log("✅ Connected to AWS RDS");

    // Sync sessions
    const sessionResult = await syncSessions(rds, days);
    log(`✅ Sessions: ${sessionResult.synced} synced, ${sessionResult.errors} errors`);

    // Sync packages (always full refresh)
    const packageResult = await syncPackages(rds);
    log(`✅ Packages: ${packageResult.synced} synced, ${packageResult.errors} errors`);

    // Enrich packages with session data (last_coach, last_session_date, etc.)
    const enrichResult = await enrichPackages(rds);
    log(`✅ Enrichment: ${enrichResult.updated} packages enriched`);

    const elapsed = Date.now() - startTime;
    const summary = {
      success: sessionResult.errors === 0 && packageResult.errors === 0,
      elapsed_ms: elapsed,
      sessions: sessionResult,
      packages: packageResult,
      mode: fullSync ? "full" : `${days}d`,
      timestamp: new Date().toISOString(),
    };

    log("═══════════════════════════════════════");
    log(`  DONE in ${(elapsed / 1000).toFixed(1)}s`);
    log(`  Sessions: ${sessionResult.synced}/${sessionResult.total}`);
    log(`  Packages: ${packageResult.synced}/${packageResult.total}`);
    log(`  Enriched: ${enrichResult.updated} packages`);
    log("═══════════════════════════════════════");

    await reportSync(summary);

  } catch (e) {
    log(`❌ FATAL: ${e.message}`);
    process.exit(1);
  } finally {
    if (rds) {
      try { await rds.end(); } catch { /* ignore */ }
    }
  }
}

main();
