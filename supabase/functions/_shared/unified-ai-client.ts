
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.26.0";

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
  tool_calls?: {
    id: string;
    name: string;
    input: any;
  }[];
  provider: "anthropic" | "openai";
  model: string;
}

export interface AIOptions {
  temperature?: number;
  max_tokens?: number;
  tools?: ToolDefinition[];
  jsonMode?: boolean;
}

// ============================================================================
// UNIFIED CLIENT
// ============================================================================

export class UnifiedAIClient {
  private anthropicKey: string | undefined;
  private openaiKey: string | undefined;
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor() {
    this.anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    this.openaiKey = Deno.env.get("OPENAI_API_KEY");
    this.supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    this.supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  }

  /**
   * Main entry point: Tries Claude first, falls back to OpenAI
   */
  async chat(
    messages: ChatMessage[],
    options: AIOptions = {}
  ): Promise<AIResponse> {
    const systemMessage = messages.find(m => m.role === "system");
    const conversationMessages = messages.filter(m => m.role !== "system");

    // 1. Try OpenAI (Preferred as per user request)
    if (this.openaiKey) {
      try {
        console.log("[UnifiedAI] Attempting OpenAI (Primary)...");
        return await this.callOpenAI(messages, options);
      } catch (error) {
        console.warn("[UnifiedAI] OpenAI failed, attempting fallback:", error);
        // Fall through to Claude
      }
    } else {
      console.log("[UnifiedAI] No OpenAI key, skipping to Claude...");
    }

    // 2. Try Claude (Fallback)
    if (this.anthropicKey) {
      try {
        console.log("[UnifiedAI] Attempting Claude (Fallback)...");
        return await this.callClaude(conversationMessages, systemMessage?.content, options);
      } catch (error) {
        console.error("[UnifiedAI] Claude failed:", error);
        throw new Error("All AI providers failed. Please check API keys/credits.");
      }
    }

    throw new Error("No valid AI API keys configured (OPENAI_API_KEY or ANTHROPIC_API_KEY).");
  }

  // ==========================================================================
  // PROVIDER IMPLEMENTATIONS
  // ==========================================================================

  private async callClaude(
    messages: ChatMessage[],
    systemPrompt: string | undefined,
    options: AIOptions
  ): Promise<AIResponse> {
    const anthropic = new Anthropic({ apiKey: this.anthropicKey! });

    // Convert tools to Anthropic format
    const anthropicTools = options.tools?.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema
    }));

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: options.max_tokens || 4096,
      temperature: options.temperature || 0.7,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content
      })),
      tools: anthropicTools,
    });

    const textContent = response.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");

    const toolCalls = response.content
      .filter(b => b.type === "tool_use")
      .map(b => ({
        id: b.id,
        name: b.name,
        input: b.input
      }));

    return {
      content: textContent,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      provider: "anthropic",
      model: response.model
    };
  }

  private async callOpenAI(
    messages: ChatMessage[],
    options: AIOptions
  ): Promise<AIResponse> {
    // Convert tools to OpenAI format
    const openaiTools = options.tools?.map(t => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema
      }
    }));

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.openaiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o", // Using gpt-4o for everything (latest flagship)
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 4096,
        tools: openaiTools,
        response_format: options.jsonMode ? { type: "json_object" } : undefined
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    const toolCalls = message.tool_calls?.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments)
    }));

    return {
      content: message.content || "",
      tool_calls: toolCalls,
      provider: "openai",
      model: data.model
    };
  }
}

export const unifiedAI = new UnifiedAIClient();
