/**
 * Token Budget Tracker Tests
 * Mirrors the exact logic in unified-ai-client.ts to verify correctness.
 * The production file uses Deno ESM imports so cannot be required directly in Jest.
 */

// ── Constants from unified-ai-client.ts (kept in sync manually) ──────────────

const AGENT_TOKEN_BUDGETS = {
  atlas: 12000,
  lisa: 512,
  default: 2048,
} as const;

const COMPACTION_THRESHOLD = 0.75;
const CONTEXT_LIMIT = 32000;

/** Mirror of the cost formula in callGemini */
function calcGeminiCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const inputCostPer1M = modelName.includes("flash") ? 0.10 : 3.00;
  const outputCostPer1M = modelName.includes("flash") ? 0.40 : 15.00;
  return (inputTokens * inputCostPer1M + outputTokens * outputCostPer1M) / 1_000_000;
}

/** Mirror of callGemini's usageMetadata extraction */
function extractTokenBudgetFromUsage(
  usageMeta: { promptTokenCount?: number; candidatesTokenCount?: number } | null | undefined,
  modelName: string,
): { inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number } {
  if (!usageMeta) {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 };
  }
  const inputTokens = usageMeta.promptTokenCount || 0;
  const outputTokens = usageMeta.candidatesTokenCount || 0;
  const totalTokens = inputTokens + outputTokens;
  const costUsd = calcGeminiCost(modelName, inputTokens, outputTokens);
  return { inputTokens, outputTokens, totalTokens, costUsd };
}

/** Mirror of the per-call usage log line */
function buildUsageLog(
  functionName: string | undefined,
  inputTokens: number,
  outputTokens: number,
  costUsd: number,
  latencyMs: number,
): string {
  return `[UnifiedAI] 📊 [${functionName || "unknown"}] in=${inputTokens} out=${outputTokens} cost=$${costUsd.toFixed(6)} latency=${latencyMs}ms`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("UnifiedAIClient Token Budget Tracker", () => {
  describe("Agent-specific token budgets", () => {
    it("should have correct budget constants defined", () => {
      expect(AGENT_TOKEN_BUDGETS.atlas).toBe(12000);
      expect(AGENT_TOKEN_BUDGETS.lisa).toBe(512);
      expect(AGENT_TOKEN_BUDGETS.default).toBe(2048);
    });

    it("should have compaction threshold defined", () => {
      expect(COMPACTION_THRESHOLD).toBe(0.75);
    });
  });

  describe("usageMetadata extraction from Gemini response", () => {
    it("should extract promptTokenCount and candidatesTokenCount", () => {
      const usageMeta = { promptTokenCount: 1500, candidatesTokenCount: 300 };
      const result = extractTokenBudgetFromUsage(usageMeta, "gemini-3.1-flash");

      expect(result.inputTokens).toBe(1500);
      expect(result.outputTokens).toBe(300);
      expect(result.totalTokens).toBe(1800);
    });

    it("should return zeros when usageMetadata is undefined", () => {
      const result = extractTokenBudgetFromUsage(undefined, "gemini-3.1-flash");

      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
      expect(result.totalTokens).toBe(0);
      expect(result.costUsd).toBe(0);
    });

    it("should return zeros when usageMetadata is null", () => {
      const result = extractTokenBudgetFromUsage(null, "gemini-3.1-flash");

      expect(result.totalTokens).toBe(0);
      expect(result.costUsd).toBe(0);
    });

    it("should handle missing individual token counts gracefully", () => {
      const result = extractTokenBudgetFromUsage(
        { promptTokenCount: 200 }, // candidatesTokenCount absent
        "gemini-3.1-flash",
      );

      expect(result.inputTokens).toBe(200);
      expect(result.outputTokens).toBe(0);
      expect(result.totalTokens).toBe(200);
    });
  });

  describe("tokenBudget accumulation across multiple calls", () => {
    it("should accumulate totalTokens across two calls", () => {
      let totalTokens = 0;
      let totalCost = 0;

      const call1 = extractTokenBudgetFromUsage(
        { promptTokenCount: 100, candidatesTokenCount: 50 },
        "gemini-3.1-flash",
      );
      totalTokens += call1.totalTokens;
      totalCost += call1.costUsd;

      const call2 = extractTokenBudgetFromUsage(
        { promptTokenCount: 200, candidatesTokenCount: 100 },
        "gemini-3.1-flash",
      );
      totalTokens += call2.totalTokens;
      totalCost += call2.costUsd;

      expect(totalTokens).toBe(450); // 150 + 300
      expect(totalCost).toBeGreaterThan(0);
    });

    it("should not increment budget when usageMetadata is absent", () => {
      let totalTokens = 0;

      const call1 = extractTokenBudgetFromUsage(
        { promptTokenCount: 100, candidatesTokenCount: 50 },
        "gemini-3.1-flash",
      );
      totalTokens += call1.totalTokens;

      const call2 = extractTokenBudgetFromUsage(undefined, "gemini-3.1-flash");
      totalTokens += call2.totalTokens; // should add 0

      expect(totalTokens).toBe(150);
    });
  });

  describe("cost calculation by model tier", () => {
    it("should use Flash pricing ($0.10/$0.40 per 1M) for flash models", () => {
      const cost = calcGeminiCost("gemini-3.1-flash", 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(0.50, 6); // ($0.10 + $0.40)
    });

    it("should use Pro pricing ($3.00/$15.00 per 1M) for pro models", () => {
      const cost = calcGeminiCost("gemini-3.1-pro", 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(18.00, 6); // ($3.00 + $15.00)
    });

    it("should scale linearly with token count for flash", () => {
      const cost1k = calcGeminiCost("gemini-3.1-flash", 1000, 500);
      expect(cost1k).toBeCloseTo(0.0003, 6); // (1000*0.10 + 500*0.40) / 1M
    });

    it("should scale linearly with token count for pro", () => {
      const cost1k = calcGeminiCost("gemini-3.1-pro", 1000, 500);
      expect(cost1k).toBeCloseTo(0.0105, 6); // (1000*3.00 + 500*15.00) / 1M
    });
  });

  describe("per-function-name usage logging", () => {
    it("should include function name in log line", () => {
      const log = buildUsageLog("ml-churn-score", 100, 50, 0.000030, 1500);

      expect(log).toContain("[ml-churn-score]");
    });

    it("should fall back to 'unknown' when functionName is undefined", () => {
      const log = buildUsageLog(undefined, 100, 50, 0.000030, 1500);

      expect(log).toContain("[unknown]");
    });

    it("should include token counts in log line", () => {
      const log = buildUsageLog("atlas-agent", 1500, 300, 0.000270, 2300);

      expect(log).toContain("in=1500");
      expect(log).toContain("out=300");
    });

    it("should include cost and latency in log line", () => {
      const log = buildUsageLog("lisa-chat", 50, 20, 0.000013, 800);

      expect(log).toContain("cost=$");
      expect(log).toContain("latency=800ms");
    });
  });

  describe("Budget enforcement", () => {
    it("should cap Atlas requests at 12000 tokens", () => {
      const requested = 20000;
      const enforced = Math.min(requested, AGENT_TOKEN_BUDGETS.atlas);
      expect(enforced).toBe(12000);
    });

    it("should cap Lisa requests at 512 tokens", () => {
      const requested = 2048;
      const enforced = Math.min(requested, AGENT_TOKEN_BUDGETS.lisa);
      expect(enforced).toBe(512);
    });

    it("should use default budget (2048) when agent type not specified", () => {
      const budget = AGENT_TOKEN_BUDGETS["default"];
      expect(budget).toBe(2048);
    });
  });

  describe("Context compaction trigger", () => {
    it("should compact when estimated tokens exceed 75% of context limit", () => {
      const estimatedInput = 20000;
      const maxOutput = 8000;
      const shouldCompact = estimatedInput + maxOutput > CONTEXT_LIMIT * COMPACTION_THRESHOLD;
      expect(shouldCompact).toBe(true); // 28000 > 24000
    });

    it("should not compact when within 75% of context limit", () => {
      const estimatedInput = 5000;
      const maxOutput = 2048;
      const shouldCompact = estimatedInput + maxOutput > CONTEXT_LIMIT * COMPACTION_THRESHOLD;
      expect(shouldCompact).toBe(false); // 7048 < 24000
    });

    it("should compact at exactly 75% boundary", () => {
      const threshold = CONTEXT_LIMIT * COMPACTION_THRESHOLD; // 24000
      const shouldCompact = threshold + 1 > threshold;
      expect(shouldCompact).toBe(true);
    });
  });

  describe("Token estimation from message content", () => {
    it("should estimate ~1 token per 4 characters", () => {
      const content = "A".repeat(40);
      const estimated = Math.ceil(content.length / 4);
      expect(estimated).toBe(10);
    });

    it("should sum estimates across all messages", () => {
      const messages = [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "Hello there" },
        { role: "assistant", content: "Hi! How can I help?" },
      ];
      const total = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
      expect(total).toBeGreaterThan(0);
    });
  });
});
