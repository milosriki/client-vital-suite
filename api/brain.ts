import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

/**
 * PTD UNIFIED BRAIN API
 * 
 * Access the shared AI brain from ANY device.
 * All agents share this memory - nothing is lost.
 * 
 * Endpoints:
 *   GET  /api/brain?action=recall&query=...     - RAG search
 *   GET  /api/brain?action=recent&limit=10     - Recent memories
 *   GET  /api/brain?action=facts               - All facts
 *   GET  /api/brain?action=stats               - Brain stats
 *   POST /api/brain { action: "learn", ... }   - Store memory
 *   POST /api/brain { action: "fact", ... }    - Store fact
 */

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getEmbedding(text: string): Promise<number[]> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return new Array(1536).fill(0);

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000),
      }),
    });
    const data = await response.json();
    return data.data?.[0]?.embedding || new Array(1536).fill(0);
  } catch {
    return new Array(1536).fill(0);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const supabase = getSupabaseClient();

  try {
    const action = (req.query.action as string) || (req.body?.action as string);

    switch (action) {
      // ========================================
      // RECALL - RAG Search
      // ========================================
      case "recall": {
        const query = (req.query.query as string) || (req.body?.query as string);
        if (!query) {
          return res.status(400).json({ ok: false, error: "query required" });
        }

        const limit = parseInt(req.query.limit as string) || 5;
        const threshold = parseFloat(req.query.threshold as string) || 0.75;

        const embedding = await getEmbedding(query);

        const { data, error } = await supabase.rpc("match_memories", {
          query_embedding: embedding,
          match_threshold: threshold,
          match_count: limit,
          filter_thread_id: null,
        });

        if (error) throw error;

        return res.status(200).json({
          ok: true,
          query,
          count: data?.length || 0,
          memories: data || [],
        });
      }

      // ========================================
      // RECENT - Get recent memories
      // ========================================
      case "recent": {
        const limit = parseInt(req.query.limit as string) || 10;

        const { data, error } = await supabase
          .from("agent_memory")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;

        return res.status(200).json({
          ok: true,
          count: data?.length || 0,
          memories: data || [],
        });
      }

      // ========================================
      // LEARN - Store new memory
      // ========================================
      case "learn": {
        if (req.method !== "POST") {
          return res.status(405).json({ error: "POST required for learn" });
        }

        const { query, response, source, thread_id, knowledge } = req.body;

        if (!query || !response) {
          return res.status(400).json({ ok: false, error: "query and response required" });
        }

        const embedding = await getEmbedding(`${query}\n${response}`);

        const { data, error } = await supabase
          .from("agent_memory")
          .insert({
            thread_id: thread_id || `api_${Date.now()}`,
            query,
            response,
            knowledge_extracted: { ...knowledge, source: source || "api" },
            embeddings: embedding,
          })
          .select("id")
          .single();

        if (error) throw error;

        // Also store in user_memory for persistence
        await supabase.from("user_memory").upsert({
          user_key: "ptd_brain",
          memory_key: `interaction_${data.id}`,
          memory_value: { query, response, source, thread_id },
          memory_type: "conversation",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_key,memory_key" });

        return res.status(200).json({
          ok: true,
          memory_id: data.id,
        });
      }

      // ========================================
      // FACT - Store/Get facts
      // ========================================
      case "fact": {
        if (req.method === "POST") {
          const { key, value, confidence, source } = req.body;

          if (!key || value === undefined) {
            return res.status(400).json({ ok: false, error: "key and value required" });
          }

          await supabase.from("user_memory").upsert({
            user_key: "ptd_brain",
            memory_key: `fact_${key}`,
            memory_value: { value, confidence: confidence || 1.0, source },
            memory_type: "knowledge",
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_key,memory_key" });

          return res.status(200).json({ ok: true, key, stored: true });
        }

        // GET fact
        const key = req.query.key as string;

        if (key) {
          const { data } = await supabase
            .from("user_memory")
            .select("memory_value")
            .eq("user_key", "ptd_brain")
            .eq("memory_key", `fact_${key}`)
            .single();

          return res.status(200).json({
            ok: true,
            key,
            value: data?.memory_value?.value ?? null,
          });
        }

        // Get all facts
        const { data: facts } = await supabase
          .from("user_memory")
          .select("memory_key, memory_value")
          .eq("user_key", "ptd_brain")
          .eq("memory_type", "knowledge");

        const result: Record<string, any> = {};
        for (const row of facts || []) {
          result[row.memory_key.replace("fact_", "")] = row.memory_value?.value;
        }

        return res.status(200).json({ ok: true, facts: result });
      }

      // ========================================
      // FACTS - Get all facts
      // ========================================
      case "facts": {
        const { data: facts } = await supabase
          .from("user_memory")
          .select("memory_key, memory_value, updated_at")
          .eq("user_key", "ptd_brain")
          .eq("memory_type", "knowledge")
          .order("updated_at", { ascending: false });

        const result: Record<string, any> = {};
        for (const row of facts || []) {
          result[row.memory_key.replace("fact_", "")] = row.memory_value?.value;
        }

        return res.status(200).json({ ok: true, count: facts?.length || 0, facts: result });
      }

      // ========================================
      // STATS - Brain statistics
      // ========================================
      case "stats": {
        const [memories, facts, patterns] = await Promise.all([
          supabase.from("agent_memory").select("id", { count: "exact", head: true }),
          supabase.from("user_memory").select("id", { count: "exact", head: true })
            .eq("user_key", "ptd_brain"),
          supabase.from("agent_patterns").select("id", { count: "exact", head: true }),
        ]);

        return res.status(200).json({
          ok: true,
          stats: {
            total_memories: memories.count || 0,
            total_facts: facts.count || 0,
            total_patterns: patterns.count || 0,
          },
        });
      }

      // ========================================
      // CONTEXT - Build full context for prompts
      // ========================================
      case "context": {
        const query = (req.query.query as string) || (req.body?.query as string);
        if (!query) {
          return res.status(400).json({ ok: false, error: "query required" });
        }

        // Get relevant memories
        const embedding = await getEmbedding(query);
        const { data: memories } = await supabase.rpc("match_memories", {
          query_embedding: embedding,
          match_threshold: 0.75,
          match_count: 5,
          filter_thread_id: null,
        });

        // Get facts
        const { data: factsData } = await supabase
          .from("user_memory")
          .select("memory_key, memory_value")
          .eq("user_key", "ptd_brain")
          .eq("memory_type", "knowledge")
          .limit(20);

        // Get patterns
        const { data: patterns } = await supabase
          .from("agent_patterns")
          .select("pattern_name, description, confidence")
          .order("confidence", { ascending: false })
          .limit(5);

        // Build context string
        const parts: string[] = [];

        if (memories?.length) {
          parts.push("## Relevant Past Interactions:");
          for (const m of memories) {
            parts.push(`- Q: ${(m.query || "").slice(0, 100)}...`);
            parts.push(`  A: ${(m.response || "").slice(0, 200)}...`);
          }
        }

        if (factsData?.length) {
          parts.push("\n## Known Facts:");
          for (const f of factsData) {
            const key = f.memory_key.replace("fact_", "");
            parts.push(`- ${key}: ${JSON.stringify(f.memory_value?.value)}`);
          }
        }

        if (patterns?.length) {
          parts.push("\n## Learned Patterns:");
          for (const p of patterns) {
            parts.push(`- ${p.pattern_name}: ${p.description}`);
          }
        }

        return res.status(200).json({
          ok: true,
          context: parts.join("\n"),
          memory_count: memories?.length || 0,
          fact_count: factsData?.length || 0,
          pattern_count: patterns?.length || 0,
        });
      }

      default:
        return res.status(400).json({
          ok: false,
          error: "Invalid action. Use: recall, recent, learn, fact, facts, stats, context",
        });
    }
  } catch (error: any) {
    console.error("[brain] Error:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
