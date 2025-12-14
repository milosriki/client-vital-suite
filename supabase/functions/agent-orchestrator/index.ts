import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// LangGraph-style state machine for agent orchestration
// Implements a simplified StateGraph pattern compatible with Deno Edge Functions

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============ STATE DEFINITION ============
interface AgentState {
  messages: Array<{ role: string; content: string }>;
  currentNode: string;
  context: {
    contacts?: number;
    leads?: number;
    deals?: number;
    healthScores?: any[];
    syncStatus?: string;
    errors?: any[];
    insights?: any[];
  };
  results: Record<string, any>;
  shouldContinue: boolean;
  finalOutput?: string;
}

// ============ AGENT NODES ============
type NodeFunction = (state: AgentState, supabase: any) => Promise<AgentState>;

// Node 1: Data Collector - Gathers current state from all sources
const dataCollectorNode: NodeFunction = async (state, supabase) => {
  console.log("[Orchestrator] Running: dataCollector");
  
  const [contacts, leads, deals, healthScores, syncLogs, errors] = await Promise.all([
    supabase.from('contacts').select('id', { count: 'exact', head: true }),
    supabase.from('leads').select('id', { count: 'exact', head: true }),
    supabase.from('deals').select('id', { count: 'exact', head: true }),
    supabase.from('client_health_scores').select('*').order('calculated_at', { ascending: false }).limit(10),
    supabase.from('sync_logs').select('*').order('started_at', { ascending: false }).limit(5),
    supabase.from('sync_errors').select('*').eq('resolved_at', null).order('created_at', { ascending: false }).limit(10)
  ]);

  state.context = {
    contacts: contacts.count || 0,
    leads: leads.count || 0,
    deals: deals.count || 0,
    healthScores: healthScores.data || [],
    syncStatus: syncLogs.data?.[0]?.status || 'unknown',
    errors: errors.data || []
  };

  state.results.dataCollector = {
    timestamp: new Date().toISOString(),
    dataSummary: {
      contacts: state.context.contacts,
      leads: state.context.leads,
      deals: state.context.deals,
      healthScoresCount: state.context.healthScores?.length || 0,
      unresolvedErrors: state.context.errors?.length || 0
    }
  };

  return { ...state, currentNode: 'router' };
};

// Node 2: Router - Decides which agents need to run
const routerNode: NodeFunction = async (state, _supabase) => {
  console.log("[Orchestrator] Running: router");
  
  const needsHealthCalc = (state.context.healthScores?.length || 0) === 0;
  const needsBI = true; // Always run BI for fresh insights
  const needsLeadReply = (state.context.leads || 0) > 0;
  const hasErrors = (state.context.errors?.length || 0) > 0;

  state.results.router = {
    decisions: {
      runHealthCalculator: needsHealthCalc,
      runBusinessIntelligence: needsBI,
      runLeadReply: needsLeadReply,
      prioritizeErrorResolution: hasErrors
    },
    nextNodes: []
  };

  // Build execution plan
  if (hasErrors) {
    state.results.router.nextNodes.push('errorHandler');
  }
  if (needsHealthCalc) {
    state.results.router.nextNodes.push('healthCalculator');
  }
  if (needsBI) {
    state.results.router.nextNodes.push('businessIntelligence');
  }
  if (needsLeadReply) {
    state.results.router.nextNodes.push('leadReply');
  }

  // Determine next node
  const nextNode = state.results.router.nextNodes[0] || 'synthesizer';
  return { ...state, currentNode: nextNode };
};

// Node 3: Health Calculator Agent
const healthCalculatorNode: NodeFunction = async (state, supabase) => {
  console.log("[Orchestrator] Running: healthCalculator");
  
  try {
    const response = await supabase.functions.invoke('health-calculator', {
      body: { mode: 'calculate' }
    });
    
    state.results.healthCalculator = {
      success: !response.error,
      data: response.data,
      error: response.error?.message
    };
  } catch (e) {
    state.results.healthCalculator = { success: false, error: String(e) };
  }

  // Move to next planned node
  const remainingNodes = state.results.router.nextNodes.filter(
    (n: string) => !['healthCalculator', 'errorHandler'].includes(n)
  );
  const nextNode = remainingNodes[0] || 'synthesizer';
  
  return { ...state, currentNode: nextNode };
};

// Node 4: Business Intelligence Agent
const businessIntelligenceNode: NodeFunction = async (state, supabase) => {
  console.log("[Orchestrator] Running: businessIntelligence");
  
  try {
    const response = await supabase.functions.invoke('business-intelligence', {
      body: {}
    });
    
    state.results.businessIntelligence = {
      success: !response.error,
      analysis: response.data?.analysis,
      dataFreshness: response.data?.dataFreshness
    };
  } catch (e) {
    state.results.businessIntelligence = { success: false, error: String(e) };
  }

  // Move to next planned node
  const remainingNodes = state.results.router.nextNodes.filter(
    (n: string) => !['healthCalculator', 'errorHandler', 'businessIntelligence'].includes(n)
  );
  const nextNode = remainingNodes[0] || 'synthesizer';
  
  return { ...state, currentNode: nextNode };
};

// Node 5: Lead Reply Agent
const leadReplyNode: NodeFunction = async (state, supabase) => {
  console.log("[Orchestrator] Running: leadReply");
  
  try {
    const response = await supabase.functions.invoke('generate-lead-replies', {
      body: { batchSize: 5 }
    });
    
    state.results.leadReply = {
      success: !response.error,
      processed: response.data?.results?.length || 0
    };
  } catch (e) {
    state.results.leadReply = { success: false, error: String(e) };
  }

  return { ...state, currentNode: 'synthesizer' };
};

// Node 6: Error Handler
const errorHandlerNode: NodeFunction = async (state, supabase) => {
  console.log("[Orchestrator] Running: errorHandler");
  
  const criticalErrors = state.context.errors?.filter(e => e.severity === 'critical') || [];
  
  state.results.errorHandler = {
    criticalCount: criticalErrors.length,
    errors: criticalErrors.slice(0, 3).map(e => ({
      platform: e.platform,
      message: e.error_message,
      created: e.created_at
    }))
  };

  // Continue to next node
  const remainingNodes = state.results.router.nextNodes.filter(
    (n: string) => n !== 'errorHandler'
  );
  const nextNode = remainingNodes[0] || 'synthesizer';
  
  return { ...state, currentNode: nextNode };
};

// Node 7: Synthesizer - Combines all results into final output
const synthesizerNode: NodeFunction = async (state, supabase) => {
  console.log("[Orchestrator] Running: synthesizer");
  
  // Try both Google API keys - GEMINI_API_KEY and GOOGLE_API_KEY
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const googleKey = Deno.env.get("GOOGLE_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const googleApiKeys = [geminiKey, googleKey].filter(Boolean) as string[];
  const useDirectGemini = googleApiKeys.length > 0;
  
  // Build synthesis prompt
  const synthesisContext = `
    Orchestration Results:
    - Data: ${JSON.stringify(state.results.dataCollector?.dataSummary)}
    - BI Analysis: ${state.results.businessIntelligence?.analysis?.executive_summary || 'Not run'}
    - Health Calculator: ${state.results.healthCalculator?.success ? 'Completed' : 'Skipped/Failed'}
    - Lead Replies: ${state.results.leadReply?.processed || 0} processed
    - Errors: ${state.results.errorHandler?.criticalCount || 0} critical
  `;

  let finalSummary = "";
  
  if (GEMINI_API_KEY || LOVABLE_API_KEY) {
    try {
      const aiUrl = useDirectGemini 
        ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
        : "https://ai.gateway.lovable.dev/v1/chat/completions";
      const aiKey = useDirectGemini ? GEMINI_API_KEY : LOVABLE_API_KEY;
      const aiModel = useDirectGemini ? "gemini-2.0-flash" : "google/gemini-2.5-flash";
      
      console.log(`🤖 Synthesizer using ${useDirectGemini ? 'Direct Gemini API' : 'Lovable Gateway'}`);
      
      const response = await fetch(aiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            { role: "system", content: "You are an AI orchestration summarizer. Create a brief executive summary of the agent run results. Be concise - max 3 sentences." },
            { role: "user", content: synthesisContext }
          ]
        })
      });
      
      const data = await response.json();
      finalSummary = data.choices?.[0]?.message?.content || "";
    } catch (e) {
      console.error("Synthesis AI failed:", e);
    }
  }

  if (!finalSummary) {
    finalSummary = `Orchestration complete. Data: ${state.context.contacts} contacts, ${state.context.deals} deals. ${state.results.errorHandler?.criticalCount || 0} critical errors detected.`;
  }

  state.finalOutput = finalSummary;
  state.shouldContinue = false;

  // Save orchestration result
  await supabase.from('proactive_insights').insert({
    insight_type: 'orchestration_summary',
    priority: 'medium',
    title: 'Agent Orchestration Complete',
    description: finalSummary,
    context_data: state.results,
    is_dismissed: false
  });

  return { ...state, currentNode: '__end__' };
};

// ============ GRAPH DEFINITION ============
const nodes: Record<string, NodeFunction> = {
  dataCollector: dataCollectorNode,
  router: routerNode,
  healthCalculator: healthCalculatorNode,
  businessIntelligence: businessIntelligenceNode,
  leadReply: leadReplyNode,
  errorHandler: errorHandlerNode,
  synthesizer: synthesizerNode,
};

// Graph execution engine (LangGraph-style)
async function runGraph(initialState: AgentState, supabase: any): Promise<AgentState> {
  let state = { ...initialState };
  let iterations = 0;
  const maxIterations = 10;

  while (state.shouldContinue && iterations < maxIterations) {
    const currentNode = nodes[state.currentNode];
    
    if (!currentNode) {
      console.log(`[Orchestrator] Node not found: ${state.currentNode}, ending`);
      state.shouldContinue = false;
      break;
    }

    state = await currentNode(state, supabase);
    iterations++;

    if (state.currentNode === '__end__') {
      state.shouldContinue = false;
    }
  }

  console.log(`[Orchestrator] Graph completed in ${iterations} iterations`);
  return state;
}

// ============ MAIN HANDLER ============
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const { mode = 'full' } = body;

    console.log(`[Orchestrator] Starting in mode: ${mode}`);

    // Initialize state
    const initialState: AgentState = {
      messages: [],
      currentNode: 'dataCollector',
      context: {},
      results: {},
      shouldContinue: true,
    };

    // Run the graph
    const startTime = Date.now();
    const finalState = await runGraph(initialState, supabase);
    const duration = Date.now() - startTime;

    // Log orchestration run
    await supabase.from('sync_logs').insert({
      platform: 'agent-orchestrator',
      sync_type: 'langgraph_run',
      status: 'success',
      records_synced: Object.keys(finalState.results).length,
      started_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      success: true,
      mode,
      duration: `${duration}ms`,
      summary: finalState.finalOutput,
      nodesExecuted: Object.keys(finalState.results),
      results: finalState.results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[Orchestrator] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
