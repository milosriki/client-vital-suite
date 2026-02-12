/// <reference lib="deno.ns" />
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Batch size for HubSpot API calls (max 100 per batch update)
const BATCH_SIZE = 100;
const MAX_RECORDS_PER_RUN = 1000;

// HubSpot property names for health score fields
const HUBSPOT_PROPERTIES = {
  // Input fields for calculation
  outstanding_sessions: "outstanding_sessions",
  sessions_purchased: "sessions_purchased",
  last_package_cost: "last_package_cost",
  sessions_7d: "of_sessions_conducted__last_7_days_",
  sessions_30d: "of_conducted_sessions__last_30_days_",
  sessions_90d: "of_sessions_conducted__last_90_days_",
  next_session_booked: "next_session_is_booked",
  future_booked_sessions: "of_future_booked_sessions",
  assigned_coach: "assigned_coach",
  last_paid_session_date: "last_paid_session_date",
  // Output fields to update
  health_score: "client_health_score",
  health_zone: "client_health_zone",
};

interface HubSpotContact {
  id: string;
  properties: Record<string, string | null>;
}

interface HealthScoreResult {
  contactId: string;
  email: string;
  healthScore: number;
  healthZone: string;
  factors: {
    inactivityPenalty: number;
    frequencyDropPenalty: number;
    utilizationPenalty: number;
    commitmentBonus: number;
  };
}

/**
 * Calculate days since a given date with fallback support
 */
function getDaysSince(props: any, preferredKey: string): number {
  const fallbacks = [
    "last_session_conducted",
    "hs_lastmodifieddate",
    "createdate",
  ];
  const keys = [preferredKey, ...fallbacks];

  for (const key of keys) {
    const dateValue = props[key];
    if (!dateValue) continue;

    let date: Date;
    if (/^\d+$/.test(dateValue)) {
      date = new Date(Number(dateValue));
    } else {
      date = new Date(dateValue);
    }

    if (!isNaN(date.getTime())) {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }
  }

  return 7; // Default to 'Healthy' 7 days if absolutely no data exists, to avoid false RED zones.
}

/**
 * Calculate health score using the owner-approved formula
 * BASE: 100 points, then subtract penalties and add bonuses
 */
function calculateHealthScore(contact: HubSpotContact): HealthScoreResult {
  const props = contact.properties;
  let score = 100;

  const factors = {
    inactivityPenalty: 0,
    frequencyDropPenalty: 0,
    utilizationPenalty: 0,
    commitmentBonus: 0,
  };

  // 1. INACTIVITY PENALTY (max -40)
  const daysSinceSession = getDaysSince(
    props,
    HUBSPOT_PROPERTIES.last_paid_session_date,
  );
  if (daysSinceSession > 60) {
    // Increased threshold from 30 to 60 for 2026
    factors.inactivityPenalty = 40;
  } else if (daysSinceSession > 30) {
    factors.inactivityPenalty = 30;
  } else if (daysSinceSession > 14) {
    factors.inactivityPenalty = 20;
  } else if (daysSinceSession > 7) {
    factors.inactivityPenalty = 10;
  }
  score -= factors.inactivityPenalty;

  // 2. FREQUENCY DROP PENALTY (max -25)
  const sessions7d =
    parseFloat(props[HUBSPOT_PROPERTIES.sessions_7d] || "0") || 0;
  const sessions30d =
    parseFloat(props[HUBSPOT_PROPERTIES.sessions_30d] || "0") || 0;
  const expectedWeekly = sessions30d / 4;
  if (expectedWeekly > 0) {
    const dropPercent = ((expectedWeekly - sessions7d) / expectedWeekly) * 100;
    if (dropPercent >= 50) {
      factors.frequencyDropPenalty = 25;
    } else if (dropPercent >= 25) {
      factors.frequencyDropPenalty = 15;
    }
  }
  score -= factors.frequencyDropPenalty;

  // 3. PACKAGE UTILIZATION PENALTY (max -15)
  const purchased =
    parseFloat(props[HUBSPOT_PROPERTIES.sessions_purchased] || "0") || 0;
  const remaining =
    parseFloat(props[HUBSPOT_PROPERTIES.outstanding_sessions] || "0") || 0;
  const used = purchased - remaining;
  const utilization = purchased > 0 ? (used / purchased) * 100 : 0;
  if (utilization < 20) {
    factors.utilizationPenalty = 15;
  } else if (utilization < 50) {
    factors.utilizationPenalty = 5;
  }
  score -= factors.utilizationPenalty;

  // 4. COMMITMENT BONUS (max +10)
  const nextSessionBooked = props[HUBSPOT_PROPERTIES.next_session_booked];
  // Handle various boolean representations: 'Y', 'Yes', 'true', '1'
  const isBooked =
    nextSessionBooked === "Y" ||
    nextSessionBooked === "Yes" ||
    nextSessionBooked === "true" ||
    nextSessionBooked === "1";
  if (isBooked) {
    const futureBooked =
      parseFloat(props[HUBSPOT_PROPERTIES.future_booked_sessions] || "0") || 0;
    factors.commitmentBonus = futureBooked > 1 ? 10 : 5;
  }
  score += factors.commitmentBonus;

  // Cap 0-100
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    contactId: contact.id,
    email: props.email || "unknown",
    healthScore: finalScore,
    healthZone: getHealthZone(finalScore),
    factors,
  };
}

/**
 * Determine health zone based on score
 */
function getHealthZone(score: number): string {
  if (score >= 85) return "PURPLE"; // Thriving
  if (score >= 70) return "GREEN"; // Healthy
  if (score >= 50) return "YELLOW"; // At Risk
  return "RED"; // Critical
}

/**
 * Fetch contacts from HubSpot with outstanding_sessions > 0
 */
async function fetchActiveClients(
  apiKey: string,
  afterCursor?: string,
): Promise<{ results: HubSpotContact[]; nextCursor: string | null }> {
  const properties = [
    "email",
    "firstname",
    "lastname",
    HUBSPOT_PROPERTIES.outstanding_sessions,
    HUBSPOT_PROPERTIES.sessions_purchased,
    HUBSPOT_PROPERTIES.last_package_cost,
    HUBSPOT_PROPERTIES.sessions_7d,
    HUBSPOT_PROPERTIES.sessions_30d,
    HUBSPOT_PROPERTIES.sessions_90d,
    HUBSPOT_PROPERTIES.next_session_booked,
    HUBSPOT_PROPERTIES.future_booked_sessions,
    HUBSPOT_PROPERTIES.assigned_coach,
    HUBSPOT_PROPERTIES.last_paid_session_date,
    HUBSPOT_PROPERTIES.health_score,
    HUBSPOT_PROPERTIES.health_zone,
  ];

  const response = await fetch(
    "https://api.hubapi.com/crm/v3/objects/contacts/search",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: HUBSPOT_PROPERTIES.outstanding_sessions,
                operator: "GT",
                value: "0",
              },
            ],
          },
        ],
        properties,
        sorts: [{ propertyName: "email", direction: "ASCENDING" }],
        limit: BATCH_SIZE,
        after: afterCursor || undefined,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `HubSpot search API error: ${response.status} - ${errorText}`,
    );
  }

  const data = await response.json();
  return {
    results: data.results || [],
    nextCursor: data.paging?.next?.after || null,
  };
}

/**
 * Batch update HubSpot contacts with health scores
 */
async function batchUpdateHealthScores(
  apiKey: string,
  results: HealthScoreResult[],
): Promise<{ success: number; failed: number }> {
  if (results.length === 0) return { success: 0, failed: 0 };

  const inputs = results.map((r) => ({
    id: r.contactId,
    properties: {
      [HUBSPOT_PROPERTIES.health_score]: r.healthScore.toString(),
      [HUBSPOT_PROPERTIES.health_zone]: r.healthZone,
    },
  }));

  const response = await fetch(
    "https://api.hubapi.com/crm/v3/objects/contacts/batch/update",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `HubSpot batch update error: ${response.status} - ${errorText}`,
    );
    return { success: 0, failed: results.length };
  }

  const data = await response.json();
  return {
    success: data.results?.length || results.length,
    failed: 0,
  };
}

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  const startTime = Date.now();

  try {
    // Support both env var names for HubSpot API key
    const HUBSPOT_API_KEY =
      Deno.env.get("HUBSPOT_ACCESS_TOKEN") || Deno.env.get("HUBSPOT_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!HUBSPOT_API_KEY) {
      throw new Error("HUBSPOT_ACCESS_TOKEN or HUBSPOT_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json().catch(() => ({}));
    const { cursor = null, dry_run = false, log_to_db = true } = body;

    console.log(
      `[calculate-health-scores] Starting run: cursor=${cursor || "none"}, dry_run=${dry_run}`,
    );

    const summary = {
      processed: 0,
      updated: 0,
      failed: 0,
      zones: { purple: 0, green: 0, yellow: 0, red: 0 },
      next_cursor: null as string | null,
      has_more: false,
      processing_time_ms: 0,
      errors: [] as string[],
    };

    let currentCursor = cursor;
    let processedCount = 0;

    while (processedCount < MAX_RECORDS_PER_RUN) {
      // Fetch batch of active clients
      const { results: contacts, nextCursor } = await fetchActiveClients(
        HUBSPOT_API_KEY,
        currentCursor || undefined,
      );

      if (contacts.length === 0) {
        console.log("[calculate-health-scores] No more contacts to process");
        break;
      }

      console.log(
        `[calculate-health-scores] Processing batch of ${contacts.length} contacts`,
      );

      // Calculate health scores locally (Cloud Run dependency removed — identical math)
      const healthResults: HealthScoreResult[] = [];
      for (const contact of contacts) {
        try {
          const result = calculateHealthScore(contact);
          healthResults.push(result);
          switch (result.healthZone) {
            case "PURPLE":
              summary.zones.purple++;
              break;
            case "GREEN":
              summary.zones.green++;
              break;
            case "YELLOW":
              summary.zones.yellow++;
              break;
            case "RED":
              summary.zones.red++;
              break;
          }
        } catch (innerErr) {
          summary.errors.push(
            `Health score calculation failed for ${contact.id}: ${innerErr}`,
          );
        }
      }

      summary.processed += healthResults.length;

      // Update HubSpot (unless dry run)
      if (!dry_run && healthResults.length > 0) {
        const { success, failed } = await batchUpdateHealthScores(
          HUBSPOT_API_KEY,
          healthResults,
        );
        summary.updated += success;
        summary.failed += failed;
        console.log(
          `[calculate-health-scores] Batch update: ${success} success, ${failed} failed`,
        );
      } else if (dry_run) {
        console.log(
          `[calculate-health-scores] Dry run - would update ${healthResults.length} contacts`,
        );
        // Log sample results in dry run
        healthResults.slice(0, 5).forEach((r) => {
          console.log(
            `  ${r.email}: score=${r.healthScore}, zone=${r.healthZone}`,
          );
        });
      }

      processedCount += contacts.length;
      currentCursor = nextCursor;

      // Check if we should stop
      if (!nextCursor || processedCount >= MAX_RECORDS_PER_RUN) {
        summary.next_cursor = nextCursor;
        summary.has_more = !!nextCursor;
        break;
      }
    }

    summary.processing_time_ms = Date.now() - startTime;

    // Log to sync_logs table for monitoring
    if (log_to_db) {
      await supabase.from("sync_logs").insert({
        platform: "health_scores",
        status: summary.errors.length > 0 ? "partial" : "completed",
        message: `Processed ${summary.processed} clients: Purple=${summary.zones.purple}, Green=${summary.zones.green}, Yellow=${summary.zones.yellow}, Red=${summary.zones.red}`,
        records_processed: summary.processed,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        error_details:
          summary.errors.length > 0 ? { errors: summary.errors } : null,
      });
    }

    console.log(
      `[calculate-health-scores] Complete: ${JSON.stringify(summary)}`,
    );

    return apiSuccess(summary);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[calculate-health-scores] Fatal error: ${errorMessage}`);

    return apiError("INTERNAL_ERROR", JSON.stringify({
        error: errorMessage,
        processing_time_ms: Date.now() - startTime,
      }), 500);
  }
});
