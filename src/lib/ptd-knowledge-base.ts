import { supabase } from "@/integrations/supabase/client";

// Learn from every question + answer (saves to Supabase)
export async function learnFromInteraction(query: string, response: string) {
  try {
    const learningText = `Q: ${query}\nA: ${response}`;
    
    await supabase.from('agent_context').upsert({
      key: `interaction_${Date.now()}`,
      value: { query, response, learned_at: new Date().toISOString() },
      agent_type: 'conversation_learning',
      expires_at: null // Never expires - permanent learning
    });
    
    console.log('✅ Agent learned from interaction');
  } catch (error) {
    console.error('Learning failed:', error);
  }
}

// Search past learnings for similar questions
export async function searchKnowledge(query: string): Promise<string> {
  try {
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    const { data } = await supabase
      .from('agent_context')
      .select('value')
      .eq('agent_type', 'conversation_learning')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!data?.length) return '';
    
    // Simple keyword matching for relevant past conversations
    const relevant = data.filter(row => {
      const content = JSON.stringify(row.value).toLowerCase();
      return keywords.some(kw => content.includes(kw));
    });
    
    return relevant.slice(0, 3).map(r => {
      const val = r.value as { query?: string; response?: string };
      return `Past Q: ${val.query}\nPast A: ${val.response}`;
    }).join('\n\n');
  } catch (error) {
    console.error('Knowledge search failed:', error);
    return '';
  }
}
