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
      .select("*")
      .gte("date", sixMonthsAgo.toISOString())
      .order("date", { ascending: true });

    if (error) throw error;

    // 2. Calculate Key SaaS Metrics (CLV, CAC, MRR) — USING REAL DATA

    // --- Real active client count from health scores ---
    const { count: activeClients } = await supabase
      .from("client_health_scores")
      .select("*", { count: "exact", head: true })
      .gt("outstanding_sessions", 0);
    const realActiveClients = activeClients || 1; // Avoid division by zero

    // --- Real churn rate from health zone distribution (last 90 days) ---
    const { data: healthData } = await supabase
      .from("client_health_scores")
      .select("health_zone");
    const totalTracked = healthData?.length || 1;
    const redZoneClients =
      healthData?.filter((c) => c.health_zone === "RED").length || 0;
    const yellowZoneClients =
      healthData?.filter((c) => c.health_zone === "YELLOW").length || 0;
    // Weighted churn: RED clients = likely to churn, YELLOW = 30% probability
    const estimatedChurners = redZoneClients + yellowZoneClients * 0.3;
    const realChurnRate = Math.max(
      0.01,
      Math.min(0.5, estimatedChurners / totalTracked),
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
        cac: `$${cac.toFixed(2)}`,
        clv: `$${clv.toFixed(2)}`,
        arpu: `$${arpu.toFixed(2)}`,
        ltv_cac_ratio: ltvCacRatio > 0 ? ltvCacRatio.toFixed(2) : "N/A",
        burn_rate: netBurn > 0 ? `$${netBurn.toFixed(2)}/mo` : "Profitable",
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
      
      KEY CONTEXT:
      - Churn Rate: ${(realChurnRate * 100).toFixed(1)}% (computed from ${redZoneClients} RED + ${yellowZoneClients} YELLOW clients out of ${totalTracked} tracked)
      - Revenue Growth: ${revenueGrowthRate.toFixed(1)}% month-over-month
      - LTV/CAC Ratio: ${ltvCacRatio > 0 ? ltvCacRatio.toFixed(2) : "N/A"} (healthy = 3.0+)
      - Rule of 40: ${(revenueGrowthRate + (monthlyNetCash / (totalRevenue || 1)) * 100).toFixed(1)}% (growth% + margin%)
      - ARR Run Rate: $${arr.toFixed(0)}
      
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
