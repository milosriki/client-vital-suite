# MASTER AUDIT PROMPT v4 -- Complete System Cross-Check

> **Generated**: 2026-02-26 | **Skills loaded**: 13 | **Context7 docs**: Gemini API + Supabase EF
> **Memory sources**: Supermemory + CRAW + Codex + Antigravity + Git history

---

## SKILLS TO LOAD BEFORE RUNNING THIS PROMPT

```
@evaluation                      -- agent evaluation rubrics, multi-dimensional scoring
@prompt-engineering-patterns     -- CoT, few-shot, self-verification, progressive disclosure
@ai-agents-architect             -- ReAct loops, tool registry, anti-patterns
@ai-engineer                     -- production AI systems, model selection, cost controls
@gemini-api-dev                  -- Gemini function calling, structured output, model specs
@find-bugs                       -- systematic bug finding in local changes
@vulnerability-scanner           -- OWASP 2025, secrets, CORS, supply chain
@supabase-postgres-best-practices -- PG optimization, indexes, autovacuum
@react-best-practices            -- Vercel Engineering React performance patterns
@llm-evaluation                  -- automated metrics, regression testing, benchmarking
@llm-application-dev-prompt-optimize -- constitutional AI, token reduction, model-specific tuning
@verification-before-completion  -- evidence before assertions, run commands before claiming done
@systematic-debugging            -- reason before fixing, prevent blind changes
```

---

## SYSTEM CONTEXT

```
You are a senior AI systems architect and production auditor continuing
work on PTD Vital Suite (client-vital-suite). This is a multi-session
project with work from Cursor, Claude Code (Codex), CRAW (OpenClaw),
Antigravity, and Supermemory.

YOUR MISSION: Find everything that is broken, outdated, dead, or
misconfigured. Do NOT fix anything yet. ONLY audit and report.

THINK STEP BY STEP before every assessment. Use chain-of-thought
reasoning. Cite file paths and line numbers for every finding.
Score every dimension 0-1. State confidence (HIGH/MEDIUM/LOW).
```

---

## STEP 0: READ MANDATORY FILES

```
Read in this order. Do NOT skip.
1. .cursorrules
2. CRAW-FINDINGS-2026-02-26.md
3. KNOWLEDGE.md (sections 1-6 minimum)
4. AUDIT-REPORT.md
5. task_plan.md (check phase statuses)
6. progress.md (what is done per session)
```

---

## STEP 1: GEMINI MODEL AUDIT (CRITICAL -- outdated refs found)

```
CURRENT VALID MODELS (February 2026):
  Gemini 3 Series (LATEST):
    gemini-3.1-pro-preview    -- 10M context, deep reasoning (BEST)
    gemini-3-flash-preview    -- high speed, low cost, strong reasoning
    gemini-3-pro-preview      -- state-of-the-art reasoning

  Gemini 2.5 Series (SUPPORTED):
    gemini-2.5-pro            -- complex tasks
    gemini-2.5-flash          -- price-performance
    gemini-2.5-flash-lite     -- cheapest, fastest

  DEPRECATED (shuts down June 1, 2026 -- MUST MIGRATE):
    gemini-2.0-flash          -- 8 ACTIVE FILES STILL USE THIS
    gemini-2.0-flash-001
    gemini-2.0-flash-lite

  ALREADY DEAD:
    gemini-1.5-flash          -- purged in commit d5a8ab8
    gemini-3.0-flash          -- purged
    gemini-3.1-pro            -- purged (was wrong format)

AUDIT TASK: Find every gemini model reference. Classify as:
  [CURRENT]    -- using gemini-3.x or gemini-2.5.x (keep)
  [DEPRECATED] -- using gemini-2.0.x (must upgrade)
  [DEAD]       -- using gemini-1.5.x or invalid name (already broken)

KNOWN DEPRECATED REFS (8 files, verified by grep):
  1. supabase/functions/_shared/unified-ai-client.ts:61
     gemini-2.0-flash as cascade fallback
     FIX: Replace with gemini-2.5-flash-lite (cheapest valid fallback)

  2. supabase/functions/vision-analytics/index.ts:29
  3. supabase/functions/ai-ceo-master/index.ts:319,361
  4. supabase/functions/multi-agent-orchestrator/index.ts:128,172
  5. supabase/functions/smart-ai-advisor/index.ts:253
  6. supabase/functions/ptd-ultimate-intelligence/index.ts:699,747,783

RECOMMENDED MIGRATION:
  gemini-2.0-flash -> gemini-2.5-flash (same speed class, still supported)
  OR use UnifiedAI cascade (which already routes correctly for most agents)

ALSO CHECK: Are any functions bypassing unified-ai-client.ts and calling
Gemini directly via raw fetch()? Those miss the cascade entirely.
```

---

## STEP 2: LANGSMITH REMOVAL AUDIT

```
DECISION: LangSmith is no longer used.

FOUND IN 16 FILES:
  _shared/langsmith-tracing.ts        -- entire module to delete
  _shared/langsmith-hub.ts            -- entire module to delete
  _shared/langsmith-hub-example.ts    -- entire module to delete
  _shared/observability.ts            -- check if LangSmith is optional/conditional
  _shared/prompt-manager.ts           -- check import
  business-intelligence/index.ts
  stripe-payouts-ai/index.ts
  stripe-forensics/index.ts
  stripe-dashboard-data/index.ts
  stripe-deep-agent/index.ts
  stripe-enterprise-intelligence/index.ts
  ptd-ultimate-intelligence/index.ts
  super-agent-orchestrator/index.ts
  agent-orchestrator/index.ts
  ai-ceo-master/index.ts
  ai-config-status/index.ts
  callgear-forensics/index.ts
  _archive/ptd-self-developer/index.ts

AUDIT TASK: For each file, determine:
  [IMPORT ONLY] -- imports LangSmith but conditionally (safe to remove import)
  [ACTIVE USE]  -- calls LangSmith functions that affect behavior
  [DEAD CODE]   -- LangSmith code is commented out or behind env check

ALSO CHECK: LANGSMITH_API_KEY in Supabase secrets -- should be removed.
```

---

## STEP 3: FULL PAGES AUDIT

```
INVENTORY (verified Feb 26):
  28 active routed pages (src/main.tsx lines 147-222)
  7 enterprise pages (/enterprise/*)
  1 admin page (/admin/EdgeFunctions)
  26 archived pages (src/pages/_archived/)
  21 redirect routes (old URL -> new page)

  BUG: 7 archived pages STILL IMPORTED in main.tsx routes:
    _archived/Analytics.tsx
    _archived/AttributionLeaks.tsx
    _archived/LeadFollowUp.tsx
    _archived/Observability.tsx
    _archived/Overview.tsx
    _archived/SetterCommandCenter.tsx
    _archived/WorkflowStrategy.tsx

AUDIT TASK: For each of the 36 active pages:
  1. Does it render without errors? (check for missing imports, undefined vars)
  2. Does it fetch REAL data? (grep for Supabase queries vs hardcoded)
  3. Does it have an ErrorBoundary? (added in commit f6c630e)
  4. Does it use client_health_daily or old client_health_scores?
  5. Does it have loading/empty states?
  6. Any Math.random() or mock data?

OUTPUT: Table per page with pass/fail per criterion.
```

---

## STEP 4: EDGE FUNCTION AUDIT

```
INVENTORY (verified Feb 26):
  ~196 active function directories
  8 archived in _archive/
  ~39 call AI (Gemini via UnifiedAI)
  3 AI providers: Gemini (primary), Anthropic (meta-ads-proxy), OpenAI (embeddings)

DUPLICATE CLUSTERS TO AUDIT:
  generate-lead-reply vs generate-lead-replies -- merge?
  9 sync-* functions -- which overlap?
  7 error-* handlers -- which are redundant?
  16 stripe-* functions -- which are active vs speculative?
  5 setup-*/fix-* functions -- one-time runners, can archive?

AUDIT TASK: For each of the ~196 functions, classify:
  [ACTIVE]     -- deployed, called by cron/webhook/UI, has real logic
  [SPECULATIVE]-- code exists but never called (no cron, no UI ref, no webhook)
  [ONE-TIME]   -- setup/migration/backfill that ran once and should archive
  [SKELETON]   -- <50 lines, placeholder, version count <10
  [DEAD]       -- uses mock data, or archived function that leaked back
  [REDUNDANT]  -- duplicates another active function

FOR AI-CALLING FUNCTIONS (39), additionally check:
  - Uses UnifiedAI cascade or raw fetch? (raw = misses fallback)
  - Uses deprecated gemini-2.0-flash? (must upgrade)
  - Has constitutional framing? (should)
  - Has output validation? (should)
  - Has token budget? (should)
  - Has learning-layer memory? (should)

OUTPUT: JSON inventory with per-function classification and scores.
```

---

## STEP 5: AI PROVIDER MAP VERIFICATION

```
CORRECT MAP (verified Feb 26, UPDATED):

  Everything EXCEPT meta-ads-proxy = Google Gemini
    Via: unified-ai-client.ts
    Cascade: gemini-3.1-pro-preview -> gemini-3-flash-preview -> [DEPRECATED fallback]
    
  meta-ads-proxy = Anthropic + Qwen (for Pipeboard MCP)
    Anthropic: Claude Haiku 4.5 (data fetch), Claude Sonnet 4 (analysis)
    Qwen: qwen-turbo/plus/qwen3-max (DashScope, analysis fallback)
    MCP: Pipeboard at mcp.pipeboard.co/meta-ads-mcp
    SECURITY BUG: Qwen API key hardcoded at line 264

  openai-embeddings = OpenAI
    Model: text-embedding-3-small
    NOTE: text-embedding-004 (Google) was shut down Jan 14, 2026

  fetch-facebook-insights = Pipeboard MCP (no AI, pure data)
  meta-executor.ts = Pipeboard MCP bridge (no AI, tool for agents)

DO NOT:
  - Remove ANTHROPIC_API_KEY (meta-ads-proxy needs it)
  - Remove PIPEBOARD_TOKEN (Meta Ads MCP needs it)  
  - Remove OPENAI_API_KEY (embeddings need it)
  - Remove QWEN_API_KEY (meta-ads-proxy needs it -- but move from hardcoded to env!)
  - Change meta-ads-proxy to Gemini (Pipeboard MCP requires Anthropic)
  - Remove LangSmith tracing without checking if observability.ts breaks
```

---

## STEP 6: SECURITY AUDIT

```
Using @vulnerability-scanner + @find-bugs patterns:

KNOWN ISSUES (still present, verified by code grep):
  P0-SEC-1: Math.random() fake data in production
    MetricDrilldownModal.tsx lines 76,88,102,181-182
    SystemHealthMonitor.tsx line 42

  P0-SEC-2: VITE_PTD_INTERNAL_ACCESS_KEY exposed in client bundle
    src/config/api.ts:103
    src/lib/serverMemory.ts:14
    src/lib/permanentMemory.ts:31

  P0-SEC-3: Qwen API key hardcoded
    supabase/functions/meta-ads-proxy/index.ts:264

  P0-SEC-4: Webhooks missing HMAC signature verification
    callgear-webhook, anytrack-webhook, calendly-webhook

  P0-SEC-5: 7 edge functions without auth-middleware
    (list from findings.md section 15)

  P0-SEC-6: cron_secret hardcoded in 4 files

  P0-SEC-7: CORS wildcard Access-Control-Allow-Origin: * on 4 active functions
    sales-aggression, client-intelligence-engine, ai-analyst-engine, update-currency-rates

ADDITIONAL CHECKS:
  - Any new secrets or API keys exposed since last audit?
  - Any console.log with sensitive data?
  - Any SELECT * on tables with PII?
  - Public docs in public/ folder accessible on Vercel?
```

---

## STEP 7: DATA ACCURACY AUDIT

```
Using @evaluation + @llm-evaluation rubrics:

GROUND TRUTH (CRAW verified Feb 26):
  209 active clients | 1,526 packages | AED 11.36M portfolio
  33 coaches | 6 leaders | 15.3% cancel rate
  28 SLOWING (AED 417K) | 960 FROZEN (AED 8.5M)
  Cancel: LIKE 'Cancelled-%' AND != 'Cancelled-Rebooked'
  Health: client_health_daily (NOT client_health_scores)

CHECK EACH DATA-PRODUCING FUNCTION:
  Score 0-1 on: Accuracy, Groundedness, Completeness, Efficiency, Cost
  
  SPECIFIC CHECKS:
  - Does ANY code filter status = 'Cancelled'? (wrong, returns 0)
  - Does ANY code query client_health_scores? (stale, 95.8% RED misleading)
  - Does daily_business_metrics show 0 revenue? (sync gap)
  - Does ultimate-aggregator still use mock data? (3 hardcoded creatives)
  - Are 4,805 deals with NULL pipeline being counted? (ghost records)
```

---

## STEP 8: AGENT INTELLIGENCE SCORING

```
Using @ai-agents-architect + @evaluation + @prompt-engineering-patterns:

For each of the 39 AI-calling functions, score on 10 dimensions:

  1. Uses UnifiedAI (not raw fetch)?          [YES/NO]
  2. Uses current model (not deprecated)?     [YES/NO]
  3. Has constitutional framing?              [YES/NO]
  4. Has chain-of-thought in prompt?          [YES/NO]
  5. Has output validation/JSON schema?       [YES/NO]
  6. Has token budget enforcement?            [YES/NO]
  7. Has learning-layer memory?               [YES/NO]
  8. Has error handling (not silent fail)?    [YES/NO]
  9. Has few-shot examples?                   [YES/NO]
  10. Produces grounded, cited output?        [YES/NO]

Score: count of YES / 10 per agent
Overall: average across all 39 agents
Target: move from 46.7/100 to 75+/100

BRAIN ASSIGNMENT:
  Map each ALIVE agent to: BUSINESS_BRAIN, MARKETING_BRAIN, COACHING_BRAIN, CEO_BRAIN, or DELETE
```

---

## STEP 9: CROSS-CHECK ALL MEMORY SOURCES

```
Using @context-degradation patterns (detect stale/contradictory context):

SOURCE 1: Supermemory
  Query: "PTD vital suite" -- compare recent context with code state
  Known corrections: Anthropic is NOT dead, LangSmith is removed, gemini-2.0-flash deprecated

SOURCE 2: CRAW (Feb 26)
  File: CRAW-FINDINGS-2026-02-26.md
  TODO items: 6 (check which are done)

SOURCE 3: Codex (Deep Clean Sprint)
  24 tasks, 4 waves -- NOT committed to git yet
  Verify: are any of these already done by other sessions?

SOURCE 4: Git history (55 commits in 3 days)
  Check: do commits match what memory says is done?
  Check: any stashes with uncommitted work? (5 stashes found)
  Check: any remote branches with diverged work? (7 branches)

SOURCE 5: docs/plans/ (41 plan files)
  Check: which plans are superseded by newer ones?
  Check: any contradictions between plans?

RULE: If memory says X but code shows Y, TRUST THE CODE.
Flag every contradiction found.
```

---

## STEP 10: SELF-VERIFICATION

```
Using @verification-before-completion:

After completing the audit, verify:
  1. Every finding cites a file path and line number (or "could not locate")
  2. Every score is between 0.0 and 1.0 with confidence level
  3. No FIXED item was flagged as broken (check against commit list)
  4. AI provider map matches actual code (grep ANTHROPIC, GEMINI, OPENAI)
  5. Model references are classified against the valid model list
  6. LangSmith references are counted accurately
  7. Page count matches (28 routed + 7 enterprise + 1 admin)
  8. Edge function count matches (~196 active)
  9. All 7 archived-but-routed pages are listed
  10. Security findings include line numbers

If any verification fails, state which and revise before reporting.
```

---

## OUTPUT FORMAT

```json
{
  "audit_date": "2026-02-26",
  "model_audit": {
    "current_refs": 0,
    "deprecated_refs": 0,
    "dead_refs": 0,
    "files_to_update": []
  },
  "langsmith_audit": {
    "files_with_refs": 0,
    "import_only": 0,
    "active_use": 0,
    "dead_code": 0,
    "safe_to_remove": []
  },
  "pages_audit": {
    "active_routed": 28,
    "enterprise": 7,
    "archived": 26,
    "archived_still_routed": 7,
    "pages_with_issues": []
  },
  "functions_audit": {
    "active": 0,
    "speculative": 0,
    "one_time": 0,
    "skeleton": 0,
    "dead": 0,
    "redundant": 0,
    "duplicate_clusters": []
  },
  "security_findings": [],
  "data_accuracy_score": 0.0,
  "agent_intelligence_score": 0.0,
  "memory_contradictions": [],
  "priority_actions": []
}
```
