import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
const PIPEBOARD_TOKEN = Deno.env.get("PIPEBOARD_TOKEN")!;
const PIPEBOARD_MCP_URL = "https://mcp.pipeboard.co/meta-ads-mcp";

const META_ACCOUNTS = ["act_349832333681399", "act_1512094040229431"];

const SYSTEM_PROMPT = `You are an expert Meta Ads analyst for PTD Fitness (Dubai). You have access to MCP tools that can query Meta Ads data via the Pipeboard platform.

Key accounts: ${META_ACCOUNTS.join(", ")}
Currency: AED
Monthly budget: ~AED 384,000

When analyzing data:
- Always show spend in AED
- Calculate ROAS, CPA, CTR, CPM
- Compare performance across campaigns
- Provide actionable optimization recommendations
- Flag underperforming campaigns (ROAS < 1.5)
- Highlight top performers

Be concise, data-driven, and proactive with insights.`;

interface PipboardTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface DeepSeekTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// Cache tools for 10 minutes
let toolsCache: { tools: DeepSeekTool[]; pipboardTools: PipboardTool[]; ts: number } | null = null;

async function fetchPipboardTools(): Promise<{ deepseekTools: DeepSeekTool[]; pipboardTools: PipboardTool[] }> {
  if (toolsCache && Date.now() - toolsCache.ts < 600_000) {
    return { deepseekTools: toolsCache.tools, pipboardTools: toolsCache.pipboardTools };
  }

  const res = await fetch(PIPEBOARD_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PIPEBOARD_TOKEN}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
  });

  const data = await res.json();
  const pipboardTools: PipboardTool[] = data.result?.tools || [];

  const deepseekTools: DeepSeekTool[] = pipboardTools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description || t.name,
      parameters: t.inputSchema || { type: "object", properties: {} },
    },
  }));

  toolsCache = { tools: deepseekTools, pipboardTools, ts: Date.now() };
  return { deepseekTools, pipboardTools };
}

async function callPipboardTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(PIPEBOARD_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PIPEBOARD_TOKEN}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name, arguments: args },
      id: Date.now(),
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result;
}

async function chatWithDeepSeek(
  messages: Array<{ role: string; content: string }>,
  tools: DeepSeekTool[],
  maxIterations = 5,
): Promise<string> {
  const allMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages,
  ];

  for (let i = 0; i < maxIterations; i++) {
    const body: Record<string, unknown> = {
      model: "deepseek-chat",
      messages: allMessages,
      temperature: 0.3,
      max_tokens: 4096,
    };

    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DeepSeek API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    if (!choice) throw new Error("No response from DeepSeek");

    const msg = choice.message;

    // If no tool calls, return the text content
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content || "";
    }

    // Add assistant message with tool calls
    allMessages.push(msg);

    // Execute each tool call
    for (const toolCall of msg.tool_calls) {
      const fnName = toolCall.function.name;
      let fnArgs: Record<string, unknown> = {};
      try {
        fnArgs = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        // empty args
      }

      let result: unknown;
      try {
        result = await callPipboardTool(fnName, fnArgs);
      } catch (e) {
        result = { error: (e as Error).message };
      }

      allMessages.push({
        role: "tool",
        content: JSON.stringify(result),
        // @ts-ignore - DeepSeek expects tool_call_id
        tool_call_id: toolCall.id,
      });
    }
  }

  return "I reached the maximum number of tool calls. Here's what I found so far based on the data collected.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const { prompt, messages = [], taskType = "chat" } = await req.json();

    // Build conversation messages
    const chatMessages: Array<{ role: string; content: string }> = [];

    // Add history
    for (const m of messages) {
      chatMessages.push({ role: m.role === "model" ? "assistant" : m.role, content: m.content });
    }

    // Add current prompt
    if (prompt) {
      // Prepend task context based on type
      let enrichedPrompt = prompt;
      if (taskType === "data_fetch") {
        enrichedPrompt = `Fetch campaign data: ${prompt}. Use the available tools to get real data from Meta Ads accounts ${META_ACCOUNTS.join(", ")}. Present results in a structured format.`;
      } else if (taskType === "budget_optimization") {
        enrichedPrompt = `Analyze budget allocation across all campaigns in accounts ${META_ACCOUNTS.join(", ")}. ${prompt}. Provide specific recommendations for budget reallocation to maximize ROAS.`;
      }
      chatMessages.push({ role: "user", content: enrichedPrompt });
    }

    // Fetch tools from Pipeboard
    const { deepseekTools } = await fetchPipboardTools();

    // Run the agentic loop
    const response = await chatWithDeepSeek(chatMessages, deepseekTools);

    return apiSuccess({ response, model: "deepseek-chat", toolsAvailable: deepseekTools.length });
  } catch (err) {
    console.error("meta-ads-proxy error:", err);
    return apiError("META_ADS_ERROR", (err as Error).message, 500);
  }
});
