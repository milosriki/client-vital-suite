// LangSmith SDK-based Tracing Utility
// Provides centralized tracing for all edge functions with proper error handling and fallbacks

const LANGSMITH_ENDPOINT = "https://api.smith.langchain.com";

interface TraceConfig {
  name: string;
  runType?: "chain" | "llm" | "tool" | "retriever" | "embedding";
  projectName?: string;
  parentRunId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

interface TraceRun {
  runId: string;
  startTime: string;
  name: string;
  projectName: string;
}

interface LangSmithStatus {
  configured: boolean;
  connected: boolean;
  projectName: string | null;
  endpoint: string;
  error?: string;
}

// Get LangSmith configuration from environment
export function getLangSmithConfig(): { apiKey: string | null; projectName: string; endpoint: string } {
  return {
    apiKey: Deno.env.get("LANGSMITH_API_KEY") || null,
    projectName: Deno.env.get("LANGSMITH_PROJECT") || Deno.env.get("LANGCHAIN_PROJECT") || "ptd-agent",
    endpoint: Deno.env.get("LANGSMITH_ENDPOINT") || LANGSMITH_ENDPOINT,
  };
}

// Check if LangSmith tracing is enabled
export function isTracingEnabled(): boolean {
  const config = getLangSmithConfig();
  const tracingV2 = Deno.env.get("LANGCHAIN_TRACING_V2");
  return !!config.apiKey && tracingV2 !== "false";
}

// Check LangSmith connectivity and return status
export async function checkLangSmithStatus(): Promise<LangSmithStatus> {
  const config = getLangSmithConfig();
  
  if (!config.apiKey) {
    return {
      configured: false,
      connected: false,
      projectName: null,
      endpoint: config.endpoint,
      error: "LANGSMITH_API_KEY not configured",
    };
  }

  try {
    // Test connectivity by fetching projects
    const response = await fetch(`${config.endpoint}/projects`, {
      method: "GET",
      headers: {
        "x-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return {
        configured: true,
        connected: true,
        projectName: config.projectName,
        endpoint: config.endpoint,
      };
    } else {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        configured: true,
        connected: false,
        projectName: config.projectName,
        endpoint: config.endpoint,
        error: `API returned ${response.status}: ${errorText}`,
      };
    }
  } catch (error) {
    return {
      configured: true,
      connected: false,
      projectName: config.projectName,
      endpoint: config.endpoint,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

// Start a new trace run
export async function traceStart(config: TraceConfig, inputs: Record<string, unknown>): Promise<TraceRun | null> {
  const langsmithConfig = getLangSmithConfig();
  
  if (!langsmithConfig.apiKey || !isTracingEnabled()) {
    return null;
  }

  const runId = crypto.randomUUID();
  const startTime = new Date().toISOString();
  const projectName = config.projectName || langsmithConfig.projectName;

  try {
    const response = await fetch(`${langsmithConfig.endpoint}/runs`, {
      method: "POST",
      headers: {
        "x-api-key": langsmithConfig.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: runId,
        name: config.name,
        run_type: config.runType || "chain",
        inputs,
        start_time: startTime,
        session_name: projectName,
        parent_run_id: config.parentRunId,
        extra: {
          metadata: config.metadata,
          tags: config.tags,
        },
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      console.log(`[LangSmith] Trace started: ${config.name} (${runId})`);
      return {
        runId,
        startTime,
        name: config.name,
        projectName,
      };
    } else {
      console.warn(`[LangSmith] Failed to start trace: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.warn(`[LangSmith] Trace start error: ${error instanceof Error ? error.message : "Unknown"}`);
    return null;
  }
}

// End a trace run with outputs
export async function traceEnd(
  run: TraceRun | null,
  outputs: Record<string, unknown>,
  error?: string
): Promise<void> {
  if (!run) return;

  const config = getLangSmithConfig();
  if (!config.apiKey) return;

  try {
    await fetch(`${config.endpoint}/runs/${run.runId}`, {
      method: "PATCH",
      headers: {
        "x-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        end_time: new Date().toISOString(),
        outputs,
        error,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (error) {
      console.log(`[LangSmith] Trace ended with error: ${run.name} (${run.runId})`);
    } else {
      console.log(`[LangSmith] Trace ended: ${run.name} (${run.runId})`);
    }
  } catch (e) {
    console.warn(`[LangSmith] Trace end error: ${e instanceof Error ? e.message : "Unknown"}`);
  }
}

// Create a child span within a parent trace
export async function traceSpan(
  parentRun: TraceRun | null,
  name: string,
  runType: "llm" | "tool" | "retriever" | "embedding",
  inputs: Record<string, unknown>
): Promise<TraceRun | null> {
  if (!parentRun) return null;

  return traceStart(
    {
      name,
      runType,
      projectName: parentRun.projectName,
      parentRunId: parentRun.runId,
    },
    inputs
  );
}

// Wrapper function for tracing async operations
export async function withTrace<T>(
  config: TraceConfig,
  inputs: Record<string, unknown>,
  fn: (run: TraceRun | null) => Promise<T>
): Promise<T> {
  const run = await traceStart(config, inputs);
  
  try {
    const result = await fn(run);
    await traceEnd(run, { result: result as unknown as Record<string, unknown> });
    return result;
  } catch (error) {
    await traceEnd(run, {}, error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}

// Log feedback for a trace run (for learning/evaluation)
export async function traceFeedback(
  runId: string,
  score: number,
  comment?: string,
  key: string = "user_feedback"
): Promise<boolean> {
  const config = getLangSmithConfig();
  
  if (!config.apiKey) return false;

  try {
    const response = await fetch(`${config.endpoint}/feedback`, {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        run_id: runId,
        key,
        score,
        comment,
      }),
      signal: AbortSignal.timeout(5000),
    });

    return response.ok;
  } catch {
    return false;
  }
}

// Utility to create trace metadata for Stripe operations
export function createStripeTraceMetadata(action: string, additionalMeta?: Record<string, unknown>): Record<string, unknown> {
  return {
    service: "stripe",
    action,
    timestamp: new Date().toISOString(),
    ...additionalMeta,
  };
}

// Export types for use in other modules
export type { TraceConfig, TraceRun, LangSmithStatus };
