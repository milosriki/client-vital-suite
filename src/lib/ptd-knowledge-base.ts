import { supabase } from "@/integrations/supabase/client";

// ============= RETRY LOGIC UTILITY =============

interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoff?: boolean;
  operationName?: string;
}

async function retryOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoff = true,
    operationName = 'Operation'
  } = options;

  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      if (attempt > 1) {
        console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ ${operationName} attempt ${attempt}/${maxRetries} failed: ${errorMsg}`);

      if (attempt < maxRetries) {
        const delay = backoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  const finalError = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${operationName} failed after ${maxRetries} attempts. Last error: ${finalError}`);
}

// ============= LEARN FROM INTERACTION =============

// Learn from every question + answer (saves to Supabase)
export async function learnFromInteraction(query: string, response: string) {
  if (!query || !response) {
    console.error('❌ Learning failed: Query or response is empty');
    return;
  }

  const operation = async () => {
    const { data, error } = await supabase.from('agent_context').upsert({
      key: `interaction_${Date.now()}`,
      value: { query, response, learned_at: new Date().toISOString() },
      agent_type: 'conversation_learning',
      expires_at: null // Never expires - permanent learning
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  };

  try {
    await retryOperation(operation, {
      maxRetries: 3,
      delayMs: 1000,
      backoff: true,
      operationName: 'Learn from interaction'
    });

    console.log('✅ Agent learned from interaction');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Learning failed after retries:', errorMsg);
  }
}

// ============= SEARCH KNOWLEDGE =============

// Search past learnings for similar questions
export async function searchKnowledge(query: string): Promise<string> {
  if (!query || query.trim().length === 0) {
    console.warn('⚠️ Search query is empty');
    return '';
  }

  const operation = async () => {
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    if (keywords.length === 0) {
      console.warn('⚠️ No valid keywords extracted from query');
      return '';
    }

    const { data, error } = await supabase
      .from('agent_context')
      .select('value')
      .eq('agent_type', 'conversation_learning')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data?.length) {
      console.log('ℹ️ No past learnings found in database');
      return '';
    }

    // Simple keyword matching for relevant past conversations
    const relevant = data.filter(row => {
      try {
        const content = JSON.stringify(row.value).toLowerCase();
        return keywords.some(kw => content.includes(kw));
      } catch (e) {
        console.warn('⚠️ Failed to parse row value:', e);
        return false;
      }
    });

    if (relevant.length === 0) {
      console.log('ℹ️ No relevant past conversations found');
      return '';
    }

    console.log(`✅ Found ${relevant.length} relevant past conversations`);

    return relevant.slice(0, 3).map(r => {
      const val = r.value as { query?: string; response?: string };
      return `Past Q: ${val.query || 'N/A'}\nPast A: ${val.response || 'N/A'}`;
    }).join('\n\n');
  };

  try {
    return await retryOperation(operation, {
      maxRetries: 3,
      delayMs: 500,
      backoff: true,
      operationName: 'Knowledge search'
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Knowledge search failed after retries:', errorMsg);
    return '';
  }
}
