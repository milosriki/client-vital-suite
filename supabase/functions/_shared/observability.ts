// Unified Observability Wrapper
// Combines correlation IDs, cost tracking, and structured logging

// ============================================================================
// TYPES
// ============================================================================

interface CostConfig {
  provider: "google" | "openai";
  model: string;
  tokensIn: number;
  tokensOut: number;
}

interface ExecutionMetrics {
  correlationId: string;
  functionName: string;
  startTime: number;
  endTime?: number;
  latencyMs?: number;
  status: "success" | "error";
  errorMessage?: string;
  tokenCost?: number;
}

// ============================================================================
// COST TRACKING
// ============================================================================

// Cost per 1M tokens (in USD)
const COST_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  // Google
  "gemini-3.1-flash-preview": { input: 0.10, output: 0.40 },
  "gemini-3.1-flash-preview": { input: 0.15, output: 0.60 },
  // OpenAI
  "gpt-4o": { input: 2.50, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
};

export function calculateTokenCost(config: CostConfig): number {
  const modelKey = config.model.toLowerCase();
  const costs = COST_PER_MILLION_TOKENS[modelKey];
  
  if (!costs) {
    console.warn(`[observability] Unknown model for cost calculation: ${config.model}`);
    return 0;
  }
  
  const inputCost = (config.tokensIn / 1_000_000) * costs.input;
  const outputCost = (config.tokensOut / 1_000_000) * costs.output;
  
  return inputCost + outputCost;
}

// ============================================================================
// CORRELATION IDs
// ============================================================================

export function getCorrelationId(req: Request): string {
  return req.headers.get("x-correlation-id") || 
         req.headers.get("x-request-id") || 
         crypto.randomUUID();
}

export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// STRUCTURED LOGGING
// ============================================================================

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  level: LogLevel;
  message: string;
  correlationId?: string;
  functionName?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export function structuredLog(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>
): void {
  const payload: LogPayload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...metadata,
  };
  
  const logFn = level === "error" ? console.error : 
                level === "warn" ? console.warn : 
                console.log;
  
  logFn(JSON.stringify(payload));
}
