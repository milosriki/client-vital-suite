import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { date_range = "this_month" } = await req.json().catch(() => ({}));

    // 1. Fetch Closed Deals (The Truth: Money in Bank)
    // Filter for current month or specified range
    const now = new Date();
    const firstDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();

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
    const discrepancies: any[] = [];
    const campaignPerformance: Record<
      string,
      { revenue: number; deals: number }
    > = {};

    deals.forEach((deal: any) => {
      const contact = deal.contacts;
      const value = parseFloat(deal.deal_value || 0);
      let source = "Unknown";
      let isPaid = false;

      // "Waterfall" Attribution Logic (AnyTrack > UTM > HubSpot)
      if (
        contact?.facebook_id ||
        (contact?.utm_source || "").toLowerCase().includes("facebook")
      ) {
        source = "Facebook Ads";
        isPaid = true;
      } else if (
        (contact?.latest_traffic_source || "").toLowerCase().includes("paid")
      ) {
        source = "Paid (Other)";
        isPaid = true;
      } else {
        source = "Organic/Direct";
      }

      // Logic: Discrepancy Check
      // If HubSpot says "Organic" but AnyTrack has a Click ID, that's a "Saved Sale"
      if (
        source === "Organic/Direct" &&
        contact?.latest_traffic_source === "PAID_SOCIAL"
      ) {
        discrepancies.push({
          type: "ATTRIBUTION_MISMATCH",
          deal_id: deal.id,
          deal_name: deal.deal_name,
          message:
            "HubSpot marked Organic, but Traffic Source indicates Paid Social",
          value: value,
        });
        // We correct it for True ROAS
        source = "Facebook Ads (Corrected)";
        isPaid = true;
      }

      if (isPaid) {
        attributedRevenue += value;
        // Track Campaign Performance
        const campaign = contact?.utm_campaign || "Unattributed Campaign";
        if (!campaignPerformance[campaign]) {
          campaignPerformance[campaign] = { revenue: 0, deals: 0 };
        }
        campaignPerformance[campaign].revenue += value;
        campaignPerformance[campaign].deals += 1;
      } else {
        organicRevenue += value;
      }
    });

    // 4. Calculate True ROAS
    const trueRoas = totalAdSpend > 0 ? attributedRevenue / totalAdSpend : 0;
    const roasDifference = trueRoas - reportedRoas; // Positive means Ads Manager is UNDER-reporting

    // 5. Winning Creatives/Campaigns
    const winningCampaigns = Object.entries(campaignPerformance)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .map(([name, stats]) => ({ name, ...stats }));

    return new Response(
      JSON.stringify({
        success: true,
        period: date_range,
        financials: {
          total_revenue: attributedRevenue + organicRevenue,
          attributed_revenue: attributedRevenue,
          organic_revenue: organicRevenue,
          ad_spend: totalAdSpend,
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
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
