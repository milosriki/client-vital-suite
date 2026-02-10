import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
// AI Configuration Status Endpoint
// Verifies the status of LangSmith, provider keys, and Stripe connectivity
// Enables operators to quickly check configuration before running forensic or agent tasks

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkLangSmithStatus, getLangSmithConfig, isTracingEnabled } from "../_shared/langsmith-tracing.ts";
import { getCacheStats, getTelemetry } from "../_shared/prompt-manager.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProviderStatus {
  name: string;
  configured: boolean;
  connected: boolean;
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface ConfigStatus {
  timestamp: string;
  overall: "healthy" | "degraded" | "error";
  langsmith: {
    configured: boolean;
    connected: boolean;
    tracingEnabled: boolean;
    projectName: string | null;
    endpoint: string;
    error?: string;
  };
  providers: {
    gemini: ProviderStatus;
    anthropic: ProviderStatus;
    openai: ProviderStatus;
  };
  stripe: ProviderStatus;
  supabase: ProviderStatus;
  promptCache: {
    size: number;
    entries: string[];
  };
  telemetry: {
    recentEntries: number;
    lastEntry?: unknown;
  };
}

// Check Gemini API connectivity
async function checkGeminiStatus(): Promise<ProviderStatus> {
  const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
  
  if (!apiKey) {
    return {
      name: "Gemini",
      configured: false,
      connected: false,
      error: "GEMINI_API_KEY or GOOGLE_API_KEY not configured",
    };
  }

  const startTime = Date.now();
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(5000),
      }
    );

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      return {
        name: "Gemini",
        configured: true,
        connected: true,
        latencyMs,
        details: {
          modelsAvailable: data.models?.length || 0,
        },
      };
    } else {
      return {
        name: "Gemini",
        configured: true,
        connected: false,
        latencyMs,
        error: `API returned ${response.status}`,
      };
    }
  } catch (error: unknown) {
    return {
      name: "Gemini",
      configured: true,
      connected: false,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

// Check Anthropic API connectivity
async function checkAnthropicStatus(): Promise<ProviderStatus> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  
  if (!apiKey) {
    return {
      name: "Anthropic",
      configured: false,
      connected: false,
      error: "ANTHROPIC_API_KEY not configured",
    };
  }

  const startTime = Date.now();
  try {
    // Use a minimal request to check connectivity
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-4-5-sonnet",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
      signal: AbortSignal.timeout(10000),
    });

    const latencyMs = Date.now() - startTime;

    // Even a 400 error means the API is reachable and key is valid format
    if (response.ok || response.status === 400) {
      return {
        name: "Anthropic",
        configured: true,
        connected: true,
        latencyMs,
        details: {
          status: response.status,
        },
      };
    } else if (response.status === 401) {
      return {
        name: "Anthropic",
        configured: true,
        connected: false,
        latencyMs,
        error: "Invalid API key",
      };
    } else {
      return {
        name: "Anthropic",
        configured: true,
        connected: false,
        latencyMs,
        error: `API returned ${response.status}`,
      };
    }
  } catch (error: unknown) {
    return {
      name: "Anthropic",
      configured: true,
      connected: false,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

// Check OpenAI API connectivity
async function checkOpenAIStatus(): Promise<ProviderStatus> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  
  if (!apiKey) {
    return {
      name: "OpenAI",
      configured: false,
      connected: false,
      error: "OPENAI_API_KEY not configured",
    };
  }

  const startTime = Date.now();
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      return {
        name: "OpenAI",
        configured: true,
        connected: true,
        latencyMs,
        details: {
          modelsAvailable: data.data?.length || 0,
        },
      };
    } else if (response.status === 401) {
      return {
        name: "OpenAI",
        configured: true,
        connected: false,
        latencyMs,
        error: "Invalid API key",
      };
    } else {
      return {
        name: "OpenAI",
        configured: true,
        connected: false,
        latencyMs,
        error: `API returned ${response.status}`,
      };
    }
  } catch (error: unknown) {
    return {
      name: "OpenAI",
      configured: true,
      connected: false,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

// Check Stripe API connectivity
async function checkStripeStatus(): Promise<ProviderStatus> {
  const apiKey = Deno.env.get("STRIPE_SECRET_KEY");
  
  if (!apiKey) {
    return {
      name: "Stripe",
      configured: false,
      connected: false,
      error: "STRIPE_SECRET_KEY not configured",
    };
  }

  const startTime = Date.now();
  try {
    const response = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      return {
        name: "Stripe",
        configured: true,
        connected: true,
        latencyMs,
        details: {
          available: data.available?.map((b: { amount: number; currency: string }) => ({
            amount: b.amount / 100,
            currency: b.currency.toUpperCase(),
          })),
          pending: data.pending?.map((b: { amount: number; currency: string }) => ({
            amount: b.amount / 100,
            currency: b.currency.toUpperCase(),
          })),
        },
      };
    } else if (response.status === 401) {
      return {
        name: "Stripe",
        configured: true,
        connected: false,
        latencyMs,
        error: "Invalid API key",
      };
    } else {
      return {
        name: "Stripe",
        configured: true,
        connected: false,
        latencyMs,
        error: `API returned ${response.status}`,
      };
    }
  } catch (error: unknown) {
    return {
      name: "Stripe",
      configured: true,
      connected: false,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

// Check Supabase connectivity
async function checkSupabaseStatus(): Promise<ProviderStatus> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!url || !key) {
    return {
      name: "Supabase",
      configured: false,
      connected: false,
      error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured",
    };
  }

  const startTime = Date.now();
  try {
    const supabase = createClient(url, key);
    const { error } = await supabase.from("contacts").select("id").limit(1);

    const latencyMs = Date.now() - startTime;

    if (!error) {
      return {
        name: "Supabase",
        configured: true,
        connected: true,
        latencyMs,
      };
    } else {
      return {
        name: "Supabase",
        configured: true,
        connected: false,
        latencyMs,
        error: error.message,
      };
    }
  } catch (error: unknown) {
    return {
      name: "Supabase",
      configured: true,
      connected: false,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

// Determine overall health status
function determineOverallStatus(status: ConfigStatus): "healthy" | "degraded" | "error" {
  const criticalServices = [status.supabase, status.stripe];
  const aiProviders = [status.providers.gemini, status.providers.anthropic, status.providers.openai];
  
  // Check if critical services are down
  const criticalDown = criticalServices.some(s => s.configured && !s.connected);
  if (criticalDown) {
    return "error";
  }
  
  // Check if at least one AI provider is available
  const anyAiConnected = aiProviders.some(p => p.connected);
  if (!anyAiConnected) {
    return "error";
  }
  
  // Check for degraded state (some services down but not critical)
  const anyDegraded = 
    (status.langsmith.configured && !status.langsmith.connected) ||
    aiProviders.some(p => p.configured && !p.connected);
  
  if (anyDegraded) {
    return "degraded";
  }
  
  return "healthy";
}

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    const { verbose = false } = await req.json().catch(() => ({}));

    console.log("[ai-config-status] Checking configuration status...");

    // Run all checks in parallel
    const [
      langsmithStatus,
      geminiStatus,
      anthropicStatus,
      openaiStatus,
      stripeStatus,
      supabaseStatus,
    ] = await Promise.all([
      checkLangSmithStatus(),
      checkGeminiStatus(),
      checkAnthropicStatus(),
      checkOpenAIStatus(),
      checkStripeStatus(),
      checkSupabaseStatus(),
    ]);

    const langsmithConfig = getLangSmithConfig();
    const cacheStats = getCacheStats();
    const telemetry = getTelemetry();

    const status: ConfigStatus = {
      timestamp: new Date().toISOString(),
      overall: "healthy", // Will be updated below
      langsmith: {
        configured: langsmithStatus.configured,
        connected: langsmithStatus.connected,
        tracingEnabled: isTracingEnabled(),
        projectName: langsmithConfig.projectName,
        endpoint: langsmithConfig.endpoint,
        error: langsmithStatus.error,
      },
      providers: {
        gemini: geminiStatus,
        anthropic: anthropicStatus,
        openai: openaiStatus,
      },
      stripe: stripeStatus,
      supabase: supabaseStatus,
      promptCache: cacheStats,
      telemetry: {
        recentEntries: telemetry.length,
        lastEntry: verbose && telemetry.length > 0 ? telemetry[telemetry.length - 1] : undefined,
      },
    };

    // Determine overall status
    status.overall = determineOverallStatus(status);

    console.log(`[ai-config-status] Status: ${status.overall}`);

    // Return appropriate HTTP status code
    const httpStatus = status.overall === "healthy" ? 200 : status.overall === "degraded" ? 200 : 503;

    return apiSuccess(status, null, 2);

  } catch (error: unknown) {
    console.error("[ai-config-status] Error:", error);
    
    return apiError("INTERNAL_ERROR", JSON.stringify({
        timestamp: new Date().toISOString(),
        overall: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      }), 500);
  }
});
