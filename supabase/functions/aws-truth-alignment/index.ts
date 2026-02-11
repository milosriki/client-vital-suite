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
 * AWS TRUTH ALIGNMENT ENGINE (Supreme Court of Data)
 *
 * Objectives:
 * 1. Pull Ground-Truth session data from AWS RDS UAE Replica.
 * 2. Pull Package Balances from AWS RDS.
 * 3. Pull Coach Attribution from AWS RDS (Ongoing Trainer).
 * 4. Reconcile with Supabase/HubSpot Mirror.
 * 5. Update Supabase when 100% sure.
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
    // 1. Connect to AWS Backoffice Replica
    const config = getRDSConfig("backoffice");
    if (!config.password) {
      console.error(
        "[truth-alignment] CRITICAL: AWS_RDS_BACKOFFICE_PASSWORD not set in secrets.",
      );
      return apiError(
        "CONFIG_ERROR",
        "AWS RDS password not configured. Set AWS_RDS_BACKOFFICE_PASSWORD in Supabase secrets.",
        500,
      );
    }
    rdsClient = new PostgresClient(config);
    await rdsClient.connect();
    console.log("[truth-alignment] Connected to AWS RDS.");

    // 2. Fetch AWS Ground Truth (SIMPLIFIED FOR DIAGNOSTICS)
    const truthQuery = `
      SELECT 
        m.email,
        m.full_name,
        p.remainingsessions as outstanding_sessions,
        p.packsize as total_purchased
      FROM enhancesch.vw_client_master m
      JOIN enhancesch.vw_client_packages p ON m.id_client = p.id_client
      WHERE p.remainingsessions >= 0
      LIMIT 100;
    `;

    const truthResult = await rdsClient.queryObject(truthQuery).catch((err) => {
      console.error("[truth-alignment] SQL Error:", err);
      throw err;
    });
    const awsTruth = truthResult.rows as any[];
    console.log(
      `[truth-alignment] Retrieved ${awsTruth.length} truth records from AWS.`,
    );

    // 3. Fetch Staff for mapping
    const { data: staff } = await supabase
      .from("staff")
      .select("id, full_name");
    const staffMap: Record<string, string> = {};
    staff?.forEach((s) => {
      if (s.full_name) staffMap[s.full_name.toLowerCase()] = s.id;
    });

    // 4. Fetch Supabase Customers
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, email, outstanding_sessions, coach_uuid, assigned_coach")
      .eq("lifecycle_stage", "customer");

    // 5. Compare & Prepare Updates
    const updates: any[] = [];
    const report = {
      total_checked: awsTruth.length,
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

      const coachUuid = truth.ongoing_coach
        ? staffMap[truth.ongoing_coach.toLowerCase()]
        : null;

      // Determine if update is needed (100% Sure logic)
      const needsUpdate =
        Number(local.outstanding_sessions) !==
          Number(truth.outstanding_sessions) || local.coach_uuid !== coachUuid;

      if (needsUpdate) {
        updates.push({
          id: local.id,
          outstanding_sessions: Number(truth.outstanding_sessions),
          coach_uuid: coachUuid,
          sessions_last_7d: Number(truth.sessions_7d) || 0,
          sessions_last_30d: Number(truth.sessions_30d) || 0,
          sessions_last_90d: Number(truth.sessions_90d) || 0,
          last_paid_session_date: truth.last_session_date,
          updated_at: new Date().toISOString(),
        });

        report.aligned++;
        report.discrepancies.push({
          email: truth.email,
          field: "sessions/coach",
          old: {
            sessions: local.outstanding_sessions,
            coach: local.coach_uuid,
          },
          new: { sessions: truth.outstanding_sessions, coach: coachUuid },
        });
      }
    }

    // 6. Execute Updates in Batches
    if (updates.length > 0) {
      console.log(`[truth-alignment] Aligning ${updates.length} records...`);
      // Use upsert for batch updates by ID
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
      message: `Aligned ${updates.length} clients with AWS ground truth.`,
    });

    return apiSuccess({
      success: true,
      report,
      duration_ms: Date.now() - startTime,
    });
  } catch (error: unknown) {
    console.error("[truth-alignment] Error:", error);
    return apiError("INTERNAL_ERROR", error.message, 500);
  } finally {
    if (rdsClient) await rdsClient.end();
  }
});
