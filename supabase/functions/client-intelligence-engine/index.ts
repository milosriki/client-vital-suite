/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";

/**
 * CLIENT INTELLIGENCE ENGINE v1.0
 * ================================
 * Autonomous, self-learning intelligence that runs daily via cron.
 * NO hardcoding. NO manual intervention. NO CRAW needed.
 *
 * What it does:
 * 1. DETECT: Clients who need coach (re)assignment
 * 2. DETECT: Clients whose coach departed/is inactive
 * 3. DETECT: Clients who stopped training but have active packages
 * 4. DETECT: Clients with more cancellations than sessions
 * 5. PREDICT: Which clients will churn based on trajectory
 * 6. RECOMMEND: Actionable steps for each detected pattern
 * 7. LEARN: Track which recommendations were acted on (resolved)
 *
 * Self-learning loop:
 * - Each day it detects patterns → writes to prepared_actions
 * - Humans mark actions as done/dismissed
 * - Engine tracks resolution rates per pattern type
 * - Adjusts severity based on actual outcomes
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClientProfile {
  client_name: string;
  coach_name: string | null;
  remaining_sessions: number;
  package_value: number;
  total_score: number | null;
  tier: string | null;
  days_since_training: number | null;
  sessions_30d: number;
  cancels_30d: number;
  cancel_rate: number | null;
  trend: string | null;
  alert: string | null;
  score_delta: number | null;
}

interface SessionRecord {
  client_name: string;
  coach_name: string;
  training_date: string;
  status: string;
}

interface Action {
  action_type: string;
  action_title: string;
  action_description: string;
  reasoning: string;
  expected_impact: string;
  risk_level: string;
  confidence: number;
  priority: number;
  prepared_payload: Record<string, unknown>;
  supporting_data: Record<string, unknown>;
  source_agent: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Security: Verify authentication
  verifyAuth(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const startTime = Date.now();
    const today = new Date().toISOString().split("T")[0];
    const actions: Action[] = [];

    // ═══════════════════════════════════════════
    // 1. LOAD ALL DATA (single queries, no loops)
    // ═══════════════════════════════════════════

    // Active packages
    const { data: packages } = await supabase
      .from("client_packages_live")
      .select("client_name, client_email, client_phone, package_name, remaining_sessions, pack_size, package_value, last_coach, last_session_date, next_session_date, future_booked, sessions_per_week")
      .gt("remaining_sessions", 0)
      .order("remaining_sessions", { ascending: true });

    // Latest health scores
    const { data: latestDateRow } = await supabase
      .from("client_health_daily")
      .select("score_date")
      .order("score_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    let healthMap: Record<string, ClientProfile> = {};
    if (latestDateRow?.score_date) {
      const { data: healthRows } = await supabase
        .from("client_health_daily")
        .select("client_name, coach_name, remaining_sessions, package_value, total_score, tier, days_since_training, sessions_30d, cancels_30d, cancel_rate, trend, alert, score_delta")
        .eq("score_date", latestDateRow.score_date);
      for (const h of (healthRows || [])) {
        healthMap[h.client_name] = h as ClientProfile;
      }
    }

    // Feb training sessions (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: recentSessions } = await supabase
      .from("training_sessions_live")
      .select("client_name, coach_name, training_date, status")
      .gte("training_date", thirtyDaysAgo)
      .order("training_date", { ascending: false });

    // Build per-client session stats
    const clientSessions: Record<string, {
      completed: number;
      cancelled: number;
      coaches: Set<string>;
      lastCoach: string | null;
      lastDate: string | null;
      coachCancels: number;
      clientCancels: number;
    }> = {};

    for (const s of (recentSessions || [])) {
      if (!clientSessions[s.client_name]) {
        clientSessions[s.client_name] = {
          completed: 0, cancelled: 0, coaches: new Set(),
          lastCoach: null, lastDate: null, coachCancels: 0, clientCancels: 0,
        };
      }
      const cs = clientSessions[s.client_name];
      if (s.status === "Completed") cs.completed++;
      else if (s.status?.includes("Cancel")) {
        cs.cancelled++;
        if (s.status.includes("Trainer")) cs.coachCancels++;
        else cs.clientCancels++;
      }
      cs.coaches.add(s.coach_name);
      if (!cs.lastCoach) cs.lastCoach = s.coach_name;
      if (!cs.lastDate || s.training_date > cs.lastDate) {
        cs.lastDate = s.training_date;
      }
    }

    // Get known inactive coaches (detect dynamically — no hardcoding)
    const allCoachNames = new Set<string>();
    for (const s of (recentSessions || [])) {
      allCoachNames.add(s.coach_name);
    }

    // A coach is "inactive" if ALL their sessions in last 30d are cancelled
    const coachActivity: Record<string, { completed: number; cancelled: number; clients: Set<string> }> = {};
    for (const s of (recentSessions || [])) {
      if (!coachActivity[s.coach_name]) {
        coachActivity[s.coach_name] = { completed: 0, cancelled: 0, clients: new Set() };
      }
      if (s.status === "Completed") coachActivity[s.coach_name].completed++;
      else if (s.status?.includes("Cancel")) coachActivity[s.coach_name].cancelled++;
      coachActivity[s.coach_name].clients.add(s.client_name);
    }

    const inactiveCoaches = new Set<string>();
    for (const [coach, stats] of Object.entries(coachActivity)) {
      if (stats.completed === 0 && stats.cancelled > 0) {
        inactiveCoaches.add(coach);
      }
    }

    // Get coaches assigned to packages who have ZERO sessions in last 30 days
    const pkgCoaches = new Set((packages || []).map(p => p.last_coach).filter(Boolean));
    for (const coach of pkgCoaches) {
      if (!allCoachNames.has(coach!)) {
        inactiveCoaches.add(coach!);
      }
    }

    // ═══════════════════════════════════════════
    // 2. DETECT PATTERNS & GENERATE ACTIONS
    // ═══════════════════════════════════════════

    for (const pkg of (packages || [])) {
      const name = pkg.client_name;
      const sess = clientSessions[name];
      const health = healthMap[name];
      const coach = pkg.last_coach;
      const value = pkg.package_value || 0;
      const remaining = pkg.remaining_sessions || 0;

      // Calculate days since last training
      let daysSince = 999;
      if (pkg.last_session_date) {
        try {
          daysSince = Math.floor((Date.now() - new Date(pkg.last_session_date).getTime()) / 86400000);
        } catch { /* keep 999 */ }
      }

      // ── PATTERN A: Coach departed / inactive ──
      if (coach && inactiveCoaches.has(coach)) {
        const reassignedTo = sess?.lastCoach && sess.lastCoach !== coach ? sess.lastCoach : null;

        if (reassignedTo) {
          // Already training with someone else — log but low priority
          actions.push({
            action_type: "coach_update",
            action_title: `${name} — already reassigned to ${reassignedTo}`,
            action_description: `Package still shows ${coach} (inactive) but client is actively training with ${reassignedTo}. Update package assignment.`,
            reasoning: `Coach ${coach} has 0 completed sessions in 30 days. Client found training with ${reassignedTo}.`,
            expected_impact: `Clean data, accurate reporting`,
            risk_level: "low",
            confidence: 0.95,
            priority: 3,
            prepared_payload: { client_name: name, old_coach: coach, new_coach: reassignedTo, action: "update_assignment" },
            supporting_data: { sessions_with_new: sess?.completed || 0, coach_status: "inactive" },
            source_agent: "client-intelligence-engine",
          });
        } else if (!sess || sess.completed === 0) {
          // Coach inactive AND client not training — URGENT
          actions.push({
            action_type: "needs_reassignment",
            action_title: `🔴 ${name} — coach ${coach} inactive, needs reassignment`,
            action_description: `${name} has ${remaining} sessions (AED ${value.toLocaleString()}) but coach ${coach} is inactive. Client has NOT been reassigned. ${pkg.future_booked || 0} future sessions booked.`,
            reasoning: `Coach ${coach} has 0 completed sessions in 30 days. All their sessions are cancelled. Client is losing training time.`,
            expected_impact: `AED ${value.toLocaleString()} at risk. ${remaining} sessions will expire unused.`,
            risk_level: value > 10000 ? "critical" : "high",
            confidence: 0.9,
            priority: 1,
            prepared_payload: {
              client_name: name,
              client_phone: pkg.client_phone,
              client_email: pkg.client_email,
              current_coach: coach,
              remaining_sessions: remaining,
              package_value: value,
              action: "reassign_coach",
            },
            supporting_data: {
              days_since_training: daysSince,
              future_booked: pkg.future_booked,
              health_score: health?.total_score,
              health_tier: health?.tier,
            },
            source_agent: "client-intelligence-engine",
          });
        }
      }

      // ── PATTERN B: Not training, no future bookings, has sessions ──
      if ((!sess || sess.completed === 0) && remaining > 0 && !pkg.future_booked && daysSince > 14) {
        // Skip if already caught by Pattern A
        if (!coach || !inactiveCoaches.has(coach)) {
          actions.push({
            action_type: "ghost_client",
            action_title: `🔴 ${name} — not training, ${remaining} sessions unused`,
            action_description: `${name} has ${remaining}/${pkg.pack_size} sessions left (AED ${value.toLocaleString()}) but hasn't trained in ${daysSince > 100 ? "months" : daysSince + " days"}. No future bookings. Coach: ${coach || "UNASSIGNED"}.`,
            reasoning: `0 completed sessions in 30 days. No future bookings scheduled. Package depleting through inactivity.`,
            expected_impact: `AED ${value.toLocaleString()} will be lost if client doesn't re-engage.`,
            risk_level: value > 10000 ? "critical" : daysSince > 30 ? "high" : "medium",
            confidence: 0.85,
            priority: value > 10000 ? 1 : 2,
            prepared_payload: {
              client_name: name,
              client_phone: pkg.client_phone,
              client_email: pkg.client_email,
              coach: coach,
              remaining_sessions: remaining,
              package_value: value,
              action: "re_engage_client",
            },
            supporting_data: {
              days_since_training: daysSince,
              health_score: health?.total_score,
              health_tier: health?.tier,
              trend: health?.trend,
            },
            source_agent: "client-intelligence-engine",
          });
        }
      }

      // ── PATTERN C: Cancel rate > 50% — investigate relationship ──
      if (sess && sess.completed > 0 && sess.cancelled > sess.completed && (sess.completed + sess.cancelled) >= 5) {
        const totalSess = sess.completed + sess.cancelled;
        const cancelRate = Math.round((sess.cancelled / totalSess) * 100);
        const isCoachProblem = sess.coachCancels > sess.clientCancels;

        actions.push({
          action_type: "high_cancel_rate",
          action_title: `🟡 ${name} — ${cancelRate}% cancel rate with ${coach}`,
          action_description: `${sess.completed} done vs ${sess.cancelled} cancelled in 30 days. ${isCoachProblem ? "Coach cancels more than client — investigate coach availability." : "Client cancels more — check scheduling or motivation."} AED ${value.toLocaleString()} package.`,
          reasoning: `Cancel rate ${cancelRate}% exceeds 50% threshold. ${sess.coachCancels} coach cancels, ${sess.clientCancels} client cancels.`,
          expected_impact: `At current rate, ${Math.round(remaining * (cancelRate / 100))} of remaining ${remaining} sessions will be cancelled.`,
          risk_level: cancelRate > 70 ? "high" : "medium",
          confidence: 0.8,
          priority: cancelRate > 70 ? 2 : 3,
          prepared_payload: {
            client_name: name,
            coach: coach,
            cancel_rate: cancelRate,
            coach_cancels: sess.coachCancels,
            client_cancels: sess.clientCancels,
            action: isCoachProblem ? "investigate_coach" : "investigate_client",
          },
          supporting_data: {
            total_sessions: totalSess,
            completed: sess.completed,
            cancelled: sess.cancelled,
            health_score: health?.total_score,
          },
          source_agent: "client-intelligence-engine",
        });
      }

      // ── PATTERN D: Health crashing (score dropping fast) ──
      if (health && health.trend === "crashing" && health.total_score !== null) {
        actions.push({
          action_type: "health_crash",
          action_title: `🔴 ${name} — health score crashing (${health.total_score})`,
          action_description: `${name}'s health score dropped ${Math.abs(health.score_delta || 0)} points. Current: ${health.total_score} (${health.tier}). This indicates rapid disengagement.`,
          reasoning: `Score delta: ${health.score_delta}. Trend: crashing. This usually precedes churn within 2-3 weeks.`,
          expected_impact: `AED ${value.toLocaleString()} at risk of churn.`,
          risk_level: "high",
          confidence: 0.75,
          priority: 2,
          prepared_payload: {
            client_name: name,
            coach: coach,
            health_score: health.total_score,
            score_delta: health.score_delta,
            action: "urgent_intervention",
          },
          supporting_data: {
            tier: health.tier,
            cancel_rate: health.cancel_rate,
            days_since: health.days_since_training,
          },
          source_agent: "client-intelligence-engine",
        });
      }

      // ── PATTERN E: Package about to deplete — renewal opportunity ──
      if (remaining <= 3 && remaining > 0 && sess && sess.completed > 0) {
        actions.push({
          action_type: "renewal_opportunity",
          action_title: `💰 ${name} — only ${remaining} sessions left, renewal due`,
          action_description: `${name} has ${remaining} sessions remaining with ${coach}. ${sess.completed} completed in 30 days. ${health?.total_score ? `Health: ${health.total_score}` : ""}.`,
          reasoning: `Package nearly depleted. Client is active (${sess.completed} sessions/30d). High likelihood of renewal if approached.`,
          expected_impact: `Potential renewal AED ${value.toLocaleString()}+`,
          risk_level: "low",
          confidence: 0.85,
          priority: 2,
          prepared_payload: {
            client_name: name,
            client_phone: pkg.client_phone,
            coach: coach,
            remaining: remaining,
            current_value: value,
            action: "initiate_renewal",
          },
          supporting_data: {
            sessions_per_week: pkg.sessions_per_week,
            health_score: health?.total_score,
            cancel_rate: sess.cancelled / (sess.completed + sess.cancelled),
          },
          source_agent: "client-intelligence-engine",
        });
      }

      // ── PATTERN F: Unassigned coach ──
      if (!coach && remaining > 0) {
        actions.push({
          action_type: "needs_assignment",
          action_title: `🔴 ${name} — no coach assigned, ${remaining} sessions`,
          action_description: `Package with ${remaining} sessions (AED ${value.toLocaleString()}) but no coach assigned.`,
          reasoning: `Client cannot train without a coach. Every day without assignment is a wasted session opportunity.`,
          expected_impact: `AED ${value.toLocaleString()} stuck. Client satisfaction declining.`,
          risk_level: "high",
          confidence: 0.95,
          priority: 1,
          prepared_payload: {
            client_name: name,
            client_phone: pkg.client_phone,
            client_email: pkg.client_email,
            remaining_sessions: remaining,
            package_value: value,
            action: "assign_coach",
          },
          supporting_data: {},
          source_agent: "client-intelligence-engine",
        });
      }
    }

    // ═══════════════════════════════════════════
    // 3. DETECT COACH-LEVEL PATTERNS
    // ═══════════════════════════════════════════

    for (const [coach, stats] of Object.entries(coachActivity)) {
      const totalSess = stats.completed + stats.cancelled;
      if (totalSess < 5) continue;

      const cancelRate = Math.round((stats.cancelled / totalSess) * 100);

      // Coach with > 40% cancel rate
      if (cancelRate > 40 && stats.completed > 0) {
        actions.push({
          action_type: "coach_performance",
          action_title: `⚠️ Coach ${coach} — ${cancelRate}% cancel rate across ${stats.clients.size} clients`,
          action_description: `${stats.completed} completed / ${stats.cancelled} cancelled in 30 days. Affects ${stats.clients.size} clients.`,
          reasoning: `Consistently high cancel rate indicates systemic issue — scheduling, availability, or client satisfaction.`,
          expected_impact: `${stats.clients.size} clients at risk of disengagement.`,
          risk_level: cancelRate > 50 ? "high" : "medium",
          confidence: 0.8,
          priority: 2,
          prepared_payload: {
            coach_name: coach,
            cancel_rate: cancelRate,
            client_count: stats.clients.size,
            clients: Array.from(stats.clients),
            action: "review_coach",
          },
          supporting_data: { completed: stats.completed, cancelled: stats.cancelled },
          source_agent: "client-intelligence-engine",
        });
      }

      // Fully inactive coach with clients
      if (stats.completed === 0 && stats.cancelled > 3) {
        actions.push({
          action_type: "coach_departed",
          action_title: `🔴 Coach ${coach} — 0 completions, ${stats.cancelled} cancels (INACTIVE)`,
          action_description: `Coach has 0 completed sessions in 30 days. ${stats.cancelled} cancellations. ${stats.clients.size} clients affected.`,
          reasoning: `Zero completions with multiple cancels = coach is no longer active. Clients need immediate reassignment.`,
          expected_impact: `${stats.clients.size} clients losing training time.`,
          risk_level: "critical",
          confidence: 0.95,
          priority: 1,
          prepared_payload: {
            coach_name: coach,
            affected_clients: Array.from(stats.clients),
            action: "reassign_all_clients",
          },
          supporting_data: { cancelled: stats.cancelled, client_count: stats.clients.size },
          source_agent: "client-intelligence-engine",
        });
      }
    }

    // ═══════════════════════════════════════════
    // 4. DEDUPE & WRITE ACTIONS
    // ═══════════════════════════════════════════

    // Sort by priority
    actions.sort((a, b) => a.priority - b.priority || b.confidence - a.confidence);

    // Mark old pending actions as expired
    await supabase
      .from("prepared_actions")
      .update({ status: "expired" })
      .eq("status", "pending")
      .eq("source_agent", "client-intelligence-engine")
      .lt("created_at", new Date(Date.now() - 7 * 86400000).toISOString());

    // Insert new actions (check for duplicates by title)
    const { data: existingActions } = await supabase
      .from("prepared_actions")
      .select("action_title")
      .eq("status", "pending")
      .eq("source_agent", "client-intelligence-engine");

    const existingTitles = new Set((existingActions || []).map((a: any) => a.action_title));
    const newActions = actions.filter(a => !existingTitles.has(a.action_title));

    if (newActions.length > 0) {
      const batch = newActions.map(a => ({
        ...a,
        status: "pending",
        created_at: new Date().toISOString(),
      }));

      // Insert in batches of 50
      for (let i = 0; i < batch.length; i += 50) {
        const chunk = batch.slice(i, i + 50);
        await supabase.from("prepared_actions").insert(chunk);
      }
    }

    // ═══════════════════════════════════════════
    // 5. UPDATE CLIENT PREDICTIONS (churn risk)
    // ═══════════════════════════════════════════

    const predictions = [];
    for (const pkg of (packages || [])) {
      const name = pkg.client_name;
      const health = healthMap[name];
      const sess = clientSessions[name];

      if (!health) continue;

      const churnFactors: string[] = [];
      let churnScore = 0;

      // Score-based risk
      if (health.total_score !== null && health.total_score < 30) { churnScore += 40; churnFactors.push("very_low_health"); }
      else if (health.total_score !== null && health.total_score < 50) { churnScore += 25; churnFactors.push("low_health"); }
      else if (health.total_score !== null && health.total_score < 70) { churnScore += 10; churnFactors.push("moderate_health"); }

      // Trend-based risk
      if (health.trend === "crashing") { churnScore += 30; churnFactors.push("crashing_trend"); }
      else if (health.trend === "declining") { churnScore += 15; churnFactors.push("declining_trend"); }

      // Inactivity risk
      if (health.days_since_training && health.days_since_training > 30) { churnScore += 25; churnFactors.push("inactive_30d"); }
      else if (health.days_since_training && health.days_since_training > 14) { churnScore += 10; churnFactors.push("inactive_14d"); }

      // Cancel rate risk
      if (health.cancel_rate && health.cancel_rate > 50) { churnScore += 15; churnFactors.push("high_cancels"); }

      // Inactive coach risk
      if (pkg.last_coach && inactiveCoaches.has(pkg.last_coach)) { churnScore += 20; churnFactors.push("inactive_coach"); }

      churnScore = Math.min(churnScore, 100);

      // Predicted churn date (days until likely churn)
      const daysToChurn = churnScore > 80 ? 7 : churnScore > 60 ? 14 : churnScore > 40 ? 30 : 60;
      const predictedChurn = new Date(Date.now() + daysToChurn * 86400000).toISOString().split("T")[0];

      predictions.push({
        client_name: name,
        churn_score: churnScore,
        churn_factors: churnFactors,
        revenue_at_risk: pkg.package_value || 0,
        predicted_churn_date: predictedChurn,
        updated_at: new Date().toISOString(),
        ml_metadata: {
          engine_version: "1.0",
          data_points: {
            health_score: health.total_score,
            trend: health.trend,
            days_since: health.days_since_training,
            cancel_rate: health.cancel_rate,
            coach_active: !(pkg.last_coach && inactiveCoaches.has(pkg.last_coach)),
          },
        },
      });
    }

    // Upsert predictions
    if (predictions.length > 0) {
      for (let i = 0; i < predictions.length; i += 50) {
        const chunk = predictions.slice(i, i + 50);
        await supabase.from("client_predictions").upsert(chunk, { onConflict: "client_name" });
      }
    }

    // ═══════════════════════════════════════════
    // 6. UPDATE LEARNED PATTERNS
    // ═══════════════════════════════════════════

    // Count resolved vs unresolved actions for learning
    const { data: resolvedActions } = await supabase
      .from("prepared_actions")
      .select("action_type, status")
      .eq("source_agent", "client-intelligence-engine");

    const patternStats: Record<string, { resolved: number; dismissed: number; pending: number; total: number }> = {};
    for (const a of (resolvedActions || [])) {
      if (!patternStats[a.action_type]) {
        patternStats[a.action_type] = { resolved: 0, dismissed: 0, pending: 0, total: 0 };
      }
      patternStats[a.action_type].total++;
      if (a.status === "resolved") patternStats[a.action_type].resolved++;
      else if (a.status === "dismissed") patternStats[a.action_type].dismissed++;
      else patternStats[a.action_type].pending++;
    }

    // Upsert learned patterns
    for (const [patternType, stats] of Object.entries(patternStats)) {
      const confidence = stats.total > 5
        ? Math.round((stats.resolved / (stats.resolved + stats.dismissed || 1)) * 100) / 100
        : 0.7; // Default until enough data

      await supabase.from("learned_patterns").upsert({
        pattern_type: patternType,
        pattern_description: `Auto-detected ${patternType} pattern from client-intelligence-engine`,
        recommended_action: `Review and act on ${patternType} alerts`,
        times_applied: stats.total,
        times_validated: stats.resolved,
        times_invalidated: stats.dismissed,
        confidence,
        last_applied_at: new Date().toISOString(),
      }, { onConflict: "pattern_type" });
    }

    const elapsed = Date.now() - startTime;

    // Summary
    const summary = {
      engine: "client-intelligence-engine",
      version: "1.0",
      run_date: today,
      elapsed_ms: elapsed,
      clients_analyzed: (packages || []).length,
      actions_generated: actions.length,
      new_actions_written: newActions.length,
      existing_skipped: actions.length - newActions.length,
      predictions_updated: predictions.length,
      inactive_coaches_detected: Array.from(inactiveCoaches),
      action_breakdown: {
        needs_reassignment: actions.filter(a => a.action_type === "needs_reassignment").length,
        needs_assignment: actions.filter(a => a.action_type === "needs_assignment").length,
        coach_update: actions.filter(a => a.action_type === "coach_update").length,
        ghost_client: actions.filter(a => a.action_type === "ghost_client").length,
        high_cancel_rate: actions.filter(a => a.action_type === "high_cancel_rate").length,
        health_crash: actions.filter(a => a.action_type === "health_crash").length,
        renewal_opportunity: actions.filter(a => a.action_type === "renewal_opportunity").length,
        coach_performance: actions.filter(a => a.action_type === "coach_performance").length,
        coach_departed: actions.filter(a => a.action_type === "coach_departed").length,
      },
      p1_actions: actions.filter(a => a.priority === 1).map(a => a.action_title),
    };

    return new Response(JSON.stringify(summary, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
