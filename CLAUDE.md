# Vital Suite — Claude Code Project Instructions

## Project Overview

SaaS platform for coaching businesses (PTD Group). Manages clients, health scores, sales pipeline, marketing attribution, and AI-powered coaching intelligence.

## Tech Stack

- **Frontend:** React 19 (^19.2.3), Vite, TanStack Query, shadcn/ui, Tailwind CSS
- **Backend:** 143 Supabase Edge Functions (Deno runtime), Gemini 3 Flash AI (primary)
- **Database:** Postgres + pgvector + pg_cron on Supabase
- **Deploy:** Vercel (frontend auto-deploys on push) + Supabase (edge functions + migrations)
- **AI Provider:** Google Gemini API exclusively. 4-tier cascade: gemini-3-flash-preview → 2.0-flash → 1.5-flash → 3-pro-preview
- **Monitoring:** Sentry, Vercel Analytics, PostHog, LangSmith (optional)

## Autonomous Execution Mode

When running with `--dangerously-skip-permissions`, follow these rules:

### Workflow

1. Read `docs/plans/autonomous-execution-plan.md` for the full task list
2. Read `progress.md` — find the last completed batch, continue from next
3. Execute one batch at a time
4. **VERIFY** after every batch: `npm run build` must pass with 0 errors
5. Update `progress.md` after each batch (mark complete, log any issues)
6. Use **parallel subagents** (Task tool) for tasks marked `[PARALLEL]`
7. Do NOT stop for approval — log issues and continue to next task
8. If a task fails 3 times, skip it, log the failure in progress.md, continue

### Multi-Agent Strategy

- Use `Task` tool with `subagent_type: "Bash"` for independent file edits
- Use `Task` tool with `subagent_type: "general-purpose"` for research or complex changes
- Maximum 3-5 concurrent subagents per batch
- Each subagent: make changes → verify with `npx tsc --noEmit` → report result

### Context Management

- If context is running low (you notice compression happening), finish current task, commit work, update progress.md, then stop cleanly
- Do NOT start a new batch if you're already at 70%+ context usage
- Each batch is designed to be completable in one session

## Critical Safety Rules — DO NOT

- **Delete `openai-embeddings` function** — it is ACTIVE (edgeFunctions.ts:488), NOT orphaned
- **Delete or modify webhook functions** (stripe-webhook, hubspot-webhook, anytrack-webhook, calendly-webhook)
- **Run `supabase db reset`** — destroys production data
- **Modify `.env` files** — secrets are correctly configured
- **Push to main without build passing** — always verify first
- **Delete migration files** — they track deployment state in Supabase
- **Use React 18 APIs** — we are on React 19
- **Install Anthropic/Claude SDK** — we use Gemini exclusively
- **Attempt Batch 7 (Contact Consolidation) autonomously** — requires manual planning + staging environment

## Key File Locations

| File | Purpose |
|------|---------|
| `docs/plans/autonomous-execution-plan.md` | Master execution plan with all batches |
| `docs/plans/2026-02-12-intelligence-upgrade-corrected.md` | Phase 14 detailed execution (44KB) |
| `findings.md` | 17 sections of forensic audit findings |
| `progress.md` | Session log — state tracker for autonomous execution |
| `task_plan.md` | Original master plan (reference only — execution plan supersedes) |
| `src/integrations/supabase/types.ts` | Generated Supabase types (6,851 lines) |
| `supabase/functions/_shared/unified-ai-client.ts` | Shared AI client — 38 files import this |
| `supabase/functions/_shared/tool-executor.ts` | Tool execution layer — 12 executors |
| `supabase/functions/_shared/learning-layer.ts` | Agent memory/learning — modified by Batch 2 |

## Deployment Commands

```bash
# Frontend build (must pass before any commit)
npm run build

# Deploy all migrations (run in order — they have layer dependencies)
supabase db push

# Deploy all edge functions
supabase functions deploy --all

# Regenerate types from production schema
npx supabase gen types typescript --project-id ztjndilxurtsfqdsvfds > src/integrations/supabase/types.ts

# Verify views exist after migration
supabase db execute "SELECT COUNT(*) FROM campaign_full_funnel"
supabase db execute "SELECT COUNT(*) FROM weekly_health_summary"
```

## Verification Pattern (After Every Batch)

```bash
# 1. Build check
npm run build

# 2. TypeScript check (catches type errors build might miss)
npx tsc --noEmit

# 3. Check no Anthropic references remain (after Batch 1)
# grep -r "ANTHROPIC" supabase/functions/ --include="*.ts" | grep -v node_modules

# 4. Git status — see what changed
git diff --stat
```

## Commit Convention

```bash
# Format: type(scope): description
git commit -m "feat(batch-N): description of changes

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

Types: `feat` (new feature), `fix` (bug fix), `refactor` (code change), `chore` (cleanup), `perf` (performance)

## MCP Note

Meta Ads MCP (40 tools, ~26K tokens) and Windsor AI (4 tools, ~2K tokens) consume significant context. During code-heavy work, these are overhead. Focus on code execution, not MCP queries.

## Project Supabase ID

`ztjndilxurtsfqdsvfds`
