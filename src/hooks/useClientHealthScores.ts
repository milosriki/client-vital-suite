import { supabase } from '@/integrations/supabase/client';
import type { ClientHealthScore } from '@/types/database';
import { QUERY_KEYS } from '@/config/queryKeys';
import { useDedupedQuery } from '@/hooks/useDedupedQuery';

interface UseClientHealthScoresOptions {
  healthZone?: string;
  segment?: string;
  coach?: string;
  autoRefresh?: boolean;
  page?: number;
  pageSize?: number;
  searchTerm?: string;
}

/**
 * Maps new client_health_daily tiers to legacy health_zone colors:
 *   HEALTHY → GREEN, ATTENTION → YELLOW, AT_RISK → PURPLE, CRITICAL/FROZEN → RED
 */
function tierToZone(tier: string): 'GREEN' | 'YELLOW' | 'PURPLE' | 'RED' {
  switch (tier) {
    case 'HEALTHY': return 'GREEN';
    case 'ATTENTION': return 'YELLOW';
    case 'AT_RISK': return 'PURPLE';
    case 'CRITICAL':
    case 'FROZEN':
    default: return 'RED';
  }
}

function tierToTrend(trend: string): string {
  switch (trend) {
    case 'recovering':
    case 'improving': return 'IMPROVING';
    case 'declining':
    case 'crashing': return 'DECLINING';
    default: return 'STABLE';
  }
}

function tierToPriority(tier: string, alert: string | null): string | null {
  if (alert) return 'CRITICAL';
  if (tier === 'FROZEN' || tier === 'CRITICAL') return 'HIGH';
  if (tier === 'AT_RISK') return 'MEDIUM';
  return null;
}

export function useClientHealthScores(options: UseClientHealthScoresOptions = {}) {
  const { healthZone, segment, coach, page = 1, pageSize = 20, searchTerm = '' } = options;

  return useDedupedQuery<{ data: ClientHealthScore[], count: number }>({
    queryKey: QUERY_KEYS.clients.healthScores({ healthZone, segment, coach, page, pageSize, searchTerm }),
    dedupeIntervalMs: 1000,
    queryFn: async () => {
      // Get the most recent score_date from the NEW engine
      const { data: latestDate } = await supabase
        .from('client_health_daily' as never)
        .select('score_date')
        .order('score_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestDate?.score_date) {
        return { data: [], count: 0 };
      }

      let query = supabase
        .from('client_health_daily' as never)
        .select('*', { count: 'exact' })
        .eq('score_date', latestDate.score_date)
        .order('total_score', { ascending: true });

      // Filter by health zone (map back to tier)
      if (healthZone && healthZone !== 'All') {
        const tierMap: Record<string, string[]> = {
          'GREEN': ['HEALTHY'],
          'YELLOW': ['ATTENTION'],
          'PURPLE': ['AT_RISK'],
          'RED': ['CRITICAL', 'FROZEN'],
        };
        const tiers = tierMap[healthZone];
        if (tiers?.length === 1) {
          query = query.eq('tier', tiers[0]);
        } else if (tiers?.length === 2) {
          query = query.in('tier', tiers);
        }
      }

      // Filter by coach
      if (coach && coach !== 'All') {
        query = query.eq('coach_name', coach);
      }

      // Search by client name
      if (searchTerm) {
        query = query.ilike('client_name', `%${searchTerm}%`);
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;

      // Map new schema → legacy ClientHealthScore interface for backward compat
      const mapped: ClientHealthScore[] = ((data as any[]) || []).map((row: any) => {
        const zone = tierToZone(row.tier);
        const nameParts = (row.client_name || '').split(' ');
        const firstname = nameParts[0] || '';
        const lastname = nameParts.slice(1).join(' ') || '';

        return {
          id: row.id,
          client_id: row.id,
          firstname,
          lastname,
          email: null, // Not stored in health_daily — lookup if needed
          health_score: row.total_score ?? 0,
          health_zone: zone,
          engagement_score: row.frequency_score ?? 0,
          momentum_score: row.momentum_score ?? 0,
          package_health_score: row.package_score ?? 0,
          relationship_score: row.consistency_score ?? 0,
          sessions_last_7d: 0, // Could compute from session data
          sessions_last_30d: row.sessions_30d ?? 0,
          sessions_last_90d: 0,
          outstanding_sessions: row.remaining_sessions ?? 0,
          purchased_sessions: 0,
          days_since_last_session: row.days_since_training ?? 0,
          next_session_booked: false,
          client_segment: row.tier === 'FROZEN' ? 'Frozen' : row.tier === 'CRITICAL' ? 'At Risk' : null,
          assigned_coach: row.coach_name,
          calculated_on: row.score_date,
          calculated_at: row.created_at,
          created_at: row.created_at,
          updated_at: row.created_at,
          financial_score: null,
          churn_risk_score: row.tier === 'FROZEN' ? 95 : row.tier === 'CRITICAL' ? 75 : row.tier === 'AT_RISK' ? 50 : row.tier === 'ATTENTION' ? 25 : 5,
          health_trend: tierToTrend(row.trend || 'stable'),
          intervention_priority: tierToPriority(row.tier, row.alert),
          package_type: null,
          package_value_aed: row.package_value ?? 0,
          days_until_renewal: null,
          hubspot_contact_id: null,
          calculation_version: 'ENGINE_v2.0',
          // New v2.0 fields (extra — used by updated components)
          _v2: {
            client_name: row.client_name,
            coach_name: row.coach_name,
            tier: row.tier,
            recency_score: row.recency_score,
            frequency_score: row.frequency_score,
            consistency_score: row.consistency_score,
            package_score: row.package_score,
            momentum_score: row.momentum_score,
            score_delta: row.score_delta,
            trend: row.trend,
            alert: row.alert,
            cancel_rate: row.cancel_rate,
            package_value: row.package_value,
          },
        } as ClientHealthScore;
      });

      return { data: mapped, count: count || 0 };
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
  });
}
