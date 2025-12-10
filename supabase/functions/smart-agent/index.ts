import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tool definitions for the agent
const tools = [
  {
    type: "function",
    function: {
      name: "query_clients_by_coach",
      description: "Get all clients assigned to a specific coach",
      parameters: {
        type: "object",
        properties: {
          coach_name: { type: "string", description: "Name of the coach (e.g., 'Mathew', 'Sarah')" }
        },
        required: ["coach_name"]
      }
    }
  },
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
  {
    type: "function",
    function: {
      name: "search_contacts",
      description: "Search contacts by email, name, or phone",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term" },
          limit: { type: "number", description: "Max results (default 10)" }
        },
        required: ["query"]
      }
    }
  },
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
  {
    type: "function",
    function: {
      name: "run_sql_query",
      description: "Run a read-only SQL query against the database. Use for complex queries.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "SQL SELECT query (read-only)" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_stripe_data",
      description: "Get Stripe payment and subscription data",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["payments", "subscriptions", "refunds", "summary"] }
        },
        required: ["type"]
      }
    }
  }
];

// Execute tool calls
async function executeTool(supabase: any, toolName: string, args: any): Promise<string> {
  console.log(`Executing tool: ${toolName}`, args);
  
  try {
    switch (toolName) {
      case "query_clients_by_coach": {
        const { data, error } = await supabase
          .from('client_health_scores')
          .select('*')
          .ilike('assigned_coach', `%${args.coach_name}%`)
          .order('health_score', { ascending: true });
        
        if (error) throw error;
        if (!data?.length) return `No clients found for coach "${args.coach_name}"`;
        return JSON.stringify({ count: data.length, clients: data });
      }
      
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
      
      case "get_coach_performance": {
        let query = supabase.from('coach_performance').select('*');
        
        if (args.coach_name) {
          query = query.ilike('coach_name', `%${args.coach_name}%`);
        }
        
        const { data, error } = await query.order('report_date', { ascending: false }).limit(10);
        if (error) throw error;
        return JSON.stringify(data || []);
      }
      
      case "search_contacts": {
        const searchTerm = `%${args.query}%`;
        const { data, error } = await supabase
          .from('contacts')
          .select('id, email, first_name, last_name, phone, owner_name, lifecycle_stage, lead_status')
          .or(`email.ilike.${searchTerm},first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},phone.ilike.${searchTerm}`)
          .limit(args.limit || 10);
        
        if (error) throw error;
        return JSON.stringify({ count: data?.length || 0, contacts: data || [] });
      }
      
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
      
      case "run_sql_query": {
        // Security: Only allow SELECT queries
        const query = args.query.trim().toLowerCase();
        if (!query.startsWith('select')) {
          return "Error: Only SELECT queries are allowed";
        }
        if (query.includes('delete') || query.includes('update') || query.includes('insert') || query.includes('drop') || query.includes('alter')) {
          return "Error: Modifying queries are not allowed";
        }
        
        const { data, error } = await supabase.rpc('run_readonly_query', { sql_query: args.query });
        
        // If RPC doesn't exist, try direct query on safe tables
        if (error?.code === 'PGRST202') {
          // Fallback: parse and execute simple queries
          return "SQL RPC not available. Use specific tools instead.";
        }
        
        if (error) throw error;
        return JSON.stringify(data);
      }
      
      case "get_stripe_data": {
        // Call the existing stripe-forensics function
        const { data, error } = await supabase.functions.invoke('stripe-forensics', {
          body: { action: args.type === 'summary' ? 'analyze' : args.type }
        });
        
        if (error) throw error;
        return JSON.stringify(data);
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

    const systemPrompt = `You are PTD Super Intelligence Agent - an AI assistant for Personal Training Dubai's business intelligence platform.

You have access to 58 database tables including:
- client_health_scores: Client health metrics, churn risk, assigned coaches
- coach_performance: Coach KPIs and rankings
- contacts: CRM contact data from HubSpot
- deals: Sales deals and revenue
- proactive_insights: AI-generated business insights
- daily_summary: Daily business metrics
- events: Conversion tracking events
- And many more...

CAPABILITIES:
1. Query clients by coach assignment (NOT contact owner - use assigned_coach field)
2. Find at-risk clients (red/yellow zones)
3. Get coach performance metrics
4. Search contacts
5. Retrieve business intelligence summaries
6. Access proactive AI insights
7. Run custom SQL queries (read-only)
8. Get Stripe payment data

IMPORTANT DISTINCTIONS:
- "Coach" = assigned_coach field in client_health_scores (the trainer working with the client)
- "Owner" = owner_name in contacts (the sales rep who owns the lead)
- These are DIFFERENT roles - always clarify which one the user means

When answering:
1. Use tools to get real data - don't make assumptions
2. Provide specific numbers and names
3. If data is missing, explain what's needed to populate it
4. Be concise but thorough`;

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
    const maxIterations = 5;
    
    while (assistantMessage.tool_calls && iterations < maxIterations) {
      iterations++;
      console.log(`Agent iteration ${iterations}, tool calls:`, assistantMessage.tool_calls.length);
      
      // Add assistant message with tool calls
      currentMessages.push(assistantMessage);
      
      // Execute all tool calls
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
        
        const toolResult = await executeTool(supabase, toolName, toolArgs);
        
        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult
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
      model: "google/gemini-2.5-flash"
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
