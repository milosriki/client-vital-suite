import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// HEALTH CALCULATOR AGENT
// Recalculates all client health scores
// Daily health score calculation for all clients
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validate required environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL environment variable is required");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================
// SCORING ALGORITHMS
// ============================================

function calculateEngagementScore(client: any): number {
  let score = 50;

  // Recent activity bonus (using sessions or meetings count if available)
  // Fallback to 0 if data missing
  const sessions7d = client.sessions_last_7d || 0;
  if (sessions7d >= 3) score += 30;
  else if (sessions7d >= 2) score += 20;
  else if (sessions7d >= 1) score += 10;

  // Consistency bonus (30 days)
  const sessions30d = client.sessions_last_30d || 0;
  if (sessions30d >= 12) score += 15;
  else if (sessions30d >= 8) score += 10;

  // Recency penalty
  // Calculate days since last activity if we have a date
  let daysSince = 999;
  if (client.last_activity_date) {
    const lastDate = new Date(client.last_activity_date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastDate.getTime());
    daysSince = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  } else if (client.days_since_last_session) {
    daysSince = client.days_since_last_session;
  }

  if (daysSince > 30) score -= 30;
  else if (daysSince > 14) score -= 15;
  else if (daysSince > 7) score -= 5;

  return Math.max(0, Math.min(100, score));
}

function calculatePackageHealthScore(client: any): number {
  const outstanding = client.outstanding_sessions || 0;
  const purchased = client.sessions_purchased || 1; // Prevent division by zero
  const remainingPct = (outstanding / purchased) * 100;

  if (remainingPct >= 50) return 90;
  if (remainingPct >= 30) return 70;
  if (remainingPct >= 10) return 50;
  return 30;
}

function calculateMomentumScore(client: any): number {
  const avgWeekly7d = client.sessions_last_7d || 0;
  const avgWeekly30d = (client.sessions_last_30d || 0) / 4.3;

  // Handle division by zero - check before calculating rate of change
  if (avgWeekly30d === 0) {
    return client.sessions_last_7d > 0 ? 70 : 30;
  }

  const rateOfChange = ((avgWeekly7d - avgWeekly30d) / avgWeekly30d) * 100;

  if (rateOfChange > 20) return 90;  // ACCELERATING
  if (rateOfChange > 0) return 70;   // SLIGHTLY UP
  if (rateOfChange > -20) return 50; // STABLE
  return 30;                          // DECLINING
}

function getMomentumIndicator(client: any): string {
  const avgWeekly7d = client.sessions_last_7d || 0;
  const avgWeekly30d = (client.sessions_last_30d || 0) / 4.3;

  // Handle division by zero - check before calculating rate of change
  if (avgWeekly30d === 0) {
    return client.sessions_last_7d > 0 ? "STABLE" : "DECLINING";
  }

  const rateOfChange = ((avgWeekly7d - avgWeekly30d) / avgWeekly30d) * 100;

  if (rateOfChange > 20) return "ACCELERATING";
  if (rateOfChange > -20) return "STABLE";
  return "DECLINING";
}

function calculateHealthScore(client: any): number {
  const engagement = calculateEngagementScore(client);
  const packageHealth = calculatePackageHealthScore(client);
  const momentum = calculateMomentumScore(client);

  return Math.round(engagement * 0.40 + packageHealth * 0.30 + momentum * 0.30);
}

function getHealthZone(score: number): string {
  if (score >= 85) return "PURPLE";
  if (score >= 70) return "GREEN";
  if (score >= 50) return "YELLOW";
  return "RED";
}

function calculatePredictiveRisk(client: any, healthZone: string, momentum: string): number {
  let risk = 50;

  // Momentum impact
  if (momentum === "DECLINING") risk += 30;
  else if (momentum === "ACCELERATING") risk -= 15;

  // Recent activity
  const sessions7d = client.sessions_last_7d || 0;
  if (sessions7d === 0) risk += 25;
  else if (sessions7d < 1) risk += 15;
  else if (sessions7d >= 2) risk -= 10;

  // Gap impact
  // Calculate days since last activity if we have a date
  let daysSince = 999;
  if (client.last_activity_date) {
    const lastDate = new Date(client.last_activity_date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastDate.getTime());
    daysSince = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  } else if (client.days_since_last_session) {
    daysSince = client.days_since_last_session;
  }

  if (daysSince > 30) risk += 25;
  else if (daysSince > 14) risk += 15;
  else if (daysSince <= 7) risk -= 10;

  // Package depletion
  const outstanding = client.outstanding_sessions || 0;
  const purchased = client.sessions_purchased || 1; // Prevent division by zero
  const remainingPct = (outstanding / purchased) * 100;
  if (remainingPct < 10 && sessions7d < 2) risk += 20;
  else if (remainingPct > 50) risk -= 10;

  // Zone mismatch
  if (healthZone === "GREEN" && momentum === "DECLINING") risk += 10;

  return Math.max(0, Math.min(100, risk));
}

function getInterventionPriority(zone: string, risk: number, momentum: string): string {
  if (zone === "RED" && risk > 75) return "CRITICAL";
  if (zone === "RED" || risk > 60) return "HIGH";
  if (zone === "YELLOW" && momentum === "DECLINING") return "HIGH";
  if (zone === "GREEN" && momentum === "DECLINING") return "MEDIUM";
  if (zone === "YELLOW") return "MEDIUM";
  return "LOW";
}

// ============================================
// MAIN HANDLER
// ============================================

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const debugLogs: any[] = [];

  try {
    const { mode = "full", client_emails = [], offset = 0, limit = 500 } = await req.json().catch(() => ({}));

    console.log(`[Health Calculator] Starting ${mode} execution...`);
    debugLogs.push({location:'health-calculator/index.ts:191',message:'Starting execution',data:{mode, offset, limit},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'});

    // --------------------------------------------
    // ORCHESTRATOR MODE
    // --------------------------------------------
    if (mode === "full" && client_emails.length === 0) {
      console.log("[Health Calculator] Running in ORCHESTRATOR mode");
      
      // 1. Get total count
      const { count, error: countError } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true });

      if (countError) throw countError;

      const totalRecords = count || 0;
      const batchSize = 500;
      const batches = Math.ceil(totalRecords / batchSize);

      console.log(`[Health Calculator] Found ${totalRecords} contacts. Triggering ${batches} batches.`);

      // 2. Trigger worker batches
      const functionUrl = `${SUPABASE_URL}/functions/v1/health-calculator`;
      const authHeader = req.headers.get("Authorization") || `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

      const triggerPromises = [];

      for (let i = 0; i < batches; i++) {
        const batchOffset = i * batchSize;
        
        // Fire and forget (don't await response body, just the dispatch)
        const p = fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader,
          },
          body: JSON.stringify({
            mode: "batch",
            offset: batchOffset,
            limit: batchSize
          })
        }).then(res => {
            console.log(`[Health Calculator] Triggered batch ${i+1}/${batches} (Offset: ${batchOffset}) - Status: ${res.status}`);
            return res.text(); // Consume body to close connection
        }).catch(err => {
            console.error(`[Health Calculator] Failed to trigger batch ${i+1}:`, err);
        });

        triggerPromises.push(p);
      }

      // Wait for all triggers to be sent (fast)
      await Promise.all(triggerPromises);

      return new Response(JSON.stringify({
        success: true,
        message: `Orchestration complete. Triggered ${batches} batches for ${totalRecords} records.`,
        batches,
        totalRecords
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // --------------------------------------------
    // WORKER / BATCH MODE
    // --------------------------------------------
    console.log(`[Health Calculator] Running in WORKER mode (Offset: ${offset}, Limit: ${limit})`);

    // Fetch clients from CONTACTS table with pagination
    let query = supabase
      .from("contacts")
      .select("*")
      .range(offset, offset + limit - 1);

    if (client_emails.length > 0) {
      query = supabase.from("contacts").select("*").in("email", client_emails);
    }

    const { data: contacts, error: fetchError } = await query;

    debugLogs.push({location:'health-calculator/index.ts:202',message:'Contacts fetched',data:{count:contacts?.length, error: fetchError},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'});

    if (fetchError) {
      console.error("Error fetching contacts:", fetchError);
      throw fetchError;
    }

    // Process contacts
    console.log(`[Health Calculator] Processing ${contacts?.length || 0} clients`);

    const results = {
      processed: 0,
      updated: 0,
      errors: 0,
      zones: { RED: 0, YELLOW: 0, GREEN: 0, PURPLE: 0 },
      avgHealthScore: 0,
      criticalInterventions: 0
    };

    const upsertPayloads: any[] = [];
    let totalScore = 0;

    for (const client of contacts || []) {
      try {
        if (!client.email) continue;

        const engagement = calculateEngagementScore(client);
        const packageHealth = calculatePackageHealthScore(client);
        const momentumScore = calculateMomentumScore(client);
        const healthScore = calculateHealthScore(client);
        const healthZone = getHealthZone(healthScore);
        const momentum = getMomentumIndicator(client);
        const predictiveRisk = calculatePredictiveRisk(client, healthZone, momentum);
        const interventionPriority = getInterventionPriority(healthZone, predictiveRisk, momentum);

        upsertPayloads.push({
          email: client.email,
          firstname: client.first_name,
          lastname: client.last_name,
          hubspot_contact_id: client.hubspot_contact_id,
          health_score: healthScore,
          health_zone: healthZone,
          engagement_score: engagement,
          package_health_score: packageHealth,
          momentum_score: momentumScore,
          health_trend: momentum,
          churn_risk_score: predictiveRisk,
          intervention_priority: interventionPriority,
          sessions_last_7d: client.sessions_last_7d || 0,
          sessions_last_30d: client.sessions_last_30d || 0,
          outstanding_sessions: client.outstanding_sessions || 0,
          sessions_purchased: client.sessions_purchased || 0,
          days_since_last_session: client.days_since_last_session || 0,
          assigned_coach: client.assigned_coach,
          calculated_at: new Date().toISOString(),
          calculated_on: new Date().toISOString().split("T")[0],
          calculation_version: "AGENT_BATCH_v1"
        });

        results.processed++;
        results.zones[healthZone as keyof typeof results.zones]++;
        totalScore += healthScore;

        if (interventionPriority === "CRITICAL") {
          results.criticalInterventions++;
        }

      } catch (clientError) {
        console.error(`Error processing client ${client.email}:`, clientError);
        results.errors++;
        continue;
      }
    }

    // Batch upsert for performance
    const upsertBatchSize = 100;
    let batchIndex = 0;
    let batchFailures = 0;
    while (batchIndex * upsertBatchSize < upsertPayloads.length) {
      const start = batchIndex * upsertBatchSize;
      const batch = upsertPayloads.slice(start, start + upsertBatchSize);
      
      const { error: upsertError } = await supabase
        .from("client_health_scores")
        .upsert(batch, { onConflict: "email" });

      if (upsertError) {
        batchFailures += batch.length;
        console.error("Batch upsert error:", upsertError);
      } else {
        results.updated += batch.length;
      }

      batchIndex++;
    }

    console.log(`[Health Calculator] Batch complete. Processed ${results.processed}, Updated ${results.updated}, Failures ${batchFailures}`);

    // Only update daily summary if we are in "full" mode (orchestrator) OR if explicitly requested
    // But since we are in worker mode, we might skip this or do a partial update.
    // For now, workers don't update the daily summary to avoid race conditions.
    // The daily summary should ideally be a separate aggregation step.
    // However, to keep it simple, we will SKIP daily summary update in worker mode
    // and assume a separate "aggregator" job runs, OR we accept that daily summary might be slightly off until all batches finish.
    
    // Let's rely on the database aggregation or a separate call for summary.
    // For now, we return the results.

    const duration = Date.now() - startTime;
    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      results,
      batch: { offset, limit }
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    debugLogs.push({location:'health-calculator/index.ts:317',message:'Global error',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'});
    console.error("[Health Calculator] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      debugLogs
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});