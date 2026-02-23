# Universal Deep Research Prompt — All Agents

> **Framework:** RISE + RISEN + Chain of Thought (from prompt-engineer skill). Non-limit, topic-agnostic, works for Cursor, Antigravity, CRAW, OpenClaw, Claude, Gemini.

---

## Evaluation (2026-02-22)

| Aspect | Status | Finding |
|--------|--------|---------|
| Scope paths | Gap | Original had generic "plans/, wiki/" — needed exact paths |
| findings.md | Missing | Critical — 17 sections, 1200+ lines, pipeline audit |
| WIRING_ANALYSIS.md | Missing | Referenced in .cursorrules but file does NOT exist |
| introspect_schema | Missing | Migrations + schema — agent must see new tables |
| Fill-gaps prompt | Missing | No portable prompt to drop anywhere for gap-filling |

**Fixes applied below:** Exact paths table, fill-gaps prompt, findings references.

---

## Full Paths (Repo-Relative — Use As-Is In Your Repo)

> **Format:** All paths are relative to repo root. In your repo they resolve exactly as written. No placeholders. No globs in the list — every path is explicit.

---

### Core Docs (Repo Root)

| Full Path | Purpose |
|-----------|---------|
| `findings.md` | Forensic audit — 17 sections, FB Ads → Leads → Calls → Deals → Revenue, 1200+ lines |
| `KNOWLEDGE.md` | Plans, decisions, agent context — read before new code |
| `WIRING_ANALYSIS.md` | **NOT FOUND** — .cursorrules requires it; create or document gap |
| `.cursorrules` | Project rules — WIRING_ANALYSIS, introspect_schema, Tailwind, client_control |
| `CLAUDE.md` | Deployment, verification, commit convention |
| `progress.md` | Session log, batch completion, autonomous execution state |
| `PARALLEL_AGENT_PROMPTS.md` | 5 agent prompts for LangSmith tracing |
| `CLAUDE_CODE_PROMPT.md` | Cursor — wire PTD superintelligent agent |
| `SUPERINTELLIGENT_AGENT_PROMPT.md` | Superintelligent agent system |

---

### Docs — Plans (Full List)

| Full Path | Purpose |
|-----------|---------|
| `docs/plans/2026-02-22-UNIVERSAL-RESEARCH-PROMPT.md` | This doc — universal research + fill-gaps prompt |
| `docs/plans/2026-02-22-DEEP-RESEARCH-ALL-MEGA-PROMPTS.md` | Mega prompts deep research prompt |
| `docs/plans/2026-02-22-DEEP-RESEARCH-PROMPT-ENGINEERING.md` | Timeline extraction (OpenClaw, Antigravity) |
| `docs/plans/2026-02-22-UI-AUDIT-PROMPT-ENGINEERING.md` | UI audit report |
| `docs/plans/2026-02-22-FORGE-ARCHITECTURE-EVALUATION.md` | FORGE architecture |
| `docs/plans/2026-02-22-VERTEX-MEMORY-RAG-SKILLS-GUIDE.md` | Vertex memory, RAG, skills |
| `docs/plans/2026-02-22-UNIFIED-MEMORY-PLAN.md` | Unified memory categories |
| `docs/plans/2026-02-22-LOCAL-UNIFIED-KNOWLEDGE-PLAN.md` | Local unified knowledge |
| `docs/plans/2026-02-21-supabase-gemini-key-setup-design.md` | Gemini key setup design |
| `docs/plans/2026-02-21-supabase-gemini-key-setup-arbiter-report.md` | Arbiter report |
| `docs/plans/2026-02-21-dead-unused-code-inventory.md` | Dead/unused code |
| `docs/plans/2026-02-21-pages-deep-explanation-functions-and-loss.md` | Pages deep dive |
| `docs/plans/2026-02-21-page-audit-deep-dive.md` | Page audit |
| `docs/plans/UI-WORK-MASTER-PLAYBOOK.md` | UI wiring playbook |
| `docs/plans/finish-the-app.md` | Finish-the-app checklist |
| `docs/plans/autonomous-execution-plan.md` | Autonomous execution batches |
| `docs/plans/BULLETPROOF_EXECUTION.md` | Bulletproof execution |
| `docs/plans/COMPLIANCE_LOG.md` | Compliance log |
| `docs/plans/EXECUTION_MASTER_PLAN.md` | Execution master plan |
| `docs/plans/EXECUTION_PROTOCOL.md` | Execution protocol |
| `docs/plans/EXECUTION_WITH_SELF_VERIFICATION.md` | Self-verification |
| `docs/plans/RESEARCH_CHANGELOG.md` | Append-only research log |
| `docs/plans/MEGA_PROMPTS_CHANGELOG.md` | Mega prompts log |

---

### Docs — Audits & Reports

| Full Path | Purpose |
|-----------|---------|
| `docs/API_VERCEL_AUDIT_FINDINGS.md` | API routes, auth, CORS, Meta CAPI |
| `docs/API_VERCEL_AUDIT_APPENDIX.md` | Agent findings append here |
| `docs/API_VERCEL_AUDIT_CHANGELOG.md` | Append-only API audit log |
| `docs/REVERSE_ENGINEERING_TIMELINE.md` | Timeline from OpenClaw, Antigravity |
| `docs/DEEP_RESEARCH_API_SERVICES.md` | Deep Research edge function |
| `docs/LIVE_API_SERVICES_REPORT.md` | Live API usage by component |
| `docs/SCHEMA_MAP_BY_DASHBOARD.md` | Tables/views per dashboard |
| `docs/INTELLIGENCE_VISION.md` | Dashboard formulas, agent requirements |

---

### Code — Prompts & AI

| Full Path | Purpose |
|-----------|---------|
| `src/lib/ptd-mega-prompt.ts` | PTD_MEGA_PROMPT — frontend agent system prompt v2.0 |
| `src/lib/ptd-auto-learn.ts` | getDynamicMegaPrompt() — dynamic from learned knowledge |
| `src/lib/unified-data-schema.ts` | UNIFIED_SCHEMA_PROMPT (frontend copy) |
| `supabase/functions/_shared/unified-lisa-prompt.ts` | UNIFIED_LISA_PROMPT — Lisa (ptd-agent-gemini) |
| `supabase/functions/_shared/unified-atlas-prompt.ts` | UNIFIED_ATLAS_PROMPT — Atlas (ptd-agent-atlas) |
| `supabase/functions/_shared/unified-prompts.ts` | buildUnifiedPromptForEdgeFunction, buildAgentPrompt, getConstitutionalSystemMessage |
| `supabase/functions/_shared/unified-ai-client.ts` | Gemini client, 4-tier cascade |

---

### Code — Vercel API Routes (Every File)

| Full Path | Purpose |
|-----------|---------|
| `api/brain.ts` | Brain API — embeddings, recent, stats |
| `api/agent.ts` | Agent proxy → ptd-agent-gemini |
| `api/query.ts` | Query API |
| `api/threads.ts` | Threads API |
| `api/session.ts` | Session API |
| `api/memory.ts` | Memory API |
| `api/user-memory.ts` | User memory API |
| `api/workspace.ts` | Workspace API |
| `api/truth.ts` | Truth/query API |
| `api/system.ts` | System API — data_quality, integration_health, etc. |
| `api/system-check.ts` | System check |
| `api/health.ts` | Health check |
| `api/meta-cross-validate.ts` | Meta cross-validate proxy |
| `api/create-agent-memory-table.ts` | DDL for agent_memory |
| `api/hubspot.ts` | HubSpot API |
| `api/intelligence.ts` | Intelligence API |
| `api/stripe.ts` | Stripe API |
| `api/events/index.ts` | Events — proxy to meta-capi |
| `api/events/[name].ts` | Events by name — Meta CAPI |
| `api/events/batch.ts` | Events batch — Meta CAPI |
| `api/webhook/backfill.ts` | Backfill — Meta CAPI |
| `api/stripe/account.ts` | Stripe account |
| `api/stripe/treasury.ts` | Stripe treasury |
| `api/stripe/payouts.ts` | Stripe payouts |
| `api/stripe/payouts-ai.ts` | Stripe payouts AI |
| `api/stripe/forensics.ts` | Stripe forensics |
| `api/_lib/utils.ts` | checkAuth, shared utils |

---

### Code — Frontend Config & Routes

| Full Path | Purpose |
|-----------|---------|
| `src/config/api.ts` | getApiUrl, API_BASE |
| `src/main.tsx` | Routes (~lines 139–214) |
| `src/components/Navigation.tsx` | NAV_GROUPS |
| `src/lib/serverMemory.ts` | Server memory — API_BASE |
| `src/lib/permanentMemory.ts` | Permanent memory — API_BASE |

---

### Database

| Full Path | Purpose |
|-----------|---------|
| `src/integrations/supabase/types.ts` | Generated types (6851 lines) |
| `supabase/migrations/20260219000000_secure_lisa_rag_isolation.sql` | Lisa RAG isolation |
| `supabase/migrations/20260220000000_fix_cron_project_urls.sql` | Cron URLs |
| `supabase/migrations/20260222000000_unified_memory_all_categories.sql` | Unified memory categories |

*For full migration list: `supabase/migrations/*.sql` — introspect_schema_verbose must list every new table.*

---

### Wiki

| Full Path | Purpose |
|-----------|---------|
| `wiki/MEGA_AUDIT_PROMPT.md` | System-wide audit checklist |
| `wiki/ORPHANED_FUNCTIONS_ANALYSIS.md` | Orphaned edge functions |
| `wiki/UNIFIED_PROMPTS_IMPLEMENTATION_COMPLETE.md` | Unified prompts |
| `wiki/UNIFIED_PROMPTS_COMPLETE.md` | Unified prompts |
| `wiki/LOVABLE_PROMPT.md` | Lovable UI generation |
| `wiki/LOVABLE_PROMPT_WORLD_CLASS_DASHBOARD.md` | Dashboard prompt |
| `wiki/BROWSER_WIRING_VERIFIED.md` | Browser wiring |

---

### External (Antigravity / CRAW — Outside Repo)

| Full Path | Purpose |
|-----------|---------|
| `~/.openclaw/workspace/MEMORY.md` | CRAW main workspace |
| `~/.openclaw/workspace2/MEMORY.md` | CRAW workspace 2 |
| `~/.openclaw/workspace-forge/MEMORY.md` | FORGE |
| `~/.openclaw/workspace-riki/MEMORY.md` | Riki |
| `~/.openclaw/workspace-business/MEMORY.md` | Business |
| `~/.openclaw/workspace-marketing/MEMORY.md` | Marketing |
| `~/.openclaw/workspace/.aim/memory.jsonl` | Entity/observation graph |
| `~/.openclaw/workspace2/.aim/memory.jsonl` | Entity/observation graph |
| `~/.gemini/antigravity/brain/{uuid}/task.md` | Per-conversation task |
| `~/.gemini/antigravity/brain/{uuid}/*.md` | Audits, plans, blueprints |
| `~/.gemini/antigravity/code_tracker/active/` | Tracked files |
| `~/.gemini/antigravity/conversations/*.pb` | Conversation files |

---

### Output Paths (Where Agents Write)

| Full Path | Purpose |
|-----------|---------|
| `docs/plans/RESEARCH_REPORT_[TOPIC_SLUG].md` | Deep research report |
| `docs/plans/RESEARCH_CHANGELOG.md` | Append: YYYY-MM-DD | agent | topic | summary |
| `docs/plans/MEGA_PROMPTS_DEEP_RESEARCH_REPORT.md` | Mega prompts report |
| `docs/plans/MEGA_PROMPTS_CHANGELOG.md` | Append: YYYY-MM-DD | agent | finding |
| `docs/API_VERCEL_AUDIT_APPENDIX.md` | Append API findings |
| `docs/API_VERCEL_AUDIT_CHANGELOG.md` | Append: YYYY-MM-DD | agent | finding |
| `docs/REVERSE_ENGINEERING_TIMELINE_APPENDIX.md` | Timeline appendix |

---

## The Prompt (Copy & Run)

```
UNIVERSAL DEEP RESEARCH — [TOPIC]

You are a senior research analyst. Your task is to perform exhaustive, boundary-free research on [TOPIC]. No scope limits. No time caps. No "enough" — continue until you have covered every accessible source and angle.

---

ROLE (RTF)
You are a systematic research agent. You operate in RISE mode: Research → Investigate → Synthesize → Evaluate. You do not stop at surface findings. You cross-reference, triangulate, and validate.

---

INSTRUCTIONS (RISEN)

1. **Research** — Gather all relevant artifacts:
   - Core: findings.md, KNOWLEDGE.md, .cursorrules (WIRING_ANALYSIS.md is NOT FOUND)
   - In-repo: use "Full Paths" table above (repo-relative); read every file matching the topic
   - External (if you have access): MEMORY.md, brain/*.md, .aim/memory.jsonl
   - Docs: docs/plans/, docs/API_VERCEL_*, wiki/
   - Code: api/, supabase/functions/, src/
   List every path you read. If a path does not exist, note "NOT FOUND" and continue.

2. **Investigate** — For each artifact:
   - What does it say about [TOPIC]?
   - What is missing, inconsistent, or contradictory?
   - What dependencies does it have?
   - Who consumes it? Who produces it?

3. **Synthesize** — Build a unified view:
   - Dependency graph (what depends on what)
   - Cross-reference matrix (agreements vs conflicts)
   - Gap list (what exists nowhere)
   - Overlap list (what is duplicated)

4. **Evaluate** — Assess quality and risk:
   - Critical issues (must fix)
   - High issues (should fix)
   - Medium (improve when possible)
   - Low (nice to have)
   - Confidence: high / medium / low per finding

---

STEPS (Chain of Thought)

Execute in order. Show reasoning at each step.

Step 1: Define [TOPIC] scope. What files, tables, functions, docs, and external sources are in scope? Enumerate exhaustively.

Step 2: Read every in-scope artifact. For each, extract: purpose, key facts, consumers, producers, last-modified (if available).

Step 3: Build dependency graph. Use Mermaid or bullet list. Show: A → B means "A is used by B" or "A imports B".

Step 4: Cross-reference. For each claim or fact, list all sources. Flag conflicts. Flag single-source claims (no corroboration).

Step 5: Identify gaps. What should exist but doesn't? What is referenced but missing? What is orphaned?

Step 6: Identify overlaps. What is duplicated? Where is the source of truth? What should be consolidated?

Step 7: Prioritize findings. Critical first, then high, medium, low. For each: file path, line (if applicable), issue, recommendation.

Step 8: Write report. Use the output format below. Append to the designated file. Add one line to the changelog.

---

END GOAL (RISEN)

A complete, actionable research report that any agent (Cursor, Antigravity, CRAW, OpenClaw) can use to:
- Understand the current state of [TOPIC]
- Fix critical and high issues
- Consolidate overlaps
- Fill gaps
- Track changes over time

---

NARROWING (Optional — Only If Context Is Too Large)

If the topic is too broad to finish in one run:
- Split by subdomain (e.g. "API auth" vs "API CORS" vs "API errors")
- Or split by layer (frontend / backend / DB / agents)
- Create a follow-up prompt for each split. Link them in the report.

---

OUTPUT FORMAT

Write to: docs/plans/RESEARCH_REPORT_[TOPIC_SLUG].md

Structure:

# Deep Research Report — [TOPIC]
**Date:** YYYY-MM-DD  
**Agent:** [Cursor|Antigravity|CRAW|OpenClaw]

## 1. Scope
- In-repo paths read: [list]
- External paths read: [list]
- Paths NOT FOUND: [list]

## 2. Dependency Graph
[Mermaid or bullet list]

## 3. Cross-Reference Matrix
| Claim/Fact | Sources | Conflict? | Single-source? |

## 4. Gaps
| Gap | Severity | Recommendation |

## 5. Overlaps
| Duplicate | Locations | Source of truth? |

## 6. Prioritized Findings
| # | Severity | Path | Issue | Recommendation |

## 7. Recommendations
- Critical: [list]
- High: [list]
- Medium: [list]
- Low: [list]

---

CHANGELOG

Append to docs/plans/RESEARCH_CHANGELOG.md:
YYYY-MM-DD | agent | [TOPIC] | one-line summary of key finding
```

---

## Topic Placeholders

Replace `[TOPIC]` with any of:

| Topic | Slug | Output File |
|-------|------|-------------|
| All mega prompts | MEGA_PROMPTS | MEGA_PROMPTS_DEEP_RESEARCH_REPORT.md |
| API & Vercel routes | API_VERCEL | API_VERCEL_AUDIT_APPENDIX.md |
| Reverse engineering timeline | TIMELINE | REVERSE_ENGINEERING_TIMELINE_APPENDIX.md |
| UI wiring & routes | UI_WIRING | UI_WIRING_RESEARCH_REPORT.md |
| Agent memory (Lisa, Atlas, RAG) | AGENT_MEMORY | AGENT_MEMORY_RESEARCH_REPORT.md |
| Stripe & payments | STRIPE | STRIPE_RESEARCH_REPORT.md |
| HubSpot & CRM | HUBSPOT | HUBSPOT_RESEARCH_REPORT.md |
| Custom | [YOUR_TOPIC] | RESEARCH_REPORT_[YOUR_SLUG].md |

---

## Quality Checks (from prompt-engineer skill)

Before considering the research complete, verify:

- [ ] Every in-scope path was read or explicitly noted as NOT FOUND
- [ ] Dependency graph includes all consumers and producers
- [ ] No finding is unsourced — each has at least one path/line
- [ ] Severity is assigned to every finding
- [ ] Report is self-contained — another agent can act on it without extra context
- [ ] Changelog line was appended

---

## Universal Agent Compatibility

| Agent | How to Use |
|-------|------------|
| **Cursor** | Paste prompt, replace [TOPIC], run. Has repo access. |
| **Antigravity** | Same. Has ~/.gemini/antigravity/brain/ access. |
| **CRAW (OpenClaw)** | Same. Has ~/.openclaw/*/MEMORY.md access. |
| **Claude (claude.ai)** | Paste. No file access — use for analysis of pasted content. |
| **Gemini** | Same as Claude. |

For agents with file access: read and write to repo paths.  
For agents without: user pastes artifacts; agent outputs report as response.

---

## Fill-Gaps Prompt (Paste Anywhere)

> **Use:** Drop this block into any chat (Cursor, Antigravity, CRAW, Claude, Gemini) when you need to fill gaps in the current context. Works standalone.

```
FILL GAPS — [CONTEXT: what you're working on]

1. **Scope:** What am I missing for [CONTEXT]? Check:
   - findings.md (pipeline audit)
   - KNOWLEDGE.md (decisions, plans)
   - docs/plans/ (relevant plan docs)
   - docs/API_VERCEL_AUDIT_FINDINGS.md (if API/auth)
   - Full paths: docs/plans/2026-02-22-UNIVERSAL-RESEARCH-PROMPT.md § Full Paths (repo-relative, use as-is)

2. **Gaps:** List what's missing, inconsistent, or orphaned. Severity: Critical / High / Medium / Low.

3. **Action:** For each gap: path to fix, recommended change, or "create X".

4. **Output:** Append to docs/plans/RESEARCH_REPORT_[TOPIC].md or docs/API_VERCEL_AUDIT_APPENDIX.md. Add line to docs/plans/RESEARCH_CHANGELOG.md.

If you don't have file access: output the report in your response. User will paste into the doc.
```

**Examples of [CONTEXT]:**
- "API auth for /api/events"
- "UI route for PTD Control"
- "WIRING_ANALYSIS.md — create from findings"
- "introspect_schema — add new table X"
- "Lisa prompt — constitutional framing"
