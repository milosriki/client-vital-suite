import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { supabase } from "@/integrations/supabase/client";

export interface ClientPackage {
  id: string;
  client_name: string;
  phone: string;
  package_name: string;
  remaining_sessions: number;
  total_sessions: number;
  last_coach: string;
  last_session_date: string;
  sessions_per_week: number;
  future_booked: number;
  next_session_date: string | null;
  depletion_priority: string;
  synced_at: string;
}

export interface TrainingSession {
  id: string;
  client_name: string;
  coach_name: string;
  session_date: string;
  session_type: string;
}

export function useClientActivity() {
  const packagesQuery = useDedupedQuery({
    queryKey: ["client-packages-live"],
    dedupeIntervalMs: 2000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_packages_live" as never)
        .select("*")
        .order("remaining_sessions", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ClientPackage[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const sessionsQuery = useDedupedQuery({
    queryKey: ["training-sessions-live-7d"],
    dedupeIntervalMs: 2000,
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("training_sessions_live" as never)
        .select("*")
        .gte("session_date", sevenDaysAgo)
        .order("session_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TrainingSession[];
    },
    staleTime: 2 * 60 * 1000,
  });

  return {
    packages: packagesQuery.data ?? [],
    recentSessions: sessionsQuery.data ?? [],
    isLoading: packagesQuery.isLoading || sessionsQuery.isLoading,
    isFetching: packagesQuery.isFetching || sessionsQuery.isFetching,
    refetch: () => {
      packagesQuery.refetch();
      sessionsQuery.refetch();
    },
  };
}
