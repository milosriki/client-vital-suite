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
        .select("snapshot_date, sessions_today, sessions_confirmed_today, active_clients_30d, total_packages_active, packages_critical, packages_high, packages_medium, clients_increasing, clients_decreasing, clients_stable, coach_leaderboard, critical_packages, high_packages, declining_clients, daily_sessions, frequency_trends")
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      const row = data as Record<string, unknown>;

      // JSONB fields may be stored as strings — safely parse
      function parseJsonField<T>(val: unknown, fallback: T): T {
        if (val == null) return fallback;
        if (typeof val === "string") {
          try { return JSON.parse(val) as T; }
          catch { return fallback; }
        }
        return val as T;
      }

      return {
        snapshot_date: (row.snapshot_date as string) ?? "—",
        sessions_today: (row.sessions_today as number) ?? 0,
        sessions_confirmed_today: (row.sessions_confirmed_today as number) ?? 0,
        active_clients_30d: (row.active_clients_30d as number) ?? 0,
        total_packages_active: (row.total_packages_active as number) ?? 0,
        packages_critical: (row.packages_critical as number) ?? 0,
        packages_high: (row.packages_high as number) ?? 0,
        packages_medium: (row.packages_medium as number) ?? 0,
        clients_increasing: (row.clients_increasing as number) ?? 0,
        clients_decreasing: (row.clients_decreasing as number) ?? 0,
        clients_stable: (row.clients_stable as number) ?? 0,
        coach_leaderboard: parseJsonField<CoachLeaderboardEntry[]>(row.coach_leaderboard, []),
        critical_packages: parseJsonField<CriticalPackage[]>(row.critical_packages, []),
        high_packages: parseJsonField<CriticalPackage[]>(row.high_packages, []),
        declining_clients: parseJsonField<DecliningClient[]>(row.declining_clients, []),
        daily_sessions: parseJsonField<Record<string, unknown>[]>(row.daily_sessions, []),
        frequency_trends: parseJsonField<Record<string, unknown>[]>(row.frequency_trends, []),
      };
    },
    staleTime: 2 * 60 * 1000,
  });
}
