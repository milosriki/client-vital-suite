import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { buildUnifiedPromptForEdgeFunction } from "../_shared/unified-prompts.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { PTD_STATIC_KNOWLEDGE } from "../_shared/static-knowledge.ts";
import { executeSharedTool } from "../_shared/tool-executor.ts";

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
// ============= STATIC FALLBACK KNOWLEDGE =============
const PTD_STATIC_KNOWLEDGE_LOCAL = PTD_STATIC_KNOWLEDGE;

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

// ============= TOOL HELPER FUNCTION =============
// Helper to create tools with async functions and zod schemas
function tool(
  handler: (args: any) => Promise<string>,
  options: { name: string; description?: string; schema?: z.ZodType<any> }
): any {
  const schema = options.schema || z.object({});
  const schemaShape = (schema._def as any)?.shape?.() || {};

  // Convert zod schema to JSON schema format
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(schemaShape)) {
    const zodType = value as any;
    if (zodType._def?.typeName === 'ZodString') {
      properties[key] = { type: "string", description: zodType.description || "" };
    } else if (zodType._def?.typeName === 'ZodNumber') {
      properties[key] = { type: "number", description: zodType.description || "" };
    } else if (zodType._def?.typeName === 'ZodEnum') {
      properties[key] = {
        type: "string",
        enum: zodType._def.values,
        description: zodType.description || ""
      };
    } else if (zodType._def?.typeName === 'ZodBoolean') {
      properties[key] = { type: "boolean", description: zodType.description || "" };
    }

    // Check if field is required (not optional)
    if (!zodType.isOptional()) {
      required.push(key);
    }
  }

  return {
    type: "function",
    function: {
      name: options.name,
      description: options.description || "",
      parameters: {
        type: "object",
        properties,
        required: required.length > 0 ? required : undefined,
      },
    },
    handler, // Store handler for execution
  };
}

// ============= GEMINI TOOL DEFINITIONS =============
const tools = [
  // Google Search Grounding (Native Tool)
  {
    googleSearchRetrieval: {
      dynamicRetrievalConfig: {
        mode: "MODE_DYNAMIC",
        dynamicThreshold: 0.7,
      },
    },
  },
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
      description: "Stripe intelligence - fraud scan, payment history, transaction analysis, account verification, who verified account and visa documents",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["fraud_scan", "account_verification", "who_verified", "verification_details", "get_summary", "get_events", "analyze"],
            description: "Action to perform: fraud_scan for fraud detection, account_verification/who_verified/verification_details to find who verified the account and visa documents, get_summary/get_events/analyze for payment analysis"
          },
          days: { type: "number", description: "Days back to analyze (default 90, not used for account_verification)" },
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
  },
  // 1. INTELLIGENCE: Calls specialist intelligence functions (107 functions available)
  {
    type: "function",
    function: {
      name: "run_intelligence_suite",
      description: "Run both anomaly-detector and churn-predictor edge functions and return combined results.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_intelligence",
      description: "Calls one of our 107 specialist agents to find churn, fraud, revenue leaks, or payout issues.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["churn", "anomaly", "revenue", "payouts"],
            description: "Which intelligence function to run: 'churn' for churn predictor, 'anomaly' for anomaly detector, 'revenue' for hubspot analyzer, 'payouts' for stripe payouts AI"
          }
        },
        required: ["action"]
      }
    }
  },
  // 2. DISCOVERY: Uses introspect_schema_verbose RPC (The Deep Wiki Map)
  {
    type: "function",
    function: {
      name: "discover_system_map",
      description: "Run this once at start. It maps all 110 tables and their relational links so you know where all data is. This is the Ultimate System Map.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  // 3. BUILDER: Writes code to ai_agent_approvals
  {
    type: "function",
    function: {
      name: "build_feature",
      description: "Build a feature by writing code changes to the ai_agent_approvals table. Creates a fix request that can be reviewed and approved.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "The code content to write (e.g., React component code)"
          },
          impact: {
            type: "string",
            description: "Description of the impact or purpose of this code change"
          }
        },
        required: ["code", "impact"]
      }
    }
  }
];

// ============= TOOL EXECUTION =============
async function executeTool(supabase: any, toolName: string, input: any): Promise<string> {
  return await executeSharedTool(supabase, toolName, input);
}

// ============= MAIN AGENT WITH GEMINI 2.5 PRO =============
async function runAgent(supabase: any, userMessage: string, chatHistory: any[] = [], threadId: string = 'default', context?: any): Promise<string> {
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

${context ? `## 🔬 LIVE SYSTEM INTELLIGENCE SCAN RESULTS
Status: ${context.system_status?.toUpperCase() || 'UNKNOWN'}
Intelligence Agents Run: ${context.intelligence_findings ? Object.keys(context.intelligence_findings).length : 0}

### Critical Issues Found:
${context.improvements?.length > 0 ? context.improvements.map((imp: string) => `🚨 ${imp}`).join('\n') : '✅ No critical issues detected'}

### Intelligence Results:
${context.intelligence_findings ? Object.entries(context.intelligence_findings).map(([name, result]: [string, any]) => 
  `• ${name}: ${result?.status?.toUpperCase() || 'UNKNOWN'} (${result?.duration_ms || 0}ms)`
).join('\n') : 'No intelligence scan results available'}

### Final Report Summary:
${context.final_report || 'No final report available'}

---` : ''}

1. MISSION: Maximize revenue and detect 🔴 CRITICAL leaks.

2. DISCOVERY: Always use 'discover_system_map' first to see your 110 tables.

3. PROACTIVITY: Use 'run_intelligence' every session to find problems before I ask.

4. ACTION: If you find a leak, use 'build_feature' to write the fix code and queue it for my approval.

${dynamicKnowledge}

${knowledgeBase ? `## KNOWLEDGE BASE (Curated Docs)\n${knowledgeBase}` : ''}

${relevantMemory ? `## CONVERSATION MEMORY (Past Interactions)\n${relevantMemory}` : ''}

${learnedPatterns ? `## LEARNED PATTERNS\n${learnedPatterns}` : ''}

${unifiedPrompt}

RULES:
- Be proactive. Don't wait for the user to ask "is there fraud?" Tell them "I found fraud, here is the fix."
- Format answers with: 🔍 SUMMARY, 📊 DATA, 🚨 CRITICAL ALERTS, and 🎯 RECOMMENDATIONS.
- Save what you learn about our business patterns to memory.
`;

  // --- NATIVE GEMINI FORMAT CONVERSION ---

  // 1. Convert Tools
  const geminiTools = [
    // {
    //   googleSearch: {} // Disabled due to conflict with functionDeclarations
    // },
    {
      functionDeclarations: tools
        .filter(t => t.type === 'function')
        .map(t => t.function)
    }
  ];

  // 2. Convert Messages
  const contents: any[] = [];
  
  // Add history
  if (chatHistory && chatHistory.length > 0) {
    chatHistory.forEach((msg: any) => {
      if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant') {
        contents.push({ role: 'model', parts: [{ text: msg.content }] });
      }
    });
  }
  
  // Add current user message
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  let iterations = 0;
  const maxIterations = 8;
  let finalResponse = '';

  while (iterations < maxIterations) {
    iterations++;
    console.log(`🚀 Gemini iteration ${iterations}`);

    let response: Response;
    let data: any;

    if (useDirectGemini) {
      // Native Gemini API
      // Revert to gemini-2.0-flash
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          tools: geminiTools,
          toolConfig: { functionCallingConfig: { mode: "AUTO" } }
        }),
      });
    } else {
       // Fallback to OpenAI format for Lovable (if needed, but we prioritize native)
       // For now, throw error if no native key because we need grounding
       throw new Error("Native Gemini API Key required for Super Intelligence features (Grounding).");
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    data = await response.json();
    
    // Parse Native Response
    const candidate = data.candidates?.[0];
    const content = candidate?.content;
    const parts = content?.parts || [];
    
    // Check for text response
    const textPart = parts.find((p: any) => p.text);
    if (textPart) {
      finalResponse += textPart.text;
    }

    // Check for tool calls
    const functionCalls = parts.filter((p: any) => p.functionCall).map((p: any) => p.functionCall);

    if (functionCalls.length > 0) {
      console.log(`🛠️ Executing ${functionCalls.length} tool calls`);
      
      // Add model's tool call message to history
      contents.push(content);

      const toolResults = await Promise.all(
        functionCalls.map(async (call: any) => {
          const { name, args } = call;
          console.log(`▶️ Tool: ${name}`, args);
          
          let result;
          try {
            result = await executeTool(supabase, name, args);
          } catch (error: unknown) {
            console.error(`❌ Tool error ${name}:`, error);
            result = { error: (error as Error).message };
          }
          
          return {
            functionResponse: {
              name: name,
              response: { name: name, content: result }
            }
          };
        })
      );

      // Add tool results to history
      contents.push({ role: 'function', parts: toolResults });
      
    } else {
      // No tool calls, we are done
      break;
    }
  }

  if (!finalResponse) {
    finalResponse = "Max iterations reached or empty response.";
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
    const { message, messages: chatHistory, thread_id, context } = await req.json();

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
      runAgent(supabase, userMessage, chatHistory || [], threadId, context),
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
