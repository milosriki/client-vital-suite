import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { buildUnifiedPromptForEdgeFunction } from "../_shared/unified-prompts.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= DYNAMIC KNOWLEDGE LOADING =============
async function loadDynamicKnowledge(supabase: any): Promise<string> {
  try {
    const [structure, patterns, interactions] = await Promise.all([
      supabase.from('agent_context').select('value').eq('key', 'system_structure').single(),
      supabase.from('agent_context').select('value').eq('key', 'data_patterns').single(),
      supabase.from('agent_context').select('value').eq('key', 'interaction_patterns').single()
    ]);

    const structureData = structure.data?.value || {};
    const patternData = patterns.data?.value || {};
    const interactionData = interactions.data?.value || {};

    return `
## DYNAMIC SYSTEM KNOWLEDGE (Auto-Discovered)

### DISCOVERED STRUCTURE (${structureData.discovered_at || 'Not yet discovered'})
Tables (${structureData.tables?.length || 0}): ${structureData.tables?.slice(0, 25).map((t: any) => `${t.name}(${t.rows})`).join(', ') || 'Run self-learn first'}
Functions (${structureData.functions?.length || 0}): ${structureData.functions?.slice(0, 15).map((f: any) => f.name).join(', ') || 'Run self-learn first'}

### CURRENT DATA PATTERNS (${patternData.analyzed_at || 'Not analyzed'})
Health Zones: ${JSON.stringify(patternData.health_zones || {})}
Active Coaches: ${Object.keys(patternData.coaches || {}).slice(0, 5).join(', ') || 'None'}
Event Types: ${JSON.stringify(patternData.event_types || {})}
Call Outcomes: ${JSON.stringify(patternData.call_outcomes || {})}
Deal Stages: ${JSON.stringify(patternData.deal_stages || {})}
Avg Health Score: ${patternData.avg_health || 'N/A'}
Avg Deal Value: ${patternData.avg_deal_value ? `AED ${patternData.avg_deal_value}` : 'N/A'}

### INTERACTION INSIGHTS (${interactionData.analyzed_at || 'None yet'})
Query Types: ${JSON.stringify(interactionData.query_types || {})}
Total Interactions: ${interactionData.total_interactions || 0}
`;
  } catch (e) {
    console.log('Dynamic knowledge load error:', e);
    return '## Dynamic knowledge not yet loaded - using static knowledge';
  }
}

// ============= STATIC FALLBACK KNOWLEDGE =============
const PTD_STATIC_KNOWLEDGE = `
PTD FITNESS PLATFORM - CORE STRUCTURE:

KEY TABLES:
- client_health_scores: email, health_score, health_zone (purple/green/yellow/red), calculated_at, churn_risk_score
- contacts: email, first_name, last_name, phone, lifecycle_stage, owner_name, lead_status
- deals: deal_name, deal_value, stage, status, close_date, pipeline
- contacts: email, first_name, last_name, lifecycle_stage, lead_status, owner_name (unified schema - use this instead of enhanced_leads)
- call_records: caller_number, transcription, call_outcome, duration_seconds, call_score
- coach_performance: coach_name, avg_client_health, clients_at_risk, performance_score
- intervention_log: status, action_type, recommended_action, outcome
- daily_summary: summary_date, avg_health_score, clients_green/yellow/red/purple, at_risk_revenue_aed
- campaign_performance: campaign_name, platform, spend, clicks, leads, conversions, roas

EDGE FUNCTIONS:
- churn-predictor, anomaly-detector, stripe-forensics, business-intelligence
- intervention-recommender, coach-analyzer, sync-hubspot-to-supabase, fetch-hubspot-live

HEALTH ZONES:
- Purple (85-100): Champions | Green (70-84): Healthy | Yellow (50-69): At Risk | Red (0-49): Critical

STRIPE FRAUD PATTERNS:
- Unknown cards after trusted payments
- Instant payouts bypassing settlement
- Test-then-drain pattern
- Multiple failed charges then success

BUSINESS RULES:
- No session in 14+ days = at risk
- Deals over 50K AED need approval
- Lead response target: under 5 minutes
`;

// ============= PERSISTENT MEMORY SYSTEM + RAG =============

async function getEmbeddings(text: string): Promise<number[] | null> {
  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) return null;

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.data[0].embedding;
  } catch (e) {
    console.log('Embeddings error:', e);
    return null;
  }
}

async function searchMemory(supabase: any, query: string, threadId?: string): Promise<string> {
  try {
    const embedding = await getEmbeddings(query);

    if (embedding) {
      const { data } = await supabase.rpc('match_memories', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 5,
        filter_thread_id: threadId || null
      });

      if (data && data.length > 0) {
        return data.slice(0, 3).map((m: any) =>
          `[Memory] Q: "${m.query.slice(0, 100)}..." → A: "${m.response.slice(0, 200)}..."`
        ).join('\n');
      }
    }

    return await searchMemoryByKeywords(supabase, query, threadId);
  } catch (e) {
    console.log('Memory search error:', e);
    return '';
  }
}

async function searchMemoryByKeywords(supabase: any, query: string, threadId?: string): Promise<string> {
  try {
    let queryBuilder = supabase
      .from('agent_memory')
      .select('query, response, knowledge_extracted')
      .order('created_at', { ascending: false })
      .limit(20);

    if (threadId) {
      queryBuilder = queryBuilder.eq('thread_id', threadId);
    }

    const { data } = await queryBuilder;
    if (!data || data.length === 0) return '';

    const keywords = query.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);

    const relevant = data
      .filter((m: any) => {
        const content = `${m.query} ${m.response}`.toLowerCase();
        return keywords.some((kw: string) => content.includes(kw));
      })
      .slice(0, 3);

    return relevant.map((m: any) =>
      `[Memory] Q: "${m.query.slice(0, 100)}..." → A: "${m.response.slice(0, 200)}..."`
    ).join('\n');
  } catch (e) {
    return '';
  }
}

async function searchKnowledgeBase(supabase: any, query: string): Promise<string> {
  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    // First try vector search if OpenAI key is available
    if (OPENAI_API_KEY) {
      const embRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: query.slice(0, 8000)
        })
      });

      if (embRes.ok) {
        const embData = await embRes.json();
        const queryEmbedding = embData.data[0].embedding;

        // Use RPC for vector search
        const { data: matches } = await supabase.rpc('match_knowledge', {
          query_embedding: queryEmbedding,
          match_threshold: 0.65,
          match_count: 5
        });

        if (matches && matches.length > 0) {
          console.log(`📚 RAG: Found ${matches.length} relevant knowledge chunks`);
          return matches.map((doc: any, i: number) =>
            `📚 [${doc.category || 'knowledge'}] ${doc.content} (${Math.round(doc.similarity * 100)}% match)`
          ).join('\n\n');
        }
      }
    }

    // Fallback: keyword search
    const { data: docs } = await supabase
      .from('knowledge_base')
      .select('content, category, source')
      .limit(20);

    if (!docs || docs.length === 0) return '';

    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter((w: string) => w.length > 3);

    const relevantDocs = docs
      .filter((doc: any) => {
        const content = doc.content.toLowerCase();
        return keywords.some((kw: string) => content.includes(kw));
      })
      .slice(0, 5);

    if (relevantDocs.length === 0) return '';

    return relevantDocs.map((doc: any) =>
      `📚 [${doc.category || 'knowledge'}] ${doc.content}`
    ).join('\n\n');
  } catch (e) {
    console.log('Knowledge base search error:', e);
    return '';
  }
}

async function searchKnowledgeDocuments(supabase: any, query: string): Promise<string> {
  try {
    const { data: docs } = await supabase
      .from('knowledge_documents')
      .select('filename, content, metadata')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!docs || docs.length === 0) return '';

    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter((w: string) => w.length > 3);

    const relevantDocs = docs
      .filter((doc: any) => {
        const content = doc.content.toLowerCase();
        return keywords.some((kw: string) => content.includes(kw));
      })
      .slice(0, 3);

    if (relevantDocs.length === 0) return '';

    return relevantDocs.map((doc: any) =>
      `📄 FROM ${doc.filename}:\n${doc.content.slice(0, 2000)}`
    ).join('\n\n---\n\n');
  } catch (e) {
    console.log('Document search skipped:', e);
    return '';
  }
}

async function getLearnedPatterns(supabase: any): Promise<string> {
  try {
    const { data } = await supabase
      .from('agent_patterns')
      .select('pattern_name, description, confidence')
      .order('confidence', { ascending: false })
      .limit(10);

    if (!data || data.length === 0) return '';

    return data.map((p: any) =>
      `• ${p.pattern_name} (${Math.round(p.confidence * 100)}% confidence): ${p.description || 'Auto-detected'}`
    ).join('\n');
  } catch (e) {
    return '';
  }
}

function extractKnowledge(query: string, response: string): any {
  const combined = `${query} ${response}`.toLowerCase();

  const patterns: Record<string, boolean> = {
    stripe_fraud: /fraud|suspicious|unknown card|dispute|chargeback/i.test(combined),
    churn_risk: /churn|red zone|critical|at.?risk|declining/i.test(combined),
    hubspot_sync: /hubspot|sync|workflow|pipeline|contact/i.test(combined),
    revenue_leak: /leak|revenue loss|missed|opportunity/i.test(combined),
    health_score: /health.?score|engagement|momentum|score/i.test(combined),
    coach_performance: /coach|trainer|performance|clients/i.test(combined),
    formula: /formula|calculate|equation|compute/i.test(combined),
    meta_capi: /meta|capi|facebook|pixel|conversion/i.test(combined),
  };

  return {
    detected_patterns: Object.keys(patterns).filter(k => patterns[k]),
    timestamp: new Date().toISOString()
  };
}

async function saveToMemory(supabase: any, threadId: string, query: string, response: string): Promise<void> {
  try {
    const knowledge = extractKnowledge(query, response);
    const embedding = await getEmbeddings(`${query}\n${response}`);

    await supabase.from('agent_memory').insert({
      thread_id: threadId,
      query,
      response: response.slice(0, 10000),
      knowledge_extracted: knowledge,
      embeddings: embedding
    });

    for (const pattern of knowledge.detected_patterns) {
      const { data: existing } = await supabase
        .from('agent_patterns')
        .select('*')
        .eq('pattern_name', pattern)
        .single();

      if (existing) {
        await supabase
          .from('agent_patterns')
          .update({
            usage_count: (existing.usage_count || 0) + 1,
            last_used_at: new Date().toISOString(),
            confidence: Math.min(0.99, (existing.confidence || 0.5) + 0.01)
          })
          .eq('pattern_name', pattern);
      } else {
        await supabase
          .from('agent_patterns')
          .insert({
            pattern_name: pattern,
            description: `Auto-learned pattern: ${pattern}`,
            confidence: 0.5,
            usage_count: 1
          });
      }
    }

    console.log('✅ Saved to persistent memory');
  } catch (e) {
    console.log('Memory save error:', e);
  }
}

// ============= GEMINI TOOL DEFINITIONS =============
const tools = [
  {
    type: "function",
    function: {
      name: "discover_system",
      description: "Run a deep introspection to understand the entire database schema, functions, and relationships.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_intelligence",
      description: "Execute the intelligence suite actions (churn or anomaly) via the mapped edge functions.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["churn", "anomaly"], description: "Which intelligence routine to run" }
        },
        required: ["action"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "build_feature",
      description: "Queue a UI feature for approval, describing the code change and business impact.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Code to apply for the feature" },
          impact: { type: "string", description: "Business impact of the requested feature" }
        },
        required: ["code", "impact"],
        additionalProperties: false
      }
    }
  }
];

// ============= TOOL EXECUTION =============
async function executeTool(supabase: any, toolName: string, input: any): Promise<string> {
  console.log(`🔧 Executing tool: ${toolName}`, input);

  try {
    switch (toolName) {
      case "discover_system": {
        const { data, error } = await supabase.rpc('introspect_schema_verbose');
        if (error) return `Discovery failed: ${error.message}`;
        return `System Map: ${JSON.stringify(data)}`;
      }

      case "run_intelligence": {
        const { action } = input;
        const functionMap: Record<string, string> = { churn: 'churn-predictor', anomaly: 'anomaly-detector' };
        const fnName = functionMap[action];
        if (!fnName) return "Unknown intelligence action";

        const { data, error } = await supabase.functions.invoke(fnName, { body: {} });
        if (error) return `Intelligence error (${action}): ${error.message}`;
        return `Report: ${JSON.stringify(data)}`;
      }

      case "build_feature": {
        const { code, impact } = input;
        const { data, error } = await supabase
          .from('ai_agent_approvals')
          .insert({
            request_type: 'UI_FEATURE',
            code_changes: [{ path: 'src/components/DynamicFix.tsx', content: code }],
            description: impact,
            status: 'pending'
          })
          .select('id')
          .single();

        if (error) return `Build request error: ${error.message}`;
        return `Feature queued. Ask user to click 'Deploy' in Approvals dashboard. ID: ${data?.id}`;
      }

      default:
        return `Tool not implemented: ${toolName}`;
    }
  } catch (e) {
    console.error(`Tool execution error for ${toolName}:`, e);
    return `Tool execution failed: ${e.message || e}`;
  }
}

async function runAgent(supabase: any, userMessage: string, chatHistory: any[] = [], threadId: string = 'default'): Promise<string> {
  // Use GEMINI_API_KEY (direct Google API), LOVABLE_API_KEY is optional fallback
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  const useDirectGemini = !!GEMINI_API_KEY;
  if (!GEMINI_API_KEY && !LOVABLE_API_KEY) {
    throw new Error("No AI API key configured. Set GEMINI_API_KEY (or GOOGLE_API_KEY)");
  }

  // Load memory + RAG + patterns + DYNAMIC KNOWLEDGE + KNOWLEDGE BASE
  const [relevantMemory, ragKnowledge, knowledgeBase, learnedPatterns, dynamicKnowledge] = await Promise.all([
    searchMemory(supabase, userMessage, threadId),
    searchKnowledgeDocuments(supabase, userMessage),
    searchKnowledgeBase(supabase, userMessage),
    getLearnedPatterns(supabase),
    loadDynamicKnowledge(supabase)
  ]);
  console.log(`🧠 Memory: ${relevantMemory.length > 0 ? 'found' : 'none'}, RAG: ${ragKnowledge.length > 0 ? 'found' : 'none'}, Knowledge: ${knowledgeBase.length > 0 ? 'found' : 'none'}, Patterns: ${learnedPatterns.length > 0 ? 'found' : 'none'}`);

  // Build unified prompt with all components
  const unifiedPrompt = buildUnifiedPromptForEdgeFunction({
    includeLifecycle: true,
    includeUltimateTruth: true,
    includeWorkflows: true,
    includeROI: true,
    knowledge: ragKnowledge || '',
    memory: relevantMemory || '',
  });

  const systemPrompt = `
PTD SUPER-INTELLIGENCE CEO
1. You are proactive. Don't wait for questions.
2. Use 'discover_system' every session to see your 110 tables.
3. Use 'run_intelligence' to find hidden revenue leaks or churn.
4. Use 'build_feature' to write the fix yourself and queue it for approval.

${unifiedPrompt}
`;

  // Construct messages with history
  const messages: any[] = [
    { role: "system", content: systemPrompt }
  ];

  // Add conversation history if available
  if (chatHistory && chatHistory.length > 0) {
    // Filter out system messages and ensure correct format
    const validHistory = chatHistory
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => ({
        role: m.role,
        content: m.content
      }));

    // Check if the last message in history is the current userMessage
    const lastMsg = validHistory[validHistory.length - 1];
    if (lastMsg && lastMsg.role === 'user' && lastMsg.content === userMessage) {
      messages.push(...validHistory);
    } else {
      messages.push(...validHistory);
      messages.push({ role: "user", content: userMessage });
    }
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  let iterations = 0;
  const maxIterations = 8;
  let finalResponse = '';

  while (iterations < maxIterations) {
    iterations++;
    console.log(`🚀 Gemini iteration ${iterations}`);

    // Call Gemini API - Direct Google API or Lovable gateway fallback
    let response: Response;
    
    if (useDirectGemini) {
      // Direct Google Gemini API (OpenAI-compatible endpoint)
      response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.0-flash",
          messages,
          tools,
          tool_choice: "auto",
        }),
      });
    } else {
      // Fallback to Lovable AI gateway
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          tools,
          tool_choice: "auto",
        }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini error:", response.status, errorText);

      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again in a moment.");
      }
      if (response.status === 402) {
        throw new Error("API credits exhausted. Please add credits to continue.");
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      console.error("No choice in response:", data);
      throw new Error("Invalid response from Gemini");
    }

    const finishReason = choice.finish_reason;
    const message = choice.message;

    console.log(`Finish reason: ${finishReason}`);

    // Check if done
    if (finishReason === "stop" || !message.tool_calls || message.tool_calls.length === 0) {
      finalResponse = message.content || "";
      break;
    }

    // Process tool calls
    const toolCalls = message.tool_calls;

    // Add assistant message with tool calls
    // Note: content must be a string (not null) to avoid "image media type is required" error
    // Some OpenAI-compatible APIs reject null content in messages with tool_calls
    messages.push({
      role: "assistant",
      content: message.content || "",
      tool_calls: toolCalls
    });

    // Execute tools in parallel
    const toolResults = await Promise.all(
      toolCalls.map(async (toolCall: any) => {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        const result = await executeTool(supabase, toolCall.function.name, args);
        // Ensure content is always a non-empty string to avoid API errors
        // Empty/null content can trigger "image media type is required" error in some APIs
        const content = (typeof result === 'string' && result.trim()) ? result : "No data returned";
        return {
          role: "tool",
          tool_call_id: toolCall.id,
          content: content,
        };
      })
    );

    // Add all tool results to messages
    messages.push(...toolResults);
  }

  if (!finalResponse) {
    finalResponse = "Max iterations reached. Please try a more specific query.";
  }

  // Save to persistent memory
  await saveToMemory(supabase, threadId, userMessage, finalResponse);

  return finalResponse;
}

// ============= HTTP HANDLER WITH IMPROVED ERROR HANDLING =============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`🚀 Request received at ${new Date().toISOString()}`);

  try {
    const { message, messages: chatHistory, thread_id } = await req.json();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Validate required secrets
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("❌ Missing Supabase configuration");
      return new Response(JSON.stringify({
        error: "Server configuration error - Supabase not configured",
        response: "I'm experiencing configuration issues. Please try again later."
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
    if (!GEMINI_API_KEY && !LOVABLE_API_KEY) {
      console.error("❌ Missing AI API key (GEMINI_API_KEY or GOOGLE_API_KEY)");
      return new Response(JSON.stringify({
        error: "AI Gateway not configured",
        response: "AI service is not configured. Please set GEMINI_API_KEY (or GOOGLE_API_KEY)."
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`🤖 Using ${GEMINI_API_KEY ? 'Direct Gemini API' : 'Lovable Gateway (fallback)'}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const userMessage = message || (chatHistory?.[chatHistory.length - 1]?.content);
    const threadId = thread_id || `thread_${Date.now()}`;

    if (!userMessage) {
      return new Response(JSON.stringify({
        error: "No message provided",
        response: "Please provide a message."
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🧠 Processing: "${userMessage.slice(0, 100)}..." (thread: ${threadId})`);

    // Run agent with timeout protection
    const response = await Promise.race([
      runAgent(supabase, userMessage, chatHistory || [], threadId),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout after 55s")), 55000)
      )
    ]);

    const duration = Date.now() - startTime;
    console.log(`✅ Response generated in ${duration}ms`);

    return new Response(JSON.stringify({
      response,
      thread_id: threadId,
      duration_ms: duration
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    console.error(`❌ Agent error after ${duration}ms:`, error);

    const errMsg = error instanceof Error ? error.message : String(error);

    // Provide user-friendly error messages
    let userResponse = "Sorry, I encountered an error. Please try again.";
    let statusCode = 500;

    if (errMsg.includes("timeout")) {
      userResponse = "My response is taking too long. Try a simpler question or break it into smaller parts.";
      statusCode = 504;
    } else if (errMsg.includes("rate limit") || errMsg.includes("429")) {
      userResponse = "I'm receiving too many requests. Please wait a moment and try again.";
      statusCode = 429;
    } else if (errMsg.includes("402") || errMsg.includes("payment")) {
      userResponse = "AI service credits may be exhausted. Please contact support.";
      statusCode = 402;
    }

    return new Response(JSON.stringify({
      error: errMsg,
      response: userResponse,
      duration_ms: duration
    }), {
      status: statusCode,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
// Force deploy Thu Dec 11 23:41:12 PST 2025
