import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { QUERY_KEYS } from "@/config/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import type { ClientXRayRecord } from "@/types/enterprise";

export function useClientXRay(search?: string) {
  const clients = useDedupedQuery({
    queryKey: QUERY_KEYS.clientXRay.list(search),
    queryFn: async () => {
      let query = supabase
        .from("client_health_scores")
        .select("id, email, firstname, lastname, health_score, health_zone, assigned_coach, days_since_last_session, outstanding_sessions, calculated_on")
        .order("health_score", { ascending: true })
        .limit(200);

      if (search) {
        query = query.or(`firstname.ilike.%${search}%,lastname.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ClientXRayRecord[];
    },
  });

  const getTimeline = (clientId: string) => useDedupedQuery({
    queryKey: QUERY_KEYS.clientXRay.timeline(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intervention_log")
        .select("id, intervention_type, outcome, notes, created_at, triggered_by")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  return { clients, getTimeline, isLoading: clients.isLoading };
}
