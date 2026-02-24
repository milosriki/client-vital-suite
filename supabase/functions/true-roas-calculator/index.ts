/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";

/**
 * True ROAS Calculator 💰
 *
 * Calculates TRUE ROAS (not Meta-reported) by joining:
 *   facebook_ads_insights (spend) → contacts (campaign attribution) → deals (revenue)
 *
 * Outputs per campaign, per ad set, per ad (creative):
 *   "Campaign X: Spent AED 5,000 → Generated AED 42,000 = 8.4x ROAS"
 *
 * Also calculates CPL (Cost Per Lead) and CPO (Cost Per Order) per campaign.
 */

interface CampaignROAS {
  campaign_id: string;
  campaign_name: string;
  spend_aed: number;
  leads: number;
  deals_count: number;
  revenue_aed: number;
  roas: number;
  cpl_aed: number;   // spend / leads
  cpo_aed: number;   // spend / deals
  summary: string;
  action: "KILL" | "SCALE" | "MAINTAIN";
  action_reason: string;
}

interface AdSetROAS {
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  spend_aed: number;
  leads: number;
  deals_count: number;
  revenue_aed: number;
  roas: number;
  cpl_aed: number;
  frequency: number;
  action: "KILL" | "SCALE" | "MAINTAIN";
}

interface CreativeROAS {
  ad_id: string;
  ad_name: string;
  campaign_id: string;
  campaign_name: string;
  spend_aed: number;
  leads: number;
  deals_count: number;
  revenue_aed: number;
  roas: number;
  cpl_aed: number;
  ctr_pct: number;
  frequency: number;
  fatigue_status: "OK" | "WARNING" | "CRITICAL";
  action: "KILL" | "SCALE" | "MAINTAIN";
}

function classifyAction(roas: number, frequency: number): {
  action: "KILL" | "SCALE" | "MAINTAIN";
  reason: string;
} {
  if (roas < 1.5 && frequency > 4) {
    return { action: "KILL", reason: `ROAS ${roas.toFixed(2)}x < 1.5x AND frequency ${frequency.toFixed(1)} > 4 — wasting money with burned audience.` };
  }
  if (roas > 3.0 && frequency < 3) {
    return { action: "SCALE", reason: `ROAS ${roas.toFixed(2)}x > 3x AND frequency ${frequency.toFixed(1)} < 3 — profitable with room to grow.` };
  }
  return { action: "MAINTAIN", reason: `ROAS ${roas.toFixed(2)}x — within normal range. Maintain current allocation.` };
}

const handler = async (req: Request): Promise<Response> => {
  try {
    verifyAuth(req);
  } catch {
    return errorToResponse(new UnauthorizedError());
  }

  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { days = 30 } = await req.json().catch(() => ({}));
    const since = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];

    structuredLog("true-roas-calculator", "info", `💰 Calculating TRUE ROAS for last ${days} days`);

    // ── Step 1: Get ad spend aggregated by campaign/adset/ad ────────────────
    const { data: spendData, error: spendErr } = await supabase
      .from("facebook_ads_insights")
      .select(`
        campaign_id, campaign_name,
        adset_id, adset_name,
        ad_id, ad_name,
        spend, leads, impressions, clicks, frequency
      `)
      .gte("date", since)
      .not("campaign_id", "is", null);

    if (spendErr) throw new Error(`Spend query failed: ${spendErr.message}`);

    // ── Step 2: Get contacts with campaign attribution ───────────────────────
    // Contacts from HubSpot that have campaign_id filled (from Meta lead forms / UTMs)
    const { data: contactsData, error: contactsErr } = await supabase
      .from("contacts")
      .select("id, email, campaign_id, fb_ad_id, adset_id")
      .not("campaign_id", "is", null)
      .gte("created_at", since);

    if (contactsErr) throw new Error(`Contacts query failed: ${contactsErr.message}`);

    // ── Step 3: Get deals linked to those contacts ───────────────────────────
    const contactIds = (contactsData || []).map((c: { id: string }) => c.id);

    let dealsData: Array<{
      contact_id: string;
      deal_value: number;
      stage: string;
    }> = [];

    if (contactIds.length > 0) {
      const { data: deals, error: dealsErr } = await supabase
        .from("deals")
        .select("contact_id, deal_value, stage")
        .in("contact_id", contactIds)
        .eq("stage", "closedwon");

      if (dealsErr) {
        structuredLog("true-roas-calculator", "warn", `Deals query failed: ${dealsErr.message}`);
      } else {
        dealsData = (deals || []) as Array<{ contact_id: string; deal_value: number; stage: string }>;
      }
    }

    // ── Step 4: Build contact → revenue lookup ───────────────────────────────
    const contactRevenue = new Map<string, number>();
    for (const deal of dealsData) {
      const existing = contactRevenue.get(deal.contact_id) || 0;
      contactRevenue.set(deal.contact_id, existing + (Number(deal.deal_value) || 0));
    }

    // ── Step 5: Map contacts to campaigns ───────────────────────────────────
    type CampaignContactEntry = {
      contact_ids: string[];
      leads: number;
    };

    const campaignContacts = new Map<string, CampaignContactEntry>();
    const adContacts = new Map<string, CampaignContactEntry>();
    const adsetContacts = new Map<string, CampaignContactEntry>();

    for (const contact of (contactsData || []) as Array<{
      id: string;
      campaign_id: string | null;
      fb_ad_id: string | null;
      adset_id: string | null;
    }>) {
      // Map by campaign
      if (contact.campaign_id) {
        const camp = campaignContacts.get(contact.campaign_id) || { contact_ids: [], leads: 0 };
        camp.contact_ids.push(contact.id);
        camp.leads++;
        campaignContacts.set(contact.campaign_id, camp);
      }
      // Map by ad
      if (contact.fb_ad_id) {
        const ad = adContacts.get(contact.fb_ad_id) || { contact_ids: [], leads: 0 };
        ad.contact_ids.push(contact.id);
        ad.leads++;
        adContacts.set(contact.fb_ad_id, ad);
      }
      // Map by adset
      if (contact.adset_id) {
        const adset = adsetContacts.get(contact.adset_id) || { contact_ids: [], leads: 0 };
        adset.contact_ids.push(contact.id);
        adset.leads++;
        adsetContacts.set(contact.adset_id, adset);
      }
    }

    // Helper: compute revenue from a list of contact IDs
    function computeRevenue(contactIds: string[]): { revenue: number; deals: number } {
      let revenue = 0;
      let deals = 0;
      for (const cid of contactIds) {
        const rev = contactRevenue.get(cid);
        if (rev) {
          revenue += rev;
          deals++;
        }
      }
      return { revenue, deals };
    }

    // ── Step 6: Aggregate spend by campaign ─────────────────────────────────
    type CampaignSpendEntry = {
      name: string;
      spend: number;
      fb_leads: number;
      impressions: number;
      clicks: number;
      freq_sum: number;
      freq_count: number;
    };

    const campaignSpend = new Map<string, CampaignSpendEntry>();
    const adsetSpend = new Map<string, {
      name: string;
      campaign_id: string;
      campaign_name: string;
      spend: number;
      fb_leads: number;
      freq_sum: number;
      freq_count: number;
    }>();
    const adSpend = new Map<string, {
      name: string;
      campaign_id: string;
      campaign_name: string;
      spend: number;
      fb_leads: number;
      impressions: number;
      clicks: number;
      freq_sum: number;
      freq_count: number;
    }>();

    for (const row of (spendData || []) as Array<{
      campaign_id: string;
      campaign_name: string | null;
      adset_id: string | null;
      adset_name: string | null;
      ad_id: string | null;
      ad_name: string | null;
      spend: number;
      leads: number;
      impressions: number;
      clicks: number;
      frequency: number | null;
    }>) {
      const spendVal = Number(row.spend) || 0;
      const leadsVal = Number(row.leads) || 0;
      const impVal = Number(row.impressions) || 0;
      const clicksVal = Number(row.clicks) || 0;
      const freqVal = row.frequency ? Number(row.frequency) : null;

      // Campaign level
      if (row.campaign_id) {
        const entry = campaignSpend.get(row.campaign_id) || {
          name: row.campaign_name || "Unknown",
          spend: 0, fb_leads: 0, impressions: 0, clicks: 0, freq_sum: 0, freq_count: 0,
        };
        entry.spend += spendVal;
        entry.fb_leads += leadsVal;
        entry.impressions += impVal;
        entry.clicks += clicksVal;
        if (freqVal) { entry.freq_sum += freqVal; entry.freq_count++; }
        campaignSpend.set(row.campaign_id, entry);
      }

      // Ad set level
      if (row.adset_id) {
        const entry = adsetSpend.get(row.adset_id) || {
          name: row.adset_name || "Unknown",
          campaign_id: row.campaign_id || "",
          campaign_name: row.campaign_name || "Unknown",
          spend: 0, fb_leads: 0, freq_sum: 0, freq_count: 0,
        };
        entry.spend += spendVal;
        entry.fb_leads += leadsVal;
        if (freqVal) { entry.freq_sum += freqVal; entry.freq_count++; }
        adsetSpend.set(row.adset_id, entry);
      }

      // Ad (creative) level
      if (row.ad_id) {
        const entry = adSpend.get(row.ad_id) || {
          name: row.ad_name || "Unknown",
          campaign_id: row.campaign_id || "",
          campaign_name: row.campaign_name || "Unknown",
          spend: 0, fb_leads: 0, impressions: 0, clicks: 0, freq_sum: 0, freq_count: 0,
        };
        entry.spend += spendVal;
        entry.fb_leads += leadsVal;
        entry.impressions += impVal;
        entry.clicks += clicksVal;
        if (freqVal) { entry.freq_sum += freqVal; entry.freq_count++; }
        adSpend.set(row.ad_id, entry);
      }
    }

    // ── Step 7: Build campaign ROAS report ───────────────────────────────────
    const campaignRoas: CampaignROAS[] = [];

    for (const [campaignId, spend] of campaignSpend.entries()) {
      const contactEntry = campaignContacts.get(campaignId);
      const { revenue, deals } = contactEntry
        ? computeRevenue(contactEntry.contact_ids)
        : { revenue: 0, deals: 0 };

      const roas = spend.spend > 0 && revenue > 0 ? revenue / spend.spend : 0;
      const cpl = spend.fb_leads > 0 ? spend.spend / spend.fb_leads : spend.spend;
      const cpo = deals > 0 ? spend.spend / deals : 0;
      const frequency = spend.freq_count > 0 ? spend.freq_sum / spend.freq_count : 0;

      const { action, reason } = classifyAction(roas, frequency);

      campaignRoas.push({
        campaign_id: campaignId,
        campaign_name: spend.name,
        spend_aed: Math.round(spend.spend * 100) / 100,
        leads: spend.fb_leads,
        deals_count: deals,
        revenue_aed: Math.round(revenue * 100) / 100,
        roas: Math.round(roas * 100) / 100,
        cpl_aed: Math.round(cpl * 100) / 100,
        cpo_aed: Math.round(cpo * 100) / 100,
        summary: `Campaign "${spend.name}": Spent AED ${spend.spend.toFixed(0)} → Generated AED ${revenue.toFixed(0)} = ${roas.toFixed(2)}x ROAS`,
        action,
        action_reason: reason,
      });
    }

    campaignRoas.sort((a, b) => b.spend_aed - a.spend_aed);

    // ── Step 8: Build ad set ROAS report ─────────────────────────────────────
    const adsetRoas: AdSetROAS[] = [];

    for (const [adsetId, spend] of adsetSpend.entries()) {
      const contactEntry = adsetContacts.get(adsetId);
      const { revenue, deals } = contactEntry
        ? computeRevenue(contactEntry.contact_ids)
        : { revenue: 0, deals: 0 };

      const roas = spend.spend > 0 && revenue > 0 ? revenue / spend.spend : 0;
      const cpl = spend.fb_leads > 0 ? spend.spend / spend.fb_leads : spend.spend;
      const frequency = spend.freq_count > 0 ? spend.freq_sum / spend.freq_count : 0;

      const { action } = classifyAction(roas, frequency);

      adsetRoas.push({
        adset_id: adsetId,
        adset_name: spend.name,
        campaign_id: spend.campaign_id,
        campaign_name: spend.campaign_name,
        spend_aed: Math.round(spend.spend * 100) / 100,
        leads: spend.fb_leads,
        deals_count: deals,
        revenue_aed: Math.round(revenue * 100) / 100,
        roas: Math.round(roas * 100) / 100,
        cpl_aed: Math.round(cpl * 100) / 100,
        frequency: Math.round(frequency * 100) / 100,
        action,
      });
    }

    adsetRoas.sort((a, b) => b.spend_aed - a.spend_aed);

    // ── Step 9: Build creative ROAS report ───────────────────────────────────
    const creativeRoas: CreativeROAS[] = [];

    for (const [adId, spend] of adSpend.entries()) {
      const contactEntry = adContacts.get(adId);
      const { revenue, deals } = contactEntry
        ? computeRevenue(contactEntry.contact_ids)
        : { revenue: 0, deals: 0 };

      const roas = spend.spend > 0 && revenue > 0 ? revenue / spend.spend : 0;
      const cpl = spend.fb_leads > 0 ? spend.spend / spend.fb_leads : spend.spend;
      const ctrPct = spend.impressions > 0 ? (spend.clicks / spend.impressions) * 100 : 0;
      const frequency = spend.freq_count > 0 ? spend.freq_sum / spend.freq_count : 0;

      let fatigueStatus: "OK" | "WARNING" | "CRITICAL" = "OK";
      if (frequency >= 5.0) fatigueStatus = "CRITICAL";
      else if (frequency >= 3.5) fatigueStatus = "WARNING";

      const { action } = classifyAction(roas, frequency);

      creativeRoas.push({
        ad_id: adId,
        ad_name: spend.name,
        campaign_id: spend.campaign_id,
        campaign_name: spend.campaign_name,
        spend_aed: Math.round(spend.spend * 100) / 100,
        leads: spend.fb_leads,
        deals_count: deals,
        revenue_aed: Math.round(revenue * 100) / 100,
        roas: Math.round(roas * 100) / 100,
        cpl_aed: Math.round(cpl * 100) / 100,
        ctr_pct: Math.round(ctrPct * 1000) / 1000,
        frequency: Math.round(frequency * 100) / 100,
        fatigue_status: fatigueStatus,
        action,
      });
    }

    creativeRoas.sort((a, b) => b.spend_aed - a.spend_aed);

    // ── Step 10: Top-level summary ───────────────────────────────────────────
    const totalSpend = campaignRoas.reduce((s, c) => s + c.spend_aed, 0);
    const totalRevenue = campaignRoas.reduce((s, c) => s + c.revenue_aed, 0);
    const trueRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const totalLeads = campaignRoas.reduce((s, c) => s + c.leads, 0);
    const globalCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const totalDeals = campaignRoas.reduce((s, c) => s + c.deals_count, 0);
    const globalCpo = totalDeals > 0 ? totalSpend / totalDeals : 0;

    const killCampaigns = campaignRoas.filter((c) => c.action === "KILL");
    const scaleCampaigns = campaignRoas.filter((c) => c.action === "SCALE");

    structuredLog("true-roas-calculator", "info", "TRUE ROAS calculation complete", {
      campaigns: campaignRoas.length,
      true_roas: trueRoas.toFixed(2),
      total_spend_aed: Math.round(totalSpend),
      total_revenue_aed: Math.round(totalRevenue),
    });

    return apiSuccess({
      success: true,
      analysis_period_days: days,
      summary: {
        total_spend_aed: Math.round(totalSpend),
        total_revenue_aed: Math.round(totalRevenue),
        true_roas: Math.round(trueRoas * 100) / 100,
        true_roas_summary: `Spent AED ${Math.round(totalSpend).toLocaleString()} → Generated AED ${Math.round(totalRevenue).toLocaleString()} = ${trueRoas.toFixed(2)}x TRUE ROAS`,
        total_leads: totalLeads,
        total_deals: totalDeals,
        global_cpl_aed: Math.round(globalCpl * 100) / 100,
        global_cpo_aed: Math.round(globalCpo * 100) / 100,
        kill_campaigns: killCampaigns.length,
        scale_campaigns: scaleCampaigns.length,
        note: trueRoas < 1.5 ? "⚠️ ROAS below breakeven threshold of 1.5x — immediate optimization required." : trueRoas > 3.0 ? "✅ ROAS above 3x — profitable. Scale winners." : "📊 ROAS in mid-range. Focus on efficiency.",
      },
      campaigns: campaignRoas,
      adsets: adsetRoas.slice(0, 50), // top 50 ad sets
      creatives: creativeRoas.slice(0, 100), // top 100 creatives
    });
  } catch (error: unknown) {
    return handleError(error, "true-roas-calculator", {
      supabase: createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ),
      errorCode: ErrorCode.INTERNAL_ERROR,
      context: { function: "true-roas-calculator" },
    });
  }
};

serve(
  withTracing(handler, {
    functionName: "true-roas-calculator",
    runType: "chain",
    tags: ["marketing", "roas", "attribution", "cpl"],
  }),
);
