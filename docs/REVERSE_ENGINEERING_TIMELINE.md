# Deep Research Report — All Agent Memories (Feb 19–22, 2026)

**Date:** 2026-02-22 19:57
**Scope:** All OpenClaw agents (main/CRAW, workspace2, FORGE, riki, business, marketing) + Antigravity brain + Cursor sessions + Supabase knowledge stores
**Method:** Direct file reads of MEMORY.md, .aim/memory.jsonl, knowledge graph, plan docs, and Antigravity conversation summaries

---

## 1. Agents & Memory Sources

| Agent                 | Memory File                                 | Size                      | Last Updated |
| --------------------- | ------------------------------------------- | ------------------------- | ------------ |
| **CRAW (main)**       | `~/.openclaw/workspace/MEMORY.md`           | ~200 lines                | 2026-02-20   |
| **CRAW (workspace2)** | `~/.openclaw/workspace2/MEMORY.md`          | ~200 lines (same)         | 2026-02-20   |
| **FORGE v6.0**        | `~/.openclaw/workspace-forge/MEMORY.md`     | Boot state only           | 2026-02-22   |
| **RIKI**              | `~/.openclaw/workspace-riki/MEMORY.md`      | ~80 lines                 | 2026-02-20   |
| **Business Expert**   | `~/.openclaw/workspace-business/MEMORY.md`  | ~150 lines                | 2026-02-20   |
| **Marketing Expert**  | `~/.openclaw/workspace-marketing/MEMORY.md` | ~30 lines (empty)         | 2026-02-20   |
| Knowledge Graph       | `~/.openclaw/workspace/.aim/memory.jsonl`   | 17 entities, 14 relations | 2026-02-18   |
| Antigravity brain     | `~/.gemini/antigravity/brain/549b67fe-*/`   | 6 artifacts               | 2026-02-22   |
| Supabase stores       | `agent_memory`, `agent_knowledge`           | Isolated per agent        | On-going     |

---

## 2. What Each Agent Knows

### CRAW (main agent — the builder)

**Identity:** Senior full-stack developer. Autonomy-first, never asks permission.

**Operator profile stored:**

- Milos Vukovic, Dubai, UAE. Works 10PM–midnight PST.
- Parses typos as intent. Fast + direct.
- Says "fix all" = fix ALL.

**Key decisions in memory (P0 = fatal if wrong):**

| Priority | Rule |
|----------|------|
| P0 | Never use `postgres.js` in edge functions — bundle timeout |
| P0 | `.maybeSingle()` not `.single()` — crashes on empty tables |
| P0 | `client_packages_live` (218 rows) = source of truth for active clients, NOT `contacts` (12K+ stale) |
| P0 | Vercel API routes need inline auth — no middleware imports |
| P0 | Deno imports need `.ts` extension |
| P1 | Don't use `supabase db push` — migration history broken |
| P1 | `facebook_ads_insights` uses `date` column (NOT `date_start`), no `roas` column (calculate from `purchase_value/spend`) |

**5-Layer Memory Architecture (3.7M token surface):**

```
L0:   MEMORY.md        — always loaded, 87 lines ground truth
L0.5: QUICK-RECALL.md  — lookup table: every edge fn, credential, deploy cmd
L0.6: Ripgrep + context/*.md — aoi-triple-memory-lite (57% miss rate on memory_search)
L0.7: .aim/memory.jsonl — 17-entity knowledge graph
L1:   Active plans     — 4 files, ~984 lines
L2:   Engineering      — 5 files, ~489 lines
L3:   Session journals — 5 files, ~739 lines
L4:   Reference docs   — 4 files, ~1,247 lines
L5:   Archive          — 9 files, ~1,427 lines

Total reachable knowledge: 1,272 files, ~3.7M tokens
```

**Session index (last 3 days):**

- 2026-02-20: Lisa RAG brain (45 entries + embeddings), RIKI agent created (`@riki_sales_bot`), FINALIZE-PLAN.md

**Current blockers in memory:**

- TinyMDM API: 401 — needs Milos to verify keys
- Anthropic API: $0 balance on all 3 keys — blocks Meta AI chat
- Stripe backfill: `stripe_transactions` still 0 rows

---

### FORGE v6.0 (new autonomous builder — renamed from main 2026-02-22)

**Identity:** Empire-builder, SOUL.md v6.0 — Annoyance Fix, Hard-Worker Mode, ruthless verification.

**Memory state:** Boot state only. `Lessons` section is empty — Annoyance Fix has not yet written any lessons.

**Architecture evaluation (from `2026-02-22-FORGE-ARCHITECTURE-EVALUATION.md`):**

| Human Trait                | Computational Constraint                                         |
| -------------------------- | ---------------------------------------------------------------- |
| "Annoyance" at weak output | Annoyance Fix — halt, diagnose, MEMORY.md append, re-execute     |
| "Lead with evidence"       | Empirical Tool Validation — diffs, stdout before reporting       |
| "Never silent fail"        | Blocked Protocol — problem + root cause + fix path               |
| "24h empire mode"          | Hard-Worker Mode — token efficiency, single-pass production code |

**Sub-agents under FORGE authority:** riki, business

---

### RIKI (CRM + sales ops)

**Identity:** HubSpot master, revenue machine. Telegram bot `@riki_sales_bot`.

**Key findings in memory:**

- HubSpot Portal 7973797: 201 workflows (52 active, 149 inactive = 26% rate)
- **Root cause of 634K AED/month loss:** Workflow 1647739522 (lead delegation) is INACTIVE
- 93,390 leads sitting in List 625 (growing +785/week, never worked)
- Setter team: James, Adnan, Matthew, Pavan, Dyane, Juan, Mazem, Yehia
- CallGear→James mapping BROKEN (points to deleted owner)
- 8 custom properties needed for Master Engine

**Docs absorbed (2026-02-20):**

- HubSpot Operations Guide, Master KB v11, Email Sequences & WhatsApp Strategy
- Claude Implementation Prompts, MCP Execution & Monitoring System
- Client Health Score System, PTD Master Handbook, 13 additional docs

**Phase plan:**

1. Activate workflow 1647739722 NOW as stopgap
2. Build Master Engine + Enforcers this week
3. Train setters, dashboards, optimize

---

### Business Expert

**Key financials in memory:**

| Metric | Value |
|--------|-------|
| Total revenue | AED 1.3M/month (AED 15.6M/year) |
| Stripe visible | ~AED 420K |
| Lifetime closedwon | AED 10.1M (2,762 deals) |
| Active packages | AED 2.48M across 218 clients |
| ROAS | 6.4x |
| Ad spend | AED 4-5K/day (~AED 1.5M/year) |

**Revenue leaks (priority order):**

1. Inactive lead delegation = AED 634K/month ← **CRITICAL**
2. Silent churn (72% clients, 0 future bookings) = AED 1.8M at risk
3. No-shows (66%) = AED 134K/month
4. Cancellations = AED 252K/quarter
5. Failed payments (2,780) = AED 15-30K/month
6. **Total recovery potential: AED 1.2M+/month**

**Coach performance documented:**

- Need intervention: Shohre Azizi (14 clients, 100% no bookings, AED 138K at risk)
- Top performers: Danni Franklin, Nicolas Mercado (66.6% util), Matthew Bosch (72.2%)

**Handbook project:** "THE PTD WAY" — 40-60 pages, Milos's voice, subliminal belief installation, 9 parts.

---

### Marketing Expert

**State:** Empty template. No campaign intelligence, no winning creatives logged yet. Ad accounts on file: `act_349832333681399`, `act_1512094040229431`.

---

### Knowledge Graph (.aim/memory.jsonl)

**17 entities tracked:**

| Entity                  | Type           | Key Observations                                           |
| ----------------------- | -------------- | ---------------------------------------------------------- |
| `health-calculator`     | edge-function  | 740 lines, 5 dimensions, Ramadan +10 momentum              |
| `predict-churn`         | edge-function  | 184 lines, 211 clients scored                              |
| `smart-ai-advisor`      | edge-function  | 301 lines, main AI advisor                                 |
| `unified-ai-client`     | shared-module  | 838 lines, Gemini→DeepSeek fallback, hardcoded key removed |
| `stage-mapping`         | shared-module  | 146 lines, SINGLE SOURCE OF TRUTH for 6 HubSpot pipelines  |
| `client_packages_live`  | table          | 218 rows, synced from AWS RDS                              |
| `facebook_ads_insights` | table          | 1,663 rows, AED 384K spend, `date` not `date_start`        |
| `deals`                 | table          | 19,507 rows, 4,805 ghost deals (null pipeline)             |
| `CommandCenter`         | page           | 1,012 lines, `/command-center`                             |
| `MarketingIntelligence` | page           | 1,233 lines, `/marketing`                                  |
| `Coaches`               | page           | 924 lines, shows ALL clients                               |
| `Lisa`                  | ai-agent       | WhatsApp via AISensy, context often EMPTY                  |
| `Atlas`                 | ai-agent       | CEO dashboard, thinks in vacuum with no real data          |
| `PTD-Fitness`           | business       | 21,309 clients, 63 coaches, 218 active packages            |
| `AWS-RDS`               | infrastructure | 167 tables + 72 views, IP-whitelisted                      |
| `Milos`                 | person         | Founder, `milosriki86@gmail.com`                           |

**14 relations tracked:** reads-from, displays-data-from, used-by, synced-from, sales-agent-for, ceo-agent-for, founder-of

---

## 3. Antigravity Brain (This Session)

**Session:** `549b67fe` — artifacts in `~/.gemini/antigravity/brain/549b67fe-62f7-43ad-91f0-f874a31e933a/`

| Artifact                                  | Content                                                      |
| ----------------------------------------- | ------------------------------------------------------------ |
| `hubspot_dev_platform_report.md`          | HubSpot skill gap analysis — 12 capabilities, 5 gaps         |
| `vertex_integration_plan.md`              | Vertex AI for OpenClaw agents                                |
| `vertex_supabase_edge_research.md`        | Live research — Memory Bank (GA), RAG Engine, ADK, Gemini 1M |
| `agentic_ai_rag_blueprint.md`             | RAG architecture blueprint                                   |
| `self_evolving_architecture_blueprint.md` | Self-evolving FORGE architecture                             |
| `task.md`                                 | Session task tracker                                         |

---

## 4. The Gap: No Shared Memory Across Agents

**From `2026-02-22-UNIFIED-MEMORY-PLAN.md`:**

| Store             | Who Uses                      | Problem                                 |
| ----------------- | ----------------------------- | --------------------------------------- |
| `agent_memory`    | Lisa, Atlas, ptd-agent-gemini | Isolated per agent — no shared findings |
| `agent_knowledge` | Lisa, Atlas, ptd-agent-gemini | findings.md and plan docs NOT imported  |
| `findings.md`     | Humans only                   | 17-section audit — agents don't know    |
| `docs/plans/*.md` | Humans only                   | 31 plan docs — agents don't know        |

**Target state:** One unified `agent_knowledge` table (`match_isolated_knowledge` RPC with `allowed_categories=NULL` = all categories). Lisa stays restricted (pricing/faq). FORGE/Atlas/ptd-agent-gemini get all categories.

**Migration:** `supabase/migrations/20260222000000_unified_memory_all_categories.sql` — written, pending verification.

---

## 5. Critical Missing Files

| File                        | Status                                       | Impact                                     |
| --------------------------- | -------------------------------------------- | ------------------------------------------ |
| `WIRING_ANALYSIS.md`        | **NOT FOUND** — referenced in `.cursorrules` | Agents can't check before writing new code |
| `introspect_schema_verbose` | Not verified updated for new tables          | Agents see stale schema                    |
| FORGE Lessons (MEMORY.md)   | Empty — no Annoyance Fix entries yet         | FORGE has no learned lessons               |
| Marketing memory            | Template only                                | No campaign intelligence                   |

---

## 6. Chronological Events (Rebuild)

| Timestamp        | Source         | ID            | Summary                                                    |
| ---------------- | -------------- | ------------- | ---------------------------------------------------------- |
| 2026-02-15 15:43 | Antigravity    | 868df285      | HubSpot Webhook Setup                                      |
| 2026-02-15 20:48 | OpenClaw-main  | b04753b5      | Install Coding Agent Loops from ClawMart                   |
| 2026-02-16 13:02 | Antigravity    | 3c4e5d6a      | CRO Skills Gap Analysis                                    |
| 2026-02-16 16:56 | OpenClaw-main  | e61f2223      | System: Node MacBook Pro, app update                       |
| 2026-02-17 23:22 | OpenClaw-main  | af12462b      | New session /new or /reset                                 |
| 2026-02-18 00:27 | OpenClaw-main  | 78241c8a      | Missing tool result, synthetic error for transcript repair |
| 2026-02-18 02:00 | OpenClaw-main  | 09cd7db2      | Cron: Daily Master Sync — HubSpot + FB + Stripe            |
| 2026-02-18 —     | Antigravity    | 2eb97580      | LLM and RAG Skills Audit                                   |
| 2026-02-18 14:00 | OpenClaw-main  | 5a8f1305      | Cron: CallGear Sync                                        |
| 2026-02-18 17:00 | OpenClaw-main  | 89af756a      | Cron: Lost Lead Detector                                   |
| 2026-02-18 19:00 | OpenClaw-main  | 634f2390      | Cron: Setter Performance                                   |
| 2026-02-19 —     | Antigravity    | 0c29ea41      | Analyze and Update SOUL.md                                 |
| 2026-02-19 —     | Antigravity    | 3724dabc      | AI Research and Web Skills                                 |
| 2026-02-19 12:04 | Cursor         | eced7cdb      | Context7 MCP, 30 skills, reverse engineer                  |
| 2026-02-19 —     | Antigravity    | ca63dcb1      | Repo Changes Overview                                      |
| 2026-02-19 13:03 | OpenClaw-main  | d1550800      | "finish" — 429 rate limit, fallback qwen-plus              |
| 2026-02-19 13:43 | OpenClaw-main  | 9e85d1ca      | "hey jesi li dobio zadatak" (Serbian)                      |
| 2026-02-19 —     | Antigravity    | a349339c      | Evolving Attribution Intelligence                          |
| 2026-02-20 —     | Antigravity    | 407b0f8b      | Visualizing SSE Architecture                               |
| 2026-02-20 12:06 | OpenClaw-main  | 1cd04256      | Optimize skills — 68 workspace, 33 agent                   |
| 2026-02-20 —     | OpenClaw-main  | 122b8c1e      | Sales Manager AI Module — recheck                          |
| 2026-02-20 —     | OpenClaw-main  | c2ae48e2      | feat: session intelligence — frequency tracking            |
| 2026-02-20 —     | OpenClaw-main  | 414db67f      | Cron: Daily Master Sync                                    |
| 2026-02-21 —     | Cursor         | 6af61ce0      | "EVAYTE B9I" (evaluate)                                    |
| 2026-02-21 12:41 | OpenClaw-main  | 36ae364d      | Read HEARTBEAT.md, workspace context                       |
| 2026-02-22 07:47 | Antigravity    | b81101ed      | HubSpot Dev Docs Scraping                                  |
| 2026-02-22 08:32 | Antigravity    | a4d2752a      | LISA Intelligence Deployment & Audit                       |
| 2026-02-22 08:27 | OpenClaw-main  | af12462b      | use gemini 3 pro — failback never stop                     |
| 2026-02-22 11:50 | Antigravity    | b31c6454      | Reverting Cross-Repo Code Mix                              |
| 2026-02-22 12:02 | OpenClaw-main  | fbb1bdcc      | Gateway restart, npm update                                |
| 2026-02-22 20:41 | OpenClaw-forge | (28 sessions) | FORGE initialized — 28 sessions mirrored from main         |
| 2026-02-22 18:45 | OpenClaw-main  | c2ae48e2      | Session intelligence update                                |
| 2026-02-22 21:23 | Cursor         | cdd53e3c      | Dashboard, MetaMind, FORGE v6.0, Vertex                    |
| 2026-02-22 21:23 | OpenClaw-main  | fbb1bdcc      | Session start 2026-02-22                                   |
| 2026-02-22 21:24 | Antigravity    | 549b67fe      | Vertex AI + FORGE + HubSpot skill v2.0 (current)           |

---

## 7. Sources Table

| Source                  | Path                                                     | Status                    |
| ----------------------- | -------------------------------------------------------- | ------------------------- |
| CRAW memory (main)      | `~/.openclaw/workspace/MEMORY.md`                        | ✅ Read                   |
| CRAW memory (ws2)       | `~/.openclaw/workspace2/MEMORY.md`                       | ✅ Read                   |
| FORGE memory            | `~/.openclaw/workspace-forge/MEMORY.md`                  | ✅ Read (boot state only) |
| RIKI memory             | `~/.openclaw/workspace-riki/MEMORY.md`                   | ✅ Read                   |
| Business memory         | `~/.openclaw/workspace-business/MEMORY.md`               | ✅ Read                   |
| Marketing memory        | `~/.openclaw/workspace-marketing/MEMORY.md`              | ✅ Read (empty)           |
| Knowledge graph (main)  | `~/.openclaw/workspace/.aim/memory.jsonl`                | ✅ Read                   |
| Knowledge graph (ws2)   | `~/.openclaw/workspace2/.aim/memory.jsonl`               | ✅ Read (identical)       |
| FORGE Index             | `~/.openclaw/workspace/memory/INDEX.md`                  | ✅ Read                   |
| KNOWLEDGE.md            | `client-vital-suite/KNOWLEDGE.md`                        | ✅ Read                   |
| Unified memory plan     | `docs/plans/2026-02-22-UNIFIED-MEMORY-PLAN.md`           | ✅ Read                   |
| FORGE eval              | `docs/plans/2026-02-22-FORGE-ARCHITECTURE-EVALUATION.md` | ✅ Read                   |
| findings.md             | `client-vital-suite/findings.md`                         | ✅ Read                   |
| Cursor transcripts      | `~/.cursor/projects/.../agent-transcripts/*.jsonl`       | ✅ 3 .jsonl               |
| Cursor session 82037030 | `agent-transcripts/82037030*.txt`                        | ⚠️ .txt — not indexed     |
| Antigravity brain       | `~/.gemini/antigravity/brain/549b67fe-*/`                | ✅ 6 artifacts            |
| WIRING_ANALYSIS.md      | `client-vital-suite/WIRING_ANALYSIS.md`                  | ❌ NOT FOUND              |
