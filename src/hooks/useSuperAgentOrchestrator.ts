import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// SUPER-AGENT ORCHESTRATOR HOOK
// Frontend integration for the 3 Super-Agent system
// ============================================================================

export interface TierAgentResult {
  name: string;
  status: "pending" | "running" | "success" | "failed" | "retrying";
  error?: string;
}

export interface SuperAgentResult {
  id: string;
  name: string;
  status: "pending" | "running" | "success" | "failed" | "retrying";
  tier_agents: TierAgentResult[];
  improvements: string[];
}

export interface APIConnection {
  status: string;
  latency_ms?: number;
  error?: string;
  http_status?: number;
}

export interface OrchestratorResult {
  success: boolean;
  run_id: string;
  duration_ms: number;
  deployment_status: "pending" | "in_progress" | "success" | "failed" | "rollback";
  super_agents: SuperAgentResult[];
  api_connections: Record<string, APIConnection>;
  final_report: string;
  langsmith_run_id?: string;
}

export interface OrchestratorState {
  isLoading: boolean;
  error: string | null;
  result: OrchestratorResult | null;
  lastRun: OrchestratorResult | null;
  connections: Record<string, APIConnection> | null;
}

export function useSuperAgentOrchestrator() {
  const [state, setState] = useState<OrchestratorState>({
    isLoading: false,
    error: null,
    result: null,
    lastRun: null,
    connections: null,
  });

  // Run the full orchestration
  const runOrchestration = useCallback(async (): Promise<OrchestratorResult | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke('super-agent-orchestrator', {
        body: { action: 'run' }
      });

      if (error) {
        throw new Error(error.message);
      }

      const result = data as OrchestratorResult;
      setState(prev => ({
        ...prev,
        isLoading: false,
        result,
        lastRun: result,
        error: null
      }));

      return result;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMsg
      }));
      return null;
    }
  }, []);

  // Check API connections only
  const checkConnections = useCallback(async (): Promise<Record<string, APIConnection> | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke('super-agent-orchestrator', {
        body: { action: 'check_connections' }
      });

      if (error) {
        throw new Error(error.message);
      }

      const connections = data.connections as Record<string, APIConnection>;
      setState(prev => ({
        ...prev,
        isLoading: false,
        connections,
        error: null
      }));

      return connections;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMsg
      }));
      return null;
    }
  }, []);

  // Get last run status
  const getLastRunStatus = useCallback(async (): Promise<OrchestratorResult | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('super-agent-orchestrator', {
        body: { action: 'status' }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.last_run) {
        setState(prev => ({
          ...prev,
          lastRun: data.last_run
        }));
        return data.last_run;
      }

      return null;
    } catch (e) {
      console.error("Failed to get last run status:", e);
      return null;
    }
  }, []);

  // Helper to get agent status color
  const getStatusColor = useCallback((status: string): string => {
    switch (status) {
      case "success": return "text-green-500";
      case "failed": return "text-red-500";
      case "running": return "text-blue-500";
      case "retrying": return "text-yellow-500";
      case "pending": return "text-gray-400";
      default: return "text-gray-300";
    }
  }, []);

  // Helper to get connection status color
  const getConnectionColor = useCallback((status: string): string => {
    switch (status) {
      case "connected": return "text-green-500";
      case "failed": case "error": return "text-red-500";
      case "no_key": return "text-yellow-500";
      default: return "text-gray-300";
    }
  }, []);

  // Get summary stats
  const getSummaryStats = useCallback(() => {
    if (!state.result) return null;

    const totalTierAgents = state.result.super_agents.reduce(
      (acc, a) => acc + a.tier_agents.length, 0
    );
    const successfulTiers = state.result.super_agents.reduce(
      (acc, a) => acc + a.tier_agents.filter(t => t.status === "success").length, 0
    );
    const failedTiers = state.result.super_agents.reduce(
      (acc, a) => acc + a.tier_agents.filter(t => t.status === "failed").length, 0
    );
    const totalImprovements = state.result.super_agents.reduce(
      (acc, a) => acc + a.improvements.length, 0
    );
    const connectedApis = Object.values(state.result.api_connections)
      .filter(c => c.status === "connected").length;

    return {
      totalSuperAgents: 3,
      totalTierAgents,
      successfulTiers,
      failedTiers,
      totalImprovements,
      connectedApis,
      totalApis: Object.keys(state.result.api_connections).length,
      deploymentStatus: state.result.deployment_status,
      durationSeconds: (state.result.duration_ms / 1000).toFixed(2)
    };
  }, [state.result]);

  return {
    // State
    isLoading: state.isLoading,
    error: state.error,
    result: state.result,
    lastRun: state.lastRun,
    connections: state.connections,

    // Actions
    runOrchestration,
    checkConnections,
    getLastRunStatus,

    // Helpers
    getStatusColor,
    getConnectionColor,
    getSummaryStats,
  };
}

// ============================================================================
// SPECIALIST AGENTS REGISTRY (from ptd-unlimited-agent.ts)
// ============================================================================

export interface SpecialistAgent {
  name: string;
  focus: string;
  tools: string[];
  model: string;
  active: boolean;
}

export const SUPER_AGENT_REGISTRY: Record<string, SpecialistAgent> = {
  code_sentinel: {
    name: "Code Sentinel",
    focus: "Code quality, API connections, schema validation, type checking",
    tools: ["connection_validator", "schema_checker", "type_validator"],
    model: "gemini-2.0-flash",
    active: true
  },
  data_guardian: {
    name: "Data Guardian",
    focus: "Data integrity, memory sync, cross-checking previous agents",
    tools: ["cross_checker", "memory_syncer", "data_integrity_validator"],
    model: "gemini-2.0-flash",
    active: true
  },
  deploy_master: {
    name: "Deploy Master",
    focus: "Deployment readiness, error analysis, self-improvement, recovery",
    tools: ["error_analyzer", "self_improvement_executor", "deployment_validator", "recovery_agent"],
    model: "gemini-2.0-flash",
    active: true
  }
};

export default useSuperAgentOrchestrator;
