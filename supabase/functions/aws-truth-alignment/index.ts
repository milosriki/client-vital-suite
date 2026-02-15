import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client as PostgresClient } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { getRDSConfig } from "../_shared/rds-client.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";

/**
 * AWS TRUTH ALIGNMENT ENGINE
 *
 * ALL AWS operations are READ-ONLY. Data flows one way: AWS → Supabase.
 *
 * Steps:
 * 1. READ packages from AWS vw_client_packages (remaining sessions, pack size, amount)
 * 2. READ session stats from AWS vw_schedulers (coach, attended/cancelled counts, last session)
 * 3. WRITE to Supabase aws_truth_cache (view_contact_360 reads from this)
 * 4. UPDATE contacts.outstanding_sessions + assigned_coach where different
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    verifyAuth(req);
  } catch {
    throw new UnauthorizedError();
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let rdsClient: PostgresClient | null = null;

  try {
    // 1. Connect to AWS Backoffice Replica (READ-ONLY)
    const config = getRDSConfig("backoffice");
    if (!config.password) {
      console.error(
        "[truth-alignment] CRITICAL: RDS_BACKOFFICE_PASSWORD not set in secrets.",
      );
      return apiError(
        "CONFIG_ERROR",
        "AWS RDS password not configured. Set RDS_BACKOFFICE_PASSWORD in Supabase secrets.",
        500,
      );
    }
    rdsClient = new PostgresClient(config);
    await rdsClient.connect();
    console.log("[truth-alignment] Connected to AWS RDS (READ-ONLY).");

    // 2. READ packages + computed session stats from AWS
    // Joins vw_client_packages for balances + vw_schedulers for coach/session activity
    const truthQuery = `
      SELECT
        m.email,
        m.full_name,
        p.remainingsessions AS outstanding_sessions,
        p.packsize AS total_purchased,
        p.name_packet AS package_name,
        p.amounttotal AS lifetime_revenue,
        -- Coach: most recent trainer from vw_schedulers
        (
          SELECT s.trainer_name
          FROM enhancesch.vw_schedulers s
          WHERE s.id_client = m.id_client
            AND s.status IN ('Completed', 'Attended')
          ORDER BY s.training_date_utc DESC
          LIMIT 1
        ) AS coach_name,
        -- Last session date
        (
          SELECT MAX(s.training_date_utc)
          FROM enhancesch.vw_schedulers s
          WHERE s.id_client = m.id_client
            AND s.status IN ('Completed', 'Attended')
        ) AS last_session_date,
        -- Sessions attended (all time)
        (
          SELECT COUNT(*)
          FROM enhancesch.vw_schedulers s
          WHERE s.id_client = m.id_client
            AND s.status IN ('Completed', 'Attended')
        ) AS total_sessions_attended,
        -- Sessions cancelled (all time)
        (
          SELECT COUNT(*)
          FROM enhancesch.vw_schedulers s
          WHERE s.id_client = m.id_client
            AND s.status IN ('Cancelled', 'No Show')
        ) AS total_sessions_cancelled
      FROM enhancesch.vw_client_master m
      JOIN enhancesch.vw_client_packages p ON m.id_client = p.id_client
      WHERE p.remainingsessions >= 0
        AND m.email IS NOT NULL
      LIMIT 500;
    `;

    const truthResult = await rdsClient.queryObject(truthQuery).catch((err: Error) => {
      console.error("[truth-alignment] SQL Error:", err);
      throw err;
    });
    const awsTruth = truthResult.rows as any[];
    console.log(
      `[truth-alignment] Retrieved ${awsTruth.length} truth records from AWS.`,
    );

    // 3. WRITE to aws_truth_cache (view_contact_360 reads from this table)
    const cacheRows = awsTruth.map((truth: any) => ({
      email: truth.email.toLowerCase(),
      full_name: truth.full_name || null,
      outstanding_sessions: Number(truth.outstanding_sessions) || 0,
      package_name: truth.package_name || null,
      lifetime_revenue: Number(truth.lifetime_revenue) || 0,
      coach_name: truth.coach_name || null,
      last_session_date: truth.last_session_date || null,
      total_sessions_attended: Number(truth.total_sessions_attended) || 0,
      total_sessions_cancelled: Number(truth.total_sessions_cancelled) || 0,
      leak_score: truth.total_purchased > 0
        ? Math.round(
            ((Number(truth.total_purchased) - Number(truth.outstanding_sessions)) /
              Number(truth.total_purchased)) *
              100,
          )
        : null,
      updated_at: new Date().toISOString(),
    }));

    if (cacheRows.length > 0) {
      const { error: cacheError } = await supabase
        .from("aws_truth_cache")
        .upsert(cacheRows, { onConflict: "email" });

      if (cacheError) {
        console.error("[truth-alignment] Cache upsert error:", cacheError.message);
      } else {
        console.log(`[truth-alignment] Cached ${cacheRows.length} records to aws_truth_cache.`);
      }
    }

    // 4. Fetch Supabase Customers for contact alignment
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, email, outstanding_sessions, assigned_coach")
      .eq("lifecycle_stage", "customer");

    // 5. Compare & Prepare Contact Updates
    const updates: any[] = [];
    const report = {
      total_checked: awsTruth.length,
      cached: cacheRows.length,
      matched: 0,
      aligned: 0,
      discrepancies: [] as any[],
    };

    for (const truth of awsTruth) {
      if (!truth.email) continue;

      const local = contacts?.find(
        (c) => c.email?.toLowerCase() === truth.email.toLowerCase(),
      );
      if (!local) continue;

      report.matched++;

      const awsCoach = truth.coach_name || null;
      const awsSessions = Number(truth.outstanding_sessions) || 0;

      // Determine if contact update is needed
      const needsUpdate =
        Number(local.outstanding_sessions) !== awsSessions ||
        (awsCoach && local.assigned_coach !== awsCoach);

      if (needsUpdate) {
        const update: Record<string, unknown> = {
          id: local.id,
          outstanding_sessions: awsSessions,
          updated_at: new Date().toISOString(),
        };
        // Only update coach if AWS has a value
        if (awsCoach) {
          update.assigned_coach = awsCoach;
        }

        updates.push(update);
        report.aligned++;
        report.discrepancies.push({
          email: truth.email,
          field: "sessions/coach",
          old: {
            sessions: local.outstanding_sessions,
            coach: local.assigned_coach,
          },
          new: { sessions: awsSessions, coach: awsCoach },
        });
      }
    }

    // 6. Execute Contact Updates in Batches
    if (updates.length > 0) {
      console.log(`[truth-alignment] Aligning ${updates.length} contacts...`);
      const { error: updateError } = await supabase
        .from("contacts")
        .upsert(updates);

      if (updateError) throw updateError;
    }

    // 7. Log to Sync Logs
    await supabase.from("sync_logs").insert({
      platform: "aws_truth",
      sync_type: "alignment",
      status: "completed",
      records_processed: updates.length,
      message: `Cached ${cacheRows.length} to aws_truth_cache. Aligned ${updates.length} contacts.`,
    });

    return apiSuccess({
      success: true,
      report,
      duration_ms: Date.now() - startTime,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[truth-alignment] Error:", msg);
    return apiError("INTERNAL_ERROR", msg, 500);
  } finally {
    if (rdsClient) await rdsClient.end();
  }
});
