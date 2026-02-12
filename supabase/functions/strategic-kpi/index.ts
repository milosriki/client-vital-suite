import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { getConstitutionalSystemMessage } from "../_shared/constitutional-framing.ts";

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
      `🎯 Starting Strategic KPI Engine (Thinking: ${thinkingLevel || "default"})...`,
    );

    // 1. Fetch KPI Data (Aggregated from various tables)
    // We aggregate data from 'daily_business_metrics', 'coach_performance', and 'system_health'.

    const { data: metrics, error } = await supabase
      .from("daily_business_metrics")
      .select(
        "date, total_revenue_booked, total_leads_new, ad_spend_facebook, total_sessions_conducted, total_active_clients, new_client_conversion_rate, churn_rate",
      )
      .order("date", { ascending: false })
      .limit(90); // 90 days for quarterly OKR tracking

    if (error) throw error;

    // 2. Define OKRs (Objectives and Key Results)
    // Hardcoded for now, but ideally fetched from a 'strategic_goals' table.
    const currentOKRs = {
      objective: "Scale to 500k ARR with Healthy Unit Economics",
      key_results: [
        {
          metric: "total_revenue_booked",
          target: 450000,
          current: 0,
          status: "pending",
        },
        {
          metric: "total_leads_new",
          target: 300,
          current: 0,
          status: "pending",
        },
        {
          metric: "cac_efficiency",
          target: 1500,
          current: 0,
          status: "pending",
        }, // Target < 1500
      ],
    };

    // Calculate Current Values from Data
    const validMetrics = metrics?.filter((m) => m) || [];
    currentOKRs.key_results[0].current = validMetrics.reduce(
      (sum, m) => sum + (m.total_revenue_booked || 0),
      0,
    );
    currentOKRs.key_results[1].current = validMetrics.reduce(
      (sum, m) => sum + (m.total_leads_new || 0),
      0,
    );

    const totalSpend = validMetrics.reduce(
      (sum, m) => sum + (m.ad_spend_facebook || 0),
      0,
    );
    const cac =
      currentOKRs.key_results[1].current > 0
        ? totalSpend / currentOKRs.key_results[1].current
        : 0;
    currentOKRs.key_results[2].current = Math.round(cac);

    // Evaluate Status
    currentOKRs.key_results.forEach((kr) => {
      // Simplified status logic
      // For revenue/leads: Higher is better
      // For CAC: Lower is better
      const isEfficiencyMetric = kr.metric === "cac_efficiency";
      let onTrack = false;

      if (isEfficiencyMetric) onTrack = kr.current <= kr.target;
      else onTrack = kr.current >= kr.target * 0.8; // 80% progress is passing for this check

      kr.status = onTrack ? "ON TRACK" : "AT RISK";
    });

    console.log("📊 OKR Status:", currentOKRs);

    // 3. Anomaly Detection (Statistical Z-Score Analysis)
    // Detect if yesterday's metrics deviated significantly from the 30-day moving average.

    const anomalies: any[] = [];

    if (validMetrics.length > 30) {
      const yesterday = validMetrics[0];
      const history = validMetrics.slice(1, 31);

      // Expanded: monitor 7 key metrics instead of just 2
      [
        "total_revenue_booked",
        "total_leads_new",
        "ad_spend_facebook",
        "total_sessions_conducted",
        "total_active_clients",
        "new_client_conversion_rate",
        "churn_rate",
      ].forEach((key) => {
        const values = history.map((m) => m[key] || 0);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const stdDev = Math.sqrt(
          values.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b) /
            values.length,
        );

        const currentVal = yesterday[key] || 0;
        const zScore = stdDev > 0 ? (currentVal - mean) / stdDev : 0;

        if (Math.abs(zScore) > 2) {
          // 2 Sigma deviation
          anomalies.push({
            metric: key,
            value: currentVal,
            mean: Math.round(mean * 100) / 100,
            deviation: zScore.toFixed(2),
            direction: zScore > 0 ? "SPIKE" : "DROP",
            severity: Math.abs(zScore) > 3 ? "CRITICAL" : "WARNING",
          });
        }
      });
    }

    // 4. AI Strategic Advisory
    // Ask Unified AI to interpret the OKR progress and anomalies.

    const prompt = `
      You are the PTD Chief Strategy Officer.
      
      QUARTERLY OKRs:
      ${JSON.stringify(currentOKRs, null, 2)}
      
      DETECTED ANOMALIES (Last 24h):
      ${JSON.stringify(anomalies, null, 2)}
      
      TASK:
      1. Provide a "Strategy Pulse" check. Are we winning the quarter?
      2. If anomalies exist, explain potential causes (e.g., "Lead drop potentially due to ad fatigue").
      3. Recommend one "North Star" adjustment for next week.
      
      OUTPUT:
      JSON object with keys: "strategy_pulse", "anomaly_analysis", "north_star_recommendation".
    `;

    const constitutionalPrefix = getConstitutionalSystemMessage();
    const aiResponse = await unifiedAI.chat(
      [
        { role: "system", content: constitutionalPrefix },
        { role: "user", content: prompt },
      ],
      {
        max_tokens: 1000,
        jsonMode: true,
        temperature: 0.3,
        thinkingLevel: thinkingLevel || "high", // Default to High for Strategy
        thoughtSignature,
      },
    );

    let advice = {};
    try {
      advice = JSON.parse(aiResponse.content);
    } catch (e) {
      advice = { error: "Strategy generation failed" };
    }

    return apiSuccess({
      generated_at: new Date().toISOString(),
      okrs: currentOKRs,
      anomalies: anomalies,
      strategic_advice: advice,
      ai_thought_process: aiResponse.thought,
      thoughtSignature: aiResponse.thoughtSignature,
    });
  } catch (error: unknown) {
    console.error("Strategic KPI Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError("INTERNAL_ERROR", message, 500);
  }
});
