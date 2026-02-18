import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Sigmoid ──
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// ── Clamp 0-100 ──
function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

// ── Model weights (calibrated from domain knowledge) ──
// Positive weight = increases churn risk
const WEIGHTS = {
  // Inactivity signals (strongest predictors)
  days_since_last_session: { weight: 0.04, threshold: 14, name: "Inactivity" },
  future_bookings_zero: { weight: 2.5, name: "No future bookings" },
  sessions_7d_zero: { weight: 1.2, name: "No recent sessions (7d)" },
  sessions_30d_low: { weight: 0.8, threshold: 2, name: "Low activity (30d)" },

  // Trend signals
  session_trend_negative: { weight: -1.5, name: "Declining session trend" }, // negative trend = positive risk
  momentum_velocity_neg: { weight: -0.8, name: "Negative momentum" },

  // Package depletion
  remaining_pct_low: { weight: 1.5, threshold: 0.1, name: "Package nearly depleted" },
  days_to_expiry_low: { weight: 0.03, threshold: 30, name: "Package expiring soon" },
  days_to_depletion_low: { weight: 0.02, threshold: 14, name: "Sessions running out" },

  // Cancellation behavior
  cancellation_rate_high: { weight: 3.0, threshold: 0.2, name: "High cancellation rate" },
  no_show_count: { weight: 0.5, name: "No-shows" },

  // Engagement
  days_since_last_call_high: { weight: 0.01, threshold: 30, name: "No recent contact" },
  consistency_bad: { weight: 0.15, name: "Inconsistent schedule" },

  // Protective factors (negative weight = reduces risk)
  burn_rate_good: { weight: -0.5, threshold: 2, name: "Good session frequency" },
  total_completed_high: { weight: -0.01, name: "Strong history" },
  months_loyal: { weight: -0.05, name: "Long-term client" },
};

// ── Bias (baseline log-odds) ──
const BIAS = -1.5; // ~18% base churn rate

interface FeatureSet {
  [key: string]: any;
}

function computeChurnScore(f: FeatureSet): {
  score_7d: number;
  score_30d: number;
  score_90d: number;
  risk_factors: { factor: string; impact: number }[];
} {
  const riskFactors: { factor: string; impact: number }[] = [];

  let logOdds = BIAS;

  // Inactivity
  const inactDays = f.days_since_last_session ?? 0;
  if (inactDays > 14) {
    const impact = (inactDays - 14) * WEIGHTS.days_since_last_session.weight;
    logOdds += impact;
    riskFactors.push({ factor: `${inactDays}d inactive`, impact });
  }

  // No future bookings
  if ((f.future_bookings ?? 0) === 0) {
    logOdds += WEIGHTS.future_bookings_zero.weight;
    riskFactors.push({ factor: WEIGHTS.future_bookings_zero.name, impact: WEIGHTS.future_bookings_zero.weight });
  }

  // No sessions last 7d
  if ((f.sessions_7d ?? 0) === 0) {
    logOdds += WEIGHTS.sessions_7d_zero.weight;
    riskFactors.push({ factor: WEIGHTS.sessions_7d_zero.name, impact: WEIGHTS.sessions_7d_zero.weight });
  }

  // Low sessions 30d
  if ((f.sessions_30d ?? 0) < 2) {
    logOdds += WEIGHTS.sessions_30d_low.weight;
    riskFactors.push({ factor: `Only ${f.sessions_30d ?? 0} sessions in 30d`, impact: WEIGHTS.sessions_30d_low.weight });
  }

  // Session trend
  const trend = f.session_trend ?? 0;
  if (trend < 0) {
    const impact = trend * WEIGHTS.session_trend_negative.weight;
    logOdds += impact;
    riskFactors.push({ factor: "Declining session frequency", impact });
  }

  // Momentum
  const vel = f.momentum_velocity ?? 0;
  if (vel < 0) {
    const impact = vel * WEIGHTS.momentum_velocity_neg.weight;
    logOdds += impact;
    riskFactors.push({ factor: "Losing momentum", impact });
  }

  // Package depletion
  const remPct = f.remaining_pct ?? 1;
  if (remPct < 0.1) {
    logOdds += WEIGHTS.remaining_pct_low.weight;
    riskFactors.push({ factor: `Only ${Math.round(remPct * 100)}% sessions remaining`, impact: WEIGHTS.remaining_pct_low.weight });
  }

  const daysExp = f.days_to_expiry ?? 999;
  if (daysExp < 30) {
    const impact = (30 - daysExp) * WEIGHTS.days_to_expiry_low.weight;
    logOdds += impact;
    riskFactors.push({ factor: `Package expires in ${Math.round(daysExp)}d`, impact });
  }

  const daysDep = f.days_to_depletion ?? 999;
  if (daysDep < 14) {
    const impact = (14 - daysDep) * WEIGHTS.days_to_depletion_low.weight;
    logOdds += impact;
    riskFactors.push({ factor: `Sessions run out in ${Math.round(daysDep)}d`, impact });
  }

  // Cancellation
  const cancelRate = f.cancellation_rate ?? 0;
  if (cancelRate > 0.2) {
    const impact = cancelRate * WEIGHTS.cancellation_rate_high.weight;
    logOdds += impact;
    riskFactors.push({ factor: `${Math.round(cancelRate * 100)}% cancellation rate`, impact });
  }

  // No shows
  const noShows = f.no_show_count ?? 0;
  if (noShows > 0) {
    const impact = noShows * WEIGHTS.no_show_count.weight;
    logOdds += impact;
    riskFactors.push({ factor: `${noShows} no-shows`, impact });
  }

  // No recent contact
  const callDays = f.days_since_last_call ?? 999;
  if (callDays > 30) {
    const impact = Math.min((callDays - 30) * WEIGHTS.days_since_last_call_high.weight, 1.5);
    logOdds += impact;
    riskFactors.push({ factor: `No contact in ${callDays}d`, impact });
  }

  // Consistency
  const consistency = f.consistency_score ?? 0;
  if (consistency > 5) {
    const impact = Math.min(consistency * WEIGHTS.consistency_bad.weight, 2);
    logOdds += impact;
    riskFactors.push({ factor: "Inconsistent schedule", impact });
  }

  // Protective: good burn rate
  const burnRate = f.burn_rate ?? 0;
  if (burnRate >= 2) {
    logOdds += WEIGHTS.burn_rate_good.weight;
    riskFactors.push({ factor: `Training ${burnRate}x/week`, impact: WEIGHTS.burn_rate_good.weight });
  }

  // Protective: session history
  const totalCompleted = f.total_completed_sessions ?? 0;
  if (totalCompleted > 20) {
    const impact = totalCompleted * WEIGHTS.total_completed_high.weight;
    logOdds += impact;
    riskFactors.push({ factor: `${totalCompleted} completed sessions`, impact });
  }

  // Protective: loyalty
  const months = f.months_as_customer ?? 0;
  if (months > 6) {
    const impact = months * WEIGHTS.months_loyal.weight;
    logOdds += impact;
    riskFactors.push({ factor: `${Math.round(months)}mo client`, impact });
  }

  // Sort factors by absolute impact
  riskFactors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  // 30d score is base
  const score_30d = clamp(Math.round(sigmoid(logOdds) * 100));
  // 7d is more conservative (only immediate signals)
  const score_7d = clamp(Math.round(sigmoid(logOdds - 0.5) * 100));
  // 90d extrapolates trends further
  const trendBoost = trend < 0 ? Math.abs(trend) * 2 : 0;
  const score_90d = clamp(Math.round(sigmoid(logOdds + trendBoost) * 100));

  return { score_7d, score_30d, score_90d, risk_factors: riskFactors.slice(0, 10) };
}

function getRecommendedAction(score: number, factors: { factor: string; impact: number }[], f: FeatureSet): {
  action: string;
  urgency: string;
} {
  if (score >= 80) {
    if ((f.days_since_last_session ?? 0) > 21) {
      return { action: "URGENT CALL: Client inactive 3+ weeks. Personal check-in from coach required TODAY.", urgency: "CRITICAL" };
    }
    if ((f.future_bookings ?? 0) === 0) {
      return { action: "Book complimentary session immediately. No future sessions scheduled.", urgency: "CRITICAL" };
    }
    return { action: "Assign to retention specialist. Multiple high-risk signals.", urgency: "CRITICAL" };
  }
  if (score >= 60) {
    if ((f.cancellation_rate ?? 0) > 0.3) {
      return { action: "Review scheduling — high cancellation rate suggests time slot issues. Offer flexibility.", urgency: "HIGH" };
    }
    if ((f.remaining_pct ?? 1) < 0.1) {
      return { action: "Package nearly depleted. Proactive renewal outreach needed this week.", urgency: "HIGH" };
    }
    return { action: "Schedule wellness check-in. Send personalized progress summary.", urgency: "HIGH" };
  }
  if (score >= 40) {
    return { action: "Monitor weekly. Send milestone reminder or progress update.", urgency: "MEDIUM" };
  }
  return { action: "Continue current engagement. Client is healthy.", urgency: "LOW" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load features
    const { data: clientFeatures, error: featErr } = await sb
      .from("ml_client_features")
      .select("*");
    if (featErr) throw featErr;
    if (!clientFeatures?.length) {
      return new Response(JSON.stringify({ success: false, error: "No features found. Run ml-feature-pipeline first." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load packages for revenue info
    const { data: packages } = await sb.from("client_packages_live").select("client_email,package_value,client_id,client_phone");
    const pkgByEmail = new Map<string, any>();
    for (const p of packages ?? []) {
      if (p.client_email) pkgByEmail.set(p.client_email.toLowerCase(), p);
    }

    const predictions: any[] = [];

    for (const cf of clientFeatures) {
      const f = cf.features as FeatureSet;
      const { score_7d, score_30d, score_90d, risk_factors } = computeChurnScore(f);
      const { action, urgency } = getRecommendedAction(score_30d, risk_factors, f);

      const pkg = pkgByEmail.get(cf.client_email);
      const top3 = risk_factors.filter(r => r.impact > 0).slice(0, 3).map(r => r.factor);

      // Predicted churn date based on score
      const daysToChurn = score_30d >= 80 ? 7 : score_30d >= 60 ? 21 : score_30d >= 40 ? 45 : 90;
      const churnDate = new Date(Date.now() + daysToChurn * 86400000);

      predictions.push({
        client_id: pkg?.client_id ?? cf.client_email,
        client_name: cf.client_name,
        churn_score: score_30d,
        churn_factors: {
          days_since_last_session: f.days_since_last_session ?? 0,
          sessions_ratio: f.remaining_pct ?? 0,
          decline_rate: Math.abs(f.session_trend ?? 0),
          future_booked: f.future_bookings ?? 0,
          cancel_rate: f.cancellation_rate ?? 0,
          remaining_sessions: f.remaining_sessions ?? 0,
          coach: cf.coach_name,
          phone: pkg?.client_phone ?? null,
          // ML-specific fields
          ml_score_7d: score_7d,
          ml_score_30d: score_30d,
          ml_score_90d: score_90d,
          ml_confidence: Math.round(Math.abs(score_30d - 50) * 2), // higher when more decisive
          top_risk_factors: top3,
          recommended_action: action,
          action_urgency: urgency,
          feature_importance: risk_factors.slice(0, 5).map(r => ({
            factor: r.factor,
            impact: Math.round(r.impact * 100) / 100,
          })),
        },
        revenue_at_risk: pkg?.package_value ?? f.package_value ?? 0,
        predicted_churn_date: churnDate.toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Upsert predictions
    const { error: upsertErr } = await sb
      .from("client_predictions")
      .upsert(predictions, { onConflict: "client_id" });
    if (upsertErr) throw upsertErr;

    // Also store interventions for critical clients
    const criticals = predictions.filter(p => p.churn_factors.action_urgency === "CRITICAL");
    if (criticals.length > 0) {
      const interventions = criticals.map(p => ({
        client_email: pkgByEmail.get(p.client_id)?.client_email ?? p.client_id,
        client_name: p.client_name,
        intervention_type: "ml_churn_alert",
        urgency: "CRITICAL",
        action_text: p.churn_factors.recommended_action,
        context: {
          churn_score: p.churn_score,
          risk_factors: p.churn_factors.top_risk_factors,
          revenue_at_risk: p.revenue_at_risk,
        },
        status: "pending",
      }));

      await sb.from("ai_interventions").upsert(interventions, {
        onConflict: "client_email",
        ignoreDuplicates: false,
      });
    }

    const dist = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const p of predictions) {
      if (p.churn_score >= 80) dist.critical++;
      else if (p.churn_score >= 60) dist.high++;
      else if (p.churn_score >= 40) dist.medium++;
      else dist.low++;
    }

    return new Response(JSON.stringify({
      success: true,
      predictions_generated: predictions.length,
      distribution: dist,
      critical_clients: criticals.map(c => ({ name: c.client_name, score: c.churn_score, action: c.churn_factors.recommended_action })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
