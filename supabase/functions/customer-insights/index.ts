import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check for optional "owner_id" or "segment" query params
    // Gemini 3: Deep Reasoning Params
    const { thinkingLevel, thoughtSignature } = await req
      .json()
      .catch(() => ({}));

    const url = new URL(req.url);
    const specificOwner = url.searchParams.get("owner_id");

    console.log(
      `👥 Starting Customer Insights Engine (Thinking: ${thinkingLevel || "default"})...`,
    );

    // 1. Fetch Customer Behavior Data
    // We need contact activity, health scores, and communication logs.
    const { data: contacts, error } = await supabase
      .from("contacts")
      .select(
        "id, email, lifecycle_stage, status, hubspot_owner_id, last_contacted, total_revenue",
      )
      .neq("status", "ARCHIVED")
      .limit(200); // Analyze sample batch

    if (error) throw error;

    // 2. Behavioral Segmentation (Dynamic Percentile-Based)
    // Use actual revenue distribution instead of fixed threshold
    const revenues = (contacts || [])
      .map((c) => c.total_revenue || 0)
      .sort((a, b) => b - a);
    const p75Index = Math.floor(revenues.length * 0.25);
    const highValueThreshold = revenues[p75Index] || 5000; // Top 25% = high-value, fallback to 5000
    const medianRevenue = revenues[Math.floor(revenues.length / 2)] || 0;

    const segments = {
      champions: [] as any[], // High revenue, recent contact
      at_risk: [] as any[], // High revenue, no contact > 30 days
      sleeping: [] as any[], // Low revenue, no contact > 60 days
      new_potential: [] as any[], // New leads, high engagement
    };

    const now = new Date();

    contacts?.forEach((c) => {
      const lastContact = c.last_contacted
        ? new Date(c.last_contacted)
        : new Date(0);
      const daysSinceContact =
        (now.getTime() - lastContact.getTime()) / (1000 * 3600 * 24);
      const isHighValue = (c.total_revenue || 0) > highValueThreshold;

      if (isHighValue && daysSinceContact < 30) segments.champions.push(c);
      else if (isHighValue && daysSinceContact > 30) segments.at_risk.push(c);
      else if (!isHighValue && daysSinceContact > 60) segments.sleeping.push(c);
      else segments.new_potential.push(c);
    });

    const segmentationSummary = {
      champions: segments.champions.length,
      at_risk: segments.at_risk.length,
      sleeping: segments.sleeping.length,
      new_potential: segments.new_potential.length,
      total_analyzed: contacts?.length,
      high_value_threshold: `$${highValueThreshold.toFixed(0)} (P75 dynamic)`,
      median_revenue: `$${medianRevenue.toFixed(0)}`,
      total_portfolio_revenue: `$${revenues.reduce((a, b) => a + b, 0).toFixed(0)}`,
    };

    console.log("📊 Segmentation:", segmentationSummary);

    // 3. AI Churn Prediction & Voice of Customer Analysis
    // We send the 'At Risk' profile to the AI to generate a retention strategy.

    const prompt = `
      You are the PTD Chief Marketing Officer & Retention Specialist.
      
      SEGMENTATION DATA:
      ${JSON.stringify(segmentationSummary, null, 2)}
      
      AT RISK EXAMPLES (Anonymized):
      ${JSON.stringify(
        segments.at_risk
          .slice(0, 3)
          .map((c) => ({ status: c.status, days_silent: "30+" })),
        null,
        2,
      )}
      
      TASK:
      1. Analyze the "At Risk" segment. Why might high-value clients be disengaging?
      2. Generate a "Retention Campaign" strategy (e.g., specific email subject lines, offer types).
      3. Identify 3 "Churn Signals" to watch for in the future.
      
      OUTPUT:
      JSON object with keys: "churn_analysis", "retention_strategy", "churn_signals" (array).
    `;

    const aiResponse = await unifiedAI.chat(
      [{ role: "user", content: prompt }],
      {
        max_tokens: thinkingLevel === "high" ? 4000 : 1000,
        jsonMode: true,
        temperature: 0.5,
        thinkingLevel: thinkingLevel as "low" | "high",
        thoughtSignature,
      },
    );

    let insights = {};
    try {
      insights = JSON.parse(aiResponse.content);
    } catch (e) {
      console.error("AI Parse Error:", e);
      insights = { error: "Failed to generate insights" };
    }

    return apiSuccess({
      generated_at: new Date().toISOString(),
      segmentation: segmentationSummary,
      ai_insights: insights,
      ai_thought_process: aiResponse.thought,
      thoughtSignature: aiResponse.thoughtSignature, // Pass back signature
    });
  } catch (error: unknown) {
    console.error("Customer Insights Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError("INTERNAL_ERROR", message, 500);
  }
});
