# AGENTS.md — Persistent Memory

## Learned User Preferences

- Prefers "deep research" and "deep dive" analysis before implementation
- Wants comprehensive verification and cross-checking before marking work complete
- Uses multi-agent brainstorming for complex architectural decisions
- Prefers consolidating many agents into fewer, more powerful "brain" agents (3-5 instead of 39+)
- Wants Gemini exclusively for AI (OpenAI only for embeddings)
- Avoids hardcoded API keys; prefers Supabase secrets for all keys
- Wants to find dead code, lost features, and abandoned implementations
- Prefers creating unified memory/knowledge base to prevent losing context
- Wants to verify everything is working before completion (verification-before-completion pattern)
- Prefers autonomous execution mode with batch-by-batch verification
- Wants to see exact file paths, line numbers, and evidence for all findings
- Prefers reading reference files (CRAW-FINDINGS, KNOWLEDGE.md, WIRING_ANALYSIS.md) before coding
- Frequently asks to "reverse engineer" existing work and "connect dots" across systems
- Writes in shorthand/typo-heavy style — interpret intent, don't ask for clarification on spelling

## Learned Workspace Facts

- Tech stack: React 19 (^19.2.3), Vite, TanStack Query, shadcn/ui, Tailwind CSS
- Backend: 143 Supabase Edge Functions (Deno runtime), Gemini 3 Flash AI (4-tier cascade)
- Database: Postgres + pgvector + pg_cron on Supabase
- Deploy: Vercel (frontend auto-deploys), Supabase (edge functions + migrations)
- Supabase Project ID: ztjndilxurtsfqdsvfds
- AWS RDS is READ-ONLY (replica) — all intelligence runs in Supabase
- Cancel statuses are hyphenated: 'Cancelled-Trainer Charged', 'Cancelled-Trainer Not Charged', etc. NO plain 'Cancelled'. 'Cancelled-Rebooked' is NOT a real cancel
- Use PowerBI views for richer data: vw_powerbi_schedulers, vw_powerbi_clientpackages, vw_powerbi_clients
- Must update introspect_schema_verbose SQL function when creating new database tables
- Never hardcode client data; always use the client_control tool to fetch it
- Use Tailwind CSS and Shadcn for all UI generation
- Agent architecture: 39 AI-calling functions, consolidation target is 3-5 powerful brain agents
- Constitutional framing only in 17/144 functions (needs expansion to 25+)
- UnifiedAI client used by 38 functions (good adoption)
- Never delete openai-embeddings function — it's ACTIVE (edgeFunctions.ts:488)
- Never delete or modify webhook functions (stripe-webhook, hubspot-webhook, anytrack-webhook, calendly-webhook)
- Never run supabase db reset — destroys production data
- Always run npm run build and npx tsc --noEmit for verification after changes
- Migration naming: YYYYMMDDHHMMSS_description.sql for Supabase migrations
- 19 external services total (16 active, 3 dead: Anthropic, Dialogflow, Lovable)
- Overall system score: 63.8/100 — infrastructure strong (82/100), agents weak (46.7/100)
- Core unsolved problem: "Which ad made me money?" — attribution chain has CRITICAL gaps
- 51+ fixes applied across 22+ files + 7 migrations (sessions Feb 10-13)
- Autonomous batches 0-6 complete. Batch 7 (Contact Consolidation) deferred
- Unified Memory Plan exists at docs/plans/2026-02-22-UNIFIED-MEMORY-PLAN.md — not yet implemented
- CRAW findings (Feb 26): Dashboard "Never" bug fixed, AWS cancel statuses mapped, PowerBI views recommended
- Company: 209 active clients, 1,526 active packages, AED 11.3M portfolio, 33 active coaches
