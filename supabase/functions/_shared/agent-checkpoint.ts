/**
 * Agent Checkpoint/Resume System
 * Enterprise pattern for long-running agent orchestrations
 *
 * Per autonomous-agent-patterns skill:
 * - Persist agent state at each step
 * - Resume from last checkpoint on crash
 * - Track execution history
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AgentCheckpoint {
  checkpoint_id: string;
  conversation_id: string;
  function_name: string;
  step_index: number;
  step_name: string;
  state: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed";
  started_at: string;
  completed_at?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Save agent state checkpoint
 */
export async function saveCheckpoint(
  supabase: ReturnType<typeof createClient>,
  checkpoint: Omit<AgentCheckpoint, "checkpoint_id" | "started_at">,
): Promise<string> {
  const checkpointId = crypto.randomUUID();

  const { error } = await supabase.from("agent_checkpoints").insert({
    checkpoint_id: checkpointId,
    conversation_id: checkpoint.conversation_id,
    function_name: checkpoint.function_name,
    step_index: checkpoint.step_index,
    step_name: checkpoint.step_name,
    state: checkpoint.state,
    status: checkpoint.status,
    started_at: new Date().toISOString(),
    completed_at: checkpoint.completed_at,
    error: checkpoint.error,
    metadata: checkpoint.metadata,
  });

  if (error) {
    console.error("[Checkpoint] Failed to save:", error);
    // Don't throw — checkpoint failure shouldn't break the agent
  }

  return checkpointId;
}

/**
 * Get the last checkpoint for a conversation
 */
export async function getLastCheckpoint(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  functionName: string,
): Promise<AgentCheckpoint | null> {
  const { data, error } = await supabase
    .from("agent_checkpoints")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("function_name", functionName)
    .order("step_index", { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;
  return data[0] as AgentCheckpoint;
}

/**
 * Mark a checkpoint step as completed
 */
export async function completeCheckpoint(
  supabase: ReturnType<typeof createClient>,
  checkpointId: string,
  result?: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("agent_checkpoints")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      state: result || {},
    })
    .eq("checkpoint_id", checkpointId);
}

/**
 * Mark a checkpoint step as failed
 */
export async function failCheckpoint(
  supabase: ReturnType<typeof createClient>,
  checkpointId: string,
  error: string,
): Promise<void> {
  await supabase
    .from("agent_checkpoints")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error,
    })
    .eq("checkpoint_id", checkpointId);
}

/**
 * Higher-order function: wrap an agent step with checkpoint support
 *
 * @example
 * const step1 = withCheckpoint(supabase, conversationId, "agent-name", 0, "Fetch Data", async (state) => {
 *   const data = await fetchData();
 *   return { ...state, data };
 * });
 */
export function withCheckpoint(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  functionName: string,
  stepIndex: number,
  stepName: string,
  handler: (state: Record<string, unknown>) => Promise<Record<string, unknown>>,
): () => Promise<Record<string, unknown>> {
  return async () => {
    // Check if this step was already completed
    const existing = await getLastCheckpoint(
      supabase,
      conversationId,
      functionName,
    );
    if (
      existing &&
      existing.step_index >= stepIndex &&
      existing.status === "completed"
    ) {
      console.log(
        `[Checkpoint] Skipping step ${stepIndex} "${stepName}" — already completed`,
      );
      return existing.state;
    }

    // Save pending checkpoint
    const checkpointId = await saveCheckpoint(supabase, {
      conversation_id: conversationId,
      function_name: functionName,
      step_index: stepIndex,
      step_name: stepName,
      state: existing?.state || {},
      status: "running",
    });

    try {
      const result = await handler(existing?.state || {});
      await completeCheckpoint(supabase, checkpointId, result);
      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await failCheckpoint(supabase, checkpointId, errMsg);
      throw error;
    }
  };
}
