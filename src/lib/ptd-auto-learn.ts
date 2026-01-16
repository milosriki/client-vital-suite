import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============= RETRY UTILITY =============

interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoff?: boolean;
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000, backoff = true } = options;
  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = backoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ============= DISCOVER SYSTEM STRUCTURE =============

// Discover system structure dynamically
export async function discoverSystemStructure() {
  try {
    console.log('🔍 Starting system structure discovery...');

    // Get all tables with retry
    const tables = await retryWithBackoff(async () => {
      const { data, error } = await supabase.rpc('get_all_tables');
      if (error) {
        throw new Error(`Failed to get tables: ${error.message}`);
      }
      return data;
    }, { maxRetries: 3, delayMs: 1000 });

    // Get all functions with retry
    const functions = await retryWithBackoff(async () => {
      const { data, error } = await supabase.rpc('get_all_functions');
      if (error) {
        throw new Error(`Failed to get functions: ${error.message}`);
      }
      return data;
    }, { maxRetries: 3, delayMs: 1000 });

    const systemKnowledge = {
      type: 'system_structure',
      discovered_at: new Date().toISOString(),
      tables: tables?.map((t: { table_name: string; column_count: number; row_estimate: number }) => ({
        name: t.table_name,
        columns: t.column_count,
        rows: t.row_estimate
      })) || [],
      functions: functions?.map((f: { function_name: string; parameter_count: number; return_type: string }) => ({
        name: f.function_name,
        params: f.parameter_count,
        returns: f.return_type
      })) || [],
      summary: `Discovered ${tables?.length || 0} tables and ${functions?.length || 0} functions`
    };

    // Save to agent_context for quick access
    try {
      await retryWithBackoff(async () => {
        const { error } = await supabase.from('agent_context').upsert({
          key: 'system_structure',
          value: systemKnowledge,
          agent_type: 'analyst', // Fixed: Must be one of ('analyst', 'advisor', 'watcher')
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });

        if (error) {
          throw new Error(`Failed to save system knowledge: ${error.message}`);
        }
      }, { maxRetries: 2, delayMs: 500 });

      console.log('✅ System knowledge saved to database');
    } catch (saveError) {
      const errorMsg = saveError instanceof Error ? saveError.message : String(saveError);
      console.warn(`⚠️ Could not save system knowledge to database: ${errorMsg}`);
      // Continue anyway - we still have the knowledge in memory
    }

    console.log('✅ System structure discovered:', systemKnowledge.summary);
    return systemKnowledge;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ System discovery failed:', errorMsg);
    toast.error(`System discovery failed: ${errorMsg}`);
    return null;
  }
}

// ============= LEARN FROM RECENT DATA =============

// Learn from recent data patterns
export async function learnRecentData() {
  try {
    console.log('🔍 Starting data pattern analysis...');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch data with error handling
    const [healthData, eventsData, callsData, dealsData] = await Promise.allSettled([
      retryWithBackoff(async () => {
        const { data, error } = await supabase.from('client_health_scores')
          .select('health_zone, health_score, assigned_coach, package_type')
          .gte('calculated_at', sevenDaysAgo);

        if (error) throw new Error(`Health data error: ${error.message}`);
        return data;
      }, { maxRetries: 2 }),

      retryWithBackoff(async () => {
        const { data, error } = await supabase.from('events')
          .select('event_name, source, status')
          .gte('event_time', sevenDaysAgo);

        if (error) throw new Error(`Events data error: ${error.message}`);
        return data;
      }, { maxRetries: 2 }),

      retryWithBackoff(async () => {
        const { data, error } = await supabase.from('call_records')
          .select('call_status, call_outcome, lead_quality')
          .gte('created_at', sevenDaysAgo);

        if (error) throw new Error(`Call data error: ${error.message}`);
        return data;
      }, { maxRetries: 2 }),

      retryWithBackoff(async () => {
        const { data, error } = await supabase.from('deals')
          .select('stage, status, deal_value, pipeline')
          .gte('created_at', sevenDaysAgo);

        if (error) throw new Error(`Deals data error: ${error.message}`);
        return data;
      }, { maxRetries: 2 })
    ]);

    // Extract successful results
    const healthResult = healthData.status === 'fulfilled' ? healthData.value : null;
    const eventsResult = eventsData.status === 'fulfilled' ? eventsData.value : null;
    const callsResult = callsData.status === 'fulfilled' ? callsData.value : null;
    const dealsResult = dealsData.status === 'fulfilled' ? dealsData.value : null;

    // Log any failures
    if (healthData.status === 'rejected') {
      console.error('❌ Health data fetch failed:', healthData.reason);
    }
    if (eventsData.status === 'rejected') {
      console.error('❌ Events data fetch failed:', eventsData.reason);
    }
    if (callsData.status === 'rejected') {
      console.error('❌ Calls data fetch failed:', callsData.reason);
    }
    if (dealsData.status === 'rejected') {
      console.error('❌ Deals data fetch failed:', dealsData.reason);
    }

    // Analyze patterns
    const patterns = {
      type: 'data_patterns',
      analyzed_at: new Date().toISOString(),
      health_zones: countBy(healthResult, 'health_zone'),
      coaches: countBy(healthResult, 'assigned_coach'),
      event_types: countBy(eventsResult, 'event_name'),
      event_sources: countBy(eventsResult, 'source'),
      call_outcomes: countBy(callsResult, 'call_outcome'),
      call_quality: countBy(callsResult, 'lead_quality'),
      deal_stages: countBy(dealsResult, 'stage'),
      deal_statuses: countBy(dealsResult, 'status'),
      avg_health: calculateAvg(healthResult, 'health_score'),
      avg_deal_value: calculateAvg(dealsResult, 'deal_value'),
      data_freshness: {
        health: healthResult?.length || 0,
        events: eventsResult?.length || 0,
        calls: callsResult?.length || 0,
        deals: dealsResult?.length || 0
      }
    };

    // Save patterns with retry
    try {
      await retryWithBackoff(async () => {
        const { error } = await supabase.from('agent_context').upsert({
          key: 'data_patterns',
          value: patterns,
          agent_type: 'analyst',
          expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
        });

        if (error) {
          throw new Error(`Failed to save patterns: ${error.message}`);
        }
      }, { maxRetries: 2, delayMs: 500 });

      console.log('✅ Data patterns saved to database');
    } catch (saveError) {
      const errorMsg = saveError instanceof Error ? saveError.message : String(saveError);
      console.warn(`⚠️ Could not save patterns to database: ${errorMsg}`);
      // Continue anyway - we still have the patterns in memory
    }

    console.log('✅ Data patterns learned:', patterns.data_freshness);
    return patterns;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Pattern learning failed:', errorMsg);
    toast.error(`Pattern learning failed: ${errorMsg}`);
    return null;
  }
}

// Get dynamic mega prompt from learned knowledge
export async function getDynamicMegaPrompt(): Promise<string> {
  try {
    const [structure, patterns, recentMemories] = await Promise.all([
      supabase.from('agent_context').select('value').eq('key', 'system_structure').single(),
      supabase.from('agent_context').select('value').eq('key', 'data_patterns').single(),
      supabase.from('agent_memory')
        .select('query, response, knowledge_extracted')
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    const structureData = (structure.data?.value as Record<string, unknown>) || {};
    const patternData = (patterns.data?.value as Record<string, unknown>) || {};
    const memories = recentMemories.data || [];

    // Build dynamic prompt
    return `
## PTD SUPER-AGENT (DYNAMIC KNOWLEDGE)

### DISCOVERED SYSTEM (${structureData.discovered_at || 'Not discovered yet'})
Tables (${(structureData.tables as Array<{name: string}>)?.length || 0}): ${(structureData.tables as Array<{name: string}>)?.slice(0, 20).map((t) => t.name).join(', ') || 'None discovered'}
Functions (${(structureData.functions as Array<{name: string}>)?.length || 0}): ${(structureData.functions as Array<{name: string}>)?.slice(0, 10).map((f) => f.name).join(', ') || 'None discovered'}

### CURRENT PATTERNS (${patternData.analyzed_at || 'Not analyzed'})
Health Zones: ${JSON.stringify(patternData.health_zones || {})}
Event Types: ${JSON.stringify(patternData.event_types || {})}
Call Outcomes: ${JSON.stringify(patternData.call_outcomes || {})}
Deal Stages: ${JSON.stringify(patternData.deal_stages || {})}
Avg Health Score: ${patternData.avg_health || 'N/A'}
Avg Deal Value: ${patternData.avg_deal_value || 'N/A'}

### RECENT LEARNINGS
${memories.map((m) => `- Q: "${(m.query || '').slice(0, 50)}..." → Learned: ${JSON.stringify(m.knowledge_extracted || {}).slice(0, 100)}`).join('\n')}

### BEHAVIOR RULES
1. Use discovered tables/functions for queries
2. Recognize patterns from analyzed data
3. Learn from every interaction
4. Adapt to new discoveries automatically
5. Flag anomalies based on current patterns
`;
  } catch (error) {
    console.error('Failed to build dynamic prompt:', error);
    return '## PTD Agent - Knowledge not yet loaded. Running in basic mode.';
  }
}

// ============= LEARN FROM INTERACTIONS =============

// Learn from agent interaction
export async function learnFromInteraction(query: string, response: string, threadId: string) {
  if (!query || !response || !threadId) {
    console.error('❌ Learning failed: Missing required parameters (query, response, or threadId)');
    return;
  }

  try {
    const knowledge = extractKnowledge(query, response);

    // Save to memory with retry
    await retryWithBackoff(async () => {
      const { error } = await supabase.from('agent_memory').insert({
        thread_id: threadId,
        query,
        response: response.slice(0, 5000), // Limit response size
        knowledge_extracted: knowledge
      });

      if (error) {
        throw new Error(`Failed to save interaction: ${error.message}`);
      }
    }, { maxRetries: 3, delayMs: 1000 });

    // Update patterns if significant
    if (knowledge.significant) {
      try {
        await retryWithBackoff(async () => {
          const { error } = await supabase.from('agent_patterns').upsert({
            pattern_name: knowledge.pattern_type || 'general',
            description: knowledge.description,
            confidence: 0.7,
            examples: [{ query, response: response.slice(0, 500) }],
            usage_count: 1,
            last_used_at: new Date().toISOString()
          }, { onConflict: 'pattern_name' });

          if (error) {
            throw new Error(`Failed to update pattern: ${error.message}`);
          }
        }, { maxRetries: 2, delayMs: 500 });

        console.log('✅ Pattern updated:', knowledge.pattern_type);
      } catch (patternError) {
        const errorMsg = patternError instanceof Error ? patternError.message : String(patternError);
        console.warn(`⚠️ Could not update pattern: ${errorMsg}`);
        // Continue anyway - memory was saved successfully
      }
    }

    console.log('✅ Learned from interaction:', knowledge.pattern_type);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Learning failed:', errorMsg);
  }
}

// Extract knowledge from query/response
function extractKnowledge(query: string, response: string) {
  const queryLower = query.toLowerCase();
  const responseLower = response.toLowerCase();
  
  // Detect patterns
  const patterns: Record<string, boolean> = {
    client_query: queryLower.includes('@') || queryLower.includes('client'),
    fraud_detection: queryLower.includes('fraud') || queryLower.includes('suspicious'),
    churn_analysis: queryLower.includes('churn') || queryLower.includes('risk'),
    sales_query: queryLower.includes('deal') || queryLower.includes('revenue'),
    coach_query: queryLower.includes('coach') || queryLower.includes('trainer'),
    health_query: queryLower.includes('health') || queryLower.includes('score')
  };

  const detectedPattern = Object.entries(patterns).find(([, v]) => v)?.[0] || 'general';
  
  // Extract entities
  const emails = response.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];
  const amounts = response.match(/AED\s?[\d,]+/g) || [];
  const percentages = response.match(/\d+(\.\d+)?%/g) || [];

  return {
    pattern_type: detectedPattern,
    significant: emails.length > 0 || amounts.length > 0 || queryLower.includes('audit'),
    entities: { emails: emails.slice(0, 5), amounts: amounts.slice(0, 5), percentages: percentages.slice(0, 5) },
    description: `${detectedPattern} query with ${emails.length} emails, ${amounts.length} amounts`,
    extracted_at: new Date().toISOString()
  };
}

// Helper functions
function countBy(data: Record<string, unknown>[] | null, key: string): Record<string, number> {
  if (!data) return {};
  const result: Record<string, number> = {};
  for (const item of data) {
    const val = String(item[key] || 'unknown');
    result[val] = (result[val] || 0) + 1;
  }
  return result;
}

function calculateAvg(data: Record<string, unknown>[] | null, key: string): number | null {
  if (!data || data.length === 0) return null;
  const values = data.map(d => d[key]).filter(v => typeof v === 'number');
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100;
}

// Auto-learning background process
export async function autoLearnFromApp() {
  try {
    await Promise.all([
      discoverSystemStructure(),
      learnRecentData()
    ]);
    console.log('✅ Auto-learning cycle complete');
  } catch (error) {
    console.error('Auto-learn failed:', error);
  }
}

// Background learning manager
let learningInterval: ReturnType<typeof setInterval> | null = null;

export function startBackgroundLearning() {
  if (learningInterval) return;
  
  // Learn immediately
  autoLearnFromApp();
  
  // Then every hour
  learningInterval = setInterval(autoLearnFromApp, 60 * 60 * 1000);
}

export function stopBackgroundLearning() {
  if (learningInterval) {
    clearInterval(learningInterval);
    learningInterval = null;
  }
}
