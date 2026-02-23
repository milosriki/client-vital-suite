import { useMemo } from "react";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";

export interface SessionRecord {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  coach_id: string;
  coach_name: string;
  training_date: string;
  session_type: string;
  status: string;
  location: string;
  time_slot: string;
  package_code: string;
}

export interface CoachHistory {
  coach_name: string;
  sessions: number;
  first_session: string;
  last_session: string;
}

export interface ClientSessionProfile {
  client_name: string;
  client_id: string;
  client_email: string;
  coach_name: string; // most recent
  all_coaches: CoachHistory[]; // every coach who ever trained this client
  total_sessions: number;
  last_session_date: string | null;
  days_since_last: number;
  avg_days_between: number | null;
  sessions_last_7d: number;
  sessions_last_30d: number;
  sessions_last_90d: number;
  frequency_label: string; // "Active" | "Slowing" | "Inactive" | "Ghost"
  trend: "up" | "stable" | "down" | "none";
  locations: string[];
  multi_coach: boolean; // trained by more than one coach
}

export interface CoachActivityProfile {
  coach_name: string;
  total_sessions: number;
  unique_clients: number;
  last_session_date: string | null;
  days_since_last: number;
  sessions_last_7d: number;
  sessions_last_30d: number;
  avg_sessions_per_week: number;
  clients_inactive_7d: number;  // clients with no session in 7+ days
  clients_inactive_14d: number; // clients with no session in 14+ days
  red_zone_clients: ClientSessionProfile[];
}

export interface RedZoneAlert {
  client_name: string;
  coach_name: string;
  days_since_last: number;
  last_session_date: string | null;
  severity: "warning" | "critical" | "ghost";
}

/**
 * INTELLIGENT frequency classification.
 * Not a simple day cutoff — relative to each client's OWN training pattern.
 *
 * Logic:
 * - If avg gap between sessions is known, use it as baseline
 * - "Active" = within 1.5x their normal gap
 * - "Slowing" = 1.5x-3x their normal gap (they're drifting)
 * - "Inactive" = 3x-6x their normal gap (they've dropped off)
 * - "Ghost" = >6x their normal gap OR >60 days absolute
 *
 * For clients with no pattern (< 3 sessions), use conservative defaults.
 */
function classifyFrequency(
  daysLast: number,
  sessLast30: number,
  avgGapDays: number | null,
  totalSessions: number,
): string {
  // If we have enough data, use pattern-relative thresholds
  if (avgGapDays !== null && avgGapDays > 0 && totalSessions >= 3) {
    const ratio = daysLast / avgGapDays;
    if (ratio <= 1.5) return "Active";      // Within normal range
    if (ratio <= 3.0) return "Slowing";     // Noticeably off pattern
    if (ratio <= 6.0) return "Inactive";    // Significant dropout
    return "Ghost";                          // Gone
  }

  // Fallback for new clients or sparse data — use absolute thresholds but smarter
  if (totalSessions <= 2) {
    // New client — give them more grace
    if (daysLast <= 14) return "Active";
    if (daysLast <= 30) return "Slowing";
    if (daysLast <= 60) return "Inactive";
    return "Ghost";
  }

  // Some sessions but no reliable gap — use 30d activity
  if (sessLast30 >= 4) return "Active";     // ~1/week
  if (sessLast30 >= 2) return "Slowing";
  if (daysLast <= 45) return "Inactive";
  return "Ghost";
}

function classifyTrend(last7: number, last30: number): "up" | "stable" | "down" | "none" {
  if (last30 === 0) return "none";
  const weeklyRate30 = (last30 / 30) * 7;
  if (last7 > weeklyRate30 * 1.3) return "up";
  if (last7 < weeklyRate30 * 0.5) return "down";
  return "stable";
}

export function useSessionIntelligence() {
  // Fetch ALL sessions (not just 7d) for full history analysis
  const sessionsQuery = useDedupedQuery({
    queryKey: ["session-intelligence-all"],
    dedupeIntervalMs: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions_live" as never)
        .select("id, client_id, client_name, client_email, coach_id, coach_name, training_date, session_type, status, location, time_slot, package_code")
        .order("training_date", { ascending: false })
        .limit(50000);
      if (error) throw error;
      return (data ?? []) as unknown as SessionRecord[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const sessions = sessionsQuery.data ?? [];
  const now = new Date();

  // Build client profiles
  const clientProfiles = useMemo<ClientSessionProfile[]>(() => {
    if (!sessions.length) return [];

    const byClient = new Map<string, SessionRecord[]>();
    for (const s of sessions) {
      const key = s.client_name;
      if (!byClient.has(key)) byClient.set(key, []);
      byClient.get(key)!.push(s);
    }

    return Array.from(byClient.entries()).map(([name, records]) => {
      const sorted = records.sort((a, b) => b.training_date.localeCompare(a.training_date));
      const lastDate = sorted[0]?.training_date ?? null;
      const daysLast = lastDate ? differenceInDays(now, new Date(lastDate)) : 999;

      const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
      const d90 = new Date(now.getTime() - 90 * 86400000).toISOString();
      const last7 = sorted.filter((s) => s.training_date >= d7).length;
      const last30 = sorted.filter((s) => s.training_date >= d30).length;
      const last90 = sorted.filter((s) => s.training_date >= d90).length;

      // Avg days between sessions (last 10)
      let avgBetween: number | null = null;
      if (sorted.length >= 2) {
        const recent = sorted.slice(0, Math.min(10, sorted.length));
        let totalGap = 0;
        for (let i = 0; i < recent.length - 1; i++) {
          totalGap += differenceInDays(new Date(recent[i].training_date), new Date(recent[i + 1].training_date));
        }
        avgBetween = Math.round(totalGap / (recent.length - 1));
      }

      // Coach = most recent
      const coach = sorted[0]?.coach_name ?? "Unknown";

      // All coaches who ever trained this client
      const coachMap = new Map<string, { sessions: number; dates: string[] }>();
      for (const s of records) {
        const cn = s.coach_name ?? "Unknown";
        if (!coachMap.has(cn)) coachMap.set(cn, { sessions: 0, dates: [] });
        const entry = coachMap.get(cn)!;
        entry.sessions++;
        entry.dates.push(s.training_date);
      }
      const allCoaches: CoachHistory[] = Array.from(coachMap.entries())
        .map(([cn, data]) => ({
          coach_name: cn,
          sessions: data.sessions,
          first_session: data.dates.sort()[0],
          last_session: data.dates.sort().reverse()[0],
        }))
        .sort((a, b) => b.sessions - a.sessions);

      // Unique locations
      const locations = [...new Set(records.map((r) => r.location).filter(Boolean))];

      return {
        client_name: name,
        client_id: sorted[0]?.client_id ?? "",
        client_email: sorted[0]?.client_email ?? "",
        coach_name: coach,
        all_coaches: allCoaches,
        total_sessions: records.length,
        last_session_date: lastDate,
        days_since_last: daysLast,
        avg_days_between: avgBetween,
        sessions_last_7d: last7,
        sessions_last_30d: last30,
        sessions_last_90d: last90,
        frequency_label: classifyFrequency(daysLast, last30, avgBetween, records.length),
        trend: classifyTrend(last7, last30),
        locations,
        multi_coach: allCoaches.length > 1,
      };
    });
  }, [sessions]);

  // Build coach profiles
  const coachProfiles = useMemo<CoachActivityProfile[]>(() => {
    if (!clientProfiles.length) return [];

    const byCoach = new Map<string, ClientSessionProfile[]>();
    for (const cp of clientProfiles) {
      if (!byCoach.has(cp.coach_name)) byCoach.set(cp.coach_name, []);
      byCoach.get(cp.coach_name)!.push(cp);
    }

    // Also need raw sessions for coach totals
    const coachSessions = new Map<string, SessionRecord[]>();
    for (const s of sessions) {
      if (!coachSessions.has(s.coach_name)) coachSessions.set(s.coach_name, []);
      coachSessions.get(s.coach_name)!.push(s);
    }

    return Array.from(byCoach.entries()).map(([coach, clients]) => {
      const rawSessions = coachSessions.get(coach) ?? [];
      const sorted = rawSessions.sort((a, b) => b.training_date.localeCompare(a.training_date));
      const lastDate = sorted[0]?.training_date ?? null;
      const daysLast = lastDate ? differenceInDays(now, new Date(lastDate)) : 999;

      const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
      const last7 = sorted.filter((s) => s.training_date >= d7).length;
      const last30 = sorted.filter((s) => s.training_date >= d30).length;

      const inactive7 = clients.filter((c) => c.days_since_last > 7).length;
      const inactive14 = clients.filter((c) => c.days_since_last > 14).length;
      const redZone = clients
        .filter((c) => c.days_since_last > 7)
        .sort((a, b) => b.days_since_last - a.days_since_last);

      return {
        coach_name: coach,
        total_sessions: rawSessions.length,
        unique_clients: clients.length,
        last_session_date: lastDate,
        days_since_last: daysLast,
        sessions_last_7d: last7,
        sessions_last_30d: last30,
        avg_sessions_per_week: last30 > 0 ? Math.round((last30 / 30) * 7 * 10) / 10 : 0,
        clients_inactive_7d: inactive7,
        clients_inactive_14d: inactive14,
        red_zone_clients: redZone,
      };
    }).sort((a, b) => b.total_sessions - a.total_sessions);
  }, [clientProfiles, sessions]);

  // Red zone alerts — INTELLIGENT, pattern-relative
  // Only flags clients whose absence is abnormal for THEIR pattern
  const redZoneAlerts = useMemo<RedZoneAlert[]>(() => {
    return clientProfiles
      .filter((c) => c.frequency_label !== "Active") // Only non-active clients
      .filter((c) => {
        // Smart filter: if we know their pattern, only alert when overdue
        if (c.avg_days_between !== null && c.avg_days_between > 0) {
          return c.days_since_last > c.avg_days_between * 1.5; // Beyond 1.5x their normal
        }
        // No pattern data — use conservative 10-day threshold
        return c.days_since_last > 10;
      })
      .map((c) => {
        // Severity based on how far past their pattern they are
        const overdueRatio = c.avg_days_between
          ? c.days_since_last / c.avg_days_between
          : c.days_since_last / 7; // Fallback assumes weekly

        return {
          client_name: c.client_name,
          coach_name: c.coach_name,
          days_since_last: c.days_since_last,
          last_session_date: c.last_session_date,
          severity: overdueRatio > 6 ? "ghost" as const
            : overdueRatio > 3 ? "critical" as const
            : "warning" as const,
        };
      })
      .sort((a, b) => b.days_since_last - a.days_since_last);
  }, [clientProfiles]);

  return {
    sessions,
    clientProfiles,
    coachProfiles,
    redZoneAlerts,
    isLoading: sessionsQuery.isLoading,
    isFetching: sessionsQuery.isFetching,
    refetch: sessionsQuery.refetch,
    // Summary stats
    stats: {
      totalSessions: sessions.length,
      activeClients: clientProfiles.filter((c) => c.frequency_label === "Active").length,
      slowingClients: clientProfiles.filter((c) => c.frequency_label === "Slowing").length,
      inactiveClients: clientProfiles.filter((c) => c.frequency_label === "Inactive").length,
      ghostClients: clientProfiles.filter((c) => c.frequency_label === "Ghost").length,
      redZoneCount: redZoneAlerts.length,
    },
  };
}
