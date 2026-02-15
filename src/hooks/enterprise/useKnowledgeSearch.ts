import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { QUERY_KEYS } from "@/config/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import type { KnowledgeEntry } from "@/types/enterprise";

export function useKnowledgeSearch(query: string = '', category?: string) {
  const results = useDedupedQuery({
    queryKey: QUERY_KEYS.knowledgeSearch.results(query, category),
    queryFn: async () => {
      let dbQuery = supabase
        .from("knowledge_base")
        .select("id, content, source, category, confidence, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (category && category !== 'all') {
        dbQuery = dbQuery.eq("category", category);
      }

      if (query) {
        dbQuery = dbQuery.or(`content.ilike.%${query}%,source.ilike.%${query}%`);
      }

      const { data, error } = await dbQuery;
      if (error) throw error;
      return (data || []) as KnowledgeEntry[];
    },
  });

  const stats = useDedupedQuery({
    queryKey: QUERY_KEYS.knowledgeSearch.stats,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("category");

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach(entry => {
        const cat = entry.category || 'other';
        counts[cat] = (counts[cat] || 0) + 1;
      });

      return { total: (data || []).length, byCategory: counts };
    },
  });

  return { results, stats, isLoading: results.isLoading };
}
