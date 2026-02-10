// ==========================================
// CODEBASE CONTRACT: API TYPES
// Enforces structured communication between Agents and Clients
// ==========================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  error_code?: string; // Standardized error code (e.g., 'RATE_LIMIT', 'AUTH_FAILED')
  meta?: ApiMetadata;
}

export interface ApiMetadata {
  duration_ms?: number;
  request_id?: string;
  model?: string; // e.g., "gemini-3-flash-preview"
  timestamp?: string;
  usage?: {
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

// Standardized Core Entities
export interface ClientProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  health_score: number;
  health_zone: "green" | "yellow" | "red";
  lifecycle_stage: string;
  owner_id?: string;
}

export interface DealRecord {
  id: string;
  name: string;
  amount: number;
  stage: string;
  close_date?: string;
  owner_id?: string;
}

export interface CallRecord {
  id: string;
  caller_number: string;
  duration_seconds: number;
  status: "completed" | "missed" | "failed";
  recording_url?: string;
  transcript?: string;
  summary?: string;
  sentiment?: "positive" | "neutral" | "negative";
}

// Agent Interaction Types
export interface AgentToolRequest {
  tool_name: string;
  input: Record<string, any>;
  context?: Record<string, any>;
}

export interface AgentToolResponse {
  output: string | Record<string, any>;
  status: "success" | "error";
}

// Error Codes
export enum ApiErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  NOT_FOUND = "NOT_FOUND",
  RATE_LIMIT = "RATE_LIMIT",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  TIMEOUT = "TIMEOUT",
}
