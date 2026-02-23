import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QUERY_KEYS } from "@/config/queryKeys";
import { toast } from "sonner";

export interface ProactiveInsight {
  id: string;
  insight_type: string;
  title: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  recommended_action: string | null;
  reason: string | null;
  best_call_time: string | null;
  call_script: string | null;
  contact_id: string | null;
  lead_id: string | null;
  is_dismissed: boolean | null;
  created_at: string | null;
}

export function useProactiveInsights(limit = 8) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEYS.ai.insights.proactive,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proactive_insights")
        .select(
          "id, insight_type, title, description, priority, status, recommended_action, reason, best_call_time, call_script, contact_id, lead_id, is_dismissed, created_at"
        )
        .eq("status", "active")
        .neq("is_dismissed", true)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as ProactiveInsight[];
    },
    staleTime: 60_000,
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("proactive_insights")
        .update({ is_dismissed: true, status: "dismissed" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ai.insights.proactive });
      toast.success("Insight dismissed");
    },
    onError: (err: Error) => {
      toast.error("Failed to dismiss: " + err.message);
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async (id: string) => {
      // Snooze = set status to snoozed so it disappears from active list
      const { error } = await supabase
        .from("proactive_insights")
        .update({ status: "snoozed" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ai.insights.proactive });
      toast.success("Insight snoozed");
    },
    onError: (err: Error) => {
      toast.error("Failed to snooze: " + err.message);
    },
  });

  const actMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("proactive_insights")
        .update({
          status: "completed",
          actioned_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ai.insights.proactive });
      toast.success("Insight marked as actioned");
    },
    onError: (err: Error) => {
      toast.error("Failed to update: " + err.message);
    },
  });

  return {
    insights: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    dismiss: dismissMutation.mutate,
    snooze: snoozeMutation.mutate,
    act: actMutation.mutate,
    isDismissing: dismissMutation.isPending,
    isSnoozing: snoozeMutation.isPending,
    isActing: actMutation.isPending,
  };
}
