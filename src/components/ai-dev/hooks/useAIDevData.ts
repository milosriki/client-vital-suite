import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { toast } from "sonner";

export interface PreparedAction {
  id: string;
  action_type: string;
  action_title: string;
  action_description: string;
  reasoning: string;
  expected_impact: string;
  risk_level: string;
  confidence: number;
  prepared_payload: {
    files?: Array<{ path: string; content: string }>;
    sql?: string;
    analysis?: string;
  };
  status: string;
  priority: number;
  source_agent: string;
  created_at: string;
  executed_at: string | null;
  rejection_reason: string | null;
}

export const useAIDevData = () => {
  const [command, setCommand] = useState("");
  const [selectedAction, setSelectedAction] = useState<PreparedAction | null>(
    null,
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all actions
  const {
    data: actions,
    isLoading: actionsLoading,
    refetch,
  } = useDedupedQuery({
    queryKey: ["prepared-actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prepared_actions")
        .select("id, action_type, action_title, action_description, reasoning, expected_impact, risk_level, confidence, prepared_payload, status, priority, source_agent, created_at, executed_at, rejection_reason")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PreparedAction[];
    },
    staleTime: Infinity,
  });

  // Execute command mutation
  const executeCommand = useMutation({
    mutationFn: async (cmd: string) => {
      const { data, error } = await supabase.functions.invoke(
        "smart-ai-advisor",
        {
          body: { command: cmd },
        },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Command processed", {
        description: data.message || "Action prepared for review",
      });
      setCommand("");
      queryClient.invalidateQueries({ queryKey: ["prepared-actions"] });
    },
    onError: (error: Error) => {
      toast.error("Command failed", {
        description: error.message,
      });
    },
  });

  // Approve action mutation
  const approveAction = useMutation({
    mutationFn: async (actionId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "ai-trigger-deploy",
        {
          body: {
            approval_id: actionId,
            approved: true,
            approved_by: "admin",
          },
        },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Action approved", {
        description: data.message || "Deployment triggered",
      });
      setPreviewOpen(false);
      queryClient.invalidateQueries({ queryKey: ["prepared-actions"] });
    },
    onError: (error: Error) => {
      toast.error("Approval failed", {
        description: error.message,
      });
    },
  });

  // Reject action mutation
  const rejectAction = useMutation({
    mutationFn: async ({
      actionId,
      reason,
    }: {
      actionId: string;
      reason: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "ai-trigger-deploy",
        {
          body: {
            approval_id: actionId,
            approved: false,
            rejection_reason: reason,
          },
        },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Action rejected", {
        description: "Feedback recorded for AI learning",
      });
      setRejectDialogOpen(false);
      setRejectReason("");
      setPreviewOpen(false);
      queryClient.invalidateQueries({ queryKey: ["prepared-actions"] });
    },
    onError: (error: Error) => {
      toast.error("Rejection failed", {
        description: error.message,
      });
    },
  });

  const pendingActions = actions?.filter((a) => a.status === "pending") || [];
  const executingActions =
    actions?.filter((a) => a.status === "executing") || [];
  const historyActions =
    actions?.filter((a) => ["executed", "rejected"].includes(a.status)) || [];

  return {
    command,
    setCommand,
    selectedAction,
    setSelectedAction,
    previewOpen,
    setPreviewOpen,
    rejectReason,
    setRejectReason,
    rejectDialogOpen,
    setRejectDialogOpen,
    actionsLoading,
    refetch,
    executeCommand,
    approveAction,
    rejectAction,
    pendingActions,
    executingActions,
    historyActions,
  };
};
