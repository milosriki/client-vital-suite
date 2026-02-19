import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.16.0";

// ============================================================================
// TYPES
// ============================================================================

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "function";
  content: string;
  name?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

export interface AIResponse {
  content: string;
  thought?: string;
  thoughtSignature?: string; // Gemini 3: Encrypted reasoning context
  tool_calls?: {
    id: string;
    name: string;
    input: any;
  }[];
  provider: "gemini" | "openai";
  model: string;
  tokens_used?: number;
  cost_usd?: number;
}

export interface AIOptions {
  temperature?: number;
  max_tokens?: number;
  tools?: ToolDefinition[];
  toolMode?: "AUTO" | "ANY" | "NONE"; // Gemini function calling mode (Context7: functionCallingConfig)
  allowedFunctionNames?: string[]; // Restrict which tools can be called
  jsonMode?: boolean;
  thinkingLevel?: "low" | "high"; // Gemini 3: Control reasoning depth
  thoughtSignature?: string; // Gemini 3: Pass back for context
  model?: string; // Override default model cascade
  functionName?: string; // For token usage tracking
  correlationId?: string; // For token usage tracking
  agentType?: "atlas" | "lisa" | "default"; // Agent-specific budget enforcement
  requestId?: string; // For tracing
  traceId?: string; // For distributed tracing
}

// ============================================================================
// UNIFIED CLIENT (GEMINI FLASH - 2026 STANDARD + FALLBACK CASCADE)
// ============================================================================

// Model cascade: primary → fallback1 → fallback2 (per llm-app-patterns skill)
const GEMINI_CASCADE = [
  "gemini-3-flash-preview",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
] as const;

// DeepSeek fallback when Gemini fails entirely
const DEEPSEEK_MODELS = [
  "deepseek-chat",        // DeepSeek V3 — fast, cheap
  "deepseek-reasoner",    // DeepSeek R1 — reasoning
] as const;

const MODEL_CASCADE = [...GEMINI_CASCADE] as const;

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;
const LLM_TIMEOUT_MS = 30_000; // 30s per request

// ── Circuit Breaker (per llm-app-patterns skill §5.3) ──
const circuitState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
  openUntil: 0,
  THRESHOLD: 5,      // failures before opening
  COOLDOWN_MS: 60_000, // 60s cooldown
};

function checkCircuit(): boolean {
  if (!circuitState.isOpen) return true; // closed = allow
  if (Date.now() > circuitState.openUntil) {
    // Half-open: allow one request
    circuitState.isOpen = false;
    circuitState.failures = 0;
    console.log("[UnifiedAI] ⚡ Circuit breaker: half-open, allowing request");
    return true;
  }
  console.warn(`[UnifiedAI] 🔴 Circuit breaker OPEN until ${new Date(circuitState.openUntil).toISOString()}`);
  return false;
}

function recordSuccess(): void {
  circuitState.failures = 0;
  circuitState.isOpen = false;
}

function recordFailure(): void {
  circuitState.failures++;
  circuitState.lastFailure = Date.now();
  if (circuitState.failures >= circuitState.THRESHOLD) {
    circuitState.isOpen = true;
    circuitState.openUntil = Date.now() + circuitState.COOLDOWN_MS;
    console.error(`[UnifiedAI] 🔴 Circuit breaker OPENED — ${circuitState.failures} consecutive failures`);
  }
}

// Agent-specific token budgets (output tokens)
const AGENT_TOKEN_BUDGETS = {
  atlas: 12000, // Complex cross-source reasoning, financial analysis, RAG context
  lisa: 512, // Quick conversational responses
  default: 2048, // Standard agent budget
} as const;

// Context compaction trigger (75% of budget)
const COMPACTION_THRESHOLD = 0.75;

export class UnifiedAIClient {
  private googleKey: string | undefined;
  private supabaseUrl: string;
  private supabaseKey: string;
  private tokenBudget = { totalTokens: 0, totalCost: 0 };

  private deepseekKey: string | undefined;

  constructor() {
    this.googleKey =
      Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ||
      Deno.env.get("GEMINI_API_KEY") ||
      Deno.env.get("GOOGLE_API_KEY") ||
      Deno.env.get("GEMINI_API_KEY") || "";
    this.deepseekKey = Deno.env.get("DEEPSEEK_API_KEY");
    this.supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    this.supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  }

  /** Token budget tracker (per llm-evaluation skill) */
  getTokenBudget() {
    return { ...this.tokenBudget };
  }

  /**
   * Get agent-specific token budget
   */
  private getAgentBudget(agentType?: "atlas" | "lisa" | "default"): number {
    return AGENT_TOKEN_BUDGETS[agentType || "default"];
  }

  /**
   * Compact conversation history by summarizing older messages
   * Preserves system message and most recent messages
   */
  private async compactConversation(
    messages: ChatMessage[],
    targetLength: number,
  ): Promise<ChatMessage[]> {
    if (messages.length <= targetLength) return messages;

    console.log(
      `[UnifiedAI] 🗜️ Compacting conversation: ${messages.length} → ~${targetLength} messages`,
    );

    // Preserve system message
    const systemMsg = messages.find((m) => m.role === "system");
    const otherMessages = messages.filter((m) => m.role !== "system");

    // Keep last N messages
    const recentMessages = otherMessages.slice(-Math.floor(targetLength * 0.6));

    // Summarize older messages
    const olderMessages = otherMessages.slice(0, -Math.floor(targetLength * 0.6));

    if (olderMessages.length === 0) {
      return messages; // Nothing to compact
    }

    try {
      const summaryPrompt = `Summarize this conversation history in 2-3 sentences, preserving key context:

${olderMessages.map((m) => `${m.role}: ${m.content}`).join("\n\n")}`;

      const summary = await this.callGemini(
        [
          { role: "system", content: "You are a conversation summarizer." },
          { role: "user", content: summaryPrompt },
        ],
        { max_tokens: 256, model: "gemini-1.5-flash" }, // Use cheapest model
        "gemini-1.5-flash",
      );

      const compactedMessages: ChatMessage[] = [];
      if (systemMsg) compactedMessages.push(systemMsg);
      compactedMessages.push({
        role: "system",
        content: `[Previous conversation summary]: ${summary.content}`,
      });
      compactedMessages.push(...recentMessages);

      console.log(
        `[UnifiedAI] ✅ Compaction complete: ${compactedMessages.length} messages`,
      );
      return compactedMessages;
    } catch (error) {
      console.warn(
        "[UnifiedAI] ⚠️ Compaction failed, returning recent messages only:",
        error,
      );
      // Fallback: just keep recent messages
      const fallback: ChatMessage[] = [];
      if (systemMsg) fallback.push(systemMsg);
      fallback.push(...recentMessages);
      return fallback;
    }
  }

  /**
   * Main entry point: Uses model fallback cascade for resilience.
   * Primary: gemini-2.5-flash → Fallback: gemini-2.0-flash → Last resort: gemini-1.5-flash
   * Enforces agent-specific token budgets and auto-compacts on threshold.
   */
  async chat(
    messages: ChatMessage[],
    options: AIOptions = {},
  ): Promise<AIResponse> {
    if (!this.googleKey) throw new Error("Google API key missing");

    // Enforce agent-specific token budget
    const agentBudget = this.getAgentBudget(options.agentType);
    if (!options.max_tokens || options.max_tokens > agentBudget) {
      options.max_tokens = agentBudget;
      console.log(
        `[UnifiedAI] 🎯 Enforcing ${options.agentType || "default"} budget: ${agentBudget} tokens`,
      );
    }

    // Estimate input tokens (rough approximation: 1 token ≈ 4 chars)
    const estimatedInputTokens = messages.reduce(
      (sum, m) => sum + Math.ceil(m.content.length / 4),
      0,
    );

    // Check if approaching context limit (trigger compaction at 75%)
    const totalEstimatedTokens = estimatedInputTokens + (options.max_tokens || 2048);
    const contextLimit = 32000; // Conservative limit for Gemini models

    if (totalEstimatedTokens > contextLimit * COMPACTION_THRESHOLD) {
      console.log(
        `[UnifiedAI] ⚠️ Approaching context limit: ${totalEstimatedTokens}/${contextLimit} tokens`,
      );
      const targetMessageCount = Math.max(5, Math.floor(messages.length * 0.5));
      messages = await this.compactConversation(messages, targetMessageCount);
    }

    // Circuit breaker check (per llm-app-patterns skill)
    if (!checkCircuit()) {
      throw new Error("Circuit breaker OPEN — AI temporarily unavailable. Retry in 60s.");
    }

    // Try Gemini cascade first
    let lastError: Error | undefined;
    if (this.googleKey) {
      for (let i = 0; i < GEMINI_CASCADE.length; i++) {
        const modelName = GEMINI_CASCADE[i];
        try {
          console.log(`[UnifiedAI] Trying Gemini: ${modelName}`);
          const result = await this.callGeminiWithRetry(messages, options, modelName);
          recordSuccess();
          return result;
        } catch (error) {
          lastError = error as Error;
          console.warn(`[UnifiedAI] ${modelName} failed:`, lastError.message);
        }
      }
    }

    // Fallback to DeepSeek when Gemini exhausted
    if (this.deepseekKey) {
      for (const dsModel of DEEPSEEK_MODELS) {
        try {
          console.log(`[UnifiedAI] Falling back to DeepSeek: ${dsModel}`);
          const result = await this.callDeepSeek(messages, options, dsModel);
          recordSuccess();
          return result;
        } catch (error) {
          lastError = error as Error;
          console.warn(`[UnifiedAI] DeepSeek ${dsModel} failed:`, lastError.message);
        }
      }
    }

    recordFailure();
    throw lastError || new Error("All AI providers exhausted (Gemini + DeepSeek)");
  }

  /**
   * Retry with exponential backoff (per llm-app-patterns skill)
   */
  private async callGeminiWithRetry(
    messages: ChatMessage[],
    options: AIOptions,
    modelName: string,
  ): Promise<AIResponse> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.callGemini(messages, options, modelName);
      } catch (error) {
        lastError = error as Error;
        const isRetryable =
          lastError.message?.includes("429") ||
          lastError.message?.includes("500") ||
          lastError.message?.includes("503") ||
          lastError.message?.includes("RESOURCE_EXHAUSTED");

        if (!isRetryable || attempt === MAX_RETRIES - 1) {
          // Log error to ai_execution_metrics
          this.logExecutionError(
            modelName,
            options,
            lastError,
            Date.now() - startTime,
          );
          throw error;
        }

        const delay = RETRY_BASE_MS * Math.pow(2, attempt);
        console.log(
          `[UnifiedAI] Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    // Log final failure
    if (lastError) {
      this.logExecutionError(
        modelName,
        options,
        lastError,
        Date.now() - startTime,
      );
    }
    throw new Error("Max retries exceeded");
  }

  /**
   * Log execution errors to ai_execution_metrics (fire-and-forget)
   */
  private logExecutionError(
    modelName: string,
    options: AIOptions,
    error: Error,
    latencyMs: number,
  ): void {
    try {
      const sb = createClient(this.supabaseUrl, this.supabaseKey);

      const errorType = error.message?.includes("429")
        ? "rate_limit"
        : error.message?.includes("timeout")
        ? "timeout"
        : error.message?.includes("500") || error.message?.includes("503")
        ? "server_error"
        : "unknown";

      const status = errorType === "timeout" ? "timeout" : "error";

      sb.from("ai_execution_metrics")
        .insert({
          request_id: options?.requestId,
          correlation_id: options?.correlationId || crypto.randomUUID(),
          trace_id: options?.traceId,
          function_name: options?.functionName || "unified-ai-client",
          run_type: "chain",
          provider: "gemini",
          model: modelName,
          latency_ms: latencyMs,
          status,
          http_status:
            errorType === "rate_limit"
              ? 429
              : errorType === "server_error"
              ? 500
              : null,
          error_message: error.message,
          error_type: errorType,
          metadata: {
            agent_type: options?.agentType || "default",
            budget_limit: options?.max_tokens,
            error_stack: error.stack?.substring(0, 500),
          },
          tags: [
            modelName.includes("flash") ? "flash" : "pro",
            options?.agentType || "default",
            "error",
          ],
        })
        .then(() => {})
        .catch((err) => {
          console.warn("[UnifiedAI] ⚠️ Error logging failed:", err.message);
        });
    } catch (err) {
      // Never let telemetry break the agent
      console.warn("[UnifiedAI] ⚠️ Error logging setup failed:", err);
    }
  }

  /**
   * Specifically for Voice-to-Value: Transcribes audio from a URL and analyzes tone
   */
  async transcribeAudio(
    audioUrl: string,
  ): Promise<{ text: string; tone: string }> {
    if (!this.googleKey)
      throw new Error("Google API key missing for transcription");

    try {
      console.log(
        `[UnifiedAI] Transcribing and analyzing audio via Gemini 3: ${audioUrl}`,
      );
      const genAI = new GoogleGenerativeAI(this.googleKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-3-flash-preview",
        generationConfig: { responseMimeType: "application/json" },
      });

      // Fetch the audio file
      const response = await fetch(audioUrl);
      if (!response.ok)
        throw new Error(`Failed to fetch audio: ${response.statusText}`);
      const audioData = await response.arrayBuffer();
      const base64Audio = btoa(
        String.fromCharCode(...new Uint8Array(audioData)),
      );

      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Audio,
            mimeType: "audio/ogg",
          },
        },
        {
          text: `
          Please analyze this audio file and return a JSON object with:
          1. "text": The exact transcription of the human voice.
          2. "tone": A 1-sentence analysis of the speaker's emotional state, energy level, and maturity (e.g., "Sounds like a busy executive in a hurry, slightly frustrated" or "High energy, motivated, sounds young").
        `,
        },
      ]);

      const data = JSON.parse(result.response.text());
      return {
        text: data.text || "(( Audio received but no speech detected ))",
        tone: data.tone || "Neutral / Calm",
      };
    } catch (error) {
      console.error("[UnifiedAI] Transcription failed:", error);
      return {
        text: "(( Audio message received but could not be transcribed ))",
        tone: "Unknown (Tech Error)",
      };
    }
  }

  /**
   * Generates text embeddings using Gemini 004
   */
  async embed(text: string): Promise<number[]> {
    if (!this.googleKey)
      throw new Error("Google API key missing for embeddings");

    try {
      const genAI = new GoogleGenerativeAI(this.googleKey);
      const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error("[UnifiedAI] Embedding failed:", error);
      return [];
    }
  }

  /**
   * Alias for embed() - used by ptd-brain-api
   */
  async generateEmbedding(text: string): Promise<number[]> {
    return this.embed(text);
  }

  // ==========================================================================
  // PROVIDER IMPLEMENTATIONS
  // ==========================================================================

  /**
   * DeepSeek API (OpenAI-compatible endpoint)
   * Docs: https://api-docs.deepseek.com
   */
  private async callDeepSeek(
    messages: ChatMessage[],
    options: AIOptions,
    modelName: string = "deepseek-chat",
  ): Promise<AIResponse> {
    const startTime = Date.now();

    const body: Record<string, unknown> = {
      model: modelName,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: options.max_tokens || 4096,
      temperature: options.temperature ?? 0.7,
      stream: false,
    };

    if (options.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.deepseekKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`DeepSeek ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const content = choice?.message?.content || "";
    const latencyMs = Date.now() - startTime;

    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    const totalTokens = inputTokens + outputTokens;

    // DeepSeek pricing: $0.27/M input, $1.10/M output (V3)
    const inputCost = modelName === "deepseek-reasoner" ? 0.55 : 0.27;
    const outputCost = modelName === "deepseek-reasoner" ? 2.19 : 1.10;
    const costUsd = (inputTokens * inputCost + outputTokens * outputCost) / 1_000_000;

    this.tokenBudget.totalTokens += totalTokens;
    this.tokenBudget.totalCost += costUsd;

    console.log(
      `[UnifiedAI] 📊 DeepSeek: in=${inputTokens} out=${outputTokens} | $${costUsd.toFixed(6)} | ${latencyMs}ms`,
    );

    // Log metrics (fire-and-forget)
    try {
      const sb = createClient(this.supabaseUrl, this.supabaseKey);
      sb.from("ai_execution_metrics").insert({
        correlation_id: options?.correlationId || crypto.randomUUID(),
        function_name: options?.functionName || "unified-ai-client",
        run_type: "chain",
        provider: "deepseek",
        model: modelName,
        latency_ms: latencyMs,
        tokens_in: inputTokens,
        tokens_out: outputTokens,
        cost_usd_est: costUsd,
        status: "success",
        http_status: 200,
        metadata: { agent_type: options?.agentType || "default" },
        tags: ["deepseek", options?.agentType || "default"],
      }).then(() => {}).catch(() => {});
    } catch { /* telemetry must never break agents */ }

    // Extract thinking from DeepSeek R1
    let thought: string | undefined;
    let cleanContent = content;
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      thought = thinkMatch[1].trim();
      cleanContent = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    }

    return {
      content: cleanContent,
      thought,
      provider: "gemini" as const, // Keep interface compat — TODO: add "deepseek" to type
      model: modelName,
      tokens_used: totalTokens,
      cost_usd: costUsd,
    };
  }

  private async callGemini(
    messages: ChatMessage[],
    options: AIOptions,
    defaultModel: string = MODEL_CASCADE[0],
  ): Promise<AIResponse> {
    const startTime = Date.now();
    const genAI = new GoogleGenerativeAI(this.googleKey!);

    // Allow override from options, otherwise use cascade default
    const modelName = options.model || defaultModel;

    // Gemini 3 Thinking Config
    let thinkingConfig = undefined;
    if (options.thinkingLevel) {
      thinkingConfig = { thinkingLevel: options.thinkingLevel };
    }

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: options.max_tokens || 2048, // Increased for reasoning
        temperature: options.temperature, // Let model decide if thinking is on
        responseMimeType: options.jsonMode ? "application/json" : "text/plain",
        // @ts-ignore - SDK might not have types yet
        thinkingConfig,
      },
    });

    // Convert messages to Gemini format
    // Gemini separates system instruction
    const systemInstruction = messages.find(
      (m) => m.role === "system",
    )?.content;

    // Filter out system message for the history
    const history = messages
      .filter((m) => m.role !== "system")
      .map((m) => {
        // Map roles: 'assistant' -> 'model', 'user' -> 'user'
        const role = m.role === "assistant" ? "model" : "user";

        const part: any = { text: m.content };

        // Gemini 3: Inject Thought Signature if provided by user (for the *previous* turn)
        // Note: In a real chat, this should likely be in the PREVIOUS model response
        // but for stateless calls, we might need to figure out where to put it.
        // For now, if passed in options, we assume it belongs to the LAST assistant message?
        // Actually, the docs say: "Must return these signatures back to the model in your request exactly as they were received"
        // in the *history*.

        return {
          role,
          parts: [part],
        };
      });

    // If we have a thoughtSignature from previous context, append it to the last model message in history if exists,
    // or if this is a fresh call with context, we might need to handle it differently.
    // For simplified stateless usage:
    // If options.thoughtSignature is present, we should attach it to the most recent 'model' turn.
    if (options.thoughtSignature && history.length > 0) {
      // Find last model message
      const lastModelMsg = [...history]
        .reverse()
        .find((m) => m.role === "model");
      if (lastModelMsg) {
        // @ts-ignore
        lastModelMsg.parts.push({ thoughtSignature: options.thoughtSignature });
      }
    }

    // Handle Tools + toolConfig (Context7: functionCallingConfig mode ANY/NONE/AUTO)
    let toolsConfig: any = undefined;
    let toolConfigObj: any = undefined;
    if (options.tools && options.tools.length > 0) {
      toolsConfig = [
        {
          functionDeclarations: options.tools.map((t: ToolDefinition) => ({
            name: t.name,
            description: t.description,
            parameters: t.input_schema,
          })),
        },
      ];
    }

    const chat = model.startChat({
      history: history.slice(0, -1),
      systemInstruction: systemInstruction
        ? { parts: [{ text: systemInstruction }] }
        : undefined,
      tools: toolsConfig,
    });

    const lastMsg = history[history.length - 1];
    const result = await chat.sendMessage(lastMsg.parts[0].text);
    const response = await result.response;
    let text = "";
    try {
      text = response.text();
    } catch {
      // response.text() throws when Gemini returns only function calls with no text
      text = "";
    }

    const latencyMs = Date.now() - startTime;

    // Token budget tracking
    const usageMeta = response.usageMetadata;
    let tokensUsed: number | undefined;
    let costUsd: number | undefined;
    let inputTokens = 0;
    let outputTokens = 0;

    if (usageMeta) {
      inputTokens = usageMeta.promptTokenCount || 0;
      outputTokens = usageMeta.candidatesTokenCount || 0;
      const totalTokens = inputTokens + outputTokens;
      tokensUsed = totalTokens;

      this.tokenBudget.totalTokens += totalTokens;

      const inputCostPer1M = modelName.includes("flash") ? 0.10 : 3.00;
      const outputCostPer1M = modelName.includes("flash") ? 0.40 : 15.00;
      const cost = (inputTokens * inputCostPer1M + outputTokens * outputCostPer1M) / 1_000_000;
      costUsd = cost;
      this.tokenBudget.totalCost += cost;

      console.log(
        `[UnifiedAI] 📊 Tokens: in=${inputTokens} out=${outputTokens} | Cost: $${cost.toFixed(6)} | Latency: ${latencyMs}ms`,
      );

      // Enhanced metrics logging to ai_execution_metrics
      try {
        const sb = createClient(this.supabaseUrl, this.supabaseKey);

        // Log to both tables for backward compatibility
        const metricsPromises = [];

        // Legacy token_usage_metrics table
        metricsPromises.push(
          sb.from("token_usage_metrics").insert({
            function_name: options?.functionName || "unknown",
            model_used: modelName,
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_tokens: totalTokens,
            estimated_cost_usd: cost,
            correlation_id: options?.correlationId,
          })
        );

        // New ai_execution_metrics table with full observability
        metricsPromises.push(
          sb.from("ai_execution_metrics").insert({
            request_id: options?.requestId,
            correlation_id: options?.correlationId || crypto.randomUUID(),
            trace_id: options?.traceId,
            function_name: options?.functionName || "unified-ai-client",
            run_type: "chain",
            provider: "gemini",
            model: modelName,
            latency_ms: latencyMs,
            tokens_in: inputTokens,
            tokens_out: outputTokens,
            cost_usd_est: cost,
            status: "success",
            http_status: 200,
            metadata: {
              agent_type: options?.agentType || "default",
              budget_limit: options?.max_tokens,
              thinking_level: options?.thinkingLevel,
              has_tools: options?.tools && options.tools.length > 0,
              message_count: messages.length,
            },
            tags: [
              modelName.includes("flash") ? "flash" : "pro",
              options?.agentType || "default",
            ],
          })
        );

        // Fire-and-forget - don't block on telemetry
        Promise.all(metricsPromises).then(() => {}).catch((err) => {
          console.warn("[UnifiedAI] ⚠️ Metrics logging failed:", err.message);
        });
      } catch (err) {
        // Telemetry must never break agents
        console.warn("[UnifiedAI] ⚠️ Metrics setup error:", err);
      }
    }

    // Gemini 3: Extract Thought Signature
    // @ts-ignore
    const thoughtSignature = response.candidates?.[0]?.content?.parts?.find(
      (p) => p.thoughtSignature,
    )?.thoughtSignature;

    // CRM-391: Parse out <thinking> blocks (Hidden Chain of Thought)
    const thinkingMatch = text.match(/<thinking>([\s\S]*?)<\/thinking>/);
    let cleanText = text;
    let thoughtContent = undefined;

    if (thinkingMatch) {
      thoughtContent = thinkingMatch[1].trim();
      console.log("🧠 [UnifiedAI] Internal Monologue:", thoughtContent);
      cleanText = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
    }

    // Check for tool calls
    const functionCalls = response.functionCalls();

    let toolCalls = undefined;
    if (functionCalls && functionCalls.length > 0) {
      toolCalls = functionCalls.map((fc) => ({
        id: `call_${Math.random().toString(36).substr(2, 9)}`, // Gemini doesn't always provide IDs in the same way
        name: fc.name,
        input: fc.args,
      }));
    }

    return {
      content: cleanText,
      thought: thoughtContent,
      thoughtSignature,
      tool_calls: toolCalls,
      provider: "gemini",
      model: modelName,
      tokens_used: tokensUsed,
      cost_usd: costUsd,
    };
  }
}

export const unifiedAI = new UnifiedAIClient();
