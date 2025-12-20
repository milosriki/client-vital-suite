// Persistent Memory System for PTD Agent
// Uses Supabase for vector-based semantic search and database persistence

import { supabase } from "@/integrations/supabase/client";

// Type-safe memory interfaces
export interface MemoryItem {
  id: string;
  thread_id: string;
  query: string;
  response: string;
  knowledge_extracted: Record<string, unknown> | null;
  created_at: string;
  similarity?: number;
}

export interface PatternItem {
  pattern_name: string;
  description: string;
  confidence: number;
  examples: string[];
}

export interface ThreadMetadata {
  thread_id: string;
  session_id: string;
  created_at: string;
  last_accessed_at: string;
  message_count: number;
}

// CONSTANTS
const THREAD_ID_KEY = 'ptd-thread-id';
const SESSION_ID_KEY = 'ptd-session-id';
const THREAD_METADATA_KEY = 'ptd-thread-metadata';
const MEMORY_TIMEOUT_MS = 10000; // 10 seconds timeout
const MAX_RETRY_ATTEMPTS = 3;
const THREAD_CLEANUP_DAYS = 30;

// =============================================================================
// UTILITY FUNCTIONS - Timeout and Retry Logic
// =============================================================================

/**
 * Execute a promise with timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = MEMORY_TIMEOUT_MS,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = MAX_RETRY_ATTEMPTS,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on the last attempt
      if (attempt === maxAttempts) break;

      // Exponential backoff: 1s, 2s, 4s, etc.
      const delay = delayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

/**
 * Combine timeout and retry for robust operations
 */
async function withTimeoutAndRetry<T>(
  fn: () => Promise<T>,
  timeoutMs: number = MEMORY_TIMEOUT_MS,
  maxAttempts: number = MAX_RETRY_ATTEMPTS
): Promise<T> {
  return withRetry(
    () => withTimeout(fn(), timeoutMs),
    maxAttempts
  );
}

// =============================================================================
// SESSION AND THREAD MANAGEMENT
// =============================================================================

/**
 * Get or create a unique session ID (persists in localStorage)
 */
function getSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_ID_KEY);

  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }

  return sessionId;
}

/**
 * Generate a new thread ID with session context
 */
export function generateThreadId(): string {
  const sessionId = getSessionId();
  const threadId = `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Store in localStorage
  localStorage.setItem(THREAD_ID_KEY, threadId);

  // Store metadata
  const metadata: ThreadMetadata = {
    thread_id: threadId,
    session_id: sessionId,
    created_at: new Date().toISOString(),
    last_accessed_at: new Date().toISOString(),
    message_count: 0
  };

  localStorage.setItem(THREAD_METADATA_KEY, JSON.stringify(metadata));

  // Persist to database
  persistThreadMetadata(metadata).catch(err => {
    console.error('Failed to persist thread metadata:', err);
  });

  return threadId;
}

/**
 * Get current thread ID or create new one
 */
export function getThreadId(): string {
  const threadId = localStorage.getItem(THREAD_ID_KEY);

  if (threadId) {
    // Update last accessed time
    updateThreadAccess(threadId).catch(err => {
      console.error('Failed to update thread access:', err);
    });
    return threadId;
  }

  return generateThreadId();
}

/**
 * Start a new conversation thread
 */
export function startNewThread(): string {
  localStorage.removeItem(THREAD_ID_KEY);
  localStorage.removeItem(THREAD_METADATA_KEY);
  return generateThreadId();
}

/**
 * Update thread's last accessed time
 */
async function updateThreadAccess(threadId: string): Promise<void> {
  const metadataStr = localStorage.getItem(THREAD_METADATA_KEY);

  if (metadataStr) {
    try {
      const metadata: ThreadMetadata = JSON.parse(metadataStr);
      metadata.last_accessed_at = new Date().toISOString();
      localStorage.setItem(THREAD_METADATA_KEY, JSON.stringify(metadata));
    } catch (e) {
      console.error('Failed to parse thread metadata:', e);
    }
  }
}

// =============================================================================
// DATABASE PERSISTENCE
// =============================================================================

/**
 * Save thread metadata to database
 */
async function persistThreadMetadata(metadata: ThreadMetadata): Promise<void> {
  try {
    await withTimeoutAndRetry(async () => {
      const { error } = await supabase
        .from('agent_memory')
        .upsert({
          thread_id: metadata.thread_id,
          query: '[THREAD_START]',
          response: `Thread started at ${metadata.created_at}`,
          knowledge_extracted: {
            type: 'thread_metadata',
            session_id: metadata.session_id,
            created_at: metadata.created_at,
            last_accessed_at: metadata.last_accessed_at
          }
        }, {
          onConflict: 'thread_id'
        });

      if (error) throw error;
    });
  } catch (error) {
    console.error('Failed to persist thread metadata:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Save a conversation message to database
 */
export async function saveMessageToDatabase(
  threadId: string,
  query: string,
  response: string,
  knowledgeExtracted?: Record<string, unknown> | null,
  userLabel?: string
): Promise<void> {
  try {
    await withTimeoutAndRetry(async () => {
      const { error } = await supabase
        .from('agent_memory')
        .insert({
          thread_id: threadId,
          query,
          response,
          knowledge_extracted: {
            user_label: userLabel || 'anonymous',
            ...(knowledgeExtracted || extractKnowledge(query, response))
          }
        });

      if (error) throw error;
    });

    // Update message count in metadata
    incrementMessageCount(threadId);
  } catch (error) {
    console.error('Failed to save message to database:', error);
    throw error; // Re-throw so caller knows it failed
  }
}

/**
 * Load conversation history from database
 */
export async function loadConversationHistory(
  threadId: string,
  limit: number = 50
): Promise<Array<{ role: string; content: string; timestamp: string }>> {
  try {
    return await withTimeoutAndRetry(async () => {
      const { data, error } = await supabase
        .from('agent_memory')
        .select('query, response, created_at, knowledge_extracted')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      if (!data || data.length === 0) return [];

      // Convert to message format
      const messages: Array<{ role: string; content: string; timestamp: string }> = [];

      data.forEach(item => {
        // Skip thread metadata entries
        if (item.query === '[THREAD_START]') return;

        messages.push({
          role: 'user',
          content: item.query,
          timestamp: item.created_at
        });

        messages.push({
          role: 'ai',
          content: item.response,
          timestamp: item.created_at
        });
      });

      return messages;
    });
  } catch (error) {
    console.error('Failed to load conversation history:', error);
    return []; // Return empty array on failure
  }
}

/**
 * Increment message count for thread
 */
function incrementMessageCount(threadId: string): void {
  const metadataStr = localStorage.getItem(THREAD_METADATA_KEY);

  if (metadataStr) {
    try {
      const metadata: ThreadMetadata = JSON.parse(metadataStr);
      metadata.message_count += 1;
      metadata.last_accessed_at = new Date().toISOString();
      localStorage.setItem(THREAD_METADATA_KEY, JSON.stringify(metadata));
    } catch (e) {
      console.error('Failed to increment message count:', e);
    }
  }
}

/**
 * Clean up old threads (older than THREAD_CLEANUP_DAYS)
 */
export async function cleanupOldThreads(): Promise<number> {
  try {
    return await withTimeoutAndRetry(async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - THREAD_CLEANUP_DAYS);

      const { data, error } = await supabase
        .from('agent_memory')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) throw error;

      const deletedCount = data?.length || 0;
      console.log(`Cleaned up ${deletedCount} old thread messages`);

      return deletedCount;
    });
  } catch (error) {
    console.error('Failed to cleanup old threads:', error);
    return 0;
  }
}

/**
 * Get thread statistics
 */
export async function getThreadStats(threadId: string): Promise<{
  messageCount: number;
  firstMessage: string | null;
  lastMessage: string | null;
}> {
  try {
    return await withTimeoutAndRetry(async () => {
      const { data, error, count } = await supabase
        .from('agent_memory')
        .select('created_at', { count: 'exact' })
        .eq('thread_id', threadId)
        .neq('query', '[THREAD_START]')
        .order('created_at', { ascending: true });

      if (error) throw error;

      return {
        messageCount: count || 0,
        firstMessage: data && data.length > 0 ? data[0].created_at : null,
        lastMessage: data && data.length > 0 ? data[data.length - 1].created_at : null
      };
    });
  } catch (error) {
    console.error('Failed to get thread stats:', error);
    return {
      messageCount: 0,
      firstMessage: null,
      lastMessage: null
    };
  }
}

// =============================================================================
// KNOWLEDGE EXTRACTION (Original Functions)
// =============================================================================

/**
 * Extract knowledge from interaction (called from edge function)
 */
export function extractKnowledge(query: string, response: string): Record<string, unknown> {
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
    query_type: detectQueryType(query),
    detected_patterns: Object.keys(patterns).filter(k => patterns[k]),
    entities: extractEntities(combined),
    timestamp: new Date().toISOString()
  };
}

/**
 * Detect query type
 */
function detectQueryType(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('how')) return 'how_to';
  if (q.includes('why')) return 'explanation';
  if (q.includes('what')) return 'definition';
  if (q.includes('show') || q.includes('list')) return 'retrieval';
  if (q.includes('compare')) return 'comparison';
  if (q.includes('calculate') || q.includes('formula')) return 'calculation';
  return 'general';
}

/**
 * Extract entities from text
 */
function extractEntities(text: string): string[] {
  const entities: string[] = [];

  // Extract emails
  const emails = text.match(/[\w.-]+@[\w.-]+\.\w+/g);
  if (emails) entities.push(...emails);

  // Extract money amounts
  const amounts = text.match(/\d+[\d,]*\.?\d*\s*(aed|usd|dollars?)?/gi);
  if (amounts) entities.push(...amounts.slice(0, 3));

  // Extract percentages
  const percents = text.match(/\d+\.?\d*\s*%/g);
  if (percents) entities.push(...percents);

  return entities.slice(0, 10);
}

/**
 * Format memory context for prompt
 */
export function formatMemoryContext(memories: MemoryItem[]): string {
  if (!memories || memories.length === 0) return '';

  return memories.map((m, i) =>
    `[Memory ${i + 1}] Q: "${m.query.slice(0, 100)}..." → A: "${m.response.slice(0, 200)}..."`
  ).join('\n');
}
