/**
 * Sentry Error Tracking — Phase 2.3 (loki_master_spec.md)
 *
 * Lightweight Sentry integration for Supabase Edge Functions (Deno runtime).
 * Uses Sentry's HTTP API since the full SDK has limited Deno support.
 *
 * Required env: SENTRY_DSN
 *
 * Usage:
 *   import { captureException, withSentry } from "../_shared/sentry.ts";
 *
 *   // Wrap handler:
 *   serve(withSentry("my-function", async (req) => { ... }));
 *
 *   // Or manual capture:
 *   captureException(error, { functionName: "my-function", userId: "123" });
 */

interface SentryContext {
  functionName: string;
  userId?: string;
  correlationId?: string;
  extra?: Record<string, unknown>;
}

/**
 * Parse Sentry DSN into components
 */
function parseDSN(dsn: string) {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace("/", "");
    const publicKey = url.username;
    const host = url.hostname;
    return {
      projectId,
      publicKey,
      host,
      storeUrl: `https://${host}/api/${projectId}/store/`,
    };
  } catch {
    return null;
  }
}

/**
 * Send an error event to Sentry via HTTP API
 */
export async function captureException(
  error: Error | unknown,
  context: SentryContext,
): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) {
    console.warn("[Sentry] SENTRY_DSN not set — skipping error capture");
    return;
  }

  const parsed = parseDSN(dsn);
  if (!parsed) {
    console.error("[Sentry] Invalid DSN format");
    return;
  }

  const err = error instanceof Error ? error : new Error(String(error));

  const event = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: "error",
    server_name: "supabase-edge",
    environment: Deno.env.get("ENVIRONMENT") || "production",
    tags: {
      function_name: context.functionName,
      runtime: "deno",
    },
    user: context.userId ? { id: context.userId } : undefined,
    extra: {
      correlationId: context.correlationId,
      ...context.extra,
    },
    exception: {
      values: [
        {
          type: err.name,
          value: err.message,
          stacktrace: err.stack
            ? {
                frames: err.stack
                  .split("\n")
                  .filter((line: string) => line.includes("at "))
                  .map((line: string) => ({
                    filename: line.trim(),
                    function: line.trim().split(" ")[1] || "anonymous",
                  }))
                  .reverse(),
              }
            : undefined,
        },
      ],
    },
  };

  try {
    const response = await fetch(parsed.storeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=edge-functions/1.0, sentry_key=${parsed.publicKey}`,
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      console.error(`[Sentry] Failed to send event: ${response.status}`);
    }
  } catch (sendError) {
    console.error("[Sentry] Network error sending event:", sendError);
  }
}

/**
 * Wrap an Edge Function handler with automatic Sentry error capture
 */
export function withSentry(
  functionName: string,
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (error) {
      // Capture to Sentry (non-blocking)
      captureException(error, {
        functionName,
        extra: {
          method: req.method,
          url: req.url,
          headers: Object.fromEntries(req.headers.entries()),
        },
      }).catch(() => {}); // Don't let Sentry errors break the response

      // Re-throw so the function's own error handler catches it
      throw error;
    }
  };
}
