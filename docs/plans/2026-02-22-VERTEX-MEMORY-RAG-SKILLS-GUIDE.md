# Vertex AI + Memory + RAG + Skills — Connection Guide

**Date:** 2026-02-22  
**Purpose:** How to connect Vertex AI (optional), have persistent memory so the agent doesn't forget, use it in the app, RAG, and skills to map ideas.

---

## 1. Vertex AI vs Your Current Setup

### What You Have Now

| Component | Location | How It Works |
|-----------|----------|--------------|
| **Gemini API** | `unified-ai-client.ts` | Uses `@google/generative-ai` + `GEMINI_API_KEY` (Google AI Studio key) |
| **Embeddings** | `unifiedAI.embed()` | Same Gemini models for embeddings |
| **No GCP/Vertex** | findings.md | "No GCP dependency. Gemini is separate API." |

### When to Use Vertex AI

| Use Vertex AI | Stay on Gemini API |
|---------------|---------------------|
| Enterprise IAM, quotas, VPC-SC | Simple API key, Supabase Edge Functions |
| Batch embeddings at scale | Real-time per-request embeddings |
| Model tuning, custom models | Off-the-shelf Gemini Flash |
| GCP billing consolidation | Separate Gemini API billing |

**Recommendation:** Stay on Gemini API for now. Your 143 Edge Functions use it. Vertex adds GCP project setup, service accounts, and different SDK. Migrate only if you need enterprise controls.

### If You Want Vertex AI

```bash
# 1. Create GCP project, enable Vertex AI API
# 2. Create service account with Vertex AI User role
# 3. In Supabase Secrets:
supabase secrets set VERTEX_PROJECT_ID=your-gcp-project
supabase secrets set GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'

# 4. In unified-ai-client.ts, add Vertex SDK:
# import { VertexAI } from '@google-cloud/vertexai';
# Use VertexAI when VERTEX_PROJECT_ID is set, else fallback to Gemini API
```

---

## 2. Memory — So the Agent Doesn't Forget

### What You Already Have

| Table / Function | Purpose |
|------------------|---------|
| `agent_memory` | Stores query + response + knowledge_extracted + embeddings. Per-thread, per-agent. |
| `match_agent_memory` | Vector search with `agent_name` isolation (LISA vs Atlas). |
| `agent_patterns` | Long-term learned patterns (confidence, examples). |
| `agent_conversations` | Full chat history by session. |
| `agent_decisions` | Learning loop — what the agent decided. |

**Flow in ptd-agent-gemini:**
1. Before each response: `searchMemoryByKeywords` or vector search → inject `[Memory] Q: ... A: ...` into prompt.
2. After response: `learning-layer` extracts knowledge → upsert to `agent_memory` with embeddings.

### What to Strengthen

| Gap | Fix |
|-----|-----|
| **Keyword fallback** | `searchMemoryByKeywords` is used when embeddings fail. Add vector search path always (ensure embeddings written). |
| **Code/architecture memory** | Add `memory_write` from agent-memory-mcp for Architecture, Patterns, Decisions. Sync with AGENTS.md. |
| **Retention** | Migration `20260213000005` has retention + namespacing. Ensure old memories are pruned by `cleanup-agent-memory` cron. |
| **Thread continuity** | Pass `thread_id` from frontend (PTD chat, GlobalBrain) so memory is scoped per conversation. |

### Using Memory in the App

| App Surface | How Memory Is Used |
|-------------|---------------------|
| **GlobalBrain** (`/global-brain`) | Calls `ptd-brain-api` → stats, memory viewer, add memory. Shows `agent_memory` entries. |
| **PTD Control Chat** | Invokes `ptd-agent-gemini` with thread_id. Agent gets `[Memory]` context. |
| **PTD Unlimited** | Same — thread-scoped memory. |
| **Lisa (WhatsApp)** | `agent_name = 'lisa'` → isolated memory via `match_agent_memory`. |

**Ensure thread_id is passed:**
```ts
// In PTDControlChat or similar
const threadId = sessionId || `ptd-${userId}-${conversationId}`;
await supabase.functions.invoke('ptd-agent-gemini', {
  body: { message, thread_id: threadId, ... }
});
```

---

## 3. RAG — Retrieval-Augmented Generation

### What You Have

| Component | Purpose |
|-----------|---------|
| `agent_knowledge` | Documents with category, content, embedding. |
| `match_isolated_knowledge` | Vector search with category filter. LISA: `['pricing','packages','locations','faq','formula','rule']`. Atlas: full. |
| `searchKnowledgeBase` | In ptd-agent-gemini. Embeds query → RPC → injects `📚 [category] content` into prompt. |
| `knowledge_base` | Fallback keyword search if RPC fails. |

### RAG Flow (Already Wired)

```
User: "What's the price for 12 sessions?"
  → unifiedAI.embed(query)
  → match_isolated_knowledge(query_embedding, allowed_categories)
  → Top 5 chunks injected into prompt
  → Gemini generates answer grounded in docs
```

### Improving RAG

| Improvement | Action |
|-------------|--------|
| **Chunking** | Use semantic chunking (sentence boundaries, topic shifts). See rag-engineer skill. |
| **Hybrid search** | Add keyword fallback when vector similarity is low. You have `.or(content.ilike.%kw%)` already. |
| **Metadata filter** | Filter by `category` before vector search to reduce noise. |
| **Refresh embeddings** | When agent_knowledge is updated, re-embed. Add migration or edge function to backfill. |

### Ingesting Code / Docs into RAG

```sql
-- Example: Add architecture decision to agent_knowledge
INSERT INTO agent_knowledge (category, title, content, source, is_active)
VALUES (
  'architecture',
  'Auth: Use Supabase Auth only',
  'We use Supabase Auth. No custom JWT. Edge Functions verify via anon/service_role.',
  'docs/plans/2026-02-21-supabase-gemini-key-setup-design.md',
  true
);
-- Then run embedding job (or edge function) to set embedding column
```

---

## 4. Skills to Map Ideas

### Agent-Memory-MCP Skill

**Purpose:** Persistent, searchable memory for Architecture, Patterns, Decisions. Syncs with project docs.

**Setup:**
```bash
git clone https://github.com/webzler/agentMemory.git .agent/skills/agent-memory
cd .agent/skills/agent-memory
npm install && npm run compile
npm run start-server client-vital-suite $(pwd)
```

**Tools:**
- `memory_search` — Find by query, type (pattern/decision/architecture), tags
- `memory_write` — Save key, type, content, tags
- `memory_read` — Get by key
- `memory_stats` — Analytics

**Map ideas:** When you make a design decision, call `memory_write({ key: "auth-v1", type: "decision", content: "...", tags: ["auth","supabase"] })`. Later, `memory_search({ query: "authentication", type: "pattern" })` retrieves it.

### Continual-Learning Skill

**Purpose:** Mine previous chats for recurring corrections → update AGENTS.md with bullet points.

**Use:** "Mine previous chats", "Maintain AGENTS.md memory", "Build self-learning preference loop".

**Map ideas:** Extracts durable facts from conversations and writes them to AGENTS.md so future sessions inherit them.

### Wiki / Documentation Skills

| Skill | Use for Mapping Ideas |
|-------|------------------------|
| `wiki-architect` | Analyze repo → hierarchical docs, onboarding |
| `wiki-researcher` | Deep research on specific topics in codebase |
| `wiki-page-writer` | Generate technical docs with Mermaid diagrams |
| `wiki-llms-txt` | Create llms.txt for LLM-readable project summary |

### RAG + Skills Flow for "Don't Forget What We Code"

1. **During coding:** Use agent-memory-mcp to `memory_write` key decisions (e.g. "We use get_campaign_money_map RPC for per-campaign ROI").
2. **In prompts:** Before agent runs, call `memory_search` and inject results.
3. **In app:** GlobalBrain or a "Project Memory" tab shows recent memories.
4. **Sync to RAG:** Periodically export memory_write content → insert into `agent_knowledge` with embeddings → RAG uses it.

---

## 5. End-to-End: Connect Everything

### Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  PTD Chat /     │────▶│ ptd-agent-gemini │────▶│ agent_memory    │
│  GlobalBrain    │     │                  │     │ agent_knowledge │
└─────────────────┘     │ 1. searchMemory  │     └─────────────────┘
                        │ 2. searchKnowledge│           ▲
                        │ 3. Generate       │           │ learning-layer
                        │ 4. Extract+Store  │───────────┘
                        └──────────────────┘

┌─────────────────┐     ┌──────────────────┐
│ agent-memory-mcp │────▶│ memory_search    │────▶ Injected into
│ (Cursor/IDE)     │     │ memory_write     │      agent prompt
└─────────────────┘     └──────────────────┘
```

### Checklist

- [ ] Thread IDs passed from frontend to ptd-agent-gemini
- [ ] agent_memory has embeddings populated (check `SELECT COUNT(*) FROM agent_memory WHERE embeddings IS NOT NULL`)
- [ ] agent_knowledge has embeddings for all active rows
- [ ] cleanup-agent-memory cron runs (retention policy)
- [ ] agent-memory-mcp running for Cursor sessions (optional)
- [ ] AGENTS.md updated by continual-learning or manually with key decisions
- [ ] Vertex AI: only if you need GCP IAM/quota — otherwise stay on Gemini API

---

## 6. Quick Commands

```bash
# Check memory stats (Supabase SQL)
SELECT 
  (SELECT COUNT(*) FROM agent_memory) AS memories,
  (SELECT COUNT(*) FROM agent_memory WHERE embeddings IS NOT NULL) AS with_embeddings,
  (SELECT COUNT(*) FROM agent_knowledge WHERE is_active) AS knowledge_chunks;

# Start agent-memory MCP (for Cursor)
cd .agent/skills/agent-memory && npm run start-server client-vital-suite /Users/milosvukovic/client-vital-suite
```

---

---

## 7. OpenClaw, Antigravity, Cursor — How to Use

### Where Each Agent Lives

| Agent | Where | Memory / RAG |
|-------|-------|--------------|
| **Cursor (Claude)** | Cursor IDE | MCP servers (agent-memory-mcp, Context7, etc.) |
| **Antigravity (Gemini)** | `~/.gemini/antigravity/` | Skills at `skills/`, brain at `brain/`. No shared memory by default. |
| **OpenClaw** | Skill format (YAML + markdown) | Used by Antigravity / Cursor agent. Format for skills, not a runtime. |
| **PTD in-app agents** | Supabase Edge Functions | agent_memory, agent_knowledge, RAG |

### Using Memory in Cursor (Claude)

1. **Add agent-memory-mcp as MCP server** in Cursor settings:
   - Clone: `git clone https://github.com/webzler/agentMemory.git ~/.cursor/skills/agent-memory`
   - Start: `cd ~/.cursor/skills/agent-memory && npm run start-server client-vital-suite /Users/milosvukovic/client-vital-suite`
   - Add to Cursor MCP config (JSON) pointing to this server

2. **Claude in Cursor** can then call:
   - `memory_search` — before coding: "Find auth patterns"
   - `memory_write` — after decisions: "Save: we use Supabase Auth only"
   - `memory_read` — "Get auth-v1 design"

3. **Context7 MCP** (already in your project) fetches docs for Claude. Use for library/framework docs.

### Using Memory in Antigravity (Gemini CLI)

Antigravity uses **skills** at `~/.gemini/antigravity/skills/`. Skills are read-only; they don't auto-write memory.

**Option A:** Add a skill that instructs Gemini to call an external API when it makes decisions:
- Create `~/.gemini/antigravity/skills/agent-memory/SKILL.md` that says: "When you make an architecture decision, call the memory API: POST to .../api/memory-store with key, type, content."

**Option B:** Run agent-memory-mcp and have Antigravity use it via MCP (if Gemini CLI supports MCP for your setup).

**Option C:** Sync Antigravity brain outputs to `agent_knowledge`:
- Antigravity writes to `~/.gemini/antigravity/brain/<id>/`. After a session, script that copies `implementation_plan.md` or `task.md` into `agent_knowledge` with embeddings.

### Using Memory in OpenClaw

OpenClaw is a **skill format** (YAML frontmatter + markdown instructions). Skills are consumed by agents.

- **Create a skill** that tells the agent: "When starting a task, call memory_search. When finishing a decision, call memory_write."
- The skill doesn't run memory itself — it instructs the agent (Cursor/Claude or Antigravity/Gemini) to use the MCP tools or API.

### Unified Flow: All Agents Share Memory

```
┌─────────────────────────────────────────────────────────────────┐
│  Cursor (Claude)     Antigravity (Gemini)     PTD App (Lisa)    │
│       │                      │                        │          │
│       │ memory_search        │ (skill says: call API) │ RAG      │
│       │ memory_write         │                        │ agent_   │
│       └──────────┬───────────┴────────────┬───────────┘ memory  │
│                  │                        │                      │
│                  ▼                        ▼                      │
│         agent-memory-mcp          agent_knowledge                 │
│         (local JSON/files)        (Supabase pgvector)             │
│                  │                        │                      │
│                  └────────────┬───────────┘                      │
│                               │                                  │
│                    Optional: Sync agent-memory-mcp → agent_      │
│                    knowledge (cron or manual) for RAG in app    │
└─────────────────────────────────────────────────────────────────┘
```

**Note:** agent-memory-mcp stores locally (JSON/files). Your app's `agent_memory` + `agent_knowledge` are in Supabase. They're separate. To unify: either (a) point agent-memory-mcp at a Supabase-backed backend, or (b) periodically sync local JSON → Supabase.

---

## 8. Cost Breakdown

### Your App (Supabase Edge Functions + Gemini)

| Component | Model | Cost (per 1M tokens) | Typical Use |
|-----------|-------|----------------------|-------------|
| **Chat** | gemini-3-flash-preview, 2.0-flash, 1.5-flash | Input: $0.10, Output: $0.40 | Lisa, Atlas, ptd-agent-gemini |
| ** Embeddings** | gemini-embedding-001 | ~$0.025/1M | RAG, memory search |
| **Fallback** | DeepSeek V3 | Input: $0.27, Output: $1.10 | When Gemini fails |

**Agent budgets (output tokens):**
- Lisa: 512 tokens
- Atlas: 12,000 tokens
- Default: 2,048 tokens

**Rough cost per request:**
- Lisa (short reply): ~$0.0005–0.001 (0.5–1K input + 512 output)
- Atlas (full analysis): ~$0.005–0.02 (5–20K input + 12K output)
- RAG embedding: ~$0.00002 per 1K chars embedded

**Monthly ballpark** (depends on traffic):
- 100 Lisa convos/day × 500 tokens ≈ 15M tokens/month → ~$6–8
- 50 Atlas queries/day × 50K tokens ≈ 75M tokens/month → ~$15–30
- Embeddings ≈ $1–5
- **Total: ~$25–50/month** for moderate use

### Cursor (Claude)

- **Cursor subscription:** $20–40/month (Pro/Business)
- **Claude usage:** Included in Cursor pricing for most plans
- **agent-memory-mcp:** Free (local, no API calls)
- **Context7 MCP:** Fetches docs; may have its own API cost if external

### Antigravity (Gemini CLI)

- **Gemini API:** Same as above — $0.10/M input, $0.40/M output
- **Antigravity:** Uses Gemini. Cost = Gemini API usage.
- **Skills:** Free (local files)

### Agent-Memory-MCP

- **Cost:** $0 (stores JSON locally, no cloud)
- **If you add Supabase backend:** Same as app — embeddings + storage.

---

## 9. Quick Setup Checklist

| Want | Action |
|------|--------|
| **Claude in Cursor to remember** | Add agent-memory-mcp MCP server, use memory_write/memory_search |
| **Antigravity to remember** | Add skill that instructs Gemini to call memory API, or sync brain/ → agent_knowledge |
| **All agents share memory** | Use Supabase agent_memory + agent_knowledge as single source; build thin API for Cursor/Antigravity to call |
| **Low cost** | Use Flash models, keep Lisa budget low (512), compact context when needed |
| **RAG in app** | Already wired. Add more rows to agent_knowledge, ensure embeddings run. |

---

*References: unified-ai-client.ts, ptd-agent-gemini/index.ts, 20260219000000_secure_lisa_rag_isolation.sql, agent-memory-mcp SKILL.md, rag-engineer SKILL.md, agent-memory-systems SKILL.md, findings.md, BULLETPROOF_EXECUTION.md, ANTIGRAVITY_SYSTEM_SETUP.md.*
