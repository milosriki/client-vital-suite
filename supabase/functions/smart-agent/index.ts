/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { buildAgentPrompt } from "../_shared/unified-prompts.ts";
import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= TOOL DEFINITIONS =============
const tools = [
  // TOOL 1: Client Control - Full client data access
  {
    type: "function",
    function: {
      name: "client_control",
      description: "Full client control - get all data, update records, track journey. Gets health scores, calls, deals, activities for a client.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Client email address" },
          action: { 
            type: "string", 
            enum: ["get_all", "get_health", "get_calls", "get_deals", "get_activities"],
            description: "Action to perform"
          }
        },
        required: ["email", "action"]
      }
    }
  },
  // TOOL 2: Lead Control - Lead management
  {
    type: "function",
    function: {
      name: "lead_control",
      description: "Control leads - get all leads, search leads, get lead scores, get enhanced lead data",
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["get_all", "search", "get_enhanced", "get_by_status"],
            description: "Action to perform"
          },
          query: { type: "string", description: "Search query for lead name/email/phone" },
          status: { type: "string", description: "Lead status filter" },
          limit: { type: "number", description: "Max results (default 20)" }
        },
        required: ["action"]
      }
    }
  },
  // TOOL 3: Sales Flow Control
  {
    type: "function",
    function: {
      name: "sales_flow_control",
      description: "Control sales flow - track deals, pipeline stages, appointments",
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["get_pipeline", "get_deals", "get_appointments", "get_recent_closes"],
            description: "Action to perform"
          },
          email: { type: "string", description: "Optional: filter by client email" },
          stage: { type: "string", description: "Optional: filter by pipeline stage" },
          days: { type: "number", description: "Days back to look (default 30)" }
        },
        required: ["action"]
      }
    }
  },
  // TOOL 4: HubSpot Control
  {
    type: "function",
    function: {
      name: "hubspot_control",
      description: "Control HubSpot - sync data, get contacts, track activities",
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["sync_now", "get_contacts", "get_activities", "get_lifecycle_stages"],
            description: "Action to perform"
          },
          limit: { type: "number", description: "Max results" }
        },
        required: ["action"]
      }
    }
  },
  // TOOL 5: Stripe Control
  {
    type: "function",
    function: {
      name: "stripe_control",
      description: "Control Stripe - fraud scan, get payment history, analyze transactions",
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["fraud_scan", "get_summary", "get_events", "analyze"],
            description: "Action to perform"
          },
          days: { type: "number", description: "Days back to analyze (default 90)" }
        },
        required: ["action"]
      }
    }
  },
  // TOOL 6: Call Control
  {
    type: "function",
    function: {
      name: "call_control",
      description: "Control calls - get call records, transcripts, analytics, find patterns",
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["get_all", "get_transcripts", "get_analytics", "find_patterns"],
            description: "Action to perform"
          },
          caller_number: { type: "string", description: "Optional: filter by caller number" },
          limit: { type: "number", description: "Max results (default 20)" }
        },
        required: ["action"]
      }
    }
  },
  // TOOL 7: Intelligence Functions Control
  {
    type: "function",
    function: {
      name: "intelligence_control",
      description: "Run AI intelligence functions - churn predictor, anomaly detector, coach analyzer, etc.",
      parameters: {
        type: "object",
        properties: {
          functions: { 
            type: "array", 
            items: { type: "string" },
            description: "Functions to run. Options: churn-predictor, anomaly-detector, intervention-recommender, coach-analyzer, data-quality, capi-validator, integration-health, pipeline-monitor, business-intelligence, proactive-insights-generator"
          }
        }
      }
    }
  },
  // TOOL 8: Analytics Control
  {
    type: "function",
    function: {
      name: "analytics_control",
      description: "Get dashboards and analytics - health zones, revenue, coaches, interventions",
      parameters: {
        type: "object",
        properties: {
          dashboard: { 
            type: "string", 
            enum: ["health", "revenue", "coaches", "interventions", "campaigns", "attribution"],
            description: "Dashboard to retrieve"
          }
        },
        required: ["dashboard"]
      }
    }
  },
  // TOOL 9: At Risk Clients
  {
    type: "function",
    function: {
      name: "get_at_risk_clients",
      description: "Get clients at risk of churning (health_zone = 'red' or 'yellow')",
      parameters: {
        type: "object",
        properties: {
          zone: { type: "string", enum: ["red", "yellow", "all"], description: "Filter by zone" },
          limit: { type: "number", description: "Max results (default 20)" }
        }
      }
    }
  },
  // TOOL 10: Coach Performance
  {
    type: "function",
    function: {
      name: "get_coach_performance",
      description: "Get performance metrics for coaches",
      parameters: {
        type: "object",
        properties: {
          coach_name: { type: "string", description: "Optional: specific coach name" }
        }
      }
    }
  },
  // TOOL 11: Proactive Insights
  {
    type: "function",
    function: {
      name: "get_proactive_insights",
      description: "Get AI-generated proactive insights and recommendations",
      parameters: {
        type: "object",
        properties: {
          priority: { type: "string", enum: ["critical", "high", "medium", "low", "all"] },
          limit: { type: "number", description: "Max results (default 10)" }
        }
      }
    }
  },
  // TOOL 12: Daily Summary
  {
    type: "function",
    function: {
      name: "get_daily_summary",
      description: "Get business intelligence summary for a date",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date in YYYY-MM-DD format (default: today)" }
        }
      }
    }
  },
  // TOOL 13: SQL Query (read-only)
  {
    type: "function",
    function: {
      name: "run_sql_query",
      description: "Run a read-only SQL query for complex data retrieval. Only SELECT allowed.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "SQL SELECT query (read-only)" }
        },
        required: ["query"]
      }
    }
  },
  // TOOL 14: Universal Search
  {
    type: "function",
    function: {
      name: "universal_search",
      description: "POWERFUL SEARCH - Find any person/lead/contact by phone number, name, email, ID, owner name, campaign, etc. Returns full enriched profile with all calls, deals, activities, owner info, location, campaign data. USE THIS for any search query.",
      parameters: {
        type: "object",
        properties: {
          query: { 
            type: "string", 
            description: "Search term - phone number, name, email, contact ID, HubSpot ID, owner name, campaign name, any identifier" 
          },
          search_type: { 
            type: "string", 
            enum: ["auto", "phone", "email", "name", "id", "owner", "campaign"],
            description: "Type of search (default: auto-detect from query)"
          },
        },
        required: ["query"],
      },
    },
  },
  // TOOL 15: Get Coach Clients
  {
    type: "function",
    function: {
      name: "get_coach_clients",
      description: "Get all clients for a specific coach by name. Returns client health scores, at-risk clients, and performance data.",
      parameters: {
        type: "object",
        properties: {
          coach_name: { 
            type: "string", 
            description: "Coach name (partial match supported) - e.g. 'Mathew', 'Marko', 'Ahmed'" 
          },
        },
        required: ["coach_name"],
      },
    },
  },
  // TOOL 16: CallGear Control
  {
    type: "function",
    function: {
      name: "callgear_control",
      description: "Get FULL call analytics from CallGear, including employee names, call durations, and recordings. Use this when user asks for 'who called', 'employee names', or detailed call reports.",
      parameters: {
        type: "object",
        properties: {
          date_from: { type: "string", description: "Start date (YYYY-MM-DD)" },
          date_to: { type: "string", description: "End date (YYYY-MM-DD)" },
          limit: { type: "number", description: "Max results (default 50)" }
        }
      }
    }
  },
  // TOOL 17: Forensic Control
  {
    type: "function",
    function: {
      name: "forensic_control",
      description: "AUDIT LOG & FORENSICS - Track WHO changed WHAT and WHEN in HubSpot. Use this to investigate changes to contacts, deals, or settings. Returns a timeline of property changes.",
      parameters: {
        type: "object",
        properties: {
          target_identity: { type: "string", description: "Email, Phone, or HubSpot ID to investigate" },
          limit: { type: "number", description: "Max log entries (default 50)" }
        },
        required: ["target_identity"]
      }
    }
  }
];

// ============= TOOL EXECUTION =============
async function executeTool(supabase: any, toolName: string, args: any): Promise<string> {
  console.log(`Executing tool: ${toolName}`, args);
  
  try {
    switch (toolName) {
      // TOOL 1: Client Control
      case "client_control": {
        const email = args.email;
        
        if (args.action === "get_all") {
          const [health, calls, deals, activities] = await Promise.all([
            supabase.from('client_health_scores').select('*').eq('email', email).single(),
            supabase.from('call_records').select('*').limit(10),
            supabase.from('deals').select('*').limit(10),
            supabase.from('contact_activities').select('*').limit(20)
          ]);
          
          return JSON.stringify({
            health: health.data,
            recent_calls: calls.data,
            deals: deals.data,
            activities: activities.data
          }, null, 2);
        }
        
        if (args.action === "get_health") {
          const { data, error } = await supabase
            .from('client_health_scores')
            .select('*')
            .eq('email', email)
            .single();
          if (error) throw error;
          return JSON.stringify(data);
        }
        
        if (args.action === "get_calls") {
          const { data } = await supabase.from('call_records').select('*').order('created_at', { ascending: false }).limit(20);
          return JSON.stringify(data || []);
        }
        
        if (args.action === "get_deals") {
          const { data } = await supabase.from('deals').select('*').order('created_at', { ascending: false }).limit(20);
          return JSON.stringify(data || []);
        }
        
        if (args.action === "get_activities") {
          const { data } = await supabase.from('contact_activities').select('*').order('occurred_at', { ascending: false }).limit(30);
          return JSON.stringify(data || []);
        }
        
        return "Unknown client_control action";
      }
      
      // TOOL 2: Lead Control (Using unified schema: contacts table)
      case "lead_control": {
        if (args.action === "get_all") {
          const { data } = await supabase
            .from('contacts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(args.limit || 20);
          return JSON.stringify({ count: data?.length || 0, leads: data || [] });
        }
        
        if (args.action === "search" && args.query) {
          const searchTerm = `%${args.query}%`;
          const { data } = await supabase
            .from('contacts')
            .select('*')
            .or(`email.ilike.${searchTerm},first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},phone.ilike.${searchTerm}`)
            .limit(args.limit || 10);
          return JSON.stringify({ count: data?.length || 0, leads: data || [] });
        }
        
        if (args.action === "get_enhanced") {
          const { data } = await supabase
            .from('contacts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(args.limit || 20);
          return JSON.stringify(data || []);
        }
        
        if (args.action === "get_by_status") {
          const { data } = await supabase
            .from('contacts')
            .select('*')
            .eq('lead_status', args.status || 'new')
            .limit(args.limit || 20);
          return JSON.stringify(data || []);
        }
        
        return "Unknown lead_control action";
      }
      
      // TOOL 3: Sales Flow Control
      case "sales_flow_control": {
        if (args.action === "get_pipeline") {
          const { data } = await supabase
            .from('deals')
            .select('stage, status, deal_value, deal_name')
            .order('created_at', { ascending: false });
          
          // Group by stage
          const pipeline: Record<string, any[]> = {};
          (data || []).forEach((d: any) => {
            const stage = d.stage || 'unknown';
            if (!pipeline[stage]) pipeline[stage] = [];
            pipeline[stage].push(d);
          });
          
          return JSON.stringify({ pipeline, total_deals: data?.length || 0 });
        }
        
        if (args.action === "get_deals") {
          let query = supabase.from('deals').select('*');
          if (args.stage) query = query.eq('stage', args.stage);
          const { data } = await query.order('created_at', { ascending: false }).limit(30);
          return JSON.stringify(data || []);
        }
        
        if (args.action === "get_appointments") {
          const { data } = await supabase
            .from('appointments')
            .select('*')
            .order('scheduled_at', { ascending: false })
            .limit(30);
          return JSON.stringify(data || []);
        }
        
        if (args.action === "get_recent_closes") {
          const daysBack = args.days || 30;
          const since = new Date();
          since.setDate(since.getDate() - daysBack);
          
          const { data } = await supabase
            .from('deals')
            .select('*')
            .gte('close_date', since.toISOString())
            .order('close_date', { ascending: false });
          return JSON.stringify(data || []);
        }
        
        return "Unknown sales_flow_control action";
      }
      
      // TOOL 4: HubSpot Control
      case "hubspot_control": {
        if (args.action === "sync_now") {
          try {
            const { data } = await supabase.functions.invoke('sync-hubspot-to-supabase', { body: { force: true } });
            return `HubSpot sync triggered: ${JSON.stringify(data)}`;
          } catch (e) {
            return `Sync function error: ${e}`;
          }
        }
        
        if (args.action === "get_contacts") {
          const { data } = await supabase
            .from('contacts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(args.limit || 50);
          return JSON.stringify({ count: data?.length || 0, contacts: data || [] });
        }
        
        if (args.action === "get_activities") {
          const { data } = await supabase
            .from('contact_activities')
            .select('*')
            .order('occurred_at', { ascending: false })
            .limit(args.limit || 50);
          return JSON.stringify(data || []);
        }
        
        if (args.action === "get_lifecycle_stages") {
          const { data } = await supabase.from('contacts').select('lifecycle_stage');
          const stages: Record<string, number> = {};
          (data || []).forEach((c: any) => {
            const stage = c.lifecycle_stage || 'unknown';
            stages[stage] = (stages[stage] || 0) + 1;
          });
          return JSON.stringify(stages);
        }
        
        return "Unknown hubspot_control action";
      }
      
      // TOOL 5: Stripe Control
      case "stripe_control": {
        if (args.action === "fraud_scan") {
          try {
            const { data } = await supabase.functions.invoke('stripe-forensics', {
              body: { action: 'full-audit', days_back: args.days || 90 }
            });
            return `FRAUD SCAN RESULTS:\n${JSON.stringify(data, null, 2)}`;
          } catch (e) {
            return `Stripe forensics error: ${e}`;
          }
        }
        
        if (args.action === "get_summary" || args.action === "analyze") {
          try {
            const { data } = await supabase.functions.invoke('stripe-dashboard-data', { body: {} });
            return JSON.stringify(data);
          } catch (e) {
            return `Stripe dashboard error: ${e}`;
          }
        }
        
        if (args.action === "get_events") {
          const { data } = await supabase
            .from('events')
            .select('*')
            .order('event_time', { ascending: false })
            .limit(50);
          return JSON.stringify(data || []);
        }
        
        return "Unknown stripe_control action";
      }
      
      // TOOL 6: Call Control
      case "call_control": {
        if (args.action === "get_all") {
          const { data } = await supabase
            .from('call_records')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(args.limit || 20);
          return JSON.stringify({ count: data?.length || 0, calls: data || [] });
        }
        
        if (args.action === "get_transcripts") {
          const { data } = await supabase
            .from('call_records')
            .select('id, caller_number, transcription, call_outcome, duration_seconds, created_at')
            .not('transcription', 'is', null)
            .order('created_at', { ascending: false })
            .limit(args.limit || 10);
          return JSON.stringify(data || []);
        }
        
        if (args.action === "get_analytics") {
          const { data } = await supabase
            .from('call_analytics')
            .select('*')
            .order('date', { ascending: false })
            .limit(30);
          return JSON.stringify(data || []);
        }
        
        if (args.action === "find_patterns") {
          const { data } = await supabase
            .from('call_records')
            .select('transcription, call_outcome, keywords_mentioned')
            .not('transcription', 'is', null)
            .limit(50);
          
          const patterns = {
            booking_keywords: ["schedule", "book", "appointment", "next week", "available"],
            objection_keywords: ["expensive", "think about", "later", "not sure"],
            closing_keywords: ["ready", "sign up", "let's do it", "start"],
            calls_analyzed: data?.length || 0
          };
          
          return JSON.stringify(patterns);
        }
        
        return "Unknown call_control action";
      }
      
      // TOOL 7: Intelligence Functions Control
      case "intelligence_control": {
        const allFunctions = [
          "churn-predictor", "anomaly-detector", "intervention-recommender",
          "coach-analyzer", "data-quality", "capi-validator", 
          "integration-health", "pipeline-monitor", "business-intelligence",
          "proactive-insights-generator"
        ];
        
        const toRun = args.functions?.length > 0 ? args.functions : allFunctions.slice(0, 3);
        const results: Record<string, any> = {};
        
        for (const fn of toRun) {
          try {
            const { data, error } = await supabase.functions.invoke(fn, { body: {} });
            results[fn] = error ? `Error: ${error.message}` : data;
          } catch (e) {
            results[fn] = `Error: ${e}`;
          }
        }
        
        return `INTELLIGENCE FUNCTIONS RESULTS:\n${JSON.stringify(results, null, 2)}`;
      }
      
      // TOOL 8: Analytics Control
      case "analytics_control": {
        if (args.dashboard === "health") {
          const { data } = await supabase.from('client_health_scores').select('health_zone, health_score');
          const zones: Record<string, { count: number; avg_score: number; scores: number[] }> = {};
          
          (data || []).forEach((c: any) => {
            const zone = c.health_zone || 'unknown';
            if (!zones[zone]) zones[zone] = { count: 0, avg_score: 0, scores: [] };
            zones[zone].count++;
            if (c.health_score) zones[zone].scores.push(c.health_score);
          });
          
          Object.keys(zones).forEach(z => {
            const scores = zones[z].scores;
            zones[z].avg_score = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
            delete (zones[z] as any).scores;
          });
          
          return JSON.stringify({ health_distribution: zones, total_clients: data?.length || 0 });
        }
        
        if (args.dashboard === "revenue") {
          const { data } = await supabase
            .from('daily_summary')
            .select('*')
            .order('summary_date', { ascending: false })
            .limit(30);
          return JSON.stringify(data || []);
        }
        
        if (args.dashboard === "coaches") {
          const { data } = await supabase
            .from('coach_performance')
            .select('*')
            .order('report_date', { ascending: false })
            .limit(20);
          return JSON.stringify(data || []);
        }
        
        if (args.dashboard === "interventions") {
          const { data } = await supabase
            .from('intervention_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30);
          return JSON.stringify(data || []);
        }
        
        if (args.dashboard === "campaigns") {
          const { data } = await supabase
            .from('campaign_performance')
            .select('*')
            .order('date', { ascending: false })
            .limit(30);
          return JSON.stringify(data || []);
        }
        
        if (args.dashboard === "attribution") {
          const { data } = await supabase
            .from('attribution_events')
            .select('*')
            .order('event_time', { ascending: false })
            .limit(50);
          return JSON.stringify(data || []);
        }
        
        return "Unknown dashboard";
      }
      
      // TOOL 9: At Risk Clients
      case "get_at_risk_clients": {
        let query = supabase.from('client_health_scores').select('*');
        
        if (args.zone === 'red') {
          query = query.eq('health_zone', 'red');
        } else if (args.zone === 'yellow') {
          query = query.eq('health_zone', 'yellow');
        } else {
          query = query.in('health_zone', ['red', 'yellow']);
        }
        
        const { data, error } = await query
          .order('health_score', { ascending: true })
          .limit(args.limit || 20);
        
        if (error) throw error;
        return JSON.stringify({ count: data?.length || 0, clients: data || [] });
      }
      
      // TOOL 10: Coach Performance
      case "get_coach_performance": {
        let query = supabase.from('coach_performance').select('*');
        
        if (args.coach_name) {
          query = query.ilike('coach_name', `%${args.coach_name}%`);
        }
        
        const { data, error } = await query.order('report_date', { ascending: false }).limit(10);
        if (error) throw error;
        return JSON.stringify(data || []);
      }
      
      // TOOL 11: Proactive Insights
      case "get_proactive_insights": {
        let query = supabase.from('proactive_insights').select('*');
        
        if (args.priority && args.priority !== 'all') {
          query = query.eq('priority', args.priority);
        }
        
        const { data, error } = await query
          .eq('dismissed', false)
          .order('created_at', { ascending: false })
          .limit(args.limit || 10);
        
        if (error) throw error;
        return JSON.stringify(data || []);
      }
      
      // TOOL 12: Daily Summary
      case "get_daily_summary": {
        const targetDate = args.date || new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('daily_summary')
          .select('*')
          .eq('summary_date', targetDate)
          .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data ? JSON.stringify(data) : `No summary found for ${targetDate}`;
      }
      
      // TOOL 13: SQL Query
      case "run_sql_query": {
        const query = args.query.trim();
        const normalizedQuery = query.toLowerCase();
        
        // Security: Only allow SELECT queries
        if (!normalizedQuery.startsWith('select')) {
          return "Error: Only SELECT queries are allowed";
        }
        
        // Prevent certain risky operations - check word boundaries to avoid false positives
        const forbiddenPattern = /\b(drop|delete|insert|update|alter|create|truncate|grant|revoke|execute|exec)\b/i;
        if (forbiddenPattern.test(normalizedQuery)) {
          return "Error: Query contains forbidden operations";
        }
        
        // Additional security: prevent comments and multi-statement queries
        if (normalizedQuery.includes('--') || normalizedQuery.includes('/*') || normalizedQuery.includes(';')) {
          return "Error: Query contains forbidden characters (comments or multiple statements)";
        }
        
        return "SQL RPC not available. Use the specific tools instead for data queries.";
      }

      case "universal_search": {
        const { query, search_type = "auto" } = args;
        const q = String(query).trim();
        
        // Input validation: prevent excessively long queries
        if (q.length > 100) {
          return JSON.stringify({ error: "Search query too long (max 100 characters)" });
        }
        
        // Auto-detect search type
        let detectedType = search_type;
        if (search_type === "auto") {
          if (/^\d{9,15}$/.test(q.replace(/\D/g, ''))) detectedType = "phone";
          else if (q.includes('@')) detectedType = "email";
          else if (/^[a-f0-9-]{36}$/i.test(q)) detectedType = "id";
          else detectedType = "name";
        }
        
        console.log(`🔍 Universal search: "${q}" (type: ${detectedType})`);
        
        // Prepare search patterns - Note: PostgREST properly escapes these parameters
        const phoneCleaned = q.replace(/\D/g, '');
        const searchLike = `%${q}%`;
        
        // Search across all relevant tables
        const [contacts, leads, calls, deals, healthScores, activities] = await Promise.all([
          // Contacts search
          // Primary search: contacts table (unified schema)
          supabase.from('contacts').select('*').or(
            `phone.ilike.%${phoneCleaned}%,email.ilike.${searchLike},first_name.ilike.${searchLike},last_name.ilike.${searchLike},hubspot_contact_id.ilike.${searchLike},owner_name.ilike.${searchLike}`
          ).limit(10),
          
          // Attribution events search (for campaign data)
          supabase.from('attribution_events').select('*').or(
            `email.ilike.${searchLike},campaign.ilike.${searchLike}`
          ).limit(10),
          
          // Call records - search by phone number
          supabase.from('call_records').select('*')
            .or(`caller_number.ilike.%${phoneCleaned}%`)
            .order('started_at', { ascending: false })
            .limit(20),
          
          // Deals search
          supabase.from('deals').select('*').or(
            `deal_name.ilike.${searchLike},hubspot_deal_id.ilike.${searchLike}`
          ).limit(10),
          
          // Health scores by email or name
          supabase.from('client_health_scores').select('*').or(
            `email.ilike.${searchLike},firstname.ilike.${searchLike},lastname.ilike.${searchLike}`
          ).limit(5),
          
          // Contact activities
          supabase.from('contact_activities').select('*').or(
            `hubspot_contact_id.ilike.${searchLike}`
          ).order('occurred_at', { ascending: false }).limit(10)
        ]);
        
        // Count call attempts for phone searches
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
        
        // Build enriched result
        const result = {
          search_query: q,
          search_type: detectedType,
          
          // Contact Info
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
          
          // Lead Info
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
          
          // Call History
          call_stats: callStats,
          call_history: calls.data?.slice(0, 10).map((c: any) => ({
            date: c.started_at,
            status: c.call_status,
            direction: c.call_direction,
            duration_seconds: c.duration_seconds,
            outcome: c.call_outcome
          })),
          
          // Deals
          deals_found: deals.data?.length || 0,
          deal_details: deals.data?.map((d: any) => ({
            name: d.deal_name,
            value: d.deal_value,
            stage: d.stage,
            status: d.status,
            close_date: d.close_date
          })),
          
          // Health Scores
          health_scores: healthScores.data?.map((h: any) => ({
            name: `${h.firstname || ''} ${h.lastname || ''}`.trim(),
            email: h.email,
            health_score: h.health_score,
            health_zone: h.health_zone,
            coach: h.assigned_coach,
            churn_risk: h.churn_risk_score
          })),
          
          // Recent Activities
          recent_activities: activities.data?.slice(0, 5).map((a: any) => ({
            type: a.activity_type,
            title: a.activity_title,
            date: a.occurred_at
          }))
        };
        
        return JSON.stringify(result, null, 2);
      }

      case "get_coach_clients": {
        const { coach_name } = args;
        const searchName = `%${coach_name}%`;
        
        console.log(`🏋️ Searching for coach: "${coach_name}"`);
        
        // Search for clients assigned to this coach
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
        
        // Calculate stats
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

      case "callgear_control": {
        const { date_from, date_to, limit = 50 } = args;
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
        const { target_identity, limit = 50 } = args;
        try {
          const { data, error } = await supabase.functions.invoke('fetch-forensic-data', {
            body: { target_identity, limit }
          });

          if (error) return `Forensic Audit Error: ${error.message}`;
          if (!data.success) return `Forensic Audit Failed: ${data.message || 'Unknown error'}`;

          return JSON.stringify({
            target: data.contact,
            audit_log: data.audit_log
          });
        } catch (e) {
          return `Forensic integration error: ${e}`;
        }
      }
      
      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (error: unknown) {
    console.error(`Tool error (${toolName}):`, error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return `Error executing ${toolName}: ${errMsg}`;
  }
}

// ============= MAIN SERVER =============
const handler = async (req: Request): Promise<Response> => {
  const correlationId = getCorrelationId(req);
  structuredLog("info", "[smart-agent] Request received", { correlationId });
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, stream = false } = await req.json();
    
    // Use direct Gemini API (LOVABLE_API_KEY is optional, only for fallback)
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const useDirectGemini = !!GEMINI_API_KEY;
    if (!GEMINI_API_KEY && !LOVABLE_API_KEY) {
      throw new Error("No AI API key configured. Set GEMINI_API_KEY (or GOOGLE_API_KEY)");
    }
    console.log(`🤖 Using ${useDirectGemini ? 'Direct Gemini API' : 'Lovable Gateway (fallback)'}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const systemPrompt = buildAgentPrompt('SMART_AGENT', {
      includeLifecycle: true,
      includeROI: true,
      includeHubSpot: true,
      additionalContext: `AVAILABLE TOOLS:
1. client_control - Full client data (health, calls, deals, activities)
2. lead_control - Lead management (search, score, enhanced data)
3. sales_flow_control - Pipeline, deals, appointments
4. hubspot_control - Sync, contacts, activities
5. stripe_control - Fraud scan, payment history
6. call_control - Call records, transcripts, patterns
7. intelligence_control - Run AI functions (churn predictor, anomaly detector, etc.)
8. analytics_control - Dashboards (health, revenue, coaches, campaigns)
9. get_at_risk_clients - Red/yellow zone clients
10. get_coach_performance - Coach metrics
11. get_proactive_insights - AI recommendations
12. get_daily_summary - Business summary
13. run_sql_query - Custom SQL (read-only)

WHEN USER ASKS:
- "Show me john@ptd.com" → Use client_control get_all
- "Find at risk clients" → Use get_at_risk_clients
- "Scan for fraud" → Use stripe_control fraud_scan
- "Sync HubSpot" → Use hubspot_control sync_now
- "Run intelligence" → Use intelligence_control
- "Show health dashboard" → Use analytics_control health
- "Get call patterns" → Use call_control find_patterns

IMPORTANT:
- Always use tools to get REAL data - don't guess
- Provide specific numbers, names, and actionable insights
- If data is missing, explain what's needed`
    });

    // Initial call with tools
    let currentMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    // Call AI API - Direct Gemini or Lovable fallback
    let response: Response;
    if (useDirectGemini) {
      response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-3.0-flash",
          messages: currentMessages,
          tools,
          tool_choice: "auto",
          stream: false
        }),
      });
    } else {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.0-flash",
          messages: currentMessages,
          tools,
          tool_choice: "auto",
          stream: false
        }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    let result = await response.json();
    let assistantMessage = result.choices[0].message;
    
    // Agentic loop: process tool calls until done
    let iterations = 0;
    const maxIterations = 8;
    
    while (assistantMessage.tool_calls && iterations < maxIterations) {
      iterations++;
      console.log(`Agent iteration ${iterations}, tool calls:`, assistantMessage.tool_calls.length);
      
      // Add assistant message with tool calls
      // Ensure content is a string (not null) to avoid "image media type is required" error
      // Some OpenAI-compatible APIs reject null content in messages with tool_calls
      currentMessages.push({
        ...assistantMessage,
        content: assistantMessage.content || ""
      });
      
      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        assistantMessage.tool_calls.map(async (toolCall: any) => {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
          const result = await executeTool(supabase, toolName, toolArgs);
          return { id: toolCall.id, result };
        })
      );
      
      // Add tool results to messages
      for (const { id, result } of toolResults) {
        // Ensure content is always a non-empty string to avoid API errors
        // Empty/null content can trigger "image media type is required" error in some APIs
        const content = (typeof result === 'string' && result.trim()) ? result : "No data returned";
        currentMessages.push({
          role: "tool",
          tool_call_id: id,
          content: content
        });
      }
      
      // Continue conversation with tool results - use same API as initial call
      if (useDirectGemini) {
        response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${GEMINI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gemini-3.0-flash",
            messages: currentMessages,
            tools,
            tool_choice: "auto",
            stream: false
          }),
        });
      } else {
        response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.0-flash",
            messages: currentMessages,
            tools,
            tool_choice: "auto",
            stream: false
          }),
        });
      }

      if (!response.ok) {
        throw new Error(`AI Gateway error on iteration ${iterations}`);
      }

      result = await response.json();
      assistantMessage = result.choices[0].message;
    }

    // Return final response
    return new Response(JSON.stringify({
      response: assistantMessage.content,
      iterations,
      model: useDirectGemini ? "gemini-3.0-flash" : "google/gemini-3.0-flash",
      tools_available: tools.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Smart agent error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      error: errMsg,
      hint: "Check edge function logs for details"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

// Serve with tracing wrapper
serve(withTracing(handler, { 
  functionName: "smart-agent",
  runType: "chain",
  tags: ["ai-agent", "gemini", "critical"]
}));
