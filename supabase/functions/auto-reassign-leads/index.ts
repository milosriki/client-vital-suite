import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === 'OPTIONS') return apiCorsPreFlight();

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    
    // 1. Find leads needing reassignment (Stale for 48h, except Closed Won)
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    const { data: staleLeads } = await supabase
      .from('contacts')
      .select('id, email, owner_name, lifecycle_stage, lead_status, created_at, updated_at')
      .neq('lifecycle_stage', 'customer')
      .lt('updated_at', fortyEightHoursAgo)
      .limit(20);

    const proposals = [];

    // 2. Analyze follow-up patterns (Aggressive 5-call rule)
    for (const lead of (staleLeads || [])) {
      const { count: callCount } = await supabase
        .from('call_records')
        .select('id', { count: 'exact', head: true })
        .ilike('caller_number', `%${lead.phone}%`); // Basic match

      if (callCount < 5) {
        proposals.push({
          type: 'REASSIGNMENT_PROPOSAL',
          contact_id: lead.id,
          email: lead.email,
          current_owner: lead.owner_name,
          reason: `UNDER-WORKED: Only ${callCount} calls made in 48h. Protocol requires 5+ attempts.`,
          risk_level: 'high'
        });
      }
    }

    // 3. Instead of direct update, write to Approvals Table
    if (proposals.length > 0) {
      for (const prop of proposals) {
        await supabase.from('ai_agent_approvals').insert({
          request_type: 'LEAD_REASSIGNMENT',
          description: prop.reason,
          metadata: prop,
          status: 'pending'
        });
      }
    }

    return apiSuccess({
      success: true,
      proposals_created: proposals.length,
      message: `${proposals.length} reassignments queued for CEO approval.`
    });

  } catch (error: unknown) {
    return apiError("INTERNAL_ERROR", JSON.stringify({ error: error.message }), 500);
  }
});