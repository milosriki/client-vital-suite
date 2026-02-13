// Unified Observability Wrapper
// Combines LangSmith tracing with correlation IDs, cost tracking, and structured logging

import { traceStart, traceEnd, isTracingEnabled, getLangSmithConfig } from "./langsmith-tracing.ts";
import type { TraceRun } from "./langsmith-tracing.ts";

// ============================================================================
// TYPES
// ============================================================================

interface TracingOptions {
  functionName: string;
  runType?: "chain" | "llm" | "tool" | "retriever" | "embedding";
  metadata?: Record<string, unknown>;
  tags?: string[];
}

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
  "gemini-3.0-flash": { input: 0.10, output: 0.40 },
  "gemini-3.0-flash-preview-05-20": { input: 0.15, output: 0.60 },
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

// ============================================================================
// WITH TRACING WRAPPER
// ============================================================================

export function withTracing<T extends Request>(
  handler: (req: T) => Promise<Response>,
  options: TracingOptions
): (req: T) => Promise<Response> {
  return async (req: T): Promise<Response> => {
    const correlationId = getCorrelationId(req);
    const startTime = Date.now();
    let runTrace: TraceRun | null = null;

    // Start trace if enabled
    if (isTracingEnabled()) {
      try {
        runTrace = await traceStart(
          {
            name: options.functionName,
            runType: options.runType || "chain",
            metadata: {
              ...options.metadata,
              correlationId,
              timestamp: new Date().toISOString(),
            },
            tags: options.tags,
          },
          { correlationId, url: req.url, method: req.method }
        );
      } catch (e) {
        structuredLog("warn", "Failed to start trace", { 
          functionName: options.functionName, 
          error: e instanceof Error ? e.message : "Unknown error" 
        });
      }
    }

    structuredLog("info", `[${options.functionName}] Request started`, {
      correlationId,
      functionName: options.functionName,
      method: req.method,
      url: req.url,
    });

    try {
      // Execute handler
      const response = await handler(req);
      const latencyMs = Date.now() - startTime;

      // End trace on success
      if (runTrace) {
        try {
          await traceEnd(runTrace, { 
            success: true, 
            status: response.status,
            latencyMs,
          });
        } catch (e) {
          // Don't fail on trace end error
        }
      }

      structuredLog("info", `[${options.functionName}] Request completed`, {
        correlationId,
        functionName: options.functionName,
        status: response.status,
        latencyMs,
      });

      // Add correlation ID to response headers
      const headers = new Headers(response.headers);
      headers.set("x-correlation-id", correlationId);
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // End trace on error
      if (runTrace) {
        try {
          await traceEnd(runTrace, { success: false, latencyMs }, errorMessage);
        } catch (e) {
          // Don't fail on trace end error
        }
      }

      structuredLog("error", `[${options.functionName}] Request failed`, {
        correlationId,
        functionName: options.functionName,
        error: errorMessage,
        latencyMs,
      });

      throw error;
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { isTracingEnabled, getLangSmithConfig, traceStart, traceEnd } from "./langsmith-tracing.ts";
