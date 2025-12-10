import { supabase } from "@/integrations/supabase/client";

// Discover system structure dynamically
export async function discoverSystemStructure() {
  try {
    // Get all tables
    const { data: tables, error: tablesError } = await supabase.rpc('get_all_tables');
    if (tablesError) throw tablesError;

    // Get all functions
    const { data: functions, error: functionsError } = await supabase.rpc('get_all_functions');
    if (functionsError) throw functionsError;

    const systemKnowledge = {
      type: 'system_structure',
      discovered_at: new Date().toISOString(),
      tables: tables?.map((t: any) => ({
        name: t.table_name,
        columns: t.column_count,
        rows: t.row_estimate
      })) || [],
      functions: functions?.map((f: any) => ({
        name: f.function_name,
        params: f.parameter_count,
        returns: f.return_type
      })) || [],
      summary: `Discovered ${tables?.length || 0} tables and ${functions?.length || 0} functions`
    };

    // Save to agent_context for quick access
    await supabase.from('agent_context').upsert({
      key: 'system_structure',
      value: systemKnowledge,
      agent_type: 'auto_discovery',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    console.log('✅ System structure discovered:', systemKnowledge.summary);
    return systemKnowledge;
  } catch (error) {
    console.error('System discovery failed:', error);
    return null;
  }
}

// Learn from recent data patterns
export async function learnRecentData() {
  try {
    const [healthData, eventsData, callsData, dealsData] = await Promise.all([
      supabase.from('client_health_scores')
        .select('health_zone, health_score, assigned_coach, package_type')
        .gte('calculated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(100),
      supabase.from('events')
        .select('event_name, source, status')
        .gte('event_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(100),
      supabase.from('call_records')
        .select('call_status, call_outcome, lead_quality')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(100),
      supabase.from('deals')
        .select('stage, status, deal_value, pipeline')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(100)
    ]);

    // Analyze patterns
    const patterns = {
      type: 'data_patterns',
      analyzed_at: new Date().toISOString(),
      health_zones: countBy(healthData.data, 'health_zone'),
      coaches: countBy(healthData.data, 'assigned_coach'),
      event_types: countBy(eventsData.data, 'event_name'),
      event_sources: countBy(eventsData.data, 'source'),
      call_outcomes: countBy(callsData.data, 'call_outcome'),
      call_quality: countBy(callsData.data, 'lead_quality'),
      deal_stages: countBy(dealsData.data, 'stage'),
      deal_statuses: countBy(dealsData.data, 'status'),
      avg_health: calculateAvg(healthData.data, 'health_score'),
      avg_deal_value: calculateAvg(dealsData.data, 'deal_value')
    };

    await supabase.from('agent_context').upsert({
      key: 'data_patterns',
      value: patterns,
      agent_type: 'auto_learning',
      expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
    });

    console.log('✅ Data patterns learned');
    return patterns;
  } catch (error) {
    console.error('Pattern learning failed:', error);
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

    const structureData = structure.data?.value as any || {};
    const patternData = patterns.data?.value as any || {};
    const memories = recentMemories.data || [];

    // Build dynamic prompt
    return `
## PTD SUPER-AGENT (DYNAMIC KNOWLEDGE)

### DISCOVERED SYSTEM (${structureData.discovered_at || 'Not discovered yet'})
Tables (${structureData.tables?.length || 0}): ${structureData.tables?.slice(0, 20).map((t: any) => t.name).join(', ') || 'None discovered'}
Functions (${structureData.functions?.length || 0}): ${structureData.functions?.slice(0, 10).map((f: any) => f.name).join(', ') || 'None discovered'}

### CURRENT PATTERNS (${patternData.analyzed_at || 'Not analyzed'})
Health Zones: ${JSON.stringify(patternData.health_zones || {})}
Event Types: ${JSON.stringify(patternData.event_types || {})}
Call Outcomes: ${JSON.stringify(patternData.call_outcomes || {})}
Deal Stages: ${JSON.stringify(patternData.deal_stages || {})}
Avg Health Score: ${patternData.avg_health || 'N/A'}
Avg Deal Value: ${patternData.avg_deal_value || 'N/A'}

### RECENT LEARNINGS
${memories.map((m: any) => `- Q: "${m.query?.slice(0, 50)}..." → Learned: ${JSON.stringify(m.knowledge_extracted || {}).slice(0, 100)}`).join('\n')}

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

// Learn from agent interaction
export async function learnFromInteraction(query: string, response: string, threadId: string) {
  try {
    const knowledge = extractKnowledge(query, response);
    
    await supabase.from('agent_memory').insert({
      thread_id: threadId,
      query,
      response: response.slice(0, 5000), // Limit response size
      knowledge_extracted: knowledge
    });

    // Update patterns if significant
    if (knowledge.significant) {
      await supabase.from('agent_patterns').upsert({
        pattern_name: knowledge.pattern_type || 'general',
        description: knowledge.description,
        confidence: 0.7,
        examples: [{ query, response: response.slice(0, 500) }],
        usage_count: 1,
        last_used_at: new Date().toISOString()
      }, { onConflict: 'pattern_name' });
    }

    console.log('✅ Learned from interaction:', knowledge.pattern_type);
  } catch (error) {
    console.error('Learning failed:', error);
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
function countBy(data: any[] | null, key: string): Record<string, number> {
  if (!data) return {};
  return data.reduce((acc, item) => {
    const val = item[key] || 'unknown';
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function calculateAvg(data: any[] | null, key: string): number | null {
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
