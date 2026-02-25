# PRD: Phase 0 — Safety & Stability Fixes

## Context
Working directory: /Users/milosvukovic/client-vital-suite
This is a Supabase + React + TypeScript project with 143 edge functions.

## Tasks

- [x] Remove exec_sql RPC call from supabase/functions/ai-trigger-deploy/index.ts line 295. Replace with safe supabase.from().upsert() or remove if dead code. Read the full function first to understand what exec_sql does there.
- [x] Fix daily_summary race condition: Two functions write to daily_summary (supabase/functions/business-intelligence/index.ts line 284 and supabase/functions/daily-report/index.ts line 277). Remove the upsert from business-intelligence, keep only daily-report as the single canonical writer.
- [x] Replace enhanced_leads with contacts in 4 frontend files: src/components/dashboard/AlertsBar.tsx:30, src/components/dashboard/TodaySnapshot.tsx:42, src/components/hubspot-live/hooks/useHubSpotRealtime.ts:118, src/utils/detectTestData.ts:152+299. Adjust column names if needed (check types.ts for contacts schema).
- [ ] Remove Anthropic dead code from these 11 files: ptd-ultimate-intelligence, system-health-check, ai-config-status, super-agent-orchestrator, churn-predictor, generate-lead-replies, intervention-recommender, verify-all-keys, unified-ai-client.ts. Remove commented-out Claude imports, dead model branches, and the ANTHROPIC_API_KEY references.
- [ ] Run npm run build && npx tsc --noEmit to verify zero errors
- [ ] Git commit: "fix: phase 0 - safety fixes, race condition, dead code removal"
