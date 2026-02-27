#!/usr/bin/env node
/**
 * AWS Session Sync — Local Script
 *
 * Runs on Milos's machine (IP whitelisted) to sync ALL session history
 * from AWS RDS vw_schedulers → Supabase training_sessions_live.
 *
 * Usage:
 *   node scripts/sync-aws-sessions.mjs                # Full sync
 *   node scripts/sync-aws-sessions.mjs --mode=recent  # Last 30 days
 *   node scripts/sync-aws-sessions.mjs --mode=incremental  # Last 90 days
 *
 * Requires: npm install pg @supabase/supabase-js (in project root)
 */

import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client: PGClient } = pg;

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var required`);
  return value;
};

// Config
const RDS_CONFIG = {
  host: process.env.RDS_HOST || "ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com",
  port: Number(process.env.RDS_PORT || 5432),
  user: process.env.RDS_USER || "4revops",
  password: requiredEnv("RDS_PASSWORD"),
  database: process.env.RDS_DATABASE || "ptd",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
  query_timeout: 60000,
};

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ztjndilxurtsfqdsvfds.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY env var required");

const BATCH_SIZE = 500;

async function main() {
  const args = process.argv.slice(2);
  const modeArg = args.find((a) => a.startsWith("--mode="));
  const mode = modeArg ? modeArg.split("=")[1] : "full";

  console.log(`[aws-session-sync] Starting ${mode} sync...`);
  const startTime = Date.now();

  // 1. Connect to AWS RDS
  const rds = new PGClient(RDS_CONFIG);
  await rds.connect();
  console.log("[aws-session-sync] Connected to AWS RDS.");

  // 2. Connect to Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // 3. Build query with date filter
    const dateFilter =
      mode === "recent" ? "AND s.training_date_utc > NOW() - INTERVAL '30 days'"
      : mode === "incremental" ? "AND s.training_date_utc > NOW() - INTERVAL '90 days'"
      : ""; // full = all time

    const query = `
      SELECT
        s.session_id::text AS rds_id,
        s.id_client::text AS client_id,
        COALESCE(m.full_name, m.email, s.client_name, 'Client-' || s.id_client::text) AS client_name,
        m.email AS client_email,
        s.id_personal::text AS coach_id,
        s.trainer_name AS coach_name,
        s.training_date_utc AS training_date,
        s.status,
        s.session_type,
        NULL AS time_slot,
        NULL AS location
      FROM enhancesch.vw_schedulers s
      LEFT JOIN enhancesch.vw_client_master m ON s.id_client = m.id_client
      WHERE s.status IN ('Completed', 'Attended', 'Confirmed', 'Cancelled', 'No Show')
      ${dateFilter}
      ORDER BY s.training_date_utc DESC
    `;

    console.log("[aws-session-sync] Fetching sessions from AWS...");
    const result = await rds.query(query);
    console.log(`[aws-session-sync] Fetched ${result.rows.length} rows.`);

    // 4. Deduplicate by rds_id
    const seen = new Set();
    const rows = result.rows.filter((r) => {
      if (!r.rds_id || seen.has(r.rds_id)) return false;
      seen.add(r.rds_id);
      return true;
    });
    console.log(`[aws-session-sync] After dedup: ${rows.length} unique sessions.`);

    // 5. Upsert in batches
    let synced = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE).map((r) => ({
        rds_id: String(r.rds_id),
        client_id: r.client_id ? String(r.client_id) : null,
        client_name: r.client_name ?? null,
        client_email: r.client_email ?? null,
        coach_id: r.coach_id ? String(r.coach_id) : null,
        coach_name: r.coach_name ?? null,
        training_date: r.training_date ?? null,
        status: r.status ?? null,
        session_type: r.session_type ?? null,
        time_slot: r.time_slot ?? null,
        location: r.location ?? null,
        synced_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("training_sessions_live")
        .upsert(batch, { onConflict: "rds_id" });

      if (error) {
        console.error(`[aws-session-sync] Batch ${Math.floor(i / BATCH_SIZE)} error:`, error.message);
        errors++;
      } else {
        synced += batch.length;
        if ((i / BATCH_SIZE) % 10 === 0) {
          console.log(`[aws-session-sync] Progress: ${synced}/${rows.length} synced...`);
        }
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n[aws-session-sync] DONE.`);
    console.log(`  Mode: ${mode}`);
    console.log(`  Fetched: ${result.rows.length}`);
    console.log(`  Deduped: ${rows.length}`);
    console.log(`  Synced: ${synced}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Duration: ${duration}s`);

    // 6. Log to sync_logs
    const { error: logErr } = await supabase.from("sync_logs").insert({
      source: "aws-session-sync-local",
      status: errors > 0 ? "partial" : "success",
      records_synced: synced,
      details: { mode, fetched: result.rows.length, deduped: rows.length, synced, errors, duration_s: duration },
    });
    if (logErr) console.warn("[aws-session-sync] Log warning:", logErr.message);

  } finally {
    await rds.end();
  }
}

main().catch((e) => {
  console.error("[aws-session-sync] FATAL:", e.message);
  process.exit(1);
});
