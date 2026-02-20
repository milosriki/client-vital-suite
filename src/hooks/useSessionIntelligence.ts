import { useMemo } from "react";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";

export interface SessionRecord {
  id: string;
  client_name: string;
  coach_name: string;
  session_date: string;
  session_type: string;
  status: string;
}

export interface ClientSessionProfile {
  client_name: string;
  coach_name: string;
  total_sessions: number;
  last_session_date: string | null;
  days_since_last: number;
  avg_days_between: number | null;
  sessions_last_7d: number;
  sessions_last_30d: number;
  frequency_label: string; // "Active" | "Slowing" | "Inactive" | "Ghost"
  trend: "up" | "stable" | "down" | "none";
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

function classifyFrequency(daysLast: number, sessLast30: number): string {
  if (daysLast <= 7 && sessLast30 >= 3) return "Active";
  if (daysLast <= 14 && sessLast30 >= 2) return "Slowing";
  if (daysLast <= 30) return "Inactive";
  return "Ghost";
}

function classifyTrend(last7: number, last30: number): "up" | "stable" | "down" | "none" {
  if (last30 === 0) return "none";
  const weeklyRate30 = (last30 / 30) * 7;
  if (last7 > weeklyRate30 * 1.2) return "up";
  if (last7 < weeklyRate30 * 0.6) return "down";
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
        .select("id, client_name, coach_name, session_date, session_type, status")
        .order("session_date", { ascending: false })
        .limit(10000);
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
      const sorted = records.sort((a, b) => b.session_date.localeCompare(a.session_date));
      const lastDate = sorted[0]?.session_date ?? null;
      const daysLast = lastDate ? differenceInDays(now, new Date(lastDate)) : 999;

      const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
      const last7 = sorted.filter((s) => s.session_date >= d7).length;
      const last30 = sorted.filter((s) => s.session_date >= d30).length;

      // Avg days between sessions (last 10)
      let avgBetween: number | null = null;
      if (sorted.length >= 2) {
        const recent = sorted.slice(0, Math.min(10, sorted.length));
        let totalGap = 0;
        for (let i = 0; i < recent.length - 1; i++) {
          totalGap += differenceInDays(new Date(recent[i].session_date), new Date(recent[i + 1].session_date));
        }
        avgBetween = Math.round(totalGap / (recent.length - 1));
      }

      // Coach = most recent
      const coach = sorted[0]?.coach_name ?? "Unknown";

      return {
        client_name: name,
        coach_name: coach,
        total_sessions: records.length,
        last_session_date: lastDate,
        days_since_last: daysLast,
        avg_days_between: avgBetween,
        sessions_last_7d: last7,
        sessions_last_30d: last30,
        frequency_label: classifyFrequency(daysLast, last30),
        trend: classifyTrend(last7, last30),
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
      const sorted = rawSessions.sort((a, b) => b.session_date.localeCompare(a.session_date));
      const lastDate = sorted[0]?.session_date ?? null;
      const daysLast = lastDate ? differenceInDays(now, new Date(lastDate)) : 999;

      const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
      const last7 = sorted.filter((s) => s.session_date >= d7).length;
      const last30 = sorted.filter((s) => s.session_date >= d30).length;

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

  // Red zone alerts
  const redZoneAlerts = useMemo<RedZoneAlert[]>(() => {
    return clientProfiles
      .filter((c) => c.days_since_last > 7)
      .map((c) => ({
        client_name: c.client_name,
        coach_name: c.coach_name,
        days_since_last: c.days_since_last,
        last_session_date: c.last_session_date,
        severity: c.days_since_last > 30 ? "ghost" as const
          : c.days_since_last > 14 ? "critical" as const
          : "warning" as const,
      }))
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
