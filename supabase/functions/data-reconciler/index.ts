import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import {
  handleError,
  logError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";

serve(async (req) => {
  try {
    verifyAuth(req);
  } catch (e) {
    return errorToResponse(new UnauthorizedError());
  } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { date_range = "this_month" } = await req.json().catch(() => ({}));

    // 1. Fetch Closed Deals (The Truth: Money in Bank)
    // Filter for current month or specified range
    // 1. Fetch Closed Deals (The Truth: Money in Bank)
    // Filter for current month or specified range
    const { getDubaiDate, DUBAI_OFFSET_MS } =
      await import("../_shared/date-utils.ts");
    const now = getDubaiDate(); // Dubai Time

    let startParams: Date;

    if (date_range === "last_30d") {
      startParams = new Date(now.getTime());
      startParams.setDate(now.getDate() - 30);
    } else if (date_range === "last_90d") {
      startParams = new Date(now.getTime());
      startParams.setDate(now.getDate() - 90);
    } else if (date_range === "this_year") {
      startParams = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    } else if (date_range === "last_year") {
      startParams = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
    } else if (date_range === "all_time") {
      // For all time, we don't really need exact Dubai offset, but consistency is good
      startParams = new Date("2020-01-01");
    } else {
      // Default: This Month (Start of Month in Dubai)
      startParams = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
    }

    // Shift back to real UTC for DB Query
    // startParams is currently in "Fake Dubai UTC" (e.g. 00:00Z which means 00:00 Dubai)
    // We want 20:00Z (prev day) which corresponds to 00:00 Dubai.
    // So we subtract the offset.
    if (date_range !== "all_time") {
      startParams = new Date(startParams.getTime() - DUBAI_OFFSET_MS);
    }

    const firstDay = startParams.toISOString();
    console.log(`Searching deals since: ${firstDay} (Range: ${date_range})`);

    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select(
        `
        id, deal_name, deal_value, close_date, status, pipeline,
        contacts (
          id, email, first_name, last_name, 
          utm_source, utm_medium, utm_campaign, utm_content, 
          facebook_id, latest_traffic_source
        )
      `,
      )
      .eq("status", "closed") // Assuming 'closed' means won/paid
      .gte("close_date", firstDay);

    if (dealsError) throw dealsError;

    // 1.5 Fetch AnyTrack Attribution Events (The "Hard" Truth)
    // These events are verified server-side conversions from AnyTrack
    let attributionEvents: any[] = [];
    try {
      const { data, error: attrError } = await supabase
        .from("attribution_events")
        .select("email, event_name, source, platform, campaign, utm_campaign, event_time")
        .gte("event_time", firstDay);

      if (attrError && attrError.code !== "PGRST116") {
        // Ignore if table missing (dev env)
        console.error("Error fetching attribution events:", attrError);
      } else {
        attributionEvents = data || [];
      }
    } catch (e) {
      console.warn(
        "attribution_events table access failed (likely missing in dev env):",
        e,
      );
    }

    // 2. Fetch Ad Spend (The Investment)
    // We call our internal Facebook Insights function
    const fbRes = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/fetch-facebook-insights`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date_preset: date_range === "this_month" ? "this_month" : "last_30d",
        }),
      },
    );

    const fbData = await fbRes.json();
    const totalAdSpend = fbData.total_spend || 0;
    const reportedRoas = fbData.total_roas || 0;

    // 3. Attribution Logic (The "Hyros" Layer)
    let attributedRevenue = 0;
    let organicRevenue = 0;
    let anytrackRevenue = 0; // Revenue confirmed by AnyTrack
    const discrepancies: any[] = [];
    const campaignPerformance: Record<
      string,
      {
        revenue: number;
        deals: number;
        source: "hubspot" | "anytrack" | "mixed";
      }
    > = {};

    // ------------------------------------------
    // Type Definitions (Local for now, could be shared)
    // ------------------------------------------
    interface Contact {
      id: string;
      latest_traffic_source?: string;
      facebook_id?: string;
      utm_source?: string;
      utm_campaign?: string;
    }

    interface Deal {
      id: string;
      deal_name: string;
      deal_value: number;
      contacts: Contact;
    }

    // ------------------------------------------
    // Helper: Attribution Logic
    // ------------------------------------------
    function determineAttribution(deal: Deal) {
      const contact = deal.contacts;
      const dealValue =
        typeof deal.deal_value === "string"
          ? parseFloat(deal.deal_value)
          : deal.deal_value || 0;

      let source = "Organic/Direct";
      let isPaid = false;
      let discrepancy = null;

      const trafficSource = (
        contact?.latest_traffic_source || ""
      ).toLowerCase();
      const utmSource = (contact?.utm_source || "").toLowerCase();

      // 1. Direct Facebook Match (Strongest Signal)
      if (contact?.facebook_id || utmSource.includes("facebook")) {
        source = "Facebook Ads";
        isPaid = true;
      }
      // 2. Other Paid Channels
      else if (trafficSource.includes("paid")) {
        source = "Paid (Other)";
        isPaid = true;
      }

      // 3. Discrepancy Check (The "Hyros" Value Add)
      // Example: HubSpot says "Organic", but AnyTrack/Pixels saw "Paid Social"
      if (!isPaid && trafficSource === "paid_social") {
        discrepancy = {
          type: "ATTRIBUTION_MISMATCH",
          deal_id: deal.id,
          deal_name: deal.deal_name,
          message:
            "HubSpot marked Organic, but Traffic Source indicates Paid Social",
          value: dealValue,
        };
        // Correct attribution for True ROAS calculation
        source = "Facebook Ads (Corrected)";
        isPaid = true;
      }

      return { source, isPaid, discrepancy, dealValue };
    }

    // ------------------------------------------
    // Helper: Match Deal to AnyTrack
    // ------------------------------------------
    function findAnyTrackMatch(deal: Deal, events: any[]) {
      // 1. Try matching by Email (Strongest)
      if (deal.contacts?.email && events) {
        const match = events.find(
          (e: any) =>
            e.email === deal.contacts.email &&
            (e.event_name === "Purchase" || e.event_name === "Lead"),
        );
        if (match) return match;
      }
      return null;
    }

    // ... (Inside main loop) ...
    deals.forEach((rawDeal: any) => {
      const { source, isPaid, discrepancy, dealValue } =
        determineAttribution(rawDeal);

      // Match with AnyTrack
      const anytrackMatch = findAnyTrackMatch(rawDeal, attributionEvents || []);
      let finalSource = source;
      let finalIsPaid = isPaid;

      if (anytrackMatch) {
        // Validated by AnyTrack
        if (
          anytrackMatch.source === "Facebook Ads" ||
          anytrackMatch.platform === "facebook"
        ) {
          finalSource = "Facebook Ads (Verified)";
          finalIsPaid = true;
          anytrackRevenue += dealValue;
        }
      }

      if (discrepancy) {
        discrepancies.push(discrepancy);
      }

      const campaign =
        anytrackMatch?.campaign ||
        anytrackMatch?.utm_campaign ||
        rawDeal.contacts?.utm_campaign ||
        "Unattributed Campaign";

      if (finalIsPaid) {
        attributedRevenue += dealValue;

        if (!campaignPerformance[campaign]) {
          campaignPerformance[campaign] = {
            revenue: 0,
            deals: 0,
            source: anytrackMatch ? "anytrack" : "hubspot",
          };
        }
        campaignPerformance[campaign].revenue += dealValue;
        campaignPerformance[campaign].deals += 1;
      } else {
        organicRevenue += dealValue;
      }
    });

    // 4. Calculate True ROAS
    const trueRoas = totalAdSpend > 0 ? attributedRevenue / totalAdSpend : 0;
    const roasDifference = trueRoas - reportedRoas; // Positive means Ads Manager is UNDER-reporting

    // 5. Winning Creatives/Campaigns
    const winningCampaigns = Object.entries(campaignPerformance)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .map(([name, stats]) => ({ name, ...stats }));

    // 6. DEEP AUDIT: Aggregate all deals by Pipeline and Stage to find missing revenue
    const { data: auditData, error: auditError } = await supabase
      .from("deals")
      .select("pipeline, stage, deal_value, close_date")
      .gte("close_date", firstDay)
      .limit(10000); // Ensure we capture the full volume // Inspecting this month/period first

    const auditBreakdown: Record<string, number> = {};
    let totalDbRevenue = 0;

    if (auditData) {
      auditData.forEach((d: any) => {
        const key = `${d.pipeline}::${d.stage}`;
        const val = parseFloat(d.deal_value || 0);
        auditBreakdown[key] = (auditBreakdown[key] || 0) + val;
        totalDbRevenue += val;
      });
    }

    return apiSuccess({
        success: true,
        period: date_range,
        financials: {
          total_revenue: attributedRevenue + organicRevenue,
          attributed_revenue: attributedRevenue,
          organic_revenue: organicRevenue,
          ad_spend: totalAdSpend,
          // DB TRUTH
          db_audit_total: totalDbRevenue,
          db_audit_breakdown: auditBreakdown,
        },
        intelligence: {
          true_roas: trueRoas,
          reported_roas: reportedRoas, // From FB Pixel
          roas_uplift_percent:
            reportedRoas > 0
              ? ((trueRoas - reportedRoas) / reportedRoas) * 100
              : 0,
          winning_campaigns: winningCampaigns,
        },
        recent_deals: deals.slice(0, 50),
        discrepancies: {
          count: discrepancies.length,
          items: discrepancies,
        },
      });
  } catch (error: unknown) {
    return handleError(error, "data-reconciler", {
      supabase: createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ),
      errorCode: ErrorCode.INTERNAL_ERROR,
      context: { function: "data-reconciler" },
    });
  }
});
