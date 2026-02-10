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
  provider: "gemini" | "anthropic" | "openai";
  model: string;
}

export interface AIOptions {
  temperature?: number;
  max_tokens?: number;
  tools?: ToolDefinition[];
  jsonMode?: boolean;
  thinkingLevel?: "low" | "high"; // Gemini 3: Control reasoning depth
  thoughtSignature?: string; // Gemini 3: Pass back for context
  model?: string; // Override default model cascade
}

// ============================================================================
// UNIFIED CLIENT (GEMINI FLASH - 2026 STANDARD + FALLBACK CASCADE)
// ============================================================================

// Model cascade: primary → fallback1 → fallback2 (per llm-app-patterns skill)
const MODEL_CASCADE = [
  "gemini-3-pro-preview", // Primary: High Reasoning
  "gemini-3-flash-preview", // Secondary: Low Latency
  "gemini-2.0-flash",
  "gemini-1.5-flash",
] as const;

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

export class UnifiedAIClient {
  private googleKey: string | undefined;
  private supabaseUrl: string;
  private supabaseKey: string;
  private tokenBudget = { totalTokens: 0, totalCost: 0 };

  constructor() {
    this.googleKey =
      Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ||
      Deno.env.get("GEMINI_API_KEY") ||
      Deno.env.get("GOOGLE_API_KEY");
    this.supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    this.supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  }

  /** Token budget tracker (per llm-evaluation skill) */
  getTokenBudget() {
    return { ...this.tokenBudget };
  }

  /**
   * Main entry point: Uses model fallback cascade for resilience.
   * Primary: gemini-2.5-flash → Fallback: gemini-2.0-flash → Last resort: gemini-1.5-flash
   */
  async chat(
    messages: ChatMessage[],
    options: AIOptions = {},
  ): Promise<AIResponse> {
    if (!this.googleKey) throw new Error("Google API key missing");

    // Try each model in the cascade
    for (let i = 0; i < MODEL_CASCADE.length; i++) {
      const modelName = MODEL_CASCADE[i];
      try {
        console.log(`[UnifiedAI] Trying model: ${modelName}`);
        return await this.callGeminiWithRetry(messages, options, modelName);
      } catch (error) {
        console.warn(
          `[UnifiedAI] Model ${modelName} failed:`,
          (error as Error).message,
        );
        if (i === MODEL_CASCADE.length - 1) {
          console.error("[UnifiedAI] ❌ All models exhausted");
          throw error;
        }
        console.log(`[UnifiedAI] Falling back to ${MODEL_CASCADE[i + 1]}...`);
      }
    }

    throw new Error("All models in cascade failed");
  }

  /**
   * Retry with exponential backoff (per llm-app-patterns skill)
   */
  private async callGeminiWithRetry(
    messages: ChatMessage[],
    options: AIOptions,
    modelName: string,
  ): Promise<AIResponse> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.callGemini(messages, options, modelName);
      } catch (error) {
        const isRetryable =
          (error as Error).message?.includes("429") ||
          (error as Error).message?.includes("500") ||
          (error as Error).message?.includes("503") ||
          (error as Error).message?.includes("RESOURCE_EXHAUSTED");

        if (!isRetryable || attempt === MAX_RETRIES - 1) throw error;

        const delay = RETRY_BASE_MS * Math.pow(2, attempt);
        console.log(
          `[UnifiedAI] Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error("Max retries exceeded");
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

  private async callGemini(
    messages: ChatMessage[],
    options: AIOptions,
    defaultModel: string = MODEL_CASCADE[0],
  ): Promise<AIResponse> {
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

    // Handle Tools
    let toolsConfig: any = undefined;
    if (options.tools && options.tools.length > 0) {
      toolsConfig = [
        {
          functionDeclarations: options.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.input_schema,
          })),
        },
      ];
    }

    const chat = model.startChat({
      history: history.slice(0, -1), // All but last message as history
      systemInstruction: systemInstruction
        ? { parts: [{ text: systemInstruction }] }
        : undefined,
      tools: toolsConfig,
    });

    const lastMsg = history[history.length - 1];
    const result = await chat.sendMessage(lastMsg.parts[0].text);
    const response = await result.response;
    const text = response.text();

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
    };
  }
}

export const unifiedAI = new UnifiedAIClient();
