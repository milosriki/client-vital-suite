import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { createRDSClient } from "../_shared/rds-client.ts"; // Shared RDS Logic
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
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
// RDS DATA FETCHING (SOURCE OF TRUTH)
// ============================================

async function fetchRDSData(
  emails: string[],
): Promise<Record<string, RDSSessionData>> {
  if (emails.length === 0) return {};

  const client = await createRDSClient("powerbi");
  try {
    const placeholders = emails.map((_, i) => `$${i + 1}`).join(",");
    const query = `
      SELECT 
        m.email,
        COALESCE(p.remainingsessions, 0) as remaining_sessions,
        COALESCE(p.packsize, 0) as total_purchased,
        (SELECT MAX(s.training_date_utc) 
         FROM enhancesch.vw_schedulers s 
         WHERE s.id_client = m.id_client 
         AND s.status IN ('Completed', 'Attended')
        ) as last_session_date,
        (SELECT COUNT(*) 
         FROM enhancesch.vw_schedulers s 
         WHERE s.id_client = m.id_client 
         AND s.training_date_utc > NOW() - INTERVAL '7 days'
         AND s.status IN ('Completed', 'Attended')
        ) as sessions_last_7d,
        (SELECT COUNT(*) 
         FROM enhancesch.vw_schedulers s 
         WHERE s.id_client = m.id_client 
         AND s.training_date_utc > NOW() - INTERVAL '30 days'
         AND s.status IN ('Completed', 'Attended')
        ) as sessions_last_30d,
        (SELECT COUNT(*) 
         FROM enhancesch.vw_schedulers s 
         WHERE s.id_client = m.id_client 
         AND s.training_date_utc > NOW() - INTERVAL '90 days'
         AND s.status IN ('Completed', 'Attended')
        ) as sessions_last_90d
      FROM enhancesch.vw_client_master m
      LEFT JOIN enhancesch.vw_client_packages p ON m.id_client = p.id_client
      WHERE m.email IN (${placeholders})
    `;

    const result = await client.queryObject(query, emails);
    const map: Record<string, RDSSessionData> = {};
    for (const row of result.rows as any[]) {
      if (row.email) {
        map[row.email.toLowerCase()] = {
          email: row.email,
          remaining_sessions: Number(row.remaining_sessions),
          total_purchased: Number(row.total_purchased),
          last_session_date: row.last_session_date
            ? new Date(row.last_session_date).toISOString()
            : null,
          sessions_last_7d: Number(row.sessions_last_7d),
          sessions_last_30d: Number(row.sessions_last_30d),
          sessions_last_90d: Number(row.sessions_last_90d),
        };
      }
    }
    return map;
  } catch (e) {
    console.error("[Health Calculator] RDS Fetch Error:", e);
    return {};
  } finally {
    await client.end();
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

  // Inactivity Penalty
  if (daysInactive !== null && daysInactive >= 0) {
    if (daysInactive > 21) {
      score -= 45;
      signals.push(`${daysInactive}d inactive (CRITICAL)`);
    } else if (daysInactive > 14) {
      score -= 30;
      signals.push(`${daysInactive}d inactive`);
    } else if (daysInactive > 7) {
      score -= 15;
      signals.push(`${daysInactive}d inactive`);
    }
  } else if (s7d === 0 && s30d === 0) {
    score -= 40;
    signals.push("No recent activity detected");
  }

  // Frequency Drop
  if (s30d > 0) {
    const expectedWeekly = s30d / 4.3;
    if (expectedWeekly > 0) {
      const drop = (expectedWeekly - s7d) / expectedWeekly;
      if (drop >= 0.5) {
        score -= 20;
        signals.push("50%+ frequency drop");
      }
    }
  }

  return { score: clamp(score, 0, 100), weight: 0.3, confidence: 1, signals };
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

  const velocity = w30 > 0 ? ((w7 - w30) / w30) * 100 : 0;
  const accel = w90 > 0 ? ((w30 - w90) / w90) * 100 : 0;
  const jerk = 0; // Simplified for MVP

  let status = "STABLE";
  if (w7 === 0 && w30 > 1) status = "CLIFF_FALL";
  else if (velocity < -20) status = "DECLINING";
  else if (velocity > 20) status = "ACCELERATING";
  else if (velocity > 10 && w90 > w30) status = "RECOVERING";

  return {
    velocity,
    acceleration: accel,
    jerk,
    status,
    description: `${status}: ${w7.toFixed(1)}/wk vs ${w30.toFixed(1)} avg`,
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

  return { score: clamp(score, 0, 100), weight: 0.25, confidence: 1, signals };
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

serve(async (req) => {
  if (req.method === "OPTIONS")
    return apiCorsPreFlight();
  try {
    verifyAuth(req);
    const { client_emails = [] } = await req.json().catch(() => ({}));

    // 1. Fetch Candidates (Supabase)
    const BATCH_SIZE = 100;
    let allContacts: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from("contacts")
        .select("*")
        .eq("lifecycle_stage", "customer");
      
      if (client_emails.length > 0) {
        query = query.in("email", client_emails);
      }

      const { data: contacts, error } = await query
        .range(from, from + BATCH_SIZE - 1);

      if (error) throw error;
      if (!contacts || contacts.length === 0) {
        hasMore = false;
      } else {
        allContacts = [...allContacts, ...contacts];
        from += BATCH_SIZE;
        if (contacts.length < BATCH_SIZE) hasMore = false;
      }
      
      // Safety limit to avoid infinite loops or memory issues
      if (from >= 5000) break;
    }

    // 2. Fetch Truth (RDS)
    const emails = allContacts?.map((c) => c.email).filter(Boolean) || [];
    console.log(`Fetching RDS truth for ${emails.length} clients...`);
    const rdsMap = await fetchRDSData(emails);

    // 3. Process
    const results: any[] = [];
    const upserts: any[] = [];

    for (const c of allContacts || []) {
      if (!c.email) continue;
      const rds = rdsMap[c.email.toLowerCase()];

      // FUSION MAP
      const clientData: ClientData = {
        id: c.hubspot_contact_id || c.id,
        email: c.email,
        firstname: c.first_name,
        lastname: c.last_name,
        last_paid_session_date:
          rds?.last_session_date || c.last_paid_session_date,
        of_sessions_conducted__last_7_days_: rds
          ? String(rds.sessions_last_7d)
          : String(c.sessions_last_7d || 0),
        of_conducted_sessions__last_30_days_: rds
          ? String(rds.sessions_last_30d)
          : String(c.sessions_last_30d || 0),
        of_sessions_conducted__last_90_days_: rds
          ? String(rds.sessions_last_90d)
          : String(c.sessions_last_90d || 0),
        outstanding_sessions: rds
          ? String(rds.remaining_sessions)
          : String(c.outstanding_sessions || 0),
        sessions_purchased: rds
          ? String(rds.total_purchased)
          : String(c.sessions_purchased || 0),
        // Keep other HubSpot fields
        assigned_coach: c.assigned_coach,
        next_session_is_booked: c.next_session_is_booked,
        of_future_booked_sessions: c.future_booked_sessions,
      };

      const res = calculateHealthScoreV3(clientData, !!rds);

      results.push(res);
      upserts.push({
        email: c.email,
        firstname: c.first_name,
        lastname: c.last_name,
        hubspot_contact_id: c.hubspot_contact_id,
        health_score: res.healthScore,
        health_zone: res.healthZone,
        churn_risk_score: res.churnPrediction.probability30d,
        health_trend: res.momentumAnalysis.status,
        calculated_at: new Date().toISOString(),
        calculation_version: "v3.0-SuperIntelligence",
        audit_source: res.dataConfidence.source,
        last_paid_session_date: clientData.last_paid_session_date, // Sync truth back
        sessions_last_7d: Number(
          clientData.of_sessions_conducted__last_7_days_,
        ),
        sessions_last_30d: Number(
          clientData.of_conducted_sessions__last_30_days_,
        ),
      });
    }

    // 4. Write
    if (upserts.length) {
      const { error: wErr } = await supabase
        .from("client_health_scores")
        .upsert(upserts, { onConflict: "email" });
      if (wErr) console.error("Write error:", wErr);
    }

    return apiSuccess({ success: true, processed: results.length, results });
  } catch (e) {
    console.error(e);
    return apiError("INTERNAL_ERROR", JSON.stringify({ error: String(e) }), 500);
  }
});
