# Unified Memory Plan — One Memory for All Agents

**Date:** 2026-02-22  
**Goal:** Single Supabase-backed memory that all agents (Lisa, Atlas, FORGE, ptd-agent-gemini) share. Import findings, ideas, plans. Zero mistakes.

---

## 1. Current State (Problem)

| Store | Who Uses | What's In It | Problem |
|-------|-----------|--------------|---------|
| `agent_memory` | Lisa, Atlas, ptd-agent-gemini | Q&A from conversations, per `agent_name` | Isolated per agent. No shared findings. |
| `agent_knowledge` | Lisa, Atlas, ptd-agent-gemini | RAG docs (formula, rule, faq, pricing, etc.) | Findings.md and plans NOT imported. |
| `findings.md` | Humans | 17 sections of audit findings | Not in any agent. Agents don't know. |
| `docs/plans/*.md` | Humans | 31 plan docs | Not in any agent. |

**Result:** Agents repeat mistakes. They don't know what's broken. No single source of truth.

---

## 2. Target State (One Memory)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    agent_knowledge (UNIFIED)                             │
├─────────────────────────────────────────────────────────────────────────┤
│  category: findings | ideas | architecture | plans | formula | rule | ... │
│  source: findings.md | docs/plans/... | system | learned                 │
│  content: chunked, embedded, searchable                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    match_isolated_knowledge (RPC)
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
    LISA (WhatsApp)            ATLAS (CEO)              FORGE / ptd-agent
    restricted categories      ALL categories           ALL categories
    (pricing, faq, etc.)       (findings, plans, etc.) (findings, plans, etc.)
```

**LISA:** Stays restricted (pricing, packages, faq, formula, rule) — no internal findings to clients.  
**Atlas, FORGE, ptd-agent-gemini (internal):** Get ALL categories including findings, ideas, architecture, plans.

---

## 3. Migration Steps (No Mistakes)

### Step 1: Fix RPC — NULL = All Categories

**File:** New migration `supabase/migrations/20260222000000_unified_memory_all_categories.sql`

```sql
-- When allowed_categories is NULL, return ALL categories (unrestricted)
CREATE OR REPLACE FUNCTION public.match_isolated_knowledge(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5,
    allowed_categories TEXT[] DEFAULT NULL  -- NULL = all categories
)
RETURNS TABLE (
    id UUID,
    category TEXT,
    title TEXT,
    content TEXT,
    structured_data JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ak.id,
        ak.category,
        ak.title,
        ak.content,
        ak.structured_data,
        1 - (ak.embedding <=> query_embedding) AS similarity
    FROM public.agent_knowledge ak
    WHERE ak.is_active = TRUE
      -- NULL = unrestricted (all categories). Otherwise filter.
      AND (allowed_categories IS NULL OR ak.category = ANY(allowed_categories))
      AND ak.embedding IS NOT NULL
      AND 1 - (ak.embedding <=> query_embedding) > match_threshold
    ORDER BY ak.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

**Verification:** `SELECT * FROM match_isolated_knowledge(embedding, 0.5, 3, NULL)` returns rows from all categories.

---

### Step 2: Create Ingestion Edge Function

**File:** `supabase/functions/ingest-unified-knowledge/index.ts`

**Purpose:** Read `findings.md` and `docs/plans/*.md`, chunk by section, embed, insert into `agent_knowledge` with category `findings` or `plans`.

**Input:** `{ "source": "findings" | "plans" | "all" }`  
**Logic:**
1. Fetch file content (Supabase Storage or read from repo at deploy time)
2. Chunk by `## ` headers (findings) or by file (plans)
3. For each chunk: `unifiedAI.embed(content)` → `supabase.from("agent_knowledge").insert({ category, title, content, source, embedding })`
4. Dedupe by `(source, title)` — upsert

**Categories:**
- `findings` — from findings.md
- `plans` — from docs/plans/*.md
- `architecture` — from design docs (optional)
- `ideas` — from brainstorm docs (optional)

---

### Step 3: Add Shared Agent Memory (Optional)

For cross-agent learnings (e.g. "We fixed the HubSpot webhook on 2026-02-20"):

**Option A:** Add `agent_name = 'shared'` to `agent_memory`. All agents read shared + their own.  
**Option B:** Put learnings in `agent_knowledge` with category `learned` or `architecture`. Simpler.

**Recommendation:** Use `agent_knowledge` category `learned` for now. learning-layer already writes to `agent_memory` per agent. Add a separate sync: when learning-layer extracts a "global" lesson, also insert into `agent_knowledge` with category `learned` and source `system`.

---

### Step 4: Agent Config Updates

| Agent | allowed_categories | Change |
|-------|--------------------|--------|
| `ptd-agent-gemini` (WhatsApp/Lisa) | `['pricing', 'packages', 'locations', 'faq', 'formula', 'rule']` | No change |
| `ptd-agent-gemini` (internal) | `null` | Already null — will now get ALL |
| `ptd-agent-atlas` | `null` | Ensure null passed |
| FORGE (via OpenClaw) | N/A — uses Supabase? | If FORGE calls ptd-agent or Supabase, add integration |

**Verify:** ptd-agent-gemini line 355: `allowed_categories: isWhatsApp ? [...] : null` — correct. When not WhatsApp, null = all.

---

### Step 5: Ingestion Script (One-Time + Cron)

**Files:** `scripts/ingest-unified-knowledge.mjs`, `supabase/functions/ingest-unified-knowledge/index.ts`

```bash
# 1. Deploy edge function (needs GEMINI_API_KEY in Supabase secrets)
supabase functions deploy ingest-unified-knowledge

# 2. Run ingestion (reads findings.md + docs/plans/*.md, chunks, sends to edge function)
node scripts/ingest-unified-knowledge.mjs --source findings
node scripts/ingest-unified-knowledge.mjs --source plans
node scripts/ingest-unified-knowledge.mjs --source all   # both
```

**Note:** Re-running creates duplicates. To re-ingest cleanly, delete first:
`DELETE FROM agent_knowledge WHERE category IN ('findings','plans');`

**Cron:** Weekly re-ingest if docs change.

---

### Step 6: Update introspect_schema_verbose

Per `.cursorrules`: "Every time you create a new database table, you MUST update the introspect_schema_verbose SQL function."

No new table — we're using existing `agent_knowledge`. If we add a view or new table later, update introspect.

---

## 4. Verification Checklist

| # | Check | Command / Action |
|---|-------|------------------|
| 1 | Migration applied | `supabase db push` |
| 2 | RPC returns all when null | `SELECT * FROM match_isolated_knowledge(embedding, 0.5, 5, NULL) LIMIT 1` |
| 3 | Findings ingested | `SELECT COUNT(*) FROM agent_knowledge WHERE category = 'findings'` |
| 4 | Plans ingested | `SELECT COUNT(*) FROM agent_knowledge WHERE category = 'plans'` |
| 5 | Embeddings populated | `SELECT COUNT(*) FROM agent_knowledge WHERE category IN ('findings','plans') AND embedding IS NOT NULL` |
| 6 | Lisa still restricted | Send WhatsApp "What's broken in ads?" — should NOT get findings. |
| 7 | Atlas gets findings | Ask Atlas "What's broken in the attribution chain?" — should get findings. |

---

## 5. Rollback Plan

| Step | Rollback |
|------|----------|
| Migration | `ALTER FUNCTION match_isolated_knowledge ...` revert to previous version |
| Ingested rows | `DELETE FROM agent_knowledge WHERE category IN ('findings','plans') AND source LIKE '%findings%'` |
| Agent config | Revert `allowed_categories` to explicit list if needed |

---

## 6. Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/20260222000000_unified_memory_all_categories.sql` | Create |
| `supabase/functions/ingest-unified-knowledge/index.ts` | Create |
| `scripts/ingest-unified-knowledge.mjs` | Create (optional — CLI fallback) |
| `supabase/functions/ptd-agent-gemini/index.ts` | No change (null already correct) |
| `supabase/functions/ptd-agent-atlas/index.ts` | Verify null passed |

---

## 7. Execution Order

1. Create migration → `supabase db push`
2. Create ingest-unified-knowledge edge function
3. Run ingestion (findings, then plans)
4. Verify checklist
5. Document in VERTEX-MEMORY-RAG-SKILLS-GUIDE.md that unified memory is live

---

*References: findings.md, docs/plans/, agent_knowledge schema, match_isolated_knowledge, ptd-agent-gemini, learning-layer.*
