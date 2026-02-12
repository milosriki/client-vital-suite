import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";
import {
  handleError,
  ErrorCode,
} from "../_shared/error-handler.ts";

// ============================================
// DAILY COMMAND BRIEFING
// Full-chain daily intelligence for Slack/WhatsApp
// ============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface BriefingData {
  date: string;
  money_chain: {
    ad_spend: number;
    leads: number;
    bookings: number;
    closed_won: number;
    revenue: number;
    roas: string;
    cpl: number;
  };
  campaigns_needing_action: Array<{
    campaign: string;
    verdict: string;
    spend: number;
    leads: number;
    closed: number;
  }>;
  cold_leads_count: number;
  no_shows_count: number;
  churn_risk_count: number;
  upcoming_assessments: Array<{ name: string; coach: string; date: string }>;
  top_risks: Array<{ name: string; score: number; trend: string }>;
  setter_alerts: Array<{ setter: string; ghost_rate: number }>;
}

async function generateBriefing(): Promise<BriefingData> {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  const [
    adSpendResult, leadsResult, dealsResult, funnelResult,
    coldResult, noShowsResult, churnResult, assessmentsResult, setterResult,
  ] = await Promise.all([
    supabase.from("facebook_ads_insights").select("spend").gte("date", thirtyDaysAgo),
    supabase.from("contacts").select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from("deals").select("stage, deal_value")
      .gte("updated_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from("campaign_full_funnel").select("campaign, verdict, spend, db_leads, closed_won")
      .in("verdict", ["BAD_LEADS", "FIX_FOLLOWUP", "FIX_COACH", "FIX_ROAS"]),
    supabase.from("cold_leads").select("id", { count: "exact", head: true }),
    supabase.from("assessment_truth_matrix").select("id", { count: "exact", head: true })
      .in("truth_status", ["BOOKED_NOT_ATTENDED", "HUBSPOT_ONLY_NO_AWS_PROOF"]),
    supabase.from("client_health_scores")
      .select("firstname, lastname, health_score, health_trend, churn_risk_score")
      .in("health_trend", ["DECLINING", "CLIFF_FALL"])
      .order("churn_risk_score", { ascending: false }).limit(5),
    supabase.from("upcoming_assessments")
      .select("first_name, last_name, coach, assessment_date, days_until")
      .lte("days_until", 2),
    supabase.from("setter_funnel_matrix").select("setter_name, ghost_rate_pct")
      .gt("ghost_rate_pct", 40),
  ]);

  const adSpend = (adSpendResult.data || []).reduce((s: number, r: any) => s + (r.spend || 0), 0);
  const leads = leadsResult.count || 0;
  const bookingStages = new Set([
    "122237508", "122237276", "122221229", "qualifiedtobuy",
    "decisionmakerboughtin", "2900542", "987633705", "closedwon",
  ]);
  let bookings = 0, closedWon = 0, revenue = 0;
  (dealsResult.data || []).forEach((d: any) => {
    if (bookingStages.has(d.stage || "")) bookings++;
    if (d.stage === "closedwon") { closedWon++; revenue += d.deal_value || 0; }
  });

  return {
    date: today,
    money_chain: {
      ad_spend: Math.round(adSpend), leads, bookings, closed_won: closedWon,
      revenue: Math.round(revenue),
      roas: adSpend > 0 ? (revenue / adSpend).toFixed(1) : "N/A",
      cpl: adSpend > 0 && leads > 0 ? Math.round(adSpend / leads) : 0,
    },
    campaigns_needing_action: (funnelResult.data || []).map((c: any) => ({
      campaign: c.campaign, verdict: c.verdict,
      spend: Math.round(c.spend || 0), leads: c.db_leads || 0, closed: c.closed_won || 0,
    })),
    cold_leads_count: coldResult.count || 0,
    no_shows_count: noShowsResult.count || 0,
    churn_risk_count: (churnResult.data || []).length,
    upcoming_assessments: (assessmentsResult.data || []).map((a: any) => ({
      name: [a.first_name, a.last_name].filter(Boolean).join(" ") || "Unknown",
      coach: a.coach || "Unassigned", date: a.assessment_date,
    })),
    top_risks: (churnResult.data || []).map((c: any) => ({
      name: [c.firstname, c.lastname].filter(Boolean).join(" ") || "Unknown",
      score: c.health_score, trend: c.health_trend,
    })),
    setter_alerts: (setterResult.data || [])
      .filter((s: any) => s.ghost_rate_pct > 40)
      .map((s: any) => ({ setter: s.setter_name || "Unknown", ghost_rate: Math.round(s.ghost_rate_pct) })),
  };
}

function formatSlackBlocks(b: BriefingData) {
  const mc = b.money_chain;
  const blocks: any[] = [
    { type: "header", text: { type: "plain_text", text: `PTD Command Briefing — ${b.date}` } },
    { type: "section", text: { type: "mrkdwn", text: [
      `*Money Chain (30d):*`,
      `Ad Spend: ${mc.ad_spend.toLocaleString()} AED | Leads: ${mc.leads} | Bookings: ${mc.bookings}`,
      `Closed Won: ${mc.closed_won} (${mc.revenue.toLocaleString()} AED) | ROAS: ${mc.roas}x | CPL: ${mc.cpl} AED`,
    ].join("\n") } },
  ];

  if (b.campaigns_needing_action.length > 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text:
      `*Campaigns Needing Action:*\n` + b.campaigns_needing_action.slice(0, 5)
        .map(c => `• ${c.campaign}: ${c.verdict} (${c.spend.toLocaleString()} AED → ${c.closed} closes)`)
        .join("\n"),
    } });
  }

  const alerts: string[] = [];
  if (b.cold_leads_count > 0) alerts.push(`:snowflake: ${b.cold_leads_count} cold leads (no deal in 7d)`);
  if (b.no_shows_count > 0) alerts.push(`:ghost: ${b.no_shows_count} no-shows need follow-up`);
  if (b.churn_risk_count > 0) alerts.push(`:warning: ${b.churn_risk_count} clients at churn risk`);
  if (b.setter_alerts.length > 0) alerts.push(`:telephone_receiver: High ghost rate: ${b.setter_alerts.map(s => `${s.setter} (${s.ghost_rate}%)`).join(", ")}`);

  if (alerts.length > 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Alerts:*\n${alerts.join("\n")}` } });
  }

  if (b.upcoming_assessments.length > 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text:
      `*Upcoming Assessments (today/tomorrow):*\n` +
      b.upcoming_assessments.map(a => `• ${a.name} — Coach: ${a.coach} (${a.date})`).join("\n"),
    } });
  }

  return { blocks };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  const startTime = Date.now();
  try {
    verifyAuth(req);
    const { send_slack = false, webhook_url } = await req.json().catch(() => ({}));

    if (send_slack && webhook_url) {
      if (!webhook_url.startsWith("https://hooks.slack.com/services/")) {
        throw new Error("Invalid webhook URL. Only Slack webhooks allowed.");
      }
    }

    console.log("[Command Briefing] Generating...");
    const briefing = await generateBriefing();

    if (send_slack && webhook_url) {
      try {
        const resp = await fetch(webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formatSlackBlocks(briefing)),
        });
        if (!resp.ok) console.error("Slack failed:", resp.status);
        else console.log("Slack notification sent");
      } catch (e) { console.error("Slack error:", e); }
    }

    const duration = Date.now() - startTime;
    console.log(`[Command Briefing] Done in ${duration}ms`);
    return apiSuccess({ success: true, duration_ms: duration, briefing });
  } catch (error: unknown) {
    return handleError(error, "daily-command-briefing", {
      supabase, errorCode: ErrorCode.INTERNAL_ERROR,
    });
  }
});
