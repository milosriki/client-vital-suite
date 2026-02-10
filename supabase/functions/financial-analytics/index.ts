import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
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

    // 2. Calculate Key SaaS Metrics (CLV, CAC, MRR)
    // Simple aggregations for now, would be more complex with individual transaction data

    const latestMonth = metrics?.slice(-30) || [];
    const totalRevenue = latestMonth.reduce(
      (sum, m) => sum + (m.total_revenue_booked || 0),
      0,
    );
    const totalSpend = latestMonth.reduce(
      (sum, m) => sum + (m.ad_spend_facebook || 0),
      0,
    );
    const newClients = latestMonth.reduce(
      (sum, m) => sum + (m.total_leads_new || 0),
      0,
    ); // Approx proxy for conversions if we don't have new_clients count in daily metrics

    // Avoid division by zero
    const cac = newClients > 0 ? (totalSpend / newClients).toFixed(2) : "0.00";
    const mrr = totalRevenue.toFixed(2); // Assuming revenue booked ~ MRR for this context

    // CLV Estimate: ARPU / Churn Rate
    // We'll use a placeholder Churn Rate of 5% (0.05) until we have the Churn Predictor
    const activeClientsEst = 150; // Estimated active base
    const arpu = activeClientsEst > 0 ? totalRevenue / activeClientsEst : 0;
    const churnRate = 0.05;
    const clv = churnRate > 0 ? (arpu / churnRate).toFixed(2) : "0.00";

    const financialSnapshot = {
      period: "Last 30 Days",
      revenue: mrr,
      spend: totalSpend,
      net_cash: totalRevenue - totalSpend,
      unit_economics: {
        cac: `$${cac}`,
        clv: `$${clv}`,
        ltv_cac_ratio:
          newClients > 0 && Number(cac) > 0
            ? (Number(clv) / Number(cac)).toFixed(2)
            : "N/A",
      },
    };

    console.log("📊 calculated snapshot:", financialSnapshot);

    // 3. AI Scenario Planning (Best, Base, Worst Case)
    // We ask the Unified AI to project future scenarios based on these specific economics.

    const prompt = `
      You are the PTD Chief Financial Officer.
      
      CURRENT FINANCIALS (Last 30 Days):
      ${JSON.stringify(financialSnapshot, null, 2)}
      
      TASK:
      Generate a "Scenario Plan" for the next quarter (Q+1).
      
      1. **Base Case**: If current trends continue.
      2. **Bull Case (Best)**: If we optimize CAC by 20% and improve Retention.
      3. **Bear Case (Worst)**: If ad costs rise 20% and churn increases.
      
      OUTPUT:
      Return a JSON object with keys: "base_case", "bull_case", "bear_case".
      Each case should have: "projected_revenue", "projected_profit", "risk_factors" (array), "strategic_move" (string).
      
      Add a "cfo_commentary" field with your executive summary of the financial health.
    `;

    const aiResponse = await unifiedAI.chat(
      [{ role: "user", content: prompt }],
      {
        max_tokens: 1000,
        jsonMode: true,
        temperature: 0.4,
        thinkingLevel: thinkingLevel || "high", // Default to High for Financials
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
