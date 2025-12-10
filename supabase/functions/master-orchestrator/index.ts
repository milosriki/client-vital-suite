import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// MASTER ORCHESTRATOR - The 100x Brain
// Single entry point for all AI operations
// Combines: Router + Memory + Learning + Actions
// ============================================

interface OrchestratorRequest {
    query: string;
    thread_id?: string;
    user_id?: string;
    mode?: 'fast' | 'thorough' | 'auto';
    include_actions?: boolean;
}

interface OrchestratorResponse {
    success: boolean;
    response: string;
    confidence: number;
    sources: string[];
    actions_taken: ActionResult[];
    thinking?: string[];
    metrics: {
        total_time_ms: number;
        agents_consulted: number;
        memory_hits: number;
        knowledge_hits: number;
    };
}

interface ActionResult {
    action: string;
    status: 'success' | 'failed' | 'skipped';
    result?: any;
}

// Agent definitions with their specializations
const AGENT_SPECIALIZATIONS = {
    'ptd-agent-gemini': {
        keywords: ['general', 'question', 'help', 'what', 'how', 'why'],
        description: 'General purpose AI with RAG',
        confidence_boost: 0.1
    },
    'business-intelligence': {
        keywords: ['business', 'report', 'summary', 'kpi', 'metrics', 'performance'],
        description: 'Business analysis and reporting',
        confidence_boost: 0.2
    },
    'ptd-proactive': {
        keywords: ['alert', 'risk', 'churn', 'anomaly', 'warning', 'critical'],
        description: 'Proactive monitoring and alerts',
        confidence_boost: 0.15
    },
    'ptd-reasoning': {
        keywords: ['analyze', 'calculate', 'compare', 'evaluate', 'complex'],
        description: 'Multi-step reasoning',
        confidence_boost: 0.2
    },
    'ptd-knowledge-graph': {
        keywords: ['relationship', 'connected', 'graph', 'entity', 'coach', 'client'],
        description: 'Entity relationships',
        confidence_boost: 0.15
    }
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    try {
        const body: OrchestratorRequest = await req.json();
        const { query, thread_id, user_id, mode = 'auto', include_actions = true } = body;

        if (!query) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Query is required'
            }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        console.log(`[Orchestrator] Processing: "${query.slice(0, 50)}..." Mode: ${mode}`);

        // ============================================
        // PHASE 1: MEMORY RECALL
        // ============================================
        const memories = await recallMemories(supabase, query, thread_id);
        const memoryContext = memories.length > 0
            ? `\n\nRELEVANT MEMORIES:\n${memories.map((m, i) => `[${i + 1}] Q: "${m.query}" → A: "${m.response?.slice(0, 200)}..."`).join('\n')}`
            : '';

        // ============================================
        // PHASE 2: KNOWLEDGE RETRIEVAL
        // ============================================
        const knowledge = await retrieveKnowledge(supabase, query);
        const knowledgeContext = knowledge.length > 0
            ? `\n\nRELEVANT KNOWLEDGE:\n${knowledge.map((k, i) => `[${i + 1}] ${k.topic}: ${k.content?.slice(0, 200)}...`).join('\n')}`
            : '';

        // ============================================
        // PHASE 3: AGENT SELECTION
        // ============================================
        const selectedAgents = selectAgents(query, mode);
        console.log(`[Orchestrator] Selected agents: ${selectedAgents.join(', ')}`);

        // ============================================
        // PHASE 4: PARALLEL AGENT EXECUTION
        // ============================================
        const agentResults = await executeAgents(supabase, selectedAgents, query, memoryContext + knowledgeContext);

        // ============================================
        // PHASE 5: RESPONSE SYNTHESIS
        // ============================================
        const synthesized = await synthesizeResponse(supabase, query, agentResults, memories, knowledge);

        // ============================================
        // PHASE 6: ACTION EXECUTION (if enabled)
        // ============================================
        const actions: ActionResult[] = [];
        if (include_actions) {
            const detectedActions = detectActions(query, synthesized.response);
            for (const action of detectedActions) {
                const result = await executeAction(supabase, action);
                actions.push(result);
            }
        }

        // ============================================
        // PHASE 7: MEMORY STORAGE
        // ============================================
        await storeInteraction(supabase, {
            query,
            response: synthesized.response,
            thread_id,
            user_id,
            agents_used: selectedAgents,
            confidence: synthesized.confidence
        });

        // ============================================
        // PHASE 8: PATTERN LEARNING
        // ============================================
        await learnFromInteraction(supabase, query, synthesized.response, synthesized.confidence);

        const totalTime = Date.now() - startTime;
        console.log(`[Orchestrator] Complete in ${totalTime}ms`);

        const response: OrchestratorResponse = {
            success: true,
            response: synthesized.response,
            confidence: synthesized.confidence,
            sources: synthesized.sources,
            actions_taken: actions,
            thinking: mode === 'thorough' ? synthesized.thinking : undefined,
            metrics: {
                total_time_ms: totalTime,
                agents_consulted: selectedAgents.length,
                memory_hits: memories.length,
                knowledge_hits: knowledge.length
            }
        };

        return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error('[Orchestrator] Error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            metrics: { total_time_ms: Date.now() - startTime }
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});

// Recall relevant memories using semantic search
async function recallMemories(supabase: any, query: string, threadId?: string): Promise<any[]> {
    try {
        // First try thread-specific memories
        if (threadId) {
            const { data: threadMemories } = await supabase
                .from('agent_memory')
                .select('query, response, knowledge_extracted')
                .eq('thread_id', threadId)
                .order('created_at', { ascending: false })
                .limit(5);

            if (threadMemories && threadMemories.length > 0) {
                return threadMemories;
            }
        }

        // Try semantic search via embeddings
        const { data: semanticMemories } = await supabase
            .from('agent_memory')
            .select('query, response, knowledge_extracted, similarity')
            .textSearch('query', query.split(' ').slice(0, 5).join(' | '))
            .limit(5);

        return semanticMemories || [];
    } catch (e) {
        console.error('Memory recall error:', e);
        return [];
    }
}

// Retrieve relevant knowledge entries
async function retrieveKnowledge(supabase: any, query: string): Promise<any[]> {
    try {
        const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3);

        // Category detection
        const categoryMap: Record<string, string[]> = {
            'health': ['health', 'score', 'zone', 'churn', 'risk'],
            'leads': ['lead', 'follow', 'contact', 'prospect'],
            'coach': ['coach', 'trainer', 'performance', 'utilization'],
            'revenue': ['revenue', 'deal', 'money', 'payment', 'stripe'],
            'system': ['sync', 'error', 'api', 'system']
        };

        let matchedCategory = 'general';
        for (const [category, catKeywords] of Object.entries(categoryMap)) {
            if (keywords.some(k => catKeywords.includes(k))) {
                matchedCategory = category;
                break;
            }
        }

        const { data } = await supabase
            .from('knowledge_base')
            .select('topic, content, category')
            .eq('category', matchedCategory)
            .limit(5);

        return data || [];
    } catch (e) {
        console.error('Knowledge retrieval error:', e);
        return [];
    }
}

// Select best agents for the query
function selectAgents(query: string, mode: string): string[] {
    const q = query.toLowerCase();
    const scores: Record<string, number> = {};

    for (const [agent, spec] of Object.entries(AGENT_SPECIALIZATIONS)) {
        let score = 0;
        for (const keyword of spec.keywords) {
            if (q.includes(keyword)) {
                score += 1 + spec.confidence_boost;
            }
        }
        scores[agent] = score;
    }

    // Sort by score
    const sorted = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .map(([agent]) => agent);

    // Return based on mode
    switch (mode) {
        case 'fast':
            return sorted.slice(0, 1);
        case 'thorough':
            return sorted.slice(0, 3);
        default: // auto
            return sorted.filter((_, i) => i < 2 || scores[sorted[i]] > 0.5);
    }
}

// Execute selected agents in parallel
async function executeAgents(
    supabase: any,
    agents: string[],
    query: string,
    context: string
): Promise<Record<string, any>> {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const results: Record<string, any> = {};

    await Promise.all(agents.map(async (agent) => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000);

            const response = await fetch(`${supabaseUrl}/functions/v1/${agent}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${serviceKey}`
                },
                body: JSON.stringify({
                    query: query + context,
                    orchestrated: true
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                results[agent] = await response.json();
            } else {
                results[agent] = { error: `HTTP ${response.status}` };
            }
        } catch (e) {
            results[agent] = { error: String(e) };
        }
    }));

    return results;
}

// Synthesize final response from all agent outputs
async function synthesizeResponse(
    supabase: any,
    query: string,
    agentResults: Record<string, any>,
    memories: any[],
    knowledge: any[]
): Promise<{ response: string; confidence: number; sources: string[]; thinking: string[] }> {
    const thinking: string[] = [];
    const sources: string[] = [];
    let confidence = 0.5;

    // Collect all responses
    const responses: string[] = [];
    for (const [agent, result] of Object.entries(agentResults)) {
        if (result.error) {
            thinking.push(`${agent}: Failed - ${result.error}`);
            continue;
        }

        const responseText = result.response || result.analysis?.executive_summary || result.answer || JSON.stringify(result);
        if (responseText && typeof responseText === 'string') {
            responses.push(responseText);
            sources.push(agent);
            thinking.push(`${agent}: Responded successfully`);
        }
    }

    // Add memory context
    if (memories.length > 0) {
        thinking.push(`Found ${memories.length} relevant memories`);
        confidence += 0.1;
    }

    // Add knowledge context
    if (knowledge.length > 0) {
        thinking.push(`Found ${knowledge.length} knowledge entries`);
        confidence += 0.1;
        sources.push(...knowledge.map(k => `knowledge:${k.category}`));
    }

    // If we have multiple responses, use AI to synthesize
    let finalResponse: string;

    if (responses.length > 1) {
        const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

        if (ANTHROPIC_API_KEY) {
            try {
                const synthesisPrompt = `
                User Question: ${query}

                Agent Responses:
                ${responses.map((r, i) => `[${i + 1}] ${r}`).join('\n\n')}

                Synthesize these responses into a single, coherent answer.
                Be concise and direct. Include the most important information from all sources.
                `;

                const response = await fetch("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01"
                    },
                    body: JSON.stringify({
                        model: "claude-sonnet-4-20250514",
                        max_tokens: 500,
                        messages: [{ role: "user", content: synthesisPrompt }]
                    })
                });

                const data = await response.json();
                finalResponse = data.content?.[0]?.text || responses[0];
                confidence += 0.2;
                thinking.push('Synthesized multiple responses with Claude');
            } catch (e) {
                finalResponse = responses[0];
                thinking.push(`Synthesis failed: ${e}`);
            }
        } else {
            // Simple merge without AI
            finalResponse = responses.join('\n\n---\n\n');
        }
    } else if (responses.length === 1) {
        finalResponse = responses[0];
        confidence += 0.15;
    } else {
        finalResponse = "I couldn't find a good answer to your question. Could you try rephrasing it?";
        confidence = 0.2;
    }

    return {
        response: finalResponse,
        confidence: Math.min(confidence, 1.0),
        sources,
        thinking
    };
}

// Detect actions that should be taken based on query/response
function detectActions(query: string, response: string): string[] {
    const actions: string[] = [];
    const combined = `${query} ${response}`.toLowerCase();

    // Action detection rules
    const actionRules: Record<string, string[]> = {
        'send_alert': ['urgent', 'critical', 'alert', 'immediate action'],
        'update_health': ['health score', 'recalculate', 'health update'],
        'schedule_followup': ['follow up', 'schedule call', 'contact soon'],
        'sync_data': ['sync', 'refresh data', 'update from hubspot']
    };

    for (const [action, keywords] of Object.entries(actionRules)) {
        if (keywords.some(k => combined.includes(k))) {
            actions.push(action);
        }
    }

    return actions.slice(0, 3); // Limit to 3 actions
}

// Execute detected actions
async function executeAction(supabase: any, action: string): Promise<ActionResult> {
    console.log(`[Orchestrator] Executing action: ${action}`);

    try {
        switch (action) {
            case 'send_alert':
                // Log alert to event bus
                await supabase.from('event_bus').insert({
                    event_type: 'alert.triggered',
                    event_source: 'master-orchestrator',
                    payload: { action, triggered_at: new Date().toISOString() },
                    priority: 8
                });
                return { action, status: 'success', result: 'Alert logged' };

            case 'update_health':
                // Trigger health recalculation
                await supabase.from('event_bus').insert({
                    event_type: 'health.recalculate',
                    event_source: 'master-orchestrator',
                    payload: { full: false },
                    priority: 5
                });
                return { action, status: 'success', result: 'Health recalc triggered' };

            case 'schedule_followup':
                return { action, status: 'skipped', result: 'Requires human confirmation' };

            case 'sync_data':
                await supabase.from('event_bus').insert({
                    event_type: 'sync.requested',
                    event_source: 'master-orchestrator',
                    payload: { platforms: ['hubspot'] },
                    priority: 6
                });
                return { action, status: 'success', result: 'Sync requested' };

            default:
                return { action, status: 'skipped', result: 'Unknown action' };
        }
    } catch (e) {
        return { action, status: 'failed', result: String(e) };
    }
}

// Store interaction in memory
async function storeInteraction(supabase: any, data: {
    query: string;
    response: string;
    thread_id?: string;
    user_id?: string;
    agents_used: string[];
    confidence: number;
}): Promise<void> {
    try {
        await supabase.from('agent_memory').insert({
            query: data.query,
            response: data.response,
            thread_id: data.thread_id || `orchestrator_${Date.now()}`,
            knowledge_extracted: {
                agents_used: data.agents_used,
                confidence: data.confidence,
                timestamp: new Date().toISOString()
            }
        });
    } catch (e) {
        console.error('Failed to store interaction:', e);
    }
}

// Learn patterns from successful interactions
async function learnFromInteraction(
    supabase: any,
    query: string,
    response: string,
    confidence: number
): Promise<void> {
    if (confidence < 0.7) return; // Only learn from high-confidence interactions

    try {
        // Extract potential pattern
        const queryType = detectQueryType(query);
        const patternName = `query_${queryType}_${Date.now()}`;

        // Check if similar pattern exists
        const { data: existing } = await supabase
            .from('learned_patterns')
            .select('id, times_matched')
            .eq('pattern_type', 'query')
            .textSearch('description', query.split(' ').slice(0, 3).join(' | '))
            .limit(1);

        if (existing && existing.length > 0) {
            // Update existing pattern
            await supabase.from('learned_patterns')
                .update({
                    times_matched: existing[0].times_matched + 1,
                    times_successful: existing[0].times_matched + 1,
                    confidence: Math.min(confidence + 0.05, 1.0),
                    last_matched_at: new Date().toISOString()
                })
                .eq('id', existing[0].id);
        }
        // Don't create new patterns automatically - let them emerge from feedback
    } catch (e) {
        console.error('Pattern learning error:', e);
    }
}

// Detect query type for pattern learning
function detectQueryType(query: string): string {
    const q = query.toLowerCase();
    if (q.includes('how')) return 'how_to';
    if (q.includes('why')) return 'explanation';
    if (q.includes('what')) return 'definition';
    if (q.includes('show') || q.includes('list')) return 'retrieval';
    if (q.includes('compare')) return 'comparison';
    return 'general';
}
