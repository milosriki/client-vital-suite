import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { verifyAuth } from "../_shared/auth-middleware.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 PTD 24/7 Monitor Starting...');

  try {
    const alerts: any[] = [];
    const now = new Date();

    // ============= CRITICAL HEALTH MONITORING =============
    const { data: criticalClients } = await supabase
      .from('client_health_scores')
      .select('email, firstname, lastname, health_zone, health_score, churn_risk_score, assigned_coach, package_value_aed')
      .eq('health_zone', 'red')
      .order('health_score', { ascending: true })
      .limit(20);

    if (criticalClients && criticalClients.length > 0) {
      const totalAtRiskRevenue = criticalClients.reduce((sum, c) => sum + (c.package_value_aed || 0), 0);
      
      alerts.push({
        type: 'CRITICAL_CLIENTS',
        severity: 'critical',
        count: criticalClients.length,
        at_risk_revenue: totalAtRiskRevenue,
        message: `🚨 ${criticalClients.length} clients in RED zone (AED ${totalAtRiskRevenue.toLocaleString()} at risk)`,
        clients: criticalClients.slice(0, 5).map(c => ({
          name: `${c.firstname || ''} ${c.lastname || ''}`.trim() || c.email,
          score: c.health_score,
          coach: c.assigned_coach,
          value: c.package_value_aed
        })),
        action_required: 'Immediate intervention needed'
      });
    }

    // ============= CHURN RISK SPIKE DETECTION =============
    const { data: highChurnRisk } = await supabase
      .from('client_health_scores')
      .select('email, firstname, churn_risk_score')
      .gte('churn_risk_score', 80)
      .order('churn_risk_score', { ascending: false })
      .limit(10);

    if (highChurnRisk && highChurnRisk.length > 0) {
      alerts.push({
        type: 'HIGH_CHURN_RISK',
        severity: 'high',
        count: highChurnRisk.length,
        message: `⚠️ ${highChurnRisk.length} clients with churn risk > 80%`,
        clients: highChurnRisk.slice(0, 5)
      });
    }

    // ============= STALE LEADS DETECTION (Using unified schema: contacts) =============
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const { count: staleLeadCount } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('lifecycle_stage', 'lead')
      .lt('created_at', twoDaysAgo);

    if (staleLeadCount && staleLeadCount > 5) {
      alerts.push({
        type: 'STALE_LEADS',
        severity: 'medium',
        count: staleLeadCount,
        message: `📭 ${staleLeadCount} leads with no contact in 48+ hours`,
        action_required: 'Assign for immediate follow-up'
      });
    }

    // ============= SYNC HEALTH CHECK =============
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const { data: recentSync } = await supabase
      .from('sync_logs')
      .select('status, started_at, platform')
      .gte('started_at', oneHourAgo)
      .order('started_at', { ascending: false })
      .limit(1);

    if (!recentSync || recentSync.length === 0) {
      alerts.push({
        type: 'SYNC_STALE',
        severity: 'medium',
        message: '⚙️ No sync activity in the last hour',
        action_required: 'Check integration health'
      });
    }

    // ============= ZONE DISTRIBUTION ANALYTICS =============
    const { data: allClients } = await supabase
      .from('client_health_scores')
      .select('health_zone, health_score');

    const zoneDistribution = (allClients || []).reduce((acc: Record<string, number>, c: any) => {
      acc[c.health_zone || 'unknown'] = (acc[c.health_zone || 'unknown'] || 0) + 1;
      return acc;
    }, {});

    const totalClients = allClients?.length || 0;
    const avgHealth = totalClients > 0 
      ? (allClients?.reduce((sum, c) => sum + (c.health_score || 0), 0) || 0) / totalClients 
      : 0;

    // ============= PATTERN DETECTION =============
    // Check for unusual patterns
    const redPercentage = ((zoneDistribution['red'] || 0) / Math.max(totalClients, 1)) * 100;
    
    if (redPercentage > 15) {
      alerts.push({
        type: 'PATTERN_ALERT',
        severity: 'high',
        message: `📊 Unusual pattern: ${redPercentage.toFixed(1)}% clients in RED zone (normal: <10%)`,
        action_required: 'Investigate systemic issue'
      });
    }

    // ============= BUILD MONITORING REPORT =============
    const monitoringReport = {
      timestamp: now.toISOString(),
      alerts,
      alert_count: alerts.length,
      critical_count: alerts.filter(a => a.severity === 'critical').length,
      high_count: alerts.filter(a => a.severity === 'high').length,
      medium_count: alerts.filter(a => a.severity === 'medium').length,
      metrics: {
        total_clients: totalClients,
        zone_distribution: zoneDistribution,
        avg_health_score: Math.round(avgHealth * 10) / 10,
        critical_percentage: redPercentage.toFixed(1),
        at_risk_count: (zoneDistribution['red'] || 0) + (zoneDistribution['yellow'] || 0)
      }
    };

    // ============= STORE MONITORING RESULTS =============
    await supabase.from('agent_context').upsert({
      key: 'monitoring_results',
      value: monitoringReport,
      agent_type: 'monitoring_24x7',
      updated_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
    });

    // Store in proactive insights if critical alerts
    if (alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length > 0) {
      await supabase.from('proactive_insights').insert({
        insight_type: 'monitoring_alert',
        title: `🔔 24/7 Monitor: ${alerts.length} Alerts Detected`,
        description: alerts.map(a => a.message).join('\n'),
        priority: alerts.some(a => a.severity === 'critical') ? 'critical' : 'high',
        source_agent: 'ptd-24x7-monitor',
        is_actionable: true,
        data: { alerts, metrics: monitoringReport.metrics }
      });
    }

    console.log(`✅ Monitoring complete: ${alerts.length} alerts (${monitoringReport.critical_count} critical)`);

    return new Response(JSON.stringify(monitoringReport), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Monitor error:', error);
    return new Response(JSON.stringify({ 
      error: 'Monitoring failed', 
      details: String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
