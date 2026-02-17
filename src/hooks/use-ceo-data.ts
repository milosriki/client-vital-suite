import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  PreparedAction,
  BusinessGoal,
  CalibrationExample,
  ProactiveInsight,
  BIAnalysis,
  RevenueMetrics,
  ClientHealthMetrics,
  IntegrationStatus,
  ChurnAlert,
} from "@/types/ceo";

export function useCEOData() {
  const queryClient = useQueryClient();

  // --- QUERIES ---

  const { data: pendingActions, isLoading: loadingActions } = useQuery({
    queryKey: ["pending-actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prepared_actions")
        .select("id, action_type, action_title, action_description, reasoning, expected_impact, risk_level, confidence, prepared_payload, supporting_data, status, priority, source_agent, created_at, executed_at, rejection_reason")
        .in("status", ["prepared", "executing"])
        .order("priority", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as PreparedAction[];
    },
    staleTime: Infinity,
  });

  const { data: executedActions } = useQuery({
    queryKey: ["executed-actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prepared_actions")
        .select("id, action_type, action_title, action_description, reasoning, expected_impact, risk_level, confidence, prepared_payload, supporting_data, status, priority, source_agent, created_at, executed_at, rejection_reason")
        .in("status", ["executed", "failed"])
        .order("executed_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as PreparedAction[];
    },
    staleTime: Infinity,
  });

  const { data: goals } = useQuery({
    queryKey: ["business-goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_goals")
        .select("id, goal_name, metric_name, baseline_value, current_value, target_value, deadline, status")
        .eq("status", "active");
      if (error) throw error;
      return (data || []) as BusinessGoal[];
    },
  });

  const { data: calibrationData } = useQuery({
    queryKey: ["business-calibration"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_calibration")
        .select("id, scenario_description, ai_recommendation, your_decision, was_ai_correct, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as CalibrationExample[];
    },
  });

  const { data: insights } = useQuery({
    queryKey: ["proactive-insights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proactive_insights")
        .select("id, insight_type, priority, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []).map((item) => ({
        ...item,
        title: item.insight_type || "Insight",
        description: "",
      })) as ProactiveInsight[];
    },
    staleTime: Infinity,
  });

  const {
    data: biData,
    isLoading: loadingBI,
    refetch: refetchBI,
  } = useQuery({
    queryKey: ["business-intelligence"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "business-intelligence",
      );
      if (error) throw error;
      return data as {
        success: boolean;
        analysis: BIAnalysis;
        dataFreshness: string;
        staleWarning: string | null;
      };
    },
    staleTime: Infinity,
  });

  const { data: revenueData } = useQuery({
    queryKey: ["ceo-revenue-metrics"],
    queryFn: async (): Promise<RevenueMetrics> => {
      // Use RPC for efficient server-side aggregation
      const { data: stats, error } = await supabase.rpc(
        "get_dashboard_stats" as any,
      );

      if (!error && stats) {
        return {
          totalRevenue: stats.revenue_this_month || 0,
          avgDealValue: stats.avg_deal_value || 0,
          dealsCount: stats.closed_deals_count || 0,
          pipelineValue: stats.pipeline_value || 0,
        };
      }

      // Fallback to client-side calculation if RPC fails
      console.warn(
        "RPC failed, falling back to client-side calculation",
        error,
      );

      const { data: deals, error: dealsError } = await supabase
        .from("deals")
        .select("deal_value, status, close_date")
        .gte(
          "close_date",
          new Date(
            new Date().setMonth(new Date().getMonth() - 1),
          ).toISOString(),
        );

      if (dealsError) throw dealsError;

      const closedDeals = deals?.filter((d) => d.status === "closed") || [];
      const totalRevenue = closedDeals.reduce(
        (sum, d) => sum + (Number(d.deal_value) || Number(d.amount) || 0),
        0,
      );
      const avgDealValue =
        closedDeals.length > 0 ? totalRevenue / closedDeals.length : 0;

      return {
        totalRevenue,
        avgDealValue,
        dealsCount: closedDeals.length,
        pipelineValue:
          deals
            ?.filter((d) => d.status !== "closed")
            .reduce((sum, d) => sum + (Number(d.deal_value) || Number(d.amount) || 0), 0) || 0,
      };
    },
  });

  const { data: clientHealth } = useQuery({
    queryKey: ["ceo-client-health"],
    queryFn: async (): Promise<ClientHealthMetrics> => {
      const { data: latestDate } = await supabase
        .from("client_health_scores")
        .select("calculated_on")
        .order("calculated_on", { ascending: false })
        .limit(1)
        .single();

      if (!latestDate?.calculated_on)
        return {
          green: 0,
          yellow: 0,
          red: 0,
          purple: 0,
          total: 0,
          atRiskRevenue: 0,
          avgHealth: 0,
        };

      const { data, error } = await supabase
        .from("client_health_scores")
        .select(
          "health_zone, health_score, churn_risk_score, package_value_aed",
        )
        .eq("calculated_on", latestDate.calculated_on);

      if (error) throw error;

      const zones = { green: 0, yellow: 0, red: 0, purple: 0 };
      let atRiskRevenue = 0;
      let totalScore = 0;

      data?.forEach((c) => {
        const zone = (c.health_zone || "yellow").toLowerCase();
        if (zone in zones) zones[zone as keyof typeof zones]++;

        if (zone === "red" || zone === "yellow") {
          atRiskRevenue += c.package_value_aed || 0;
        }
        totalScore += c.health_score || 0;
      });

      return {
        ...zones,
        total: data?.length || 0,
        atRiskRevenue,
        avgHealth: data?.length ? Math.round(totalScore / data.length) : 0,
      } as ClientHealthMetrics;
    },
  });

  const { data: integrationStatus } = useQuery({
    queryKey: ["ceo-integration-status"],
    queryFn: async () => {
      const { data: syncLogs } = await supabase
        .from("sync_logs")
        .select("platform, status, started_at")
        .order("started_at", { ascending: false })
        .limit(50);

      const { data: syncErrors } = await supabase
        .from("sync_errors")
        .select("source, error_type, resolved_at")
        .is("resolved_at", null);

      const platforms = ["hubspot", "stripe", "callgear", "facebook"];
      const status: IntegrationStatus = {};

      platforms.forEach((p) => {
        const logs = syncLogs?.filter((l) => l.platform === p) || [];
        const errors = syncErrors?.filter((e) => e.source === p) || [];
        const lastLog = logs[0];

        status[p] = {
          connected: logs.some((l) => l.status === "success"),
          lastSync: lastLog?.started_at || null,
          errors: errors.length,
        };
      });

      return status;
    },
  });

  const { data: churnAlerts } = useQuery({
    queryKey: ["ceo-churn-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_health_scores")
        .select(
          "firstname, lastname, email, churn_risk_score, health_zone, package_value_aed",
        )
        .or("health_zone.eq.red,churn_risk_score.gt.70")
        .order("churn_risk_score", { ascending: false })
        .limit(5);

      if (error) throw error;
      return (data || []) as unknown as ChurnAlert[];
    },
  });

  // --- MUTATIONS ---

  const sendCommand = useMutation({
    mutationFn: async (userCommand: string) => {
      const { data, error } = await supabase.functions.invoke("ai-ceo-master", {
        body: { command: userCommand, mode: "fast_action" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Command processed");
      queryClient.invalidateQueries({ queryKey: ["pending-actions"] });
    },
    onError: (error) => {
      toast.error("Failed to process command");
      console.error(error);
    },
  });

  const approveAction = useMutation({
    mutationFn: async (actionId: string) => {
      // 1. Mark as executing
      await supabase
        .from("prepared_actions")
        .update({ status: "executing", executed_at: new Date().toISOString() })
        .eq("id", actionId);

      // 2. Call execution agent (rewired: action-executor → ptd-execute-action)
      const { data: actionData } = await supabase
        .from("prepared_actions")
        .select("action_type, prepared_payload")
        .eq("id", actionId)
        .single();

      const { error } = await supabase.functions.invoke("ptd-execute-action", {
        body: {
          action: actionData?.action_type || "generic",
          params: {
            actionId,
            ...((actionData?.prepared_payload as object) || {}),
          },
        },
      });

      if (error) throw error;
    },
    onSuccess: (data) => {
      toast.success("Action approved and executing");
      queryClient.invalidateQueries({ queryKey: ["pending-actions"] });
      queryClient.invalidateQueries({ queryKey: ["executed-actions"] });
    },
    onError: (error) => {
      toast.error("Failed to execute action");
      console.error(error);
    },
  });

  const rejectAction = useMutation({
    mutationFn: async ({
      actionId,
      reason,
    }: {
      actionId: string;
      reason: string;
    }) => {
      const { error } = await supabase
        .from("prepared_actions")
        .update({
          status: "rejected",
          rejection_reason: reason,
        })
        .eq("id", actionId);

      if (error) throw error;

      // Record feedback and trigger learning loop (rewired: feedback-loop → ai-learning-loop)
      await supabase.from("ai_feedback_learning").insert({
        feedback_score: 1,
        user_correction: reason,
        context_data: { type: "action_rejection", actionId },
        original_recommendation: `Action ${actionId} was rejected`,
        applied_to_model: false,
      });
      await supabase.functions.invoke("ai-learning-loop", {}).catch(() => {});
    },
    onSuccess: () => {
      toast.success("Action rejected");
      queryClient.invalidateQueries({ queryKey: ["pending-actions"] });
    },
  });

  const generateSolution = useMutation({
    mutationFn: async (prompt: string) => {
      await supabase.from("proactive_insights").insert({
        insight_type: "manual_request",
        description: prompt,
        priority: "high",
      });
    },
    onSuccess: () => {
      toast.success("Request queued for analysis");
      queryClient.invalidateQueries({ queryKey: ["proactive-insights"] });
    },
  });

  const runMonitor = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-ceo-master", {
        body: { command: "Run full system monitor", mode: "monitor" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("System monitor started");
      queryClient.invalidateQueries({ queryKey: ["business-intelligence"] });
    },
    onError: (error) => {
      toast.error("Failed to run monitor");
      console.error(error);
    },
  });

  return {
    pendingActions,
    loadingActions,
    executedActions,
    goals,
    calibrationData,
    insights,
    biData,
    loadingBI,
    refetchBI,
    revenueData,
    clientHealth,
    integrationStatus,
    churnAlerts,
    sendCommand,
    approveAction,
    rejectAction,
    generateSolution,
    runMonitor,
  };
}
