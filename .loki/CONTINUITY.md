# LOKI CONTINUITY — Deep Clean Sprint

## Current State
- Sprint: deep-clean-all-pages
- Branch: main
- Phase: DEVELOPMENT
- Tasks: 0/32 complete

## Sprint Objective
Fix ALL 195 issues found in deep audit. Zero fake data. Zero broken queries. Zero deprecated models. Clean types. Clean console. Production-grade.

## Track Status
- **Track A (Security):** NOT STARTED — A1 (gitignore api-keys), A2 (CORS fix 2 functions)
- **Track B (Kill Fake Data):** NOT STARTED — B1 (SystemHealthMonitor), B2 (MetricDrilldownModal trends), B3 (MetricDrilldownModal insights), B4 (PredictiveIntelligence hardcoded)
- **Track C (Regen Types + Fix Casts):** NOT STARTED — C1 (regen types.ts), C2 (remove unnecessary `as never`), C3 (fix remaining `as any`)
- **Track D (Fix Models):** NOT STARTED — D1 (unified-ai-client 1.5-flash), D2 (ai-ceo-master), D3 (multi-agent-orchestrator), D4 (ptd-ultimate-intelligence), D5 (smart-ai-advisor), D6 (vision-analytics), D7 (marketing-copywriter)
- **Track E (Performance):** NOT STARTED — E1 (remove refetchIntervals), E2 (add limits to select *), E3 (error boundaries per widget)
- **Track F (Console Cleanup):** NOT STARTED — F1 (remove 125 console.log/error from 48 files)
- **Track G (Stripe Pipeline):** NOT STARTED — G1 (verify stripe-webhook), G2 (run stripe-backfill)
- **Track H (Cleanup):** NOT STARTED — H1 (root debris), H2 (gitignore updates)

## Key Constraints
- NO mock data — every number from real Supabase queries or show "—"
- AED currency — do NOT divide by 100
- Must pass: npm run build + npx tsc --noEmit
- Do NOT touch webhook functions
- Do NOT run supabase db reset
- Edge functions: use UnifiedAI cascade, not raw GoogleGenerativeAI
- Model cascade: gemini-3.1-pro → gemini-3.1-flash → gemini-2.0-flash

## Completed
(none yet)

## Mistakes & Learnings
(none yet)
