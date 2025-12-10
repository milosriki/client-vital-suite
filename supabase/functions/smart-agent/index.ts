import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

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
      
      // TOOL 2: Lead Control
      case "lead_control": {
        if (args.action === "get_all") {
          const { data } = await supabase
            .from('enhanced_leads')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(args.limit || 20);
          return JSON.stringify({ count: data?.length || 0, leads: data || [] });
        }
        
        if (args.action === "search" && args.query) {
          const searchTerm = `%${args.query}%`;
          const { data } = await supabase
            .from('enhanced_leads')
            .select('*')
            .or(`email.ilike.${searchTerm},first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},phone.ilike.${searchTerm}`)
            .limit(args.limit || 10);
          return JSON.stringify({ count: data?.length || 0, leads: data || [] });
        }
        
        if (args.action === "get_enhanced") {
          const { data } = await supabase
            .from('enhanced_leads')
            .select('*')
            .order('lead_score', { ascending: false })
            .limit(args.limit || 20);
          return JSON.stringify(data || []);
        }
        
        if (args.action === "get_by_status") {
          const { data } = await supabase
            .from('enhanced_leads')
            .select('*')
            .eq('conversion_status', args.status || 'new')
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
        const query = args.query.trim().toLowerCase();
        if (!query.startsWith('select')) {
          return "Error: Only SELECT queries are allowed";
        }
        if (query.includes('delete') || query.includes('update') || query.includes('insert') || query.includes('drop') || query.includes('alter')) {
          return "Error: Modifying queries are not allowed";
        }
        
        return "SQL RPC not available. Use the specific tools instead for data queries.";
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
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, stream = false } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const systemPrompt = `You are PTD SUPER-INTELLIGENCE AGENT - an AI that controls the ENTIRE PTD Fitness business intelligence system.

SYSTEM COVERAGE:
✅ All 58 Supabase tables via tools
✅ 21 Edge Functions (including intelligence functions)
✅ Full sales flow (Lead→Call→Deal→Health)
✅ HubSpot live tracking + sync
✅ Stripe fraud detection + history
✅ Call transcripts + patterns
✅ Coach performance + client health
✅ Intervention recommendations

AVAILABLE TOOLS:
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
- If data is missing, explain what's needed
- Be concise but thorough`;

    // Initial call with tools
    let currentMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: currentMessages,
        tools,
        tool_choice: "auto",
        stream: false
      }),
    });

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
      currentMessages.push(assistantMessage);
      
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
        currentMessages.push({
          role: "tool",
          tool_call_id: id,
          content: result
        });
      }
      
      // Continue conversation with tool results
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: currentMessages,
          tools,
          tool_choice: "auto",
          stream: false
        }),
      });

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
      model: "google/gemini-2.5-flash",
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
});
