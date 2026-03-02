# Deploy Checklist — 2026-03-01

> **Context:** Phase 1 Quick Wins complete. Build passes. Ready for deploy.

---

## Pre-Deploy Verification

```bash
npm run build          # Must pass
npx tsc --noEmit       # Must pass
```

---

## Deploy Steps (Order)

### 1. Database Migrations
```bash
supabase db push
```

### 2. Edge Functions
```bash
supabase functions deploy --all
```

### 3. Regenerate Types (if schema changed)
```bash
npx supabase gen types typescript --project-id ztjndilxurtsfqdsvfds > src/integrations/supabase/types.ts
```

### 4. Commit & Push (Vercel auto-deploy)
```bash
git add -A
git status   # Review changes
git commit -m "feat(phase1): null guards, error boundaries, Context7 pre-bake

- MetricDrilldownModal, CoachLeaderboard, MetaAdsAudience, ZoneDistributionBar, NorthStarWidget
- ClientCard, HealthScoreBadge, DailyTrends, CallIntelligenceKPIs
- Error boundaries: DailyOps, CommandCenter, ExecutiveOverview
- KNOWLEDGE.md: Supabase Edge Function best practices (Context7)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push
```

---

## Post-Deploy Verification

- [ ] Vercel deployment succeeds
- [ ] No console errors on: BusinessIntelligenceAI, CommandCenter, DailyOps, ExecutiveOverview
- [ ] Core tabs load without crash
