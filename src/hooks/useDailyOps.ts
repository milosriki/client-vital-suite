import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface CriticalPackage {
  client_name: string;
  client_phone: string;
  package_name: string;
  pack_size: number;
  remaining_sessions: number;
  package_value: number;
  last_coach: string;
  last_session_date: string;
  sessions_per_week: number;
  future_booked: number;
  depletion_priority: "CRITICAL" | "HIGH" | "MEDIUM";
}

export interface CoachLeaderboardEntry {
  coach_name: string;
  avg_sessions_per_day: string;
  total_completed: number;
  completion_rate: string;
  clients_90d: number;
  retention_14d_pct: string;
}

export interface DecliningClient {
  client_name: string;
  phone_number: string;
  recent_4w: number;
  prior_4w: number;
  change: number;
  trend: string;
  coach: string;
}

export interface DailyOpsSnapshot {
  snapshot_date: string;
  sessions_today: number;
  sessions_confirmed_today: number;
  active_clients_30d: number;
  total_packages_active: number;
  packages_critical: number;
  packages_high: number;
  packages_medium: number;
  clients_increasing: number;
  clients_decreasing: number;
  clients_stable: number;
  coach_leaderboard: CoachLeaderboardEntry[];
  critical_packages: CriticalPackage[];
  high_packages: CriticalPackage[];
  declining_clients: DecliningClient[];
  daily_sessions: Record<string, unknown>[];
  frequency_trends: Record<string, unknown>[];
}

export function useDailyOps() {
  return useDedupedQuery<DailyOpsSnapshot | null>({
    queryKey: ["daily-ops-snapshot"],
    dedupeIntervalMs: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aws_ops_snapshot" as never)
        .select("*")
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      const row = data as Record<string, unknown>;
      return {
        snapshot_date: row.snapshot_date as string,
        sessions_today: row.sessions_today as number,
        sessions_confirmed_today: row.sessions_confirmed_today as number,
        active_clients_30d: row.active_clients_30d as number,
        total_packages_active: row.total_packages_active as number,
        packages_critical: row.packages_critical as number,
        packages_high: row.packages_high as number,
        packages_medium: row.packages_medium as number,
        clients_increasing: row.clients_increasing as number,
        clients_decreasing: row.clients_decreasing as number,
        clients_stable: row.clients_stable as number,
        coach_leaderboard: (row.coach_leaderboard ?? []) as CoachLeaderboardEntry[],
        critical_packages: (row.critical_packages ?? []) as CriticalPackage[],
        high_packages: (row.high_packages ?? []) as CriticalPackage[],
        declining_clients: (row.declining_clients ?? []) as DecliningClient[],
        daily_sessions: (row.daily_sessions ?? []) as Record<string, unknown>[],
        frequency_trends: (row.frequency_trends ?? []) as Record<string, unknown>[],
      };
    },
    staleTime: 2 * 60 * 1000,
  });
}
