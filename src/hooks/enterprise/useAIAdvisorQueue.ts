import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { QUERY_KEYS } from "@/config/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import type { AdvisorIntervention } from "@/types/enterprise";

export function useAIAdvisorQueue() {
  const queue = useDedupedQuery({
    queryKey: QUERY_KEYS.aiAdvisor.queue,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_health_scores")
        .select("id, email, firstname, lastname, health_score, health_zone, days_since_last_session, assigned_coach, outstanding_sessions")
        .or("health_zone.eq.RED,health_zone.eq.YELLOW")
        .order("health_score", { ascending: true });

      if (error) throw error;

      // Enrich with deal values
      const emails = (data || []).map(c => c.email).filter(Boolean);
      const { data: deals } = await supabase
        .from("deals")
        .select("email, amount")
        .in("email", emails);

      const dealMap = new Map<string, number>();
      (deals || []).forEach(d => {
        const existing = dealMap.get(d.email) || 0;
        dealMap.set(d.email, existing + (d.amount || 0));
      });

      return (data || []).map(client => {
        const score = client.health_score || 0;
        const daysSince = client.days_since_last_session || 0;
        let type: AdvisorIntervention['type'] = 'Re-engagement';
        let riskLabel = `${score}% Health`;
        let reason = '';

        if (client.health_zone === 'RED') {
          type = 'High Priority';
          riskLabel = `${Math.min(95, 100 - score)}% Churn Probability`;
          reason = daysSince > 14 ? `Inactive ${daysSince} days` : `Health score critically low at ${score}`;
        } else if (score > 70) {
          type = 'Upsell';
          riskLabel = `${score}% Growth Potential`;
          reason = 'Strong momentum — ready for package upgrade';
        } else {
          reason = `Health declining: ${score}/100, ${daysSince}d inactive`;
        }

        return {
          id: client.id,
          client_name: `${client.firstname || ''} ${client.lastname || ''}`.trim(),
          email: client.email,
          health_score: score,
          health_zone: client.health_zone,
          risk_label: riskLabel,
          reason,
          deal_value_aed: dealMap.get(client.email) || 0,
          assigned_coach: client.assigned_coach || 'Unassigned',
          days_since_last_session: daysSince,
          outstanding_sessions: client.outstanding_sessions || 0,
          type,
        } as AdvisorIntervention;
      });
    },
  });

  const revenueAtRisk = useDedupedQuery({
    queryKey: QUERY_KEYS.aiAdvisor.revenueAtRisk,
    queryFn: async () => {
      const interventions = queue.data || [];
      const atRisk = interventions.reduce((sum, i) => sum + i.deal_value_aed, 0);
      const projectedRecovery = Math.round(atRisk * 0.72); // 72% historical recovery rate
      return { atRisk, projectedRecovery };
    },
    enabled: !!queue.data,
  });

  return {
    queue,
    revenueAtRisk,
    isLoading: queue.isLoading,
  };
}
