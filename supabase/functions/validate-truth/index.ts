import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

// Inline CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    // Inline Client Creation
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Default to current month if not specified
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();

    // Parse Payload (Optional: Custom Date Range)
    let body = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    // @ts-ignore
    const fromDate = body.fromDate || startOfMonth;

    // 1. Get Live Deals (HubSpot Truth)
    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select(
        "id, deal_name, amount, deal_value, stage, close_date, created_at, pipeline",
      )
      .ilike("stage", "%won%")
      .gte("close_date", fromDate);

    if (dealsError)
      throw new Error(`Deals Query Failed: ${dealsError.message}`);

    // 2. Get AnyTrack Events (Attribution Truth)
    const { data: atEvents, error: atError } = await supabase
      .from("attribution_events")
      .select("event_name, value, fb_ad_name, utm_campaign, utm_source")
      .eq("event_name", "Purchase")
      .gte("created_at", fromDate);

    if (atError) throw new Error(`AnyTrack Query Failed: ${atError.message}`);

    // 3. Get Facebook Side (via Daily Business Metrics)
    const { data: fbMetrics, error: fbError } = await supabase
      .from("daily_business_metrics")
      .select("date, ad_spend_facebook, facebook_purchases, roas_daily")
      .gte("date", fromDate.split("T")[0]);

    if (fbError)
      console.error("FB Metrics Error (Non-Fatal):", fbError.message);

    // --- ANALYSIS ---
    const totalDeals = deals?.length || 0;
    const totalRevenue =
      deals?.reduce(
        (sum, d) => sum + (Number(d.deal_value) || Number(d.amount) || 0),
        0,
      ) || 0;

    const atPurchases = atEvents?.length || 0;
    const atRevenue =
      atEvents?.reduce((sum, e) => sum + (Number(e.value) || 0), 0) || 0;

    const fbPurchases =
      fbMetrics?.reduce(
        (sum, m) => sum + (Number(m.facebook_purchases) || 0),
        0,
      ) || 0;
    const fbSpend =
      fbMetrics?.reduce(
        (sum, m) => sum + (Number(m.ad_spend_facebook) || 0),
        0,
      ) || 0;

    const report = {
      period: {
        from: fromDate,
        to: now.toISOString(),
      },
      truth_triangle: {
        hubspot: {
          source: "HubSpot (Deals)",
          count: totalDeals,
          revenue: totalRevenue,
          currency: "AED",
        },
        anytrack: {
          source: "AnyTrack (Events)",
          count: atPurchases,
          revenue: atRevenue,
          currency: "AED", // Assumed
        },
        facebook: {
          source: "Facebook (Reported)",
          count: fbPurchases,
          spend: fbSpend,
          currency: "USD", // Usually USD in DB, check later
        },
      },
      discrepancy: {
        gap_hubspot_vs_anytrack: Math.abs(totalDeals - atPurchases),
        gap_hubspot_vs_facebook: Math.abs(totalDeals - fbPurchases),
      },
      ads_driving_revenue: Array.from(
        new Set(atEvents?.map((e) => e.fb_ad_name).filter(Boolean)),
      ),
      latest_deal:
        deals && deals.length > 0
          ? deals.sort(
              (a: any, b: any) =>
                new Date(b.close_date).getTime() -
                new Date(a.close_date).getTime(),
            )[0]
          : null,
    };

    return apiSuccess(report, null, 2);
  } catch (error: unknown) {
    return apiError("INTERNAL_ERROR", JSON.stringify({ error: error.message }), 500);
  }
});
