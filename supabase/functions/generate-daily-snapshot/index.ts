import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import {
  handleError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiValidationError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { validateOrThrow } from "../_shared/data-contracts.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

import { createRDSClient } from "../_shared/rds-client.ts"; // Shared RDS Logic

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS")
    return apiCorsPreFlight();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get date from request or default to "yesterday" (standard for daily reporting)
    const { date } = await req.json().catch(() => ({}));

    const targetDate = date ? new Date(date) : new Date();
    if (!date) targetDate.setDate(targetDate.getDate() - 1); // Default to yesterday

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const dateStr = startOfDay.toISOString().split("T")[0];
    console.log(`Generating snapshot for ${dateStr}...`);

    // 1. Lead Metrics
    const { count: total_leads_new } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfDay.toISOString())
      .lte("created_at", endOfDay.toISOString());

    const { count: leads_from_ads } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("source", "facebook") // Adjust based on your actual source tags
      .gte("created_at", startOfDay.toISOString())
      .lte("created_at", endOfDay.toISOString());

    // 2. Sales Activity
    const { count: total_calls_made } = await supabase
      .from("call_records")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfDay.toISOString())
      .lte("created_at", endOfDay.toISOString());

    // 3. Revenue & Deals
    const { data: deals } = await supabase
      .from("deals")
      .select("deal_value, cash_collected")
      .eq("status", "closed")
      .gte("created_at", startOfDay.toISOString())
      .lte("created_at", endOfDay.toISOString());

    const total_revenue_booked =
      deals?.reduce((sum, d) => sum + (d.deal_value || 0), 0) || 0;
    const total_cash_collected =
      deals?.reduce((sum, d) => sum + (d.cash_collected || 0), 0) || 0;
    const total_deals_closed = deals?.length || 0;
    const avg_deal_value =
      total_deals_closed > 0 ? total_revenue_booked / total_deals_closed : 0;

    // 4. Marketing Performance (Facebook)
    const { data: fbStats } = await supabase
      .from("facebook_ads_insights")
      .select("spend, impressions, clicks, campaign_name")
      .eq("date", dateStr)
      .not("campaign_name", "ilike", "%Test%");

    const ad_spend_facebook =
      fbStats?.reduce((sum, s) => sum + (s.spend || 0), 0) || 0;
    const ad_impressions =
      fbStats?.reduce((sum, s) => sum + (s.impressions || 0), 0) || 0;
    const ad_clicks =
      fbStats?.reduce((sum, s) => sum + (s.clicks || 0), 0) || 0;

    // 5. AWS Ground Truth (Completed Assessments)
    let total_assessments_completed = 0;
    try {
      const rdsClient = await createRDSClient("backoffice");
      const assessmentResult = await rdsClient.queryObject(`
        SELECT COUNT(*) as count
        FROM enhancesch.vw_schedulers
        WHERE training_date_utc::date = $1
        AND status IN ('Completed', 'Attended')
        AND name_packet ILIKE '%Assessment%';
      `, [dateStr]);
      
      total_assessments_completed = Number((assessmentResult.rows[0] as any).count) || 0;
      await rdsClient.end();
    } catch (e) {
      console.warn("[snapshot] Failed to fetch AWS assessment counts:", e);
    }

    // 6. Calculate KPIs
    const roas_daily =
      ad_spend_facebook > 0 ? total_revenue_booked / ad_spend_facebook : 0;
    const conversion_rate_daily =
      (total_leads_new || 0) > 0
        ? (total_deals_closed / total_leads_new!) * 100
        : 0;
    const cost_per_lead =
      (total_leads_new || 0) > 0 ? ad_spend_facebook / total_leads_new! : 0;
    
    // True CPA: Spend / Completed Assessments
    const true_cpa = total_assessments_completed > 0 
      ? ad_spend_facebook / total_assessments_completed 
      : 0;

    // 7. Upsert Daily Metric Record
    const metricRecord = {
      date: dateStr,
      total_leads_new: total_leads_new || 0,
      leads_from_ads: leads_from_ads || 0,
      total_calls_made: total_calls_made || 0,
      total_revenue_booked,
      total_cash_collected,
      total_deals_closed,
      avg_deal_value,
      ad_spend_facebook,
      ad_impressions,
      ad_clicks,
      roas_daily,
      conversion_rate_daily,
      cost_per_lead,
      total_assessments_completed,
      true_cpa,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("daily_business_metrics")
      .upsert(metricRecord, { onConflict: "date" });

    if (upsertError) throw upsertError;

    return apiSuccess({ success: true, data: metricRecord });
  } catch (error: unknown) {
    return handleError(error, "generate-daily-snapshot", {
      errorCode: ErrorCode.INTERNAL_ERROR,
      context: { function: "generate-daily-snapshot" },
    });
  }
});
