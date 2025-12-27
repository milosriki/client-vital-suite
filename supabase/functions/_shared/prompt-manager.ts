// Centralized Prompt Management Utility
// Provides versioned prompt pulling from LangSmith with fallbacks and telemetry

import { getLangSmithConfig, isTracingEnabled } from "./langsmith-tracing.ts";

interface PromptVersion {
  name: string;
  version: string | null;
  template: string;
  source: "langsmith" | "fallback";
  fetchedAt: string;
  metadata?: Record<string, unknown>;
}

interface PromptTelemetry {
  promptName: string;
  source: "langsmith" | "fallback";
  fetchDurationMs: number;
  success: boolean;
  error?: string;
  timestamp: string;
}

interface PromptManagerConfig {
  cacheEnabled?: boolean;
  cacheTtlMs?: number;
  timeoutMs?: number;
  telemetryEnabled?: boolean;
}

// In-memory cache for prompts
const promptCache = new Map<string, { prompt: PromptVersion; expiresAt: number }>();

// Telemetry buffer for batch reporting
const telemetryBuffer: PromptTelemetry[] = [];

// Default configuration
const DEFAULT_CONFIG: Required<PromptManagerConfig> = {
  cacheEnabled: true,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  timeoutMs: 5000,
  telemetryEnabled: true,
};

// Static fallback prompts for each agent
const FALLBACK_PROMPTS: Record<string, string> = {
  // Stripe Enterprise Intelligence prompt
  "stripe-enterprise": `You are ATLAS, the Enterprise Financial Intelligence System for PTD Fitness - a multi-million dollar Dubai-based premium fitness business.

=== CRITICAL ANTI-HALLUCINATION PROTOCOL ===
YOU ARE FORBIDDEN FROM:
- Inventing numbers not in the data
- Calculating fees using percentages (like "2.9% + 30 cents")
- Estimating or guessing any values
- Providing generic advice without data backing

YOU MUST:
- ONLY report values explicitly present in the context
- Use the "fee" field from balance_transactions for actual fees
- Say "This data is not available" if information is missing
- Cite the source for every number: (from: field_name)

=== YOUR ROLE ===
Provide enterprise-grade financial analysis. Every number you report MUST come from the data with source citation.`,

  // PTD Booking prompt
  "ptdbooking": `You are the PTD Fitness AI Assistant, helping with booking and scheduling operations.

Your responsibilities:
- Help users understand their booking status
- Provide information about available sessions
- Assist with scheduling and rescheduling
- Answer questions about packages and services

Always be helpful, professional, and accurate with the data provided.`,

  // Stripe Forensics prompt
  "stripe-forensics": `You are a Stripe Forensics Analyst for PTD Fitness Dubai.

Your role is to:
- Analyze financial transactions for anomalies
- Detect potential fraud patterns
- Identify unusual payout behaviors
- Monitor card usage patterns
- Track refund rates and dispute trends

CRITICAL RULES:
- Only report findings based on actual data
- Never speculate without evidence
- Flag high-risk patterns immediately
- Provide actionable recommendations`,

  // Stripe Payouts AI prompt
  "stripe-payouts-ai": `You are a Stripe Payouts Intelligence Agent for PTD Fitness Dubai.

Your responsibilities:
- Analyze payout schedules and timing
- Track balance transactions and fees
- Monitor transfer statuses
- Identify payout anomalies
- Help trace payment flows

ANTI-HALLUCINATION RULES:
- Only use data from the provided context
- Never calculate fees - use actual fee values from data
- Cite sources for all numbers
- Say "not in data" if information is missing`,

  // Stripe Deep Agent prompt
  "stripe-deep-agent": `You are a Deep Analysis Agent for Stripe data at PTD Fitness Dubai.

Your capabilities:
- Comprehensive token discovery
- Payment method analysis
- Customer behavior patterns
- Risk assessment
- Anomaly detection

Always provide thorough analysis based on actual data.`,

  // Default fallback
  "default": `You are an AI assistant for PTD Fitness Dubai.

Provide helpful, accurate responses based on the data provided.
Never make up information - only use what's in the context.
If data is missing, clearly state that it's not available.`,
};

// Pull prompt from LangSmith Hub
export async function pullPrompt(
  promptName: string,
  config: PromptManagerConfig = {}
): Promise<PromptVersion> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const langsmithConfig = getLangSmithConfig();

  // Check cache first
  if (mergedConfig.cacheEnabled) {
    const cached = promptCache.get(promptName);
    if (cached && cached.expiresAt > Date.now()) {
      logTelemetry({
        promptName,
        source: cached.prompt.source,
        fetchDurationMs: 0,
        success: true,
        timestamp: new Date().toISOString(),
      }, mergedConfig.telemetryEnabled);
      return cached.prompt;
    }
  }

  // Try LangSmith if configured
  if (langsmithConfig.apiKey && isTracingEnabled()) {
    try {
      const response = await fetch(
        `${langsmithConfig.endpoint}/prompts/${promptName}/current`,
        {
          method: "GET",
          headers: {
            "x-api-key": langsmithConfig.apiKey,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(mergedConfig.timeoutMs),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const template = extractTemplate(data);
        
        if (template) {
          const prompt: PromptVersion = {
            name: promptName,
            version: data.version || data.commit_hash || null,
            template,
            source: "langsmith",
            fetchedAt: new Date().toISOString(),
            metadata: {
              repo: data.repo_name,
              owner: data.owner,
            },
          };

          // Cache the prompt
          if (mergedConfig.cacheEnabled) {
            promptCache.set(promptName, {
              prompt,
              expiresAt: Date.now() + mergedConfig.cacheTtlMs,
            });
          }

          logTelemetry({
            promptName,
            source: "langsmith",
            fetchDurationMs: Date.now() - startTime,
            success: true,
            timestamp: new Date().toISOString(),
          }, mergedConfig.telemetryEnabled);

          console.log(`[PromptManager] Pulled prompt from LangSmith: ${promptName}`);
          return prompt;
        }
      }

      // LangSmith returned non-OK or no template
      console.log(`[PromptManager] LangSmith prompt not found: ${promptName}, using fallback`);
    } catch (error) {
      console.log(`[PromptManager] LangSmith error for ${promptName}: ${error instanceof Error ? error.message : "Unknown"}`);
      
      logTelemetry({
        promptName,
        source: "fallback",
        fetchDurationMs: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }, mergedConfig.telemetryEnabled);
    }
  }

  // Use fallback prompt
  const fallbackTemplate = FALLBACK_PROMPTS[promptName] || FALLBACK_PROMPTS["default"];
  const fallbackPrompt: PromptVersion = {
    name: promptName,
    version: null,
    template: fallbackTemplate,
    source: "fallback",
    fetchedAt: new Date().toISOString(),
  };

  // Cache fallback too (shorter TTL)
  if (mergedConfig.cacheEnabled) {
    promptCache.set(promptName, {
      prompt: fallbackPrompt,
      expiresAt: Date.now() + (mergedConfig.cacheTtlMs / 2),
    });
  }

  logTelemetry({
    promptName,
    source: "fallback",
    fetchDurationMs: Date.now() - startTime,
    success: true,
    timestamp: new Date().toISOString(),
  }, mergedConfig.telemetryEnabled);

  console.log(`[PromptManager] Using fallback prompt: ${promptName}`);
  return fallbackPrompt;
}

// Pull multiple prompts in parallel
export async function pullPrompts(
  promptNames: string[],
  config: PromptManagerConfig = {}
): Promise<Map<string, PromptVersion>> {
  const results = await Promise.all(
    promptNames.map(name => pullPrompt(name, config))
  );

  const promptMap = new Map<string, PromptVersion>();
  promptNames.forEach((name, index) => {
    promptMap.set(name, results[index]);
  });

  return promptMap;
}

// Interpolate variables into a prompt template
export function interpolatePrompt(
  template: string,
  variables: Record<string, string | number | boolean>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    // Support both {key} and {{key}} syntax
    result = result.replace(new RegExp(`\\{\\{?${key}\\}\\}?`, "g"), String(value));
  }
  
  return result;
}

// Build a complete prompt with context data
export async function buildPromptWithContext(
  promptName: string,
  contextData: Record<string, string | number | boolean>,
  config: PromptManagerConfig = {}
): Promise<{ prompt: string; version: PromptVersion }> {
  const version = await pullPrompt(promptName, config);
  const prompt = interpolatePrompt(version.template, contextData);
  
  return { prompt, version };
}

// Clear the prompt cache
export function clearPromptCache(): void {
  promptCache.clear();
  console.log("[PromptManager] Cache cleared");
}

// Get cache statistics
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: promptCache.size,
    entries: Array.from(promptCache.keys()),
  };
}

// Get telemetry data
export function getTelemetry(): PromptTelemetry[] {
  return [...telemetryBuffer];
}

// Clear telemetry buffer
export function clearTelemetry(): void {
  telemetryBuffer.length = 0;
}

// Register a custom fallback prompt
export function registerFallbackPrompt(name: string, template: string): void {
  FALLBACK_PROMPTS[name] = template;
  console.log(`[PromptManager] Registered fallback prompt: ${name}`);
}

// Check if a prompt exists in LangSmith
export async function promptExists(promptName: string): Promise<boolean> {
  const langsmithConfig = getLangSmithConfig();
  
  if (!langsmithConfig.apiKey) {
    return false;
  }

  try {
    const response = await fetch(
      `${langsmithConfig.endpoint}/prompts/${promptName}`,
      {
        method: "HEAD",
        headers: {
          "x-api-key": langsmithConfig.apiKey,
        },
        signal: AbortSignal.timeout(3000),
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

// Helper function to extract template from LangSmith response
function extractTemplate(data: Record<string, unknown>): string | null {
  // Try different possible locations for the template
  if (typeof data.manifest === "object" && data.manifest !== null) {
    const manifest = data.manifest as Record<string, unknown>;
    if (typeof manifest.template === "string") {
      return manifest.template;
    }
  }
  
  if (typeof data.template === "string") {
    return data.template;
  }
  
  if (typeof data.prompt === "string") {
    return data.prompt;
  }
  
  // Try to extract from messages array (chat prompts)
  if (Array.isArray(data.messages)) {
    const systemMessage = data.messages.find(
      (m: unknown) => typeof m === "object" && m !== null && (m as Record<string, unknown>).role === "system"
    );
    if (systemMessage && typeof (systemMessage as Record<string, unknown>).content === "string") {
      return (systemMessage as Record<string, unknown>).content as string;
    }
  }
  
  return null;
}

// Helper function to log telemetry
function logTelemetry(entry: PromptTelemetry, enabled: boolean): void {
  if (!enabled) return;
  
  telemetryBuffer.push(entry);
  
  // Keep buffer size manageable
  if (telemetryBuffer.length > 100) {
    telemetryBuffer.shift();
  }
}

// Export types
export type { PromptVersion, PromptTelemetry, PromptManagerConfig };
