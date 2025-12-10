import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// FUNCTION CHAIN ROUTER - The 100x Brain
// Connects all 36 Edge Functions intelligently
// ============================================

// Registry of all available functions with their capabilities
const FUNCTION_REGISTRY: Record<string, FunctionMeta> = {
    // INTELLIGENCE LAYER
    'ptd-agent-gemini': {
        category: 'intelligence',
        description: 'Main AI agent with RAG and memory',
        inputs: ['query', 'thread_id'],
        outputs: ['response', 'citations'],
        chainable: true,
    },
    'ptd-orchestrator': {
        category: 'intelligence',
        description: 'Multi-agent semantic router',
        inputs: ['query'],
        outputs: ['response', 'agents_used'],
        chainable: true,
    },
    'ptd-reflect': {
        category: 'intelligence',
        description: 'Self-critique and improvement loop',
        inputs: ['query', 'initial_response'],
        outputs: ['improved_response', 'score'],
        chainable: true,
    },
    'ptd-reasoning': {
        category: 'intelligence',
        description: 'Multi-step chain-of-thought',
        inputs: ['query'],
        outputs: ['reasoning_chain', 'answer'],
        chainable: true,
    },
    'ptd-proactive': {
        category: 'intelligence',
        description: 'Anomaly detection and alerts',
        inputs: ['check_type'],
        outputs: ['alerts', 'recommendations'],
        chainable: true,
    },
    'ptd-knowledge-graph': {
        category: 'intelligence',
        description: 'Entity relationships and graph queries',
        inputs: ['action', 'entity'],
        outputs: ['graph_result'],
        chainable: true,
    },
    'ptd-feedback': {
        category: 'intelligence',
        description: 'Learn from user corrections',
        inputs: ['feedback_type', 'content'],
        outputs: ['learned'],
        chainable: true,
    },

    // DATA SYNC LAYER
    'sync-hubspot-to-supabase': {
        category: 'sync',
        description: 'Sync HubSpot contacts and deals',
        inputs: ['sync_type'],
        outputs: ['records_synced'],
        chainable: true,
    },
    'stripe-sync': {
        category: 'sync',
        description: 'Sync Stripe payments and subscriptions',
        inputs: [],
        outputs: ['payments_synced'],
        chainable: true,
    },
    'meta-capi': {
        category: 'sync',
        description: 'Send conversions to Meta',
        inputs: ['event_name', 'user_data'],
        outputs: ['event_id'],
        chainable: true,
    },

    // BUSINESS LOGIC LAYER
    'business-intelligence': {
        category: 'business',
        description: 'Daily executive briefing',
        inputs: [],
        outputs: ['analysis', 'action_plan'],
        chainable: true,
    },
    'calculate-health-scores': {
        category: 'business',
        description: 'Recalculate client health scores',
        inputs: [],
        outputs: ['scores_updated'],
        chainable: true,
    },
    'generate-lead-reply': {
        category: 'business',
        description: 'AI-powered lead responses',
        inputs: ['lead_id'],
        outputs: ['reply_generated'],
        chainable: true,
    },
    'smart-followup': {
        category: 'business',
        description: 'Smart follow-up scheduling',
        inputs: ['lead_id'],
        outputs: ['followup_scheduled'],
        chainable: true,
    },

    // LEARNING LAYER
    'ptd-self-learn': {
        category: 'learning',
        description: 'Discover system structure and patterns',
        inputs: [],
        outputs: ['learned'],
        chainable: true,
    },
    'generate-embeddings': {
        category: 'learning',
        description: 'Generate vector embeddings',
        inputs: ['texts'],
        outputs: ['embeddings'],
        chainable: true,
    },
};

interface FunctionMeta {
    category: string;
    description: string;
    inputs: string[];
    outputs: string[];
    chainable: boolean;
}

interface ChainStep {
    function_name: string;
    params: Record<string, any>;
    condition?: string;
    timeout_ms?: number;
}

interface ExecutionContext {
    chain_id?: string;
    step_index: number;
    accumulated_results: Record<string, any>;
    start_time: number;
}

// Main request handler
serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    try {
        const body = await req.json();
        const { action, chain_name, event, function_name, params } = body;

        // Route based on action type
        switch (action) {
            case 'execute_chain':
                return await executeChain(supabase, chain_name, params || {});

            case 'process_event':
                return await processEvent(supabase, event);

            case 'call_function':
                return await callFunction(supabase, function_name, params || {});

            case 'get_registry':
                return new Response(JSON.stringify({
                    success: true,
                    registry: FUNCTION_REGISTRY,
                    total_functions: Object.keys(FUNCTION_REGISTRY).length
                }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

            case 'suggest_chain':
                return await suggestChain(supabase, body.query);

            default:
                return new Response(JSON.stringify({
                    error: 'Invalid action. Use: execute_chain, process_event, call_function, get_registry, suggest_chain'
                }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

    } catch (error) {
        console.error('Function Chain Router Error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});

// Execute a pre-defined function chain
async function executeChain(
    supabase: any,
    chainName: string,
    initialParams: Record<string, any>
): Promise<Response> {
    console.log(`[Chain Router] Executing chain: ${chainName}`);

    // Get chain definition
    const { data: chain, error } = await supabase
        .from('function_chains')
        .select('*')
        .eq('chain_name', chainName)
        .single();

    if (error || !chain) {
        return new Response(JSON.stringify({
            success: false,
            error: `Chain not found: ${chainName}`
        }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const context: ExecutionContext = {
        chain_id: chain.id,
        step_index: 0,
        accumulated_results: { ...initialParams },
        start_time: Date.now()
    };

    const steps = chain.steps as ChainStep[];
    const results: any[] = [];

    for (const step of steps) {
        context.step_index++;

        // Check condition if present
        if (step.condition && !evaluateCondition(step.condition, context.accumulated_results)) {
            console.log(`[Chain] Skipping step ${context.step_index}: condition not met`);
            continue;
        }

        // Resolve parameters with accumulated results
        const resolvedParams = resolveParams(step.params, context.accumulated_results);

        // Execute the function
        const startMs = Date.now();
        const result = await invokeFunctionInternal(
            supabase,
            step.function_name,
            resolvedParams,
            step.timeout_ms || 30000
        );

        const durationMs = Date.now() - startMs;

        // Log execution
        await supabase.from('function_executions').insert({
            function_name: step.function_name,
            chain_id: chain.id,
            input_params: resolvedParams,
            output_result: result,
            status: result.success ? 'success' : 'error',
            duration_ms: durationMs,
            error_message: result.error || null,
            completed_at: new Date().toISOString()
        });

        results.push({
            step: context.step_index,
            function: step.function_name,
            result,
            duration_ms: durationMs
        });

        // Accumulate results for next steps
        if (result.success && result.data) {
            context.accumulated_results = {
                ...context.accumulated_results,
                [`step_${context.step_index}`]: result.data,
                last_result: result.data
            };
        }

        // Stop chain on critical error
        if (!result.success && result.critical) {
            console.error(`[Chain] Critical error at step ${context.step_index}, stopping chain`);
            break;
        }
    }

    // Update chain stats
    await supabase.from('function_chains')
        .update({
            last_run_at: new Date().toISOString(),
            run_count: chain.run_count + 1,
            avg_duration_ms: Math.round(
                ((chain.avg_duration_ms || 0) * chain.run_count + (Date.now() - context.start_time)) /
                (chain.run_count + 1)
            )
        })
        .eq('id', chain.id);

    return new Response(JSON.stringify({
        success: true,
        chain_name: chainName,
        steps_executed: results.length,
        total_duration_ms: Date.now() - context.start_time,
        results,
        final_output: context.accumulated_results.last_result
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Process an event from the event bus
async function processEvent(supabase: any, event: any): Promise<Response> {
    const { event_type, payload, event_id } = event;

    console.log(`[Chain Router] Processing event: ${event_type}`);

    // Find chains triggered by this event type
    const { data: chains } = await supabase
        .from('function_chains')
        .select('*')
        .eq('trigger_type', 'event')
        .eq('enabled', true);

    const matchingChains = chains?.filter((c: any) =>
        c.trigger_config?.event_type === event_type
    ) || [];

    if (matchingChains.length === 0) {
        return new Response(JSON.stringify({
            success: true,
            message: `No chains registered for event: ${event_type}`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Execute all matching chains in parallel
    const chainResults = await Promise.all(
        matchingChains.map(async (chain: any) => {
            const response = await executeChain(supabase, chain.chain_name, payload);
            return response.json();
        })
    );

    // Mark event as processed
    if (event_id) {
        await supabase.from('event_bus')
            .update({
                processed: true,
                processed_by: matchingChains.map((c: any) => c.chain_name),
                processed_at: new Date().toISOString()
            })
            .eq('id', event_id);
    }

    return new Response(JSON.stringify({
        success: true,
        event_type,
        chains_executed: matchingChains.length,
        results: chainResults
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Call a single function directly
async function callFunction(
    supabase: any,
    functionName: string,
    params: Record<string, any>
): Promise<Response> {
    if (!FUNCTION_REGISTRY[functionName]) {
        return new Response(JSON.stringify({
            success: false,
            error: `Unknown function: ${functionName}`,
            available: Object.keys(FUNCTION_REGISTRY)
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const startMs = Date.now();
    const result = await invokeFunctionInternal(supabase, functionName, params);

    // Log execution
    await supabase.from('function_executions').insert({
        function_name: functionName,
        input_params: params,
        output_result: result,
        status: result.success ? 'success' : 'error',
        duration_ms: Date.now() - startMs,
        completed_at: new Date().toISOString()
    });

    return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}

// Internal function invocation
async function invokeFunctionInternal(
    supabase: any,
    functionName: string,
    params: Record<string, any>,
    timeoutMs: number = 30000
): Promise<{ success: boolean; data?: any; error?: string; critical?: boolean }> {
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(
            `${supabaseUrl}/functions/v1/${functionName}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${serviceKey}`
                },
                body: JSON.stringify(params),
                signal: controller.signal
            }
        );

        clearTimeout(timeoutId);

        const data = await response.json();

        return {
            success: response.ok,
            data,
            error: response.ok ? undefined : data.error || 'Function failed',
            critical: response.status >= 500
        };

    } catch (error) {
        const isTimeout = error instanceof Error && error.name === 'AbortError';
        return {
            success: false,
            error: isTimeout ? 'Function timeout' : String(error),
            critical: true
        };
    }
}

// Suggest optimal chain for a query
async function suggestChain(supabase: any, query: string): Promise<Response> {
    const q = query.toLowerCase();

    // Intent detection
    const intents: Record<string, string[]> = {
        'morning_briefing': ['how is business', 'daily report', 'summary', 'briefing'],
        'lead_processing': ['new lead', 'process lead', 'lead came in'],
        'health_intervention': ['at risk', 'churn', 'health drop', 'red zone'],
        'sync_pipeline': ['sync', 'update data', 'refresh'],
        'intelligence_loop': ['learn', 'improve', 'patterns']
    };

    let suggestedChain = null;
    let confidence = 0;

    for (const [chain, keywords] of Object.entries(intents)) {
        const matches = keywords.filter(k => q.includes(k)).length;
        const chainConfidence = matches / keywords.length;
        if (chainConfidence > confidence) {
            confidence = chainConfidence;
            suggestedChain = chain;
        }
    }

    // If no chain matches, suggest individual functions
    if (!suggestedChain || confidence < 0.3) {
        const suggestedFunctions: string[] = [];

        if (q.includes('health') || q.includes('client')) {
            suggestedFunctions.push('calculate-health-scores', 'ptd-proactive');
        }
        if (q.includes('lead') || q.includes('follow')) {
            suggestedFunctions.push('generate-lead-reply', 'smart-followup');
        }
        if (q.includes('sync') || q.includes('hubspot')) {
            suggestedFunctions.push('sync-hubspot-to-supabase');
        }
        if (q.includes('question') || q.includes('ask')) {
            suggestedFunctions.push('ptd-orchestrator', 'ptd-agent-gemini');
        }

        return new Response(JSON.stringify({
            success: true,
            suggestion_type: 'functions',
            suggested_functions: suggestedFunctions.length > 0 ? suggestedFunctions : ['ptd-orchestrator'],
            confidence: 0.5,
            hint: 'No specific chain matched. Consider using these individual functions.'
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
        success: true,
        suggestion_type: 'chain',
        suggested_chain: suggestedChain,
        confidence,
        hint: `Use action: 'execute_chain' with chain_name: '${suggestedChain}'`
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Evaluate a condition string
function evaluateCondition(condition: string, context: Record<string, any>): boolean {
    try {
        // Simple evaluation - supports: key == value, key > value, key < value, key != value
        const match = condition.match(/(\w+)\s*(==|!=|>|<|>=|<=)\s*(.+)/);
        if (!match) return true;

        const [, key, op, valueStr] = match;
        const contextValue = context[key];
        const compareValue = isNaN(Number(valueStr)) ? valueStr.replace(/['"]/g, '') : Number(valueStr);

        switch (op) {
            case '==': return contextValue == compareValue;
            case '!=': return contextValue != compareValue;
            case '>': return contextValue > compareValue;
            case '<': return contextValue < compareValue;
            case '>=': return contextValue >= compareValue;
            case '<=': return contextValue <= compareValue;
            default: return true;
        }
    } catch {
        return true;
    }
}

// Resolve parameter templates with context values
function resolveParams(
    params: Record<string, any>,
    context: Record<string, any>
): Record<string, any> {
    const resolved: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
            const contextKey = value.slice(2, -2).trim();
            resolved[key] = context[contextKey] ?? value;
        } else if (typeof value === 'object' && value !== null) {
            resolved[key] = resolveParams(value, context);
        } else {
            resolved[key] = value;
        }
    }

    return resolved;
}
