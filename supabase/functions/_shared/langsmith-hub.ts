// LangSmith Hub Integration - Pull prompts dynamically without code deploys
// Falls back to hardcoded prompts if LangSmith unavailable

interface HubPrompt {
  template: string;
  variables: string[];
  metadata?: Record<string, unknown>;
}

interface CachedPrompt {
  prompt: HubPrompt;
  fetchedAt: number;
}

// In-memory cache (per Deno isolate - ~5min effective lifespan)
const promptCache = new Map<string, CachedPrompt>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// LangSmith Hub configuration
function getHubConfig() {
  return {
    apiKey: Deno.env.get("LANGSMITH_API_KEY"),
    baseUrl: "https://api.smith.langchain.com/v1",
  };
}

/**
 * Pull a prompt from LangSmith Hub with caching and fallback
 * 
 * @param promptName - Name in format "owner/prompt-name:tag" or just "prompt-name:tag"
 * @param fallbackTemplate - Fallback template if Hub unavailable
 * @returns The prompt template string
 * 
 * @example
 * const prompt = await pullPrompt("ptd-agent-system:prod", PTD_SYSTEM_KNOWLEDGE);
 */
export async function pullPrompt(
  promptName: string,
  fallbackTemplate: string
): Promise<string> {
  const config = getHubConfig();
  
  // If no API key, use fallback immediately
  if (!config.apiKey) {
    console.log(`[LangSmith Hub] No API key - using fallback for ${promptName}`);
    return fallbackTemplate;
  }

  // Check cache first
  const cached = promptCache.get(promptName);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    console.log(`[LangSmith Hub] Cache hit for ${promptName}`);
    return cached.prompt.template;
  }

  try {
    // Parse prompt name: "owner/name:tag" or "name:tag"
    const [nameWithOwner, tag = "prod"] = promptName.split(":");
    const parts = nameWithOwner.split("/");
    const owner = parts.length > 1 ? parts[0] : "-"; // "-" for default owner
    const name = parts.length > 1 ? parts[1] : parts[0];

    // Fetch from LangSmith Hub
    const url = `${config.baseUrl}/repos/${owner}/${name}/commits/${tag}/manifest`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(3000), // 3s timeout
    });

    if (!response.ok) {
      console.warn(`[LangSmith Hub] Failed to fetch ${promptName}: ${response.status}`);
      return fallbackTemplate;
    }

    const manifest = await response.json();
    
    // Extract template from manifest
    // LangSmith stores prompts in various formats, handle common cases
    let template = fallbackTemplate;
    
    if (manifest.messages && Array.isArray(manifest.messages)) {
      // Chat prompt format
      template = manifest.messages
        .map((m: { role: string; content: string }) => 
          m.role === "system" ? m.content : `${m.role}: ${m.content}`
        )
        .join("\n\n");
    } else if (manifest.template) {
      // Simple template format
      template = manifest.template;
    } else if (typeof manifest === "string") {
      template = manifest;
    }

    // Cache the result
    promptCache.set(promptName, {
      prompt: { template, variables: manifest.input_variables || [] },
      fetchedAt: Date.now(),
    });

    console.log(`[LangSmith Hub] Fetched ${promptName} successfully`);
    return template;

  } catch (error) {
    console.warn(`[LangSmith Hub] Error fetching ${promptName}:`, error);
    return fallbackTemplate;
  }
}

/**
 * Pull multiple prompts in parallel
 */
export async function pullPrompts(
  prompts: Array<{ name: string; fallback: string }>
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  await Promise.all(
    prompts.map(async ({ name, fallback }) => {
      const template = await pullPrompt(name, fallback);
      results.set(name, template);
    })
  );
  
  return results;
}

/**
 * Format a prompt template with variables
 */
export function formatPrompt(
  template: string,
  variables: Record<string, string | number>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    // Handle both {key} and {{key}} formats
    result = result.replace(new RegExp(`\\{\\{?${key}\\}\\}?`, "g"), String(value));
  }
  
  return result;
}

/**
 * Clear prompt cache (useful for testing)
 */
export function clearPromptCache(): void {
  promptCache.clear();
}

/**
 * Get cache stats for debugging
 */
export function getPromptCacheStats(): { size: number; keys: string[] } {
  return {
    size: promptCache.size,
    keys: Array.from(promptCache.keys()),
  };
}
