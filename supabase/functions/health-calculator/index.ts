import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

// ============================================
// HEALTH CALCULATOR AGENT v3.0 (SUPER INTELLIGENCE)
// FUSION EDITION: RDS Truth + Physics + Behavior
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Validate required environment variables
// const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================
// DATA STRUCTURES
// ============================================

interface RDSSessionData {
  email: string;
  remaining_sessions: number;
  total_purchased: number;
  last_session_date: string | null;
  sessions_last_7d: number;
  sessions_last_30d: number;
  sessions_last_90d: number; // Added for V3 Momentum
}

export interface ClientData {
  id: string;
  email: string;
  firstname?: string | null;
  lastname?: string | null;
  // Session Activity
  last_paid_session_date?: string | null;
  of_sessions_conducted__last_7_days_?: string | null;
  of_conducted_sessions__last_30_days_?: string | null;
  of_sessions_conducted__last_90_days_?: string | null;
  days_since_last_session_calc?: string | null;
  // Package Data
  outstanding_sessions?: string | null;
  sessions_purchased?: string | null;
  last_package_cost?: string | null;
  days_until_renewal?: string | null;
  // Booking Data
  next_session_is_booked?: string | null;
  of_future_booked_sessions?: string | null;
  days_until_next_booked_session?: string | null;
  // Coach Data
  assigned_coach?: string | null;
  coach_assignment_timestamp?: string | null;
  // History
  reactivation?: string | null;
  last_subscription_cancelled_?: string | null;
}

interface DimensionScore {
  score: number;
  weight: number;
  confidence: number;
  signals: string[];
}

interface MomentumAnalysis {
  velocity: number;
  acceleration: number;
  jerk: number;
  status: string;
  description: string;
}

interface BehavioralPattern {
  pattern: string;
  confidence: number;
  description: string;
  interventionUrgency: string;
}

interface HealthScoreResult {
  contactId: string;
  email: string;
  name: string;
  healthScore: number;
  healthZone: "RED" | "YELLOW" | "GREEN" | "PURPLE";
  dimensions: {
    engagement: DimensionScore;
    momentum: DimensionScore;
    packageHealth: DimensionScore;
    relationship: DimensionScore;
    commitment: DimensionScore;
  };
  momentumAnalysis: MomentumAnalysis;
  behavioralPattern: BehavioralPattern;
  churnPrediction: {
    probability30d: number;
    riskFactors: string[];
  };
  dataConfidence: {
    overall: number;
    source: "RDS_TRUTH" | "HUBSPOT_FALLBACK";
  };
  recommendedAction: string;
  calculatedAt: string;
}

// ============================================
// SUPABASE DATA FETCHING (SOURCE OF TRUTH)
// Uses training_sessions_live + client_packages_live
// ============================================

async function fetchSupabaseSessionData(
  supabase: any,
  emails: string[],
): Promise<Record<string, RDSSessionData>> {
  if (emails.length === 0) return {};

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const d90 = new Date(now.getTime() - 90 * 86400000).toISOString();

  try {
    // Fetch all completed/attended sessions from last 90 days
    const completedStatuses = ['Completed', 'Attended'];
    let allSessions: any[] = [];
    let from = 0;
    const BATCH = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("training_sessions_live")
        .select("client_email, training_date, status")
        .gte("training_date", d90)
        .lte("training_date", now.toISOString())
        .in("status", completedStatuses)
        .range(from, from + BATCH - 1);
      if (error) { console.error("[Health] Sessions fetch error:", error); break; }
      if (!data || data.length === 0) break;
      allSessions = allSessions.concat(data);
      if (data.length < BATCH) break;
      from += BATCH;
    }

    // Aggregate sessions by email
    const sessionMap: Record<string, { last: string | null; s7: number; s30: number; s90: number }> = {};
    for (const s of allSessions) {
      const email = (s.client_email || "").toLowerCase();
      if (!email) continue;
      if (!sessionMap[email]) sessionMap[email] = { last: null, s7: 0, s30: 0, s90: 0 };
      const entry = sessionMap[email];
      const td = s.training_date;
      entry.s90++;
      if (td >= d30) entry.s30++;
      if (td >= d7) entry.s7++;
      if (!entry.last || td > entry.last) entry.last = td;
    }

    // Fetch package data - all rows (218 rows fits easily)
    const { data: packages, error: pkgErr } = await supabase
      .from("client_packages_live")
      .select("client_email, remaining_sessions, pack_size, last_session_date");
    if (pkgErr) console.error("[Health] Packages fetch error:", pkgErr);

    // Aggregate packages by email (client may have multiple packages)
    const pkgMap: Record<string, { remaining: number; total: number; lastDate: string | null }> = {};
    for (const p of (packages || [])) {
      const email = (p.client_email || "").toLowerCase();
      if (!email) continue;
      if (!pkgMap[email]) pkgMap[email] = { remaining: 0, total: 0, lastDate: null };
      pkgMap[email].remaining += Number(p.remaining_sessions || 0);
      pkgMap[email].total += Number(p.pack_size || 0);
      if (p.last_session_date && (!pkgMap[email].lastDate || p.last_session_date > pkgMap[email].lastDate)) {
        pkgMap[email].lastDate = p.last_session_date;
      }
    }

    // Build result map for requested emails
    const result: Record<string, RDSSessionData> = {};
    const emailSet = new Set(emails.map(e => e.toLowerCase()));

    // Include all emails that have data in either sessions or packages
    const allEmails = new Set([...Object.keys(sessionMap), ...Object.keys(pkgMap)]);
    for (const email of allEmails) {
      if (emailSet.size > 0 && !emailSet.has(email)) continue;
      const sess = sessionMap[email] || { last: null, s7: 0, s30: 0, s90: 0 };
      const pkg = pkgMap[email] || { remaining: 0, total: 0, lastDate: null };
      result[email] = {
        email,
        remaining_sessions: pkg.remaining,
        total_purchased: pkg.total,
        last_session_date: sess.last || pkg.lastDate,
        sessions_last_7d: sess.s7,
        sessions_last_30d: sess.s30,
        sessions_last_90d: sess.s90,
      };
    }

    console.log(`[Health] Supabase data: ${allSessions.length} sessions, ${(packages||[]).length} packages, ${Object.keys(result).length} clients mapped`);
    return result;
  } catch (e) {
    console.error("[Health Calculator] Supabase Session Fetch Error:", e);
    return {};
  }
}

// ============================================
// HELPERS
// ============================================

function safe(value: string | null | undefined, fallback = 0): number {
  if (!value || value === "") return fallback;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
}

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr || dateStr === "") return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isDubaiSummer(): boolean {
  const month = new Date().getMonth(); // 0-indexed
  return month >= 5 && month <= 8; // June-September
}

function isRamadanPeriod(): boolean {
  // Approximate Ramadan 2026: Feb 18 - Mar 19
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  if (month === 1 && day >= 10) return true; // Late Feb
  if (month === 2 && day <= 25) return true; // Through Mar
  return false;
}

function isNewClient(coachTimestamp: string | null | undefined): boolean {
  if (!coachTimestamp) return false;
  const days = daysSince(coachTimestamp);
  return days !== null && days <= 30;
}

// ============================================
// V3.0 LOGIC ENGINES
// ============================================

// 1. ENGAGEMENT ENGINE
function calculateEngagement(client: ClientData): DimensionScore {
  const signals: string[] = [];
  let score = 100;

  const s7d = safe(client.of_sessions_conducted__last_7_days_);
  const s30d = safe(client.of_conducted_sessions__last_30_days_);
  const daysInactive = daysSince(client.last_paid_session_date);

  // v4 Inactivity Penalty (Increased Sensitivity)
  if (daysInactive !== null && daysInactive >= 0) {
    if (daysInactive > 21) {
      score -= 60; // Up from 45
      signals.push(`${daysInactive}d inactive (CRITICAL)`);
    } else if (daysInactive > 14) {
      score -= 40; // Up from 30
      signals.push(`${daysInactive}d inactive`);
    } else if (daysInactive > 7) {
      score -= 20; // Up from 15
      signals.push(`${daysInactive}d inactive`);
    }
  } else if (s7d === 0 && s30d === 0) {
    score -= 50; // Up from 40
    signals.push("No recent activity detected");
  }

  // v4 Frequency Drop (7d vs 30d)
  if (s30d > 0) {
    const expectedWeekly = s30d / 4.3;
    if (expectedWeekly > 0) {
      const drop = (expectedWeekly - s7d) / expectedWeekly;
      if (drop >= 0.5) {
        score -= 30; // Up from 20
        signals.push("50%+ weekly frequency drop");
      }
    }
  }

  return { score: clamp(score, 0, 100), weight: 0.35, confidence: 1, signals }; // Weight up from 0.3
}

// 2. MOMENTUM PHYSICS ENGINE
export function analyzeMomentum(client: ClientData): MomentumAnalysis {
  const s7d = safe(client.of_sessions_conducted__last_7_days_);
  const s30d = safe(client.of_conducted_sessions__last_30_days_);
  const s90d = safe(client.of_sessions_conducted__last_90_days_);

  if (s90d === 0 && s30d === 0) {
    return {
      velocity: 0,
      acceleration: 0,
      jerk: 0,
      status: "NO_DATA",
      description: "Insufficient data",
    };
  }

  const w7 = s7d;
  const w30 = s30d / 4.3;
  const w90 = s90d / 13;

  // v4 Physics: Velocity is 7d vs 90d (long-term anchor)
  const velocity = w90 > 0 ? ((w7 - w90) / w90) * 100 : 0;
  // Acceleration is 30d vs 90d
  const accel = w90 > 0 ? ((w30 - w90) / w90) * 100 : 0;
  const jerk = 0; 

  let status = "STABLE";
  if (w7 === 0 && w90 > 0.5) status = "CLIFF_FALL"; // Fall from long-term baseline
  else if (velocity < -30) status = "DECLINING";
  else if (velocity > 30) status = "ACCELERATING";
  else if (velocity > 10 && w90 > w30) status = "RECOVERING";

  return {
    velocity,
    acceleration: accel,
    jerk,
    status,
    description: `${status}: ${w7.toFixed(1)}/wk vs ${w90.toFixed(1)} baseline`,
  };
}

function calculateMomentumScore(
  client: ClientData,
  momentum: MomentumAnalysis,
): DimensionScore {
  let score = 70;
  const signals = [momentum.description];

  if (momentum.status === "ACCELERATING") score = 95;
  if (momentum.status === "RECOVERING") score = 80;
  if (momentum.status === "DECLINING") score = 35;
  if (momentum.status === "CLIFF_FALL") score = 5;

  if (isDubaiSummer()) {
    score += 5;
    signals.push("Summer adjustment");
  }
  if (isRamadanPeriod()) {
    score += 10;
    signals.push("Ramadan adjustment");
  }

  return { score: clamp(score, 0, 100), weight: 0.3, confidence: 1, signals }; // Weight up from 0.25
}

// 3. PACKAGE HEALTH
function calculatePackageHealth(client: ClientData): DimensionScore {
  let score = 100;
  const signals: string[] = [];
  const outstanding = safe(client.outstanding_sessions);
  const purchased = safe(client.sessions_purchased);

  if (purchased <= 0)
    return { score: 50, weight: 0.2, confidence: 0.5, signals: ["No package"] };

  const used = purchased - outstanding;
  const usageRate = used / purchased;

  if (usageRate < 0.1) {
    score -= 25;
    signals.push("Barely started");
  }
  if (outstanding <= 3) {
    score -= 15;
    signals.push("Low balance");
  }

  return { score: clamp(score, 0, 100), weight: 0.2, confidence: 1, signals };
}

// 4. RELATIONSHIP
function calculateRelationship(client: ClientData): DimensionScore {
  let score = 70;
  const signals: string[] = [];
  if (!client.assigned_coach) {
    score -= 20;
    signals.push("No coach");
  }
  return { score: clamp(score, 0, 100), weight: 0.1, confidence: 0.5, signals };
}

// 5. COMMITMENT
function calculateCommitment(client: ClientData): DimensionScore {
  let score = 50;
  const signals: string[] = [];
  const future = safe(client.of_future_booked_sessions);

  if (future >= 3) {
    score = 85;
    signals.push("Strong bookings");
  } else if (future >= 1) {
    score = 65;
    signals.push("Has bookings");
  } else {
    score = 35;
    signals.push("No future bookings");
  }

  return { score: clamp(score, 0, 100), weight: 0.15, confidence: 1, signals };
}

// 6. PATTERN RECOGNITION
export function detectPattern(
  client: ClientData,
  momentum: MomentumAnalysis,
): BehavioralPattern {
  const s7d = safe(client.of_sessions_conducted__last_7_days_);
  const s30d = safe(client.of_conducted_sessions__last_30_days_);
  const s90d = safe(client.of_sessions_conducted__last_90_days_);

  if (momentum.status === "CLIFF_FALL")
    return {
      pattern: "SUDDEN_STOP",
      confidence: 0.9,
      description: "Abrupt stop",
      interventionUrgency: "IMMEDIATE",
    };
  if (s90d > 6 && s30d < (s90d / 3) * 0.6 && s7d <= 1)
    return {
      pattern: "SILENT_FADE",
      confidence: 0.8,
      description: "Gradual decline",
      interventionUrgency: "HIGH",
    };

  return {
    pattern: "NONE",
    confidence: 0,
    description: "Normal",
    interventionUrgency: "LOW",
  };
}

// ============================================
// MAIN COMPOSITE ENGINE
// ============================================

export function calculateHealthScoreV3(
  client: ClientData,
  rdsSource: boolean,
): HealthScoreResult {
  const engagement = calculateEngagement(client);
  const momentumAnalysis = analyzeMomentum(client);
  const momentum = calculateMomentumScore(client, momentumAnalysis);
  const packageHealth = calculatePackageHealth(client);
  const relationship = calculateRelationship(client);
  const commitment = calculateCommitment(client);
  const pattern = detectPattern(client, momentumAnalysis);

  // Weighted Average
  let totalScore = 0;
  let totalWeight = 0;
  const dims = [engagement, momentum, packageHealth, relationship, commitment];

  for (const d of dims) {
    totalScore += d.score * d.weight;
    totalWeight += d.weight;
  }

  const compositeScore = Math.round(totalScore / totalWeight);

  const zone =
    compositeScore < 50
      ? "RED"
      : compositeScore < 70
        ? "YELLOW"
        : compositeScore < 85
          ? "GREEN"
          : "PURPLE";

  // Churn Prediction (Simplified)
  const churnProb = clamp((100 - compositeScore) * 1.2, 5, 95);

  return {
    contactId: client.id,
    email: client.email,
    name: `${client.firstname} ${client.lastname}`,
    healthScore: compositeScore,
    healthZone: zone as any,
    dimensions: {
      engagement,
      momentum,
      packageHealth,
      relationship,
      commitment,
    },
    momentumAnalysis,
    behavioralPattern: pattern,
    churnPrediction: {
      probability30d: churnProb,
      riskFactors: pattern.pattern !== "NONE" ? [pattern.description] : [],
    },
    dataConfidence: {
      overall: rdsSource ? 1.0 : 0.6,
      source: rdsSource ? "RDS_TRUTH" : "HUBSPOT_FALLBACK",
    },
    recommendedAction: zone === "RED" ? "Urgent Intervention" : "Maintain",
    calculatedAt: new Date().toISOString(),
  };
}

// ============================================
// HANDLER
// ============================================

export async function handleRequest(req: Request) {
  if (req.method === "OPTIONS")
    return apiCorsPreFlight();
  try {
    verifyAuth(req);
    const { client_emails = [] } = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── STRATEGY: Use client_packages_live as PRIMARY source (active clients) ──
    // Then ENRICH with contacts table + training_sessions_live
    // This ensures we score ALL active paying clients, not just HubSpot "customer" tagged ones

    // 1. Fetch ALL active packages (source of truth for who is a paying client)
    const { data: packages, error: pkgErr } = await supabase
      .from("client_packages_live")
      .select("*");
    if (pkgErr) throw pkgErr;
    console.log(`[Health] ${packages?.length || 0} active packages from client_packages_live`);

    // 2. Fetch ALL training sessions for session counts
    const { data: sessions, error: sessErr } = await supabase
      .from("training_sessions_live")
      .select("client_name,client_email,coach_name,training_date,status");
    if (sessErr) throw sessErr;

    // 3. Build session stats per client email (lowercase)
    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 86400000);
    const d30 = new Date(now.getTime() - 30 * 86400000);
    const d90 = new Date(now.getTime() - 90 * 86400000);
    // Count as "done": Completed, Attended, Started, Active
    // Also count "Confirmed" if the session date is in the PAST (it happened, status just wasn't updated)
    // "Cancelled-Rebooked" counts as activity signal (client is engaged enough to reschedule)
    const alwaysCountStatuses = ["Completed", "Attended", "Started", "Active"];
    const pastDateStatuses = ["Confirmed"]; // Count these only if training_date < now
    const cancelledButEngaged = ["Cancelled-Rebooked"]; // Weak signal — count at 50% weight

    const sessionStats: Record<string, { s7: number; s30: number; s90: number; lastDate: string | null; futureConfirmed: number }> = {};
    for (const s of sessions || []) {
      const key = (s.client_email || s.client_name || "").toLowerCase().trim();
      if (!key) continue;
      if (!sessionStats[key]) sessionStats[key] = { s7: 0, s30: 0, s90: 0, lastDate: null, futureConfirmed: 0 };
      const st = sessionStats[key];
      const td = new Date(s.training_date);
      if (isNaN(td.getTime())) continue;

      const isPast = td <= now;
      const isFuture = td > now;
      let weight = 0;

      if (alwaysCountStatuses.includes(s.status)) {
        weight = 1;
      } else if (pastDateStatuses.includes(s.status) && isPast) {
        weight = 1; // Confirmed + past date = it happened
      } else if (pastDateStatuses.includes(s.status) && isFuture) {
        st.futureConfirmed++; // Track for commitment score
        continue;
      } else if (cancelledButEngaged.includes(s.status)) {
        weight = 0.5; // Engagement signal but not a completed session
      } else {
        continue; // Skip pure cancellations
      }

      if (td >= d7) st.s7 += weight;
      if (td >= d30) st.s30 += weight;
      if (td >= d90) st.s90 += weight;
      if (weight >= 1 && (!st.lastDate || td.toISOString() > st.lastDate)) st.lastDate = td.toISOString();
    }

    // 4. Optionally enrich from contacts table (for HubSpot fields: future_booked_sessions, assigned_coach)
    const contactMap: Record<string, any> = {};
    const { data: contacts } = await supabase
      .from("contacts")
      .select("email, hubspot_contact_id, first_name, last_name, assigned_coach, next_session_is_booked, future_booked_sessions")
      .eq("lifecycle_stage", "customer");
    for (const c of contacts || []) {
      if (c.email) contactMap[c.email.toLowerCase()] = c;
    }

    // 5. Process each active package client
    const results: any[] = [];
    const upserts: any[] = [];
    const processedEmails = new Set<string>();

    for (const pkg of packages || []) {
      const email = (pkg.client_email || "").toLowerCase().trim();
      if (!email || processedEmails.has(email)) continue;
      if (client_emails.length > 0 && !client_emails.includes(email)) continue;
      processedEmails.add(email);

      const stats = sessionStats[email] || sessionStats[(pkg.client_name || "").toLowerCase().trim()] || { s7: 0, s30: 0, s90: 0, lastDate: null };
      const contact = contactMap[email] || {};

      const clientData: ClientData = {
        id: contact.hubspot_contact_id || pkg.client_id || email,
        email: email,
        firstname: pkg.client_name?.split(" ")[0] || contact.first_name || null,
        lastname: pkg.client_name?.split(" ").slice(1).join(" ") || contact.last_name || null,
        last_paid_session_date: stats.lastDate || pkg.last_session_date,
        of_sessions_conducted__last_7_days_: String(stats.s7),
        of_conducted_sessions__last_30_days_: String(stats.s30),
        of_sessions_conducted__last_90_days_: String(stats.s90),
        outstanding_sessions: String(pkg.remaining_sessions || 0),
        sessions_purchased: String(pkg.pack_size || 0),
        assigned_coach: pkg.last_coach || contact.assigned_coach,
        next_session_is_booked: pkg.next_session_date ? "true" : (contact.next_session_is_booked || null),
        of_future_booked_sessions: String(Math.max(pkg.future_booked || 0, stats.futureConfirmed || 0, contact.future_booked_sessions || 0)),
      };

      const hasRealData = stats.s7 > 0 || stats.s30 > 0 || stats.s90 > 0;
      const res = calculateHealthScoreV3(clientData, hasRealData);

      results.push(res);
      upserts.push({
        email: email,
        firstname: clientData.firstname,
        lastname: clientData.lastname,
        hubspot_contact_id: contact.hubspot_contact_id || null,
        health_score: res.healthScore,
        health_zone: res.healthZone,
        churn_risk_score: Math.round(res.churnPrediction.probability30d),
        health_trend: (() => {
          // Map momentum status to DB CHECK constraint values (DECLINING, STABLE, IMPROVING)
          const s = res.momentumAnalysis.status;
          if (s === "ACCELERATING" || s === "RECOVERING") return "IMPROVING";
          if (s === "DECLINING" || s === "CLIFF_FALL") return "DECLINING";
          return "STABLE"; // NO_DATA, STABLE
        })(),
        calculated_at: new Date().toISOString(),
        calculation_version: "v5.0-PackageDriven",
        sessions_last_7d: Math.round(stats.s7),
        sessions_last_30d: Math.round(stats.s30),
        assigned_coach: clientData.assigned_coach,
        engagement_score: res.dimensions.engagement.score,
        momentum_score: res.dimensions.momentum.score,
        package_health_score: res.dimensions.packageHealth.score,
        momentum_indicator: (() => {
          // CHECK constraint allows: STABLE, ACCELERATING, DECLINING
          const s = res.momentumAnalysis.status;
          if (s === "ACCELERATING" || s === "RECOVERING") return "ACCELERATING";
          if (s === "DECLINING" || s === "CLIFF_FALL") return "DECLINING";
          return "STABLE";
        })(),
        intervention_priority: res.healthZone === "RED" ? "CRITICAL" : res.healthZone === "YELLOW" ? "HIGH" : "NONE",
        outstanding_sessions: pkg.remaining_sessions || 0,
        sessions_purchased: pkg.pack_size || 0,
      });
    }

    // 6. Write — use service role, upsert by email
    let writeSuccess = 0;
    let writeErrors: string[] = [];
    if (upserts.length) {
      // Try batch first
      const { error: batchErr } = await supabase
        .from("client_health_scores")
        .upsert(upserts, { onConflict: "email" });
      
      if (batchErr) {
        console.error(`[Health] Batch upsert failed:`, JSON.stringify(batchErr));
        writeErrors.push(`Batch: ${batchErr.message}`);
        
        // Fallback: individual writes
        for (const row of upserts) {
          const { error: singleErr } = await supabase
            .from("client_health_scores")
            .upsert(row, { onConflict: "email" });
          if (singleErr) {
            writeErrors.push(`${row.email}: ${singleErr.message}`);
          } else {
            writeSuccess++;
          }
        }
        console.log(`[Health] Individual writes: ${writeSuccess} ok, ${writeErrors.length - 1} failed`);
      } else {
        writeSuccess = upserts.length;
        console.log(`[Health] Batch upsert OK: ${writeSuccess} rows`);
      }
    }

    // Zone summary
    const zones: Record<string, number> = {};
    for (const r of results) {
      zones[r.healthZone] = (zones[r.healthZone] || 0) + 1;
    }
    console.log(`[Health] Processed ${results.length} clients. Zones:`, JSON.stringify(zones));

    return apiSuccess({ 
      success: true, 
      processed: results.length, 
      written: writeSuccess,
      writeErrors: writeErrors.slice(0, 5),
      zones,
      results: results.slice(0, 5) // Limit response size
    });
  } catch (e) {
    console.error(e);
    return apiError("INTERNAL_ERROR", JSON.stringify({ error: String(e) }), 500);
  }
}

// Start server if main entry point
if (import.meta.main) {
  serve(handleRequest);
}
