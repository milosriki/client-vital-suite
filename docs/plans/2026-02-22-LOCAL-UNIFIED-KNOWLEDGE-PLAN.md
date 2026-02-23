# Local Unified Knowledge — One File, All AIs, Finish Fast

**Date:** 2026-02-22  
**Goal:** One local knowledge file so any AI (Cursor, OpenClaw, Antigravity) can work on the app with full context. No network. No Supabase for context. Fast.

---

## Problem

- **Supabase** = main backend (agent_memory, agent_knowledge) — for in-app agents (Lisa, Atlas)
- **Ideas left behind** = findings.md, docs/plans/*.md, design decisions — scattered, not in one place
- **Any AI** working on the app (Cursor, FORGE, etc.) has no single source of truth
- **Result:** Slow ramp-up, repeated mistakes, context switching

---

## Solution: One Local File

| File | Purpose |
|------|---------|
| `KNOWLEDGE.md` (project root) | Single file: findings + plans + key decisions. Any AI reads this first. |

**Why local:**
- Zero latency — no Supabase, no API
- Works offline
- Cursor, OpenClaw, Antigravity all read the same file
- Git-tracked — changes are versioned

---

## What Goes In KNOWLEDGE.md

1. **Findings** — What's broken (from findings.md)
2. **Plans** — What to do (from docs/plans/)
3. **Key decisions** — Architecture, stack, rules
4. **Wiring** — Key files, RPCs, tables

**Format:** Markdown. Sections by topic. Scannable.

---

## Context7 MCP — For Evaluation

When evaluating or implementing:

- **Supabase:** `resolve-library-id` → `/supabase/supabase` then `query-docs` for auth, RPC, edge functions
- **React / Vite:** Same for UI patterns
- **Use for:** "How does Supabase RLS work?" "How to use match_isolated_knowledge?"

Context7 = up-to-date docs. KNOWLEDGE.md = your project truth.

---

## Generation Script

**File:** `scripts/generate-knowledge.mjs`

```bash
node scripts/generate-knowledge.mjs
```

**Logic:**
1. Read findings.md
2. Read docs/plans/*.md (top 20 by relevance or all)
3. Extract key sections (## headers)
4. Write to KNOWLEDGE.md with clear sections
5. Prepend: "Read this before coding. Updated: <date>."

---

## .cursorrules Update

Add:
```
- Read KNOWLEDGE.md before writing new code. It contains findings, plans, and key decisions.
```

---

## Flow

```
findings.md + docs/plans/*.md
         │
         ▼
  generate-knowledge.mjs
         │
         ▼
    KNOWLEDGE.md  ◄── Any AI reads this first
         │
         ├── Cursor (Claude)
         ├── OpenClaw (FORGE)
         ├── Antigravity (Gemini)
         └── You
```

**Supabase** stays for: Lisa, Atlas, in-app chat, agent_memory, agent_knowledge.  
**KNOWLEDGE.md** is for: AI coding context. Local. Fast.

---

## Execution Order

1. Create `scripts/generate-knowledge.mjs`
2. Run it → creates `KNOWLEDGE.md`
3. Add to `.cursorrules`: "Read KNOWLEDGE.md before coding"
4. Use Context7 MCP when evaluating Supabase/React patterns
