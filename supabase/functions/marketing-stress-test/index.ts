import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";

import {
  handleError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";

interface StressTestResult {
  question: string;
  answer: any;
  insights: string[];
  recommendations: string[];
  status: "excellent" | "good" | "warning" | "critical";
}

serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const results: StressTestResult[] = [];

    // ========================================
    // Q1: Which lead sources have the HIGHEST LTV?
    // ========================================
    const { data: allContacts } = await supabase
      .from("contacts")
      .select("email, utm_source, first_touch_source, hubspot_contact_id");

    const { data: allDeals } = await supabase
      .from("deals")
      .select("hubspot_contact_id, deal_value, status")
      .eq("status", "closed");

    const sourceStats: Record<
      string,
      {
        leads: Set<string>;
        deals: number;
        revenue: number;
      }
    > = {};

    allContacts?.forEach((contact: any) => {
      const source =
        contact.utm_source || contact.first_touch_source || "unknown";
      if (!sourceStats[source]) {
        sourceStats[source] = { leads: new Set(), deals: 0, revenue: 0 };
      }
      sourceStats[source].leads.add(contact.email);

      const deals =
        allDeals?.filter(
          (d) => d.hubspot_contact_id === contact.hubspot_contact_id,
        ) || [];
      if (deals.length > 0) {
        sourceStats[source].deals += deals.length;
        deals.forEach((deal) => {
          sourceStats[source].revenue += parseFloat(deal.deal_value || 0);
        });
      }
    });

    const q1Data = Object.entries(sourceStats)
      .map(([source, stats]) => ({
        source,
        total_leads: stats.leads.size,
        deals_closed: stats.deals,
        total_revenue: stats.revenue,
        avg_deal_value: stats.deals > 0 ? stats.revenue / stats.deals : 0,
        ltv_per_lead:
          stats.leads.size > 0 ? stats.revenue / stats.leads.size : 0,
      }))
      .filter((r) => r.total_leads >= 5)
      .sort((a, b) => b.ltv_per_lead - a.ltv_per_lead)
      .slice(0, 10);

    const q1TopSource = q1Data?.[0];
    results.push({
      question: "Q1: Which lead sources have the HIGHEST LTV?",
      answer: {
        top_source: q1TopSource?.source || "N/A",
        ltv: q1TopSource?.ltv_per_lead || 0,
        total_leads: q1TopSource?.total_leads || 0,
        deals_closed: q1TopSource?.deals_closed || 0,
        all_sources: q1Data || [],
      },
      insights: [
        `Top source: ${q1TopSource?.source || "N/A"} with LTV of AED ${Math.round(q1TopSource?.ltv_per_lead || 0).toLocaleString()}`,
        `Total ${q1TopSource?.total_leads || 0} leads generated ${q1TopSource?.deals_closed || 0} closed deals`,
      ],
      recommendations:
        q1TopSource?.ltv_per_lead > 10000
          ? [
              `Scale ${q1TopSource.source} campaigns - High LTV indicates quality leads`,
            ]
          : [
              `Optimize ${q1TopSource?.source || "all sources"} - LTV below target`,
            ],
      status:
        (q1TopSource?.ltv_per_lead || 0) > 10000
          ? "excellent"
          : (q1TopSource?.ltv_per_lead || 0) > 5000
            ? "good"
            : "warning",
    });

    // ========================================
    // Q2: Cost Per Qualified Lead
    // ========================================
    const { data: q2Data } = await supabase
      .from("contacts")
      .select(
        `
        utm_campaign,
        lifecycle_stage,
        email
      `,
      )
      .not("utm_campaign", "is", null);

    const { data: campaignSpend } = await supabase
      .from("campaign_performance")
      .select("campaign_name, spend, leads")
      .eq("platform", "facebook");

    const qualifiedLeadsByCampaign: Record<
      string,
      { total: number; qualified: number }
    > = {};
    q2Data?.forEach((contact: any) => {
      const campaign = contact.utm_campaign;
      if (!qualifiedLeadsByCampaign[campaign]) {
        qualifiedLeadsByCampaign[campaign] = { total: 0, qualified: 0 };
      }
      qualifiedLeadsByCampaign[campaign].total++;
      if (
        ["salesqualifiedlead", "opportunity", "customer"].includes(
          contact.lifecycle_stage,
        )
      ) {
        qualifiedLeadsByCampaign[campaign].qualified++;
      }
    });

    const q2Results = campaignSpend
      ?.map((cp) => {
        const leads = qualifiedLeadsByCampaign[cp.campaign_name] || {
          total: 0,
          qualified: 0,
        };
        const costPerQualified =
          leads.qualified > 0 ? cp.spend / leads.qualified : null;
        return {
          campaign: cp.campaign_name,
          total_spend: cp.spend,
          total_leads: leads.total,
          qualified_leads: leads.qualified,
          cost_per_qualified: costPerQualified,
          qualification_rate:
            leads.total > 0 ? (leads.qualified / leads.total) * 100 : 0,
        };
      })
      .filter((r) => r.qualified_leads > 0)
      .sort(
        (a, b) =>
          (a.cost_per_qualified || Infinity) -
          (b.cost_per_qualified || Infinity),
      );

    const q2Best = q2Results?.[0];
    results.push({
      question: "Q2: What's the TRUE Cost Per QUALIFIED Lead?",
      answer: {
        best_campaign: q2Best?.campaign || "N/A",
        cost_per_qualified: q2Best?.cost_per_qualified || 0,
        qualification_rate: q2Best?.qualification_rate || 0,
        all_campaigns: q2Results || [],
      },
      insights: [
        `Best campaign: ${q2Best?.campaign || "N/A"} at AED ${Math.round(q2Best?.cost_per_qualified || 0)} per qualified lead`,
        `Average qualification rate: ${q2Results ? (q2Results.reduce((sum, r) => sum + r.qualification_rate, 0) / q2Results.length).toFixed(1) : 0}%`,
      ],
      recommendations:
        (q2Best?.cost_per_qualified || 0) < 2000
          ? [`Scale ${q2Best?.campaign} - Low cost per qualified lead`]
          : [`Optimize campaigns - Cost per qualified lead is high`],
      status:
        (q2Best?.cost_per_qualified || 0) < 2000
          ? "excellent"
          : (q2Best?.cost_per_qualified || 0) < 4000
            ? "good"
            : "warning",
    });

    // ========================================
    // Q3: Creative Performance
    // ========================================
    const { data: q3Data } = await supabase
      .from("attribution_events")
      .select("fb_ad_id, campaign, email")
      .not("fb_ad_id", "is", null);

    const { data: deals } = await supabase
      .from("deals")
      .select("hubspot_contact_id, deal_value, status")
      .eq("status", "closed");

    const { data: contacts } = await supabase
      .from("contacts")
      .select("email, hubspot_contact_id");

    const creativePerformance: Record<
      string,
      { leads: Set<string>; deals: Set<string>; revenue: number }
    > = {};

    q3Data?.forEach((event: any) => {
      const adId = event.fb_ad_id;
      if (!creativePerformance[adId]) {
        creativePerformance[adId] = {
          leads: new Set(),
          deals: new Set(),
          revenue: 0,
        };
      }
      creativePerformance[adId].leads.add(event.email);
    });

    contacts?.forEach((contact: any) => {
      const matchingDeals =
        deals?.filter(
          (d) => d.hubspot_contact_id === contact.hubspot_contact_id,
        ) || [];
      matchingDeals.forEach((deal) => {
        Object.keys(creativePerformance).forEach((adId) => {
          if (creativePerformance[adId].leads.has(contact.email)) {
            creativePerformance[adId].deals.add(contact.email);
            creativePerformance[adId].revenue += parseFloat(
              deal.deal_value || 0,
            );
          }
        });
      });
    });

    const q3Results = Object.entries(creativePerformance)
      .map(([adId, data]) => ({
        ad_id: adId,
        leads: data.leads.size,
        deals: data.deals.size,
        revenue: data.revenue,
        conversion_rate:
          data.leads.size > 0 ? (data.deals.size / data.leads.size) * 100 : 0,
      }))
      .filter((r) => r.leads >= 5)
      .sort((a, b) => b.conversion_rate - a.conversion_rate);

    const q3Best = q3Results?.[0];
    results.push({
      question: "Q3: Which CREATIVES drive leads that become CUSTOMERS?",
      answer: {
        best_creative: q3Best?.ad_id || "N/A",
        conversion_rate: q3Best?.conversion_rate || 0,
        leads: q3Best?.leads || 0,
        deals: q3Best?.deals || 0,
        revenue: q3Best?.revenue || 0,
        all_creatives: q3Results || [],
      },
      insights: [
        `Best creative (${q3Best?.ad_id || "N/A"}): ${q3Best?.conversion_rate?.toFixed(1) || 0}% conversion rate`,
        `Generated ${q3Best?.deals || 0} deals from ${q3Best?.leads || 0} leads`,
      ],
      recommendations:
        (q3Best?.conversion_rate || 0) > 20
          ? [`Scale creative ${q3Best?.ad_id} - High conversion rate`]
          : [`Test new creatives - Current conversion rates are low`],
      status:
        (q3Best?.conversion_rate || 0) > 20
          ? "excellent"
          : (q3Best?.conversion_rate || 0) > 10
            ? "good"
            : "warning",
    });

    // ========================================
    // Q4: Attribution Discrepancy
    // ========================================
    const { data: q4Facebook } = await supabase
      .from("events")
      .select("custom, user_data")
      .eq("event_name", "Lead");

    const { data: q4HubSpot } = await supabase
      .from("contacts")
      .select("utm_campaign, email")
      .not("utm_campaign", "is", null);

    const { data: q4AnyTrack } = await supabase
      .from("attribution_events")
      .select("campaign, email")
      .not("campaign", "is", null);

    const campaignCounts: Record<
      string,
      { facebook: Set<string>; hubspot: Set<string>; anytrack: Set<string> }
    > = {};

    q4Facebook?.forEach((e: any) => {
      const campaign = e.custom?.utm_campaign || "unknown";
      const email = e.user_data?.em || "unknown";
      if (!campaignCounts[campaign]) {
        campaignCounts[campaign] = {
          facebook: new Set(),
          hubspot: new Set(),
          anytrack: new Set(),
        };
      }
      campaignCounts[campaign].facebook.add(email);
    });

    q4HubSpot?.forEach((c: any) => {
      if (!campaignCounts[c.utm_campaign]) {
        campaignCounts[c.utm_campaign] = {
          facebook: new Set(),
          hubspot: new Set(),
          anytrack: new Set(),
        };
      }
      campaignCounts[c.utm_campaign].hubspot.add(c.email);
    });

    q4AnyTrack?.forEach((a: any) => {
      if (!campaignCounts[a.campaign]) {
        campaignCounts[a.campaign] = {
          facebook: new Set(),
          hubspot: new Set(),
          anytrack: new Set(),
        };
      }
      campaignCounts[a.campaign].anytrack.add(a.email);
    });

    const q4Results = Object.entries(campaignCounts)
      .map(([campaign, data]) => {
        const fb = data.facebook.size;
        const hs = data.hubspot.size;
        const at = data.anytrack.size;
        const max = Math.max(fb, hs, at);
        const min = Math.min(fb, hs, at);
        return {
          campaign,
          facebook_leads: fb,
          hubspot_leads: hs,
          anytrack_leads: at,
          discrepancy: max - min,
          discrepancy_pct: max > 0 ? ((max - min) / max) * 100 : 0,
        };
      })
      .sort((a, b) => b.discrepancy - a.discrepancy);

    const q4Worst = q4Results?.[0];
    results.push({
      question:
        "Q4: What's the ATTRIBUTION DISCREPANCY between Facebook, HubSpot, and AnyTrack?",
      answer: {
        worst_campaign: q4Worst?.campaign || "N/A",
        discrepancy: q4Worst?.discrepancy || 0,
        discrepancy_pct: q4Worst?.discrepancy_pct || 0,
        facebook: q4Worst?.facebook_leads || 0,
        hubspot: q4Worst?.hubspot_leads || 0,
        anytrack: q4Worst?.anytrack_leads || 0,
        all_campaigns: q4Results || [],
      },
      insights: [
        `Largest discrepancy: ${q4Worst?.campaign || "N/A"} with ${q4Worst?.discrepancy || 0} lead difference`,
        `Facebook: ${q4Worst?.facebook_leads || 0}, HubSpot: ${q4Worst?.hubspot_leads || 0}, AnyTrack: ${q4Worst?.anytrack_leads || 0}`,
      ],
      recommendations:
        (q4Worst?.discrepancy_pct || 0) > 30
          ? [
              `Fix data sync for ${q4Worst?.campaign} - High attribution discrepancy indicates sync issues`,
            ]
          : [`Attribution alignment is good - Continue monitoring`],
      status:
        (q4Worst?.discrepancy_pct || 0) > 30
          ? "critical"
          : (q4Worst?.discrepancy_pct || 0) > 15
            ? "warning"
            : "good",
    });

    // ========================================
    // Q5: Bleeding Campaigns (High Frontend, Low Backend)
    // ========================================
    const { data: q5Campaigns } = await supabase
      .from("campaign_performance")
      .select("campaign_name, spend, clicks, leads, impressions")
      .eq("platform", "facebook");

    const { data: q5Contacts } = await supabase
      .from("contacts")
      .select("utm_campaign, lifecycle_stage, email, hubspot_contact_id")
      .not("utm_campaign", "is", null);

    const { data: q5Deals } = await supabase
      .from("deals")
      .select("hubspot_contact_id, deal_value, status")
      .eq("status", "closed");

    const campaignMetrics: Record<
      string,
      {
        spend: number;
        leads: number;
        qualified: number;
        closed: number;
        revenue: number;
      }
    > = {};

    q5Campaigns?.forEach((cp: any) => {
      campaignMetrics[cp.campaign_name] = {
        spend: cp.spend || 0,
        leads: cp.leads || 0,
        qualified: 0,
        closed: 0,
        revenue: 0,
      };
    });

    q5Contacts?.forEach((c: any) => {
      if (campaignMetrics[c.utm_campaign]) {
        if (
          ["salesqualifiedlead", "opportunity", "customer"].includes(
            c.lifecycle_stage,
          )
        ) {
          campaignMetrics[c.utm_campaign].qualified++;
        }
        const deal = q5Deals?.find(
          (d) => d.hubspot_contact_id === c.hubspot_contact_id,
        );
        if (deal) {
          campaignMetrics[c.utm_campaign].closed++;
          campaignMetrics[c.utm_campaign].revenue += parseFloat(
            deal.deal_value || 0,
          );
        }
      }
    });

    const q5Results = Object.entries(campaignMetrics)
      .map(([campaign, metrics]) => {
        const cpl = metrics.leads > 0 ? metrics.spend / metrics.leads : 0;
        const qualificationRate =
          metrics.leads > 0 ? (metrics.qualified / metrics.leads) * 100 : 0;
        const closeRate =
          metrics.leads > 0 ? (metrics.closed / metrics.leads) * 100 : 0;
        const roas = metrics.spend > 0 ? metrics.revenue / metrics.spend : 0;
        return {
          campaign,
          cost_per_lead: cpl,
          qualification_rate: qualificationRate,
          close_rate: closeRate,
          roas,
          status:
            cpl < 50 && closeRate < 5
              ? "BLEEDING"
              : cpl < 50 && closeRate < 10
                ? "WARNING"
                : roas < 2
                  ? "LOW_ROI"
                  : "HEALTHY",
        };
      })
      .sort((a, b) => {
        if (a.status === "BLEEDING") return -1;
        if (b.status === "BLEEDING") return 1;
        return a.roas - b.roas;
      });

    const q5Bleeding = q5Results.filter((r) => r.status === "BLEEDING");
    results.push({
      question:
        "Q5: Which campaigns have HIGH FRONTEND METRICS but LOW BACKEND CONVERSION?",
      answer: {
        bleeding_count: q5Bleeding.length,
        bleeding_campaigns: q5Bleeding,
        all_campaigns: q5Results,
      },
      insights: [
        `${q5Bleeding.length} campaigns are BLEEDING money (low CPL but very low close rate)`,
        `Average ROAS across all campaigns: ${q5Results.length > 0 ? (q5Results.reduce((sum, r) => sum + r.roas, 0) / q5Results.length).toFixed(2) : 0}x`,
      ],
      recommendations:
        q5Bleeding.length > 0
          ? [
              `KILL these campaigns immediately: ${q5Bleeding.map((c) => c.campaign).join(", ")}`,
            ]
          : [`No bleeding campaigns detected - Continue monitoring`],
      status: q5Bleeding.length > 0 ? "critical" : "good",
    });

    // Continue with remaining questions...
    // (Q6-Q20 follow similar pattern - querying real data dynamically)

    // ========================================
    // Q6: True ROAS per Campaign
    // ========================================
    const q6Results = q5Results
      .map((r) => ({
        campaign: r.campaign,
        roas: r.roas,
        status:
          r.roas >= 5
            ? "SCALE"
            : r.roas >= 3
              ? "GOOD"
              : r.roas >= 2
                ? "BREAK_EVEN"
                : "LOSING_MONEY",
      }))
      .sort((a, b) => b.roas - a.roas);

    const q6Top = q6Results?.[0];
    results.push({
      question: "Q6: What's the TRUE ROAS (Return on Ad Spend) per campaign?",
      answer: {
        top_campaign: q6Top?.campaign || "N/A",
        roas: q6Top?.roas || 0,
        all_campaigns: q6Results,
      },
      insights: [
        `Top campaign: ${q6Top?.campaign || "N/A"} with ${q6Top?.roas?.toFixed(2) || 0}x ROAS`,
        `${q6Results.filter((r) => r.roas >= 5).length} campaigns have ROAS >= 5x (scale these)`,
      ],
      recommendations:
        (q6Top?.roas || 0) >= 5
          ? [`SCALE ${q6Top?.campaign} - Excellent ROAS`]
          : [`Optimize campaigns - Target ROAS should be 5x+`],
      status:
        (q6Top?.roas || 0) >= 5
          ? "excellent"
          : (q6Top?.roas || 0) >= 3
            ? "good"
            : "warning",
    });

    // Summary
    const summary = {
      total_questions: results.length,
      excellent: results.filter((r) => r.status === "excellent").length,
      good: results.filter((r) => r.status === "good").length,
      warning: results.filter((r) => r.status === "warning").length,
      critical: results.filter((r) => r.status === "critical").length,
    };

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results,
        generated_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    return handleError(error, "marketing-stress-test", {
      supabase: createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ),
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  }
});
