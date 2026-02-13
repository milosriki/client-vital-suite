/**
 * ============================================================================
 * PTD UNIFIED BRAIN - SHARED MEMORY FOR ALL AGENTS
 * ============================================================================
 *
 * ONE memory system that ALL agents read/write to.
 * RAG-powered retrieval across ALL historical data.
 * Smarter than HubSpot - learns from every interaction.
 *
 * Usage in ANY agent:
 *   import { brain } from "../_shared/unified-brain.ts";
 *
 *   // Get relevant context before answering
 *   const context = await brain.recall("client retention strategies");
 *
 *   // Store new knowledge after every interaction
 *   await brain.learn({ query, response, source: "ptd-agent" });
 *
 *   // Store facts that persist forever
 *   await brain.storeFact("coach_ahmed_specialty", "weight loss for executives");
 * ============================================================================
 */

import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";
import { unifiedAI } from "./unified-ai-client.ts";

// ============================================================================
// TYPES
// ============================================================================

interface Memory {
  id: string;
  query: string;
  response: string;
  knowledge_extracted: Record<string, any>;
  created_at: string;
  similarity?: number;
  source?: string;
}

interface LearnInput {
  query: string;
  response: string;
  source?: string; // Which agent created this
  thread_id?: string; // Conversation thread
  knowledge?: Record<string, any>; // Extracted facts
  embedding?: number[]; // Pre-computed embedding
}

interface RecallOptions {
  limit?: number;
  threshold?: number; // Similarity threshold (0-1)
  source?: string; // Filter by agent source
  since?: Date; // Only memories after this date
  thread_id?: string; // Only from specific conversation
}

interface Fact {
  key: string;
  value: any;
  confidence?: number;
  source?: string;
}

// ============================================================================
// UNIFIED BRAIN CLASS
// ============================================================================

class UnifiedBrain {
  private supabase: SupabaseClient;
  // private openaiKey: string; // Removed
  private initialized = false;

  constructor() {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // this.openaiKey = Deno.env.get("OPENAI_API_KEY") || ""; // Removed
    this.supabase = createClient(url, key);
  }

  // ==========================================================================
  // EMBEDDING GENERATION
  // ==========================================================================

  // ==========================================================================
  // EMBEDDING GENERATION
  // ==========================================================================

  private async getEmbedding(text: string): Promise<number[]> {
    try {
      // Use UnifiedAI (Gemini) for embeddings
      return await unifiedAI.embed(text);
    } catch (error) {
      console.error("[BRAIN] Embedding error:", error);
      return new Array(1536).fill(0); // Fallback to zero vector
    }
  }

  // ==========================================================================
  // RECALL - RAG-POWERED MEMORY RETRIEVAL
  // ==========================================================================

  /**
   * Retrieve relevant memories using semantic search (RAG)
   * Call this BEFORE generating any response to get context
   */
  async recall(query: string, options: RecallOptions = {}): Promise<Memory[]> {
    const { limit = 5, threshold = 0.75, source, since, thread_id } = options;

    try {
      // Generate embedding for the query
      const embedding = await this.getEmbedding(query);

      // Use the existing match_memories function
      const { data, error } = await this.supabase.rpc("match_memories", {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
        filter_thread_id: thread_id || null,
      });

      if (error) {
        console.error("[BRAIN] Recall error:", error);
        return [];
      }

      let memories = data || [];

      // Additional filters
      if (source) {
        memories = memories.filter(
          (m: any) => m.knowledge_extracted?.source === source,
        );
      }

      if (since) {
        memories = memories.filter((m: any) => new Date(m.created_at) >= since);
      }

      return memories;
    } catch (error) {
      console.error("[BRAIN] Recall failed:", error);
      return [];
    }
  }

  /**
   * Get recent memories (without semantic search)
   */
  async getRecent(limit = 10, source?: string): Promise<Memory[]> {
    let query = this.supabase
      .from("agent_memory")
      .select("id, query, response, knowledge_extracted, created_at, source")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (source) {
      query = query.eq("knowledge_extracted->source", source);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[BRAIN] getRecent error:", error);
      return [];
    }

    return data || [];
  }

  // ==========================================================================
  // LEARN - STORE NEW KNOWLEDGE
  // ==========================================================================

  /**
   * Store a new memory after every agent interaction
   * Call this AFTER generating any response
   */
  async learn(input: LearnInput): Promise<string | null> {
    const {
      query,
      response,
      source = "unknown",
      thread_id = `auto_${Date.now()}`,
      knowledge = {},
      embedding,
    } = input;

    try {
      // Generate embedding if not provided
      const vector =
        embedding || (await this.getEmbedding(`${query}\n${response}`));

      // Store in agent_memory
      const { data, error } = await this.supabase
        .from("agent_memory")
        .insert({
          agent_name: source,
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          thread_id,
          query,
          response,
          knowledge_extracted: { ...knowledge, source },
          embeddings: vector,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[BRAIN] Learn error:", error);
        return null;
      }

      // Also store in permanent user_memory for cross-device access
      await this.supabase.from("user_memory").upsert(
        {
          user_key: "ptd_brain",
          memory_key: `interaction_${data.id}`,
          memory_value: { query, response, source, thread_id },
          memory_type: "conversation",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_key,memory_key" },
      );

      return data.id;
    } catch (error) {
      console.error("[BRAIN] Learn failed:", error);
      return null;
    }
  }

  // ==========================================================================
  // FACTS - PERMANENT KNOWLEDGE STORAGE
  // ==========================================================================

  /**
   * Store a permanent fact (never expires)
   */
  async storeFact(
    key: string,
    value: any,
    confidence = 1.0,
    source?: string,
  ): Promise<void> {
    try {
      await this.supabase.from("user_memory").upsert(
        {
          user_key: "ptd_brain",
          memory_key: `fact_${key}`,
          memory_value: { value, confidence, source },
          memory_type: "knowledge",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_key,memory_key" },
      );
    } catch (error) {
      console.error("[BRAIN] storeFact error:", error);
    }
  }

  /**
   * Get a stored fact
   */
  async getFact(key: string): Promise<any | null> {
    try {
      const { data } = await this.supabase
        .from("user_memory")
        .select("memory_value")
        .eq("user_key", "ptd_brain")
        .eq("memory_key", `fact_${key}`)
        .single();

      return data?.memory_value?.value ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Get all facts
   */
  async getAllFacts(): Promise<Record<string, any>> {
    try {
      const { data } = await this.supabase
        .from("user_memory")
        .select("memory_key, memory_value")
        .eq("user_key", "ptd_brain")
        .eq("memory_type", "knowledge");

      const facts: Record<string, any> = {};
      for (const row of data || []) {
        const key = row.memory_key.replace("fact_", "");
        facts[key] = row.memory_value?.value;
      }
      return facts;
    } catch {
      return {};
    }
  }

  // ==========================================================================
  // PATTERNS - LEARNED BEHAVIORS
  // ==========================================================================

  /**
   * Record a pattern the system learned
   */
  async recordPattern(
    name: string,
    description: string,
    example: any,
    confidence = 0.5,
  ): Promise<void> {
    try {
      // Check if pattern exists
      const { data: existing } = await this.supabase
        .from("agent_patterns")
        .select("id, examples, usage_count, confidence")
        .eq("pattern_name", name)
        .single();

      if (existing) {
        // Update existing pattern
        const newExamples = [...(existing.examples || []), example].slice(-10);
        const newConfidence = Math.min(1, existing.confidence + 0.05);

        await this.supabase
          .from("agent_patterns")
          .update({
            examples: newExamples,
            usage_count: existing.usage_count + 1,
            confidence: newConfidence,
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        // Create new pattern
        await this.supabase.from("agent_patterns").insert({
          pattern_name: name,
          description,
          examples: [example],
          confidence,
          usage_count: 1,
          last_used_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("[BRAIN] recordPattern error:", error);
    }
  }

  /**
   * Get a pattern by name
   */
  async getPattern(name: string): Promise<any | null> {
    try {
      const { data } = await this.supabase
        .from("agent_patterns")
        .select("id, pattern_name, confidence, usage_count, last_used_at, pattern_data")
        .eq("pattern_name", name)
        .single();

      return data;
    } catch {
      return null;
    }
  }

  /**
   * Get top patterns by confidence
   */
  async getTopPatterns(limit = 10): Promise<any[]> {
    try {
      const { data } = await this.supabase
        .from("agent_patterns")
        .select("id, pattern_name, confidence, usage_count, last_used_at, pattern_data")
        .order("confidence", { ascending: false })
        .limit(limit);

      return data || [];
    } catch {
      return [];
    }
  }

  // ==========================================================================
  // CONTEXT BUILDER - FOR AGENT PROMPTS
  // ==========================================================================

  /**
   * Build full context for an agent prompt
   * Combines: RAG memories + facts + patterns
   */
  async buildContext(
    query: string,
    options: {
      includeMemories?: boolean;
      includeFacts?: boolean;
      includePatterns?: boolean;
      memoryLimit?: number;
    } = {},
  ): Promise<string> {
    const {
      includeMemories = true,
      includeFacts = true,
      includePatterns = true,
      memoryLimit = 5,
    } = options;

    const parts: string[] = [];

    // 1. Relevant memories (RAG)
    if (includeMemories) {
      const memories = await this.recall(query, { limit: memoryLimit });
      if (memories.length > 0) {
        parts.push("## Relevant Past Interactions:");
        for (const m of memories) {
          parts.push(`- Q: ${m.query.slice(0, 100)}...`);
          parts.push(`  A: ${m.response.slice(0, 200)}...`);
          parts.push(`  (similarity: ${(m.similarity || 0).toFixed(2)})`);
        }
      }
    }

    // 2. Known facts
    if (includeFacts) {
      const facts = await this.getAllFacts();
      const factKeys = Object.keys(facts);
      if (factKeys.length > 0) {
        parts.push("\n## Known Facts:");
        for (const key of factKeys.slice(0, 20)) {
          parts.push(`- ${key}: ${JSON.stringify(facts[key])}`);
        }
      }
    }

    // 3. Learned patterns
    if (includePatterns) {
      const patterns = await this.getTopPatterns(5);
      if (patterns.length > 0) {
        parts.push("\n## Learned Patterns:");
        for (const p of patterns) {
          parts.push(
            `- ${p.pattern_name} (confidence: ${p.confidence}): ${p.description}`,
          );
        }
      }
    }

    return parts.join("\n");
  }

  // ==========================================================================
  // STATS
  // ==========================================================================

  async getStats(): Promise<Record<string, number>> {
    try {
      const [memories, facts, patterns] = await Promise.all([
        this.supabase
          .from("agent_memory")
          .select("id", { count: "exact", head: true }),
        this.supabase
          .from("user_memory")
          .select("id", { count: "exact", head: true })
          .eq("user_key", "ptd_brain"),
        this.supabase
          .from("agent_patterns")
          .select("id", { count: "exact", head: true }),
      ]);

      return {
        total_memories: memories.count || 0,
        total_facts: facts.count || 0,
        total_patterns: patterns.count || 0,
      };
    } catch {
      return { total_memories: 0, total_facts: 0, total_patterns: 0 };
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const brain = new UnifiedBrain();

// Also export types
export type { Memory, LearnInput, RecallOptions, Fact };
