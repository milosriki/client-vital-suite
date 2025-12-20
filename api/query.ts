import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkAuth, getSupabase, withRetry, success, error, openCircuit } from './_lib/utils';

// Constants
const SIMILARITY_THRESHOLD = 0.7;
const MAX_CONTEXT_CHUNKS = 10;
const TIMEOUT_MS = 55000; // Leave 5s buffer for Vercel's 60s limit

interface QueryInput {
  question: string;
  mode?: 'fast' | 'deep';
  threadId?: string;
  includeEvidence?: boolean;
}

interface Evidence {
  tables: string[];
  filters: Record<string, unknown>;
  timeRange?: { from: string; to: string };
  rowCount: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-ptd-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return error(res, 'METHOD_NOT_ALLOWED', 'Use POST', 405, undefined, startTime);
  }

  // Auth check
  const auth = checkAuth(req);
  if (!auth.authorized) {
    return error(res, 'UNAUTHORIZED', auth.error!, 401, undefined, startTime);
  }

  // Parse input
  const { question, mode = 'fast', threadId, includeEvidence = true }: QueryInput = req.body || {};

  if (!question || typeof question !== 'string') {
    return error(res, 'INVALID_INPUT', 'question is required', 400, undefined, startTime);
  }

  if (question.length > 2000) {
    return error(res, 'INVALID_INPUT', 'question too long (max 2000 chars)', 400, undefined, startTime);
  }

  try {
    const supabase = getSupabase();
    const evidence: Evidence = { tables: [], filters: {}, rowCount: 0 };
    const contextBlocks: string[] = [];

    // Set timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), TIMEOUT_MS);
    });

    const queryPromise = (async () => {
      // ========================================
      // STEP 1: Gather context (parallel)
      // ========================================

      const [facts, recentEvents, healthSummary, memories] = await Promise.all([
        // Get relevant facts
        supabase
          .from('org_facts')
          .select('fact_key, fact_value, confidence, source, valid_until')
          .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`)
          .order('confidence', { ascending: false })
          .limit(20),

        // Get recent events
        supabase
          .from('ultimate_truth_events')
          .select('event_type, event_data, source_platform, created_at')
          .order('created_at', { ascending: false })
          .limit(50),

        // Get health summary
        supabase
          .from('client_health_scores')
          .select('health_zone, health_score')
          .order('calculated_at', { ascending: false })
          .limit(100),

        // RAG: Get relevant memories (only in deep mode)
        mode === 'deep' ? getRelevantMemories(supabase, question) : Promise.resolve([]),
      ]);

      // Build context from facts
      if (facts.data?.length) {
        evidence.tables.push('org_facts');
        evidence.rowCount += facts.data.length;
        contextBlocks.push(
          `## Known Facts:\n${
            facts.data
              .map(
                (f) =>
                  `- ${f.fact_key}: ${JSON.stringify(f.fact_value)} (confidence: ${f.confidence}, source: ${f.source})`,
              )
              .join('\n')
          }`,
        );
      }

      // Build context from events
      if (recentEvents.data?.length) {
        evidence.tables.push('ultimate_truth_events');
        evidence.rowCount += recentEvents.data.length;
        const eventSummary = summarizeEvents(recentEvents.data);
        contextBlocks.push(`## Recent Events (last 7 days):\n${eventSummary}`);
      }

      // Build context from health scores
      if (healthSummary.data?.length) {
        evidence.tables.push('client_health_scores');
        evidence.rowCount += healthSummary.data.length;
        const zones = countByZone(healthSummary.data);
        contextBlocks.push(`## Client Health Summary:\n- Total: ${healthSummary.data.length}\n- By Zone: ${JSON.stringify(zones)}`);
      }

      // Build context from RAG memories
      if (memories.length) {
        evidence.tables.push('agent_memory');
        evidence.rowCount += memories.length;
        contextBlocks.push(
          `## Relevant Past Conversations:\n${
            memories
              .map(
                (m) =>
                  `Q: ${m.query?.slice(0, 100) || ''}...\nA: ${m.response?.slice(0, 200) || ''}...`,
              )
              .join('\n\n')
          }`,
        );
      }

      // ========================================
      // STEP 2: Call AI Agent
      // ========================================

      const agentPayload = {
        message: question,
        context: contextBlocks.join('\n\n'),
        instructions: `Answer the question using the provided context. 
${includeEvidence ? 'Include an EVIDENCE section listing the data sources used.' : ''}
Be specific with numbers and dates when available.
If you cannot answer from the context, say so clearly.`,
      };

      const agentResponse = await withRetry(
        () =>
          supabase.functions.invoke('super-agent-orchestrator', {
            body: agentPayload,
          }),
        { maxRetries: 2, initialDelayMs: 2000 },
      );

      if ((agentResponse as any).error) {
        throw new Error(`Agent error: ${(agentResponse as any).error.message}`);
      }

      const answer =
        (agentResponse as any).data?.response ||
        (agentResponse as any).data?.answer ||
        'No response generated';

      // ========================================
      // STEP 3: Log query
      // ========================================

      await supabase.from('org_query_log').insert({
        question,
        mode,
        answer: answer.slice(0, 10000),
        evidence: includeEvidence ? evidence : null,
        sources_used: evidence.tables,
        latency_ms: Date.now() - startTime,
      });

      // ========================================
      // STEP 4: Store in thread if provided
      // ========================================

      if (threadId) {
        await supabase.from('org_messages').insert([
          { thread_id: threadId, role: 'user', content: question },
          { thread_id: threadId, role: 'assistant', content: answer, evidence, sources_used: evidence.tables },
        ]);

        await supabase.from('org_threads').update({ last_message_at: new Date().toISOString() }).eq('id', threadId);
      }

      return {
        answer,
        evidence: includeEvidence ? evidence : undefined,
        sourcesUsed: evidence.tables,
        mode,
      };
    })();

    // Race against timeout
    const result = await Promise.race([queryPromise, timeoutPromise]);

    return success(res, result, startTime);
  } catch (err: any) {
    console.error('[QUERY ERROR]', err?.message || err);

    // Open circuit on repeated failures
    if (err?.message?.includes('fetch') || err?.message?.includes('network')) {
      openCircuit();
    }

    // Graceful degradation
    if (err?.message === 'Query timeout') {
      return error(res, 'TIMEOUT', 'Query took too long. Try a simpler question or use mode: "fast"', 504, undefined, startTime);
    }

    if (err?.message?.includes('Circuit breaker')) {
      return error(res, 'SERVICE_UNAVAILABLE', 'System temporarily unavailable. Please try again in 30 seconds.', 503, undefined, startTime);
    }

    return error(res, 'QUERY_FAILED', err?.message || 'Unknown error', 500, undefined, startTime);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getRelevantMemories(supabase: ReturnType<typeof getSupabase>, question: string): Promise<any[]> {
  try {
    // Generate embedding for the question
    const embeddingResponse = await supabase.functions.invoke('generate-embeddings', {
      body: { text: question },
    });

    if ((embeddingResponse as any).error || !(embeddingResponse as any).data?.embedding) {
      return [];
    }

    // Search memories
    const { data } = await supabase.rpc('match_memories', {
      query_embedding: (embeddingResponse as any).data.embedding,
      threshold: SIMILARITY_THRESHOLD,
      count: MAX_CONTEXT_CHUNKS,
    });

    return data || [];
  } catch (e) {
    console.error('[RAG ERROR]', e);
    return [];
  }
}

function summarizeEvents(events: Array<{ event_type: string }>): string {
  const byType: Record<string, number> = {};
  for (const e of events) {
    byType[e.event_type] = (byType[e.event_type] || 0) + 1;
  }
  return Object.entries(byType)
    .map(([type, count]) => `- ${type}: ${count} events`)
    .join('\n');
}

function countByZone(scores: Array<{ health_zone: string }>): Record<string, number> {
  const zones: Record<string, number> = { purple: 0, green: 0, yellow: 0, red: 0 };
  for (const s of scores) {
    if (zones[s.health_zone] !== undefined) {
      zones[s.health_zone]++;
    }
  }
  return zones;
}
