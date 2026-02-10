/**
 * Enterprise Agent Types
 * Type definitions for AI agents, tools, and conversations
 */

export interface AgentMessage {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  timestamp: string;
  metadata?: {
    model?: string;
    tokens?: number;
    latency_ms?: number;
    tool_calls?: ToolCall[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "running" | "completed" | "failed";
  duration_ms?: number;
}

export interface ConversationContext {
  conversation_id: string;
  contact_id?: string;
  channel: "chat" | "whatsapp" | "email" | "phone";
  messages: AgentMessage[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentConfig {
  role: string;
  model: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  systemPrompt?: string;
  safeTools: Set<string>;
}

export interface AgentLearning {
  id: string;
  agent_id: string;
  pattern: string;
  outcome: "success" | "failure" | "neutral";
  confidence: number;
  context?: Record<string, unknown>;
  created_at: string;
}

export interface BiasCheckResult {
  hasBias: boolean;
  flags: {
    category: string;
    severity: "low" | "medium" | "high";
    match: string;
  }[];
  safetyFlags: string[];
  score: number;
  recommendation: "pass" | "review" | "block";
}
