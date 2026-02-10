import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= EXECUTION TOOL DEFINITIONS =============
const EXECUTION_TOOLS: Record<string, { risk: string; requires_approval: boolean }> = {
  update_client_zone: { risk: 'medium', requires_approval: true },
  create_intervention: { risk: 'low', requires_approval: false },
  update_lead_status: { risk: 'low', requires_approval: false },
  reassign_coach: { risk: 'medium', requires_approval: true },
  send_alert: { risk: 'low', requires_approval: false },
  trigger_sync: { risk: 'low', requires_approval: false },
  bulk_update: { risk: 'high', requires_approval: true },
  mark_lead_contacted: { risk: 'low', requires_approval: false },
  schedule_followup: { risk: 'low', requires_approval: false },
  code_deploy: { risk: 'high', requires_approval: true }
};

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === 'OPTIONS') {
    return apiCorsPreFlight();
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { action, params, force_approval = false, request_key } = await req.json();

    // If request_key provided, execute approved request
    if (request_key) {
      const { data: request } = await supabase
        .from('agent_context')
        .select('value')
        .eq('key', request_key)
        .single();

      if (!request) {
        return apiError("NOT_FOUND", JSON.stringify({ error: 'Request not found' }), 404);
      }

      const execRequest = request.value;
      if (execRequest.status !== 'approved' && !force_approval) {
        return apiError("REQUEST_ERROR", JSON.stringify({ error: 'Request not approved' }), 403);
      }

      return await executeAction(supabase, execRequest.action, execRequest.params, request_key);
    }

    // New execution request
    if (!action || !EXECUTION_TOOLS[action]) {
      return apiError("BAD_REQUEST", JSON.stringify({ 
        error: 'Invalid action',
        available_actions: Object.keys(EXECUTION_TOOLS)
      }), 400);
    }

    const toolConfig = EXECUTION_TOOLS[action];

    // If requires approval, queue it
    if (toolConfig.requires_approval && !force_approval) {
      const requestKey = `exec_${action}_${Date.now()}`;
      
      await supabase.from('agent_context').insert({
        key: requestKey,
        value: {
          action,
          params,
          status: 'pending',
          risk_level: toolConfig.risk,
          requested_at: new Date().toISOString()
        },
        agent_type: 'execution_queue',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      console.log(`⏳ Execution queued for approval: ${action}`);

      return apiSuccess({
        status: 'pending_approval',
        request_key: requestKey,
        action,
        risk_level: toolConfig.risk,
        message: `Action ${action} requires approval. Use request_key to execute after approval.`
      });
    }

    // Execute immediately
    return await executeAction(supabase, action, params);

  } catch (error: unknown) {
    console.error('❌ Execution error:', error);
    return apiError("INTERNAL_ERROR", JSON.stringify({ 
      error: 'Execution failed', 
      details: String(error) 
    }), 500);
  }
});

async function executeAction(
  supabase: any, 
  action: string, 
  params: any,
  requestKey?: string
): Promise<Response> {
  console.log(`⚡ Executing: ${action}`, params);

  let result: any;

  try {
    switch (action) {
      case 'update_client_zone': {
        const { email, zone, priority } = params;
        const { data, error } = await supabase
          .from('client_health_scores')
          .update({ 
            health_zone: zone,
            intervention_priority: priority || 'medium',
            updated_at: new Date().toISOString()
          })
          .eq('email', email)
          .select();
        
        if (error) throw error;
        result = { updated: data?.length || 0, client: email, new_zone: zone };
        break;
      }

      case 'create_intervention': {
        const { email, action_type, recommendation, priority } = params;
        const { data, error } = await supabase
          .from('intervention_log')
          .insert({
            client_email: email,
            action_type: action_type || 'agent_triggered',
            recommended_action: recommendation,
            status: 'pending',
            priority: priority || 'medium',
            created_at: new Date().toISOString()
          })
          .select();
        
        if (error) throw error;
        result = { created: true, intervention_id: data?.[0]?.id };
        break;
      }

      case 'update_lead_status': {
        // Using unified schema: contacts table
        const { email, status, notes } = params;
        const { data, error } = await supabase
          .from('contacts')
          .update({ 
            lead_status: status,
            updated_at: new Date().toISOString()
          })
          .eq('email', email)
          .select();
        
        if (error) throw error;
        result = { updated: data?.length || 0, new_status: status };
        break;
      }

      case 'reassign_coach': {
        const { email, new_coach, reason } = params;
        const { data, error } = await supabase
          .from('client_health_scores')
          .update({ 
            assigned_coach: new_coach,
            updated_at: new Date().toISOString()
          })
          .eq('email', email)
          .select();
        
        if (error) throw error;
        result = { updated: data?.length || 0, new_coach, reason };
        break;
      }

      case 'send_alert': {
        const { title, message, priority, target } = params;
        const { data, error } = await supabase
          .from('proactive_insights')
          .insert({
            insight_type: 'agent_alert',
            title,
            description: message,
            priority: priority || 'high',
            source_agent: 'ptd-execute-action',
            is_actionable: true,
            data: { target }
          })
          .select();
        
        if (error) throw error;
        result = { alert_created: true, insight_id: data?.[0]?.id };
        break;
      }

      case 'trigger_sync': {
        const { platform } = params;
        const { data, error } = await supabase.functions.invoke('sync-hubspot-to-supabase', { 
          body: { platform: platform || 'hubspot' } 
        });
        
        result = { sync_triggered: true, response: data };
        break;
      }

      case 'mark_lead_contacted': {
        // Using unified schema: contacts table
        const { email, contact_method, notes } = params;
        const { error } = await supabase
          .from('contacts')
          .update({ 
            lead_status: 'contacted',
            updated_at: new Date().toISOString()
          })
          .eq('email', email);
        
        if (error) throw error;
        result = { marked: true, email, method: contact_method };
        break;
      }

      case 'schedule_followup': {
        const { lead_email, scheduled_at, notes } = params;
        // Store in contact activities as a scheduled task
        const { data, error } = await supabase
          .from('contact_activities')
          .insert({
            activity_type: 'scheduled_followup',
            activity_title: 'Follow-up Scheduled',
            activity_description: notes || 'Agent-scheduled follow-up',
            occurred_at: scheduled_at,
            metadata: { lead_email, scheduled_by: 'unlimited_agent' }
          })
          .select();
        
        if (error) throw error;
        result = { scheduled: true, activity_id: data?.[0]?.id };
        break;
      }

      case 'code_deploy': {
        const { files, commit_message, approval_id } = params;
        const githubToken = Deno.env.get('GITHUB_TOKEN');
        // Default to known repo if env vars missing
        const repoOwner = Deno.env.get('GITHUB_OWNER') || 'milosriki';
        const repoName = Deno.env.get('GITHUB_REPO') || 'client-vital-suite';

        if (!githubToken) throw new Error('GITHUB_TOKEN not configured');

        console.log(`🚀 Triggering GitHub Action for ${repoOwner}/${repoName}`);

        const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/dispatches`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event_type: 'ai-deploy',
            client_payload: {
              files,
              commit_message: commit_message || 'AI Code Deployment',
              approval_id: approval_id || 'manual_trigger'
            }
          })
        });

        if (!response.ok) {
           const errorText = await response.text();
           throw new Error(`GitHub API error: ${response.status} ${errorText}`);
        }

        result = { deployed: true, commit_message, target: `${repoOwner}/${repoName}` };
        break;
      }

      default:
        throw new Error(`Action not implemented: ${action}`);
    }

    // Update request status if from queue
    if (requestKey) {
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
    }

    // Log execution for learning
    await supabase.from('agent_memory').insert({
      thread_id: 'executions',
      query: `Executed: ${action}`,
      response: JSON.stringify(result),
      knowledge_extracted: { action, params, success: true }
    });

    console.log(`✅ Executed successfully: ${action}`);

    return apiSuccess({
      success: true,
      action,
      result
    });

  } catch (error: unknown) {
    console.error(`❌ Execution failed: ${action}`, error);

    // Update request status if from queue
    if (requestKey) {
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
    }

    return apiError("INTERNAL_ERROR", JSON.stringify({
      success: false,
      action,
      error: String(error)
    }), 500);
  }
}
