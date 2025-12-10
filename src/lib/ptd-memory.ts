// Persistent Memory System for PTD Agent
// Uses Supabase for vector-based semantic search

// Type-safe memory interfaces
export interface MemoryItem {
  id: string;
  thread_id: string;
  query: string;
  response: string;
  knowledge_extracted: any;
  created_at: string;
  similarity?: number;
}

export interface PatternItem {
  pattern_name: string;
  description: string;
  confidence: number;
  examples: any[];
}

// 1. SAVE EVERY INTERACTION TO MEMORY (called from edge function)
export function extractKnowledge(query: string, response: string): any {
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

// 2. DETECT QUERY TYPE
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

// 3. EXTRACT ENTITIES
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

// 4. FORMAT MEMORY CONTEXT FOR PROMPT
export function formatMemoryContext(memories: MemoryItem[]): string {
  if (!memories || memories.length === 0) return '';
  
  return memories.map((m, i) => 
    `[Memory ${i + 1}] Q: "${m.query.slice(0, 100)}..." → A: "${m.response.slice(0, 200)}..."`
  ).join('\n');
}

// 5. CLIENT-SIDE: Generate thread ID
export function generateThreadId(): string {
  const existing = localStorage.getItem('ptd-thread-id');
  if (existing) return existing;
  
  const newId = `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem('ptd-thread-id', newId);
  return newId;
}

// 6. CLIENT-SIDE: Get or create thread ID
export function getThreadId(): string {
  return localStorage.getItem('ptd-thread-id') || generateThreadId();
}

// 7. CLIENT-SIDE: Start new thread
export function startNewThread(): string {
  localStorage.removeItem('ptd-thread-id');
  return generateThreadId();
}
