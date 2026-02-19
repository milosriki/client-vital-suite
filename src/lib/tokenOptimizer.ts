// ═══════════════════════════════════════════════════════════
// TOKEN OPTIMIZER — Cost Control + Model Selection + Budget
// Qwen-first for analysis, Anthropic for MCP tool calls
// ═══════════════════════════════════════════════════════════

import type { UsageStats, TaskType, TokenCost, ToolProfile } from '@/types/metaAds';

// ─── Pricing per 1M tokens ────────────────────────────────
const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  // Anthropic (reference — used for MCP tool calls)
  'claude-haiku-4-5-20251001':  { input: 0.80,  output: 4.00,  cacheRead: 0.08,  cacheWrite: 1.00  },
  'claude-sonnet-4-20250514':   { input: 3.00,  output: 15.00, cacheRead: 0.30,  cacheWrite: 3.75  },
  'claude-opus-4-6':            { input: 15.00, output: 75.00, cacheRead: 1.50,  cacheWrite: 18.75 },
  // Qwen (primary — much cheaper)
  'qwen-turbo':                 { input: 0.20,  output: 0.60,  cacheRead: 0.02,  cacheWrite: 0.20  },
  'qwen-plus':                  { input: 0.80,  output: 2.00,  cacheRead: 0.08,  cacheWrite: 0.80  },
  'qwen3-max':                  { input: 2.00,  output: 6.00,  cacheRead: 0.20,  cacheWrite: 2.00  },
};

// ─── Approximate token counts per tool profile ────────────
const TOOL_TOKEN_ESTIMATES: Record<ToolProfile, number> = {
  dashboard: 2500,
  management: 4000,
  creative: 3000,
  targeting: 3500,
  full: 12000,
};

// ─── Calculate cost for a single request ──────────────────
export function calculateCost(usage: UsageStats, model: string = 'qwen-plus'): TokenCost {
  const rates = PRICING[model] || PRICING['qwen-plus'];

  const inputCost = (usage.input_tokens / 1_000_000) * rates.input;
  const outputCost = (usage.output_tokens / 1_000_000) * rates.output;
  const cacheReadCost = ((usage.cache_read_input_tokens || 0) / 1_000_000) * rates.cacheRead;
  const cacheWriteCost = ((usage.cache_creation_input_tokens || 0) / 1_000_000) * rates.cacheWrite;

  return {
    inputCost: inputCost + cacheReadCost + cacheWriteCost,
    outputCost,
    totalCost: inputCost + outputCost + cacheReadCost + cacheWriteCost,
    model,
  };
}

// ─── Select optimal model by task type ────────────────────
// Tasks requiring MCP tools use Anthropic; pure analysis uses Qwen
export function selectModel(taskType: TaskType): string {
  const map: Record<TaskType, string> = {
    data_fetch: 'qwen-turbo',
    campaign_list: 'qwen-turbo',
    performance_alerts: 'qwen-plus',
    budget_optimization: 'qwen-plus',
    creative_analysis: 'qwen-plus',
    audience_insights: 'qwen-plus',
    chat: 'qwen-plus',
    strategic_planning: 'qwen3-max',
  };
  return map[taskType] || 'qwen-plus';
}

// ─── Does this task need MCP tools (Anthropic path)? ──────
export function needsMcpTools(taskType: TaskType): boolean {
  const mcpTasks: TaskType[] = ['data_fetch', 'campaign_list'];
  return mcpTasks.includes(taskType);
}

// ─── Select tool profile by task ──────────────────────────
export function selectToolProfile(taskType: TaskType): ToolProfile {
  const map: Record<TaskType, ToolProfile> = {
    data_fetch: 'dashboard',
    campaign_list: 'dashboard',
    performance_alerts: 'dashboard',
    budget_optimization: 'management',
    creative_analysis: 'creative',
    audience_insights: 'targeting',
    chat: 'full',
    strategic_planning: 'full',
  };
  return map[taskType] || 'dashboard';
}

// ─── Estimate cost BEFORE making request ──────────────────
export function estimateCost(
  promptLength: number,
  taskType: TaskType,
  toolProfile: ToolProfile
): { estimatedInputTokens: number; estimatedOutputTokens: number; estimatedCost: number; model: string } {
  const model = selectModel(taskType);
  const rates = PRICING[model] || PRICING['qwen-plus'];

  const promptTokens = Math.ceil(promptLength / 4);
  const systemTokens = 300;
  const toolTokens = TOOL_TOKEN_ESTIMATES[toolProfile];
  const estimatedInputTokens = promptTokens + systemTokens + toolTokens;

  const outputEstimates: Record<TaskType, number> = {
    data_fetch: 500,
    campaign_list: 800,
    performance_alerts: 600,
    budget_optimization: 1200,
    creative_analysis: 1500,
    audience_insights: 1000,
    chat: 2000,
    strategic_planning: 3000,
  };
  const estimatedOutputTokens = outputEstimates[taskType] || 1500;

  const inputCost = (estimatedInputTokens / 1_000_000) * rates.input;
  const outputCost = (estimatedOutputTokens / 1_000_000) * rates.output;

  return {
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCost: inputCost + outputCost,
    model,
  };
}

// ═══════════════════════════════════════════════════════════
// TOKEN BUDGET TRACKER (persists in localStorage)
// ═══════════════════════════════════════════════════════════
interface UsageRecord {
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  model: string;
  taskType: string;
  query: string;
}

const STORAGE_KEY = 'ptd_token_usage';
const DEFAULT_DAILY_BUDGET = 10;

export class TokenBudgetTracker {
  private dailyBudget: number;

  constructor(dailyBudgetUSD: number = DEFAULT_DAILY_BUDGET) {
    this.dailyBudget = dailyBudgetUSD;
  }

  private getRecords(): UsageRecord[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveRecords(records: UsageRecord[]): void {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const filtered = records.filter(r => new Date(r.timestamp) > cutoff);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  track(usage: UsageStats, model: string, taskType: string, query: string): TokenCost {
    const cost = calculateCost(usage, model);
    const records = this.getRecords();
    records.push({
      timestamp: new Date().toISOString(),
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cost: cost.totalCost,
      model,
      taskType,
      query: query.slice(0, 100),
    });
    this.saveRecords(records);
    return cost;
  }

  getTodayRecords(): UsageRecord[] {
    const today = new Date().toDateString();
    return this.getRecords().filter(r => new Date(r.timestamp).toDateString() === today);
  }

  getTodaySpend(): number {
    return this.getTodayRecords().reduce((sum, r) => sum + r.cost, 0);
  }

  getRemainingBudget(): number {
    return Math.max(0, this.dailyBudget - this.getTodaySpend());
  }

  isOverBudget(): boolean {
    return this.getTodaySpend() >= this.dailyBudget;
  }

  getStats() {
    const today = this.getTodayRecords();
    const allRecords = this.getRecords();

    const last7Days: Array<{ date: string; cost: number; queries: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const dayRecords = allRecords.filter(r => new Date(r.timestamp).toDateString() === dateStr);
      last7Days.push({
        date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        cost: dayRecords.reduce((s, r) => s + r.cost, 0),
        queries: dayRecords.length,
      });
    }

    const byModel: Record<string, { cost: number; queries: number }> = {};
    today.forEach(r => {
      if (!byModel[r.model]) byModel[r.model] = { cost: 0, queries: 0 };
      byModel[r.model].cost += r.cost;
      byModel[r.model].queries += 1;
    });

    return {
      today: {
        queries: today.length,
        inputTokens: today.reduce((s, r) => s + r.inputTokens, 0),
        outputTokens: today.reduce((s, r) => s + r.outputTokens, 0),
        totalCost: this.getTodaySpend(),
        remainingBudget: this.getRemainingBudget(),
        avgCostPerQuery: today.length ? this.getTodaySpend() / today.length : 0,
      },
      last7Days,
      byModel,
      dailyBudget: this.dailyBudget,
    };
  }

  setDailyBudget(amount: number): void {
    this.dailyBudget = amount;
  }

  clearHistory(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const tokenTracker = new TokenBudgetTracker(DEFAULT_DAILY_BUDGET);
