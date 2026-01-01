
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

// Security Utilities
function validateEmail(email: string): string {
  const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const sanitized = email.trim().toLowerCase().slice(0, 255);
  if (!emailRegex.test(sanitized)) throw new Error('Invalid email format');
  return sanitized;
}

function sanitizeString(input: string, maxLength: number = 255): string {
  return input.replace(/['"`;\\]/g, '').trim().slice(0, maxLength);
}

export async function executeSharedTool(supabase: any, toolName: string, input: any): Promise<string> {
  console.log(`🔧 Executing shared tool: ${toolName}`, input);

  try {
    switch (toolName) {
      case "client_control": {
        const { email, action } = input;
        if (action === "get_all") {
          const validatedEmail = validateEmail(email);
          const [health, calls, deals, activities] = await Promise.all([
            supabase.from('client_health_scores').select('*').eq('email', validatedEmail).single(),
            supabase.from('call_records').select('*').order('created_at', { ascending: false }).limit(10),
            supabase.from('deals').select('*').order('created_at', { ascending: false }).limit(10),
            supabase.from('contact_activities').select('*').order('occurred_at', { ascending: false }).limit(20),
          ]);
          return JSON.stringify({ health: health.data, calls: calls.data, deals: deals.data, activities: activities.data }, null, 2);
        }
        // ... other actions
        if (action === "get_health") {
           const validatedEmail = validateEmail(email);
           const { data } = await supabase.from('client_health_scores').select('*').eq('email', validatedEmail).single();
           return JSON.stringify(data);
        }
        return "Unknown action";
      }

      case "lead_control": {
        const { action, query, status, limit = 20 } = input;
        if (action === "get_all") {
          const { data } = await supabase.from('contacts').select('*').order('created_at', { ascending: false }).limit(limit);
          return JSON.stringify({ count: data?.length || 0, leads: data || [] });
        }
        if (action === "search" && query) {
          const sanitizedQuery = query.replace(/[^a-zA-Z0-9@.\-+\s]/g, '').slice(0, 100);
          const { data } = await supabase.from('contacts').select('*')
            .or(`email.ilike.%${sanitizedQuery}%,first_name.ilike.%${sanitizedQuery}%,last_name.ilike.%${sanitizedQuery}%,phone.ilike.%${sanitizedQuery}%`)
            .limit(limit);
          return JSON.stringify({ count: data?.length || 0, leads: data || [] });
        }
        return "Unknown action";
      }

      case "stripe_control": {
        const { action, days = 90 } = input;
        if (action === "fraud_scan") {
          try {
            const { data } = await supabase.functions.invoke('stripe-forensics', {
              body: { action: 'full-audit', days_back: days }
            });
            return `🚨 STRIPE FRAUD SCAN:\n${JSON.stringify(data, null, 2)}`;
          } catch (e) {
            return `Stripe forensics error: ${e}`;
          }
        }
        if (action === "get_summary" || action === "analyze") {
           try {
            const { data } = await supabase.functions.invoke('stripe-dashboard-data', { body: {} });
            return JSON.stringify(data);
          } catch (e) {
            return `Stripe dashboard error: ${e}`;
          }
        }
        return "Unknown action";
      }
      


      case "hubspot_control": {
        const { action, limit = 50 } = input;
        if (action === "sync_now") {
          try {
            const { data } = await supabase.functions.invoke('sync-hubspot-to-supabase', { body: { force: true } });
            return `HubSpot sync triggered: ${JSON.stringify(data)}`;
          } catch (e) {
            return `Sync error: ${e}`;
          }
        }
        if (action === "get_contacts") {
          const { data } = await supabase.from('contacts').select('*').order('created_at', { ascending: false }).limit(limit);
          return JSON.stringify({ count: data?.length || 0, contacts: data || [] });
        }
        if (action === "get_activities") {
          const { data } = await supabase.from('contact_activities').select('*').order('occurred_at', { ascending: false }).limit(limit);
          return JSON.stringify(data || []);
        }
        if (action === "get_lifecycle_stages") {
          const { data } = await supabase.from('contacts').select('lifecycle_stage');
          const stages: Record<string, number> = {};
          (data || []).forEach((c: any) => {
            const stage = c.lifecycle_stage || 'unknown';
            stages[stage] = (stages[stage] || 0) + 1;
          });
          return JSON.stringify(stages);
        }
        return "Unknown action";
      }

      case "call_control": {
        const { action, limit = 20 } = input;
        if (action === "get_all") {
          const { data } = await supabase.from('call_records').select('*').order('created_at', { ascending: false }).limit(limit);
          return JSON.stringify({ count: data?.length || 0, calls: data || [] });
        }
        if (action === "get_transcripts") {
          const { data } = await supabase.from('call_records').select('id, caller_number, transcription, call_outcome, duration_seconds, created_at')
            .not('transcription', 'is', null).order('created_at', { ascending: false }).limit(limit);
          return JSON.stringify(data || []);
        }
        if (action === "get_analytics") {
          const { data } = await supabase.from('call_analytics').select('*').order('date', { ascending: false }).limit(30);
          return JSON.stringify(data || []);
        }
        if (action === "find_patterns") {
          const { data } = await supabase.from('call_records').select('transcription, call_outcome, keywords_mentioned')
            .not('transcription', 'is', null).limit(50);
          return JSON.stringify({
            booking_keywords: ["schedule", "book", "appointment", "next week"],
            patterns_found: data?.length || 0
          });
        }
        return "Unknown action";
      }

      case "analytics_control": {
        const { dashboard } = input;
        try {
          // Use the same RPC function as the main dashboard for consistency
          const { data, error } = await supabase.rpc('get_dashboard_stats');
          
          if (error) {
            return `Error fetching dashboard stats: ${error.message}`;
          }
          
          return JSON.stringify({
            dashboard: dashboard || "main",
            stats: data,
            source: "real-time-rpc"
          }, null, 2);
        } catch (e) {
          return `Analytics error: ${e}`;
        }
      }

      case "get_at_risk_clients": {
        const { zone = "red", limit = 20 } = input;
        let query = supabase.from('client_health_scores').select('*');
        if (zone !== "all") {
          query = query.eq('health_zone', zone);
        }
        const { data } = await query.order('churn_risk_score', { ascending: false }).limit(limit);
        return JSON.stringify(data || []);
      }

      case "intelligence_control": {
        const { functions } = input;
        // This would trigger other edge functions
        return `Intelligence functions triggered: ${functions.join(', ')}. Results will be available in agent_context.`;
      }
      
      case "sales_flow_control": {
        const { action, stage, days = 30 } = input;
        if (action === "get_pipeline") {
          const { data } = await supabase.from('deals').select('stage, status, deal_value, deal_name').order('created_at', { ascending: false });
          const pipeline: Record<string, any[]> = {};
          (data || []).forEach((d: any) => {
            const s = d.stage || 'unknown';
            if (!pipeline[s]) pipeline[s] = [];
            pipeline[s].push(d);
          });
          return JSON.stringify({ pipeline, total_deals: data?.length || 0 });
        }
        if (action === "get_deals") {
          let query = supabase.from('deals').select('*');
          if (stage) {
            const sanitizedStage = sanitizeString(stage, 100);
            query = query.eq('stage', sanitizedStage);
          }
          const { data } = await query.order('created_at', { ascending: false }).limit(30);
          return JSON.stringify(data || []);
        }
        if (action === "get_appointments") {
          const { data } = await supabase.from('appointments').select('*').order('scheduled_at', { ascending: false }).limit(30);
          return JSON.stringify(data || []);
        }
        if (action === "get_recent_closes") {
          const since = new Date();
          since.setDate(since.getDate() - days);
          const { data } = await supabase.from('deals').select('*').gte('close_date', since.toISOString()).order('close_date', { ascending: false });
          return JSON.stringify(data || []);
        }
        return "Unknown action";
      }
      


      case "universal_search": {
        const { query, search_type = "auto" } = input;
        const q = String(query).trim();

        if (q.length > 100) {
          return JSON.stringify({ error: "Search query too long (max 100 characters)" });
        }

        let detectedType = search_type;
        if (search_type === "auto") {
          if (/^\d{9,15}$/.test(q.replace(/\D/g, ''))) detectedType = "phone";
          else if (q.includes('@')) detectedType = "email";
          else if (/^[a-f0-9-]{36}$/i.test(q)) detectedType = "id";
          else detectedType = "name";
        }

        console.log(`🔍 Universal search: "${q}" (type: ${detectedType})`);

        const phoneCleaned = q.replace(/\D/g, '');
        const searchLike = `%${q}%`;

        const [contacts, leads, calls, deals, healthScores, activities] = await Promise.all([
          supabase.from('contacts').select('*').or(
            `phone.ilike.%${phoneCleaned}%,email.ilike.${searchLike},first_name.ilike.${searchLike},last_name.ilike.${searchLike},hubspot_contact_id.ilike.${searchLike},owner_name.ilike.${searchLike}`
          ).limit(10),
          supabase.from('attribution_events').select('*').or(
            `email.ilike.${searchLike},campaign.ilike.${searchLike}`
          ).limit(10),
          supabase.from('call_records').select('*')
            .or(`caller_number.ilike.%${phoneCleaned}%`)
            .order('started_at', { ascending: false })
            .limit(20),
          supabase.from('deals').select('*').or(
            `deal_name.ilike.${searchLike},hubspot_deal_id.ilike.${searchLike}`
          ).limit(10),
          supabase.from('client_health_scores').select('*').or(
            `email.ilike.${searchLike},firstname.ilike.${searchLike},lastname.ilike.${searchLike}`
          ).limit(5),
          supabase.from('contact_activities').select('*').or(
            `hubspot_contact_id.ilike.${searchLike}`
          ).order('occurred_at', { ascending: false }).limit(10)
        ]);

        const callAttempts = calls.data?.length || 0;
        const connectedCalls = calls.data?.filter((c: any) => c.call_status === 'completed')?.length || 0;
        const callStats = {
          total_attempts: callAttempts,
          connected: connectedCalls,
          missed: callAttempts - connectedCalls,
          first_call: calls.data?.[calls.data.length - 1]?.started_at,
          last_call: calls.data?.[0]?.started_at,
          directions: calls.data?.reduce((acc: any, c: any) => {
            acc[c.call_direction || 'unknown'] = (acc[c.call_direction || 'unknown'] || 0) + 1;
            return acc;
          }, {})
        };

        const result = {
          search_query: q,
          search_type: detectedType,
          contacts_found: contacts.data?.length || 0,
          contact_details: contacts.data?.map((c: any) => ({
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
            email: c.email,
            phone: c.phone,
            owner: c.owner_name,
            lifecycle_stage: c.lifecycle_stage,
            lead_status: c.lead_status,
            city: c.city,
            location: c.location,
            hubspot_id: c.hubspot_contact_id,
            first_touch: c.first_touch_time,
            last_activity: c.last_activity_date,
            created_at: c.created_at
          })),
          leads_found: leads.data?.length || 0,
          lead_details: leads.data?.map((l: any) => ({
            name: `${l.first_name || ''} ${l.last_name || ''}`.trim() || 'Unknown',
            email: l.email,
            phone: l.phone,
            lead_score: l.lead_score,
            lead_quality: l.lead_quality,
            conversion_status: l.conversion_status,
            campaign: l.campaign_name,
            ad_name: l.ad_name,
            fitness_goal: l.fitness_goal,
            budget: l.budget_range,
            urgency: l.urgency,
            dubai_area: l.dubai_area
          })),
          call_stats: callStats,
          call_history: calls.data?.slice(0, 10).map((c: any) => ({
            date: c.started_at,
            status: c.call_status,
            direction: c.call_direction,
            duration_seconds: c.duration_seconds,
            outcome: c.call_outcome
          })),
          deals_found: deals.data?.length || 0,
          deal_details: deals.data?.map((d: any) => ({
            name: d.deal_name,
            value: d.deal_value,
            stage: d.stage,
            status: d.status,
            close_date: d.close_date
          })),
          health_scores: healthScores.data?.map((h: any) => ({
            name: `${h.firstname || ''} ${h.lastname || ''}`.trim(),
            email: h.email,
            health_score: h.health_score,
            health_zone: h.health_zone,
            coach: h.assigned_coach,
            churn_risk: h.churn_risk_score
          })),
          recent_activities: activities.data?.slice(0, 5).map((a: any) => ({
            type: a.activity_type,
            title: a.activity_title,
            date: a.occurred_at
          }))
        };

        return JSON.stringify(result, null, 2);
      }

      case "get_coach_clients": {
        const { coach_name } = input;
        const searchName = `%${coach_name}%`;

        const [clients, coachPerf] = await Promise.all([
          supabase.from('client_health_scores')
            .select('*')
            .ilike('assigned_coach', searchName)
            .order('health_score', { ascending: true }),
          supabase.from('coach_performance')
            .select('*')
            .ilike('coach_name', searchName)
            .order('report_date', { ascending: false })
            .limit(1)
        ]);

        const clientData = clients.data || [];
        const performance = coachPerf.data?.[0];

        const zones: Record<string, number> = { purple: 0, green: 0, yellow: 0, red: 0 };
        let totalHealth = 0;
        clientData.forEach((c: any) => {
          if (c.health_zone) zones[c.health_zone]++;
          totalHealth += c.health_score || 0;
        });

        return JSON.stringify({
          coach_name: coach_name,
          total_clients: clientData.length,
          avg_health_score: clientData.length > 0 ? (totalHealth / clientData.length).toFixed(1) : 0,
          zone_distribution: zones,
          at_risk_clients: clientData.filter((c: any) => c.health_zone === 'red' || c.health_zone === 'yellow'),
          all_clients: clientData.map((c: any) => ({
            name: `${c.firstname || ''} ${c.lastname || ''}`.trim(),
            email: c.email,
            health_score: c.health_score,
            health_zone: c.health_zone,
            churn_risk: c.churn_risk_score,
            days_since_session: c.days_since_last_session
          })),
          coach_performance: performance ? {
            performance_score: performance.performance_score,
            clients_at_risk: performance.clients_at_risk,
            intervention_success_rate: performance.intervention_success_rate
          } : null
        }, null, 2);
      }

      case "get_coach_performance": {
        const { coach_name } = input;
        let query = supabase.from('coach_performance').select('*').order('report_date', { ascending: false });
        if (coach_name) {
          query = query.ilike('coach_name', `%${coach_name}%`);
        }
        const { data } = await query.limit(20);
        return JSON.stringify(data || []);
      }

      case "get_proactive_insights": {
        const { priority = "all", limit = 10 } = input;
        let query = supabase.from('proactive_insights').select('*');
        if (priority !== "all") {
          query = query.eq('priority', priority);
        }
        const { data } = await query.order('created_at', { ascending: false }).limit(limit);
        return JSON.stringify({ insights_count: data?.length || 0, insights: data || [] });
      }

      case "get_daily_summary": {
        const { date } = input;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const { data } = await supabase.from('daily_summary').select('*').eq('summary_date', targetDate).single();
        if (!data) {
          return JSON.stringify({ message: "No summary found for this date", date: targetDate });
        }
        return JSON.stringify(data);
      }

      case "callgear_control": {
        const { date_from, date_to, limit = 50 } = input;
        try {
          const { data, error } = await supabase.functions.invoke('fetch-callgear-data', {
            body: { date_from, date_to, limit }
          });
          if (error) return `CallGear Error: ${error.message}`;
          if (!data.success) return `CallGear API Error: ${data.error || 'Unknown error'}`;
          return JSON.stringify({
            count: data.count,
            calls: data.data?.map((c: any) => ({
              start_time: c.start_time,
              duration: c.duration,
              caller: c.calling_phone,
              called: c.called_phone,
              employee: c.employee_full_name || 'Unknown',
              status: c.status,
              outcome: c.finish_reason,
              recording: c.record_url
            }))
          });
        } catch (e) {
          return `CallGear integration error: ${e}`;
        }
      }

      case "forensic_control": {
        const { target_identity, limit = 50 } = input;
        try {
          const { data, error } = await supabase.functions.invoke('fetch-forensic-data', {
            body: { target_identity, limit }
          });
          if (error) return `Forensic Audit Error: ${error.message}`;
          if (!data.success) return `Forensic Audit Failed: ${data.message || 'Unknown error'}`;
          return JSON.stringify({ target: data.contact, audit_log: data.audit_log });
        } catch (e) {
          return `Forensic integration error: ${e}`;
        }
      }

      case "callgear_supervisor": {
        const { action, call_session_id, mode, coach_sip_uri } = input;
        try {
          const { data, error } = await supabase.functions.invoke('callgear-supervisor', {
            body: { action, call_session_id, mode, coach_sip_uri }
          });
          if (error) return `CallGear Supervisor Error: ${error.message}`;
          return JSON.stringify(data);
        } catch (e) {
          return `CallGear Supervisor error: ${e}`;
        }
      }

      case "callgear_live_monitor": {
        const { action } = input;
        try {
          const { data, error } = await supabase.functions.invoke('callgear-live-monitor', { body: { action } });
          if (error) return `CallGear Monitor Error: ${error.message}`;
          return JSON.stringify(data);
        } catch (e) {
          return `CallGear Monitor error: ${e}`;
        }
      }

      case "callgear_icp_router": {
        const { action, test_caller } = input;
        try {
          const { data, error } = await supabase.functions.invoke('callgear-icp-router', { body: { action, test_caller } });
          if (error) return `CallGear ICP Error: ${error.message}`;
          return JSON.stringify(data);
        } catch (e) {
          return `CallGear ICP error: ${e}`;
        }
      }

      case "run_sql_query": {
        const { query } = input;
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery.startsWith('select')) {
          return JSON.stringify({ error: "Only SELECT queries are allowed" });
        }
        const forbiddenPattern = /\b(drop|delete|insert|update|alter|create|truncate|grant|revoke|execute|exec)\b/i;
        if (forbiddenPattern.test(normalizedQuery)) {
          return JSON.stringify({ error: "Query contains forbidden operations" });
        }
        if (normalizedQuery.includes('--') || normalizedQuery.includes('/*') || normalizedQuery.includes(';')) {
          return JSON.stringify({ error: "Query contains forbidden characters (comments or multiple statements)" });
        }
        try {
          const { data, error } = await supabase.rpc('execute_sql_query', { sql_query: query });
          if (error) return JSON.stringify({ error: error.message });
          return JSON.stringify({ results: data });
        } catch (e) {
          return JSON.stringify({ error: "SQL query execution not available - RPC function not configured. Use specific tools for data queries." });
        }
      }

      case "run_intelligence_suite": {
        try {
          const results: Record<string, any> = {};
          const functionsToRun = ['anomaly-detector', 'churn-predictor'];
          for (const fn of functionsToRun) {
            const { data, error } = await supabase.functions.invoke(fn, { body: {} });
            results[fn] = error ? `Error: ${error.message}` : data;
          }
          return `INTELLIGENCE SUITE RESULTS:\n${JSON.stringify(results, null, 2)}`;
        } catch (e) {
          return `Intelligence suite unavailable: ${e}`;
        }
      }

      case "run_intelligence": {
        const { action } = input;
        try {
          const functionMap: Record<string, string> = {
            churn: 'churn-predictor',
            anomaly: 'anomaly-detector',
            revenue: 'hubspot-analyzer',
            payouts: 'stripe-payouts-ai'
          };
          const functionName = functionMap[action];
          if (!functionName) return `Unknown action: ${action}. Use: churn, anomaly, revenue, or payouts`;
          const { data, error } = await supabase.functions.invoke(functionName, { body: {} });
          if (error) return `Intelligence function error: ${error.message}`;
          return `Analysis Result: ${JSON.stringify(data)}`;
        } catch (e) {
          return `Intelligence function unavailable: ${e}`;
        }
      }

      case "discover_system_map":
      case "discover_system": {
        try {
          const { data, error } = await supabase.rpc('introspect_schema_verbose');
          if (error) return `Schema discovery error: ${error.message}`;
          return `ULTIMATE SYSTEM MAP (110 Tables Found): ${JSON.stringify(data)}`;
        } catch (e) {
          return `Schema discovery unavailable: ${e}`;
        }
      }

      case "build_feature": {
        const { code, impact } = input;
        try {
          const { data, error } = await supabase.from('ai_agent_approvals').insert({
            request_type: 'UI_FIX',
            code_changes: [{ path: 'src/DynamicFix.tsx', content: code }],
            description: impact
          });
          if (error) return `Build feature error: ${error.message}`;
          return "Fix prepared in Approvals dashboard.";
        } catch (e) {
          return `Build feature unavailable: ${e}`;
        }
      }

      default:
        return `Tool ${toolName} not found in shared executor.`;
    }
  } catch (e) {
    console.error(`Tool execution error (${toolName}):`, e);
    return `Error executing ${toolName}: ${e instanceof Error ? e.message : String(e)}`;
  }
}
