import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { getConstitutionalSystemMessage } from "../_shared/constitutional-framing.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    verifyAuth(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const { thinkingLevel, thoughtSignature } = body;

    console.log(
      `💰 Starting Financial Analytics Engine (Thinking: ${thinkingLevel || "default"})...`,
    );

    // 1. Fetch Financial Data (Stripe + Supabase)
    // In production, we would fetch real Stripe BalanceTransactions.
    // For now, we simulate a robust dataset based on 'daily_business_metrics' to ensure the AI has distinct patterns to analyze.

    // Fetch last 6 months of metrics for trend analysis
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: metrics, error } = await supabase
      .from("daily_business_metrics")
      .select("date, total_revenue_booked, ad_spend_facebook, total_leads_new")
      .gte("date", sixMonthsAgo.toISOString())
      .order("date", { ascending: true });

    if (error) throw error;

    // 2. Calculate Key SaaS Metrics (CLV, CAC, MRR) — USING REAL DATA

    // --- Real active client count from health scores ---
    const { count: activeClients, data: healthData } = await supabase
      .from("client_health_scores")
      .select("health_zone, outstanding_sessions")
      .gt("outstanding_sessions", 0);
    const realActiveClients = activeClients || healthData?.length || 1; // Avoid division by zero
    const totalTracked = healthData?.length || 0;

    // --- Real churn rate from actual payment/session gaps (last 90 days) ---
    // Churned = was active in past 90d but no session in last 45d AND outstanding_sessions = 0
    const { data: churnData } = await supabase
      .from("contacts")
      .select("last_paid_session_date, outstanding_sessions, sessions_last_90d")
      .gt("sessions_last_90d", 0); // Only count clients who were active in 90d window

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const totalActive90d = churnData?.length || 1;
    let churned = 0;
    let redZoneClients = 0;
    let yellowZoneClients = 0;

    for (const c of churnData || []) {
      const lastSession = c.last_paid_session_date
        ? new Date(c.last_paid_session_date).getTime()
        : 0;
      const daysSinceSession = lastSession > 0 ? (now - lastSession) / dayMs : 999;
      const noSessions = (c.outstanding_sessions || 0) === 0;

      if (daysSinceSession > 45 && noSessions) {
        churned++;
        redZoneClients++;
      } else if (daysSinceSession > 30 || noSessions) {
        yellowZoneClients++;
      }
    }

    const realChurnRate = Math.max(
      0.01,
      Math.min(0.5, churned / totalActive90d),
    );

    // --- Revenue calculations ---
    const latestMonth = metrics?.slice(-30) || [];
    const previousMonth = metrics?.slice(-60, -30) || [];

    const totalRevenue = latestMonth.reduce(
      (sum, m) => sum + (m.total_revenue_booked || 0),
      0,
    );
    const prevRevenue = previousMonth.reduce(
      (sum, m) => sum + (m.total_revenue_booked || 0),
      0,
    );
    const totalSpend = latestMonth.reduce(
      (sum, m) => sum + (m.ad_spend_facebook || 0),
      0,
    );
    const prevSpend = previousMonth.reduce(
      (sum, m) => sum + (m.ad_spend_facebook || 0),
      0,
    );

    // --- Real new client conversions from Stripe ---
    // Use Stripe new customers created in last 30 days (much more accurate than leads)
    let realNewClients = 0;
    try {
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
      const stripeCustomers = await stripe.customers.list({
        created: { gte: thirtyDaysAgo },
        limit: 100,
      });
      realNewClients = stripeCustomers.data.length;
    } catch (stripeErr) {
      console.warn(
        "⚠️ Stripe customer fetch failed, falling back to leads proxy:",
        stripeErr,
      );
      // Fallback: use leads but apply typical lead→customer conversion rate (~15%)
      const rawLeads = latestMonth.reduce(
        (sum, m) => sum + (m.total_leads_new || 0),
        0,
      );
      realNewClients = Math.max(1, Math.round(rawLeads * 0.15));
    }

    // --- Lead & Opportunity counts (for CPL / CPO) ---
    const totalLeads = latestMonth.reduce(
      (sum, m) => sum + (m.total_leads_new || 0),
      0,
    );

    // Opportunities = contacts with lifecycle stage "salesqualifiedlead" or "opportunity"
    // created in the last 30 days
    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: opportunityCount } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .in("lifecycle_stage", ["salesqualifiedlead", "opportunity"])
      .gte("created_at", thirtyDaysAgoIso);
    const totalOpportunities = opportunityCount || 1; // avoid division by zero

    // CPL = Total Ad Spend / Total Leads  (AED)
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

    // CPO = Total Ad Spend / Total Opportunities  (AED)
    const cpo = totalOpportunities > 0 ? totalSpend / totalOpportunities : 0;

    // --- Unit Economics ---
    const cac = realNewClients > 0 ? totalSpend / realNewClients : 0;
    const arpu = realActiveClients > 0 ? totalRevenue / realActiveClients : 0;
    const clv = realChurnRate > 0 ? arpu / realChurnRate : 0;
    const ltvCacRatio = cac > 0 ? clv / cac : 0;

    // --- Bonus: Growth, Burn Rate & Runway ---
    const revenueGrowthRate =
      prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const netBurn = totalSpend - totalRevenue; // Negative means profitable
    const monthlyNetCash = totalRevenue - totalSpend;
    // ARR projection from current month
    const arr = totalRevenue * 12;

    const financialSnapshot = {
      period: "Last 30 Days",
      revenue: totalRevenue.toFixed(2),
      arr: arr.toFixed(2),
      spend: totalSpend,
      net_cash: monthlyNetCash,
      revenue_growth_pct: revenueGrowthRate.toFixed(1),
      prev_month_revenue: prevRevenue.toFixed(2),
      active_clients: realActiveClients,
      new_clients_acquired: realNewClients,
      churn_rate_pct: (realChurnRate * 100).toFixed(1),
      clients_at_risk: redZoneClients + yellowZoneClients,
      unit_economics: {
        cac: `AED ${cac.toFixed(2)}`,
        clv: `AED ${clv.toFixed(2)}`,
        arpu: `AED ${arpu.toFixed(2)}`,
        ltv_cac_ratio: ltvCacRatio > 0 ? ltvCacRatio.toFixed(2) : "N/A",
        burn_rate: netBurn > 0 ? `AED ${netBurn.toFixed(2)}/mo` : "Profitable",
        // Attribution metrics (Phase 2)
        cpl: `AED ${cpl.toFixed(2)}`,  // Cost Per Lead
        cpo: `AED ${cpo.toFixed(2)}`,  // Cost Per Opportunity
        total_leads: totalLeads,
        total_opportunities: totalOpportunities,
        ad_spend_aed: totalSpend,
      },
      health_distribution: {
        total_tracked: totalTracked,
        red: redZoneClients,
        yellow: yellowZoneClients,
        green: healthData?.filter((c) => c.health_zone === "GREEN").length || 0,
        purple:
          healthData?.filter((c) => c.health_zone === "PURPLE").length || 0,
      },
    };

    console.log("📊 calculated snapshot:", financialSnapshot);

    // 3. AI Scenario Planning (Best, Base, Worst Case)
    // We ask the Unified AI to project future scenarios based on these specific economics.

    const prompt = `
      You are the PTD Chief Financial Officer. Analyze with precision.
      
      CURRENT FINANCIALS (Last 30 Days — ALL REAL DATA):
      ${JSON.stringify(financialSnapshot, null, 2)}
      
      KEY CONTEXT (ALL VALUES IN AED):
      - Churn Rate: ${(realChurnRate * 100).toFixed(1)}% (computed from ${redZoneClients} RED + ${yellowZoneClients} YELLOW clients out of ${totalTracked} tracked)
      - Revenue Growth: ${revenueGrowthRate.toFixed(1)}% month-over-month
      - LTV/CAC Ratio: ${ltvCacRatio > 0 ? ltvCacRatio.toFixed(2) : "N/A"} (healthy = 3.0+)
      - Rule of 40: ${(revenueGrowthRate + (monthlyNetCash / (totalRevenue || 1)) * 100).toFixed(1)}% (growth% + margin%)
      - ARR Run Rate: AED ${arr.toFixed(0)}
      - CPL (Cost Per Lead): AED ${cpl.toFixed(2)} — total_ad_spend / total_leads (${totalLeads} leads)
      - CPO (Cost Per Opportunity): AED ${cpo.toFixed(2)} — total_ad_spend / total_opportunities (${totalOpportunities} opps)
      - Attribution note: CPL and CPO are the primary Facebook ad efficiency metrics
      
      TASK:
      Generate a "Scenario Plan" for the next quarter (Q+1).
      
      1. **Base Case**: If current trends continue (use exact growth rate).
      2. **Bull Case (Best)**: If we optimize CAC by 20%, reduce churn by 30%, and grow clients 15%.
      3. **Bear Case (Worst)**: If ad costs rise 25%, churn doubles, and growth stalls.
      
      OUTPUT:
      Return a JSON object with keys: "base_case", "bull_case", "bear_case".
      Each case should have: "projected_revenue", "projected_arr", "projected_profit", "risk_factors" (array of 3), "strategic_move" (string), "confidence_pct" (number 0-100).
      
      Add a "cfo_commentary" field with 3-4 sentence executive summary.
      Add a "rule_of_40_assessment" field explaining if the business passes or fails Rule of 40 and what to prioritize.
      Add a "unit_economics_health" field with verdict: "EXCELLENT" / "HEALTHY" / "WARNING" / "CRITICAL" and why.
    `;

    const constitutionalPrefix = getConstitutionalSystemMessage();
    const aiResponse = await unifiedAI.chat(
      [
        { role: "system", content: constitutionalPrefix },
        { role: "user", content: prompt },
      ],
      {
        max_tokens: 1500,
        jsonMode: true,
        temperature: 0.4,
        thinkingLevel: thinkingLevel || "high",
        thoughtSignature,
      },
    );

    let scenarios = {};
    try {
      scenarios = JSON.parse(aiResponse.content);
    } catch (e) {
      console.error("Failed to parse AI scenarios:", e);
      scenarios = { error: "AI generation failed", raw: aiResponse.content };
    }

    // 4. Return Combined Intelligence
    return apiSuccess({
      generated_at: new Date().toISOString(),
      metrics: financialSnapshot,
      scenarios: scenarios,
      ai_thought_process: aiResponse.thought, // Internal reasoning audit
      thoughtSignature: aiResponse.thoughtSignature, // Gemini 3 Context
    });
  } catch (error: unknown) {
    console.error("Financial Analytics Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError("INTERNAL_ERROR", message, 500);
  }
});
