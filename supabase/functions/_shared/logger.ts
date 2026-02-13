/**
 * Structured Logger — Phase 2.2 (loki_master_spec.md)
 *
 * JSON-formatted logs with severity levels for Supabase Edge Functions.
 * Replaces raw console.log with structured, searchable output.
 *
 * Usage:
 *   import { createLogger } from "../_shared/logger.ts";
 *   const logger = createLogger("my-function");
 *   logger.info("Processing request", { userId: "123" });
 */

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  functionName: string;
  correlationId: string;
  message: string;
  context?: Record<string, unknown>;
  userId?: string;
  duration_ms?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Generate a correlation ID for request tracing
 */
function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Create a structured logger for an Edge Function
 */
export function createLogger(functionName: string, correlationId?: string) {
  const corrId = correlationId || generateCorrelationId();
  const startTime = Date.now();

  function log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      functionName,
      correlationId: corrId,
      message,
      duration_ms: Date.now() - startTime,
    };

    if (context) {
      // Extract special fields
      if (context.userId) {
        entry.userId = String(context.userId);
        delete context.userId;
      }
      if (context.error && context.error instanceof Error) {
        entry.error = {
          name: (context.error as Error).name,
          message: (context.error as Error).message,
          stack: (context.error as Error).stack,
        };
        delete context.error;
      }
      if (Object.keys(context).length > 0) {
        entry.context = context;
      }
    }

    // Output as single-line JSON for Supabase log parsing
    const jsonLine = JSON.stringify(entry);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(jsonLine);
        break;
      case LogLevel.INFO:
        console.info(jsonLine);
        break;
      case LogLevel.WARN:
        console.warn(jsonLine);
        break;
      case LogLevel.ERROR:
        console.error(jsonLine);
        break;
    }
  }

  return {
    correlationId: corrId,
    debug: (msg: string, ctx?: Record<string, unknown>) =>
      log(LogLevel.DEBUG, msg, ctx),
    info: (msg: string, ctx?: Record<string, unknown>) =>
      log(LogLevel.INFO, msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) =>
      log(LogLevel.WARN, msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) =>
      log(LogLevel.ERROR, msg, ctx),
  };
}
