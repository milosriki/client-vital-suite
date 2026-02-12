# Intelligence Upgrade — Corrected Execution Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the 35-point gap between infrastructure quality (82/100) and agent intelligence (46.7/100) through 10 targeted fixes — corrected against actual codebase.

**Architecture:** All fixes modify the Supabase Edge Function layer (`supabase/functions/`). No frontend changes except Task 10 (DEFERRED). Fixes grouped into 4 batches by dependency and risk.

**Tech Stack:** Deno/TypeScript, Supabase Edge Functions, Google Generative AI SDK, PostgreSQL

**Evaluation Score (Pre-Correction):** 55/100 — 20 HIGH issues, 5 blockers found. This plan addresses ALL of them.

**Revised Effort:** ~45-55h (was 27h — 60-110% underestimate corrected)

---

## Batch 1 — Ready Now (1-2h total)

### Task 9: Typed Errors in Auth Middleware

**Score:** 5/5 (READY as-is — zero corrections needed)
**Score Impact:** Error Handling +0.5 overall
**Effort:** 15 minutes

**Files:**
- Modify: `supabase/functions/_shared/auth-middleware.ts`

**Step 1: Add imports**

At the top of the file, add:

```typescript
import { RateLimitError, UnauthorizedError } from "./app-errors.ts";
```

**Step 2: Replace rate limit error (line 25)**

```typescript
// Before:
throw new Error("Too Many Requests");

// After:
throw new RateLimitError(60);
```

**Step 3: Replace auth error (line 38)**

```typescript
// Before:
throw new Error("Unauthorized: Missing Authentication Credentials");

// After:
throw new UnauthorizedError("Missing authentication credentials");
```

**Step 4: Verify**

```bash
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" npx vite build
```
Expected: 0 errors

**Step 5: Commit**

```bash
git add supabase/functions/_shared/auth-middleware.ts
git commit -m "fix: use typed RateLimitError/UnauthorizedError in auth-middleware"
```

**Rollback:** Revert the two throw lines to `new Error(...)`.

---

### Task 7: Constitutional Framing Universal

**Original Score:** 4/5 — needs agent list refinement
**Score Impact:** Anti-Hallucination +1.2 overall
**Effort:** 3-4h (was 1h — 28 agents need updating, not "25+")

**CORRECTION:** The original plan didn't identify which agents already have constitutional framing. Verified analysis:

| Status | Count | Mechanism |
|--------|-------|-----------|
| ✅ Already covered | 9 | Via `buildAgentPrompt()` in unified-prompts.ts line 410 |
| ❌ Missing (active) | 20 | Direct `unifiedAI.chat()` without constitutional framing |
| ❌ Missing (archived) | 8 | In `_archive/` — skip these |

**CRITICAL FINDING:** `buildUnifiedPromptForEdgeFunction()` in unified-prompts.ts does NOT include constitutional framing. Both `ptd-agent-gemini` and `ptd-agent-atlas` use this function.

**Files:**
- Modify: `supabase/functions/_shared/unified-prompts.ts` (add constitutional to `buildUnifiedPromptForEdgeFunction`)
- Modify: 18 active agent `index.ts` files (add direct import)

**Step 1: Fix the shared prompt chain**

In `supabase/functions/_shared/unified-prompts.ts`, find `buildUnifiedPromptForEdgeFunction()` (around line 474). Add constitutional framing to its output:

```typescript
// At the top of the function, add:
const constitutional = getConstitutionalSystemMessage();

// In the returned prompt template, prepend:
return `${constitutional}\n\n${existingPromptContent}`;
```

This automatically covers: `ptd-agent-gemini`, `ptd-agent-atlas`

**Step 2: Add direct import to 18 active agents missing constitutional framing**

For each agent listed below, add at the top:

```typescript
import { getConstitutionalSystemMessage } from "../_shared/constitutional-framing.ts";
```

Then in the system prompt construction (before `unifiedAI.chat()`), prepend:

```typescript
const systemPrompt = `${getConstitutionalSystemMessage()}\n\n${existingSystemPrompt}`;
```

**Agents to update (20 total, 2 fixed by Step 1):**

| # | Agent | File |
|---|-------|------|
| 1 | ai-ceo-master | `ai-ceo-master/index.ts` |
| 2 | ai-learning-loop | `ai-learning-loop/index.ts` |
| 3 | aisensy-orchestrator | `aisensy-orchestrator/index.ts` |
| 4 | antigravity-followup-engine | `antigravity-followup-engine/index.ts` |
| 5 | agent-orchestrator | `agent-orchestrator/index.ts` |
| 6 | client-payment-integrity | `client-payment-integrity/index.ts` |
| 7 | customer-insights | `customer-insights/index.ts` |
| 8 | dialogflow-fulfillment | `dialogflow-fulfillment/index.ts` |
| 9 | error-resolution-agent | `error-resolution-agent/index.ts` |
| 10 | financial-analytics | `financial-analytics/index.ts` |
| 11 | generate-embeddings | `generate-embeddings/index.ts` |
| 12 | generate-lead-replies | `generate-lead-replies/index.ts` |
| 13 | generate-lead-reply | `generate-lead-reply/index.ts` |
| 14 | migrate-knowledge | `migrate-knowledge/index.ts` |
| 15 | process-knowledge | `process-knowledge/index.ts` |
| 16 | ptd-brain-api | `ptd-brain-api/index.ts` |
| 17 | ptd-skill-auditor | `ptd-skill-auditor/index.ts` |
| 18 | rds-data-analyst | `rds-data-analyst/index.ts` |
| 19 | strategic-kpi | `strategic-kpi/index.ts` |
| — | ptd-ultimate-intelligence | Already has direct import (line 642) ✅ |

**SKIP these (non-conversational utility agents where constitutional framing adds no value):**
- `generate-embeddings` — embedding generation only, no natural language output
- `migrate-knowledge` — data migration script, no user-facing output
- `process-knowledge` — knowledge processing pipeline

Revised count: **16 agents + 1 shared file = 17 file edits**

**Step 3: Verify**

```bash
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" npx vite build
```
Expected: 0 errors

**Step 4: Commit**

```bash
git add supabase/functions/_shared/unified-prompts.ts supabase/functions/*/index.ts
git commit -m "feat: universal constitutional framing — inject SAFETY+TRUTH+PERSONA into 20 agents"
```

**Rollback:** Remove the import line and `getConstitutionalSystemMessage()` call from each file.

---

## Batch 2 — Minor Fixes Needed (6h total)

### Task 1: Wire Token Budget Tracker

**Original Score:** 3/5
**Score Impact:** Context Efficiency 42 → 65 (+9.2 overall)
**Effort:** 2h

**CORRECTIONS from evaluation:**
1. ~~`this.supabase`~~ → UnifiedAIClient stores `supabaseUrl` and `supabaseKey` as strings, NOT a SupabaseClient. Must create a client instance for DB logging.
2. `costUsd` was scoped inside `if (usageMetadata)` block but referenced outside in the return. Fix scoping.
3. Need to declare `usageMetadata` variable outside the block for return statement access.

**Files:**
- Modify: `supabase/functions/_shared/unified-ai-client.ts`
- Create: `supabase/migrations/20260213000004_token_usage_metrics.sql`

**Step 1: Create the migration**

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

**Rollback SQL:**
```sql
DROP TABLE IF EXISTS public.token_usage_metrics;
```

**Step 2: Update AIResponse interface**

In `supabase/functions/_shared/unified-ai-client.ts`, find the `AIResponse` interface (lines 20-31). Add two fields:

```typescript
export interface AIResponse {
  content: string;
  thought?: string;
  thoughtSignature?: string;
  tool_calls?: {
    id: string;
    name: string;
    input: any;
  }[];
  provider: "gemini" | "anthropic" | "openai";
  model: string;
  tokens_used?: number;    // ADD
  cost_usd?: number;       // ADD
}
```

**Step 3: Extract usageMetadata in callGemini()**

In `callGemini()` method, after `const response = await result.response;` (line ~323), add token extraction. **CRITICAL:** Declare variables at method scope, not inside `if`:

```typescript
// After: const response = await result.response;
// Add:
const usageMeta = response.usageMetadata;
let tokensUsed: number | undefined;
let costUsd: number | undefined;

if (usageMeta) {
  const promptTokens = usageMeta.promptTokenCount || 0;
  const completionTokens = usageMeta.candidatesTokenCount || 0;
  tokensUsed = promptTokens + completionTokens;

  // Increment in-memory budget
  this.tokenBudget.totalTokens += tokensUsed;

  // Cost lookup (Gemini pricing per 1M tokens)
  const inputCostPer1M = modelName.includes("flash") ? 0.10 : 3.00;
  const outputCostPer1M = modelName.includes("flash") ? 0.40 : 15.00;
  costUsd = (promptTokens * inputCostPer1M + completionTokens * outputCostPer1M) / 1_000_000;
  this.tokenBudget.totalCost += costUsd;

  // Fire-and-forget token logging — telemetry must never break agents
  // CORRECTED: Create a SupabaseClient from stored URL/key (class has strings, not a client)
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sb = createClient(this.supabaseUrl, this.supabaseKey);
    sb.from("token_usage_metrics").insert({
      function_name: options?.functionName || "unknown",
      model_used: modelName,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: tokensUsed,
      estimated_cost_usd: costUsd,
      correlation_id: options?.correlationId,
    }).then(() => {}).catch(() => {}); // Swallow errors
  } catch { /* ignore import failures */ }
}
```

**Step 4: Add tokens to return statement**

In the return statement of `callGemini()` (line ~355), add the two new fields:

```typescript
return {
  content: text,
  thought: thinkingText || undefined,
  thoughtSignature: response.thoughtSignature || undefined,
  tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
  provider: "gemini",
  model: modelName,
  tokens_used: tokensUsed,   // ADD (declared at method scope)
  cost_usd: costUsd,         // ADD (declared at method scope)
};
```

**Step 5: Add functionName/correlationId to AIOptions**

Find the `AIOptions` interface and add:

```typescript
functionName?: string;
correlationId?: string;
```

**Step 6: Verify**

```bash
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" npx vite build
```
Expected: 0 errors

**Step 7: Commit**

```bash
git add supabase/migrations/20260213000004_token_usage_metrics.sql supabase/functions/_shared/unified-ai-client.ts
git commit -m "feat: wire token budget tracker — extract Gemini usageMetadata, track cost per call"
```

**Rollback:** Remove the added code blocks. Revert AIResponse and AIOptions interfaces.

---

### Task 3 + Task 8 COMBINED: Memory Retention + Context Namespacing

**Original Score:** Task 3: 2/5, Task 8: 3/5
**Score Impact:** Learning Loop 38 → 58, Architecture 75 → 80 (+6.0 overall)
**Effort:** 4h combined

**WHY COMBINED:** Both modify `supabase/functions/_shared/learning-layer.ts`. Separate implementation causes merge conflicts (identified in evaluation).

**CORRECTIONS from evaluation:**
1. ~~`agent_patterns.last_confirmed_at`~~ → actual column: `last_used_at` (verified in types.ts line 340)
2. ~~`getActiveLearnings(query, limit)`~~ → actual signature: `getActiveLearnings(limit = 5)` — no query parameter exists yet
3. `agent_conversations` schema: `id, session_id, role, content, created_at, user_id` — verify `expires_at` can be added
4. `agent_decisions` schema: has `created_at` — verify `expires_at` can be added
5. `agent_learnings` table: verify it exists and has `agent_name` column or not

**Files:**
- Modify: `supabase/functions/_shared/learning-layer.ts`
- Modify: `supabase/functions/ptd-agent-gemini/index.ts` (memory insert)
- Create: `supabase/migrations/20260213000005_memory_retention_and_namespacing.sql` (MERGED migration)
- Create: `supabase/functions/cleanup-agent-memory/index.ts`

**Step 1: Create the MERGED migration**

```sql
-- supabase/migrations/20260213000005_memory_retention_and_namespacing.sql
-- Combines retention TTL (Task 3) + namespacing (Task 8) to avoid multiple ALTERs

-- === RETENTION: Add TTL columns ===

ALTER TABLE public.agent_memory
  ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.agent_conversations
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.agent_decisions
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Backfill existing rows with expiry
-- agent_memory: 90 days
-- agent_conversations: 180 days (was 30d in some docs — using 180d per evaluation reconciliation)
-- agent_decisions: 365 days
-- agent_learnings: NEVER (human feedback is precious)
-- agent_patterns: NEVER (learned behaviors are precious)

UPDATE public.agent_memory
  SET expires_at = created_at + INTERVAL '90 days'
  WHERE expires_at IS NULL AND created_at IS NOT NULL;

UPDATE public.agent_conversations
  SET expires_at = created_at + INTERVAL '180 days'
  WHERE expires_at IS NULL AND created_at IS NOT NULL;

UPDATE public.agent_decisions
  SET expires_at = created_at + INTERVAL '365 days'
  WHERE expires_at IS NULL AND created_at IS NOT NULL;

-- Retention indexes
CREATE INDEX IF NOT EXISTS idx_am_expires ON public.agent_memory(expires_at) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_ac_expires ON public.agent_conversations(expires_at);
CREATE INDEX IF NOT EXISTS idx_ad_expires ON public.agent_decisions(expires_at);

-- === NAMESPACING: Add agent_name columns ===

ALTER TABLE public.agent_memory
  ADD COLUMN IF NOT EXISTS agent_name text DEFAULT 'ptd-agent-gemini';

ALTER TABLE public.agent_patterns
  ADD COLUMN IF NOT EXISTS agent_name text DEFAULT 'shared';

ALTER TABLE public.agent_learnings
  ADD COLUMN IF NOT EXISTS agent_name text DEFAULT 'shared';

-- Namespacing indexes
CREATE INDEX IF NOT EXISTS idx_am_agent ON public.agent_memory(agent_name);
CREATE INDEX IF NOT EXISTS idx_ap_agent ON public.agent_patterns(agent_name);
CREATE INDEX IF NOT EXISTS idx_al_agent ON public.agent_learnings(agent_name);

COMMENT ON COLUMN public.agent_memory.expires_at IS 'Auto-set on insert. NULL = never expires. 90d default.';
COMMENT ON COLUMN public.agent_memory.agent_name IS 'Function name for context isolation. Prevents cross-agent memory pollution.';
```

**Rollback SQL:**
```sql
ALTER TABLE public.agent_memory DROP COLUMN IF EXISTS archived;
ALTER TABLE public.agent_memory DROP COLUMN IF EXISTS expires_at;
ALTER TABLE public.agent_memory DROP COLUMN IF EXISTS agent_name;
ALTER TABLE public.agent_conversations DROP COLUMN IF EXISTS expires_at;
ALTER TABLE public.agent_decisions DROP COLUMN IF EXISTS expires_at;
ALTER TABLE public.agent_patterns DROP COLUMN IF EXISTS agent_name;
ALTER TABLE public.agent_learnings DROP COLUMN IF EXISTS agent_name;
DROP INDEX IF EXISTS idx_am_expires;
DROP INDEX IF EXISTS idx_ac_expires;
DROP INDEX IF EXISTS idx_ad_expires;
DROP INDEX IF EXISTS idx_am_agent;
DROP INDEX IF EXISTS idx_ap_agent;
DROP INDEX IF EXISTS idx_al_agent;
```

**Step 2: Create cleanup edge function**

```typescript
// supabase/functions/cleanup-agent-memory/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
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

  // 4. Decay low-confidence patterns not used in 60 days
  // CORRECTED: column is `last_used_at` (NOT `last_confirmed_at`)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { count: patternsDecayed } = await supabase
    .from("agent_patterns")
    .update({ confidence: 0.1 })
    .lt("confidence", 0.5)
    .lt("last_used_at", sixtyDaysAgo);
  results.agent_patterns_decayed = patternsDecayed || 0;

  console.log("[cleanup-agent-memory] Results:", JSON.stringify(results));

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**Step 3: Update learning-layer.ts (COMBINED: relevance + namespacing)**

In `supabase/functions/_shared/learning-layer.ts`, replace `getActiveLearnings()`:

```typescript
// BEFORE (current signature): async getActiveLearnings(limit = 5): Promise<string>
// AFTER (expanded): adds query relevance + agent namespacing

async getActiveLearnings(limit = 5, agentName?: string): Promise<string> {
  let queryBuilder = this.supabase
    .from("agent_learnings")
    .select("content, category, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Namespace: only return learnings relevant to THIS agent or shared
  if (agentName) {
    queryBuilder = queryBuilder.or(`agent_name.eq.${agentName},agent_name.eq.shared,agent_name.is.null`);
  }

  const { data } = await queryBuilder;

  if (!data || data.length === 0) return "";

  const items = data.map((l: any) => `- [${l.category}] ${l.content}`).join("\n");
  return `<evolutionary_memory>\nTHE USER HAS PREVIOUSLY CORRECTED YOU. DO NOT REPEAT THESE MISTAKES:\n${items}\n</evolutionary_memory>`;
}
```

**Step 4: Add agent_name + expires_at to ptd-agent-gemini memory INSERT**

In `supabase/functions/ptd-agent-gemini/index.ts`, find the `agent_memory` insert (around line 472). Add:

```typescript
await supabase.from("agent_memory").insert({
  agent_name: "ptd-agent-gemini",  // ADD - namespacing
  expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),  // ADD - 90d TTL
  thread_id: threadId,
  query,
  response: response.slice(0, 10000),
  // ... existing fields
});
```

**Step 5: Add expires_at to ai-ceo-master conversation INSERT**

In `supabase/functions/ai-ceo-master/index.ts`, find `agent_conversations` insert (around line 116). Add:

```typescript
expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),  // 180d TTL
```

**Step 6: Register cleanup as pg_cron (document for deploy)**

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

**Step 7: Verify + Commit**

```bash
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" npx vite build
```

```bash
git add supabase/migrations/20260213000005_memory_retention_and_namespacing.sql \
  supabase/functions/cleanup-agent-memory/index.ts \
  supabase/functions/_shared/learning-layer.ts \
  supabase/functions/ptd-agent-gemini/index.ts \
  supabase/functions/ai-ceo-master/index.ts
git commit -m "feat: memory retention + context namespacing — 90d memory TTL, agent isolation, nightly cleanup"
```

**Rollback:** Run the rollback SQL above. Revert `learning-layer.ts` signature. Remove `agent_name`/`expires_at` from INSERTs.

---

## Batch 3 — Rewrite Required (12-16h total)

### Task 2: Universal Tool Adoption (ptd-ultimate-intelligence + ai-ceo-master)

**Original Score:** 1/5 (REWRITE)
**Score Impact:** Architecture 52 → 68, Tool Adoption 40 → 65 (+8.9 overall)
**Effort:** 8-12h (was 4h)

**CRITICAL CORRECTIONS from evaluation:**
1. ~~`import { getToolDefinitions }`~~ → actual export: `import { tools } from "../_shared/tool-definitions.ts"`
2. ~~ai-ceo-master uses raw `fetch()` to Gemini~~ → **FALSE**. It already imports `unifiedAI` (line 22) and calls `unifiedAI.chat()` (line 273). No raw fetch exists.
3. ~~`generateWithGemini(systemPrompt, command, supabase)`~~ → actual signature: `generateWithGemini(command, context, persona, parentRun, isCodeRequest)` (line 238)
4. ptd-ultimate-intelligence already uses `unifiedAI.chat()` (line 648). Just needs tool injection.

**REVISED SCOPE:** Don't replace AI call patterns. Just ADD tool support to existing `unifiedAI.chat()` calls.

**Files:**
- Modify: `supabase/functions/ptd-ultimate-intelligence/index.ts`
- Modify: `supabase/functions/ai-ceo-master/index.ts`
- Reference: `supabase/functions/ptd-agent-gemini/index.ts` (agentic loop pattern)

**Step 1: Add tool import to ptd-ultimate-intelligence**

At the top of `ptd-ultimate-intelligence/index.ts`, add:

```typescript
import { tools } from "../_shared/tool-definitions.ts";
import { executeSharedTool } from "../_shared/tool-executor.ts";
```

**Step 2: Add agentic loop to ptd-ultimate-intelligence**

Find `generateWithClaude()` (line 629). The current call is:

```typescript
response = await unifiedAI.chat(
  [
    { role: "system", content: systemPrompt },
    { role: "user", content: query },
  ],
  {
    max_tokens: 4000,
    temperature: 0.7,
  },
);
```

Replace with tool-enabled agentic loop:

```typescript
// Filter tools appropriate for this intelligence persona
const intelligenceTools = tools.filter(t =>
  ["intelligence_control", "client_control", "revenue_intelligence",
   "command_center_control", "universal_search"].includes(t.name)
);

const messages = [
  { role: "system" as const, content: systemPrompt },
  { role: "user" as const, content: query },
];

const MAX_LOOPS = 3;
const MAX_TOOL_RESULT_CHARS = 3000;

let currentResponse = await unifiedAI.chat(messages, {
  max_tokens: 4000,
  temperature: 0.7,
  tools: intelligenceTools,
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
      const toolResult = typeof rawResult === "string"
        ? (rawResult.length > MAX_TOOL_RESULT_CHARS
            ? rawResult.slice(0, MAX_TOOL_RESULT_CHARS) + `\n... [truncated]`
            : rawResult)
        : JSON.stringify(rawResult).slice(0, MAX_TOOL_RESULT_CHARS);
      toolResults.push(`Tool '${toolCall.name}' Result:\n${toolResult}`);
    } catch (err: any) {
      toolResults.push(`Tool '${toolCall.name}' failed: ${err.message}`);
    }
  }

  messages.push({ role: "assistant" as const, content: currentResponse.content || "(Calling tools...)" });
  messages.push({ role: "user" as const, content: `Tool results (Loop ${loopCount}):\n\n${toolResults.join("\n\n---\n\n")}\n\nUse these results for an accurate, data-driven answer.` });

  currentResponse = await unifiedAI.chat(messages, {
    max_tokens: 4000,
    temperature: 0.7,
    tools: intelligenceTools,
  });
}

response = currentResponse;
```

**NOTE:** `supabase` variable must be in scope. Check that the enclosing function has access to the Supabase client. If not, pass it through from the handler.

**Step 3: Add tool support to ai-ceo-master**

At the top of `ai-ceo-master/index.ts`, add:

```typescript
import { tools } from "../_shared/tool-definitions.ts";
import { executeSharedTool } from "../_shared/tool-executor.ts";
```

In `generateWithGemini()` (line 238), find the `unifiedAI.chat()` call (line 273). Add tools and loop:

```typescript
// CORRECTED: Keep the existing function signature
// async function generateWithGemini(command, context, persona, parentRun, isCodeRequest)

const ceoTools = tools.filter(t =>
  ["intelligence_control", "revenue_intelligence", "stripe_forensics",
   "command_center_control", "universal_search"].includes(t.name)
);

const messages = [
  { role: "system" as const, content: systemPrompt },
  { role: "user" as const, content: `QUERY: ${command}` },
];

const MAX_LOOPS = 3;
const MAX_TOOL_RESULT_CHARS = 3000;

let response = await unifiedAI.chat(messages, {
  model: "gemini-2.0-flash",
  temperature: 0.2,
  jsonMode: true,
  tools: ceoTools,
});

let loopCount = 0;
while (response.tool_calls?.length && loopCount < MAX_LOOPS) {
  loopCount++;
  const toolResults: string[] = [];

  for (const tc of response.tool_calls) {
    try {
      const raw = await executeSharedTool(supabase, tc.name, tc.input);
      const result = typeof raw === "string"
        ? (raw.length > MAX_TOOL_RESULT_CHARS
            ? raw.slice(0, MAX_TOOL_RESULT_CHARS) + "\n... [truncated]"
            : raw)
        : JSON.stringify(raw).slice(0, MAX_TOOL_RESULT_CHARS);
      toolResults.push(`Tool '${tc.name}':\n${result}`);
    } catch (e: any) {
      toolResults.push(`Tool '${tc.name}' failed: ${e.message}`);
    }
  }

  messages.push({ role: "assistant" as const, content: response.content || "(Calling tools...)" });
  messages.push({ role: "user" as const, content: `Tool results:\n\n${toolResults.join("\n\n---\n\n")}` });

  response = await unifiedAI.chat(messages, {
    model: "gemini-2.0-flash",
    temperature: 0.2,
    jsonMode: true,
    tools: ceoTools,
  });
}
```

**NOTE:** Must verify that `supabase` is accessible inside `generateWithGemini()`. If not, add it as a parameter.

**Step 4: Verify that unifiedAI.chat() supports `tools` option**

Check that the `AIOptions` interface in `unified-ai-client.ts` has a `tools` field. If not, add:

```typescript
// In AIOptions interface:
tools?: any[];
```

And in `callGemini()`, pass tools to the Gemini API call if present:

```typescript
// In the model.generateContent() call, add tools:
if (options.tools && options.tools.length > 0) {
  // Add tools to the Gemini request config
}
```

**This step requires reading the actual Gemini tool-calling integration in callGemini(). Do NOT skip this.**

**Step 5: Verify**

```bash
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" npx vite build
```
Expected: 0 errors

**Step 6: Test (runtime)**

Deploy to staging. Test with:
- ptd-ultimate-intelligence: "Show me today's client health data" → should trigger `intelligence_control` tool
- ai-ceo-master: "What's our ROAS by campaign this week?" → should trigger `command_center_control` tool

**Step 7: Commit**

```bash
git add supabase/functions/ptd-ultimate-intelligence/index.ts supabase/functions/ai-ceo-master/index.ts supabase/functions/_shared/unified-ai-client.ts
git commit -m "feat: universal tool adoption — ptd-ultimate-intelligence + ai-ceo-master now use agentic loop"
```

**Rollback:** Remove tool imports and loop code. Restore single `unifiedAI.chat()` calls.

---

### Task 4 + Task 6 COMBINED: Output Validation + UPSERT Marketing Agents

**Original Score:** Task 4: 3/5, Task 6: 2/5
**Score Impact:** Validation 15 → 55, Agent Contracts +1.5 (+7.9 overall)
**Effort:** 4h combined

**WHY COMBINED:** Both modify the same 5-6 marketing agent files. Separate implementation is fragile.

**CORRECTIONS from evaluation:**
1. ~~`JSON.parse(raw)`~~ → **WRONG approach**. Marketing agents build data objects programmatically via decision-tree logic. They do NOT parse LLM JSON strings. Validators should validate the output OBJECT (not parse a string).
2. Task 6 UNIQUE INDEX: Must add dedup DELETE before CREATE UNIQUE INDEX — existing duplicates will crash the migration.
3. marketing-copywriter already has `validateCopyOutput()` (line 66) — it's the reference implementation.

**REVISED APPROACH:** Object validators (type guards), not JSON parsers.

**Files:**
- Modify: `supabase/functions/marketing-scout/index.ts`
- Modify: `supabase/functions/marketing-analyst/index.ts`
- Modify: `supabase/functions/marketing-allocator/index.ts`
- Modify: `supabase/functions/marketing-predictor/index.ts`
- Modify: `supabase/functions/marketing-loss-analyst/index.ts`
- Modify: `supabase/functions/marketing-copywriter/index.ts`
- Create: `supabase/migrations/20260213000006_marketing_upsert_keys.sql`

**Step 1: Migration with DEDUP + UNIQUE indexes**

```sql
-- supabase/migrations/20260213000006_marketing_upsert_keys.sql

-- CRITICAL: Remove duplicates BEFORE creating UNIQUE indexes
-- Without this, CREATE UNIQUE INDEX fails on tables with existing dupes

-- Dedup marketing_agent_signals: keep newest per (ad_id, signal_type)
DELETE FROM public.marketing_agent_signals a
USING public.marketing_agent_signals b
WHERE a.id < b.id
  AND a.ad_id = b.ad_id
  AND a.signal_type = b.signal_type;

-- Dedup marketing_recommendations: keep newest per (ad_id, action)
DELETE FROM public.marketing_recommendations a
USING public.marketing_recommendations b
WHERE a.id < b.id
  AND a.ad_id = b.ad_id
  AND a.action = b.action;

-- Dedup marketing_budget_proposals: keep newest per (recommendation_id, ad_id)
DELETE FROM public.marketing_budget_proposals a
USING public.marketing_budget_proposals b
WHERE a.id < b.id
  AND a.recommendation_id = b.recommendation_id
  AND a.ad_id = b.ad_id;

-- Dedup creative_library: keep newest per (source_ad_id, prompt_version)
DELETE FROM public.creative_library a
USING public.creative_library b
WHERE a.id < b.id
  AND a.source_ad_id = b.source_ad_id
  AND a.prompt_version = b.prompt_version;

-- Dedup marketing_fatigue_alerts: keep newest per (ad_id, alert_type)
DELETE FROM public.marketing_fatigue_alerts a
USING public.marketing_fatigue_alerts b
WHERE a.id < b.id
  AND a.ad_id = b.ad_id
  AND a.alert_type = b.alert_type;

-- Dedup loss_analysis: keep newest per (deal_id, contact_email)
-- Note: deal_id may be NULL — use COALESCE
DELETE FROM public.loss_analysis a
USING public.loss_analysis b
WHERE a.id < b.id
  AND COALESCE(a.deal_id, '') = COALESCE(b.deal_id, '')
  AND a.contact_email = b.contact_email;

-- NOW create UNIQUE indexes (safe after dedup)
CREATE UNIQUE INDEX IF NOT EXISTS uq_signals_ad_type
  ON public.marketing_agent_signals(ad_id, signal_type);

CREATE UNIQUE INDEX IF NOT EXISTS uq_recs_ad_action
  ON public.marketing_recommendations(ad_id, action);

CREATE UNIQUE INDEX IF NOT EXISTS uq_proposals_rec_ad
  ON public.marketing_budget_proposals(recommendation_id, ad_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_creative_ad_version
  ON public.creative_library(source_ad_id, prompt_version);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fatigue_ad_type
  ON public.marketing_fatigue_alerts(ad_id, alert_type);

CREATE UNIQUE INDEX IF NOT EXISTS uq_loss_deal_contact
  ON public.loss_analysis(COALESCE(deal_id, ''), contact_email);
```

**Rollback SQL:**
```sql
DROP INDEX IF EXISTS uq_signals_ad_type;
DROP INDEX IF EXISTS uq_recs_ad_action;
DROP INDEX IF EXISTS uq_proposals_rec_ad;
DROP INDEX IF EXISTS uq_creative_ad_version;
DROP INDEX IF EXISTS uq_fatigue_ad_type;
DROP INDEX IF EXISTS uq_loss_deal_contact;
-- Note: Deleted duplicates cannot be restored. Take a backup before running migration.
```

**Step 2: Convert INSERT → UPSERT in each agent**

For each agent, change `.insert(data)` to `.upsert(data, { onConflict: "key1, key2" })`:

| Agent | Line | Table | Conflict Key |
|-------|------|-------|-------------|
| marketing-scout | 191 | marketing_agent_signals | `ad_id, signal_type` |
| marketing-analyst | 176 | marketing_recommendations | `ad_id, action` |
| marketing-allocator | 158 | marketing_budget_proposals | `recommendation_id, ad_id` |
| marketing-predictor | 237 | marketing_fatigue_alerts | `ad_id, alert_type` |
| marketing-loss-analyst | 341 | loss_analysis | `deal_id, contact_email` |
| marketing-copywriter | 184 | creative_library | `source_ad_id, prompt_version` |

Example pattern (apply to each):

```typescript
// Before:
const { error: insertErr } = await supabase
  .from("marketing_agent_signals")
  .insert(signals);

// After:
const { error: insertErr } = await supabase
  .from("marketing_agent_signals")
  .upsert(signals, { onConflict: "ad_id, signal_type" });
```

**Step 3: Add object validators to 5 agents (NOT JSON.parse)**

**CORRECTED APPROACH:** These agents build objects programmatically. Validators check the finished object BEFORE insert, not parse LLM strings.

**marketing-scout** — add before `.upsert()` at line 191:

```typescript
function validateSignals(signals: any[]): any[] {
  return signals.filter(s => {
    if (!s.signal_type || !["fatigue", "ghost_spike", "new_winner", "spend_anomaly"].includes(s.signal_type)) {
      console.warn("[Scout] Dropping invalid signal: missing/invalid signal_type");
      return false;
    }
    if (!s.ad_id) {
      console.warn("[Scout] Dropping signal: missing ad_id");
      return false;
    }
    if (!s.severity || !["info", "warning", "critical", "opportunity"].includes(s.severity)) {
      console.warn("[Scout] Dropping signal: invalid severity");
      return false;
    }
    return true;
  });
}

// Use: const validSignals = validateSignals(signals);
// Then: .upsert(validSignals, ...)
```

**marketing-analyst** — add before `.upsert()` at line 176:

```typescript
function validateRecommendations(recs: any[]): any[] {
  return recs.filter(r => {
    if (!r.action || !["SCALE", "HOLD", "WATCH", "KILL", "REFRESH"].includes(r.action)) {
      console.warn("[Analyst] Dropping rec: invalid action", r.action);
      return false;
    }
    if (typeof r.confidence !== "number" || r.confidence < 0 || r.confidence > 1) {
      console.warn("[Analyst] Dropping rec: invalid confidence", r.confidence);
      return false;
    }
    if (!r.ad_id) {
      console.warn("[Analyst] Dropping rec: missing ad_id");
      return false;
    }
    return true;
  });
}
```

**marketing-allocator** — add before `.upsert()` at line 158:

```typescript
function validateProposals(proposals: any[]): any[] {
  return proposals.filter(p => {
    if (typeof p.proposed_daily_budget !== "number" || p.proposed_daily_budget < 0) {
      console.warn("[Allocator] Dropping proposal: invalid budget", p.proposed_daily_budget);
      return false;
    }
    if (!p.action || !["increase", "decrease", "pause", "maintain"].includes(p.action)) {
      console.warn("[Allocator] Dropping proposal: invalid action", p.action);
      return false;
    }
    return true;
  });
}
```

**marketing-predictor** — add before `.upsert()` at line 237:

```typescript
function validateAlerts(alerts: any[]): any[] {
  return alerts.filter(a => {
    if (typeof a.projected_roas_30d !== "number") {
      console.warn("[Predictor] Dropping alert: missing projected_roas_30d");
      return false;
    }
    if (!a.alert_type || !["fatigue", "opportunity", "trend_reversal"].includes(a.alert_type)) {
      console.warn("[Predictor] Dropping alert: invalid alert_type", a.alert_type);
      return false;
    }
    if (!a.ad_id) {
      console.warn("[Predictor] Dropping alert: missing ad_id");
      return false;
    }
    return true;
  });
}
```

**marketing-loss-analyst** — add before `.insert()` at line 341:

```typescript
function validateLosses(losses: any[]): any[] {
  return losses.filter(l => {
    if (!l.primary_loss_reason || typeof l.primary_loss_reason !== "string") {
      console.warn("[Loss Analyst] Dropping loss: missing primary_loss_reason");
      return false;
    }
    if (typeof l.confidence_pct !== "number" || l.confidence_pct < 0 || l.confidence_pct > 100) {
      console.warn("[Loss Analyst] Dropping loss: invalid confidence_pct", l.confidence_pct);
      return false;
    }
    if (!l.contact_email) {
      console.warn("[Loss Analyst] Dropping loss: missing contact_email");
      return false;
    }
    return true;
  });
}
```

**Step 4: Verify**

```bash
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" npx vite build
```
Expected: 0 errors

**Step 5: Commit**

```bash
git add supabase/migrations/20260213000006_marketing_upsert_keys.sql \
  supabase/functions/marketing-scout/index.ts \
  supabase/functions/marketing-analyst/index.ts \
  supabase/functions/marketing-allocator/index.ts \
  supabase/functions/marketing-predictor/index.ts \
  supabase/functions/marketing-loss-analyst/index.ts \
  supabase/functions/marketing-copywriter/index.ts
git commit -m "feat: output validation + UPSERT for 6 marketing agents — dedup migration + object validators"
```

**Rollback:** Revert `.upsert()` to `.insert()`. Run rollback SQL.

---

## Batch 4 — Major Rewrite Required (22-32h total)

### Task 5: Consolidate HubSpot Sync (5 → 1 shared core)

**Original Score:** 2/5 (REWRITE)
**Score Impact:** Architecture 68 → 75 (+2.8 overall)
**Effort:** 6-8h (was 4h)

**CRITICAL CORRECTIONS from evaluation:**
1. 6/10 `deals` column names in the original plan were WRONG:
   - ~~`deal_stage`~~ → actual: `stage`
   - ~~`owner_id` (from hubspot_owner_id)~~ → actual: column exists but maps differently
   - ~~`create_date`~~ → actual: `created_at`
   - ~~`last_modified`~~ → actual: `updated_at`
   - ~~`owner_name` (from owner map)~~ → actual: column exists as `owner_name`
   - ~~`sync_source`~~ → **DOES NOT EXIST** in deals table
2. 3 existing shared HubSpot modules exist but are unused:
   - `_shared/hubspot-manager.ts` — HubSpotManager class with retry/rate limiting
   - `_shared/hubspot-sync-manager.ts` — HubSpotSyncManager with batch/queue
   - `_shared/providers/hubspot_provider.ts` — WhatsApp messaging provider
3. `sync-hubspot-to-supabase` maps **91 fields** for contacts — the original plan showed 10.
4. The 4 sync callers each have DIFFERENT conflict keys:
   - sync-hubspot: `hubspot_deal_id`
   - sync-single-deal: `hubspot_deal_id`
   - hubspot-webhook: `hubspot_id` (DIFFERENT!)
   - backfill-deals: `hubspot_deal_id`
5. hubspot-webhook writes to 3 tables (deals, leads, appointments) — not just deals.

**REVISED APPROACH:** Instead of creating a new `hubspot-sync-core.ts`, extend the existing `hubspot-manager.ts` with a `syncDeal()` method. This avoids introducing a 4th shared HubSpot module.

**Files:**
- Modify: `supabase/functions/_shared/hubspot-manager.ts` (add `syncDeal()`)
- Modify: `supabase/functions/sync-single-deal/index.ts`
- Modify: `supabase/functions/backfill-deals-history/index.ts`
- Modify: `supabase/functions/hubspot-webhook/index.ts`
- **DO NOT modify** `sync-hubspot-to-supabase/index.ts` — it has 91 contact fields + 4 tables. Too risky to refactor in this batch.

**Step 1: Add syncDeal() to hubspot-manager.ts**

```typescript
// Add to HubSpotManager class in _shared/hubspot-manager.ts

/**
 * Shared deal field mapping — single source of truth for HubSpot → Supabase deals.
 * Used by sync-single-deal, backfill-deals, and hubspot-webhook.
 * VERIFIED column names against src/integrations/supabase/types.ts:
 *   stage (NOT deal_stage), created_at (NOT create_date),
 *   updated_at (NOT last_modified), NO sync_source column.
 */
static mapDealFields(
  hubspotDeal: { id: string; properties: Record<string, any> },
  contactId: string | null,
  ownerName: string | null,
): Record<string, any> {
  const props = hubspotDeal.properties;
  const val = parseFloat(props.amount) || 0;

  return {
    hubspot_deal_id: hubspotDeal.id,
    deal_name: props.dealname || null,
    deal_value: val,
    value_aed: val,
    stage: props.dealstage || null,
    pipeline: props.pipeline || null,
    close_date: props.closedate ? new Date(props.closedate).toISOString() : null,
    status: HubSpotManager.mapDealStageToStatus(props.dealstage),
    created_at: props.createdate ? new Date(props.createdate).toISOString() : new Date().toISOString(),
    updated_at: props.lastmodifieddate ? new Date(props.lastmodifieddate).toISOString() : new Date().toISOString(),
    contact_id: contactId,
    owner_id: props.hubspot_owner_id || null,
    owner_name: ownerName,
  };
}

static mapDealStageToStatus(stage: string | null): string {
  if (!stage) return "pending";
  const s = stage.toLowerCase();
  if (s.includes("won") || s.includes("signed") || s.includes("paid")) return "closed";
  if (s.includes("lost") || s.includes("bad")) return "cancelled";
  return "pending";
}
```

**Step 2: Replace inline mapping in sync-single-deal**

In `supabase/functions/sync-single-deal/index.ts`, replace the inline `dealData` construction (lines 109-131) with:

```typescript
import { HubSpotManager } from "../_shared/hubspot-manager.ts";

// Replace lines 109-131:
const dealData = HubSpotManager.mapDealFields(deal, contactId, dealOwnerName);
```

**Step 3: Replace inline mapping in backfill-deals-history**

In `supabase/functions/backfill-deals-history/index.ts`, replace the inline mapping (lines 140-157) with:

```typescript
import { HubSpotManager } from "../_shared/hubspot-manager.ts";

// In the map function:
return HubSpotManager.mapDealFields(d, null, dealOwnerName);
```

**Step 4: Replace inline mapping in hubspot-webhook (deals only)**

In `supabase/functions/hubspot-webhook/index.ts`, replace the deal payload construction (lines 183-209) with:

```typescript
import { HubSpotManager } from "../_shared/hubspot-manager.ts";

// Replace dealPayload construction:
const dealPayload = HubSpotManager.mapDealFields(
  { id: dealId, properties: props },
  null,
  dealOwnerName,
);
```

**IMPORTANT:** hubspot-webhook uses `onConflict: "hubspot_id"` (not `hubspot_deal_id`). This is a different conflict key. Do NOT change it — it may be intentional for webhook-created deals. Document this discrepancy for future investigation.

**Step 5: Verify + Commit**

```bash
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" npx vite build
```

```bash
git add supabase/functions/_shared/hubspot-manager.ts \
  supabase/functions/sync-single-deal/index.ts \
  supabase/functions/backfill-deals-history/index.ts \
  supabase/functions/hubspot-webhook/index.ts
git commit -m "refactor: consolidate deal field mapping into HubSpotManager.mapDealFields() — verified column names"
```

**Rollback:** Revert each file to its previous inline implementation.

---

### Task 10: Consolidate Contacts (4 tables → 1) — DEFERRED

**Original Score:** 1/5 (CRITICAL risk)
**Effort:** 16-24h (was 6h)

**WHY DEFERRED:**
1. ~~`contacts.firstname`/`contacts.lastname`~~ → actual: `first_name`/`last_name` — original migration SQL would fail
2. 16+ frontend files query `enhanced_leads` — renaming the table breaks them instantly
3. The original plan said "No frontend changes" — this is FALSE
4. `sync-hubspot-to-supabase` maps 91 fields to contacts — any schema change is high-risk
5. Need full staging test before production

**PREREQUISITES before starting:**
- [ ] Complete inventory of all `enhanced_leads` queries (frontend + backend)
- [ ] Complete inventory of all `sales_leads` queries
- [ ] Staging environment with production data clone
- [ ] Full backup before migration
- [ ] Frontend PR ready with all query updates

**RECOMMENDATION:** Move to Phase 15. Do NOT attempt in the Intelligence Upgrade batch.

---

## Verification Checklist

After ALL Batch 1-3 fixes:

| # | Check | Command/Query | Expected |
|---|-------|--------------|----------|
| 1 | Build passes | `PATH="/opt/homebrew/bin:$PATH" npx vite build` | 0 errors |
| 2 | Token budget populates | Call any agent → `getTokenBudget()` | Non-zero values |
| 3 | ptd-ultimate-intelligence tools | Send "show me client health data" | Tool call in response |
| 4 | ai-ceo-master tools | Send "ROAS by campaign this week" | Tool call in response |
| 5 | cleanup-agent-memory runs | Invoke edge function | JSON with counts |
| 6 | Marketing dedup | Re-run any marketing agent 2x | 0 new duplicate rows |
| 7 | Constitutional in 20 agents | Grep for `getConstitutionalSystemMessage` | 20+ matches |
| 8 | agent_memory has agent_name | `SELECT DISTINCT agent_name FROM agent_memory` | Non-null values |
| 9 | auth-middleware typed errors | Trigger rate limit | `RateLimitError` in logs |
| 10 | Learning layer namespaced | Call `getActiveLearnings(5, "ptd-agent-gemini")` | Filtered results |

---

## Execution Summary

| Batch | Tasks | Effort | Risk | Score Impact |
|-------|-------|--------|------|-------------|
| 1 | 9 + 7 | 3-4h | LOW | +1.7 |
| 2 | 1 + (3+8) | 6h | LOW-MED | +15.2 |
| 3 | 2 + (4+6) | 12-16h | MED | +16.8 |
| 4 | 5 | 6-8h | MED | +2.8 |
| DEFERRED | 10 | 16-24h | CRITICAL | +2.0 |
| **TOTAL** | **8 tasks** | **27-34h active** | — | **+36.5 → ~82/100** |

---

## Cross-References

- **Evaluation findings:** `findings.md` Section 13
- **Original plan:** `docs/plans/2026-02-12-intelligence-upgrade-plan.md`
- **Task plan:** `task_plan.md` Phase 14
- **Schema truth:** `src/integrations/supabase/types.ts`
- **Pending migrations:** 5 already on disk (20260212000005 through 20260213000003) — deploy first
