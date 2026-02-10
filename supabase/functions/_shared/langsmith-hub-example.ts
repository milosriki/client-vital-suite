// ═══════════════════════════════════════════════════════════════════════════
// LANGSMITH HUB INTEGRATION EXAMPLE
// Shows how to pull prompts from LangSmith Hub with fallback
// ═══════════════════════════════════════════════════════════════════════════

import { pullPrompt, formatPrompt } from "./langsmith-hub.ts";
import { 
  createAITraceConfig, 
  traceStart, 
  traceEnd 
} from "./langsmith-tracing.ts";

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: Define your fallback prompts (existing hardcoded versions)
// These are used if LangSmith Hub is unavailable
// ═══════════════════════════════════════════════════════════════════════════

const FALLBACK_SYSTEM_PROMPT = `
You are a helpful AI assistant for PTD Fitness Dubai.

## Business Context
- Premium mobile personal training service
- Target: Executives & professionals 40+
- Packages: Custom high-ticket programs (pricing discussed during assessment only)

## Health Zones
- Purple (85-100): Thriving
- Green (70-84): Healthy
- Yellow (50-69): At Risk
- Red (0-49): Critical

## Rules
1. Always use LIVE data
2. Quantify impact in AED
3. Be concise and actionable
`;

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: Pull prompt from LangSmith Hub at runtime
// ═══════════════════════════════════════════════════════════════════════════

async function getSystemPrompt(): Promise<string> {
  // Pull from Hub with fallback
  // Format: "prompt-name:tag" where tag is "prod", "staging", or "dev"
  return await pullPrompt(
    "ptd-agent-system:prod",  // This is the prompt name in LangSmith Hub
    FALLBACK_SYSTEM_PROMPT     // Fallback if Hub unavailable
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: Use in your function with proper tracing
// ═══════════════════════════════════════════════════════════════════════════

export async function exampleAIFunction(
  userMessage: string,
  sessionId?: string
): Promise<string> {
  const MODEL = "claude-4-5-sonnet-20241022";
  const FUNCTION_NAME = "example-ai-function";
  
  // Create trace config with provider metadata (for cost tracking)
  const traceConfig = createAITraceConfig(FUNCTION_NAME, MODEL, {
    category: "example",
    sessionId,
    temperature: 0.7,
    maxTokens: 2048,
  });

  // Start trace
  const run = await traceStart(traceConfig, { 
    user_message: userMessage,
    session_id: sessionId 
  });

  try {
    // Pull prompt from LangSmith Hub (cached for 5 min)
    const systemPrompt = await getSystemPrompt();
    
    // Your AI call here...
    const response = await callAnthropicAPI({
      model: MODEL,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    // End trace with success
    await traceEnd(run, { 
      response: response,
      tokens_used: response.usage,
    });

    return response.content;

  } catch (error) {
    // End trace with error
    await traceEnd(run, {}, error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4: Dynamic prompts with variables
// ═══════════════════════════════════════════════════════════════════════════

const FALLBACK_CLIENT_ANALYSIS_PROMPT = `
Analyze the following client data and provide recommendations:

Client: {client_name}
Health Score: {health_score}
Health Zone: {health_zone}
Last Session: {last_session_date}

Provide:
1. Risk assessment
2. Recommended actions
3. Priority level
`;

async function analyzeClient(clientData: {
  name: string;
  healthScore: number;
  healthZone: string;
  lastSession: string;
}): Promise<string> {
  // Pull template from Hub
  const template = await pullPrompt(
    "ptd-client-analysis:prod",
    FALLBACK_CLIENT_ANALYSIS_PROMPT
  );
  
  // Format with variables
  const prompt = formatPrompt(template, {
    client_name: clientData.name,
    health_score: clientData.healthScore,
    health_zone: clientData.healthZone,
    last_session_date: clientData.lastSession,
  });
  
  // Use formatted prompt in AI call...
  return prompt;
}

// ═══════════════════════════════════════════════════════════════════════════
// MIGRATION PATTERN: How to convert existing functions
// ═══════════════════════════════════════════════════════════════════════════

/*
BEFORE (hardcoded):
─────────────────────
const systemPrompt = `You are a helpful assistant...`;
await anthropic.messages.create({
  model: "claude-4-5-sonnet",
  system: systemPrompt,
  messages: [...]
});


AFTER (LangSmith Hub):
─────────────────────
import { pullPrompt } from "../_shared/langsmith-hub.ts";

const FALLBACK_PROMPT = `You are a helpful assistant...`;  // Keep existing prompt as fallback

// In function:
const systemPrompt = await pullPrompt("my-prompt:prod", FALLBACK_PROMPT);
await anthropic.messages.create({
  model: "claude-4-5-sonnet",
  system: systemPrompt,
  messages: [...]
});


LANGSMITH HUB SETUP:
─────────────────────
1. Go to smith.langchain.com → Prompts → New Prompt
2. Name: "my-prompt" (matches the name in pullPrompt)
3. Paste your current hardcoded prompt
4. Save → Creates first commit
5. Add tags: "prod", "staging", "dev"
6. Move "prod" tag to latest commit
7. Done! Edit prompt in UI, move tag = production updated
*/

// Stub for example
async function callAnthropicAPI(_options: unknown): Promise<{ content: string; usage: unknown }> {
  return { content: "Example response", usage: {} };
}
