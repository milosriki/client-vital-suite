import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client as PostgresClient } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { getRDSConfig } from "../_shared/rds-client.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";

/**
 * AWS SESSION SYNC — Full Training History
 *
 * Syncs ALL session records from AWS RDS vw_schedulers → Supabase training_sessions_live.
 * This is the source of truth for:
 *   - How many sessions each client has done (all time)
 *   - Which coaches trained which clients
 *   - Session frequency and recency
 *   - Full training history per client/coach pair
 *
 * Flow: AWS RDS (READ-ONLY) → Supabase training_sessions_live (UPSERT)
 * Batched in 500-row chunks to avoid edge function timeout.
 *
 * Params (query string):
 *   - mode: "full" (default) | "incremental" (last 90 days only)
 *   - limit: max rows (default 50000)
 */

const BATCH_SIZE = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    verifyAuth(req);
  } catch {
    throw new UnauthorizedError();
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "full";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50000, 100000);

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let rdsClient: PostgresClient | null = null;

  try {
    // 1. Connect to AWS RDS
    const config = getRDSConfig("backoffice");
    if (!config.password) {
      return apiError("CONFIG_ERROR", "RDS password not configured", 500);
    }
    rdsClient = new PostgresClient(config);
    await rdsClient.connect();
    console.log(`[aws-session-sync] Connected to AWS RDS. Mode: ${mode}`);

    // 2. Fetch sessions from AWS — lightweight query, no heavy JOINs
    const dateFilter = mode === "incremental"
      ? "AND s.training_date_utc > NOW() - INTERVAL '90 days'"
      : mode === "recent"
      ? "AND s.training_date_utc > NOW() - INTERVAL '30 days'"
      : "";

    // First try to get column info - vw_schedulers may have client_name or may need JOIN
    // Use lightweight query with just the scheduler view + client master for names
    const result = await rdsClient.queryObject(`
      SELECT
        s.id_scheduler::text AS rds_id,
        s.id_client::text AS client_id,
        COALESCE(m.full_name, m.email, 'Client-' || s.id_client::text) AS client_name,
        m.email AS client_email,
        s.id_trainer::text AS coach_id,
        s.trainer_name AS coach_name,
        s.training_date_utc AS training_date,
        s.status,
        s.type_session AS session_type,
        s.time_slot,
        s.location_name AS location
      FROM enhancesch.vw_schedulers s
      LEFT JOIN enhancesch.vw_client_master m ON s.id_client = m.id_client
      WHERE (s.status IN ('Completed', 'Attended', 'Confirmed', 'No Show') OR s.status LIKE 'Cancelled-%')
      ${dateFilter}
      ORDER BY s.training_date_utc DESC
      LIMIT ${limit}
    `);

    const rows = result.rows as any[];
    console.log(`[aws-session-sync] Fetched ${rows.length} session records from AWS.`);

    if (rows.length === 0) {
      return apiSuccess({
        synced: 0,
        mode,
        duration_ms: Date.now() - startTime,
      });
    }

    // 3. Deduplicate by rds_id (vw_client_packages join can create duplicates)
    const seen = new Set<string>();
    const dedupedRows = rows.filter((r) => {
      if (!r.rds_id || seen.has(r.rds_id)) return false;
      seen.add(r.rds_id);
      return true;
    });
    console.log(`[aws-session-sync] After dedup: ${dedupedRows.length} unique sessions.`);

    // 4. Upsert in batches
    let synced = 0;
    let errors = 0;

    for (let i = 0; i < dedupedRows.length; i += BATCH_SIZE) {
      const batch = dedupedRows.slice(i, i + BATCH_SIZE).map((r: any) => ({
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
        package_code: r.package_code ?? null,
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
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[aws-session-sync] Done. Synced: ${synced}, Errors: ${errors}, Duration: ${duration}ms`);

    // 5. Log sync
    await supabase.from("sync_logs").insert({
      source: "aws-session-sync",
      status: errors > 0 ? "partial" : "success",
      records_synced: synced,
      details: {
        mode,
        total_fetched: rows.length,
        deduped: dedupedRows.length,
        synced,
        errors,
        duration_ms: duration,
      },
    }).catch(() => {});

    return apiSuccess({
      synced,
      errors,
      total_fetched: rows.length,
      deduped: dedupedRows.length,
      mode,
      duration_ms: duration,
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[aws-session-sync] Fatal:`, msg);
    return apiError("SYNC_ERROR", msg, 500);
  } finally {
    if (rdsClient) {
      await rdsClient.end().catch(() => {});
    }
  }
});
