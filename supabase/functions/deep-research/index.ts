import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= LANGGRAPH-STYLE STATE =============
interface ResearchState {
  query: string;
  researchPlan: string[];
  findings: ResearchFinding[];
  synthesis: string;
  currentStep: number;
  totalSteps: number;
  status: 'planning' | 'researching' | 'synthesizing' | 'complete' | 'error';
  error?: string;
}

interface ResearchFinding {
  step: string;
  data: any;
  insight: string;
  confidence: number;
}

// ============= DATA COLLECTION TOOLS =============
async function queryClientHealth(supabase: any, filters?: any): Promise<any> {
  const { data, error } = await supabase
    .from('client_health_scores')
    .select('*')
    .order('health_score', { ascending: true })
    .limit(100);
  
  if (error) throw error;
  
  const zones = { red: 0, yellow: 0, green: 0, purple: 0 };
  let totalScore = 0;
  
  data?.forEach((c: any) => {
    const zone = c.health_zone?.toLowerCase() || 'unknown';
    if (zone in zones) zones[zone as keyof typeof zones]++;
    totalScore += c.health_score || 0;
  });
  
  return {
    totalClients: data?.length || 0,
    avgHealthScore: data?.length ? (totalScore / data.length).toFixed(1) : 0,
    zones,
    atRisk: data?.filter((c: any) => (c.health_zone || '').toLowerCase() === 'red') || [],
    topPerformers: data?.filter((c: any) => (c.health_zone || '').toLowerCase() === 'purple') || []
  };
}

async function queryDeals(supabase: any): Promise<any> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  
  if (error) throw error;
  
  const stages: Record<string, number> = {};
  let totalValue = 0;
  let closedValue = 0;
  
  data?.forEach((d: any) => {
    const stage = d.stage || 'unknown';
    stages[stage] = (stages[stage] || 0) + 1;
    totalValue += d.deal_value || 0;
    if (d.status === 'closed' || stage === 'closedwon') {
      closedValue += d.deal_value || 0;
    }
  });
  
  return {
    totalDeals: data?.length || 0,
    totalPipeline: totalValue,
    closedRevenue: closedValue,
    stageBreakdown: stages,
    recentDeals: data?.slice(0, 10) || []
  };
}

async function queryCoachPerformance(supabase: any): Promise<any> {
  const { data, error } = await supabase
    .from('coach_performance')
    .select('*')
    .order('performance_score', { ascending: false });
  
  if (error) throw error;
  
  return {
    coaches: data || [],
    topCoach: data?.[0] || null,
    avgPerformance: data?.length 
      ? (data.reduce((sum: number, c: any) => sum + (c.performance_score || 0), 0) / data.length).toFixed(1) 
      : 0
  };
}

async function queryStripeData(supabase: any): Promise<any> {
  const [transactions, subscriptions, fraudAlerts] = await Promise.all([
    supabase.from('stripe_transactions').select('*').limit(50),
    supabase.from('stripe_subscriptions').select('*').limit(50),
    supabase.from('stripe_fraud_alerts').select('*').limit(20)
  ]);
  
  return {
    recentTransactions: transactions.data || [],
    activeSubscriptions: subscriptions.data?.filter((s: any) => s.status === 'active') || [],
    fraudAlerts: fraudAlerts.data || [],
    totalRevenue: transactions.data?.reduce((sum: number, t: any) => sum + (t.amount || 0), 0) || 0
  };
}

async function queryInterventions(supabase: any): Promise<any> {
  const { data, error } = await supabase
    .from('intervention_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (error) throw error;
  
  const statuses: Record<string, number> = {};
  data?.forEach((i: any) => {
    const status = i.status || 'unknown';
    statuses[status] = (statuses[status] || 0) + 1;
  });
  
  return {
    totalInterventions: data?.length || 0,
    statusBreakdown: statuses,
    pendingActions: data?.filter((i: any) => i.status === 'pending') || [],
    completedActions: data?.filter((i: any) => i.status === 'completed') || []
  };
}

async function queryCallRecords(supabase: any): Promise<any> {
  const { data, error } = await supabase
    .from('call_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (error) throw error;
  
  const outcomes: Record<string, number> = {};
  let totalDuration = 0;
  
  data?.forEach((c: any) => {
    const outcome = c.call_outcome || 'unknown';
    outcomes[outcome] = (outcomes[outcome] || 0) + 1;
    totalDuration += c.duration_seconds || 0;
  });
  
  return {
    totalCalls: data?.length || 0,
    avgDuration: data?.length ? (totalDuration / data.length / 60).toFixed(1) : 0,
    outcomeBreakdown: outcomes,
    recentCalls: data?.slice(0, 10) || []
  };
}

async function queryDailySummary(supabase: any): Promise<any> {
  const { data, error } = await supabase
    .from('daily_summary')
    .select('*')
    .order('summary_date', { ascending: false })
    .limit(30);
  
  if (error) throw error;
  
  return {
    summaries: data || [],
    latestSummary: data?.[0] || null,
    trend: data?.length > 1 
      ? (data[0]?.avg_health_score || 0) - (data[data.length - 1]?.avg_health_score || 0) 
      : 0
  };
}

// ============= GEMINI AI CALLS =============
async function callGemini(prompt: string, systemPrompt: string): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('GOOGLE_GEMINI_API_KEY');
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY, GOOGLE_API_KEY, or GOOGLE_GEMINI_API_KEY not configured');
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        }
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }
  
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ============= LANGGRAPH NODES =============
async function planResearch(state: ResearchState): Promise<ResearchState> {
  console.log('📋 Planning research for:', state.query);
  
  const planPrompt = `
You are a PTD Fitness business analyst. Create a research plan for this query:
"${state.query}"

Available data sources:
1. client_health_scores - Client health zones (Red/Yellow/Green/Purple), engagement, churn risk
2. deals - Pipeline, revenue, deal stages
3. coach_performance - Coach metrics, client distribution
4. stripe_transactions/subscriptions - Payment data, fraud alerts
5. intervention_log - Recommended actions, outcomes
6. call_records - Call outcomes, durations, conversion
7. daily_summary - Daily metrics trends

Return ONLY a JSON array of 3-5 research steps. Each step should be a string describing what to analyze.
Example: ["Analyze client health distribution", "Review coach performance", "Identify revenue patterns"]
`;

  const planResponse = await callGemini(planPrompt, 'You are a research planning agent. Return only valid JSON.');
  
  try {
    const match = planResponse.match(/\[[\s\S]*\]/);
    const plan = match ? JSON.parse(match[0]) : ['Analyze overall health', 'Review financials', 'Generate insights'];
    
    return {
      ...state,
      researchPlan: plan,
      totalSteps: plan.length,
      currentStep: 0,
      status: 'researching'
    };
  } catch (e) {
    console.error('Plan parsing error:', e);
    return {
      ...state,
      researchPlan: ['Analyze health data', 'Review deals', 'Check interventions'],
      totalSteps: 3,
      currentStep: 0,
      status: 'researching'
    };
  }
}

async function executeResearchStep(state: ResearchState, supabase: any): Promise<ResearchState> {
  const step = state.researchPlan[state.currentStep];
  console.log(`🔍 Step ${state.currentStep + 1}/${state.totalSteps}: ${step}`);
  
  const stepLower = step.toLowerCase();
  let data: any = {};
  
  // Collect relevant data based on step
  if (stepLower.includes('health') || stepLower.includes('client') || stepLower.includes('churn') || stepLower.includes('risk')) {
    data.clientHealth = await queryClientHealth(supabase);
  }
  if (stepLower.includes('deal') || stepLower.includes('revenue') || stepLower.includes('pipeline') || stepLower.includes('financial')) {
    data.deals = await queryDeals(supabase);
  }
  if (stepLower.includes('coach') || stepLower.includes('performance') || stepLower.includes('trainer')) {
    data.coaches = await queryCoachPerformance(supabase);
  }
  if (stepLower.includes('stripe') || stepLower.includes('payment') || stepLower.includes('fraud') || stepLower.includes('subscription')) {
    data.stripe = await queryStripeData(supabase);
  }
  if (stepLower.includes('intervention') || stepLower.includes('action') || stepLower.includes('recommendation')) {
    data.interventions = await queryInterventions(supabase);
  }
  if (stepLower.includes('call') || stepLower.includes('communication')) {
    data.calls = await queryCallRecords(supabase);
  }
  if (stepLower.includes('trend') || stepLower.includes('daily') || stepLower.includes('summary')) {
    data.daily = await queryDailySummary(supabase);
  }
  
  // If no specific data matched, get a comprehensive overview
  if (Object.keys(data).length === 0) {
    data.clientHealth = await queryClientHealth(supabase);
    data.deals = await queryDeals(supabase);
  }
  
  // Generate insight for this step
  const insightPrompt = `
Research Step: "${step}"
Original Query: "${state.query}"

Data collected:
${JSON.stringify(data, null, 2)}

Analyze this data and provide:
1. Key finding (1-2 sentences)
2. Confidence level (0-1)
3. Actionable insight

Format as JSON: {"finding": "...", "confidence": 0.X, "insight": "..."}
`;

  const insightResponse = await callGemini(insightPrompt, 'You are a data analyst. Return only valid JSON.');
  
  let finding: ResearchFinding;
  try {
    const match = insightResponse.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : { finding: 'Data analyzed', confidence: 0.7, insight: 'Review required' };
    finding = {
      step,
      data,
      insight: `${parsed.finding} ${parsed.insight}`,
      confidence: parsed.confidence || 0.7
    };
  } catch (e) {
    finding = {
      step,
      data,
      insight: insightResponse.slice(0, 500),
      confidence: 0.6
    };
  }
  
  return {
    ...state,
    findings: [...state.findings, finding],
    currentStep: state.currentStep + 1,
    status: state.currentStep + 1 >= state.totalSteps ? 'synthesizing' : 'researching'
  };
}

async function synthesizeFindings(state: ResearchState): Promise<ResearchState> {
  console.log('📊 Synthesizing findings...');
  
  const synthesisPrompt = `
Original Research Query: "${state.query}"

Research Findings:
${state.findings.map((f, i) => `
Step ${i + 1}: ${f.step}
Insight: ${f.insight}
Confidence: ${(f.confidence * 100).toFixed(0)}%
`).join('\n')}

Create a comprehensive research report with:
1. **Executive Summary** (2-3 sentences)
2. **Key Findings** (bullet points)
3. **Data-Driven Insights** (specific numbers and trends)
4. **Recommendations** (actionable next steps)
5. **Risk Factors** (potential concerns)

Use markdown formatting. Be specific with numbers from the data.
`;

  const synthesis = await callGemini(synthesisPrompt, `
You are a senior business analyst for PTD Fitness creating a deep research report.
Be specific, data-driven, and actionable. Use the actual numbers from the findings.
Format with clear headers and bullet points.
`);
  
  return {
    ...state,
    synthesis,
    status: 'complete'
  };
}

// ============= MAIN GRAPH RUNNER =============
async function runResearchGraph(query: string, supabase: any): Promise<ResearchState> {
  let state: ResearchState = {
    query,
    researchPlan: [],
    findings: [],
    synthesis: '',
    currentStep: 0,
    totalSteps: 0,
    status: 'planning'
  };
  
  try {
    // Node 1: Plan the research
    state = await planResearch(state);
    console.log(`📋 Plan created: ${state.researchPlan.length} steps`);
    
    // Node 2: Execute each research step
    while (state.status === 'researching' && state.currentStep < state.totalSteps) {
      state = await executeResearchStep(state, supabase);
      console.log(`✅ Step ${state.currentStep}/${state.totalSteps} complete`);
    }
    
    // Node 3: Synthesize findings
    state = await synthesizeFindings(state);
    console.log('🎯 Research complete!');
    
    // Save to agent memory
    await supabase.from('agent_memory').insert({
      thread_id: 'deep-research',
      query,
      response: state.synthesis,
      knowledge_extracted: {
        type: 'deep_research',
        steps: state.researchPlan.length,
        findings_count: state.findings.length,
        avg_confidence: state.findings.reduce((sum, f) => sum + f.confidence, 0) / state.findings.length
      }
    });
    
    return state;
  } catch (error) {
    console.error('Research error:', error);
    return {
      ...state,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============= HTTP HANDLER =============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { query, thread_id } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    console.log('🚀 Starting deep research:', query);
    
    const result = await runResearchGraph(query, supabase);
    
    return new Response(
      JSON.stringify({
        success: result.status === 'complete',
        query,
        plan: result.researchPlan,
        findings: result.findings.map(f => ({
          step: f.step,
          insight: f.insight,
          confidence: f.confidence
        })),
        synthesis: result.synthesis,
        status: result.status,
        error: result.error
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Deep research error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
