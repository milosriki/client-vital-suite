# Deployment Manifest — 2026-03-01

## Migrations to Deploy (4 new)

```bash
supabase db push --project-ref ztjndilxurtsfqdsvfds
```

| # | Migration | What It Does |
|---|-----------|-------------|
| 1 | `20260301000000_agent_knowledge_upsert_constraint.sql` | Unique index on (source, title) for dedup |
| 2 | `20260301000001_powerbi_enrichment_tables.sql` | client_reviews + client_demographics tables + PowerBI columns on training_sessions_live and client_packages_live |
| 3 | `20260301000002_remove_dead_cron_jobs.sql` | Removes ptd-agent-claude and ptd-self-learn cron jobs |
| 4 | `20260225000001_coach_crosscheck_views.sql` | Updated cancel filter (already existed, modified) |

## Edge Functions to Deploy (12 modified)

```bash
supabase functions deploy --project-ref ztjndilxurtsfqdsvfds <function-name>
```

| # | Function | Change |
|---|----------|--------|
| 1 | `ingest-unified-knowledge` | insert -> upsert for dedup |
| 2 | `health-score-engine` | Satisfaction bonus from client_reviews + cancel filter fix |
| 3 | `multi-agent-orchestrator` | Removed fake campaign fallback |
| 4 | `marketing-copywriter` | Zod output validation |
| 5 | `ai-ceo-master` | Zod output validation |
| 6 | `setup-coach-intelligence` | Cancel filter fix |
| 7 | `aws-session-sync` | Cancel filter fix |
| 8 | `error-resolution-agent` | Real AI call replacing mock |
| 9 | `generate-lead-replies` | Constitutional framing + Zod |
| 10 | `ai-client-advisor` | Constitutional framing + few-shot |
| 11 | `sales-objection-handler` | Zod output validation |
| 12 | `super-agent-orchestrator` | Zod synthesis validation |

## New Shared Module

| File | Purpose |
|------|---------|
| `_shared/metrics-calculator.ts` | Canonical ROAS/CPL/CPO/CLV/CAC formulas |

## Scripts Modified

| Script | Change |
|--------|--------|
| `scripts/aws-sync-bridge.cjs` | PowerBI views + syncReviews + syncDemographics |
| `scripts/sync-aws-sessions.mjs` | Cancel filter fix |
| `scripts/sync-aws-to-supabase.cjs` | Cancel filter fix (2 locations) |
| `scripts/ingest-unified-knowledge.mjs` | Added CRAW findings ingestion |

## Frontend Changes (auto-deploy via Vercel on push)

| File | Change |
|------|--------|
| `src/utils/testFunctions.ts` | DEV-only window globals |
| `src/utils/verifyBrowserConnection.ts` | DEV-only window globals |
| `src/config/api.ts` | Removed VITE_PTD_INTERNAL_ACCESS_KEY exposure |
| `src/lib/serverMemory.ts` | Removed internal key from headers |
| `src/hooks/useHiddenViews.ts` | NEW: 12 hooks for hidden views/tables |
| `src/pages/RevenueIntelligence.tsx` | Deal-Stripe Verification tab |
| `src/pages/CallTracking.tsx` | Ad Attribution tab |
| `src/pages/enterprise/SystemObservability.tsx` | Agent Cost + Token Usage panels |
| `src/pages/WarRoom.tsx` | MillionDollarPanel integrated |
| `src/components/meta-ads/MetaAdsPage.tsx` | Vision AI tab |
| `src/config/queryKeys.ts` | RECOMMENDATIONS + HEALTH_ALERTS keys |
| `src/components/dashboard/MetricDrilldownModal.tsx` | Live data recommendations |

## Post-Deploy Verification

```bash
# 1. Build must pass
npm run build

# 2. Regenerate types from production
npx supabase gen types typescript --project-id ztjndilxurtsfqdsvfds > src/integrations/supabase/types.ts

# 3. Run sync bridge to populate new tables
RDS_PASSWORD=xxx SUPABASE_SERVICE_KEY=xxx node scripts/aws-sync-bridge.cjs --full

# 4. Ingest unified knowledge
SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/ingest-unified-knowledge.mjs --source all

# 5. Verify new tables have data
# SELECT COUNT(*) FROM client_reviews;
# SELECT COUNT(*) FROM client_demographics;
# SELECT COUNT(*) FROM agent_knowledge WHERE category = 'findings';
```
