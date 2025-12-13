import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

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
- enhanced_leads: email, first_name, last_name, lead_score, lead_quality, conversion_status, campaign_name
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
      name: "client_control",
      description: "Get full client data - health scores, calls, deals, activities. Use for any client-related queries.",
      parameters: {
        type: "object",
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
  },
  {
    type: "function",
    function: {
      name: "lead_control",
      description: "Manage leads - get all leads, search leads, get enhanced lead data with scores",
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
          limit: { type: "number", description: "Max results (default 20)" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sales_flow_control",
      description: "Track sales pipeline - get deals, appointments, pipeline stages, recent closes",
      parameters: {
        type: "object",
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
  },
  {
    type: "function",
    function: {
      name: "stripe_control",
      description: "Stripe intelligence - fraud scan, payment history, transaction analysis",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["fraud_scan", "get_summary", "get_events", "analyze"],
            description: "Action to perform"
          },
          days: { type: "number", description: "Days back to analyze (default 90)" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "hubspot_control",
      description: "HubSpot operations - sync data, get contacts, track activities, lifecycle stages",
      parameters: {
        type: "object",
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
  },
  {
    type: "function",
    function: {
      name: "call_control",
      description: "Call records - get transcripts, analytics, find conversation patterns",
      parameters: {
        type: "object",
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
  },
  {
    type: "function",
    function: {
      name: "analytics_control",
      description: "Get dashboards - health zones, revenue, coaches, interventions, campaigns",
      parameters: {
        type: "object",
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
  },
  {
    type: "function",
    function: {
      name: "get_at_risk_clients",
      description: "Get clients at risk of churning (red or yellow health zones)",
      parameters: {
        type: "object",
        properties: {
          zone: { type: "string", enum: ["red", "yellow", "all"], description: "Filter by zone" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "intelligence_control",
      description: "Run AI intelligence functions - churn predictor, anomaly detector, etc.",
      parameters: {
        type: "object",
        properties: {
          functions: {
            type: "array",
            items: { type: "string" },
            description: "Functions to run: churn-predictor, anomaly-detector, intervention-recommender, coach-analyzer, business-intelligence"
          },
        },
      },
    },
  },
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
  },
  {
    type: "function",
    function: {
      name: "callgear_supervisor",
      description: "SUPERVISOR BARGE-IN/WHISPER - Attach AI supervisor to active calls for monitoring. Modes: 'listen' (silent), 'whisper' (coach agent), 'barge' (conference). Use when user asks to monitor calls or coach agents.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["attach_coach", "detach_coach", "change_mode"], description: "Action to perform" },
          call_session_id: { type: "string", description: "Active call session ID" },
          mode: { type: "string", enum: ["listen", "whisper", "barge"], description: "Monitoring mode" },
          coach_sip_uri: { type: "string", description: "SIP URI of supervisor (optional)" }
        },
        required: ["action", "call_session_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "callgear_live_monitor",
      description: "REAL-TIME CALL MONITORING - Get live call status, agent availability, and queue stats. Use when user asks 'who is on a call', 'active calls', 'agent status', or 'queue length'.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list_active_calls", "get_employee_status", "get_queue_stats", "get_all"], description: "What to fetch" }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "callgear_icp_router",
      description: "ICP ROUTING CONFIG - Configure AI-driven inbound call routing. Use to set VIP lists, blacklists, or routing rules for incoming calls.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["test_routing", "get_config"], description: "Action to perform" },
          test_caller: { type: "string", description: "Phone number to test routing for" }
        },
        required: ["action"]
      }
    }
  }
];

// ============= TOOL EXECUTION =============
async function executeTool(supabase: any, toolName: string, input: any): Promise<string> {
  console.log(`🔧 Executing tool: ${toolName}`, input);

  try {
    switch (toolName) {
      case "client_control": {
        const { email, action } = input;

        if (action === "get_all") {
          const [health, calls, deals, activities] = await Promise.all([
            supabase.from('client_health_scores').select('*').eq('email', email).single(),
            supabase.from('call_records').select('*').order('created_at', { ascending: false }).limit(10),
            supabase.from('deals').select('*').order('created_at', { ascending: false }).limit(10),
            supabase.from('contact_activities').select('*').order('occurred_at', { ascending: false }).limit(20),
          ]);
          return JSON.stringify({ health: health.data, calls: calls.data, deals: deals.data, activities: activities.data }, null, 2);
        }

        if (action === "get_health") {
          const { data } = await supabase.from('client_health_scores').select('*').eq('email', email).single();
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
          const { data } = await supabase.from('enhanced_leads').select('*').order('created_at', { ascending: false }).limit(limit);
          return JSON.stringify({ count: data?.length || 0, leads: data || [] });
        }

        if (action === "search" && query) {
          const searchTerm = `%${query}%`;
          const { data } = await supabase.from('enhanced_leads').select('*')
            .or(`email.ilike.${searchTerm},first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},phone.ilike.${searchTerm}`)
            .limit(limit);
          return JSON.stringify({ count: data?.length || 0, leads: data || [] });
        }

        if (action === "get_enhanced") {
          const { data } = await supabase.from('enhanced_leads').select('*').order('lead_score', { ascending: false }).limit(limit);
          return JSON.stringify(data || []);
        }

        if (action === "get_by_status") {
          const { data } = await supabase.from('enhanced_leads').select('*').eq('conversion_status', status || 'new').limit(limit);
          return JSON.stringify(data || []);
        }

        return "Unknown action";
      }

      case "sales_flow_control": {
        const { action, stage, days = 30 } = input;
        const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        if (action === "get_pipeline") {
          const { data } = await supabase.from('deals').select('stage, status, deal_value, deal_name').order('created_at', { ascending: false });
          const stages: Record<string, any> = {};
          data?.forEach((deal: any) => {
            const s = deal.stage || 'unknown';
            if (!stages[s]) stages[s] = { count: 0, value: 0, deals: [] };
            stages[s].count++;
            stages[s].value += deal.deal_value || 0;
            stages[s].deals.push(deal.deal_name);
          });
          return JSON.stringify({ pipeline_summary: stages, total_deals: data?.length || 0 });
        }

        if (action === "get_deals") {
          let query = supabase.from('deals').select('*').order('created_at', { ascending: false }).limit(30);
          if (stage) query = query.eq('stage', stage);
          const { data } = await query;
          return JSON.stringify(data || []);
        }

        if (action === "get_appointments") {
          const { data } = await supabase.from('appointments').select('*').gte('scheduled_at', sinceDate).order('scheduled_at', { ascending: true });
          return JSON.stringify(data || []);
        }

        if (action === "get_recent_closes") {
          const { data } = await supabase.from('deals').select('*').eq('status', 'won').gte('close_date', sinceDate).order('close_date', { ascending: false });
          return JSON.stringify(data || []);
        }

        return "Unknown action";
      }

      case "stripe_control": {
        const { action, days = 90 } = input;

        if (action === "fraud_scan") {
          try {
            const { data, error } = await supabase.functions.invoke('stripe-forensics', { body: { mode: 'full', days } });
            if (error) return `Fraud scan error: ${error.message}`;
            return `STRIPE FRAUD SCAN RESULTS:\n${JSON.stringify(data, null, 2)}`;
          } catch (e) {
            return `Fraud scan unavailable: ${e}`;
          }
        }

        if (action === "get_summary" || action === "get_events" || action === "analyze") {
          try {
            const { data, error } = await supabase.functions.invoke('stripe-dashboard-data', { body: { action, days } });
            if (error) return `Stripe error: ${error.message}`;
            return JSON.stringify(data, null, 2);
          } catch (e) {
            return `Stripe data unavailable: ${e}`;
          }
        }

        return "Unknown action";
      }

      case "hubspot_control": {
        const { action, limit = 50 } = input;

        if (action === "sync_now") {
          try {
            const { data, error } = await supabase.functions.invoke('sync-hubspot-to-supabase', { body: {} });
            if (error) return `Sync error: ${error.message}`;
            return `HubSpot sync completed: ${JSON.stringify(data)}`;
          } catch (e) {
            return `Sync unavailable: ${e}`;
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
          const { data } = await supabase.from('contacts').select('lifecycle_stage').not('lifecycle_stage', 'is', null);
          const stages: Record<string, number> = {};
          data?.forEach((c: any) => { stages[c.lifecycle_stage] = (stages[c.lifecycle_stage] || 0) + 1; });
          return JSON.stringify({ lifecycle_distribution: stages });
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
          const { data } = await supabase.from('call_records').select('id, caller_number, transcription, call_outcome, created_at')
            .not('transcription', 'is', null).order('created_at', { ascending: false }).limit(limit);
          return JSON.stringify(data || []);
        }

        if (action === "get_analytics") {
          const { data } = await supabase.from('call_analytics').select('*').order('date', { ascending: false }).limit(30);
          return JSON.stringify(data || []);
        }

        if (action === "find_patterns") {
          const { data } = await supabase.from('call_records').select('call_outcome, keywords_mentioned, sentiment_score').limit(100);
          const outcomes: Record<string, number> = {};
          const allKeywords: Record<string, number> = {};
          data?.forEach((c: any) => {
            if (c.call_outcome) outcomes[c.call_outcome] = (outcomes[c.call_outcome] || 0) + 1;
            c.keywords_mentioned?.forEach((kw: string) => { allKeywords[kw] = (allKeywords[kw] || 0) + 1; });
          });
          return JSON.stringify({ outcome_distribution: outcomes, keyword_frequency: allKeywords });
        }

        return "Unknown action";
      }

      case "analytics_control": {
        const { dashboard } = input;

        if (dashboard === "health") {
          const { data } = await supabase.from('client_health_scores').select('health_zone, health_score, churn_risk_score');
          const zones: Record<string, number> = { purple: 0, green: 0, yellow: 0, red: 0 };
          let totalHealth = 0, totalChurn = 0;
          data?.forEach((c: any) => {
            if (c.health_zone) zones[c.health_zone]++;
            totalHealth += c.health_score || 0;
            totalChurn += c.churn_risk_score || 0;
          });
          return JSON.stringify({
            zone_distribution: zones,
            avg_health: (totalHealth / (data?.length || 1)).toFixed(1),
            avg_churn_risk: (totalChurn / (data?.length || 1)).toFixed(1),
            total_clients: data?.length || 0
          });
        }

        if (dashboard === "revenue") {
          const { data } = await supabase.from('deals').select('deal_value, status, stage');
          let total = 0, won = 0, pipeline = 0;
          data?.forEach((d: any) => {
            total += d.deal_value || 0;
            if (d.status === 'won') won += d.deal_value || 0;
            else pipeline += d.deal_value || 0;
          });
          return JSON.stringify({ total_revenue: total, won_revenue: won, pipeline_value: pipeline, deal_count: data?.length || 0 });
        }

        if (dashboard === "coaches") {
          const { data } = await supabase.from('coach_performance').select('*').order('performance_score', { ascending: false });
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

      case "universal_search": {
        const { query, search_type = "auto" } = input;
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
          supabase.from('contacts').select('*').or(
            `phone.ilike.%${phoneCleaned}%,email.ilike.${searchLike},first_name.ilike.${searchLike},last_name.ilike.${searchLike},hubspot_contact_id.ilike.${searchLike},owner_name.ilike.${searchLike}`
          ).limit(10),

          // Enhanced leads search
          supabase.from('enhanced_leads').select('*').or(
            `phone.ilike.%${phoneCleaned}%,email.ilike.${searchLike},first_name.ilike.${searchLike},last_name.ilike.${searchLike},campaign_name.ilike.${searchLike},hubspot_contact_id.ilike.${searchLike}`
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
        const { coach_name } = input;
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

      case "get_coach_performance": {
        const { coach_name } = input;

        let query = supabase.from('coach_performance').select('*').order('report_date', { ascending: false });

        if (coach_name) {
          query = query.ilike('coach_name', `%${coach_name}%`);
        }

        const { data } = await query.limit(20);
        return JSON.stringify(data || []);
      }

      case "get_proactive_insights": {
        const { priority = "all", limit = 10 } = input;

        let query = supabase.from('proactive_insights').select('*');

        if (priority !== "all") {
          query = query.eq('priority', priority);
        }

        const { data } = await query
          .order('created_at', { ascending: false })
          .limit(limit);

        return JSON.stringify({ insights_count: data?.length || 0, insights: data || [] });
      }

      case "get_daily_summary": {
        const { date } = input;
        const targetDate = date || new Date().toISOString().split('T')[0];

        const { data } = await supabase
          .from('daily_summary')
          .select('*')
          .eq('summary_date', targetDate)
          .single();

        if (!data) {
          return JSON.stringify({ message: "No summary found for this date", date: targetDate });
        }

        return JSON.stringify(data);
      }

      case "callgear_control": {
        const { date_from, date_to, limit = 50 } = input;
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
        const { target_identity, limit = 50 } = input;
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

      case "callgear_supervisor": {
        const { action, call_session_id, mode, coach_sip_uri } = input;
        try {
          const { data, error } = await supabase.functions.invoke('callgear-supervisor', {
            body: { action, call_session_id, mode, coach_sip_uri }
          });

          if (error) return `CallGear Supervisor Error: ${error.message}`;
          return JSON.stringify(data);
        } catch (e) {
          return `CallGear Supervisor error: ${e}`;
        }
      }

      case "callgear_live_monitor": {
        const { action } = input;
        try {
          const { data, error } = await supabase.functions.invoke('callgear-live-monitor', {
            body: { action }
          });

          if (error) return `CallGear Monitor Error: ${error.message}`;
          return JSON.stringify(data);
        } catch (e) {
          return `CallGear Monitor error: ${e}`;
        }
      }

      case "callgear_icp_router": {
        const { action, test_caller } = input;
        try {
          const { data, error } = await supabase.functions.invoke('callgear-icp-router', {
            body: { action, test_caller }
          });

          if (error) return `CallGear ICP Error: ${error.message}`;
          return JSON.stringify(data);
        } catch (e) {
          return `CallGear ICP error: ${e}`;
        }
      }

      case "run_sql_query": {
        const { query } = input;

        // Security: Only allow SELECT queries
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery.startsWith('select')) {
          return JSON.stringify({ error: "Only SELECT queries are allowed" });
        }

        // Prevent certain risky operations - check word boundaries to avoid false positives
        const forbiddenPattern = /\b(drop|delete|insert|update|alter|create|truncate|grant|revoke|execute|exec)\b/i;
        if (forbiddenPattern.test(normalizedQuery)) {
          return JSON.stringify({ error: "Query contains forbidden operations" });
        }

        // Additional security: prevent comments and multi-statement queries
        if (normalizedQuery.includes('--') || normalizedQuery.includes('/*') || normalizedQuery.includes(';')) {
          return JSON.stringify({ error: "Query contains forbidden characters (comments or multiple statements)" });
        }

        try {
          const { data, error } = await supabase.rpc('execute_sql_query', { sql_query: query });

          if (error) {
            return JSON.stringify({ error: error.message });
          }

          return JSON.stringify({ results: data });
        } catch (e) {
          // RPC function not configured - do not attempt direct query for security
          console.log("execute_sql_query RPC not found");
          return JSON.stringify({ error: "SQL query execution not available - RPC function not configured. Use specific tools for data queries." });
        }
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (error: unknown) {
    console.error(`Tool error (${toolName}):`, error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return `Error: ${errMsg}`;
  }
}

// ============= MAIN AGENT WITH GEMINI 2.5 PRO =============
async function runAgent(supabase: any, userMessage: string, chatHistory: any[] = [], threadId: string = 'default'): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  // Load memory + RAG + patterns + DYNAMIC KNOWLEDGE + KNOWLEDGE BASE
  const [relevantMemory, ragKnowledge, knowledgeBase, learnedPatterns, dynamicKnowledge] = await Promise.all([
    searchMemory(supabase, userMessage, threadId),
    searchKnowledgeDocuments(supabase, userMessage),
    searchKnowledgeBase(supabase, userMessage),
    getLearnedPatterns(supabase),
    loadDynamicKnowledge(supabase)
  ]);
  console.log(`🧠 Memory: ${relevantMemory.length > 0 ? 'found' : 'none'}, RAG: ${ragKnowledge.length > 0 ? 'found' : 'none'}, Knowledge: ${knowledgeBase.length > 0 ? 'found' : 'none'}, Patterns: ${learnedPatterns.length > 0 ? 'found' : 'none'}`);

  const systemPrompt = `# PTD FITNESS SUPER-INTELLIGENCE AGENT v4.0 (Chain-of-Thought + RAG)

## MISSION
You are the CENTRAL NERVOUS SYSTEM of PTD Fitness. You observe, analyze, predict, and control the entire business.

## 🧠 CHAIN-OF-THOUGHT REASONING (MANDATORY)

Before EVERY response, you MUST think step-by-step:

### STEP 1: UNDERSTAND THE QUERY
- What is the user ACTUALLY asking for?
- What type of data do they need? (client info, metrics, coach data, etc.)
- What time frame is relevant?

### STEP 2: PLAN YOUR APPROACH
- Which tools will give me the most relevant data?
- What order should I use them in?
- What information from the knowledge base is relevant?

### STEP 3: GATHER DATA INTELLIGENTLY
- Use universal_search FIRST for any lookup
- Cross-reference multiple data sources
- Verify data freshness (prefer recent data)

### STEP 4: ANALYZE & SYNTHESIZE
- Connect the dots between different data points
- Look for patterns and anomalies
- Consider business context and implications

### STEP 5: DELIVER ACTIONABLE INSIGHTS
- Lead with the most important finding
- Provide specific numbers and evidence
- Recommend concrete next steps

## 🔧 SMART TOOL USAGE STRATEGY

### TOOL SELECTION MATRIX
| Query Type | Primary Tool | Secondary Tool | Validation Tool |
|------------|--------------|----------------|-----------------|
| Person lookup | universal_search | get_coach_clients | client_control |
| Health metrics | client_control (action: health_report) | analytics_control | intelligence_control |
| Revenue/Deals | analytics_control (dashboard: revenue) | stripe_control | lead_control |
| Coach performance | get_coach_clients | analytics_control (dashboard: coaches) | universal_search |
| At-risk clients | get_at_risk_clients | client_control | intelligence_control |
| Lead tracking | lead_control | hubspot_control | universal_search |
| Call analysis | call_control | universal_search | analytics_control |

### TOOL CHAINING RULES
1. **START BROAD** → Use universal_search to find the entity
2. **GET SPECIFIC** → Use entity-specific tools (client_control, lead_control)
3. **ADD CONTEXT** → Use analytics_control for trends
4. **VALIDATE** → Cross-check with intelligence_control

### DATA ENRICHMENT
When you find a client/lead, ALWAYS:
- Check their health score (client_control)
- Check recent activity (universal_search for calls/emails)
- Check deal status if applicable (lead_control)
- Check coach assignment (get_coach_clients)

${dynamicKnowledge}

${PTD_STATIC_KNOWLEDGE}

## ⚠️⚠️⚠️ CRITICAL BEHAVIOR RULES ⚠️⚠️⚠️

### RULE 1: NEVER ASK FOR CLARIFICATION - ALWAYS TRY FIRST
- User gives phone number? → USE universal_search IMMEDIATELY
- User gives name? → USE universal_search IMMEDIATELY  
- User says "Mathew" or "Marko"? → SEARCH for that coach/person IMMEDIATELY
- User gives partial info? → TRY with what you have
- NEVER say "I need an email" or "please provide"
- NEVER say "I can't" - ALWAYS TRY FIRST

### RULE 2: UNIVERSAL SEARCH IS YOUR PRIMARY TOOL
When the user provides ANY identifier:
→ **ALWAYS USE universal_search FIRST** - it searches ALL tables at once
→ Phone numbers → universal_search with that number
→ Names (Mathew, Marko, Ahmed) → universal_search with that name  
→ Partial names → universal_search with whatever they gave
→ Coach names → universal_search + get_coach_clients
→ ANYTHING → TRY universal_search first

### RULE 3: FOR COACH QUERIES
- "Mathew's clients" → use get_coach_clients with name "Mathew"
- "Marko antic calls" → use universal_search for "Marko antic"
- Coach performance → use analytics_control with dashboard="coaches"

### RULE 4: BE PROACTIVE
- If search returns nothing, try alternative spellings
- If one tool fails, try another
- Always provide SOME answer even if data is limited

## HUBSPOT DATA MAPPINGS (CRITICAL - Use these to translate IDs!)

### Deal Stages (HubSpot Pipeline IDs → PTD Sales Process)
- 122178070 = New Lead (Incoming)
- 122237508 = Assessment Booked
- 122237276 = Assessment Completed
- 122221229 = Booking Process
- qualifiedtobuy = Qualified to Buy
- decisionmakerboughtin = Decision Maker Bought In
- contractsent = Contract Sent
- 2900542 = Payment Pending
- 987633705 = Onboarding
- closedwon = Closed Won ✅
- 1063991961 = Closed Lost ❌
- 1064059180 = On Hold

### Lifecycle Stages
- lead = New Lead
- marketingqualifiedlead = MQL (Marketing Qualified)
- salesqualifiedlead = SQL (Sales Qualified)
- opportunity = Opportunity
- customer = Customer ✅

### Call Status
- completed = Call Completed
- missed = Missed Call
- busy = Line Busy
- voicemail = Left Voicemail
- initiated = Call Started

=== CRITICAL: ALWAYS USE LIVE DATA ===
⚠️ NEVER use cached data - ALWAYS call tools for fresh database data
⚠️ Translate HubSpot IDs to human-readable names in responses
⚠️ NEVER ask user for more info - JUST TRY with what they gave you

=== PTD KNOWLEDGE BASE (RAG-ENHANCED) ===
${knowledgeBase || 'No relevant knowledge found.'}

=== UPLOADED KNOWLEDGE DOCUMENTS ===
${ragKnowledge || 'No relevant uploaded documents found.'}

=== LEARNED PATTERNS ===
${learnedPatterns || 'No patterns learned yet.'}

=== MEMORY FROM PAST CONVERSATIONS ===
${relevantMemory || 'No relevant past conversations found.'}

=== RESPONSE FORMAT (CHAIN-OF-THOUGHT VISIBLE) ===

**🧠 My Reasoning:**
[Brief explanation of your thought process - 1-2 sentences]

**🔍 Data Gathered:**
[List the tools used and key findings]

**📊 Analysis:**
[The synthesized answer with specific data points]

**🎯 Recommended Actions:**
[Concrete next steps if applicable]

=== MANDATORY INSTRUCTIONS ===
1. **THINK BEFORE ACTING** - Always use chain-of-thought reasoning
2. **NEVER ASK FOR CLARIFICATION** - use tools with whatever info you have
3. FOR ANY LOOKUP → use universal_search or get_coach_clients FIRST
4. TRANSLATE stage IDs to readable names
5. If search returns nothing, say "No results found for X" - don't ask for more info
6. **USE MULTIPLE TOOLS** - Cross-reference data for accuracy
7. **SHOW YOUR REASONING** - Users trust answers they can understand
8. Be direct, analytical, and action-oriented`;

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

    // Call Gemini 2.5 Flash via Lovable AI gateway (FAST)
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
    messages.push({
      role: "assistant",
      content: message.content || null,
      tool_calls: toolCalls
    });

    // Execute tools in parallel
    const toolResults = await Promise.all(
      toolCalls.map(async (toolCall: any) => {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        const result = await executeTool(supabase, toolCall.function.name, args);
        return {
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
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

    if (!LOVABLE_API_KEY) {
      console.error("❌ Missing LOVABLE_API_KEY");
      return new Response(JSON.stringify({
        error: "AI Gateway not configured",
        response: "AI service is not configured. Please check the API key."
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
