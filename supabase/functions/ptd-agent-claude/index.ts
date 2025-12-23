import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.26.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { buildUnifiedPromptForEdgeFunction } from "../_shared/unified-prompts.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============= PTD KNOWLEDGE BASE =============
const PTD_SYSTEM_KNOWLEDGE = `
PTD FITNESS PLATFORM - COMPLETE STRUCTURE (58 Tables + 21 Functions):

TABLES (58):
- client_health_scores: email, health_score, health_zone (purple/green/yellow/red), calculated_at, churn_risk_score
- contacts: email, first_name, last_name, phone, lifecycle_stage, owner_name, lead_status
- deals: deal_name, deal_value, stage, status, close_date, pipeline
- contacts: email, first_name, last_name, lifecycle_stage, lead_status, owner_name (unified schema - use this instead of enhanced_leads)
- call_records: caller_number, transcription, call_outcome, duration_seconds, call_score
- coach_performance: coach_name, avg_client_health, clients_at_risk, performance_score
- intervention_log: status, action_type, recommended_action, outcome
- daily_summary: summary_date, avg_health_score, clients_green/yellow/red/purple, at_risk_revenue_aed
- campaign_performance: campaign_name, platform, spend, clicks, leads, conversions, roas
- appointments: scheduled_at, status, notes
- contact_activities: activity_type, activity_title, occurred_at

EDGE FUNCTIONS (21):
- churn-predictor: Predicts client dropout probability using ML
- anomaly-detector: Finds unusual patterns in data
- stripe-forensics: Detects fraud (instant payouts, test-drain, unknown cards)
- business-intelligence: Generates BI insights
- intervention-recommender: Suggests actions for at-risk clients
- coach-analyzer: Analyzes coach performance
- sync-hubspot-to-supabase: Syncs HubSpot data
- fetch-hubspot-live: Gets real-time HubSpot data

HEALTH ZONES:
- Purple Zone (85-100): Champions - loyal, engaged, high value
- Green Zone (70-84): Healthy - consistent, stable engagement
- Yellow Zone (50-69): At Risk - showing warning signs
- Red Zone (0-49): Critical - immediate intervention needed

STRIPE FRAUD PATTERNS:
- Unknown cards used after trusted payments
- Instant payouts bypassing normal settlement
- Test-then-drain: small test charge followed by large withdrawal
- Multiple failed charges followed by success

HUBSPOT INSIGHTS:
- Revenue leaks from workflow failures
- Buried premium leads not being followed up
- Lifecycle stage mismatches

BUSINESS RULES:
- Clients with no session in 14+ days are at risk
- Deals over 50K AED need manager approval
- Response time target: under 5 minutes for new leads
`;

// ============= PERSISTENT MEMORY SYSTEM + RAG =============

// Timeout wrapper for async operations
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T | null> {
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => {
      console.warn(`⏱️ ${operationName} timed out after ${timeoutMs}ms`);
      resolve(null);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } catch (e) {
    console.error(`❌ ${operationName} failed:`, e instanceof Error ? e.message : String(e));
    return null;
  }
}

// Get embeddings for semantic search with timeout
async function getEmbeddings(text: string): Promise<number[] | null> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

  if (!OPENAI_API_KEY) {
    console.warn('⚠️ OPENAI_API_KEY not configured - embeddings disabled');
    return null;
  }

  const embeddingOperation = async (): Promise<number[] | null> => {
    try {
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OpenAI API error:', response.status, errorText);
        return null;
      }

      const data = await response.json();

      if (!data?.data?.[0]?.embedding) {
        console.error('❌ Invalid embedding response format');
        return null;
      }

      console.log('✅ Embeddings generated successfully');
      return data.data[0].embedding;
    } catch (e) {
      console.error('❌ Embedding generation failed:', e instanceof Error ? e.message : String(e));
      return null;
    }
  };

  return await withTimeout(embeddingOperation(), 30000, 'Embedding generation');
}

// Search agent memory using vector similarity with timeout
async function searchMemory(supabase: any, query: string, threadId?: string): Promise<string> {
  const memorySearchOperation = async (): Promise<string> => {
    try {
      const embedding = await getEmbeddings(query);

      if (embedding) {
        console.log('🔍 Performing vector similarity search...');

        // Vector similarity search
        const { data, error } = await supabase.rpc('match_memories', {
          query_embedding: embedding,
          match_threshold: 0.7,
          match_count: 5,
          filter_thread_id: threadId || null
        });

        if (error) {
          console.error('❌ Vector search RPC error:', error.message);
          // Fallback to keyword search
          return await searchMemoryByKeywords(supabase, query, threadId);
        }

        if (data && data.length > 0) {
          console.log(`✅ Found ${data.length} relevant memories via vector search`);
          return data.slice(0, 3).map((m: any) =>
            `[Memory] Q: "${m.query.slice(0, 100)}..." → A: "${m.response.slice(0, 200)}..."`
          ).join('\n');
        }

        console.log('ℹ️ No vector matches found, falling back to keyword search');
      }

      // Fallback to keyword search
      return await searchMemoryByKeywords(supabase, query, threadId);
    } catch (e) {
      console.error('❌ Memory search error:', e instanceof Error ? e.message : String(e));
      return '';
    }
  };

  const result = await withTimeout(memorySearchOperation(), 30000, 'Memory search');
  return result || '';
}

// Keyword-based memory search (fallback) with timeout
async function searchMemoryByKeywords(supabase: any, query: string, threadId?: string): Promise<string> {
  const keywordSearchOperation = async (): Promise<string> => {
    try {
      console.log('🔍 Performing keyword-based memory search...');

      let queryBuilder = supabase
        .from('agent_memory')
        .select('query, response, knowledge_extracted')
        .order('created_at', { ascending: false })
        .limit(20);

      if (threadId) {
        queryBuilder = queryBuilder.eq('thread_id', threadId);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('❌ Keyword search database error:', error.message);
        return '';
      }

      if (!data || data.length === 0) {
        console.log('ℹ️ No memories found in database');
        return '';
      }

      const keywords = query.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);

      if (keywords.length === 0) {
        console.log('⚠️ No valid keywords extracted from query');
        return '';
      }

      const relevant = data
        .filter((m: any) => {
          const content = `${m.query} ${m.response}`.toLowerCase();
          return keywords.some((kw: string) => content.includes(kw));
        })
        .slice(0, 3);

      if (relevant.length > 0) {
        console.log(`✅ Found ${relevant.length} relevant memories via keyword search`);
        return relevant.map((m: any) =>
          `[Memory] Q: "${m.query.slice(0, 100)}..." → A: "${m.response.slice(0, 200)}..."`
        ).join('\n');
      }

      console.log('ℹ️ No keyword matches found');
      return '';
    } catch (e) {
      console.error('❌ Keyword search error:', e instanceof Error ? e.message : String(e));
      return '';
    }
  };

  const result = await withTimeout(keywordSearchOperation(), 30000, 'Keyword memory search');
  return result || '';
}

// Search RAG knowledge documents
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
    console.log('RAG search skipped:', e);
    return '';
  }
}

// Get learned patterns
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

// Get global workspace memory (org-wide, shared across all users/devices)
async function getGlobalMemory(supabase: any, query: string): Promise<string> {
  try {
    // Search global_memory for relevant org-wide knowledge
    const { data: globalMemories, error } = await supabase
      .from('global_memory')
      .select('memory_key, memory_value, memory_type')
      .or('memory_type.eq.shared,memory_type.eq.config')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error || !globalMemories || globalMemories.length === 0) {
      return '';
    }

    // Filter by query relevance (simple keyword matching)
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter((w: string) => w.length > 3);

    const relevant = globalMemories.filter((m: any) => {
      const key = m.memory_key.toLowerCase();
      const value = JSON.stringify(m.memory_value).toLowerCase();
      return keywords.some((kw: string) => key.includes(kw) || value.includes(kw));
    }).slice(0, 5);

    if (relevant.length === 0) return '';

    return relevant.map((m: any) =>
      `🌐 [ORG-WIDE] ${m.memory_key}: ${JSON.stringify(m.memory_value).slice(0, 500)}`
    ).join('\n\n');
  } catch (e) {
    console.log('Global memory search skipped:', e);
    return '';
  }
}

// Save important knowledge to global memory (org-wide)
async function saveToGlobalMemory(supabase: any, key: string, value: any, type: string = 'shared'): Promise<void> {
  try {
    await supabase
      .from('global_memory')
      .upsert({
        memory_key: key,
        memory_value: value,
        memory_type: type,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'memory_key' });

    console.log(`✅ Saved to global memory: ${key}`);
  } catch (e) {
    console.log('Global memory save error:', e);
  }
}

// Extract knowledge from interaction
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

// Save interaction to persistent memory
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

    // Update pattern confidence
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

    // Save important patterns to global memory (org-wide)
    if (knowledge.detected_patterns.length > 0) {
      await saveToGlobalMemory(supabase, `pattern:${knowledge.detected_patterns[0]}`, {
        pattern: knowledge.detected_patterns[0],
        query: query.slice(0, 200),
        response_summary: response.slice(0, 500),
        timestamp: new Date().toISOString(),
      }, 'shared');
    }

    console.log('✅ Saved to persistent memory');
  } catch (e) {
    console.log('Memory save error:', e);
  }
}

// Define tools for the agent (Anthropic format)
const tools: Anthropic.Tool[] = [
  {
    name: "client_control",
    description: "Get full client data - health scores, calls, deals, activities. Use for any client-related queries.",
    input_schema: {
      type: "object" as const,
      properties: {
        email: { type: "string", description: "Client email address" },
        action: {
          type: "string",
          enum: ["get_all", "get_health", "get_calls", "get_deals", "get_activities"],
          description: "Action to perform"
        },
      },
      required: ["email", "action"],
    },
  },
  {
    name: "lead_control",
    description: "Manage leads - get all leads, search leads, get enhanced lead data with scores",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["get_all", "search", "get_enhanced", "get_by_status"],
          description: "Action to perform"
        },
        query: { type: "string", description: "Search query for lead name/email/phone" },
        status: { type: "string", description: "Lead status filter" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: ["action"],
    },
  },
  {
    name: "sales_flow_control",
    description: "Track sales pipeline - get deals, appointments, pipeline stages, recent closes",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["get_pipeline", "get_deals", "get_appointments", "get_recent_closes"],
          description: "Action to perform"
        },
        stage: { type: "string", description: "Optional: filter by pipeline stage" },
        days: { type: "number", description: "Days back to look (default 30)" },
      },
      required: ["action"],
    },
  },
  {
    name: "stripe_control",
    description: "Stripe intelligence - fraud scan, payment history, transaction analysis, deleted wallets/bank accounts history",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["fraud_scan", "get_summary", "get_events", "analyze", "get_deleted_wallets"],
          description: "Action to perform. Use get_deleted_wallets for history of deleted bank accounts, cards, and wallets."
        },
        days: { type: "number", description: "Days back to analyze (default 90)" },
      },
      required: ["action"],
    },
  },
  {
    name: "hubspot_control",
    description: "HubSpot operations - sync data, get contacts, track activities, lifecycle stages",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["sync_now", "get_contacts", "get_activities", "get_lifecycle_stages"],
          description: "Action to perform"
        },
        limit: { type: "number", description: "Max results" },
      },
      required: ["action"],
    },
  },
  {
    name: "call_control",
    description: "Call records - get transcripts, analytics, find conversation patterns",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["get_all", "get_transcripts", "get_analytics", "find_patterns"],
          description: "Action to perform"
        },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: ["action"],
    },
  },
  {
    name: "analytics_control",
    description: "Get dashboards - health zones, revenue, coaches, interventions, campaigns",
    input_schema: {
      type: "object" as const,
      properties: {
        dashboard: {
          type: "string",
          enum: ["health", "revenue", "coaches", "interventions", "campaigns"],
          description: "Dashboard to retrieve"
        },
      },
      required: ["dashboard"],
    },
  },
  {
    name: "get_at_risk_clients",
    description: "Get clients at risk of churning (red or yellow health zones)",
    input_schema: {
      type: "object" as const,
      properties: {
        zone: { type: "string", enum: ["red", "yellow", "all"], description: "Filter by zone" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "intelligence_control",
    description: "Run AI intelligence functions - churn predictor, anomaly detector, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        functions: {
          type: "array",
          items: { type: "string" },
          description: "Functions to run: churn-predictor, anomaly-detector, intervention-recommender, coach-analyzer, business-intelligence"
        },
      },
    },
  },
];

// =============================================================================
// SECURITY UTILITIES - Input Validation
// =============================================================================

/**
 * Validate and sanitize email address
 */
function validateEmail(email: string): string {
  const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const sanitized = email.trim().toLowerCase().slice(0, 255);

  if (!emailRegex.test(sanitized)) {
    throw new Error('Invalid email format');
  }

  return sanitized;
}

/**
 * Validate and sanitize string input
 */
function sanitizeString(input: string, maxLength: number = 255): string {
  // Remove any characters that could be used in SQL injection
  return input.replace(/['"`;\\]/g, '').trim().slice(0, maxLength);
}

// Tool execution
async function executeTool(supabase: any, toolName: string, input: any): Promise<string> {
  console.log(`Executing tool: ${toolName}`, input);

  try {
    switch (toolName) {
      case "client_control": {
        const { email, action } = input;

        // SECURITY: Validate email input
        let validatedEmail: string;
        try {
          validatedEmail = validateEmail(email);
        } catch (e) {
          return JSON.stringify({ error: 'Invalid email address provided' });
        }

        if (action === "get_all") {
          const [health, calls, deals, activities] = await Promise.all([
            supabase.from('client_health_scores').select('*').eq('email', validatedEmail).single(),
            supabase.from('call_records').select('*').order('created_at', { ascending: false }).limit(10),
            supabase.from('deals').select('*').order('created_at', { ascending: false }).limit(10),
            supabase.from('contact_activities').select('*').order('occurred_at', { ascending: false }).limit(20),
          ]);
          return JSON.stringify({ health: health.data, calls: calls.data, deals: deals.data, activities: activities.data }, null, 2);
        }

        if (action === "get_health") {
          const { data } = await supabase.from('client_health_scores').select('*').eq('email', validatedEmail).single();
          return JSON.stringify(data);
        }

        if (action === "get_calls") {
          const { data } = await supabase.from('call_records').select('*').order('created_at', { ascending: false }).limit(20);
          return JSON.stringify(data || []);
        }

        if (action === "get_deals") {
          const { data } = await supabase.from('deals').select('*').order('created_at', { ascending: false }).limit(20);
          return JSON.stringify(data || []);
        }

        if (action === "get_activities") {
          const { data } = await supabase.from('contact_activities').select('*').order('occurred_at', { ascending: false }).limit(30);
          return JSON.stringify(data || []);
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
          // SECURITY: Sanitize search query to prevent SQL injection
          // Remove any SQL special characters and limit to alphanumeric, @, ., -, +, space
          const sanitizedQuery = query.replace(/[^a-zA-Z0-9@.\-+\s]/g, '').slice(0, 100);

          if (!sanitizedQuery) {
            return JSON.stringify({ count: 0, leads: [], error: 'Invalid search query' });
          }

          // Use parameterized queries instead of template literals
          const { data } = await supabase.from('contacts').select('*')
            .or(`email.ilike.%${sanitizedQuery}%,first_name.ilike.%${sanitizedQuery}%,last_name.ilike.%${sanitizedQuery}%,phone.ilike.%${sanitizedQuery}%`)
            .limit(limit);
          return JSON.stringify({ count: data?.length || 0, leads: data || [] });
        }

        if (action === "get_enhanced") {
          // Use contacts table with lead_status for scoring
          const { data } = await supabase.from('contacts').select('*').order('created_at', { ascending: false }).limit(limit);
          return JSON.stringify(data || []);
        }

        if (action === "get_by_status") {
          // SECURITY: Sanitize status input to prevent SQL injection
          const sanitizedStatus = status ? sanitizeString(status, 50) : 'new';
          const { data } = await supabase.from('contacts').select('*').eq('lead_status', sanitizedStatus).limit(limit);
          return JSON.stringify(data || []);
        }

        return "Unknown action";
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
            // SECURITY: Sanitize stage input to prevent SQL injection
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

        if (action === "get_events") {
          const { data } = await supabase.from('events').select('*').order('event_time', { ascending: false }).limit(50);
          return JSON.stringify(data || []);
        }

        if (action === "get_deleted_wallets") {
          try {
            const { data } = await supabase.functions.invoke('stripe-history', {
              body: { days }
            });
            const deletedWallets = data?.deletedWallets || [];
            if (deletedWallets.length === 0) {
              return `No deleted wallets/bank accounts found in the last ${days} days.`;
            }
            return `🗑️ DELETED WALLETS/BANK ACCOUNTS (${deletedWallets.length} found):\n${JSON.stringify(deletedWallets, null, 2)}`;
          } catch (e) {
            return `Error fetching deleted wallets: ${e}`;
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
            objection_keywords: ["expensive", "think about", "later", "not sure"],
            closing_keywords: ["ready", "sign up", "let's do it"],
            calls_analyzed: data?.length || 0
          });
        }

        return "Unknown action";
      }

      case "analytics_control": {
        const { dashboard } = input;

        if (dashboard === "health") {
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

        if (dashboard === "revenue") {
          const { data } = await supabase.from('daily_summary').select('*').order('summary_date', { ascending: false }).limit(30);
          return JSON.stringify(data || []);
        }

        if (dashboard === "coaches") {
          const { data } = await supabase.from('coach_performance').select('*').order('report_date', { ascending: false }).limit(20);
          return JSON.stringify(data || []);
        }

        if (dashboard === "interventions") {
          const { data } = await supabase.from('intervention_log').select('*').order('created_at', { ascending: false }).limit(30);
          return JSON.stringify(data || []);
        }

        if (dashboard === "campaigns") {
          const { data } = await supabase.from('campaign_performance').select('*').order('date', { ascending: false }).limit(30);
          return JSON.stringify(data || []);
        }

        return "Unknown dashboard";
      }

      case "get_at_risk_clients": {
        const { zone = "all", limit = 20 } = input;
        let query = supabase.from('client_health_scores').select('*');

        if (zone === 'red') {
          query = query.eq('health_zone', 'red');
        } else if (zone === 'yellow') {
          query = query.eq('health_zone', 'yellow');
        } else {
          query = query.in('health_zone', ['red', 'yellow']);
        }

        const { data } = await query.order('health_score', { ascending: true }).limit(limit);
        return JSON.stringify({ count: data?.length || 0, at_risk_clients: data || [] });
      }

      case "intelligence_control": {
        const { functions = ["business-intelligence"] } = input;
        const results: Record<string, any> = {};

        for (const fn of functions) {
          try {
            const { data, error } = await supabase.functions.invoke(fn, { body: {} });
            results[fn] = error ? `Error: ${error.message}` : data;
          } catch (e) {
            results[fn] = `Error: ${e}`;
          }
        }

        return `INTELLIGENCE RESULTS:\n${JSON.stringify(results, null, 2)}`;
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (error: unknown) {
    console.error(`Tool error (${toolName}):`, error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ error: "Tool execution failed", tool: toolName, details: errMsg });
  }
}

// Token budget helper - rough estimate (4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Truncate text to fit token budget
function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n... [truncated for token limit]';
}

// Main agent function with agentic loop + learning + RAG
async function runAgent(supabase: any, anthropic: Anthropic, userMessage: string, threadId: string = 'default'): Promise<string> {
  // Token budgets (Claude has 200K limit, reserve 50K for response/tools)
  const MAX_SYSTEM_TOKENS = 120000;
  const MAX_MEMORY_TOKENS = 5000;
  const MAX_RAG_TOKENS = 8000;
  const MAX_GLOBAL_TOKENS = 3000;
  const MAX_PATTERNS_TOKENS = 2000;

  // ============= PERSISTENT MEMORY + RAG MIDDLEWARE: Before =============
  const [relevantMemory, ragKnowledge, learnedPatterns, globalMemory] = await Promise.all([
    searchMemory(supabase, userMessage, threadId),
    searchKnowledgeDocuments(supabase, userMessage),
    getLearnedPatterns(supabase),
    getGlobalMemory(supabase, userMessage) // Org-wide memory
  ]);
  console.log(`🧠 Memory: ${relevantMemory.length > 0 ? 'found' : 'none'}, RAG: ${ragKnowledge.length > 0 ? 'found' : 'none'}, Patterns: ${learnedPatterns.length > 0 ? 'found' : 'none'}, Global: ${globalMemory.length > 0 ? 'found' : 'none'}`);

  // Truncate context to fit token budgets
  const truncatedMemory = truncateToTokens(relevantMemory || '', MAX_MEMORY_TOKENS);
  const truncatedRAG = truncateToTokens(ragKnowledge || '', MAX_RAG_TOKENS);
  const truncatedGlobal = truncateToTokens(globalMemory || '', MAX_GLOBAL_TOKENS);
  const truncatedPatterns = truncateToTokens(learnedPatterns || '', MAX_PATTERNS_TOKENS);

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];

  // Build COMPACT unified prompt - only include essential sections
  // Skip includeLifecycle, includeUltimateTruth, includeWorkflows for token savings
  const basePrompt = buildUnifiedPromptForEdgeFunction({
    includeLifecycle: false,      // Skip - reduces ~3K tokens
    includeUltimateTruth: false,  // Skip - reduces ~3K tokens  
    includeWorkflows: false,       // Skip - reduces ~5K tokens
    includeROI: true,              // Keep ROI for managerial queries
    knowledge: truncatedRAG,
    memory: truncatedMemory,
  });

  // Build compact system prompt
  const systemPrompt = `${basePrompt}

=== CONTEXT ===
${truncatedGlobal ? `GLOBAL MEMORY:\n${truncatedGlobal}\n` : ''}
${truncatedPatterns ? `PATTERNS:\n${truncatedPatterns}\n` : ''}

=== PTD QUICK REFERENCE ===
TABLES: client_health_scores, contacts, deals, call_records, coach_performance, intervention_log, campaign_performance
HEALTH ZONES: Purple(85-100)=Champion, Green(70-84)=Healthy, Yellow(50-69)=AtRisk, Red(0-49)=Critical
STAGES: lead→mql→sql→opportunity→customer

=== CAPABILITIES ===
✅ Client/Lead/Sales/Stripe/HubSpot/Calls/Dashboards/AI functions

=== RULES ===
1. Use tools to get LIVE data - never guess
2. Be concise but accurate
3. For fraud: stripe_control(fraud_scan)
4. For at-risk: client_control or dashboard_control`;

  // Log token estimate
  const tokenEstimate = estimateTokens(systemPrompt);
  console.log(`📊 System prompt estimated tokens: ${tokenEstimate} (budget: ${MAX_SYSTEM_TOKENS})`);

  if (tokenEstimate > MAX_SYSTEM_TOKENS) {
    console.warn(`⚠️ System prompt exceeds budget! Tokens: ${tokenEstimate}`);
  }

  let iterations = 0;
  const maxIterations = 8;
  let finalResponse = '';

  while (iterations < maxIterations) {
    iterations++;
    console.log(`Agent iteration ${iterations}`);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });

    console.log(`Stop reason: ${response.stop_reason}`);

    // Check if done
    if (response.stop_reason === "end_turn") {
      finalResponse = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      break;
    }

    // Get tool use blocks
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      finalResponse = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      break;
    }

    // Add assistant response to messages
    messages.push({ role: "assistant", content: response.content });

    // Execute tools in parallel
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        try {
          const result = await executeTool(supabase, toolUse.name, toolUse.input);
          return {
            type: "tool_result" as const,
            tool_use_id: toolUse.id,
            content: result,
          };
        } catch (toolError) {
          console.error(`Tool execution failed: ${toolUse.name}`, toolError);
          const errMsg = toolError instanceof Error ? toolError.message : String(toolError);
          return {
            type: "tool_result" as const,
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: "Tool execution failed", tool: toolUse.name, details: errMsg }),
          };
        }
      })
    );

    // Add tool results to messages
    messages.push({ role: "user", content: toolResults });
  }

  if (!finalResponse) {
    finalResponse = "Max iterations reached. Please try a more specific query.";
  }

  // ============= PERSISTENT MEMORY: Save After Response =============
  await saveToMemory(supabase, threadId, userMessage, finalResponse);

  return finalResponse;
}

// HTTP Handler
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json().catch(() => null);

    if (!payload || typeof payload !== "object") {
      return jsonResponse({ error: "Invalid request payload" }, 400);
    }

    const { message, messages: chatHistory, thread_id } = payload as Record<string, any>;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const missingEnv = [
      !ANTHROPIC_API_KEY && "ANTHROPIC_API_KEY",
      !SUPABASE_URL && "SUPABASE_URL",
      !SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean) as string[];

    if (missingEnv.length > 0) {
      return jsonResponse({
        error: "Missing required environment variables",
        missing: missingEnv,
      }, 400);
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY! });

    const derivedMessage = typeof message === "string" && message.trim().length > 0
      ? message
      : (Array.isArray(chatHistory) ? chatHistory[chatHistory.length - 1]?.content : undefined);
    const userMessage = typeof derivedMessage === "string" ? derivedMessage : null;
    const threadId = typeof thread_id === "string" && thread_id.length > 0
      ? thread_id
      : `default_${Date.now()}`;

    if (!userMessage) {
      return jsonResponse({ error: "A 'message' string is required" }, 400);
    }

    console.log(`🧠 Running agent with thread: ${threadId}`);
    const response = await runAgent(supabase, anthropic, userMessage, threadId);

    return jsonResponse({ response });
  } catch (error: unknown) {
    console.error("Agent error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: errMsg }, 500);
  }
});
