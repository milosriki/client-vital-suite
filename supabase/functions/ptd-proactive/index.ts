import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// PTD PROACTIVE MONITOR AGENT
// Advanced anomaly detection and alerting
// Watches for issues across all systems
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================
// TYPE DEFINITIONS
// ============================================

interface Anomaly {
  type: 'health_drop' | 'deal_stall' | 'sync_fail' | 'response_delay';
  severity: 'critical' | 'high' | 'medium' | 'low';
  entity: string;
  details: any;
  recommended_action: string;
  urgency_score: number;
  detected_at: string;
}

interface TrendData {
  current: number;
  previous: number;
  week_avg: number;
  change_percent: number;
  is_negative: boolean;
}

interface AlertGroup {
  group_id: string;
  primary_anomaly: Anomaly;
  related_anomalies: Anomaly[];
  combined_severity: 'critical' | 'high' | 'medium' | 'low';
  combined_urgency: number;
  affected_count: number;
}

// ============================================
// CONFIGURATION & THRESHOLDS
// ============================================

const THRESHOLDS = {
  // Health score thresholds
  HEALTH_DROP_CRITICAL: 25,      // Alert if score drops 25+ points
  HEALTH_DROP_HIGH: 15,           // Alert if score drops 15+ points
  HEALTH_DROP_MEDIUM: 10,         // Alert if score drops 10+ points
  HEALTH_TREND_DAYS: 7,           // Days to track trends

  // Deal pipeline thresholds
  DEAL_STALL_DAYS_CRITICAL: 30,  // Critical if no movement in 30 days
  DEAL_STALL_DAYS_HIGH: 21,      // High priority if no movement in 21 days
  DEAL_STALL_DAYS_MEDIUM: 14,    // Medium priority if no movement in 14 days

  // Sync failure thresholds
  SYNC_FAIL_CRITICAL: 5,         // Critical if 5+ failures in 24h
  SYNC_FAIL_HIGH: 3,             // High if 3+ failures in 24h
  SYNC_FAIL_MEDIUM: 2,           // Medium if 2+ failures in 24h

  // Lead response thresholds (hours)
  RESPONSE_DELAY_CRITICAL: 24,   // Critical if no response in 24h
  RESPONSE_DELAY_HIGH: 12,       // High if no response in 12h
  RESPONSE_DELAY_MEDIUM: 6,      // Medium if no response in 6h

  // Alert deduplication window (hours)
  DEDUP_WINDOW_HOURS: 24,
};

// ============================================
// HEALTH SCORE MONITORING
// ============================================

async function checkHealthScoreDrops(): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  try {
    // Get health scores from last 14 days for trend analysis
    const { data: healthScores, error } = await supabase
      .from("client_health_scores")
      .select("email, firstname, lastname, health_score, health_zone, calculated_at")
      .gte("calculated_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .order("calculated_at", { ascending: false });

    if (error) {
      console.error("[checkHealthScoreDrops] Error:", error);
      return anomalies;
    }

    if (!healthScores || healthScores.length === 0) return anomalies;

    // Group by email to track individual client trends
    const clientTrends = new Map<string, any[]>();
    healthScores.forEach(score => {
      if (!clientTrends.has(score.email)) {
        clientTrends.set(score.email, []);
      }
      clientTrends.get(score.email)!.push(score);
    });

    // Analyze each client's trend
    for (const [email, scores] of clientTrends) {
      if (scores.length < 2) continue;

      // Sort by date (newest first)
      scores.sort((a, b) => new Date(b.calculated_at).getTime() - new Date(a.calculated_at).getTime());

      const current = scores[0];
      const previous = scores[1];

      // Calculate 7-day average
      const last7Days = scores.slice(0, Math.min(7, scores.length));
      const weekAvg = last7Days.reduce((sum, s) => sum + s.health_score, 0) / last7Days.length;

      const scoreDrop = previous.health_score - current.health_score;
      const changePercent = ((scoreDrop / previous.health_score) * 100);

      // Only alert on significant drops
      if (scoreDrop >= THRESHOLDS.HEALTH_DROP_MEDIUM) {
        let severity: 'critical' | 'high' | 'medium' | 'low';
        if (scoreDrop >= THRESHOLDS.HEALTH_DROP_CRITICAL) {
          severity = 'critical';
        } else if (scoreDrop >= THRESHOLDS.HEALTH_DROP_HIGH) {
          severity = 'high';
        } else {
          severity = 'medium';
        }

        const urgencyScore = calculateUrgencyScore({
          severity,
          score_drop: scoreDrop,
          current_zone: current.health_zone,
          trend_direction: scoreDrop > 0 ? 'down' : 'up'
        });

        anomalies.push({
          type: 'health_drop',
          severity,
          entity: `${current.firstname} ${current.lastname} (${email})`,
          details: {
            email,
            current_score: current.health_score,
            previous_score: previous.health_score,
            score_drop: scoreDrop,
            change_percent: Math.round(changePercent),
            week_avg: Math.round(weekAvg),
            current_zone: current.health_zone,
            days_tracked: last7Days.length,
            calculated_at: current.calculated_at
          },
          recommended_action: getHealthDropAction(severity, current.health_zone, scoreDrop),
          urgency_score: urgencyScore,
          detected_at: new Date().toISOString()
        });
      }
    }

    console.log(`[checkHealthScoreDrops] Found ${anomalies.length} health score anomalies`);
  } catch (error) {
    console.error("[checkHealthScoreDrops] Exception:", error);
  }

  return anomalies;
}

function getHealthDropAction(severity: string, zone: string, drop: number): string {
  if (severity === 'critical') {
    return `URGENT: Schedule emergency check-in call within 24 hours. Client at high risk of churn. Score dropped ${drop} points.`;
  } else if (severity === 'high') {
    return `High Priority: Reach out within 48 hours to understand what changed. Offer support or adjustments.`;
  } else {
    return `Monitor closely: Send proactive check-in message. Schedule wellness call within 1 week.`;
  }
}

// ============================================
// DEAL PIPELINE MONITORING
// ============================================

async function checkDealPipelineStalls(): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  try {
    // Check for deals table existence and query stalled deals
    const { data: deals, error } = await supabase
      .from("deals")
      .select("id, name, stage, amount, contact_id, created_at, updated_at, last_activity_date")
      .in("stage", ["Assessment", "Proposal", "Negotiation", "Trial"])
      .order("updated_at", { ascending: true });

    if (error) {
      // Deals table might not exist in all deployments
      console.log("[checkDealPipelineStalls] Deals table not available or error:", error.message);
      return anomalies;
    }

    if (!deals || deals.length === 0) return anomalies;

    const now = Date.now();

    for (const deal of deals) {
      const lastUpdate = new Date(deal.last_activity_date || deal.updated_at).getTime();
      const daysSinceUpdate = Math.floor((now - lastUpdate) / (24 * 60 * 60 * 1000));

      let severity: 'critical' | 'high' | 'medium' | 'low' | null = null;

      if (daysSinceUpdate >= THRESHOLDS.DEAL_STALL_DAYS_CRITICAL) {
        severity = 'critical';
      } else if (daysSinceUpdate >= THRESHOLDS.DEAL_STALL_DAYS_HIGH) {
        severity = 'high';
      } else if (daysSinceUpdate >= THRESHOLDS.DEAL_STALL_DAYS_MEDIUM) {
        severity = 'medium';
      }

      if (severity) {
        const urgencyScore = calculateUrgencyScore({
          severity,
          days_stalled: daysSinceUpdate,
          deal_value: deal.amount || 0,
          stage: deal.stage
        });

        anomalies.push({
          type: 'deal_stall',
          severity,
          entity: deal.name || `Deal #${deal.id}`,
          details: {
            deal_id: deal.id,
            deal_name: deal.name,
            stage: deal.stage,
            amount: deal.amount,
            days_stalled: daysSinceUpdate,
            last_activity: deal.last_activity_date || deal.updated_at,
            contact_id: deal.contact_id
          },
          recommended_action: getDealStallAction(severity, deal.stage, daysSinceUpdate),
          urgency_score: urgencyScore,
          detected_at: new Date().toISOString()
        });
      }
    }

    console.log(`[checkDealPipelineStalls] Found ${anomalies.length} stalled deals`);
  } catch (error) {
    console.error("[checkDealPipelineStalls] Exception:", error);
  }

  return anomalies;
}

function getDealStallAction(severity: string, stage: string, days: number): string {
  if (severity === 'critical') {
    return `CRITICAL: Deal stuck in ${stage} for ${days} days. Immediate follow-up required. Consider re-engagement strategy or close-lost.`;
  } else if (severity === 'high') {
    return `High Priority: Reach out to understand blockers. Offer assistance or incentives to move forward.`;
  } else {
    return `Follow up within 3 business days. Check if prospect needs additional information or support.`;
  }
}

// ============================================
// SYNC STATUS MONITORING
// ============================================

async function checkSyncFailures(): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Check sync_errors table
    const { data: syncErrors, error } = await supabase
      .from("sync_errors")
      .select("id, error_type, source, object_type, error_message, created_at, retry_count")
      .is("resolved_at", null)
      .gte("created_at", last24h)
      .order("created_at", { ascending: false });

    if (error) {
      console.log("[checkSyncFailures] Sync errors table not available:", error.message);
      return anomalies;
    }

    if (!syncErrors || syncErrors.length === 0) return anomalies;

    // Group by source and error type
    const errorGroups = new Map<string, any[]>();

    syncErrors.forEach(err => {
      const key = `${err.source}_${err.error_type}`;
      if (!errorGroups.has(key)) {
        errorGroups.set(key, []);
      }
      errorGroups.get(key)!.push(err);
    });

    // Analyze each error group
    for (const [key, errors] of errorGroups) {
      const count = errors.length;
      const [source, errorType] = key.split('_');

      let severity: 'critical' | 'high' | 'medium' | 'low' | null = null;

      if (count >= THRESHOLDS.SYNC_FAIL_CRITICAL) {
        severity = 'critical';
      } else if (count >= THRESHOLDS.SYNC_FAIL_HIGH) {
        severity = 'high';
      } else if (count >= THRESHOLDS.SYNC_FAIL_MEDIUM) {
        severity = 'medium';
      }

      if (severity) {
        const urgencyScore = calculateUrgencyScore({
          severity,
          failure_count: count,
          source: source,
          error_type: errorType
        });

        anomalies.push({
          type: 'sync_fail',
          severity,
          entity: `${source.toUpperCase()} - ${errorType}`,
          details: {
            source,
            error_type: errorType,
            failure_count: count,
            recent_errors: errors.slice(0, 5).map(e => ({
              id: e.id,
              message: e.error_message,
              object_type: e.object_type,
              retry_count: e.retry_count,
              created_at: e.created_at
            })),
            last_error: errors[0].created_at
          },
          recommended_action: getSyncFailAction(severity, source, errorType, count),
          urgency_score: urgencyScore,
          detected_at: new Date().toISOString()
        });
      }
    }

    console.log(`[checkSyncFailures] Found ${anomalies.length} sync failure patterns`);
  } catch (error) {
    console.error("[checkSyncFailures] Exception:", error);
  }

  return anomalies;
}

function getSyncFailAction(severity: string, source: string, errorType: string, count: number): string {
  if (severity === 'critical') {
    return `CRITICAL: ${source} sync failing repeatedly (${count} failures). Check API credentials, rate limits, and connectivity immediately.`;
  } else if (severity === 'high') {
    return `High Priority: ${source} experiencing ${errorType} errors. Review error logs and consider manual retry or system restart.`;
  } else {
    return `Monitor ${source} sync status. May resolve automatically with retry. Investigate if pattern continues.`;
  }
}

// ============================================
// LEAD RESPONSE TIME MONITORING
// ============================================

async function checkLeadResponseTimes(): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  try {
    // Get recent leads without responses
    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, name, email, created_at, status, source, last_contact_date")
      .in("status", ["new", "contacted", "qualified"])
      .order("created_at", { ascending: true });

    if (error) {
      console.log("[checkLeadResponseTimes] Leads table not available:", error.message);
      return anomalies;
    }

    if (!leads || leads.length === 0) return anomalies;

    const now = Date.now();

    for (const lead of leads) {
      // Check if lead has been contacted
      const hasResponse = lead.last_contact_date != null;

      if (!hasResponse && lead.status === "new") {
        const createdAt = new Date(lead.created_at).getTime();
        const hoursSinceCreation = (now - createdAt) / (60 * 60 * 1000);

        let severity: 'critical' | 'high' | 'medium' | 'low' | null = null;

        if (hoursSinceCreation >= THRESHOLDS.RESPONSE_DELAY_CRITICAL) {
          severity = 'critical';
        } else if (hoursSinceCreation >= THRESHOLDS.RESPONSE_DELAY_HIGH) {
          severity = 'high';
        } else if (hoursSinceCreation >= THRESHOLDS.RESPONSE_DELAY_MEDIUM) {
          severity = 'medium';
        }

        if (severity) {
          const urgencyScore = calculateUrgencyScore({
            severity,
            hours_waiting: hoursSinceCreation,
            lead_source: lead.source,
            status: lead.status
          });

          anomalies.push({
            type: 'response_delay',
            severity,
            entity: lead.name || lead.email || `Lead #${lead.id}`,
            details: {
              lead_id: lead.id,
              name: lead.name,
              email: lead.email,
              source: lead.source,
              status: lead.status,
              hours_waiting: Math.round(hoursSinceCreation),
              created_at: lead.created_at
            },
            recommended_action: getResponseDelayAction(severity, hoursSinceCreation, lead.source),
            urgency_score: urgencyScore,
            detected_at: new Date().toISOString()
          });
        }
      }
    }

    console.log(`[checkLeadResponseTimes] Found ${anomalies.length} delayed lead responses`);
  } catch (error) {
    console.error("[checkLeadResponseTimes] Exception:", error);
  }

  return anomalies;
}

function getResponseDelayAction(severity: string, hours: number, source?: string): string {
  if (severity === 'critical') {
    return `URGENT: Lead waiting ${Math.round(hours)} hours without contact. Respond immediately to prevent loss. Strike while iron is hot!`;
  } else if (severity === 'high') {
    return `High Priority: Reach out within next 2 hours. Lead interest may be cooling. ${source ? `Source: ${source}` : ''}`;
  } else {
    return `Contact lead today. Timely response improves conversion rates significantly.`;
  }
}

// ============================================
// URGENCY SCORING
// ============================================

function calculateUrgencyScore(context: any): number {
  let score = 0;

  // Base score from severity
  const severityScores = {
    critical: 90,
    high: 70,
    medium: 50,
    low: 30
  };
  score = severityScores[context.severity as keyof typeof severityScores] || 50;

  // Adjust based on specific factors
  if (context.score_drop) {
    score += Math.min(context.score_drop / 2, 10); // +0.5 per point dropped, max +10
  }

  if (context.current_zone === 'RED') {
    score += 15; // Already in danger zone
  } else if (context.current_zone === 'YELLOW') {
    score += 5;
  }

  if (context.days_stalled) {
    score += Math.min(context.days_stalled / 5, 10); // +2 per 10 days, max +10
  }

  if (context.deal_value && context.deal_value > 10000) {
    score += 10; // High value deal
  }

  if (context.failure_count) {
    score += Math.min(context.failure_count * 3, 15); // +3 per failure, max +15
  }

  if (context.hours_waiting) {
    score += Math.min(context.hours_waiting / 2, 10); // +0.5 per hour, max +10
  }

  // Cap at 100
  return Math.min(Math.round(score), 100);
}

// ============================================
// TREND ANALYSIS
// ============================================

async function analyzeTrends(anomalies: Anomaly[]): Promise<{ insights: string[], predictions: string[] }> {
  const insights: string[] = [];
  const predictions: string[] = [];

  try {
    // Analyze health score trends
    const healthDrops = anomalies.filter(a => a.type === 'health_drop');
    if (healthDrops.length >= 3) {
      const avgDrop = healthDrops.reduce((sum, a) => sum + a.details.score_drop, 0) / healthDrops.length;
      insights.push(`${healthDrops.length} clients experiencing health score drops. Average drop: ${Math.round(avgDrop)} points.`);

      if (avgDrop > 15) {
        predictions.push("Trend indicates potential systemic issue affecting multiple clients. Investigate common factors.");
      }
    }

    // Analyze deal stalls
    const stalledDeals = anomalies.filter(a => a.type === 'deal_stall');
    if (stalledDeals.length >= 3) {
      const stages = new Map<string, number>();
      stalledDeals.forEach(a => {
        const stage = a.details.stage;
        stages.set(stage, (stages.get(stage) || 0) + 1);
      });

      const topStage = Array.from(stages.entries()).sort((a, b) => b[1] - a[1])[0];
      insights.push(`${stalledDeals.length} deals stalled. Most common stage: ${topStage[0]} (${topStage[1]} deals)`);
      predictions.push(`Review ${topStage[0]} stage process. May indicate bottleneck or unclear next steps.`);
    }

    // Analyze sync failures
    const syncFails = anomalies.filter(a => a.type === 'sync_fail');
    if (syncFails.length > 0) {
      const sources = new Set(syncFails.map(a => a.details.source));
      insights.push(`Sync failures detected across ${sources.size} source(s): ${Array.from(sources).join(', ')}`);

      if (syncFails.some(a => a.severity === 'critical')) {
        predictions.push("Critical sync failures may cause data inconsistencies. Immediate attention required.");
      }
    }

    // Analyze response delays
    const delays = anomalies.filter(a => a.type === 'response_delay');
    if (delays.length >= 2) {
      const avgWait = delays.reduce((sum, a) => sum + a.details.hours_waiting, 0) / delays.length;
      insights.push(`${delays.length} leads waiting for response. Average wait time: ${Math.round(avgWait)} hours`);
      predictions.push("Slow lead response times directly impact conversion rates. Consider automation or staffing adjustments.");
    }

  } catch (error) {
    console.error("[analyzeTrends] Error:", error);
  }

  return { insights, predictions };
}

// ============================================
// SMART ALERT GROUPING
// ============================================

function groupRelatedAnomalies(anomalies: Anomaly[]): AlertGroup[] {
  const groups: AlertGroup[] = [];

  // Group by type
  const typeGroups = new Map<string, Anomaly[]>();
  anomalies.forEach(anomaly => {
    if (!typeGroups.has(anomaly.type)) {
      typeGroups.set(anomaly.type, []);
    }
    typeGroups.get(anomaly.type)!.push(anomaly);
  });

  // Create alert groups
  for (const [type, typeAnomalies] of typeGroups) {
    if (typeAnomalies.length === 0) continue;

    // Sort by urgency score
    typeAnomalies.sort((a, b) => b.urgency_score - a.urgency_score);

    // Determine combined severity
    const hasCritical = typeAnomalies.some(a => a.severity === 'critical');
    const hasHigh = typeAnomalies.some(a => a.severity === 'high');

    let combinedSeverity: 'critical' | 'high' | 'medium' | 'low';
    if (hasCritical) {
      combinedSeverity = 'critical';
    } else if (hasHigh || typeAnomalies.length >= 5) {
      combinedSeverity = 'high';
    } else if (typeAnomalies.length >= 3) {
      combinedSeverity = 'medium';
    } else {
      combinedSeverity = typeAnomalies[0].severity;
    }

    // Calculate combined urgency
    const avgUrgency = typeAnomalies.reduce((sum, a) => sum + a.urgency_score, 0) / typeAnomalies.length;
    const combinedUrgency = Math.min(Math.round(avgUrgency + (typeAnomalies.length * 2)), 100);

    groups.push({
      group_id: `${type}_${Date.now()}`,
      primary_anomaly: typeAnomalies[0],
      related_anomalies: typeAnomalies.slice(1),
      combined_severity: combinedSeverity,
      combined_urgency: combinedUrgency,
      affected_count: typeAnomalies.length
    });
  }

  return groups;
}

// ============================================
// DEDUPLICATION
// ============================================

async function checkExistingAlert(dedupKey: string): Promise<boolean> {
  try {
    const windowStart = new Date(Date.now() - THRESHOLDS.DEDUP_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("proactive_insights")
      .select("id")
      .eq("dedup_key", dedupKey)
      .gte("created_at", windowStart)
      .limit(1);

    if (error) {
      console.error("[checkExistingAlert] Error:", error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error("[checkExistingAlert] Exception:", error);
    return false;
  }
}

// ============================================
// ALERT STORAGE
// ============================================

async function saveAlert(group: AlertGroup, insights: string[], predictions: string[]): Promise<boolean> {
  try {
    const anomaly = group.primary_anomaly;
    const dedupKey = `${anomaly.type}_${anomaly.entity}_${new Date().toISOString().split('T')[0]}`;

    // Check for duplicate
    const exists = await checkExistingAlert(dedupKey);
    if (exists) {
      console.log(`[saveAlert] Skipping duplicate alert: ${dedupKey}`);
      return false;
    }

    // Generate title and content
    const title = generateAlertTitle(group);
    const content = generateAlertContent(group, insights, predictions);

    // Generate action items
    const actionItems = generateActionItems(group);

    // Save to proactive_insights
    const { error } = await supabase
      .from("proactive_insights")
      .insert({
        insight_type: 'alert',
        priority: group.combined_severity,
        title,
        content,
        summary: generateSummary(group),
        action_items: actionItems,
        affected_entities: {
          type: anomaly.type,
          count: group.affected_count,
          entities: [anomaly.entity, ...group.related_anomalies.map(a => a.entity)].slice(0, 10),
          urgency_score: group.combined_urgency
        },
        source_agent: 'ptd-proactive',
        source_data: {
          primary_anomaly: anomaly,
          related_count: group.related_anomalies.length,
          insights,
          predictions
        },
        dedup_key: dedupKey,
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48h expiry
      });

    if (error) {
      console.error("[saveAlert] Error saving alert:", error);
      return false;
    }

    console.log(`[saveAlert] Saved alert: ${title}`);
    return true;
  } catch (error) {
    console.error("[saveAlert] Exception:", error);
    return false;
  }
}

function generateAlertTitle(group: AlertGroup): string {
  const anomaly = group.primary_anomaly;
  const count = group.affected_count;

  switch (anomaly.type) {
    case 'health_drop':
      if (count > 1) {
        return `${count} Clients: Health Scores Dropping`;
      }
      return `Client Health Drop: ${anomaly.entity}`;

    case 'deal_stall':
      if (count > 1) {
        return `${count} Deals Stalled in Pipeline`;
      }
      return `Deal Stalled: ${anomaly.entity}`;

    case 'sync_fail':
      return `${anomaly.entity}: ${count} Sync Failures`;

    case 'response_delay':
      if (count > 1) {
        return `${count} Leads Waiting for Response`;
      }
      return `Lead Response Delay: ${anomaly.entity}`;

    default:
      return `Anomaly Detected: ${anomaly.type}`;
  }
}

function generateAlertContent(group: AlertGroup, insights: string[], predictions: string[]): string {
  const anomaly = group.primary_anomaly;
  let content = '';

  // Primary anomaly details
  if (anomaly.type === 'health_drop') {
    content += `**Primary Alert:**\n${anomaly.entity} health score dropped ${anomaly.details.score_drop} points `;
    content += `(from ${anomaly.details.previous_score} to ${anomaly.details.current_score}). `;
    content += `Currently in ${anomaly.details.current_zone} zone.\n\n`;
  } else if (anomaly.type === 'deal_stall') {
    content += `**Primary Alert:**\n${anomaly.entity} has been stuck in ${anomaly.details.stage} stage `;
    content += `for ${anomaly.details.days_stalled} days without activity.\n\n`;
  } else if (anomaly.type === 'sync_fail') {
    content += `**Primary Alert:**\n${anomaly.entity} has failed ${anomaly.details.failure_count} times `;
    content += `in the last 24 hours.\n\n`;
  } else if (anomaly.type === 'response_delay') {
    content += `**Primary Alert:**\n${anomaly.entity} has been waiting ${anomaly.details.hours_waiting} hours `;
    content += `without any contact or response.\n\n`;
  }

  // Related anomalies
  if (group.related_anomalies.length > 0) {
    content += `**Related Issues (${group.related_anomalies.length}):**\n`;
    group.related_anomalies.slice(0, 5).forEach(a => {
      content += `- ${a.entity}`;
      if (a.type === 'health_drop') {
        content += ` (dropped ${a.details.score_drop} points)`;
      } else if (a.type === 'deal_stall') {
        content += ` (${a.details.days_stalled} days in ${a.details.stage})`;
      }
      content += `\n`;
    });
    if (group.related_anomalies.length > 5) {
      content += `... and ${group.related_anomalies.length - 5} more\n`;
    }
    content += `\n`;
  }

  // Insights
  if (insights.length > 0) {
    content += `**Analysis:**\n`;
    insights.forEach(insight => {
      content += `- ${insight}\n`;
    });
    content += `\n`;
  }

  // Predictions
  if (predictions.length > 0) {
    content += `**Predicted Impact:**\n`;
    predictions.forEach(prediction => {
      content += `- ${prediction}\n`;
    });
    content += `\n`;
  }

  // Recommended action
  content += `**Recommended Action:**\n${anomaly.recommended_action}\n`;

  return content;
}

function generateSummary(group: AlertGroup): string {
  const anomaly = group.primary_anomaly;
  const count = group.affected_count;

  if (count > 1) {
    return `${count} ${anomaly.type.replace('_', ' ')} anomalies detected. Urgency: ${group.combined_urgency}/100`;
  }
  return `${anomaly.type.replace('_', ' ')}: ${anomaly.entity}. Urgency: ${group.combined_urgency}/100`;
}

function generateActionItems(group: AlertGroup): any[] {
  const anomaly = group.primary_anomaly;
  const items: any[] = [];

  items.push({
    action: anomaly.recommended_action,
    priority: anomaly.severity,
    urgency_score: anomaly.urgency_score
  });

  if (group.related_anomalies.length > 0) {
    items.push({
      action: `Review all ${group.affected_count} affected entities for common patterns`,
      priority: 'medium',
      urgency_score: Math.round(group.combined_urgency * 0.7)
    });
  }

  return items;
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log("[PTD Proactive] Starting comprehensive monitoring scan...");

    // Run all monitoring checks in parallel
    const [
      healthAnomalies,
      dealAnomalies,
      syncAnomalies,
      responseAnomalies
    ] = await Promise.all([
      checkHealthScoreDrops(),
      checkDealPipelineStalls(),
      checkSyncFailures(),
      checkLeadResponseTimes()
    ]);

    // Combine all anomalies
    const allAnomalies = [
      ...healthAnomalies,
      ...dealAnomalies,
      ...syncAnomalies,
      ...responseAnomalies
    ];

    console.log(`[PTD Proactive] Found ${allAnomalies.length} total anomalies`);

    // Analyze trends
    const { insights, predictions } = await analyzeTrends(allAnomalies);

    // Group related anomalies
    const alertGroups = groupRelatedAnomalies(allAnomalies);

    console.log(`[PTD Proactive] Grouped into ${alertGroups.length} alert groups`);

    // Save alerts
    let savedCount = 0;
    for (const group of alertGroups) {
      const saved = await saveAlert(group, insights, predictions);
      if (saved) savedCount++;
    }

    const duration = Date.now() - startTime;

    console.log(`[PTD Proactive] Complete. Saved ${savedCount} new alerts in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      anomalies_detected: allAnomalies.length,
      alert_groups_created: alertGroups.length,
      alerts_saved: savedCount,
      breakdown: {
        health_drops: healthAnomalies.length,
        deal_stalls: dealAnomalies.length,
        sync_failures: syncAnomalies.length,
        response_delays: responseAnomalies.length
      },
      insights,
      predictions,
      alert_groups: alertGroups.map(g => ({
        type: g.primary_anomaly.type,
        severity: g.combined_severity,
        urgency: g.combined_urgency,
        affected_count: g.affected_count
      }))
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error("[PTD Proactive] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
