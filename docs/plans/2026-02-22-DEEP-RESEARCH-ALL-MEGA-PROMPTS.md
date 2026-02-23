# Deep Research — All Mega Prompts

> **Purpose:** Single prompt for Antigravity, CRAW, or Cursor to deep-research every mega prompt in the repo. Find gaps, overlaps, inconsistencies, and missing wiring.

---

## Exact Paths (All Mega Prompts)

### In-Repo (Read These)

| # | Path | Purpose |
|---|------|---------|
| 1 | `src/lib/ptd-mega-prompt.ts` | PTD_MEGA_PROMPT — frontend agent system prompt v2.0 |
| 2 | `src/lib/ptd-auto-learn.ts` | getDynamicMegaPrompt() — dynamic prompt from learned knowledge |
| 3 | `supabase/functions/_shared/unified-lisa-prompt.ts` | UNIFIED_LISA_PROMPT — Lisa (ptd-agent-gemini) |
| 4 | `supabase/functions/_shared/unified-atlas-prompt.ts` | UNIFIED_ATLAS_PROMPT — Atlas (ptd-agent-atlas) |
| 5 | `supabase/functions/_shared/unified-prompts.ts` | buildUnifiedPromptForEdgeFunction, buildAgentPrompt, UNIFIED_SCHEMA_PROMPT, getConstitutionalSystemMessage |
| 6 | `src/lib/unified-data-schema.ts` | UNIFIED_SCHEMA_PROMPT (frontend copy) |
| 7 | `PARALLEL_AGENT_PROMPTS.md` | 5 agent prompts for LangSmith tracing (AI, Stripe, CRM, etc.) |
| 8 | `wiki/MEGA_AUDIT_PROMPT.md` | System-wide code audit checklist |
| 9 | `CLAUDE_CODE_PROMPT.md` | Cursor/Claude — wire PTD superintelligent agent |
| 10 | `SUPERINTELLIGENT_AGENT_PROMPT.md` | Superintelligent agent system |
| 11 | `docs/plans/2026-02-22-DEEP-RESEARCH-PROMPT-ENGINEERING.md` | Timeline extraction (OpenClaw, Antigravity) |
| 12 | `docs/plans/2026-02-22-UI-AUDIT-PROMPT-ENGINEERING.md` | UI audit report (not a prompt, but prompt output) |
| 13 | `docs/API_VERCEL_AUDIT_FINDINGS.md` | API audit + directions for agents |
| 14 | `wiki/LOVABLE_PROMPT.md` | Lovable UI generation |
| 15 | `wiki/LOVABLE_PROMPT_WORLD_CLASS_DASHBOARD.md` | Dashboard prompt |
| 16 | `wiki/UNIFIED_PROMPTS_*.md` | Unified prompts implementation docs |

### External (Antigravity / CRAW Only)

| # | Path | Purpose |
|---|------|---------|
| E1 | `~/.openclaw/workspace/MEMORY.md` | CRAW lessons |
| E2 | `~/.openclaw/workspace-forge/MEMORY.md` | FORGE lessons |
| E3 | `~/.openclaw/workspace-riki/MEMORY.md` | Riki |
| E4 | `~/.openclaw/workspace-business/MEMORY.md` | Business |
| E5 | `~/.openclaw/workspace-marketing/MEMORY.md` | Marketing |
| E6 | `~/.gemini/antigravity/brain/{uuid}/*.md` | Antigravity task.md, audits, blueprints |

---

## Master Deep Research Prompt (Copy & Run)

```
DEEP RESEARCH — All Mega Prompts

Execute a comprehensive audit of every mega prompt in the client-vital-suite repo. Output to docs/plans/MEGA_PROMPTS_DEEP_RESEARCH_REPORT.md (create if missing).

---

PHASE 1: INVENTORY

1. Read each file in the "Exact Paths" table above (1–16). For each:
   - Extract: prompt name, ~line count, key sections, who consumes it (frontend/edge function/agent)
   - Note: Is it static, dynamic, or built from components?

2. Build a dependency graph:
   - unified-prompts.ts → buildUnifiedPromptForEdgeFunction → used by ptd-agent-gemini, ptd-agent-atlas
   - unified-lisa-prompt.ts → UNIFIED_LISA_PROMPT → ptd-agent-gemini
   - ptd-mega-prompt.ts → PTD_MEGA_PROMPT → where? (grep usage)
   - getDynamicMegaPrompt() → where? (grep usage)

---

PHASE 2: CROSS-REFERENCE

3. Constitutional framing:
   - KNOWLEDGE.md says buildUnifiedPromptForEdgeFunction does NOT include constitutional.
   - Verify: Does unified-prompts.ts add constitutional to buildUnifiedPromptForEdgeFunction?
   - If not, which agents are affected?

4. Schema consistency:
   - UNIFIED_SCHEMA_PROMPT exists in unified-prompts.ts AND src/lib/unified-data-schema.ts
   - Are they identical? If not, which is source of truth?

5. HubSpot/Stripe/Meta mappings:
   - PTD_MEGA_PROMPT has deal stages, lifecycle, call status
   - Do unified-lisa-prompt and unified-atlas-prompt use the same IDs?
   - Any hardcoded IDs in edge functions that differ?

6. Tool definitions:
   - tool-definitions.ts → which prompts reference which tools?
   - LISA_SAFE_TOOLS vs full tool set — is the split documented in prompts?

---

PHASE 3: GAPS & OVERLAPS

7. Overlap: What content is duplicated across PTD_MEGA_PROMPT, UNIFIED_LISA_PROMPT, UNIFIED_ATLAS_PROMPT?
   - Extract common blocks (e.g. "PTD Fitness", "Mission", "HubSpot stages")
   - Recommend: single source of truth + imports

8. Gaps: What does one prompt have that others lack?
   - Lisa: booking flow, capacity check?
   - Atlas: cross-source analysis, token budget?
   - PTD_MEGA_PROMPT: 9-module knowledge base — is it in Lisa/Atlas?

9. Orphaned prompts:
   - PARALLEL_AGENT_PROMPTS.md — one-time use or recurring?
   - MEGA_AUDIT_PROMPT.md — when was it last run? Any findings applied?
   - LOVABLE_PROMPT — still used?

10. Missing wiring:
    - getDynamicMegaPrompt() — who calls it? Is it used?
    - PTD_MEGA_PROMPT — consumed by which component?

---

PHASE 4: EXTERNAL MEMORY (Antigravity / CRAW Only)

11. Read MEMORY.md from OpenClaw workspaces (E1–E5). Extract:
    - Any prompt-related lessons ("don't use X in prompts", "Lisa needs Y")
    - Conflicts with current prompts

12. Read Antigravity brain/{uuid}/*.md for last 5 days. Extract:
    - Prompt change requests or findings
    - Blueprints that reference prompt structure

---

OUTPUT FORMAT

Create docs/plans/MEGA_PROMPTS_DEEP_RESEARCH_REPORT.md with:

## 1. Inventory Table
| Prompt | Path | Lines | Consumer | Type |
|--------|------|-------|----------|------|

## 2. Dependency Graph (Mermaid or bullet list)

## 3. Cross-Reference Findings
- Constitutional: [status]
- Schema: [status]
- Mappings: [status]
- Tools: [status]

## 4. Gaps & Overlaps
- Duplicated content: [list]
- Missing in Lisa: [list]
- Missing in Atlas: [list]
- Orphaned: [list]

## 5. Recommendations
- Single source of truth for: [items]
- Add to Lisa: [items]
- Add to Atlas: [items]
- Deprecate: [items]

## 6. External Memory (if applicable)
- OpenClaw lessons: [summary]
- Antigravity findings: [summary]

Do not skip any file. If a path does not exist, note "NOT FOUND" and continue.
```

---

## Quick Commands for Manual Extraction

```bash
# Who uses PTD_MEGA_PROMPT?
grep -r "PTD_MEGA_PROMPT\|ptd-mega-prompt" --include="*.ts" --include="*.tsx" .

# Who uses getDynamicMegaPrompt?
grep -r "getDynamicMegaPrompt" --include="*.ts" --include="*.tsx" .

# Who uses buildUnifiedPromptForEdgeFunction?
grep -r "buildUnifiedPromptForEdgeFunction" supabase/functions/

# Constitutional in unified-prompts?
grep -n "constitutional\|getConstitutionalSystemMessage" supabase/functions/_shared/unified-prompts.ts

# Schema prompt diff
diff <(grep -A 50 "UNIFIED_SCHEMA_PROMPT" supabase/functions/_shared/unified-prompts.ts | head -60) \
     <(grep -A 50 "UNIFIED_SCHEMA_PROMPT" src/lib/unified-data-schema.ts | head -60)
```

---

## Where to Write Findings

| Path | Purpose |
|------|---------|
| `docs/plans/MEGA_PROMPTS_DEEP_RESEARCH_REPORT.md` | Full report (create from prompt above) |
| `docs/plans/MEGA_PROMPTS_CHANGELOG.md` | Append-only: `YYYY-MM-DD | agent | one-line finding` |

**See also:** [2026-02-22-UNIVERSAL-RESEARCH-PROMPT.md](2026-02-22-UNIVERSAL-RESEARCH-PROMPT.md) — non-limit, topic-agnostic prompt for all agents (RISE+RISEN+Chain of Thought).
