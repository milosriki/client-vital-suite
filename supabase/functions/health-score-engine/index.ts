import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/error-handler.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";

/**
 * HEALTH SCORE ENGINE v3.0 — The Evolving Intelligence
 *
 * Computes daily health scores for ALL active package holders using pure AWS data.
 * Stores history, detects patterns, tracks trends. Gets smarter every day.
 *
 * Architecture:
 *   1. Pull active packages from client_packages_live (AWS source)
 *   2. Pull 60-day sessions from training_sessions_live (AWS source)
 *   3. Compute 5-dimensional RFM+ score per client
 *   4. Compare with yesterday's score → detect trends
 *   5. Detect patterns (churn spiral, recovery, stall, ghost)
 *   6. Store daily snapshot → client_health_daily
 *   7. Store detected patterns → client_health_patterns
 *
 * Score = 100 points across 5 dimensions:
 *   Recency (30): Days since last completed training
 *   Frequency (25): Sessions/week vs expected pace
 *   Consistency (20): Cancel rate + who cancels
 *   Package Health (15): Remaining sessions
 *   Momentum (10): Week-over-week trend
 *
 * Tiers: HEALTHY(80+), ATTENTION(60-79), AT_RISK(40-59), CRITICAL(20-39), FROZEN(0-19)
 *
 * Auth: Bearer JWT or X-Cron-Secret for automated runs
 * Trigger: Daily cron at 6am Dubai (2am UTC) or manual
 */

const EXCLUDE_COACHES = ["igor", "ksenia", "faissal"];
const BATCH_SIZE = 50;

interface ClientScore {
  client_name: string;
  coach_name: string;
  total_score: number;
  tier: string;
  recency_score: number;
  frequency_score: number;
  consistency_score: number;
  package_score: number;
  momentum_score: number;
  days_since_training: number;
  sessions_30d: number;
  cancels_30d: number;
  remaining_sessions: number;
  package_value: number;
  cancel_rate: number;
  score_delta: number;
  trend: string;
  alert: string | null;
}

function getTier(score: number): string {
  if (score >= 80) return "HEALTHY";
  if (score >= 60) return "ATTENTION";
  if (score >= 40) return "AT_RISK";
  if (score >= 20) return "CRITICAL";
  return "FROZEN";
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Security: Verify authentication
  verifyAuth(req);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
  );

  try {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000).toISOString().split("T")[0];
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 86400000).toISOString().split("T")[0];
    const fourteenDaysAgo = new Date(today.getTime() - 14 * 86400000).toISOString().split("T")[0];
    const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000).toISOString().split("T")[0];

    // 1. Fetch active packages
    const { data: packages, error: pkgErr } = await supabase
      .from("client_packages_live")
      .select("client_name, last_coach, remaining_sessions, pack_size, package_value, last_session_date, sessions_per_week");

    if (pkgErr) throw new Error(`Packages fetch failed: ${pkgErr.message}`);
    if (!packages?.length) throw new Error("No active packages found");

    // 2. Fetch 60-day sessions
    const { data: sessions, error: sessErr } = await supabase
      .from("training_sessions_live")
      .select("client_name, coach_name, status, training_date")
      .gte("training_date", sixtyDaysAgo)
      .order("training_date", { ascending: false });

    if (sessErr) throw new Error(`Sessions fetch failed: ${sessErr.message}`);

    // 3. Fetch yesterday's scores for trend detection
    const yesterday = new Date(today.getTime() - 86400000).toISOString().split("T")[0];
    const { data: prevScores } = await supabase
      .from("client_health_daily")
      .select("client_name, total_score, tier, trend")
      .eq("score_date", yesterday);

    const prevMap = new Map<string, { score: number; tier: string; trend: string }>();
    (prevScores || []).forEach((p: any) => {
      prevMap.set(p.client_name, { score: p.total_score, tier: p.tier, trend: p.trend });
    });

    // 3b. Fetch avg review ratings per client (from client_reviews table)
    const reviewMap = new Map<string, number>();
    try {
      const { data: reviews } = await supabase
        .from("client_reviews")
        .select("client_name, rating")
        .not("rating", "is", null);
      if (reviews?.length) {
        const sums = new Map<string, { total: number; count: number }>();
        for (const r of reviews) {
          if (!r.client_name || !r.rating) continue;
          const s = sums.get(r.client_name) || { total: 0, count: 0 };
          s.total += r.rating;
          s.count++;
          sums.set(r.client_name, s);
        }
        for (const [name, s] of sums) {
          reviewMap.set(name, s.total / s.count);
        }
      }
    } catch {
      // client_reviews table may not exist yet — graceful fallback
    }

    // 4. Build per-client session stats
    const clientStats = new Map<string, {
      completed_30d: number; cancelled_30d: number;
      completed_14d: number; completed_7d: number;
      client_cancels: number; coach_cancels: number; rebooked: number;
      last_completed: Date | null; total_30d: number;
    }>();

    for (const s of (sessions || [])) {
      const coach = s.coach_name || "";
      if (EXCLUDE_COACHES.some((x) => coach.toLowerCase().includes(x))) continue;

      const td = s.training_date ? new Date(s.training_date) : null;
      if (!td) continue;

      const cn = s.client_name;
      if (!clientStats.has(cn)) {
        clientStats.set(cn, {
          completed_30d: 0, cancelled_30d: 0,
          completed_14d: 0, completed_7d: 0,
          client_cancels: 0, coach_cancels: 0, rebooked: 0,
          last_completed: null, total_30d: 0,
        });
      }
      const cs = clientStats.get(cn)!;
      const status = s.status || "";
      const tdStr = td.toISOString().split("T")[0];

      if (tdStr >= thirtyDaysAgo) {
        cs.total_30d++;
        if (status === "Completed") {
          cs.completed_30d++;
          if (!cs.last_completed || td > cs.last_completed) cs.last_completed = td;
        } else if (status.includes("Cancelled")) {
          if (status.includes("Rebooked")) {
            cs.rebooked++;
          } else {
            cs.cancelled_30d++;
            if (status.includes("Client")) cs.client_cancels++;
            else if (status.includes("Trainer")) cs.coach_cancels++;
          }
        }
      }

      if (tdStr >= fourteenDaysAgo && status === "Completed") cs.completed_14d++;
      if (tdStr >= sevenDaysAgo && status === "Completed") cs.completed_7d++;

      if (status === "Completed") {
        if (!cs.last_completed || td > cs.last_completed) cs.last_completed = td;
      }
    }

    // 5. Compute scores
    const scores: ClientScore[] = [];

    for (const pkg of packages) {
      const cn = pkg.client_name;
      const coach = pkg.last_coach || "Unassigned";
      if (EXCLUDE_COACHES.some((x) => coach.toLowerCase().includes(x))) continue;

      const remaining = pkg.remaining_sessions || 0;
      const value = pkg.package_value || 0;
      const spw = pkg.sessions_per_week || 0;
      const cs = clientStats.get(cn) || {
        completed_30d: 0, cancelled_30d: 0, completed_14d: 0, completed_7d: 0,
        client_cancels: 0, coach_cancels: 0, rebooked: 0, last_completed: null, total_30d: 0,
      };

      // Last completed: from sessions or package
      let lastCompleted = cs.last_completed;
      if (!lastCompleted && pkg.last_session_date) {
        lastCompleted = new Date(pkg.last_session_date);
      }

      // --- RECENCY (0-30) ---
      const daysSince = lastCompleted ? daysBetween(today, lastCompleted) : 999;
      let recency = 0;
      if (daysSince <= 3) recency = 30;
      else if (daysSince <= 7) recency = 25;
      else if (daysSince <= 14) recency = 15;
      else if (daysSince <= 21) recency = 8;
      else if (daysSince <= 30) recency = 3;

      // --- FREQUENCY (0-25) ---
      const expected = Math.max(spw * 4.3, 4);
      const ratio = expected > 0 ? cs.completed_30d / expected : 0;
      let frequency = 0;
      if (ratio >= 0.8) frequency = 25;
      else if (ratio >= 0.6) frequency = 18;
      else if (ratio >= 0.4) frequency = 12;
      else if (ratio >= 0.2) frequency = 6;

      // --- CONSISTENCY (0-20) ---
      const totalBookings = cs.completed_30d + cs.cancelled_30d;
      const cancelRate = totalBookings > 0 ? cs.cancelled_30d / totalBookings : 0;
      let consistency = 0;
      if (cancelRate < 0.10) consistency = 20;
      else if (cancelRate < 0.20) consistency = 15;
      else if (cancelRate < 0.30) consistency = 10;
      else if (cancelRate < 0.50) consistency = 5;

      // Adjust for who cancels
      if (cs.client_cancels > cs.completed_30d && cs.completed_30d > 0) {
        consistency = Math.max(0, consistency - 3);
      }
      if (cs.coach_cancels > cs.client_cancels && cs.coach_cancels >= 3) {
        consistency = Math.min(20, consistency + 3);
      }

      // --- PACKAGE HEALTH (0-15) ---
      let pkgHealth = 0;
      if (remaining >= 20) pkgHealth = 15;
      else if (remaining >= 9) pkgHealth = 12;
      else if (remaining >= 4) pkgHealth = 8;
      else if (remaining >= 1) pkgHealth = 3;

      // --- MOMENTUM (0-10) ---
      const prev7 = cs.completed_14d - cs.completed_7d;
      const curr7 = cs.completed_7d;
      let momentum = 0;
      if (curr7 > prev7 && curr7 > 0) momentum = 10;
      else if (curr7 === prev7 && curr7 > 0) momentum = 7;
      else if (curr7 > 0) momentum = 4;
      else if (prev7 > 0) momentum = 2;

      // --- TOTAL (v3: base 100pts, satisfaction bonus up to +10) ---
      const base = recency + frequency + consistency + pkgHealth + momentum;
      // Satisfaction signal: look up avg review rating from client_health_daily cache
      // (populated by future client_reviews sync — graceful fallback = 0)
      const avgRating = reviewMap.get(cn);
      const satisfactionBonus = avgRating && avgRating >= 4.0 ? Math.round((avgRating - 3) * 5) : 0;
      const total = Math.min(100, base + satisfactionBonus);
      const tier = getTier(total);

      // --- TREND DETECTION ---
      const prev = prevMap.get(cn);
      const delta = prev ? total - prev.score : 0;
      let trend = "stable";
      if (delta >= 10) trend = "recovering";
      else if (delta >= 3) trend = "improving";
      else if (delta <= -10) trend = "crashing";
      else if (delta <= -3) trend = "declining";

      // --- ALERT DETECTION ---
      let alert: string | null = null;
      if (tier === "FROZEN" && (!prev || prev.tier !== "FROZEN")) {
        alert = "NEW_FREEZE: Client just entered FROZEN tier";
      } else if (trend === "crashing") {
        alert = `CRASH: Score dropped ${Math.abs(delta)} points in 1 day`;
      } else if (daysSince >= 14 && remaining <= 3) {
        alert = "URGENT_RENEWAL: Low sessions + inactive";
      } else if (daysSince >= 30 && value >= 10000) {
        alert = `HIGH_VALUE_GHOST: AED ${value.toLocaleString()} package dormant ${daysSince}d`;
      } else if (cs.coach_cancels >= 3 && cs.completed_30d <= 2) {
        alert = "COACH_ABANDONMENT: Coach cancelling, client not training";
      }

      scores.push({
        client_name: cn,
        coach_name: coach,
        total_score: total,
        tier,
        recency_score: recency,
        frequency_score: frequency,
        consistency_score: consistency,
        package_score: pkgHealth,
        momentum_score: momentum,
        days_since_training: daysSince,
        sessions_30d: cs.completed_30d,
        cancels_30d: cs.cancelled_30d,
        remaining_sessions: remaining,
        package_value: value,
        cancel_rate: Math.round(cancelRate * 100),
        score_delta: delta,
        trend,
        alert,
      });
    }

    // 6. Upsert daily scores in batches
    let upserted = 0;
    for (let i = 0; i < scores.length; i += BATCH_SIZE) {
      const batch = scores.slice(i, i + BATCH_SIZE).map((s) => ({
        client_name: s.client_name,
        coach_name: s.coach_name,
        score_date: todayStr,
        total_score: s.total_score,
        tier: s.tier,
        recency_score: s.recency_score,
        frequency_score: s.frequency_score,
        consistency_score: s.consistency_score,
        package_score: s.package_score,
        momentum_score: s.momentum_score,
        days_since_training: s.days_since_training,
        sessions_30d: s.sessions_30d,
        cancels_30d: s.cancels_30d,
        remaining_sessions: s.remaining_sessions,
        package_value: s.package_value,
        cancel_rate: s.cancel_rate,
        score_delta: s.score_delta,
        trend: s.trend,
        alert: s.alert,
      }));

      const { error: upsertErr } = await supabase
        .from("client_health_daily")
        .upsert(batch, { onConflict: "client_name,score_date" });

      if (upsertErr) {
        console.error(`Upsert batch ${i} failed:`, upsertErr.message);
      } else {
        upserted += batch.length;
      }
    }

    // 7. Detect and store patterns
    const patterns: any[] = [];
    for (const s of scores) {
      // Churn spiral: declining 3+ days
      const prev = prevMap.get(s.client_name);
      if (prev?.trend === "declining" && s.trend === "declining") {
        patterns.push({
          client_name: s.client_name,
          pattern_type: "churn_spiral",
          severity: "critical",
          description: `Score declining for 2+ consecutive days. Now ${s.total_score} (${s.tier}).`,
          score_at_detection: s.total_score,
          metadata: { delta: s.score_delta, days_since: s.days_since_training, coach: s.coach_name },
        });
      }

      // Recovery detection
      if (prev && prev.tier === "CRITICAL" && (s.tier === "AT_RISK" || s.tier === "ATTENTION")) {
        patterns.push({
          client_name: s.client_name,
          pattern_type: "recovery",
          severity: "info",
          description: `Client recovering from ${prev.tier} to ${s.tier}. Score: ${s.total_score}.`,
          score_at_detection: s.total_score,
          metadata: { from_tier: prev.tier, to_tier: s.tier, coach: s.coach_name },
        });
      }

      // High-value frozen
      if (s.tier === "FROZEN" && s.package_value >= 10000) {
        patterns.push({
          client_name: s.client_name,
          pattern_type: "high_value_frozen",
          severity: "critical",
          description: `AED ${s.package_value.toLocaleString()} package FROZEN. ${s.remaining_sessions} sessions left. ${s.days_since_training}d since training.`,
          score_at_detection: s.total_score,
          metadata: { value: s.package_value, remaining: s.remaining_sessions, days: s.days_since_training },
        });
      }

      // Coach abandonment
      if (s.alert?.startsWith("COACH_ABANDONMENT")) {
        patterns.push({
          client_name: s.client_name,
          pattern_type: "coach_abandonment",
          severity: "warning",
          description: `Coach ${s.coach_name} cancelled 3+ times. Client only completed ${s.sessions_30d} sessions.`,
          score_at_detection: s.total_score,
          metadata: { coach: s.coach_name, coach_cancels: s.cancels_30d, completed: s.sessions_30d },
        });
      }
    }

    // Store patterns
    if (patterns.length > 0) {
      const { error: patErr } = await supabase.from("client_health_patterns").insert(patterns);
      if (patErr) console.error("Pattern insert failed:", patErr.message);
    }

    // 8. Build summary
    const dist: Record<string, number> = {};
    const alertCount = scores.filter((s) => s.alert).length;
    for (const s of scores) dist[s.tier] = (dist[s.tier] || 0) + 1;

    const totalValue = scores.reduce((a, b) => a + b.package_value, 0);
    const atRiskValue = scores.filter((s) => s.total_score < 40).reduce((a, b) => a + b.package_value, 0);
    const avgScore = scores.reduce((a, b) => a + b.total_score, 0) / scores.length;

    // Check data freshness
    const { data: syncCheck } = await supabase
      .from("training_sessions_live")
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastSync = syncCheck?.synced_at || "unknown";
    const syncAge = syncCheck?.synced_at
      ? daysBetween(today, new Date(syncCheck.synced_at))
      : -1;
    const dataFresh = syncAge <= 1;

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        engine: "health-score-engine-v2.0",
        computed_at: today.toISOString(),
        score_date: todayStr,
        duration_ms: duration,
        data_freshness: {
          last_sync: lastSync,
          sync_age_days: syncAge,
          is_fresh: dataFresh,
          warning: dataFresh ? null : `Data is ${syncAge} days stale. Trigger AWS sync.`,
        },
        clients_scored: scores.length,
        upserted,
        patterns_detected: patterns.length,
        alerts: alertCount,
        distribution: dist,
        summary: {
          avg_score: Math.round(avgScore * 10) / 10,
          median_score: scores.sort((a, b) => a.total_score - b.total_score)[Math.floor(scores.length / 2)]?.total_score,
          total_portfolio: totalValue,
          at_risk_value: atRiskValue,
          at_risk_pct: Math.round((atRiskValue / totalValue) * 1000) / 10,
        },
        top_alerts: scores
          .filter((s) => s.alert)
          .sort((a, b) => a.total_score - b.total_score)
          .slice(0, 10)
          .map((s) => ({
            client: s.client_name,
            coach: s.coach_name,
            score: s.total_score,
            tier: s.tier,
            alert: s.alert,
          })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[health-score-engine] Error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
        duration_ms: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
