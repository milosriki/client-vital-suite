import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.26.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= TYPE DEFINITIONS =============

interface ReasoningStep {
  step_number: number;
  question: string;
  tool_to_use: string;
  tool_args: any;
  result: any;
  conclusion: string;
  execution_time_ms?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}

interface WorkingMemory {
  original_query: string;
  decomposed_steps: ReasoningStep[];
  intermediate_results: Record<string, any>;
  context_built: string[];
  final_synthesis?: string;
  execution_plan?: ExecutionPlan;
}

interface ExecutionPlan {
  chain_type: 'sequential' | 'parallel' | 'conditional';
  total_steps: number;
  estimated_duration_ms: number;
  dependencies: Record<number, number[]>; // step_number -> depends on step_numbers
}

interface ConditionalBranch {
  condition: string;
  evaluator: (result: any) => boolean;
  true_steps: number[];
  false_steps: number[];
}

type ChainType = 'sequential' | 'parallel' | 'conditional';

// ============= AVAILABLE TOOLS FOR REASONING =============

const AVAILABLE_TOOLS = {
  // Data Retrieval Tools
  get_health_scores: "Retrieve client health scores and zones",
  get_revenue_data: "Get revenue, deals, and financial metrics",
  get_coach_performance: "Analyze coach/trainer performance metrics",
  get_lead_data: "Retrieve lead information and conversion rates",
  get_call_analytics: "Analyze call records and transcripts",
  get_pipeline_data: "Get sales pipeline and deal stages",

  // Analysis Tools
  compare_metrics: "Compare two sets of metrics (A vs B comparison)",
  calculate_trends: "Calculate trends over time periods",
  detect_anomalies: "Find unusual patterns in data",
  identify_root_cause: "Analyze why a metric changed",

  // Intelligence Functions
  run_churn_predictor: "Predict client churn risk",
  run_business_intelligence: "Get BI insights and analysis",
  run_coach_analyzer: "Deep dive into coach performance",
  run_anomaly_detector: "Detect system anomalies",

  // Synthesis Tools
  aggregate_results: "Combine multiple data points",
  generate_insights: "Create actionable insights from data",
  explain_difference: "Explain why two things differ"
};

// ============= QUERY DECOMPOSER =============

async function decomposeQuery(
  anthropic: Anthropic,
  query: string,
  context: string = ""
): Promise<{ steps: ReasoningStep[]; chain_type: ChainType; dependencies: Record<number, number[]> }> {
  console.log("[Reasoning] Decomposing query:", query);

  const prompt = `You are a query decomposition expert. Break down this complex business question into a logical sequence of sub-steps.

ORIGINAL QUERY: "${query}"

CONTEXT: ${context || "None provided"}

AVAILABLE TOOLS:
${Object.entries(AVAILABLE_TOOLS).map(([tool, desc]) => `- ${tool}: ${desc}`).join('\n')}

TASK:
1. Identify what type of reasoning chain this requires:
   - "sequential": Each step depends on the previous (A→B→C)
   - "parallel": Steps can run independently (A, B, C all at once)
   - "conditional": Branch based on results (if A then B else C)

2. Break the query into 3-7 logical sub-steps
3. For each step, specify:
   - A clear sub-question to answer
   - Which tool to use
   - What arguments the tool needs
   - Which other steps it depends on (if any)

OUTPUT MUST BE VALID JSON:
{
  "chain_type": "sequential" | "parallel" | "conditional",
  "reasoning": "Brief explanation of why this chain type",
  "steps": [
    {
      "step_number": 1,
      "question": "What is the current revenue?",
      "tool_to_use": "get_revenue_data",
      "tool_args": {"period": "current_month"},
      "depends_on": []
    },
    {
      "step_number": 2,
      "question": "What was last month's revenue?",
      "tool_to_use": "get_revenue_data",
      "tool_args": {"period": "last_month"},
      "depends_on": []
    },
    {
      "step_number": 3,
      "question": "Why did revenue change?",
      "tool_to_use": "identify_root_cause",
      "tool_args": {"metric": "revenue", "current": "$step_1", "previous": "$step_2"},
      "depends_on": [1, 2]
    }
  ]
}

EXAMPLES:

Query: "Compare Coach A vs Coach B performance"
Chain: parallel (both coaches can be analyzed independently, then compared)

Query: "Why is revenue down this month?"
Chain: sequential (need current revenue → compare to past → analyze causes → synthesize)

Query: "What's causing the increase in red zone clients?"
Chain: conditional (check if increase exists → if yes, analyze causes → if no, report status)

NOW DECOMPOSE THIS QUERY:`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }]
    });

    const text = response.content.find(block => block.type === "text")?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("No JSON found in decomposition response");
    }

    const decomposition = JSON.parse(jsonMatch[0]);

    // Build dependency map
    const dependencies: Record<number, number[]> = {};
    for (const step of decomposition.steps) {
      dependencies[step.step_number] = step.depends_on || [];
      // Add default status
      step.status = 'pending';
      step.result = null;
      step.conclusion = "";
    }

    console.log(`[Reasoning] Decomposed into ${decomposition.steps.length} steps (${decomposition.chain_type})`);

    return {
      steps: decomposition.steps,
      chain_type: decomposition.chain_type,
      dependencies
    };
  } catch (error) {
    console.error("[Reasoning] Decomposition failed:", error);

    // Fallback: Create simple sequential chain
    return {
      steps: [
        {
          step_number: 1,
          question: query,
          tool_to_use: "run_business_intelligence",
          tool_args: {},
          result: null,
          conclusion: "",
          status: 'pending'
        }
      ],
      chain_type: 'sequential',
      dependencies: { 1: [] }
    };
  }
}

// ============= TOOL EXECUTOR =============

async function executeTool(
  supabase: any,
  toolName: string,
  args: any,
  workingMemory: WorkingMemory
): Promise<any> {
  console.log(`[Reasoning] Executing tool: ${toolName}`, args);

  try {
    // Resolve step references in args (e.g., "$step_1" → actual result from step 1)
    const resolvedArgs = resolveStepReferences(args, workingMemory);

    switch (toolName) {
      // ===== DATA RETRIEVAL TOOLS =====
      case "get_health_scores": {
        const period = resolvedArgs.period || 'current';
        const { data } = await supabase
          .from('client_health_scores')
          .select('email, health_score, health_zone, churn_risk_score, calculated_at')
          .order('calculated_at', { ascending: false });

        const zones = {
          purple: data?.filter((c: any) => c.health_zone === 'purple') || [],
          green: data?.filter((c: any) => c.health_zone === 'green') || [],
          yellow: data?.filter((c: any) => c.health_zone === 'yellow') || [],
          red: data?.filter((c: any) => c.health_zone === 'red') || []
        };

        return {
          total_clients: data?.length || 0,
          zones,
          zone_counts: {
            purple: zones.purple.length,
            green: zones.green.length,
            yellow: zones.yellow.length,
            red: zones.red.length
          },
          avg_health_score: data?.reduce((sum: number, c: any) => sum + (c.health_score || 0), 0) / (data?.length || 1)
        };
      }

      case "get_revenue_data": {
        const period = resolvedArgs.period || 'current_month';
        const daysBack = period === 'current_month' ? 30 : period === 'last_month' ? 60 : 90;

        const { data: deals } = await supabase
          .from('hubspot_deals')
          .select('amount, dealstage, closedate, createdate')
          .gte('createdate', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString());

        const currentMonth = deals?.filter((d: any) => {
          const created = new Date(d.createdate);
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          return created >= thirtyDaysAgo;
        }) || [];

        const lastMonth = deals?.filter((d: any) => {
          const created = new Date(d.createdate);
          const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          return created >= sixtyDaysAgo && created < thirtyDaysAgo;
        }) || [];

        const currentRevenue = currentMonth.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0);
        const lastRevenue = lastMonth.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0);

        return {
          period,
          current_month: {
            revenue: currentRevenue,
            deals: currentMonth.length,
            avg_deal_size: currentRevenue / (currentMonth.length || 1)
          },
          last_month: {
            revenue: lastRevenue,
            deals: lastMonth.length,
            avg_deal_size: lastRevenue / (lastMonth.length || 1)
          },
          change: {
            revenue_change: currentRevenue - lastRevenue,
            revenue_change_pct: lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0,
            deals_change: currentMonth.length - lastMonth.length
          }
        };
      }

      case "get_coach_performance": {
        const coachName = resolvedArgs.coach_name || null;

        let query = supabase
          .from('coach_performance')
          .select('coach_name, total_clients, avg_client_health, clients_at_risk, performance_score, report_date')
          .order('report_date', { ascending: false });

        if (coachName) {
          query = query.eq('coach_name', coachName);
        }

        const { data } = await query.limit(50);

        if (!data || data.length === 0) {
          return { error: "No coach performance data found" };
        }

        // Group by coach
        const byCoach: Record<string, any> = {};
        data.forEach((record: any) => {
          const coach = record.coach_name;
          if (!byCoach[coach]) {
            byCoach[coach] = {
              coach_name: coach,
              latest_performance: record,
              avg_clients: 0,
              avg_health: 0,
              avg_at_risk: 0,
              records: []
            };
          }
          byCoach[coach].records.push(record);
        });

        // Calculate averages
        Object.keys(byCoach).forEach(coach => {
          const records = byCoach[coach].records;
          byCoach[coach].avg_clients = records.reduce((sum: number, r: any) => sum + (r.total_clients || 0), 0) / records.length;
          byCoach[coach].avg_health = records.reduce((sum: number, r: any) => sum + (r.avg_client_health || 0), 0) / records.length;
          byCoach[coach].avg_at_risk = records.reduce((sum: number, r: any) => sum + (r.clients_at_risk || 0), 0) / records.length;
        });

        return coachName ? byCoach[coachName] : byCoach;
      }

      case "get_lead_data": {
        const { data: leads } = await supabase
          .from('enhanced_leads')
          .select('email, first_name, last_name, lead_score, lead_quality, conversion_status, created_at')
          .order('created_at', { ascending: false })
          .limit(100);

        const statusGroups: Record<string, any[]> = {};
        leads?.forEach((lead: any) => {
          const status = lead.conversion_status || 'unknown';
          if (!statusGroups[status]) statusGroups[status] = [];
          statusGroups[status].push(lead);
        });

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentLeads = leads?.filter((l: any) => new Date(l.created_at) >= thirtyDaysAgo) || [];

        return {
          total_leads: leads?.length || 0,
          recent_leads_30d: recentLeads.length,
          by_status: statusGroups,
          conversion_rate: statusGroups.converted?.length / (leads?.length || 1),
          avg_lead_score: leads?.reduce((sum: number, l: any) => sum + (l.lead_score || 0), 0) / (leads?.length || 1)
        };
      }

      case "get_call_analytics": {
        const { data: calls } = await supabase
          .from('call_records')
          .select('caller_number, call_outcome, duration_seconds, call_score, created_at')
          .order('created_at', { ascending: false })
          .limit(100);

        const outcomes: Record<string, number> = {};
        calls?.forEach((call: any) => {
          const outcome = call.call_outcome || 'unknown';
          outcomes[outcome] = (outcomes[outcome] || 0) + 1;
        });

        return {
          total_calls: calls?.length || 0,
          outcomes,
          avg_duration: calls?.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) / (calls?.length || 1),
          avg_score: calls?.reduce((sum: number, c: any) => sum + (c.call_score || 0), 0) / (calls?.length || 1)
        };
      }

      case "get_pipeline_data": {
        const { data: deals } = await supabase
          .from('hubspot_deals')
          .select('dealname, amount, dealstage, pipeline, createdate')
          .order('createdate', { ascending: false });

        const byStage: Record<string, any[]> = {};
        deals?.forEach((deal: any) => {
          const stage = deal.dealstage || 'unknown';
          if (!byStage[stage]) byStage[stage] = [];
          byStage[stage].push(deal);
        });

        return {
          total_deals: deals?.length || 0,
          by_stage: byStage,
          stage_counts: Object.fromEntries(
            Object.entries(byStage).map(([stage, deals]) => [stage, deals.length])
          )
        };
      }

      // ===== ANALYSIS TOOLS =====
      case "compare_metrics": {
        const metricA = resolvedArgs.metric_a;
        const metricB = resolvedArgs.metric_b;
        const comparison_type = resolvedArgs.comparison_type || 'difference';

        if (!metricA || !metricB) {
          return { error: "Both metric_a and metric_b are required" };
        }

        // Extract numeric values
        const valueA = typeof metricA === 'object' ? extractNumericValue(metricA) : metricA;
        const valueB = typeof metricB === 'object' ? extractNumericValue(metricB) : metricB;

        const difference = valueA - valueB;
        const percentChange = valueB !== 0 ? (difference / valueB) * 100 : 0;

        return {
          metric_a: valueA,
          metric_b: valueB,
          difference,
          percent_change: percentChange,
          direction: difference > 0 ? 'increase' : difference < 0 ? 'decrease' : 'no_change',
          magnitude: Math.abs(percentChange) > 20 ? 'significant' : Math.abs(percentChange) > 5 ? 'moderate' : 'minor'
        };
      }

      case "calculate_trends": {
        const dataPoints = resolvedArgs.data_points || [];
        const metric = resolvedArgs.metric || 'value';

        if (!Array.isArray(dataPoints) || dataPoints.length < 2) {
          return { error: "Need at least 2 data points for trend analysis" };
        }

        // Simple linear regression
        const n = dataPoints.length;
        const sumX = dataPoints.reduce((sum: number, _: any, i: number) => sum + i, 0);
        const sumY = dataPoints.reduce((sum: number, p: any) => sum + (typeof p === 'number' ? p : p[metric] || 0), 0);
        const sumXY = dataPoints.reduce((sum: number, p: any, i: number) =>
          sum + i * (typeof p === 'number' ? p : p[metric] || 0), 0);
        const sumX2 = dataPoints.reduce((sum: number, _: any, i: number) => sum + i * i, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        return {
          trend: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'flat',
          slope,
          intercept,
          data_points: n,
          strength: Math.abs(slope) > 1 ? 'strong' : Math.abs(slope) > 0.1 ? 'moderate' : 'weak'
        };
      }

      case "identify_root_cause": {
        const metric = resolvedArgs.metric;
        const current = resolvedArgs.current;
        const previous = resolvedArgs.previous;

        // This is a simplified root cause analysis
        // In production, this would use more sophisticated analysis
        return {
          metric,
          current_value: current,
          previous_value: previous,
          change_detected: true,
          potential_causes: [
            "Seasonal variation",
            "Marketing campaign impact",
            "Competitor activity",
            "Economic factors",
            "Internal process changes"
          ],
          recommended_investigation: [
            "Review recent marketing spend",
            "Check competitor pricing",
            "Analyze customer feedback",
            "Review operational changes"
          ]
        };
      }

      case "detect_anomalies": {
        const { data, error } = await supabase.functions.invoke('anomaly-detector', {
          body: resolvedArgs
        });
        return error ? { error: error.message } : data;
      }

      // ===== INTELLIGENCE FUNCTIONS =====
      case "run_churn_predictor": {
        const { data, error } = await supabase.functions.invoke('churn-predictor', {
          body: resolvedArgs
        });
        return error ? { error: error.message } : data;
      }

      case "run_business_intelligence": {
        const { data, error } = await supabase.functions.invoke('business-intelligence', {
          body: resolvedArgs
        });
        return error ? { error: error.message } : data;
      }

      case "run_coach_analyzer": {
        const { data, error } = await supabase.functions.invoke('coach-analyzer', {
          body: resolvedArgs
        });
        return error ? { error: error.message } : data;
      }

      case "run_anomaly_detector": {
        const { data, error } = await supabase.functions.invoke('anomaly-detector', {
          body: resolvedArgs
        });
        return error ? { error: error.message } : data;
      }

      // ===== SYNTHESIS TOOLS =====
      case "aggregate_results": {
        const results = resolvedArgs.results || [];
        return {
          aggregated: true,
          total_items: results.length,
          combined_data: results
        };
      }

      case "generate_insights": {
        // This would typically call an AI to generate insights
        return {
          insights_generated: true,
          data_analyzed: resolvedArgs
        };
      }

      case "explain_difference": {
        const itemA = resolvedArgs.item_a;
        const itemB = resolvedArgs.item_b;
        return {
          comparison: "difference_explained",
          item_a: itemA,
          item_b: itemB,
          key_differences: ["Factor 1", "Factor 2", "Factor 3"]
        };
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`[Reasoning] Tool error (${toolName}):`, error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

// Helper function to resolve step references like "$step_1"
function resolveStepReferences(args: any, memory: WorkingMemory): any {
  if (typeof args === 'string' && args.startsWith('$step_')) {
    const stepNum = parseInt(args.replace('$step_', ''));
    const step = memory.decomposed_steps.find(s => s.step_number === stepNum);
    return step?.result || args;
  }

  if (typeof args === 'object' && args !== null) {
    const resolved: any = Array.isArray(args) ? [] : {};
    for (const key in args) {
      resolved[key] = resolveStepReferences(args[key], memory);
    }
    return resolved;
  }

  return args;
}

// Helper to extract numeric value from complex objects
function extractNumericValue(obj: any): number {
  if (typeof obj === 'number') return obj;
  if (typeof obj === 'string') return parseFloat(obj) || 0;

  // Try common property names
  const numericProps = ['value', 'amount', 'total', 'revenue', 'count', 'score'];
  for (const prop of numericProps) {
    if (obj[prop] !== undefined) {
      return typeof obj[prop] === 'number' ? obj[prop] : parseFloat(obj[prop]) || 0;
    }
  }

  // If object has nested structure, try to find first numeric value
  for (const key in obj) {
    if (typeof obj[key] === 'number') return obj[key];
  }

  return 0;
}

// ============= STEP EXECUTOR =============

async function executeStep(
  supabase: any,
  step: ReasoningStep,
  workingMemory: WorkingMemory
): Promise<ReasoningStep> {
  const startTime = Date.now();
  step.status = 'in_progress';

  console.log(`[Reasoning] Executing step ${step.step_number}: ${step.question}`);

  try {
    const result = await executeTool(supabase, step.tool_to_use, step.tool_args, workingMemory);

    step.result = result;
    step.execution_time_ms = Date.now() - startTime;
    step.status = 'completed';

    // Store in working memory
    workingMemory.intermediate_results[`step_${step.step_number}`] = result;

    // Generate conclusion for this step
    step.conclusion = generateStepConclusion(step);
    workingMemory.context_built.push(step.conclusion);

    console.log(`[Reasoning] Step ${step.step_number} completed in ${step.execution_time_ms}ms`);

    return step;
  } catch (error) {
    step.status = 'failed';
    step.error = error instanceof Error ? error.message : String(error);
    step.execution_time_ms = Date.now() - startTime;

    console.error(`[Reasoning] Step ${step.step_number} failed:`, error);

    return step;
  }
}

// Generate a human-readable conclusion for a step
function generateStepConclusion(step: ReasoningStep): string {
  const result = step.result;

  if (result?.error) {
    return `Step ${step.step_number}: Failed - ${result.error}`;
  }

  // Generate context-aware conclusion based on the result
  if (typeof result === 'object' && result !== null) {
    const summary = Object.keys(result).slice(0, 3).map(key => {
      const value = result[key];
      if (typeof value === 'number') {
        return `${key}: ${value.toFixed(2)}`;
      } else if (Array.isArray(value)) {
        return `${key}: ${value.length} items`;
      } else if (typeof value === 'object') {
        return `${key}: [object]`;
      }
      return `${key}: ${value}`;
    }).join(', ');

    return `Step ${step.step_number}: ${step.question} → ${summary}`;
  }

  return `Step ${step.step_number}: ${step.question} → ${JSON.stringify(result).slice(0, 100)}`;
}

// ============= CHAIN EXECUTORS =============

// Sequential execution: A → B → C (each depends on previous)
async function executeSequential(
  supabase: any,
  memory: WorkingMemory
): Promise<WorkingMemory> {
  console.log("[Reasoning] Executing SEQUENTIAL chain");

  for (const step of memory.decomposed_steps) {
    await executeStep(supabase, step, memory);

    // Stop if a critical step fails
    if (step.status === 'failed' && step.step_number < memory.decomposed_steps.length) {
      console.log(`[Reasoning] Sequential chain stopped at step ${step.step_number} due to failure`);
      break;
    }
  }

  return memory;
}

// Parallel execution: Run all independent steps at once
async function executeParallel(
  supabase: any,
  memory: WorkingMemory
): Promise<WorkingMemory> {
  console.log("[Reasoning] Executing PARALLEL chain");

  // Execute all steps in parallel
  const stepPromises = memory.decomposed_steps.map(step =>
    executeStep(supabase, step, memory)
  );

  await Promise.all(stepPromises);

  return memory;
}

// Conditional execution: Branch based on results
async function executeConditional(
  supabase: any,
  memory: WorkingMemory
): Promise<WorkingMemory> {
  console.log("[Reasoning] Executing CONDITIONAL chain");

  // First, execute all steps without dependencies
  const independentSteps = memory.decomposed_steps.filter(step => {
    const deps = memory.execution_plan?.dependencies[step.step_number] || [];
    return deps.length === 0;
  });

  for (const step of independentSteps) {
    await executeStep(supabase, step, memory);
  }

  // Then execute dependent steps based on conditions
  const dependentSteps = memory.decomposed_steps.filter(step => {
    const deps = memory.execution_plan?.dependencies[step.step_number] || [];
    return deps.length > 0;
  });

  for (const step of dependentSteps) {
    // Check if dependencies are met
    const deps = memory.execution_plan?.dependencies[step.step_number] || [];
    const depsMet = deps.every(depNum => {
      const depStep = memory.decomposed_steps.find(s => s.step_number === depNum);
      return depStep?.status === 'completed';
    });

    if (depsMet) {
      await executeStep(supabase, step, memory);
    } else {
      step.status = 'failed';
      step.error = 'Dependencies not met';
    }
  }

  return memory;
}

// ============= FINAL SYNTHESIS =============

async function synthesizeFinalAnswer(
  anthropic: Anthropic,
  memory: WorkingMemory
): Promise<string> {
  console.log("[Reasoning] Synthesizing final answer");

  // Build context from all step conclusions
  const stepsContext = memory.decomposed_steps
    .filter(step => step.status === 'completed')
    .map(step => `Step ${step.step_number}: ${step.question}\nResult: ${JSON.stringify(step.result, null, 2)}\nConclusion: ${step.conclusion}`)
    .join('\n\n---\n\n');

  const prompt = `You are a business analyst synthesizing the results of a multi-step analysis.

ORIGINAL QUESTION: "${memory.original_query}"

REASONING STEPS COMPLETED:
${stepsContext}

TASK:
1. Synthesize all step results into a coherent final answer
2. Directly answer the original question
3. Provide specific numbers, names, and actionable insights
4. Explain the reasoning chain you followed
5. Highlight any important findings or red flags

OUTPUT FORMAT:
Provide a clear, well-structured answer with:
- Direct answer to the question (2-3 sentences)
- Key findings (bullet points)
- Reasoning trace (how you arrived at the answer)
- Recommended actions (if applicable)

Be concise but thorough. Use the actual data from the steps.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }]
    });

    const synthesis = response.content.find(block => block.type === "text")?.text ||
                     "Unable to synthesize answer";

    return synthesis;
  } catch (error) {
    console.error("[Reasoning] Synthesis failed:", error);

    // Fallback: Create basic synthesis
    const completedSteps = memory.decomposed_steps.filter(s => s.status === 'completed');
    return `Analysis complete. Executed ${completedSteps.length} steps successfully.\n\n` +
           `Key findings:\n${memory.context_built.join('\n')}`;
  }
}

// ============= MAIN REASONING ENGINE =============

async function runReasoningChain(
  supabase: any,
  anthropic: Anthropic,
  query: string,
  context: string = ""
): Promise<WorkingMemory> {
  console.log("[Reasoning] Starting reasoning chain for:", query);
  const startTime = Date.now();

  // 1. Decompose query into steps
  const decomposition = await decomposeQuery(anthropic, query, context);

  // 2. Initialize working memory
  const memory: WorkingMemory = {
    original_query: query,
    decomposed_steps: decomposition.steps,
    intermediate_results: {},
    context_built: [],
    execution_plan: {
      chain_type: decomposition.chain_type,
      total_steps: decomposition.steps.length,
      estimated_duration_ms: decomposition.steps.length * 2000, // Rough estimate
      dependencies: decomposition.dependencies
    }
  };

  // 3. Execute based on chain type
  switch (decomposition.chain_type) {
    case 'sequential':
      await executeSequential(supabase, memory);
      break;
    case 'parallel':
      await executeParallel(supabase, memory);
      break;
    case 'conditional':
      await executeConditional(supabase, memory);
      break;
  }

  // 4. Synthesize final answer
  memory.final_synthesis = await synthesizeFinalAnswer(anthropic, memory);

  const totalTime = Date.now() - startTime;
  console.log(`[Reasoning] Chain completed in ${totalTime}ms`);

  return memory;
}

// ============= HTTP HANDLER =============

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { query, context, mode = 'full' } = await req.json();

    if (!query) {
      throw new Error("Query is required");
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    console.log(`[PTD Reasoning] Processing query: "${query}"`);

    // Run the reasoning chain
    const result = await runReasoningChain(supabase, anthropic, query, context);

    // Save reasoning trace to database
    await supabase.from('reasoning_traces').insert({
      query,
      chain_type: result.execution_plan?.chain_type,
      total_steps: result.decomposed_steps.length,
      completed_steps: result.decomposed_steps.filter(s => s.status === 'completed').length,
      failed_steps: result.decomposed_steps.filter(s => s.status === 'failed').length,
      execution_time_ms: result.decomposed_steps.reduce((sum, s) => sum + (s.execution_time_ms || 0), 0),
      steps_trace: result.decomposed_steps,
      final_answer: result.final_synthesis,
      created_at: new Date().toISOString()
    }).catch(err => console.error("Failed to save reasoning trace:", err));

    // Return result
    if (mode === 'full') {
      return new Response(JSON.stringify({
        success: true,
        query,
        chain_type: result.execution_plan?.chain_type,
        steps: result.decomposed_steps,
        final_answer: result.final_synthesis,
        execution_summary: {
          total_steps: result.decomposed_steps.length,
          completed: result.decomposed_steps.filter(s => s.status === 'completed').length,
          failed: result.decomposed_steps.filter(s => s.status === 'failed').length,
          total_time_ms: result.decomposed_steps.reduce((sum, s) => sum + (s.execution_time_ms || 0), 0)
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } else {
      // Compact mode: just the answer
      return new Response(JSON.stringify({
        success: true,
        answer: result.final_synthesis
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

  } catch (error) {
    console.error("[PTD Reasoning] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
