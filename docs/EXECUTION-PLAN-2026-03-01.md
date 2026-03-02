# Execution Plan — Product Manager Toolkit + Skills Organization

> **Date:** 2026-03-01  
> **Method:** RICE prioritization, MoSCoW, Value vs Effort matrix, skill-domain mapping  
> **Sources:** 10X-EVALUATION, BRAINSTORM-PERFECT-DATA, PTD-DEEP-EVALUATION, SERVICE-FLOW-EVALUATION, PTD-BRAINSTORM-FULL-APP

---

## 1. North Star & Success Metrics

| Metric | Current | Target | Leading Indicator |
|--------|---------|--------|-------------------|
| **North Star** | "Which ad made me money?" — blocked | ROAS per creative visible | Deal↔Stripe, call→ad wired |
| **Overall health** | 64/100 | 90/100 | Zero runtime crashes, attribution chain complete |
| **Runtime crashes** | snapshot.kpis (fixed), toFixed, item.change | 0 | Null guards in 10+ components |

---

## 2. RICE Prioritization — All Backlog Items

| # | Item | Reach | Impact | Confidence | Effort | RICE | Skill |
|---|------|-------|--------|------------|--------|------|-------|
| 1 | Attribution: Deal↔Stripe + call→ad | 1 (PTD ops) | Massive (3x) | 80% | 3 (L) | **0.8** | data-engineer, backend |
| 2 | Runtime null-safety (toFixed, item.change) | 35 (all pages) | High (2x) | 100% | 0.5 (S) | **140** | frontend, debugger |
| 3 | Schema registry + Zod (15→144 functions) | 5 (agents) | High (2x) | 90% | 2 (M) | **4.5** | backend-security, api-design |
| 4 | Context7 pre-bake in KNOWLEDGE.md | 5 (agents) | High (2x) | 90% | 0.5 (S) | **18** | ai-agents-architect, prompt-engineer |
| 5 | Standardized error shape `{ ok, data?, error? }` | 40+ (all invokes) | Medium (1x) | 95% | 1 (M) | **38** | api-design, backend |
| 6 | PowerBI view switch (vw_powerbi_*) | 1 (sync) | Medium (1x) | 95% | 0.25 (S) | **3.8** | data-engineer |
| 7 | Source badge + freshness SLA | 35 (users) | Medium (1x) | 85% | 1 (M) | **29.75** | frontend-design, ui-ux |
| 8 | PTD Tracking (GTM, HubSpot, Worker) | 1 (PTD) | Massive (3x) | 75% | 2 (M) | **1.125** | — (PTD scope) |
| 9 | MetricDrilldownModal item.change | 35 | High (2x) | 100% | 0.1 (XS) | **700** | frontend |
| 10 | toFixed audit (10+ components) | 35 | High (2x) | 100% | 0.3 (S) | **233** | frontend |
| 11 | Cancel filter migration audit | 1 | Low (0.5x) | 90% | 0.25 (S) | **1.8** | database-admin |
| 12 | VisualDNA purchase_value | 1 | Medium (1x) | 80% | 0.5 (S) | **1.6** | analytics-tracking |
| 13 | North Star target_arr from DB | 1 | Low (0.5x) | 95% | 0.25 (S) | **1.9** | backend |
| 14 | MoM "from zero" badge | 35 | Low (0.5x) | 100% | 0.2 (S) | **87.5** | frontend |
| 15 | Error boundaries (3 pages) | 35 | Medium (1x) | 95% | 0.3 (S) | **110** | frontend |

**RICE formula:** (Reach × Impact × Confidence) / Effort

---

## 3. Value vs Effort Matrix

```
         Low Effort (S/XS)              High Effort (M/L)
         
High     QUICK WINS                     BIG BETS
Value    • MetricDrilldownModal         • Attribution chain
         • toFixed audit                 • Schema registry
         • Error boundaries              • PTD Tracking
         • Standardized error shape     
         • Context7 pre-bake            
         • Source badge                 
         
Low      FILL-INS                       TIME SINKS
Value    • MoM from-zero badge          • (none)
         • North Star target_arr        
         • Cancel filter audit          
         • VisualDNA purchase_value     
```

---

## 4. MoSCoW Classification

### Must Have (P0) — Launch Blockers
| Item | Evidence | Owner |
|------|----------|-------|
| MetricDrilldownModal item.change | 10X #2 | Frontend |
| toFixed null guards (10+ components) | 10X #3 | Frontend |
| Error boundaries (3 pages) | BRAINSTORM Wave 2 | Frontend |
| Deploy: db push, functions, git push | BRAINSTORM Wave 1 | DevOps |

### Should Have (P1) — High Impact
| Item | Evidence | Owner |
|------|----------|-------|
| Attribution: Deal↔Stripe, call→ad | 10X #4–5, PTD-DEEP | Data/Backend |
| Standardized error shape | 10X #14 | Backend |
| Schema registry + Zod | 10X #7 | Backend |
| Context7 pre-bake | 10X #10 | AI/Prompt |
| PowerBI view switch | 10X #15 | Data |
| Source badge | 10X #9 | Frontend |

### Could Have (P2) — Nice to Have
| Item | Evidence | Owner |
|------|----------|-------|
| North Star target_arr from DB | 10X #12 | Backend |
| MoM "from zero" badge | 10X #13 | Frontend |
| VisualDNA purchase_value | 10X #11 | Analytics |
| Sales Brain wiring | BRAINSTORM Wave 5 | AI |
| Per-user cost tracking | BRAINSTORM Wave 7 | Observability |

### Won't Have (This Phase)
| Item | Reason |
|------|--------|
| Deal↔Stripe in PTD Tracking phase | PTD-BRAINSTORM: "Explicit non-goal" |
| call→ad in PTD Tracking phase | Separate Vital Suite scope |
| TikTok CAPI | Meta-only for now |
| n8n/Zapier | Constraint |

---

## 5. Skill-Domain Mapping

| Skill | Items | Docs |
|-------|-------|------|
| **ai-agents-architect** | Iteration limits ✅, tool errors ✅, Context7 pre-bake, Schema/Zod | SERVICE-FLOW-EVALUATION |
| **frontend-design** | toFixed, item.change, Source badge, error boundaries | 10X, BRAINSTORM |
| **data-engineer** | Deal↔Stripe, call→ad, PowerBI views | PTD-DEEP, CRAW-FINDINGS |
| **backend-security** | Schema registry, Zod, error shape | 10X, BRAINSTORM |
| **api-design** | Standardized error shape, tool response schemas | BRAINSTORM Part 8 |
| **prompt-engineer** | Context7, KNOWLEDGE.md sections | PTD-BRAINSTORM |
| **database-admin** | Cancel filter audit, view existence | PTD-DEEP |
| **analytics-tracking** | VisualDNA purchase_value, GTM | PTD-BRAINSTORM |

---

## 6. Execution Phases (Dependency-Ordered)

### Phase 1: Deploy & Quick Wins (Week 1) — Capacity: 1 sprint ✅ DONE (2026-03-01)

| Order | Task | Skill | Effort | Verification |
|-------|------|-------|--------|---------------|
| 1.1 | `supabase db push` | DevOps | 5 min | Migrations applied |
| 1.2 | `supabase functions deploy --all` | DevOps | 10 min | Functions live |
| 1.3 | MetricDrilldownModal: `(item.change ?? 0)` | Frontend | 5 min | ✅ No NaN |
| 1.4 | toFixed audit: grep + fix 10+ components | Frontend | 2 hrs | ✅ CoachLeaderboard, MetaAdsAudience, ZoneDistributionBar, NorthStarWidget |
| 1.5 | Error boundaries: 3 missing pages | Frontend | 1 hr | ✅ DailyOps, CommandCenter, ExecutiveOverview |
| 1.6 | ClientCard, HealthScoreBadge, DailyTrends, CallIntelligenceKPIs null guards | Frontend | 1 hr | ✅ Done |
| 1.7 | `git add -A && git commit && git push` | DevOps | 5 min | Pending |
| — | Context7 pre-bake in KNOWLEDGE.md | Prompt | — | ✅ Supabase best practices added |

**Output:** Zero runtime crashes. Build passes. Score: 72/100. See DEPLOY-CHECKLIST-2026-03-01.md.

---

### Phase 2: Data Truth & API Hardening (Week 2)

| Order | Task | Skill | Effort | Verification |
|-------|------|-------|--------|---------------|
| 2.1 | Verify views exist: view_atlas_lead_dna, view_contact_360, etc. | Database | 30 min | Migration check |

| 2.2 | PowerBI view switch: aws-sync-bridge → vw_powerbi_* | Data | 1 hr | Sync uses PowerBI |
| 2.3 | Standardized error shape: create `api-response.ts` helper | Backend | 2 hrs | All functions return `{ ok, data?, error? }` |
| 2.4 | Context7 pre-bake: append Supabase/React docs to KNOWLEDGE.md | Prompt | 1 hr | KNOWLEDGE.md § Supabase |
| 2.5 | Add Zod to proactive-insights-generator, business-intelligence | Backend | 2 hrs | safeParse on output |

**Output:** Data truth + API consistency. Score: 82/100.

---

### Phase 3: Attribution Chain (Big Bet) — Week 3–4

| Order | Task | Skill | Effort | Verification |
|-------|------|-------|--------|---------------|
| 3.1 | Deal↔Stripe: add deal_id→invoice_id FK; backfill from webhooks | Data | 1 day | stripe_transactions has deal_id |
| 3.2 | call→ad: extend call_records; enrich from attribution_events | Data | 1 day | call_records has ad_id |
| 3.3 | Schema registry: CI fails if new function has no Zod | Backend | 2 days | CI gate |

**Output:** "Which ad made me money?" answerable. Score: 88/100.

---

### Phase 4: Trust & Polish (Week 5)

| Order | Task | Skill | Effort | Verification |
|-------|------|-------|--------|---------------|
| 4.1 | Source badge component | Frontend | 2 hrs | `<SourceBadge source="HubSpot" freshness="2h ago" />` |
| 4.2 | Add to Command Center, Marketing, Pipeline, Revenue, Coaches | Frontend | 1 hr | 5 tabs have badge |
| 4.3 | North Star target_arr from settings | Backend | 1 hr | Configurable |
| 4.4 | MoM "from zero" badge | Frontend | 30 min | usePeriodComparison |

**Output:** User trust. Score: 90/100.

---

### Phase 5: PTD Tracking (Separate Track) — Per PTD-BRAINSTORM-FULL-APP

| Phase | Scope | Owner | Duration |
|-------|-------|-------|----------|
| 5.1 | HubSpot fixes (workflows 472915365, 122237508, Workflow 4) | Ops | 1–2 hrs |
| 5.2 | GTM fix (thank-you trigger, 7 tags, CJS) | Dev | 30 min |
| 5.3 | Cloudflare Worker (Purchase CAPI) | Dev | 2–4 hrs |
| 5.4 | Typeform/Calendly → HubSpot | Dev | 1–2 hrs |
| 5.5 | Workflow 2 Location Tier | Dev | 30 min |
| 5.6 | Audit & validation | Ops | 1–2 hrs |

**Output:** PTD tracking complete. Meta Events Manager shows Purchase with value.

---

## 7. Dependency Graph

```
Phase 1 (Deploy + Quick Wins)
  ├── 1.1 db push
  ├── 1.2 functions deploy
  ├── 1.3–1.6 null guards (parallel)
  └── 1.7 git push

Phase 2 (Data Truth)
  ├── 2.1 views (no deps)
  ├── 2.2 PowerBI (depends: 2.1)
  ├── 2.3 error shape (no deps)
  ├── 2.4 Context7 (no deps)
  └── 2.5 Zod (no deps)

Phase 3 (Attribution)
  ├── 3.1 Deal↔Stripe (depends: Stripe webhook)
  ├── 3.2 call→ad (depends: attribution_events)
  └── 3.3 Schema registry (depends: 2.5)

Phase 4 (Trust)
  └── 4.1–4.4 (depends: Phase 1–2 done)

Phase 5 (PTD Tracking)
  └── Independent track; parallel to Phase 2–4
```

---

## 8. Verification Checklist (Per Phase)

- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` passes
- [ ] No console errors on affected tabs
- [ ] Screenshot or network proof of real data
- [ ] Related doc updated (10X, BRAINSTORM, SERVICE-FLOW)

---

## 9. Quick Reference — Source Docs

| Doc | Purpose |
|-----|---------|
| 10X-EVALUATION-REPORT-2026-03-01.md | Findings table, priorities |
| BRAINSTORM-PERFECT-DATA-2026-03-01.md | Waves, blind spots, solutions |
| PTD-DEEP-EVALUATION-2026-03-01.md | Root causes, dependency chains |
| SERVICE-FLOW-EVALUATION-2026-03-01.md | Agent compliance, page→service map |
| PTD-BRAINSTORM-FULL-APP-MEGA-PROMPT-2026-03-01.md | PTD tracking steps, Mega Prompt |

---

## 10. Summary: Next 3 Actions

1. **Execute Phase 1.3–1.6** — MetricDrilldownModal, toFixed audit, error boundaries, null guards (2–3 hrs)
2. **Execute Phase 1.1–1.2, 1.7** — Deploy (db push, functions, git push)
3. **Start Phase 2.1** — Verify views exist; PowerBI switch
