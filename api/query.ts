import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

/**
 * GLOBAL BRAIN QUERY API
 *
 * Single entry point for querying the org-wide AI brain.
 * Merges multiple sources and returns answer + evidence.
 *
 * POST /api/query
 * Body: {
 *   question: string,
 *   mode?: "fast" | "deep",
 *   scope?: "global",
 *   includeEvidence?: boolean
 * }
 *
 * Returns: {
 *   answer: string,
 *   evidence: Array<{ source, data, timestamp }>,
 *   sourcesUsed: string[],
 *   latencyMs: number
 * }
 */

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Check optional access key
function checkAccessKey(req: VercelRequest): boolean {
  const requiredKey = process.env.PTD_INTERNAL_ACCESS_KEY;
  if (!requiredKey) return true; // No key required

  const providedKey = req.headers["x-ptd-key"] as string;
  return providedKey === requiredKey;
}

async function getEmbedding(text: string): Promise<number[]> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return new Array(1536).fill(0);

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
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

interface Evidence {
  source: string;
  table?: string;
  data: any;
  timestamp?: string;
  relevance?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-ptd-key");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  // Check access key if required
  if (!checkAccessKey(req)) {
    return res.status(401).json({ error: "Unauthorized. Invalid or missing x-ptd-key header." });
  }

  try {
    const supabase = getSupabaseClient();
    const { question, mode = "fast", includeEvidence = true } = req.body || {};

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        error: "question is required",
        hint: 'Send { "question": "your question here" }',
      });
    }

    const evidence: Evidence[] = [];
    const sourcesUsed: string[] = [];

    // 1. Get relevant memories via RAG
    const embedding = await getEmbedding(question);

    const { data: memories } = await supabase.rpc("match_memories", {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: mode === "deep" ? 10 : 5,
      filter_thread_id: null,
    });

    if (memories?.length) {
      sourcesUsed.push("agent_memory");
      if (includeEvidence) {
        for (const m of memories.slice(0, 3)) {
          evidence.push({
            source: "memory",
            table: "agent_memory",
            data: { query: m.query, response: m.response?.slice(0, 200) },
            timestamp: m.created_at,
            relevance: m.similarity,
          });
        }
      }
    }

    // 2. Get relevant org facts
    const { data: orgFacts } = await supabase
      .from("org_facts")
      .select("fact_key, fact_value, description, confidence, provenance")
      .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`)
      .order("confidence", { ascending: false })
      .limit(10);

    if (orgFacts?.length) {
      sourcesUsed.push("org_facts");
      if (includeEvidence) {
        for (const f of orgFacts.slice(0, 3)) {
          evidence.push({
            source: "fact",
            table: "org_facts",
            data: { key: f.fact_key, value: f.fact_value, confidence: f.confidence },
          });
        }
      }
    }

    // 3. Get ultimate truth events (if table exists)
    try {
      const { data: truthEvents } = await supabase
        .from("ultimate_truth_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (truthEvents?.length) {
        sourcesUsed.push("ultimate_truth_events");
        if (includeEvidence) {
          evidence.push({
            source: "truth_events",
            table: "ultimate_truth_events",
            data: { count: truthEvents.length, latest: truthEvents[0] },
          });
        }
      }
    } catch {
      // Table might not exist
    }

    // 4. Get lead lifecycle view (if exists)
    try {
      const { data: leadView } = await supabase
        .from("lead_lifecycle_view")
        .select("*")
        .limit(5);

      if (leadView?.length) {
        sourcesUsed.push("lead_lifecycle_view");
        if (includeEvidence) {
          evidence.push({
            source: "lead_lifecycle",
            table: "lead_lifecycle_view",
            data: { count: leadView.length },
          });
        }
      }
    } catch {
      // View might not exist
    }

    // 5. Check org documents via RAG
    try {
      const { data: docs } = await supabase.rpc("match_org_documents", {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 3,
      });

      if (docs?.length) {
        sourcesUsed.push("org_documents");
        if (includeEvidence) {
          for (const d of docs) {
            evidence.push({
              source: "document",
              table: "org_documents",
              data: { title: d.title, source: d.source, preview: d.content?.slice(0, 100) },
              relevance: d.similarity,
            });
          }
        }
      }
    } catch {
      // Function might not exist yet
    }

    // 6. Build context and call agent
    const contextParts: string[] = [];

    if (memories?.length) {
      contextParts.push("## Relevant Past Interactions:");
      for (const m of memories.slice(0, 5)) {
        contextParts.push(`- Q: ${m.query?.slice(0, 100)}`);
        contextParts.push(`  A: ${m.response?.slice(0, 200)}`);
      }
    }

    if (orgFacts?.length) {
      contextParts.push("\n## Known Facts:");
      for (const f of orgFacts.slice(0, 5)) {
        contextParts.push(`- ${f.fact_key}: ${JSON.stringify(f.fact_value)}`);
      }
    }

    // Call the agent for the answer
    const agentUrl = `${process.env.SUPABASE_URL}/functions/v1/ptd-agent-claude`;
    const agentResponse = await fetch(agentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        message: question,
        thread_id: "ptd-global",
        context: contextParts.join("\n"),
        system_note: `You have access to the following data sources: ${sourcesUsed.join(", ")}.
When answering, be specific about which data you're referencing.
If you cite specific facts or data, mention the source.`,
      }),
    });

    let answer = "Unable to generate answer";
    if (agentResponse.ok) {
      const agentData = await agentResponse.json();
      answer = agentData.response || agentData.message || "No response from agent";
    } else {
      const errorText = await agentResponse.text();
      console.error("[query] Agent error:", errorText);
      answer = `Error querying agent: ${agentResponse.status}`;
    }

    const latencyMs = Date.now() - startTime;

    return res.status(200).json({
      ok: true,
      answer,
      evidence: includeEvidence ? evidence : undefined,
      sourcesUsed,
      latencyMs,
      meta: {
        mode,
        memoryCount: memories?.length || 0,
        factCount: orgFacts?.length || 0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[query] Error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Internal server error",
      latencyMs: Date.now() - startTime,
    });
  }
}
