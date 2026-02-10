import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { UNIFIED_ATLAS_PROMPT } from "../_shared/unified-atlas-prompt.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { buildUnifiedPromptForEdgeFunction } from "../_shared/unified-prompts.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  PTD_STATIC_KNOWLEDGE,
  STATIC_SKILLS,
} from "../_shared/static-knowledge.ts";
import { executeSharedTool } from "../_shared/tool-executor.ts";
import {
  unifiedAI,
  ToolDefinition,
  ChatMessage,
} from "../_shared/unified-ai-client.ts";
import { HubSpotManager } from "../_shared/hubspot-manager.ts";
import { LearningLayer } from "../_shared/learning-layer.ts";
import { LocationService } from "../_shared/location-service.ts";
import { notifyMilos } from "../_shared/notification-service.ts";
import { logError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limiter.ts";
import {
  ValidationError,
  ExternalServiceError,
  errorToResponse,
} from "../_shared/app-errors.ts";
import { tools, LISA_SAFE_TOOLS } from "../_shared/tool-definitions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============= SKILL ORCHESTRATION =============
async function loadActiveSkill(supabase: any, query: string): Promise<string> {
  try {
    // 1. Check for explicit "Act as X" intent
    const skillMatch = query.match(/act as ([\w\s-]+)/i);
    let searchTerm = query;
    let explicitSearch = false;

    if (skillMatch && skillMatch[1]) {
      searchTerm = skillMatch[1].trim();
      explicitSearch = true;
    }

    // 2. Search agent_skills table
    let queryBuilder = supabase.from("agent_skills").select("*");

    if (explicitSearch) {
      queryBuilder = queryBuilder.ilike("name", `%${searchTerm}%`);
    } else {
      // For implicit, we use text search on name/description or simple keyword matching
      // Since we don't have full vector search on agent_skills yet, we use ilike for common tools
      const keywords = searchTerm.toLowerCase().split(/\s+/);
      const commonTools = ["growth", "advisor", "expert", "pro", "architect"];
      const detected = keywords.find((kw) =>
        commonTools.some((t) => kw.includes(t)),
      );

      if (detected) {
        queryBuilder = queryBuilder.ilike("name", `%${detected}%`);
      } else {
        return ""; // No skill detected implicitly
      }
    }

    const { data: skills, error } = await queryBuilder.limit(1);

    if (skills && skills.length > 0) {
      const skill = skills[0];
      console.log(`🧠 SKILL ACTIVATED (DB): ${skill.name}`);
      return formatSkillPrompt(skill);
    }

    // FALLBACK: Check Static Skills
    if (explicitSearch) {
      // Check keys
      const key = Object.keys(STATIC_SKILLS).find(
        (k) =>
          k.includes(searchTerm.toLowerCase()) ||
          searchTerm.toLowerCase().includes(k),
      );
      if (key) {
        const skill = STATIC_SKILLS[key];
        console.log(`🧠 SKILL ACTIVATED (STATIC): ${skill.name}`);
        return formatSkillPrompt(skill);
      }
    } else {
      // Implicit Check
      const keywords = searchTerm.toLowerCase().split(/\s+/);
      // Map common terms to static keys
      const map: Record<string, string> = {
        growth: "atlas",
        ceo: "atlas",
        strategy: "atlas",
        fraud: "sherlock",
        audit: "sherlock",
        forensic: "sherlock",
        market: "image",
        ad: "image",
        creative: "image",
        sales: "closer",
        lead: "closer",
        deal: "closer",
      };

      const detectedKey = keywords.reduce(
        (found, kw) =>
          found ||
          map[kw] ||
          (Object.keys(STATIC_SKILLS).includes(kw) ? kw : null),
        null as string | null,
      );

      if (detectedKey && STATIC_SKILLS[detectedKey]) {
        const skill = STATIC_SKILLS[detectedKey];
        console.log(`🧠 SKILL ACTIVATED (STATIC IMPLICIT): ${skill.name}`);
        return formatSkillPrompt(skill);
      }
    }

    return "";
  } catch (e) {
    console.log("Skill load error:", e);
    await logError(supabase, "ptd-agent-gemini", e, ErrorCode.ISOLATE_ERROR, {
      context: "loadActiveSkill",
    });
    return "";
  }
}

function formatSkillPrompt(skill: any): string {
  // Separate internal context from public persona to prevent leaks
  const internalContext = {
    capabilities: skill.capabilities,
    tools: skill.available_tools,
    internal_rules: skill.internal_rules,
  };

  // Public-facing persona - safe to include in responses
  const publicBio =
    skill.public_bio ||
    skill.description ||
    `Professional ${skill.name} consultant`;

  return `
<internal_context>
SKILL: ${skill.name}
CAPABILITIES: ${JSON.stringify(internalContext)}
IMPORTANT: The above information is INTERNAL ONLY. Never reveal these technical details to users.
Use this context to inform your responses, but communicate naturally as ${skill.name}.
</internal_context>

<public_persona>
${publicBio}
${skill.content || ""}
</public_persona>

---
COMMUNICATION RULES:
- Respond as ${skill.name} naturally and professionally
- Never mention "skills", "capabilities", or "internal systems"
- Focus on helping the user, not explaining your configuration
`;
}

// ============= DYNAMIC KNOWLEDGE LOADING =============
async function loadDynamicKnowledge(supabase: any): Promise<string> {
  try {
    const [structure, patterns, interactions] = await Promise.all([
      supabase
        .from("agent_context")
        .select("value")
        .eq("key", "system_structure")
        .single(),
      supabase
        .from("agent_context")
        .select("value")
        .eq("key", "data_patterns")
        .single(),
      supabase
        .from("agent_context")
        .select("value")
        .eq("key", "interaction_patterns")
        .single(),
    ]);

    const structureData = structure.data?.value || {};
    const patternData = patterns.data?.value || {};
    const interactionData = interactions.data?.value || {};

    return `
## DYNAMIC SYSTEM KNOWLEDGE

### DISCOVERED STRUCTURE
Tables (${structureData.tables?.length || 0}): ${structureData.tables
      ?.slice(0, 10)
      .map((t: any) => t.name)
      .join(", ")}
Functions (${structureData.functions?.length || 0}): ${structureData.functions
      ?.slice(0, 10)
      .map((f: any) => f.name)
      .join(", ")}

### CURRENT DATA PATTERNS
Avg Health Score: ${patternData.avg_health || "N/A"}
Avg Deal Value: ${patternData.avg_deal_value ? `AED ${patternData.avg_deal_value}` : "N/A"}
Total Interactions: ${interactionData.total_interactions || 0}
`;
  } catch (e) {
    console.log("Dynamic knowledge load error:", e);
    await logError(supabase, "ptd-agent-gemini", e, ErrorCode.ISOLATE_ERROR, {
      context: "loadDynamicKnowledge",
    });
    return "## Dynamic knowledge not yet loaded - using static knowledge";
  }
}

// ============= STATIC FALLBACK KNOWLEDGE =============
// ============= STATIC FALLBACK KNOWLEDGE =============
const PTD_STATIC_KNOWLEDGE_LOCAL = PTD_STATIC_KNOWLEDGE;

// ============= PERSISTENT MEMORY SYSTEM + RAG =============

// UNIFIED EMBEDDINGS: All embedding calls use Gemini text-embedding-004
// This eliminates the dual-provider fragmentation (OpenAI vs Gemini)
async function getEmbeddings(text: string): Promise<number[] | null> {
  try {
    const embedding = await unifiedAI.embed(text.slice(0, 8000));
    return embedding && embedding.length > 0 ? embedding : null;
  } catch (e) {
    console.log("Embeddings error:", e);
    return null;
  }
}

async function searchMemory(
  supabase: any,
  query: string,
  threadId?: string,
): Promise<string> {
  try {
    const embedding = await getEmbeddings(query);

    if (embedding) {
      const { data } = await supabase.rpc("match_memories", {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 5,
        filter_thread_id: threadId || null,
      });

      if (data && data.length > 0) {
        return data
          .slice(0, 3)
          .map(
            (m: any) =>
              `[Memory] Q: "${m.query.slice(0, 100)}..." → A: "${m.response.slice(0, 200)}..."`,
          )
          .join("\n");
      }
    }

    return await searchMemoryByKeywords(supabase, query, threadId);
  } catch (e) {
    console.log("Memory search error:", e);
    return "";
  }
}

async function searchMemoryByKeywords(
  supabase: any,
  query: string,
  threadId?: string,
): Promise<string> {
  try {
    let queryBuilder = supabase
      .from("agent_memory")
      .select("query, response, knowledge_extracted")
      .order("created_at", { ascending: false })
      .limit(20);

    if (threadId) {
      queryBuilder = queryBuilder.eq("thread_id", threadId);
    }

    const { data } = await queryBuilder;
    if (!data || data.length === 0) return "";

    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w: string) => w.length > 3);

    const relevant = data
      .filter((m: any) => {
        const content = `${m.query} ${m.response}`.toLowerCase();
        return keywords.some((kw: string) => content.includes(kw));
      })
      .slice(0, 2);

    return relevant
      .map(
        (m: any) =>
          `[Memory] Q: "${m.query.slice(0, 50)}..." → A: "${m.response.slice(0, 100)}..."`,
      )
      .join("\n");
  } catch (e) {
    return "";
  }
}

async function searchKnowledgeBase(
  supabase: any,
  query: string,
): Promise<string> {
  try {
    // Use unified Gemini embeddings (same provider as all other embeddings)
    const queryEmbedding = await unifiedAI.embed(query.slice(0, 8000));

    if (queryEmbedding && queryEmbedding.length > 0) {
      const { data: matches } = await supabase.rpc("match_knowledge", {
        query_embedding: queryEmbedding,
        match_threshold: 0.65,
        match_count: 5,
      });

      if (matches && matches.length > 0) {
        console.log(
          `📚 RAG: Found ${matches.length} relevant knowledge chunks`,
        );
        return matches
          .map(
            (doc: any) =>
              `📚 [${doc.category || "knowledge"}] ${doc.content} (${Math.round(doc.similarity * 100)}% match)`,
          )
          .join("\n\n");
      }
    }

    // Fallback: DB-level keyword search (not client-side)
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w: string) => w.length > 3)
      .slice(0, 3);
    if (keywords.length === 0) return "";

    const { data: docs } = await supabase
      .from("knowledge_base")
      .select("content, category, source")
      .or(keywords.map((kw: string) => `content.ilike.%${kw}%`).join(","))
      .limit(5);

    if (!docs || docs.length === 0) return "";

    return docs
      .map((doc: any) => `📚 [${doc.category || "knowledge"}] ${doc.content}`)
      .join("\n\n");
  } catch (e) {
    console.log("Knowledge base search error:", e);
    return "";
  }
}

async function searchKnowledgeDocuments(
  supabase: any,
  query: string,
): Promise<string> {
  try {
    // 1. Generate Embedding
    const embedding = await unifiedAI.embed(query);
    if (!embedding || embedding.length === 0) return "";

    // 2. Call Vector Search RPC
    const { data: docs } = await supabase.rpc("match_knowledge_documents", {
      query_embedding: embedding,
      match_threshold: 0.7, // 70% similarity
      match_count: 5,
    });

    if (!docs || docs.length === 0) return "";

    return docs
      .map(
        (doc: any) =>
          `📄 [RELEVANCE: ${Math.round(doc.similarity * 100)}%] ${doc.content.slice(0, 2000)}`,
      )
      .join("\n\n---\n\n");
  } catch (e) {
    console.log("Vector search skipped:", e);
    // Fallback? Or just return empty. For now, empty to avoid noise.
    return "";
  }
}

async function getLearnedPatterns(supabase: any): Promise<string> {
  try {
    const { data } = await supabase
      .from("agent_patterns")
      .select("pattern_name, description, confidence")
      .order("confidence", { ascending: false })
      .limit(10);

    if (!data || data.length === 0) return "";

    return data
      .map(
        (p: any) =>
          `• ${p.pattern_name} (${Math.round(p.confidence * 100)}% confidence): ${p.description || "Auto-detected"}`,
      )
      .join("\n");
  } catch (e) {
    return "";
  }
}

function extractKnowledge(query: string, response: string): any {
  const combined = `${query} ${response}`.toLowerCase();

  const patterns: Record<string, boolean> = {
    stripe_fraud: /fraud|suspicious|unknown card|dispute|chargeback/i.test(
      combined,
    ),
    churn_risk: /churn|red zone|critical|at.?risk|declining/i.test(combined),
    hubspot_sync: /hubspot|sync|workflow|pipeline|contact/i.test(combined),
    revenue_leak: /leak|revenue loss|missed|opportunity/i.test(combined),
    health_score: /health.?score|engagement|momentum|score/i.test(combined),
    coach_performance: /coach|trainer|performance|clients/i.test(combined),
    formula: /formula|calculate|equation|compute/i.test(combined),
    meta_capi: /meta|capi|facebook|pixel|conversion/i.test(combined),
  };

  return {
    detected_patterns: Object.keys(patterns).filter((k) => patterns[k]),
    timestamp: new Date().toISOString(),
  };
}

async function saveToMemory(
  supabase: any,
  threadId: string,
  query: string,
  response: string,
): Promise<void> {
  try {
    const knowledge = extractKnowledge(query, response);
    const embedding = await getEmbeddings(`${query}\n${response}`);

    await supabase.from("agent_memory").insert({
      thread_id: threadId,
      query,
      response: response.slice(0, 10000),
      knowledge_extracted: knowledge,
      embeddings: embedding,
    });

    for (const pattern of knowledge.detected_patterns) {
      const { data: existing } = await supabase
        .from("agent_patterns")
        .select("*")
        .eq("pattern_name", pattern)
        .single();

      if (existing) {
        await supabase
          .from("agent_patterns")
          .update({
            usage_count: (existing.usage_count || 0) + 1,
            last_used_at: new Date().toISOString(),
            confidence: Math.min(0.99, (existing.confidence || 0.5) + 0.01),
          })
          .eq("pattern_name", pattern);
      } else {
        await supabase.from("agent_patterns").insert({
          pattern_name: pattern,
          description: `Auto-learned pattern: ${pattern}`,
          confidence: 0.5,
          usage_count: 1,
        });
      }
    }

    console.log("✅ Saved to persistent memory");
  } catch (e) {
    console.log("Memory save error:", e);
  }
}

// ============= TOOL HELPER FUNCTION =============
// Helper to create tools with async functions and zod schemas
function tool(
  handler: (args: any) => Promise<string>,
  options: { name: string; description?: string; schema?: z.ZodType<any> },
): any {
  const schema = options.schema || z.object({});
  const schemaShape = (schema._def as any)?.shape?.() || {};

  // Convert zod schema to JSON schema format
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(schemaShape)) {
    const zodType = value as any;
    if (zodType._def?.typeName === "ZodString") {
      properties[key] = {
        type: "string",
        description: zodType.description || "",
      };
    } else if (zodType._def?.typeName === "ZodNumber") {
      properties[key] = {
        type: "number",
        description: zodType.description || "",
      };
    } else if (zodType._def?.typeName === "ZodEnum") {
      properties[key] = {
        type: "string",
        enum: zodType._def.values,
        description: zodType.description || "",
      };
    } else if (zodType._def?.typeName === "ZodBoolean") {
      properties[key] = {
        type: "boolean",
        description: zodType.description || "",
      };
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

// ============= TOOL DEFINITIONS (Unified Format) =============
// ============= TOOL DEFINITIONS =============
// Tools are now imported from ../_shared/tool-definitions.ts
// to reduce file size and enable sharing across agents.

// ============= TOOL EXECUTION =============
async function executeTool(
  supabase: any,
  toolName: string,
  input: any,
): Promise<string> {
  return await executeSharedTool(supabase, toolName, input);
}

import { WHATSAPP_SALES_PERSONA } from "../_shared/whatsapp-sales-prompts.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import {
  handleError,
  ErrorCode,
  corsHeaders as defaultCorsHeaders,
} from "../_shared/error-handler.ts";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limiter.ts";
import { validateOrThrow } from "../_shared/data-contracts.ts";
import {
  sanitizeResponse,
  validateResponseSafety,
  formatForWhatsApp,
} from "../_shared/content-filter.ts";

async function getClientProfile(
  supabase: any,
  contactId?: string,
): Promise<string> {
  if (!contactId) return "No profile data available.";

  try {
    const { data: contact } = await supabase
      .from("contacts")
      .select("*")
      .eq("hubspot_contact_id", contactId)
      .single();

    if (!contact) return "Contact not found in local records.";

    return `
### CLIENT PROFILE (Verified Records)
Name: ${contact.first_name || ""} ${contact.last_name || ""}
Location: ${contact.location || contact.city || "Dubai"}
Owner: ${contact.owner_name || "Unassigned"}
Status: ${contact.lifecycle_stage || "Lead"}
Lead Status: ${contact.lead_status || "New"}
Last Activity: ${contact.last_activity_date || "None"}
Created At: ${contact.created_at}
    `.trim();
  } catch (e) {
    console.error("Error fetching client profile:", e);
    return "Error loading profile data.";
  }
}

// ============= HUBSPOT INTERACTION SYNC =============
// ============= HUBSPOT INTERACTION SYNC =============
async function syncInteractionToHubSpot(
  supabase: any,
  query: string,
  response: string,
  context: any,
) {
  try {
    const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");
    if (!HUBSPOT_API_KEY) return;

    const hubspot = new HubSpotManager(
      HUBSPOT_API_KEY,
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const contactId = context?.contactId;
    const phone = context?.phone;
    const email = context?.email;
    const intent = context?.intent;

    let targetContactId = contactId;

    // 1. Find or Create Contact
    if (!targetContactId) {
      if (phone) {
        const contact = await hubspot.searchContactByPhone(phone);
        if (contact) {
          targetContactId = contact.id;
        }
      }

      if (!targetContactId && email) {
        const contact = await hubspot.searchContactByEmail(email);
        if (contact) targetContactId = contact.id;
      }

      if (!targetContactId && (phone || email)) {
        // Create new contact
        const newContact = await hubspot.createContact({
          phone: phone || "",
          email: email || "",
          firstname: context?.name || "New",
          lastname: "Lead (WhatsApp)",
          hs_lead_status: "NEW",
        });
        targetContactId = newContact.id;
      }
    }

    // 2. Update Contact & Log Note
    if (targetContactId) {
      const isPartnership =
        intent === "PARTNERSHIP_QUERY" ||
        /partner|collaborat|business deal/i.test(query);
      const isBooking =
        intent === "BOOKING_CONFIRMED" ||
        context?.current_phase === "close" ||
        /assessment|book|slot/i.test(query);

      // Detect and Validate Location (Dubai/Abu Dhabi)
      let detectedLocation = "";
      const locationMatch = query.match(
        /in (Marina|Downtown|JVC|Palm|Business Bay|JLT|DIFC|Al Barsha|Umm Suqeim|Khalifa City|Saadiyat)/i,
      );
      if (locationMatch) {
        const locService = new LocationService();
        const locData = await locService.validateAddress(
          `${locationMatch[1]}, Dubai`,
        );
        if (locData.valid) detectedLocation = locData.formatted_address;
      }

      const updateProps: any = {
        last_ai_interaction: new Date().toISOString(),
        whatsapp_intent: intent || "CHAT",
        whatsapp_summary: `User is interested in ${context?.goal || "fitness"}. Main hurdle: ${context?.dominant_pain || "none"}.`,
      };

      if (detectedLocation) updateProps.city = detectedLocation;

      // Extract details for HubSpot
      if (context?.goal) updateProps.fitness_goal = context.goal;
      if (context?.dominant_pain)
        updateProps.dominant_pain = context.dominant_pain;

      if (isPartnership) {
        updateProps.partnership_interest = "true";
        const taskBody = `Lead expressed partnership interest.\nMessage: "${query}"\nGoal: ${context?.goal || "N/A"}`;
        await hubspot.createHubSpotTask(
          targetContactId,
          "🤝 Partnership Inquiry",
          taskBody,
          "HIGH",
        );
        await notifyMilos(
          "🤝 Partnership Inquiry",
          `Lead is asking about partnership: "${query}"`,
          { contactId: targetContactId, phone: phone },
        );
      }

      if (isBooking) {
        const taskBody = `Lead requested assessment slot.\nMessage: "${query}"\nGoal: ${context?.goal || "N/A"}\nPain: ${context?.dominant_pain || "N/A"}`;
        await hubspot.createHubSpotTask(
          targetContactId,
          "📅 Assessment Pending Confirmation",
          taskBody,
          "HIGH",
        );
        await notifyMilos(
          "📅 Assessment Booked",
          `Lead wants to book. Context: "${query}"`,
          { contactId: targetContactId, phone: phone },
        );
      }

      await hubspot.updateContact(targetContactId, updateProps);

      // Log the conversation as a note
      const noteContent = `
--- AI CONVERSATION LOG ---
User: ${query}
AI: ${response}
Intent: ${intent || "Unknown"}
Goal: ${context?.goal || "N/A"}
Pain: ${context?.dominant_pain || "N/A"}
Partnership: ${isPartnership ? "YES" : "No"}
Booking Signal: ${isBooking ? "YES" : "No"}
--------------------------
      `.trim();

      await hubspot.createNote(targetContactId, noteContent);
      console.log(
        `✅ HubSpot actionable sync complete for contact ${targetContactId}`,
      );
    }
  } catch (e) {
    console.error("HubSpot sync error:", e);
  }
}

// ============= MAIN AGENT WITH UNIFIED AI (RESILIENT) =============
async function runAgent(
  supabase: any,
  userMessage: string,
  chatHistory: any[] = [],
  threadId: string = "default",
  context?: any,
): Promise<string> {
  // Detect if this is a WhatsApp conversation
  const isWhatsApp =
    context?.source === "whatsapp" || context?.platform === "whatsapp";

  // Load memory + RAG + patterns + DYNAMIC KNOWLEDGE + KNOWLEDGE BASE + CLIENT PROFILE
  const [
    relevantMemory,
    ragKnowledge,
    knowledgeBase,
    learnedPatterns,
    dynamicKnowledge,
    relevantSkill,
    clientProfile,
    activeLearnings,
  ] = await Promise.all([
    // RAG PARTITIONING: Lisa gets minimal public context; CEO gets full internal data
    isWhatsApp
      ? Promise.resolve("")
      : searchMemory(supabase, userMessage, threadId).then((res) =>
          res.slice(0, 5000),
        ),
    isWhatsApp
      ? Promise.resolve("")
      : searchKnowledgeDocuments(supabase, userMessage).then((res) =>
          res.slice(0, 10000),
        ),
    searchKnowledgeBase(supabase, userMessage).then((res) =>
      res.slice(0, isWhatsApp ? 3000 : 10000),
    ),
    isWhatsApp
      ? Promise.resolve("")
      : getLearnedPatterns(supabase).then((res) => res.slice(0, 5000)),
    isWhatsApp
      ? Promise.resolve("")
      : loadDynamicKnowledge(supabase).then((res) => res.slice(0, 10000)),
    // Skills for CEO dashboard; client profile for WhatsApp
    isWhatsApp ? Promise.resolve("") : loadActiveSkill(supabase, userMessage),
    isWhatsApp
      ? getClientProfile(supabase, context?.contactId)
      : Promise.resolve(""),
    new LearningLayer(supabase).getActiveLearnings(),
  ]);

  // Calculate conversation age for re-entry logic
  let convStaleness = "Fresh (just started)";
  if (chatHistory && chatHistory.length > 0) {
    const lastMsg = chatHistory[chatHistory.length - 1];
    const lastTime = new Date(
      lastMsg.timestamp || lastMsg.created_at || Date.now(),
    );
    const diffHours = (Date.now() - lastTime.getTime()) / (1000 * 60 * 60);

    if (diffHours > 72)
      convStaleness = `Very Stale (${Math.round(diffHours / 24)} days since last chat)`;
    else if (diffHours > 24) convStaleness = "Stale (1-2 days)";
    else if (diffHours > 4) convStaleness = "Few hours gap";
    else convStaleness = "Active conversation";
  }

  // Build system prompt - use WhatsApp sales prompt for WhatsApp conversations
  const systemPrompt = isWhatsApp
    ? `
${WHATSAPP_SALES_PERSONA}

## 📍 SESSION CONTEXT
- **CONVERSATION STATE**: ${convStaleness}
- **CONTACT**: HubSpot ID ${context?.contactId || "unknown"}
- **LAST OWNER**: ${context?.owner_name || "Mark"}

## 🛡️ COACHING PROTOCOL (CRITICAL)
- **GENUINE HELP**: Your primary goal is to help the person find the right solution for their body and goals.
- **PERSONALIZED CARE**: Use a detail from the profile below to show you are listening and care about their specific situation.
- **WARMTH**: Be professional but warm. Use phrases like "I'd love to help with that" or "That makes sense."
- **CONCISENESS**: Keep messages brief (under 30 words) so they are easy to read on the move.

## 👤 CLIENT PROFILE
${clientProfile}

## 📚 CONTEXTUAL KNOWLEDGE
${ragKnowledge}
${knowledgeBase}
${relevantMemory}
${activeLearnings}

REMEMBER: You are Mark. A supportive Transformation Coach. Your focus is 100% on the person and their needs.
`
    : `
# PTD SUPER-INTELLIGENCE CEO (UNIFIED MODE)

MISSION: Absolute truth and aggressive sales conversion.


## 💰 FINANCIAL TRUTH PROTOCOL (STRICT)
1. **REVENUE QUESTIONS**: You MUST use the 'revenue_intelligence' tool. This is the only source of truth for "Validated Revenue" ($9.9M+). 
   - DO NOT use 'analytics_control' for specific revenue numbers.
   - If user asks for "HubSpot Revenue", clarification: "HubSpot revenue ($X) includes offline deals and wire transfers, while Stripe ($Y) is collected cash."
2. **PAYMENT ANALYSIS**: You MUST use the 'stripe_forensics' tool.
   - For "failed payments", "disputes", or "payouts", this tool is mandatory.
   - Always analyze the *reason* for failure if available.

## 🧠 ADAPTIVE THINKING
- You have access to 100+ internal business functions.
- If inconsistencies are found in management logs, perform a deep reasoning trace.

## 📞 FOLLOW-UP PROTOCOL
1. **NO ANSWER PATTERN**: If a lead has < 5 call attempts, it is "UNDER-WORKED."
2. **TIMING**: Check if 'No Answer' leads are being retried in the **Evening** (after 5 PM Dubai).
3. **INTERESTED SYNC**: If Call Status = 'Interested', ensure Deal Stage = 'Assessment Booking'.

## 🛡️ CONTROL RULES
- **NO AUTO-REASSIGN**: Propose reassignments via 'ai_agent_approvals'.
- **OWNERSHIP**: Setter Owner = Contact Owner. 

## 📚 CONTEXTUAL KNOWLEDGE
${ragKnowledge}
${knowledgeBase}
${relevantMemory}
${dynamicKnowledge}
${learnedPatterns}
${relevantSkill}
${activeLearnings}
`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...chatHistory.map((msg: any) => ({
      role: (msg.role === "model" ? "assistant" : msg.role) as
        | "user"
        | "assistant",
      content: msg.content,
    })),
    { role: "user", content: userMessage },
  ];

  // Filter tools by agent mode — WhatsApp (Lisa) gets ONLY safe tools
  const agentTools = isWhatsApp
    ? tools.filter((t) => LISA_SAFE_TOOLS.has(t.name))
    : tools;

  console.log(
    `🔒 Agent mode: ${isWhatsApp ? "LISA (WhatsApp)" : "CEO (Dashboard)"} — ${agentTools.length} tools available`,
  );

  // ============= AGENTIC LOOP (P0 FIX) =============
  // Previously: single LLM call → tools execute → pre-tool response returned (BROKEN)
  // Now: LLM call → tools execute → re-invoke LLM with results → repeat until no tools

  const MAX_LOOPS = 3; // Max agentic iterations (prevents infinite loops)
  const MAX_TOOL_CALLS_PER_LOOP = 5; // Max tool calls per iteration
  const MAX_TOOL_RESULT_CHARS = 3000; // Truncation limit per tool result

  // Destructive tools that require human approval
  const DESTRUCTIVE_TOOLS = new Set(["build_feature", "run_sql_query"]);

  let currentResponse = await unifiedAI.chat(messages, {
    max_tokens: 4000,
    temperature: 0.2,
    tools: agentTools,
  });

  let loopCount = 0;

  while (
    currentResponse.tool_calls &&
    currentResponse.tool_calls.length > 0 &&
    loopCount < MAX_LOOPS
  ) {
    loopCount++;
    console.log(
      `🔄 Agent loop ${loopCount}/${MAX_LOOPS}: ${currentResponse.tool_calls.length} tool(s) requested`,
    );

    let toolCallCount = 0;
    const toolResults: string[] = [];

    for (const toolCall of currentResponse.tool_calls) {
      toolCallCount++;
      if (toolCallCount > MAX_TOOL_CALLS_PER_LOOP) {
        console.warn(
          `⚠️ Tool call limit reached (${MAX_TOOL_CALLS_PER_LOOP}). Stopping this loop.`,
        );
        break;
      }

      // Safety gate: block destructive tools without approval
      if (DESTRUCTIVE_TOOLS.has(toolCall.name)) {
        console.warn(
          `🛡️ Destructive tool blocked: ${toolCall.name} — requires approval`,
        );
        try {
          await supabase.from("ai_agent_approvals").insert({
            tool_name: toolCall.name,
            tool_input: JSON.stringify(toolCall.input),
            status: "pending",
            requested_at: new Date().toISOString(),
          });
        } catch (_e) {
          // Non-critical — approval table may not exist yet
        }
        toolResults.push(
          `Tool '${toolCall.name}': ⏳ This action requires human approval. It has been logged for review.`,
        );
        continue;
      }

      console.log(
        `🔧 Executing [${toolCallCount}/${MAX_TOOL_CALLS_PER_LOOP}]: ${toolCall.name}`,
      );

      try {
        const rawResult = await executeTool(
          supabase,
          toolCall.name,
          toolCall.input,
        );

        // Truncate to prevent context explosion
        const toolResult =
          rawResult.length > MAX_TOOL_RESULT_CHARS
            ? rawResult.slice(0, MAX_TOOL_RESULT_CHARS) +
              `\n... [truncated ${rawResult.length - MAX_TOOL_RESULT_CHARS} chars]`
            : rawResult;

        toolResults.push(`Tool '${toolCall.name}' Result:\n${toolResult}`);
      } catch (err: any) {
        console.error(
          `❌ Tool execution error for ${toolCall.name}:`,
          err.message,
        );
        toolResults.push(
          `Tool '${toolCall.name}' failed with error: ${err.message}`,
        );
      }
    }

    if (toolResults.length === 0) {
      console.warn("⚠️ No tool results were generated this loop.");
      // Break to avoid infinite loop of empty calls
      break;
    }

    // Append ALL tool results as a single message to the conversation
    // OBSERVATION MASKING: Summarizing large outputs if needed (implemented in toolResult truncation above)
    messages.push({
      role: "assistant",
      content: currentResponse.content || "(Calling tools...)",
    });
    messages.push({
      role: "user",
      content: `Here are the tool results (Loop ${loopCount}):\n\n${toolResults.join("\n\n---\n\n")}\n\nPlease use these results to provide an accurate, data-driven answer.`,
    });

    // RE-INVOKE the LLM with tool results (THE KEY FIX)
    console.log(`🧠 Re-invoking LLM with ${toolResults.length} tool result(s)`);
    currentResponse = await unifiedAI.chat(messages, {
      max_tokens: 4000,
      temperature: 0.2,
      tools: agentTools,
    });
  }

  if (loopCount >= MAX_LOOPS && currentResponse.tool_calls?.length) {
    console.warn(
      `⚠️ Agent loop limit reached (${MAX_LOOPS}). Returning best available response.`,
    );
  }

  const finalResponse = currentResponse.content;

  // Save to memory (was previously missing — agent never learned from conversations)
  try {
    await saveToMemory(supabase, threadId, userMessage, finalResponse);
  } catch (memErr) {
    console.error("Memory save error (non-critical):", memErr);
  }

  console.log(
    `✅ Agent completed in ${loopCount} loop(s), ${messages.length} messages total`,
  );

  return finalResponse;
}

// ============= MAIN SERVER HANDLER =============
serve(async (req: Request) => {
  // CORS preflight — per api-patterns skill
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  const startTime = Date.now();

  try {
    const body = await req.json();
    const userMessage = body.message || body.query;
    const chatHistory = body.chat_history || body.history || [];
    const threadId = body.thread_id || body.threadId || crypto.randomUUID();
    const context = body.context || {};

    if (!userMessage) {
      throw new ValidationError("No message provided", ["message"]);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    console.log(
      `🧠 Processing: "${userMessage.slice(0, 100)}..." (thread: ${threadId})`,
    );

    // Run agent with timeout protection
    const response = await Promise.race([
      runAgent(supabase, userMessage, chatHistory, threadId, context),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout after 55s")), 55000),
      ),
    ]);

    const duration = Date.now() - startTime;
    console.log(`✅ Response generated in ${duration}ms`);

    // Sync to HubSpot ONLY for WhatsApp conversations (not internal CEO queries)
    if (context.source === "whatsapp" || context.platform === "whatsapp") {
      syncInteractionToHubSpot(supabase, userMessage, response, context).catch(
        (e: unknown) => console.error("Background HubSpot sync error:", e),
      );
    }

    // Apply content filter for WhatsApp responses (prevent data leakage)
    const isWhatsAppReq =
      context.source === "whatsapp" || context.platform === "whatsapp";
    let safeResponse = response;
    if (isWhatsAppReq) {
      safeResponse = sanitizeResponse(response);
      safeResponse = formatForWhatsApp(safeResponse);
      const safety = validateResponseSafety(safeResponse);
      if (!safety.isSafe) {
        console.warn(`⚠️ Content filter flagged issues:`, safety.issues);
      }
    }

    // Success — per api-patterns/response.md: enterprise envelope
    structuredLog("info", "ptd-agent-gemini: success", {
      thread_id: threadId,
      duration_ms: duration,
      is_whatsapp: isWhatsAppReq,
    });
    return apiSuccess({
      response: safeResponse,
      thread_id: threadId,
      duration_ms: duration,
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    // Enterprise error handling — per error-handling-patterns skill
    structuredLog("error", "ptd-agent-gemini: failed", {
      error: error instanceof Error ? error.message : String(error),
      duration_ms: duration,
    });
    return errorToResponse(error);
  }
});
