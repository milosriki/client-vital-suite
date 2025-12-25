import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// ERROR PREDICTION AGENT
// Predicts potential errors before they occur
// Uses historical patterns for proactive prevention
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function validateEnv(): { valid: boolean; missing: string[] } {
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter(key => !Deno.env.get(key));
  return { valid: missing.length === 0, missing };
}

const envCheck = validateEnv();
if (!envCheck.valid) {
  console.error("[Error Prediction Agent] Missing required environment variables:", envCheck.missing);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

interface ErrorPrediction {
  prediction_id: string;
  source: string;
  error_type: string;
  probability: number;  // 0-100
  confidence: number;   // 0-100
  time_horizon: string;
  risk_factors: string[];
  leading_indicators: string[];
  recommended_prevention: string[];
  historical_basis: string;
}

interface PredictionReport {
  timestamp: string;
  predictions_generated: number;
  high_probability_predictions: number;
  predictions: ErrorPrediction[];
  risk_assessment: string;
  prevention_priority: { source: string; urgency: string }[];
}

async function analyzeHistoricalPatterns(): Promise<Map<string, { dayOfWeek: number[]; hourOfDay: number[]; frequency: number }>> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: errors, error } = await supabase
    .from("sync_errors")
    .select("source, error_type, created_at")
    .gte("created_at", weekAgo);

  if (error || !errors) {
    return new Map();
  }

  const patterns = new Map<string, { dayOfWeek: number[]; hourOfDay: number[]; frequency: number }>();

  for (const err of errors) {
    const key = `${err.source || "unknown"}_${err.error_type || "unknown"}`;
    const date = new Date(err.created_at);

    if (!patterns.has(key)) {
      patterns.set(key, {
        dayOfWeek: Array(7).fill(0),
        hourOfDay: Array(24).fill(0),
        frequency: 0,
      });
    }

    const pattern = patterns.get(key)!;
    pattern.dayOfWeek[date.getDay()]++;
    pattern.hourOfDay[date.getHours()]++;
    pattern.frequency++;
  }

  return patterns;
}

function predictBasedOnPattern(
  key: string,
  pattern: { dayOfWeek: number[]; hourOfDay: number[]; frequency: number }
): ErrorPrediction | null {
  const [source, errorType] = key.split("_");
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const nextHour = (currentHour + 1) % 24;

  // Calculate probability based on historical occurrence
  const totalDayErrors = pattern.dayOfWeek.reduce((a, b) => a + b, 0);
  const totalHourErrors = pattern.hourOfDay.reduce((a, b) => a + b, 0);

  if (totalDayErrors === 0 || totalHourErrors === 0) {
    return null;
  }

  const dayProbability = (pattern.dayOfWeek[currentDay] / totalDayErrors) * 100;
  const hourProbability = (pattern.hourOfDay[nextHour] / totalHourErrors) * 100;

  // Combined probability
  const probability = Math.round((dayProbability + hourProbability) / 2);

  // Only report if probability is meaningful
  if (probability < 10 || pattern.frequency < 3) {
    return null;
  }

  // Calculate confidence based on data volume
  const confidence = Math.min(90, Math.round(50 + pattern.frequency * 2));

  const riskFactors: string[] = [];
  const leadingIndicators: string[] = [];
  const recommendedPrevention: string[] = [];

  // Analyze risk factors
  if (dayProbability > 50) {
    riskFactors.push(`High error rate on ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][currentDay]}s`);
  }
  if (hourProbability > 30) {
    riskFactors.push(`Peak error hour approaching (${nextHour}:00)`);
  }
  if (pattern.frequency > 20) {
    riskFactors.push("High historical frequency");
  }

  // Determine leading indicators
  if (errorType === "rate_limit") {
    leadingIndicators.push("Increased API call volume");
    recommendedPrevention.push("Implement request throttling");
  }
  if (errorType === "auth") {
    leadingIndicators.push("Token expiration approaching");
    recommendedPrevention.push("Proactively refresh tokens");
  }
  if (errorType === "timeout") {
    leadingIndicators.push("Increased response latency");
    recommendedPrevention.push("Monitor endpoint health");
  }

  // Default recommendations
  if (recommendedPrevention.length === 0) {
    recommendedPrevention.push(`Monitor ${source} integration closely`);
    recommendedPrevention.push("Review recent changes");
  }

  return {
    prediction_id: `pred_${source}_${errorType}_${Date.now()}`,
    source,
    error_type: errorType,
    probability,
    confidence,
    time_horizon: "Next 1-2 hours",
    risk_factors: riskFactors.length > 0 ? riskFactors : ["Historical pattern recurrence"],
    leading_indicators: leadingIndicators.length > 0 ? leadingIndicators : ["Historical pattern match"],
    recommended_prevention: recommendedPrevention,
    historical_basis: `Based on ${pattern.frequency} occurrences in last 7 days`,
  };
}

async function detectEarlyWarnings(): Promise<ErrorPrediction[]> {
  const predictions: ErrorPrediction[] = [];

  // Check for rate limit warnings (approaching limits)
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Count recent rate limit errors by source
  const { data: rateLimitErrors } = await supabase
    .from("sync_errors")
    .select("source")
    .eq("error_type", "rate_limit")
    .gte("created_at", hourAgo);

  if (rateLimitErrors && rateLimitErrors.length > 0) {
    const sourceCounts = new Map<string, number>();
    for (const err of rateLimitErrors) {
      const source = err.source || "unknown";
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    }

    for (const [source, count] of sourceCounts) {
      if (count >= 2) {
        predictions.push({
          prediction_id: `pred_ratelimit_${source}_${Date.now()}`,
          source,
          error_type: "rate_limit",
          probability: Math.min(95, 50 + count * 15),
          confidence: 85,
          time_horizon: "Next 30 minutes",
          risk_factors: [`${count} rate limit errors in last hour`, "Pattern indicates ongoing limit pressure"],
          leading_indicators: ["Recent rate limit errors", "Increased request volume"],
          recommended_prevention: [
            "Reduce API call frequency immediately",
            "Implement request queuing",
            "Consider batching requests",
          ],
          historical_basis: `${count} rate limit errors detected in last hour`,
        });
      }
    }
  }

  // Check for auth token expiration warnings
  const { data: authErrors } = await supabase
    .from("sync_errors")
    .select("source, created_at")
    .eq("error_type", "auth")
    .gte("created_at", new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString());

  if (authErrors && authErrors.length > 0) {
    const sourcesWithAuthIssues = [...new Set(authErrors.map(e => e.source || "unknown"))];

    for (const source of sourcesWithAuthIssues) {
      predictions.push({
        prediction_id: `pred_auth_${source}_${Date.now()}`,
        source,
        error_type: "auth",
        probability: 70,
        confidence: 75,
        time_horizon: "Next 4 hours",
        risk_factors: ["Recent authentication failures", "Possible token expiration"],
        leading_indicators: ["Auth errors in last 4 hours"],
        recommended_prevention: [
          `Refresh ${source} API credentials`,
          "Check token expiration times",
          "Verify OAuth configuration",
        ],
        historical_basis: "Recent auth errors suggest credential issues",
      });
    }
  }

  return predictions;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    if (!envCheck.valid) {
      throw new Error(`Missing required environment variables: ${envCheck.missing.join(", ")}`);
    }

    console.log("[Error Prediction Agent] Starting error prediction...");

    // Analyze historical patterns
    const patterns = await analyzeHistoricalPatterns();

    // Generate pattern-based predictions
    const patternPredictions: ErrorPrediction[] = [];
    for (const [key, pattern] of patterns) {
      const prediction = predictBasedOnPattern(key, pattern);
      if (prediction) {
        patternPredictions.push(prediction);
      }
    }

    // Get early warning predictions
    const earlyWarnings = await detectEarlyWarnings();

    // Combine and deduplicate predictions
    const allPredictions = [...earlyWarnings, ...patternPredictions];
    const uniquePredictions = allPredictions.filter((pred, index, self) =>
      index === self.findIndex(p => p.source === pred.source && p.error_type === pred.error_type)
    );

    // Sort by probability
    uniquePredictions.sort((a, b) => b.probability - a.probability);

    const highProbabilityCount = uniquePredictions.filter(p => p.probability >= 60).length;

    // Generate risk assessment
    let riskAssessment = "Low risk - No significant error patterns predicted";
    if (highProbabilityCount > 3) {
      riskAssessment = "HIGH RISK - Multiple high-probability errors predicted";
    } else if (highProbabilityCount > 0) {
      riskAssessment = `Moderate risk - ${highProbabilityCount} potential error(s) predicted`;
    }

    // Prioritize prevention actions
    const preventionPriority = uniquePredictions
      .filter(p => p.probability >= 50)
      .map(p => ({
        source: p.source,
        urgency: p.probability >= 80 ? "immediate" : p.probability >= 60 ? "high" : "moderate",
      }));

    const report: PredictionReport = {
      timestamp: new Date().toISOString(),
      predictions_generated: uniquePredictions.length,
      high_probability_predictions: highProbabilityCount,
      predictions: uniquePredictions.slice(0, 20), // Limit to top 20
      risk_assessment: riskAssessment,
      prevention_priority: preventionPriority,
    };

    // Store high-probability predictions as insights
    for (const pred of uniquePredictions.filter(p => p.probability >= 70)) {
      await supabase.from("proactive_insights").upsert({
        insight_type: "error_prediction",
        priority: pred.probability >= 80 ? "high" : "medium",
        title: `Predicted: ${pred.error_type} error from ${pred.source}`,
        content: `${pred.probability}% probability within ${pred.time_horizon}. ${pred.historical_basis}`,
        action_items: pred.recommended_prevention,
        affected_entities: { source: pred.source, error_type: pred.error_type, probability: pred.probability },
        source_agent: "error_prediction_agent",
        dedup_key: `prediction_${pred.source}_${pred.error_type}`,
        expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "dedup_key", ignoreDuplicates: false }); // Update if exists
    }

    const duration = Date.now() - startTime;
    console.log(`[Error Prediction Agent] Complete in ${duration}ms - ${uniquePredictions.length} predictions (${highProbabilityCount} high probability)`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      report,
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("[Error Prediction Agent] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
