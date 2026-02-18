import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client as PostgresClient } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { getRDSConfig } from "../_shared/rds-client.ts";

/**
 * OPS SNAPSHOT — Pull real-time numbers from AWS RDS
 * 
 * Returns: training sessions last 3 days, coach capacity, package alerts,
 * frequency trends, assessments today/tomorrow/day-after, and more.
 * 
 * ALL AWS operations are READ-ONLY.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  const startTime = Date.now();
  let rdsClient: PostgresClient | null = null;

  try {
    const config = getRDSConfig("backoffice");
    if (!config.password) {
      return apiError("CONFIG_ERROR", "RDS_BACKOFFICE_PASSWORD not set", 500);
    }
    rdsClient = new PostgresClient(config);
    await rdsClient.connect();

    // 1. TRAINING SESSIONS LAST 3 DAYS — by coach, by status
    const sessionsLast3Days = await rdsClient.queryObject(`
      SELECT 
        s.trainer_name AS coach,
        s.training_date_utc::date AS training_date,
        COUNT(*) AS total_sessions,
        COUNT(*) FILTER (WHERE s.status IN ('Completed', 'Attended')) AS completed,
        COUNT(*) FILTER (WHERE s.status = 'No Show') AS no_shows,
        COUNT(*) FILTER (WHERE s.status = 'Cancelled') AS cancelled,
        COUNT(*) FILTER (WHERE s.status IN ('Scheduled', 'Confirmed')) AS scheduled
      FROM enhancesch.vw_schedulers s
      WHERE s.training_date_utc::date >= CURRENT_DATE - INTERVAL '3 days'
        AND s.training_date_utc::date <= CURRENT_DATE
        AND s.trainer_name IS NOT NULL
        AND s.trainer_name != ''
      GROUP BY s.trainer_name, s.training_date_utc::date
      ORDER BY s.training_date_utc::date DESC, total_sessions DESC
    `);

    // 2. COACH CAPACITY — average paid slots per day (last 30 days)
    const coachCapacity = await rdsClient.queryObject(`
      WITH daily_counts AS (
        SELECT 
          s.trainer_name AS coach,
          s.training_date_utc::date AS d,
          COUNT(*) AS sessions
        FROM enhancesch.vw_schedulers s
        WHERE s.training_date_utc::date >= CURRENT_DATE - INTERVAL '30 days'
          AND s.status IN ('Completed', 'Attended')
          AND s.trainer_name IS NOT NULL
          AND s.trainer_name != ''
        GROUP BY s.trainer_name, s.training_date_utc::date
      )
      SELECT 
        coach,
        ROUND(AVG(sessions), 1) AS avg_sessions_per_day,
        MAX(sessions) AS max_sessions_day,
        MIN(sessions) AS min_sessions_day,
        COUNT(DISTINCT d) AS active_days,
        SUM(sessions) AS total_sessions_30d
      FROM daily_counts
      GROUP BY coach
      ORDER BY avg_sessions_per_day DESC
    `);

    // 3. PACKAGE RUNNING LOW — 5 or fewer sessions remaining
    const packageRunningLow = await rdsClient.queryObject(`
      SELECT 
        m.full_name AS client_name,
        m.email,
        p.name_packet AS package_name,
        p.remainingsessions AS sessions_left,
        p.packsize AS total_purchased,
        p.amounttotal AS package_value,
        (
          SELECT s.trainer_name
          FROM enhancesch.vw_schedulers s
          WHERE s.id_client = m.id_client
            AND s.status IN ('Completed', 'Attended')
          ORDER BY s.training_date_utc DESC LIMIT 1
        ) AS coach,
        (
          SELECT MAX(s.training_date_utc)
          FROM enhancesch.vw_schedulers s
          WHERE s.id_client = m.id_client
            AND s.status IN ('Completed', 'Attended')
        ) AS last_session
      FROM enhancesch.vw_client_master m
      JOIN enhancesch.vw_client_packages p ON m.id_client = p.id_client
      WHERE p.remainingsessions BETWEEN 1 AND 5
        AND p.remainingsessions > 0
      ORDER BY p.remainingsessions ASC, p.amounttotal DESC
      LIMIT 200
    `);

    // 4. FREQUENCY TREND — sessions per week, last 4 weeks vs prior 4 weeks
    const frequencyTrend = await rdsClient.queryObject(`
      WITH weekly AS (
        SELECT 
          s.id_client,
          CASE 
            WHEN s.training_date_utc >= CURRENT_DATE - INTERVAL '28 days' THEN 'recent'
            ELSE 'prior'
          END AS period,
          COUNT(*) AS sessions,
          COUNT(DISTINCT date_trunc('week', s.training_date_utc)) AS weeks
        FROM enhancesch.vw_schedulers s
        WHERE s.training_date_utc >= CURRENT_DATE - INTERVAL '56 days'
          AND s.status IN ('Completed', 'Attended')
        GROUP BY s.id_client, 
          CASE WHEN s.training_date_utc >= CURRENT_DATE - INTERVAL '28 days' THEN 'recent' ELSE 'prior' END
      ),
      compared AS (
        SELECT 
          r.id_client,
          COALESCE(r.sessions::numeric / NULLIF(r.weeks, 0), 0) AS recent_per_week,
          COALESCE(p.sessions::numeric / NULLIF(p.weeks, 0), 0) AS prior_per_week
        FROM weekly r
        LEFT JOIN weekly p ON r.id_client = p.id_client AND p.period = 'prior'
        WHERE r.period = 'recent'
      )
      SELECT 
        COUNT(*) FILTER (WHERE recent_per_week > prior_per_week + 0.5) AS increasing,
        COUNT(*) FILTER (WHERE recent_per_week < prior_per_week - 0.5) AS decreasing,
        COUNT(*) FILTER (WHERE ABS(recent_per_week - prior_per_week) <= 0.5) AS stable,
        COUNT(*) AS total_active_clients
      FROM compared
    `);

    // 5. ASSESSMENTS TODAY / TOMORROW / DAY AFTER
    const assessments = await rdsClient.queryObject(`
      SELECT 
        s.training_date_utc::date AS assessment_date,
        s.training_date_utc AS exact_time,
        s.id_client,
        s.client_name,
        s.trainer_name AS coach,
        s.status,
        s.name_packet
      FROM enhancesch.vw_schedulers s
      WHERE s.training_date_utc::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '2 days'
        AND (
          LOWER(s.name_packet) LIKE '%assessment%'
          OR LOWER(s.name_packet) LIKE '%trial%'
          OR LOWER(s.name_packet) LIKE '%intro%'
          OR LOWER(s.name_packet) LIKE '%consultation%'
        )
      ORDER BY s.training_date_utc ASC
    `);

    // 6. RENEWAL PROJECTION — who should renew in next 15 days
    // Based on consumption velocity: sessions_used / weeks_active → projected depletion date
    const renewalProjection = await rdsClient.queryObject(`
      WITH consumption AS (
        SELECT 
          m.id_client,
          m.full_name,
          m.email,
          p.name_packet,
          p.packsize,
          p.remainingsessions,
          p.amounttotal,
          (
            SELECT s.trainer_name
            FROM enhancesch.vw_schedulers s
            WHERE s.id_client = m.id_client AND s.status IN ('Completed', 'Attended')
            ORDER BY s.training_date_utc DESC LIMIT 1
          ) AS coach,
          (
            SELECT COUNT(*)
            FROM enhancesch.vw_schedulers s
            WHERE s.id_client = m.id_client 
              AND s.status IN ('Completed', 'Attended')
              AND s.training_date_utc >= CURRENT_DATE - INTERVAL '28 days'
          ) AS sessions_last_28d
        FROM enhancesch.vw_client_master m
        JOIN enhancesch.vw_client_packages p ON m.id_client = p.id_client
        WHERE p.remainingsessions > 0
          AND p.remainingsessions <= 15
      )
      SELECT 
        full_name, email, name_packet, packsize, remainingsessions, amounttotal, coach,
        sessions_last_28d,
        CASE 
          WHEN sessions_last_28d > 0 THEN
            ROUND(remainingsessions::numeric / (sessions_last_28d::numeric / 28) )
          ELSE NULL
        END AS days_until_depleted
      FROM consumption
      WHERE sessions_last_28d > 0
      ORDER BY 
        CASE WHEN sessions_last_28d > 0 THEN remainingsessions::numeric / (sessions_last_28d::numeric / 28) ELSE 999 END ASC
      LIMIT 100
    `);

    // 7. OVERALL STATS — totals
    const overallStats = await rdsClient.queryObject(`
      SELECT 
        COUNT(*) FILTER (WHERE s.training_date_utc::date = CURRENT_DATE) AS sessions_today,
        COUNT(*) FILTER (WHERE s.training_date_utc::date = CURRENT_DATE AND s.status IN ('Completed', 'Attended')) AS completed_today,
        COUNT(*) FILTER (WHERE s.training_date_utc::date = CURRENT_DATE AND s.status = 'No Show') AS no_shows_today,
        COUNT(*) FILTER (WHERE s.training_date_utc::date = CURRENT_DATE - 1) AS sessions_yesterday,
        COUNT(*) FILTER (WHERE s.training_date_utc::date = CURRENT_DATE - 2) AS sessions_2d_ago,
        COUNT(DISTINCT s.id_client) FILTER (WHERE s.training_date_utc >= CURRENT_DATE - INTERVAL '7 days' AND s.status IN ('Completed', 'Attended')) AS active_clients_7d,
        COUNT(DISTINCT s.trainer_name) FILTER (WHERE s.training_date_utc::date = CURRENT_DATE) AS coaches_active_today
      FROM enhancesch.vw_schedulers s
      WHERE s.training_date_utc >= CURRENT_DATE - INTERVAL '3 days'
    `);

    await rdsClient.end();

    return apiSuccess({
      generated_at: new Date().toISOString(),
      runtime_ms: Date.now() - startTime,
      overall: overallStats.rows[0] || {},
      sessions_last_3_days: sessionsLast3Days.rows,
      coach_capacity: coachCapacity.rows,
      package_running_low: packageRunningLow.rows,
      frequency_trend: frequencyTrend.rows[0] || {},
      assessments_next_3_days: assessments.rows,
      renewal_projection_15d: renewalProjection.rows,
    });

  } catch (error) {
    if (rdsClient) await rdsClient.end().catch(() => {});
    console.error("[ops-snapshot] Error:", error);
    return apiError("SNAPSHOT_ERROR", error.message, 500);
  }
});
