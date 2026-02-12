# Intelligence Upgrade Plan — 10 Fixes to Reach 82/100

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the 35-point gap between infrastructure quality (82/100) and agent intelligence (46.7/100) through 10 targeted fixes.

**Architecture:** All fixes modify the Supabase Edge Function layer (`supabase/functions/`). No frontend changes. Fixes are independent and can be parallelized in groups. Each fix targets a specific intelligence metric from the deep verification scorecard.

**Tech Stack:** Deno/TypeScript, Supabase Edge Functions, Google Generative AI SDK, PostgreSQL

**Current Score:** 63.8/100 (weighted) | **Target:** 82/100

---

## Fix Map

| Fix | Metric Affected | Current → Target | Effort | Priority |
|-----|----------------|-----------------|--------|----------|
| 1 | Context Efficiency | 42 → 65 | 2h | P0 |
| 2 | Architecture + Tools | 52 → 68 / 40 → 65 | 4h | P0 |
| 3 | Learning Loop | 38 → 58 | 3h | P0 |
| 4 | Output Validation | 15 → 55 | 3h | P1 |
| 5 | Architecture | 68 → 75 | 4h | P1 |
| 6 | Agent Contracts | +1.5 overall | 2h | P1 |
| 7 | Anti-Hallucination | +1.2 overall | 1h | P2 |
| 8 | Architecture | 75 → 80 | 2h | P2 |
| 9 | Error Handling | +0.5 overall | 15min | P2 |
| 10 | Architecture | 80 → 85 | 6h | P3 |

---

## Task 1: Wire Token Budget Tracker

**Score Impact:** Context Efficiency 42 → 65 (+9.2 overall)

**Files:**
- Modify: `supabase/functions/_shared/unified-ai-client.ts:322-363`
- Create: `supabase/migrations/20260213000004_token_usage_metrics.sql`

### Step 1: Create the migration

```sql
-- supabase/migrations/20260213000004_token_usage_metrics.sql
CREATE TABLE IF NOT EXISTS public.token_usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  model_used text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tum_function_date ON public.token_usage_metrics(function_name, created_at DESC);
CREATE INDEX idx_tum_model ON public.token_usage_metrics(model_used, created_at DESC);

GRANT SELECT, INSERT ON public.token_usage_metrics TO authenticated;

COMMENT ON TABLE public.token_usage_metrics IS 'Per-call token usage tracking for cost attribution and budget alerts.';
```

### Step 2: Extract usageMetadata from Gemini response

**File:** `supabase/functions/_shared/unified-ai-client.ts`

Find the `callGemini()` method. After line ~323 where `const response = await result.response;` is called, add token extraction:

```typescript
// After: const response = await result.response;
// Add:
const usageMetadata = response.usageMetadata;
if (usageMetadata) {
  const promptTokens = usageMetadata.promptTokenCount || 0;
  const completionTokens = usageMetadata.candidatesTokenCount || 0;
  const totalTokensUsed = promptTokens + completionTokens;

  // Increment in-memory budget
  this.tokenBudget.totalTokens += totalTokensUsed;

  // Cost lookup from MODEL_COSTS in observability.ts
  const inputCostPer1M = modelName.includes("flash") ? 0.10 : 3.00;
  const outputCostPer1M = modelName.includes("flash") ? 0.40 : 15.00;
  const costUsd = (promptTokens * inputCostPer1M + completionTokens * outputCostPer1M) / 1_000_000;
  this.tokenBudget.totalCost += costUsd;
}
```

### Step 3: Add tokens to AIResponse return type

Find the `AIResponse` interface (near top of file). Add:

```typescript
interface AIResponse {
  content: string;
  thought?: string;
  thoughtSignature?: string;
  tool_calls?: ToolCall[];
  provider: string;
  model: string;
  tokens_used?: number;    // ADD
  cost_usd?: number;       // ADD
}
```

Then in the return statement of `callGemini()` (line ~355), add:

```typescript
return {
  content: text,
  thought: thinkingText || undefined,
  thoughtSignature: response.thoughtSignature || undefined,
  tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
  provider: "gemini",
  model: modelName,
  tokens_used: usageMetadata?.promptTokenCount + usageMetadata?.candidatesTokenCount || undefined,
  cost_usd: costUsd || undefined,
};
```

### Step 4: Persist token metrics (optional, non-blocking)

In `callGemini()`, after the return value is constructed but before returning, add async logging (fire-and-forget):

```typescript
// Fire-and-forget token logging — don't block the response
if (usageMetadata && this.supabase) {
  this.supabase.from("token_usage_metrics").insert({
    function_name: options?.functionName || "unknown",
    model_used: modelName,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokensUsed,
    estimated_cost_usd: costUsd,
    correlation_id: options?.correlationId,
  }).then(() => {}).catch(() => {}); // Swallow errors — telemetry must never break agents
}
```

### Step 5: Verify

Run: `PATH="/opt/homebrew/bin:$PATH" npm run build`
Expected: 0 errors

### Step 6: Commit

```bash
git add supabase/migrations/20260213000004_token_usage_metrics.sql supabase/functions/_shared/unified-ai-client.ts
git commit -m "feat: wire token budget tracker — extract Gemini usageMetadata, track cost per call"
```

---

## Task 2: Universal Tool Adoption (ptd-ultimate-intelligence + ai-ceo-master)

**Score Impact:** Architecture 52 → 68, Tool Adoption 40 → 65 (+8.9 overall)

**Files:**
- Modify: `supabase/functions/ptd-ultimate-intelligence/index.ts:556-668`
- Modify: `supabase/functions/ai-ceo-master/index.ts:230-290`
- Reference: `supabase/functions/ptd-agent-gemini/index.ts:953-1112` (agentic loop pattern)

### Step 1: Add tool imports to ptd-ultimate-intelligence

At the top of `ptd-ultimate-intelligence/index.ts`, add:

```typescript
import { getToolDefinitions } from "../_shared/tool-definitions.ts";
import { executeSharedTool } from "../_shared/tool-executor.ts";
```

### Step 2: Add agentic loop to ptd-ultimate-intelligence

Find the main handler section (around line 556-668) where it calls `unifiedAI.chat()`. Replace the single-shot call with the agentic loop pattern from ptd-agent-gemini:

```typescript
// Get tools appropriate for this persona
const personaTools = getToolDefinitions().filter(t =>
  ["intelligence_control", "client_control", "revenue_intelligence",
   "command_center_control", "universal_search"].includes(t.name)
);

const MAX_LOOPS = 3;
const MAX_TOOL_RESULT_CHARS = 3000;

let currentResponse = await unifiedAI.chat(messages, {
  max_tokens: 4000,
  temperature: 0.7,
  tools: personaTools,
});

let loopCount = 0;
while (
  currentResponse.tool_calls &&
  currentResponse.tool_calls.length > 0 &&
  loopCount < MAX_LOOPS
) {
  loopCount++;
  const toolResults: string[] = [];

  for (const toolCall of currentResponse.tool_calls) {
    try {
      const rawResult = await executeSharedTool(supabase, toolCall.name, toolCall.input);
      const toolResult = rawResult.length > MAX_TOOL_RESULT_CHARS
        ? rawResult.slice(0, MAX_TOOL_RESULT_CHARS) + `\n... [truncated]`
        : rawResult;
      toolResults.push(`Tool '${toolCall.name}' Result:\n${toolResult}`);
    } catch (err: any) {
      toolResults.push(`Tool '${toolCall.name}' failed: ${err.message}`);
    }
  }

  messages.push({ role: "assistant", content: currentResponse.content || "(Calling tools...)" });
  messages.push({ role: "user", content: `Tool results (Loop ${loopCount}):\n\n${toolResults.join("\n\n---\n\n")}\n\nUse these results for an accurate, data-driven answer.` });

  currentResponse = await unifiedAI.chat(messages, {
    max_tokens: 4000,
    temperature: 0.7,
    tools: personaTools,
  });
}

const finalResponse = currentResponse.content;
```

### Step 3: Replace raw fetch in ai-ceo-master with UnifiedAI

Find `generateWithGemini()` (line ~230-290) which uses `fetch()` directly to Gemini API. Replace with:

```typescript
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { getToolDefinitions } from "../_shared/tool-definitions.ts";
import { executeSharedTool } from "../_shared/tool-executor.ts";

// Replace generateWithGemini() body:
async function generateWithGemini(systemPrompt: string, command: string, supabase: any): Promise<string> {
  const ceoTools = getToolDefinitions().filter(t =>
    ["intelligence_control", "revenue_intelligence", "stripe_forensics",
     "command_center_control", "system_health"].includes(t.name)
  );

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: command },
  ];

  const MAX_LOOPS = 3;
  const MAX_TOOL_RESULT_CHARS = 3000;

  let response = await unifiedAI.chat(messages, {
    max_tokens: 4000,
    temperature: 0.3,
    tools: ceoTools,
  });

  let loopCount = 0;
  while (response.tool_calls?.length && loopCount < MAX_LOOPS) {
    loopCount++;
    const toolResults: string[] = [];

    for (const tc of response.tool_calls) {
      try {
        const raw = await executeSharedTool(supabase, tc.name, tc.input);
        const result = raw.length > MAX_TOOL_RESULT_CHARS
          ? raw.slice(0, MAX_TOOL_RESULT_CHARS) + "\n... [truncated]"
          : raw;
        toolResults.push(`Tool '${tc.name}':\n${result}`);
      } catch (e: any) {
        toolResults.push(`Tool '${tc.name}' failed: ${e.message}`);
      }
    }

    messages.push({ role: "assistant", content: response.content || "(Calling tools...)" });
    messages.push({ role: "user", content: `Tool results:\n\n${toolResults.join("\n\n---\n\n")}` });

    response = await unifiedAI.chat(messages, {
      max_tokens: 4000,
      temperature: 0.3,
      tools: ceoTools,
    });
  }

  return response.content || "";
}
```

### Step 4: Verify

Run: `PATH="/opt/homebrew/bin:$PATH" npm run build`
Expected: 0 errors

### Step 5: Commit

```bash
git add supabase/functions/ptd-ultimate-intelligence/index.ts supabase/functions/ai-ceo-master/index.ts
git commit -m "feat: universal tool adoption — ptd-ultimate-intelligence + ai-ceo-master now use agentic loop with tools"
```

---

## Task 3: Memory Retention Policy

**Score Impact:** Learning Loop 38 → 58 (+4.0 overall)

**Files:**
- Modify: `supabase/functions/_shared/learning-layer.ts`
- Create: `supabase/migrations/20260213000005_memory_retention.sql`
- Create: `supabase/functions/cleanup-agent-memory/index.ts`

### Step 1: Create the retention migration

```sql
-- supabase/migrations/20260213000005_memory_retention.sql

-- Add TTL columns to memory tables
ALTER TABLE public.agent_memory
  ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.agent_conversations
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.agent_decisions
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Set default expiry for future inserts
-- agent_memory: 90 days
-- agent_conversations: 180 days
-- agent_decisions: 365 days
-- agent_learnings: NEVER (human feedback is precious)
-- agent_patterns: NEVER (learned behaviors are precious)

-- Backfill existing rows with expiry
UPDATE public.agent_memory
  SET expires_at = created_at + INTERVAL '90 days'
  WHERE expires_at IS NULL;

UPDATE public.agent_conversations
  SET expires_at = created_at + INTERVAL '180 days'
  WHERE expires_at IS NULL;

UPDATE public.agent_decisions
  SET expires_at = created_at + INTERVAL '365 days'
  WHERE expires_at IS NULL;

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_am_expires ON public.agent_memory(expires_at) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_ac_expires ON public.agent_conversations(expires_at);
CREATE INDEX IF NOT EXISTS idx_ad_expires ON public.agent_decisions(expires_at);

COMMENT ON COLUMN public.agent_memory.expires_at IS 'Auto-set to created_at + 90 days. NULL = never expires.';
```

### Step 2: Create cleanup edge function

```typescript
// supabase/functions/cleanup-agent-memory/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();
  const results: Record<string, number> = {};

  // 1. Archive expired agent_memory (don't delete — mark archived)
  const { count: memoryArchived } = await supabase
    .from("agent_memory")
    .update({ archived: true })
    .eq("archived", false)
    .lt("expires_at", now);
  results.agent_memory_archived = memoryArchived || 0;

  // 2. Delete expired agent_conversations (write-only dead data)
  const { count: convsDeleted } = await supabase
    .from("agent_conversations")
    .delete()
    .lt("expires_at", now);
  results.agent_conversations_deleted = convsDeleted || 0;

  // 3. Delete expired agent_decisions older than 1 year
  const { count: decisionsDeleted } = await supabase
    .from("agent_decisions")
    .delete()
    .lt("expires_at", now);
  results.agent_decisions_deleted = decisionsDeleted || 0;

  // 4. Decay low-confidence patterns not confirmed in 60 days
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { count: patternsDecayed } = await supabase
    .from("agent_patterns")
    .update({ confidence: 0.1 })
    .lt("confidence", 0.5)
    .lt("last_confirmed_at", sixtyDaysAgo);
  results.agent_patterns_decayed = patternsDecayed || 0;

  console.log("[cleanup-agent-memory] Results:", JSON.stringify(results));

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

### Step 3: Expand learning-layer.ts with relevance filtering

**File:** `supabase/functions/_shared/learning-layer.ts`

Replace `getActiveLearnings()` method to filter by relevance instead of just recency:

```typescript
async getActiveLearnings(query?: string, limit = 5): Promise<string> {
  let queryBuilder = this.supabase
    .from("agent_learnings")
    .select("content, category, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  // If query provided, filter by category relevance
  if (query) {
    const q = query.toLowerCase();
    // Match categories that relate to the query
    if (q.includes("lead") || q.includes("sales")) {
      queryBuilder = queryBuilder.in("category", ["sales", "leads", "conversion", "general"]);
    } else if (q.includes("revenue") || q.includes("payment")) {
      queryBuilder = queryBuilder.in("category", ["revenue", "payments", "finance", "general"]);
    }
    // else: return all categories (no filter)
  }

  const { data } = await queryBuilder;

  if (!data || data.length === 0) return "";

  const items = data.map((l: any) => `- [${l.category}] ${l.content}`).join("\n");
  return `<evolutionary_memory>\nTHE USER HAS PREVIOUSLY CORRECTED YOU. DO NOT REPEAT THESE MISTAKES:\n${items}\n</evolutionary_memory>`;
}
```

### Step 4: Add expires_at to all INSERT calls

In `ptd-agent-gemini/index.ts`, find the `agent_memory` insert (around line 472) and add:

```typescript
expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
```

In `ai-ceo-master/index.ts`, find the `agent_conversations` insert (around line 116) and add:

```typescript
expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
```

### Step 5: Register cleanup as pg_cron (document for deploy)

```sql
-- Run nightly at 3 AM UTC
SELECT cron.schedule(
  'cleanup-agent-memory',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/cleanup-agent-memory',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
  )$$
);
```

### Step 6: Verify + Commit

Run: `PATH="/opt/homebrew/bin:$PATH" npm run build`

```bash
git add supabase/migrations/20260213000005_memory_retention.sql supabase/functions/cleanup-agent-memory/index.ts supabase/functions/_shared/learning-layer.ts
git commit -m "feat: memory retention policy — 90d memory, 180d conversations, pattern decay, nightly cleanup"
```

---

## Task 4: Output Validation on 5 Core Agents

**Score Impact:** Validation 15 → 55 (+6.4 overall)

**Files:**
- Modify: `supabase/functions/marketing-scout/index.ts`
- Modify: `supabase/functions/marketing-analyst/index.ts`
- Modify: `supabase/functions/marketing-allocator/index.ts`
- Modify: `supabase/functions/marketing-predictor/index.ts`
- Modify: `supabase/functions/marketing-loss-analyst/index.ts`

### Pattern (from marketing-copywriter reference)

Each agent needs a `validateOutput()` function added before its `.insert()` call:

```typescript
function validateOutput(raw: string): ParsedOutput {
  const parsed = JSON.parse(raw);
  // Check required fields exist
  if (!parsed.field_name) throw new Error("Missing required field: field_name");
  // Check types
  if (typeof parsed.confidence !== "number") throw new Error("confidence must be number");
  // Check ranges
  if (parsed.confidence < 0 || parsed.confidence > 1) throw new Error("confidence must be 0-1");
  return parsed as ParsedOutput;
}
```

### Step 1: marketing-scout — validate signal output

Add before the `.insert()` at line ~191:

```typescript
function validateScoutSignal(raw: string): any {
  const parsed = JSON.parse(raw);
  if (!parsed.signal_type || typeof parsed.signal_type !== "string") throw new Error("Missing signal_type");
  if (!parsed.severity || !["low", "medium", "high", "critical"].includes(parsed.severity)) throw new Error("Invalid severity");
  if (!parsed.evidence || typeof parsed.evidence !== "string") throw new Error("Missing evidence");
  return parsed;
}
```

### Step 2: marketing-analyst — validate recommendation output

Add before `.insert()` at line ~176:

```typescript
function validateRecommendation(raw: string): any {
  const parsed = JSON.parse(raw);
  if (!parsed.action || !["SCALE", "HOLD", "WATCH", "KILL"].includes(parsed.action)) throw new Error("Invalid action");
  if (typeof parsed.confidence !== "number" || parsed.confidence < 0 || parsed.confidence > 1) throw new Error("Invalid confidence");
  if (!parsed.reasoning || typeof parsed.reasoning !== "string") throw new Error("Missing reasoning");
  return parsed;
}
```

### Step 3: marketing-allocator — validate budget proposal

Add before `.insert()` at line ~157:

```typescript
function validateBudgetProposal(raw: string): any {
  const parsed = JSON.parse(raw);
  if (typeof parsed.proposed_daily_budget !== "number" || parsed.proposed_daily_budget < 0) throw new Error("Invalid proposed_daily_budget");
  if (typeof parsed.change_pct !== "number") throw new Error("Missing change_pct");
  if (!parsed.action || typeof parsed.action !== "string") throw new Error("Missing action");
  return parsed;
}
```

### Step 4: marketing-predictor — validate fatigue alert

Add before `.insert()` at line ~237:

```typescript
function validateFatigueAlert(raw: string): any {
  const parsed = JSON.parse(raw);
  if (typeof parsed.projected_roas_30d !== "number") throw new Error("Missing projected_roas_30d");
  if (!parsed.alert_type || typeof parsed.alert_type !== "string") throw new Error("Missing alert_type");
  if (!parsed.recommendation || typeof parsed.recommendation !== "string") throw new Error("Missing recommendation");
  return parsed;
}
```

### Step 5: marketing-loss-analyst — validate loss analysis

Add before `.insert()` at line ~341:

```typescript
function validateLossAnalysis(raw: string): any {
  const parsed = JSON.parse(raw);
  if (!parsed.primary_loss_reason || typeof parsed.primary_loss_reason !== "string") throw new Error("Missing primary_loss_reason");
  if (typeof parsed.confidence_pct !== "number" || parsed.confidence_pct < 0 || parsed.confidence_pct > 100) throw new Error("Invalid confidence_pct");
  if (!parsed.reasoning || typeof parsed.reasoning !== "string") throw new Error("Missing reasoning");
  return parsed;
}
```

### Step 6: Verify + Commit

Run: `PATH="/opt/homebrew/bin:$PATH" npm run build`

```bash
git add supabase/functions/marketing-scout/index.ts supabase/functions/marketing-analyst/index.ts supabase/functions/marketing-allocator/index.ts supabase/functions/marketing-predictor/index.ts supabase/functions/marketing-loss-analyst/index.ts
git commit -m "feat: output validation on 5 marketing agents — validate LLM output before storage"
```

---

## Task 5: Consolidate HubSpot Sync (5 → 1)

**Score Impact:** Architecture 68 → 75 (+2.8 overall)

**Files:**
- Create: `supabase/functions/_shared/hubspot-sync-core.ts`
- Modify: `supabase/functions/sync-hubspot-to-supabase/index.ts`
- Modify: `supabase/functions/sync-single-deal/index.ts`
- Modify: `supabase/functions/backfill-deals-history/index.ts`
- Modify: `supabase/functions/hubspot-webhook/index.ts`

### Approach

Extract the common pattern (fetch HubSpot → map fields → upsert Supabase) into a shared `hubspot-sync-core.ts` with a `syncDeal()` function. All 5 callers use the same function with a `mode` parameter:

```typescript
// _shared/hubspot-sync-core.ts
export type SyncMode = "full_sync" | "single_deal" | "backfill" | "webhook" | "batch";

export async function syncDeal(
  supabase: any,
  hubspotDeal: any,
  ownerMap: Map<string, string>,
  mode: SyncMode,
): Promise<void> {
  const mapped = {
    hubspot_deal_id: hubspotDeal.id,
    deal_name: hubspotDeal.properties.dealname,
    deal_value: parseFloat(hubspotDeal.properties.amount || "0"),
    deal_stage: hubspotDeal.properties.dealstage,
    pipeline: hubspotDeal.properties.pipeline,
    owner_id: hubspotDeal.properties.hubspot_owner_id,
    owner_name: ownerMap.get(hubspotDeal.properties.hubspot_owner_id) || null,
    close_date: hubspotDeal.properties.closedate,
    create_date: hubspotDeal.properties.createdate,
    last_modified: hubspotDeal.properties.hs_lastmodifieddate,
    sync_source: mode,
  };

  await supabase
    .from("deals")
    .upsert(mapped, { onConflict: "hubspot_deal_id" });
}

export async function fetchOwnerMap(hubspotToken: string): Promise<Map<string, string>> {
  // Shared owner lookup used by all sync paths
  const res = await fetch("https://api.hubapi.com/crm/v3/owners", {
    headers: { Authorization: `Bearer ${hubspotToken}` },
  });
  const data = await res.json();
  const map = new Map<string, string>();
  for (const owner of data.results || []) {
    map.set(owner.id, `${owner.firstName} ${owner.lastName}`.trim());
  }
  return map;
}
```

Then each of the 5 callers imports `syncDeal` + `fetchOwnerMap` and calls with their mode.

### Step: Each file replaces its deal-mapping code with the shared function

This is a refactoring task. For each file:
1. Import `{ syncDeal, fetchOwnerMap }` from `../_shared/hubspot-sync-core.ts`
2. Replace inline field mapping with `await syncDeal(supabase, deal, ownerMap, "full_sync")`
3. Replace inline owner fetching with `const ownerMap = await fetchOwnerMap(token)`

### Verify + Commit

```bash
git add supabase/functions/_shared/hubspot-sync-core.ts supabase/functions/sync-hubspot-to-supabase/index.ts supabase/functions/sync-single-deal/index.ts supabase/functions/backfill-deals-history/index.ts supabase/functions/hubspot-webhook/index.ts
git commit -m "refactor: consolidate 5 HubSpot sync functions into shared hubspot-sync-core"
```

---

## Task 6: UPSERT All Marketing Agents

**Score Impact:** Agent Contracts +1.5 overall

**Files:** 6 marketing agent files

### For each agent, change `.insert()` to `.upsert()` with composite key:

| Agent | Table | Composite Key |
|-------|-------|---------------|
| marketing-scout | marketing_agent_signals | `(ad_id, signal_type)` |
| marketing-analyst | marketing_recommendations | `(ad_id, action)` |
| marketing-allocator | marketing_budget_proposals | `(recommendation_id, ad_id)` |
| marketing-copywriter | creative_library | `(source_ad_id, prompt_version)` |
| marketing-predictor | marketing_fatigue_alerts | `(ad_id, alert_type)` |
| marketing-loss-analyst | loss_analysis | `(deal_id, contact_email)` |

### Pattern for each:

Replace:
```typescript
await supabase.from("table_name").insert(data);
```

With:
```typescript
await supabase.from("table_name").upsert(data, {
  onConflict: "composite_key_col1, composite_key_col2",
});
```

### Migration: Add UNIQUE constraints

```sql
-- supabase/migrations/20260213000006_marketing_upsert_keys.sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_signals_ad_type ON public.marketing_agent_signals(ad_id, signal_type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_recs_ad_action ON public.marketing_recommendations(ad_id, action);
CREATE UNIQUE INDEX IF NOT EXISTS uq_proposals_rec_ad ON public.marketing_budget_proposals(recommendation_id, ad_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_creative_ad_version ON public.creative_library(source_ad_id, prompt_version);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fatigue_ad_type ON public.marketing_fatigue_alerts(ad_id, alert_type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_loss_deal_contact ON public.loss_analysis(deal_id, contact_email);
```

### Verify + Commit

```bash
git add supabase/migrations/20260213000006_marketing_upsert_keys.sql supabase/functions/marketing-*/index.ts
git commit -m "fix: convert 6 marketing agents from INSERT to UPSERT — prevent duplicates on re-run"
```

---

## Task 7: Constitutional Framing Universal

**Score Impact:** Anti-Hallucination +1.2 overall

**Files:** 25+ agent files that call `unifiedAI.chat()` but don't import constitutional-framing

### Pattern

In each agent's main handler, before the `unifiedAI.chat()` call, add:

```typescript
import { getConstitutionalSystemMessage } from "../_shared/constitutional-framing.ts";

// In the system prompt construction:
const systemPrompt = `${getConstitutionalSystemMessage()}\n\n${existingSystemPrompt}`;
```

### Priority agents (top 10 by usage):

1. `ptd-ultimate-intelligence/index.ts`
2. `ai-ceo-master/index.ts`
3. `business-intelligence/index.ts`
4. `financial-analytics/index.ts`
5. `ad-creative-analyst/index.ts`
6. `churn-predictor/index.ts`
7. `strategic-kpi/index.ts`
8. `customer-insights/index.ts`
9. `intervention-recommender/index.ts`
10. `proactive-insights-generator/index.ts`

### Verify + Commit

```bash
git add supabase/functions/*/index.ts
git commit -m "feat: universal constitutional framing — inject SAFETY+TRUTH+PERSONA guardrails into all AI agents"
```

---

## Task 8: Context Namespacing (agent_memory per-agent)

**Score Impact:** Architecture 75 → 80 (+2.0 overall)

**Files:**
- Modify: `supabase/functions/ptd-agent-gemini/index.ts` (memory insert)
- Modify: `supabase/functions/_shared/learning-layer.ts` (memory query)
- Create: `supabase/migrations/20260213000007_memory_namespacing.sql`

### Migration

```sql
-- Add agent_name column for namespacing
ALTER TABLE public.agent_memory
  ADD COLUMN IF NOT EXISTS agent_name text DEFAULT 'ptd-agent-gemini';

ALTER TABLE public.agent_patterns
  ADD COLUMN IF NOT EXISTS agent_name text DEFAULT 'shared';

CREATE INDEX IF NOT EXISTS idx_am_agent ON public.agent_memory(agent_name);
CREATE INDEX IF NOT EXISTS idx_ap_agent ON public.agent_patterns(agent_name);
```

### Code changes

In each agent's memory INSERT, add `agent_name: "function-name"`:

```typescript
// ptd-agent-gemini: line ~472
await supabase.from("agent_memory").insert({
  agent_name: "ptd-agent-gemini",  // ADD
  thread_id: threadId,
  query,
  response: response.slice(0, 10000),
  // ...
});
```

In `learning-layer.ts` `getActiveLearnings()`, filter by agent:

```typescript
// Add optional agent_name parameter
async getActiveLearnings(query?: string, limit = 5, agentName?: string) {
  let qb = this.supabase.from("agent_learnings")...;
  // Only return learnings relevant to THIS agent or shared
  if (agentName) {
    qb = qb.or(`agent_name.eq.${agentName},agent_name.eq.shared`);
  }
  // ...
}
```

### Verify + Commit

```bash
git add supabase/migrations/20260213000007_memory_namespacing.sql supabase/functions/_shared/learning-layer.ts supabase/functions/ptd-agent-gemini/index.ts
git commit -m "feat: memory namespacing — agent_name column prevents cross-contamination"
```

---

## Task 9: Typed Errors in Auth Middleware

**Score Impact:** Error Handling +0.5 overall
**Effort:** 15 minutes

**File:** `supabase/functions/_shared/auth-middleware.ts`

### Step 1: Add imports

```typescript
import { RateLimitError, UnauthorizedError } from "./app-errors.ts";
```

### Step 2: Replace line 25

```typescript
// Before:
throw new Error("Too Many Requests");

// After:
throw new RateLimitError(60);
```

### Step 3: Replace line 38

```typescript
// Before:
throw new Error("Unauthorized: Missing Authentication Credentials");

// After:
throw new UnauthorizedError("Missing authentication credentials");
```

### Verify + Commit

```bash
git add supabase/functions/_shared/auth-middleware.ts
git commit -m "fix: use typed RateLimitError/UnauthorizedError in auth-middleware"
```

---

## Task 10: Consolidate Contacts (4 tables → 1)

**Score Impact:** Architecture 80 → 85 (+2.0 overall)
**Effort:** 6h (largest fix — data migration required)

**Files:**
- Create: `supabase/migrations/20260213000008_consolidate_contacts.sql`
- Modify: Multiple edge functions that read `enhanced_leads` or `sales_leads`

### Approach

1. Create migration that merges `enhanced_leads` and `sales_leads` into `contacts`
2. Create VIEWs named `enhanced_leads` and `sales_leads` that point to `contacts` (backwards compat)
3. Update edge functions to use `contacts` directly

### Migration

```sql
-- Step 1: Merge enhanced_leads data into contacts
INSERT INTO public.contacts (email, firstname, lastname, phone, lead_status, lifecycle_stage)
SELECT el.email, el.first_name, el.last_name, el.phone, el.status, 'lead'
FROM public.enhanced_leads el
WHERE el.email IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.email = el.email)
ON CONFLICT DO NOTHING;

-- Step 2: Create backward-compatible views
CREATE OR REPLACE VIEW public.enhanced_leads_view AS
SELECT id, email, firstname as first_name, lastname as last_name, phone, lead_status as status,
       created_at, updated_at
FROM public.contacts
WHERE lifecycle_stage IN ('lead', 'subscriber', 'marketingqualifiedlead');

-- Step 3: Rename old table (keep as backup, don't DROP)
ALTER TABLE IF EXISTS public.enhanced_leads RENAME TO enhanced_leads_deprecated;

-- Step 4: Create view with original name for backward compat
CREATE OR REPLACE VIEW public.enhanced_leads AS SELECT * FROM public.enhanced_leads_view;

GRANT SELECT ON public.enhanced_leads TO authenticated;
```

### Code changes

Grep for `.from("enhanced_leads")` and `.from("sales_leads")` across all edge functions. Replace with `.from("contacts")` and adjust column names.

### Verify + Commit

```bash
git add supabase/migrations/20260213000008_consolidate_contacts.sql supabase/functions/*/index.ts
git commit -m "refactor: consolidate 4 contact tables into 1 — enhanced_leads + sales_leads → contacts with backward-compat views"
```

---

## Execution Schedule

| Week | Fixes | Score After |
|------|-------|------------|
| Week 1 | Fix 1 (tokens) + Fix 9 (typed errors) + Fix 3 (retention) | 63.8 → 70 |
| Week 2 | Fix 2 (tool adoption) + Fix 4 (validation) | 70 → 76 |
| Week 3 | Fix 6 (UPSERT) + Fix 7 (constitutional) + Fix 8 (namespacing) | 76 → 80 |
| Week 4 | Fix 5 (HubSpot consolidation) + Fix 10 (contacts consolidation) | 80 → 82 |

---

## Verification Checklist

After ALL fixes:

- [ ] `npm run build` — 0 errors
- [ ] `getTokenBudget()` returns non-zero after any agent call
- [ ] ptd-ultimate-intelligence can execute tools (test with "show me client health data")
- [ ] ai-ceo-master uses UnifiedAI (no raw fetch to Gemini)
- [ ] `cleanup-agent-memory` runs without errors
- [ ] All 6 marketing agents: re-running produces 0 duplicate rows
- [ ] Constitutional framing appears in system prompt of 10+ agents
- [ ] `agent_memory` rows have `agent_name` column populated
- [ ] `auth-middleware.ts` throws typed `RateLimitError`
- [ ] `enhanced_leads` VIEW works (backward compat)
