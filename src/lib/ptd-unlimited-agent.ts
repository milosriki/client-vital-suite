import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============= UNLIMITED AGENT SYSTEM =============
// Full system control + self-improvement + 24/7 monitoring

export interface ExecutionRequest {
  action: string;
  params: Record<string, any>;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  requires_approval: boolean;
  requested_at: string;
  approved_at?: string;
  executed_at?: string;
  result?: any;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
}

export interface AgentSpecialist {
  name: string;
  focus: string;
  tools: string[];
  model: string;
  active: boolean;
}

// ============= SPECIALIST AGENTS =============
export const SPECIALIST_AGENTS: Record<string, AgentSpecialist> = {
  fraud_detective: {
    name: 'Fraud Detective',
    focus: 'Stripe fraud patterns, suspicious transactions, payout anomalies',
    tools: ['stripe_control', 'fraud_scan', 'payment_analysis'],
    model: 'gemini-2.5-flash',
    active: true
  },
  churn_predictor: {
    name: 'Churn Predictor', 
    focus: 'Client dropout risk, engagement decline, health zone transitions',
    tools: ['client_control', 'health_analysis', 'intervention_trigger'],
    model: 'gemini-2.5-flash',
    active: true
  },
  sales_optimizer: {
    name: 'Sales Optimizer',
    focus: 'Pipeline leaks, conversion optimization, deal velocity',
    tools: ['sales_flow_control', 'lead_control', 'deal_analyzer'],
    model: 'gemini-2.5-flash',
    active: true
  },
  coach_analyzer: {
    name: 'Coach Analyzer',
    focus: 'Coach performance, client distribution, workload balance',
    tools: ['coach_control', 'performance_metrics', 'client_assignment'],
    model: 'gemini-2.5-flash',
    active: true
  },
  revenue_engineer: {
    name: 'Revenue Engineer',
    focus: 'Revenue leaks, pricing optimization, LTV maximization',
    tools: ['revenue_control', 'pricing_analysis', 'upsell_detector'],
    model: 'gemini-2.5-flash',
    active: true
  },
  lead_router: {
    name: 'Lead Router',
    focus: 'Lead scoring, assignment optimization, response time',
    tools: ['lead_control', 'assignment_logic', 'priority_queue'],
    model: 'gemini-2.5-flash',
    active: true
  },
  campaign_analyst: {
    name: 'Campaign Analyst',
    focus: 'Ad performance, ROAS optimization, attribution analysis',
    tools: ['campaign_control', 'attribution_analysis', 'ad_optimization'],
    model: 'gemini-2.5-flash',
    active: true
  },
  call_whisperer: {
    name: 'Call Whisperer',
    focus: 'Call transcriptions, sentiment analysis, objection patterns',
    tools: ['call_control', 'sentiment_analysis', 'keyword_extraction'],
    model: 'gemini-2.5-flash',
    active: true
  },
  hubspot_guardian: {
    name: 'HubSpot Guardian',
    focus: 'CRM sync, data quality, workflow optimization',
    tools: ['hubspot_control', 'data_validation', 'workflow_trigger'],
    model: 'gemini-2.5-flash',
    active: true
  },
  pattern_hunter: {
    name: 'Pattern Hunter',
    focus: 'Anomaly detection, trend identification, predictive patterns',
    tools: ['analytics_control', 'pattern_detection', 'anomaly_alert'],
    model: 'gemini-2.5-flash',
    active: true
  }
};

// ============= EXECUTION CAPABILITIES =============
export const EXECUTION_TOOLS = {
  // DATA MODIFICATION
  update_client_zone: {
    name: 'update_client_zone',
    description: 'Update client health zone and trigger intervention',
    risk_level: 'medium',
    requires_approval: true
  },
  create_intervention: {
    name: 'create_intervention',
    description: 'Create intervention action for at-risk client',
    risk_level: 'low',
    requires_approval: false
  },
  update_lead_status: {
    name: 'update_lead_status',
    description: 'Update lead status in pipeline',
    risk_level: 'low',
    requires_approval: false
  },
  reassign_coach: {
    name: 'reassign_coach',
    description: 'Reassign client to different coach',
    risk_level: 'medium',
    requires_approval: true
  },
  
  // EXTERNAL ACTIONS
  send_alert: {
    name: 'send_alert',
    description: 'Send urgent alert notification',
    risk_level: 'low',
    requires_approval: false
  },
  trigger_sync: {
    name: 'trigger_sync',
    description: 'Trigger HubSpot/CRM sync',
    risk_level: 'low',
    requires_approval: false
  },
  
  // HIGH RISK ACTIONS
  bulk_update: {
    name: 'bulk_update',
    description: 'Bulk update multiple records',
    risk_level: 'high',
    requires_approval: true
  },
  pause_stripe_payout: {
    name: 'pause_stripe_payout',
    description: 'EMERGENCY: Pause suspicious Stripe payout',
    risk_level: 'critical',
    requires_approval: true
  },
  execute_sql: {
    name: 'execute_sql',
    description: 'Execute custom SQL query (READ ONLY)',
    risk_level: 'medium',
    requires_approval: true
  }
};

// ============= APPROVAL QUEUE =============
export async function requestExecution(
  action: string,
  params: Record<string, any>,
  reason: string
): Promise<{ request_id: string; status: string }> {
  const toolConfig = EXECUTION_TOOLS[action as keyof typeof EXECUTION_TOOLS];
  
  if (!toolConfig) {
    throw new Error(`Unknown execution action: ${action}`);
  }

  const request: ExecutionRequest = {
    action,
    params,
    risk_level: toolConfig.risk_level as ExecutionRequest['risk_level'],
    requires_approval: toolConfig.requires_approval,
    requested_at: new Date().toISOString(),
    status: toolConfig.requires_approval ? 'pending' : 'approved'
  };

  const { data, error } = await supabase
    .from('agent_context')
    .insert({
      key: `execution_request_${Date.now()}`,
      value: { ...request, reason },
      agent_type: 'execution_queue',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    })
    .select('key')
    .single();

  if (error) throw error;

  // Auto-execute if no approval needed
  if (!toolConfig.requires_approval) {
    await executeApprovedAction(data.key, action, params);
    return { request_id: data.key, status: 'executed' };
  }

  return { request_id: data.key, status: 'pending_approval' };
}

export async function approveExecution(requestKey: string): Promise<any> {
  const { data: request } = await supabase
    .from('agent_context')
    .select('value')
    .eq('key', requestKey)
    .single();

  if (!request) throw new Error('Request not found');

  const execRequest = request.value as unknown as ExecutionRequest;
  return executeApprovedAction(requestKey, execRequest.action, execRequest.params);
}

export async function rejectExecution(requestKey: string, reason: string): Promise<void> {
  await supabase
    .from('agent_context')
    .update({
      value: {
        status: 'rejected',
        rejected_reason: reason,
        rejected_at: new Date().toISOString()
      }
    })
    .eq('key', requestKey);
}

async function executeApprovedAction(
  requestKey: string,
  action: string,
  params: Record<string, any>
): Promise<any> {
  

  let result: any;

  try {
    switch (action) {
      case 'update_client_zone':
        result = await supabase
          .from('client_health_scores')
          .update({ 
            health_zone: params.zone,
            intervention_priority: params.priority || 'medium'
          })
          .eq('email', params.email);
        break;

      case 'create_intervention':
        result = await supabase
          .from('proactive_insights')
          .insert({
            insight_type: 'intervention',
            title: `Intervention for ${params.email}`,
            description: params.recommendation,
            priority: params.priority || 'medium',
            source_agent: 'unlimited_agent',
            is_actionable: true,
            data: { client_email: params.email, action_type: params.action_type }
          });
        break;

      case 'update_lead_status':
        result = await supabase
          .from('enhanced_leads')
          .update({ conversion_status: params.status })
          .eq('email', params.email);
        break;

      case 'reassign_coach':
        result = await supabase
          .from('client_health_scores')
          .update({ assigned_coach: params.new_coach })
          .eq('email', params.email);
        break;

      case 'send_alert':
        // Store alert for notification system
        result = await supabase
          .from('proactive_insights')
          .insert({
            insight_type: 'urgent_alert',
            title: params.title,
            description: params.message,
            priority: params.priority || 'high',
            source_agent: 'unlimited_agent',
            is_actionable: true
          });
        break;

      case 'trigger_sync':
        result = await supabase.functions.invoke('sync-hubspot-to-supabase', { body: {} });
        break;

      default:
        throw new Error(`Execution not implemented: ${action}`);
    }

    // Update request status
    await supabase
      .from('agent_context')
      .update({
        value: {
          status: 'executed',
          executed_at: new Date().toISOString(),
          result
        }
      })
      .eq('key', requestKey);

    return { success: true, result };
  } catch (error) {
    await supabase
      .from('agent_context')
      .update({
        value: {
          status: 'failed',
          failed_at: new Date().toISOString(),
          error: String(error)
        }
      })
      .eq('key', requestKey);

    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Execution failed:', errorMsg);
    toast.error(`Action failed: ${errorMsg}`);
    throw error;
  }
}

// ============= PENDING APPROVALS =============
export async function getPendingApprovals(): Promise<ExecutionRequest[]> {
  const { data } = await supabase
    .from('agent_context')
    .select('key, value')
    .eq('agent_type', 'execution_queue')
    .order('created_at', { ascending: false })
    .limit(50);

  return (data || [])
    .filter((d: any) => (d.value as any)?.status === 'pending')
    .map((d: any) => ({ ...(d.value as ExecutionRequest), request_key: d.key }) as ExecutionRequest);
}

// ============= 24/7 MONITORING =============
export async function runMonitoringScan(): Promise<{
  alerts: any[];
  metrics: any;
  timestamp: string;
}> {
  

  const alerts: any[] = [];

  // 1. Check for critical health zone changes
  const { data: criticalClients } = await supabase
    .from('client_health_scores')
    .select('email, firstname, lastname, health_zone, health_score, churn_risk_score')
    .eq('health_zone', 'red')
    .order('health_score', { ascending: true })
    .limit(10);

  if (criticalClients && criticalClients.length > 0) {
    alerts.push({
      type: 'critical_clients',
      severity: 'high',
      count: criticalClients.length,
      message: `${criticalClients.length} clients in RED zone need immediate attention`,
      clients: criticalClients.map(c => `${c.firstname} ${c.lastname} (${c.health_score})`).slice(0, 5)
    });
  }

  // 2. Check for stale leads (no activity in 48 hours)
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: staleLeads, count: staleCount } = await supabase
    .from('enhanced_leads')
    .select('email, first_name, lead_score', { count: 'exact' })
    .is('first_contact_at', null)
    .lt('created_at', twoDaysAgo)
    .limit(10);

  if (staleCount && staleCount > 0) {
    alerts.push({
      type: 'stale_leads',
      severity: 'medium',
      count: staleCount,
      message: `${staleCount} leads with no contact in 48+ hours`,
      leads: staleLeads?.slice(0, 5)
    });
  }

  // 3. Get health zone distribution
  const { data: healthStats } = await supabase
    .from('client_health_scores')
    .select('health_zone');

  const zoneDistribution = (healthStats || []).reduce((acc: Record<string, number>, c: any) => {
    acc[c.health_zone || 'unknown'] = (acc[c.health_zone || 'unknown'] || 0) + 1;
    return acc;
  }, {});

  // 4. Check recent sync status
  const { data: recentSync } = await supabase
    .from('sync_logs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  const metrics = {
    total_clients: healthStats?.length || 0,
    zone_distribution: zoneDistribution,
    critical_count: zoneDistribution['red'] || 0,
    at_risk_count: (zoneDistribution['red'] || 0) + (zoneDistribution['yellow'] || 0),
    last_sync: recentSync?.started_at,
    sync_status: recentSync?.status
  };

  // Save monitoring results
  await supabase.from('agent_context').upsert({
    key: 'monitoring_results',
    value: { alerts, metrics, timestamp: new Date().toISOString() },
    agent_type: 'monitoring',
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
  });

  
  return { alerts, metrics, timestamp: new Date().toISOString() };
}

// ============= SELF-LEARNING =============
export async function selfLearnFromSuccess(
  action: string,
  params: Record<string, any>,
  outcome: 'success' | 'failure',
  feedback?: string
): Promise<void> {
  // Record learning for future pattern matching
  await supabase.from('agent_patterns').upsert({
    pattern_name: `execution_${action}_${outcome}`,
    description: `Action ${action} resulted in ${outcome}. ${feedback || ''}`,
    confidence: outcome === 'success' ? 0.8 : 0.3,
    examples: [{ params, outcome, timestamp: new Date().toISOString() }],
    usage_count: 1,
    last_used_at: new Date().toISOString()
  }, { onConflict: 'pattern_name' });
}

// ============= ORCHESTRATE SPECIALISTS =============
export async function orchestrateSpecialists(
  query: string,
  specialists?: string[]
): Promise<Record<string, any>> {
  const activeSpecialists = specialists 
    ? specialists.filter(s => SPECIALIST_AGENTS[s]?.active)
    : Object.keys(SPECIALIST_AGENTS).filter(s => SPECIALIST_AGENTS[s].active);

  

  const results: Record<string, any> = {};

  // For now, delegate to main agent - full multi-agent can be expanded
  for (const specialistKey of activeSpecialists.slice(0, 3)) {
    const specialist = SPECIALIST_AGENTS[specialistKey];
    results[specialistKey] = {
      name: specialist.name,
      focus: specialist.focus,
      status: 'available',
      tools: specialist.tools
    };
  }

  return results;
}

// ============= AGENT STATS =============
export async function getAgentStats(): Promise<{
  memories: number;
  patterns: number;
  executions: number;
  pending_approvals: number;
  specialists: number;
  last_monitoring: string | null;
}> {
  const [memories, patterns, executions, monitoring] = await Promise.all([
    supabase.from('agent_memory').select('id', { count: 'exact', head: true }),
    supabase.from('agent_patterns').select('id', { count: 'exact', head: true }),
    supabase.from('agent_context').select('id', { count: 'exact', head: true }).eq('agent_type', 'execution_queue'),
    supabase.from('agent_context').select('value').eq('key', 'monitoring_results').single()
  ]);

  const pending = await getPendingApprovals();

  return {
    memories: memories.count || 0,
    patterns: patterns.count || 0,
    executions: executions.count || 0,
    pending_approvals: pending.length,
    specialists: Object.values(SPECIALIST_AGENTS).filter(s => s.active).length,
    last_monitoring: (monitoring.data?.value as any)?.timestamp || null
  };
}
