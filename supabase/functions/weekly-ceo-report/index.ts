import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";

/**
 * WEEKLY CEO REPORT
 * 
 * Aggregates:
 * 1. Total Revenue Booked (last 7 days).
 * 2. Average ROAS.
 * 3. Coach Leaderboard (based on avg health score).
 * 4. Discrepancy Alerts from Truth Engine.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    verifyAuth(req);
  } catch {
    throw new UnauthorizedError();
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString().split("T")[0];

    // 1. Aggregate Financials
    const { data: metrics } = await supabase
      .from("daily_business_metrics")
      .select("*")
      .gte("date", dateStr);

    const totalRevenue = metrics?.reduce((sum, m) => sum + (Number(m.total_revenue_booked) || 0), 0) || 0;
    const avgROAS = metrics && metrics.length > 0 
      ? metrics.reduce((sum, m) => sum + (Number(m.roas_daily) || 0), 0) / metrics.length 
      : 0;

    // 2. Coach Leaderboard
    const { data: coaches } = await supabase
      .from("coach_performance")
      .select("*")
      .order("performance_score", { ascending: false })
      .limit(5);

    // 3. System Health (Sync/Alignment Logs)
    const { count: syncErrors } = await supabase
      .from("sync_logs")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("started_at", sevenDaysAgo.toISOString());

    const report = {
      period: "Last 7 Days",
      financials: {
        total_revenue_booked: totalRevenue,
        average_roas: avgROAS.toFixed(2) + "x",
        total_leads: metrics?.reduce((sum, m) => sum + (m.total_leads_new || 0), 0) || 0
      },
      top_coaches: coaches?.map(c => ({
        name: c.coach_name,
        score: c.performance_score,
        health: c.avg_client_health
      })),
      operational_health: {
        sync_errors: syncErrors || 0,
        status: (syncErrors || 0) > 5 ? "ACTION_REQUIRED" : "STABLE"
      },
      generated_at: new Date().toISOString()
    };

    // Log the report generation
    await supabase.from("sync_logs").insert({
      platform: "internal",
      sync_type: "ceo_report",
      status: "completed",
      message: `Weekly report generated: AED ${totalRevenue.toLocaleString()}`
    });

    return apiSuccess({ success: true, report });

  } catch (error: unknown) {
    console.error("[ceo-report] Error:", error);
    return apiError("INTERNAL_ERROR", error.message, 500);
  }
});
