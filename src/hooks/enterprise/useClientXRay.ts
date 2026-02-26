import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { QUERY_KEYS } from "@/config/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import type { ClientXRayRecord } from "@/types/enterprise";

export function useClientXRay(search?: string) {
  const clients = useDedupedQuery({
    queryKey: QUERY_KEYS.clientXRay.list(search),
    queryFn: async () => {
      // Use new health engine table (client_health_daily)
      // Get latest score_date
      const { data: latestDate } = await supabase
        .from("client_health_daily" as never)
        .select("score_date")
        .order("score_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestDate?.score_date) return [];

      let query = supabase
        .from("client_health_daily" as never)
        .select("id, client_name, coach_name, total_score, tier, days_since_training, remaining_sessions, score_date, alert, trend, recency_score, frequency_score, consistency_score, package_score, momentum_score, cancel_rate, package_value, sessions_30d, cancels_30d")
        .eq("score_date", latestDate.score_date)
        .order("total_score", { ascending: true })
        .limit(200);

      if (search) {
        query = query.ilike("client_name", `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Map to ClientXRayRecord format
      return ((data as any[]) || []).map((row: any) => {
        const zone =
          row.tier === "HEALTHY" ? "GREEN" :
          row.tier === "ATTENTION" ? "YELLOW" :
          row.tier === "AT_RISK" ? "PURPLE" : "RED";

        const nameParts = (row.client_name || "").split(" ");
        return {
          id: row.id,
          email: null,
          firstname: nameParts[0] || "",
          lastname: nameParts.slice(1).join(" ") || "",
          health_score: row.total_score ?? 0,
          health_zone: zone,
          assigned_coach: row.coach_name,
          days_since_last_session: row.days_since_training,
          outstanding_sessions: row.remaining_sessions ?? 0,
          calculated_on: row.score_date,
          // v2 extras
          client_name: row.client_name,
          tier: row.tier,
          alert: row.alert,
          trend: row.trend,
          cancel_rate: row.cancel_rate,
          package_value: row.package_value,
          sessions_30d: row.sessions_30d,
          cancels_30d: row.cancels_30d,
          recency_score: row.recency_score,
          frequency_score: row.frequency_score,
          consistency_score: row.consistency_score,
          package_score: row.package_score,
          momentum_score: row.momentum_score,
        } as ClientXRayRecord;
      });
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
