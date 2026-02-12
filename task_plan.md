# MASTER EXECUTION PLAN — Vital Suite Full Stack

## Date: 2026-02-12 (Verified — 13 agents, 4.5/5 evaluation score)

## Goal

Complete the Vital Suite platform across 3 layers: **Supabase DB → Edge Functions/API → Frontend**. Answer the question **"Which Facebook ad is making me money?"** AND upgrade agent intelligence from 46.7 → 82/100.

---

## LAYER 0: CLOUD SERVICES AUDIT & CLEANUP

### AI Provider State (Verified by 5 agents, 50+ files read)

| Provider | Status | Usage | Action |
|----------|--------|-------|--------|
| **Google Gemini API** | ACTIVE (95%+) | 39 agents via UnifiedAIClient, 4-tier cascade | KEEP — Primary AI backbone |
| **Anthropic/Claude** | DEAD CODE | 0 active calls. Commented out in 6 files. `model: "claude"` in ptd-ultimate-intelligence is dead path | REMOVE secrets + dead code |
| **OpenAI** | EMBEDDINGS ONLY | 1 active function: `openai-embeddings` (text-embedding-3-small) | KEEP for now — plan migration to Gemini embeddings |
| **LangChain (frontend)** | UNUSED | `@langchain/core`, `@langchain/google-genai`, `langchain` in package.json | REMOVE from package.json |
| **LangSmith** | OPTIONAL | Tracing in `observability.ts` | KEEP if budget allows |
| **Google Maps** | ACTIVE | `location-service.ts` for location queries | KEEP |

### Anthropic/Claude Dead Code Locations (REMOVE)

| File | Line | What | Action |
|------|------|------|--------|
| `ptd-ultimate-intelligence/index.ts` | 39 | `// const ANTHROPIC_API_KEY = Deno.env.get(...)` | Delete commented line |
| `ptd-ultimate-intelligence/index.ts` | 50,85,200 | `model: "claude"` in persona defs | Change to `model: "gemini"` or remove model field |
| `ptd-ultimate-intelligence/index.ts` | 578 | `if (persona.model === "claude")` | Remove dead branch |
| `system-health-check/index.ts` | 39-57,62 | Lists `ANTHROPIC_API_KEY` for 7 functions | Remove from required secrets list |
| `ai-config-status/index.ts` | 42-43,115-137 | Tests Anthropic + OpenAI connectivity | Remove anthropic test, keep OpenAI for embeddings |
| `super-agent-orchestrator/index.ts` | 318,342-347 | Checks `claudeKey` as fallback | Remove claude fallback |
| `churn-predictor/index.ts` | 24,29 | Commented out `ANTHROPIC_API_KEY` | Delete commented lines |
| `generate-lead-replies/index.ts` | 34,39 | Commented out `ANTHROPIC_API_KEY` | Delete commented lines |
| `intervention-recommender/index.ts` | 32-35 | Commented out `ANTHROPIC_API_KEY` | Delete commented lines |
| `verify-all-keys/index.ts` | 23-24 | Lists Anthropic for 5 functions, OpenAI for 3 | Update to reflect reality |
| `_shared/unified-ai-client.ts` | 29 | `provider: "gemini" | "anthropic" | "openai"` | Remove "anthropic" from union type |

### Additional Dead Code (Found During Verification)

| File | What | Action |
|------|------|--------|
| `src/components/ai/AIAssistantPanel.tsx` | Error msg tells users to set ANTHROPIC_API_KEY | Update to reference GEMINI_API_KEY |
| `ptd-ultimate-intelligence/index.ts` | `generateWithClaude()` function name | Rename to `generateWithAI()` — actually calls Gemini |
| `_shared/observability.ts` | Cost tracking metadata for Anthropic models | Remove dead entries |
| `_shared/langsmith-tracing.ts` | Model-to-provider mapping includes Anthropic | Remove dead mapping |

### Supabase Secrets to Clean Up

```bash
# REMOVE (no longer used):
supabase secrets unset ANTHROPIC_API_KEY
supabase secrets unset LOVABLE_API_KEY

# KEEP:
# GEMINI_API_KEY — Primary AI
# GOOGLE_API_KEY — Gemini fallback
# OPENAI_API_KEY — Embeddings only (until migrated)
# HUBSPOT_ACCESS_TOKEN, STRIPE_SECRET_KEY, etc.
```

### Frontend Package Cleanup

```bash
# REMOVE unused LangChain packages:
npm uninstall @langchain/core @langchain/google-genai langchain
```

### Corrected External Service Inventory (19 total, was 16)

| # | Service | Status | Note |
|---|---------|--------|------|
| 1-13 | (Same 13 active as before) | ACTIVE | No change |
| 14 | **AnyTrack** (MISSED) | ACTIVE | Webhook receiver — anytrack-webhook |
| 15 | **Calendly** (MISSED) | ACTIVE | Webhook receiver — calendly-webhook |
| 16 | **Vercel Analytics** (MISSED) | ACTIVE | Frontend only — src/main.tsx |
| 17 | Anthropic | DEAD | Remove |
| 18 | Dialogflow | DEAD | Delete scripts |
| 19 | Lovable AI | DEAD | Remove secret |

---

## VERIFICATION-DISCOVERED BLIND SPOTS (Add to Batches)

### HIGH Priority (add to Batch 3/5)

| # | Issue | Fix | Batch |
|---|-------|-----|-------|
| 1 | **10 tables without PRIMARY KEY** | Add PK migration | Batch 3 |
| 2 | **5 E2E tests not in CI/CD** | Add test step to deploy-supabase.yml | Batch 5 |
| 3 | **GitHub Actions deploy without tests** | Add `npm run test:e2e` step | Batch 5 |

### MEDIUM Priority (add to Batch 5/6)

| # | Issue | Fix | Batch |
|---|-------|-----|-------|
| 4 | `cron_secret` hardcoded in 4 files | Rotate + move to Supabase Secrets | Batch 6 |
| 5 | Only 15/68 tables have foreign keys | Add FK constraints migration | Batch 6 |
| 6 | No webhook loop protection | Add `updated_by` metadata check | Batch 6 |
| 7 | ESLint disables `no-unused-vars` | Enable + cleanup | Batch 5 |

---

## COMPLETED PHASES (No Further Work)

| Phase | Score | Evidence |
|-------|-------|---------|
| Phase 1: VisualDNA ROAS | DONE | Dashboard ROAS working |
| Phase 2: campaign_id/adset_id | DONE | FB insights stores IDs |
| Phase 4: CPL/CPO metrics | DONE | KPIGrid + CampaignMoneyMap |
| Phase 12: Dashboard column alignment | DONE | 15 column renames, 0 build errors |
| Phase 13: Weekly analytics fix | DONE | weekly_health_summary VIEW + frontend wiring |
| Command Center v1 | DONE | campaign_full_funnel, cold_leads, upcoming_assessments |
| Attribution Deep Views | DONE | adset_full_funnel, ad_creative_funnel, lead_full_journey |
| Attribution Backend | DONE | Executor + tool-definitions + CommandCenter.tsx |
| HubSpot mapDealFields | DONE | Shared across sync-single-deal, backfill, webhook |
| Marketing Validation | DONE | Object validators + UPSERT for 6 agents |
| Memory + Namespacing | DONE | TTL + agent_name in 5 tables |
| Constitutional Framing | DONE | 17+ agents with getConstitutionalSystemMessage() |

**Grand Total Completed: 51 fixes across 22 files + 7 migrations**

---

## EXECUTION ROADMAP — What Needs Doing, In Order

### BATCH 0: DEPLOY & COMMIT (P0, 45 min) — DO FIRST

Everything below is blocked until existing work is committed and deployed.

#### Task 0.1: Commit All Phase 14 + Uncommitted Work

```
git add <all modified/untracked files from git status>
git commit -m "feat: Phase 14 Intelligence Upgrade + Attribution Pipeline Complete"
```

#### Task 0.2: Deploy 26 Pending Migrations

**STRICT ORDER (Layer dependencies):**

| Layer | Migrations | Dependencies |
|-------|-----------|--------------|
| **L1: Foundation** | `20260204010000` (whatsapp_sales_agent), `20260205000000` (knowledge_base), `20260206000000` (conversation_intelligence), `20260213000004` (token_usage_metrics) | None |
| **L2: Dependent** | `20260204020000` (whatsapp_interactions), `20260205010000` (lead_states), `20260209000000` (health_score_v3), `20260209010000` (knowledge_chunks), `20260209020000` (harden_knowledge) | L1 tables |
| **L3: Views** | `20260212000005` (expand fb_insights), `20260212000006` (source_discrepancy_matrix), `20260213000001` (command_center_views), `20260213000002` (attribution_deep_views), `20260213000003` (weekly_health_summary) | L1+L2 tables |
| **L4: Agent infra** | `20260213000005` (memory_retention_namespacing), `20260213000006` (marketing_upsert_keys) | Agent tables exist |
| **L5: Cron** | `20260212010000` (schedule_followup), `20260213100000` (fix_cron_cost_optimization) | Edge functions deployed |

```bash
supabase db push          # Deploy all migrations in chronological order
supabase functions deploy --all  # Deploy all 143+ edge functions
```

**Verify:**
```bash
supabase db execute "SELECT COUNT(*) FROM campaign_full_funnel"
supabase db execute "SELECT COUNT(*) FROM token_usage_metrics"
supabase db execute "SELECT * FROM cron.job WHERE jobname = 'cleanup-expired-agent-memory'"
```

---

### BATCH 1: CLOUD CLEANUP (P0, 1h)

| # | Task | Files | Effort |
|---|------|-------|--------|
| 1.1 | Remove Anthropic dead code from 10 files | See Layer 0 table above | 30min |
| 1.2 | Remove LangChain packages from frontend | `package.json` | 5min |
| 1.3 | Update system-health-check secret lists | `system-health-check/index.ts` | 10min |
| 1.4 | Update verify-all-keys mappings | `verify-all-keys/index.ts` | 10min |
| 1.5 | Unset ANTHROPIC_API_KEY from Supabase secrets | CLI command | 2min |

**Build + verify after.**

---

### BATCH 2: INTELLIGENCE UPGRADE — Phase 14 (P0, 27-34h)

Full corrected plan: `docs/plans/2026-02-12-intelligence-upgrade-corrected.md`

**Execute in this order:**

| Sub-batch | Tasks | Effort | Risk |
|-----------|-------|--------|------|
| **2A** | 14.9 (typed errors) + 14.7 (constitutional universal) | 3-4h | LOW |
| **2B** | 14.1 (token budget) + 14.3+14.8 combined (retention + namespacing) | 6h | LOW-MED |
| **2C** | 14.2 (tool adoption) + 14.4+14.6 combined (validation + upsert) | 12-16h | MED |
| **2D** | 14.5 (HubSpot consolidation) | 6-8h | MED |

**Key corrections from evaluation (Section 13):**
- `getToolDefinitions()` doesn't exist → use `import { tools }`
- ai-ceo-master already uses `unifiedAI.chat()` — just add tool loop
- `agent_patterns.last_confirmed_at` → actual column is `last_used_at`
- Marketing agents build objects programmatically — validators must be object validators, not JSON.parse
- 6/10 deals column names in original plan were WRONG — verified against types.ts
- Add dedup DELETE before CREATE UNIQUE INDEX (existing duplicate rows)

**Score impact: 46.7 → ~82/100 intelligence score**

---

### BATCH 3: QUICK WINS — Phase 15 (P1, 2h)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 3.1 | Centralize booking stage IDs (hardcoded in 5 locations) | 30min | NEW `src/constants/dealStages.ts`, update 4 files |
| 3.2 | Register cleanup-agent-memory pg_cron | 15min | NEW migration |
| 3.3 | Fix deals schema mismatch (owner_id/owner_name columns) | 1h | Migration or mapDealFields() adjustment |

---

### BATCH 4: ATTRIBUTION PIPELINE COMPLETION (P1, 15-25h)

These are the remaining Phases 3, 5-11 from the original attribution plan.

| # | Phase | Status | Effort | What |
|---|-------|--------|--------|------|
| 4.1 | Phase 3: Ad attribution on contacts | PARTIAL | 2-4h | Add attributed_ad_id/campaign_id to contacts, wire sync |
| 4.2 | Phase 5: Deal ↔ Stripe link | pending | 4-8h | Match deals to Stripe payments by email + amount |
| 4.3 | Phase 6: Call → ad/deal links | pending | 3-5h | Wire call_records to attribution_events + deals |
| 4.4 | Phase 7: Revenue per creative | pending | 3-5h | SQL view joining ads → contacts → deals → revenue |
| 4.5 | Phase 8: Live currency rates | pending | 1-2h | Replace hardcoded USD/EUR→AED in stripe-dashboard-data |
| 4.6 | Phase 9: Real churn rate | pending | 1-2h | Compute from actual client drop-offs, not health zones |
| 4.7 | Phase 10: Fix aggregator mocks | pending | 2-3h | Replace hardcoded 3 creatives + 50 contacts with real queries |
| 4.8 | Phase 11: Deal webhook | pending | 1h | Add deal.propertyChange handler in hubspot-webhook-receiver |

**After 4.4:** You can answer "Ad X spent AED Y and generated AED Z = TRUE ROI of N%"

---

### BATCH 5: FRONTEND HARDENING (P2, 3-5h)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 5.1 | Error boundaries on Dashboard, CommandCenter, SetterActivityToday | 1-2h | No white screens on query failures |
| 5.2 | Data freshness indicators (last_synced_at badges) | 1h | Users know data age |
| 5.3 | Delete 6 dead pages (741 LOC) | 30min | Bundle size reduction |
| 5.4 | Fix 29 `any` type usages | 1h | Type safety improvement |
| 5.5 | Remove 3 console.log from production | 5min | Clean logs |

Dead pages to remove:
- `Dashboard.tsx` (duplicate of ExecutiveDashboard)
- `FishbirdValidation.tsx`
- `IntelligenceDashboard.tsx`
- `SuperDashboard.tsx`
- `UltimateDashboard.tsx`
- `WorkflowStrategy.tsx`

---

### BATCH 6: INFRASTRUCTURE HARDENING (P2, 8-10h)

| # | Task | Effort | Severity |
|---|------|--------|----------|
| 6.1 | Add auth-middleware to 7 unprotected edge functions | 1h | HIGH |
| 6.2 | Migrate marketing-copywriter + stripe-enterprise-intelligence from raw Gemini fetch → UnifiedAI | 1h | MED |
| 6.3 | Audit 323 potentially unused indexes (verify against production before dropping) | 4h | HIGH |
| 6.4 | client_health_scores autovacuum tuning | 30min | MED |
| 6.5 | Cron schedule consolidation (44 schedules → clean SSOT) | 1h | LOW |
| 6.6 | Orphan table audit (158 tables — identify dead ones) | 2h | LOW |

---

### BATCH 7: CONTACT CONSOLIDATION (P3, 16-24h) — SEPARATE PLAN REQUIRED

**DEFERRED from Phase 14.10. CRITICAL RISK.**

4 overlapping contact tables → 1 unified `contacts` table + backward-compatible VIEWs.

**Prerequisites:**
- [ ] Complete inventory: all `enhanced_leads` queries (16+ frontend files)
- [ ] Complete inventory: all `sales_leads` queries
- [ ] Staging environment with production data clone
- [ ] Full database backup
- [ ] Frontend PR ready with all query updates

**This task needs its own detailed plan before execution.**

---

## COMPLETE MIGRATION INVENTORY (26 Undeployed)

| # | Migration | Layer | Phase |
|---|-----------|-------|-------|
| 1 | `20260204010000_whatsapp_sales_agent.sql` | Foundation | Lisa |
| 2 | `20260204020000_whatsapp_interactions.sql` | Dependent | Lisa |
| 3 | `20260205000000_create_knowledge_base_table.sql` | Foundation | RAG |
| 4 | `20260205010000_create_lead_states.sql` | Dependent | WhatsApp |
| 5 | `20260205020000_create_whatsapp_interactions.sql` | Dependent | WhatsApp (dup of #2?) |
| 6 | `20260206000000_conversation_intelligence.sql` | Foundation | Intelligence |
| 7 | `20260206010000_smart_intelligence.sql` | Foundation | Intelligence |
| 8 | `20260209000000_add_health_score_v3_fields.sql` | Dependent | Health |
| 9 | `20260209010000_create_knowledge_chunks.sql` | Dependent | RAG |
| 10 | `20260209020000_harden_knowledge.sql` | Dependent | RAG |
| 11 | `20260210000000_atlas_trigger.sql` | Dependent | Trigger |
| 12 | `20260210010000_booking_notifications.sql` | Dependent | Notifications |
| 13 | `20260210020000_social_proof.sql` | Foundation | Social |
| 14 | `20260211999999_fix_followup_view.sql` | View | Followup |
| 15 | `20260212000000_audit_cleanup.sql` | Maintenance | Cleanup |
| 16 | `20260212000005_expand_facebook_ads_insights.sql` | ALTER | Attribution |
| 17 | `20260212000006_fix_source_discrepancy_matrix.sql` | View | Attribution |
| 18 | `20260212010000_schedule_followup.sql` | Cron | Followup |
| 19 | `20260213000001_command_center_views.sql` | View | CommandCenter |
| 20 | `20260213000002_attribution_deep_views.sql` | View | Attribution |
| 21 | `20260213000003_weekly_health_summary.sql` | View | Analytics |
| 22 | `20260213000004_token_usage_metrics.sql` | Foundation | Phase 14.1 |
| 23 | `20260213000005_memory_retention_and_namespacing.sql` | ALTER | Phase 14.3+8 |
| 24 | `20260213000005500_backup_marketing_tables.sql` | Maintenance | Backup |
| 25 | `20260213000006_marketing_upsert_keys.sql` | ALTER | Phase 14.6 |
| 26 | `20260213100000_fix_cron_cost_optimization.sql` | Cron | Cost savings |

**Warning:** Migration #5 may duplicate #2. Review content before deploying.

---

## CRON SCHEDULE (Active After Deployment)

| Job | Schedule | Edge Function | Purpose |
|-----|----------|--------------|---------|
| health-calculator | 4x/day (2,8,14,20 UTC) | calculate-health-scores | Client health scores |
| ptd-24x7-monitor | Every 15min | ptd-24x7-monitor | System monitoring |
| daily-interventions | 10:30 UTC | intervention-recommender | RED/YELLOW zone alerts |
| daily-capi-sync | 11:00 UTC | sync-hubspot-to-capi | HubSpot→Meta CAPI |
| watcher-every-6h | Every 6h | ptd-watcher | System watcher |
| daily-report | 18:00 UTC | daily-report | End-of-day report |
| weekly-coach-analysis | Mon 8:00 | coach-analyzer | Weekly coach review |
| cleanup-agent-memory | 3:00 UTC daily | cleanup-agent-memory | Memory TTL enforcement |
| deep-intel-historian | 0:30 UTC | marketing-historian | Historical baselines |
| deep-intel-funnel | 0:35 UTC | funnel-stage-tracker | Funnel metrics |
| deep-intel-loss-analyst | 0:40 UTC | marketing-loss-analyst | Loss analysis |
| deep-intel-predictor | 0:45 UTC | marketing-predictor | Spend prediction |
| deep-intel-ceo-brief | 4:30 UTC | daily-marketing-brief | CEO morning brief |
| ptd-antigravity-followup | Hourly | antigravity-followup-engine | Lead followup |

**Cost: ~180 invocations/day (down from ~560 — 68% reduction)**

---

## EDGE FUNCTION INVENTORY (111+ active)

| Category | Count | Key Functions |
|----------|-------|---------------|
| AI/Agent | 25 | ptd-agent-gemini, ai-ceo-master, ptd-ultimate-intelligence, agent-orchestrator |
| Data Sync | 20 | sync-hubspot-to-supabase, fetch-callgear-data, fetch-facebook-insights, sync-single-deal |
| Webhooks | 9 | hubspot-webhook, stripe-webhook, anytrack-webhook, callgear-webhook |
| Cron/Scheduled | 17 | calculate-health-scores, ptd-24x7-monitor, cleanup-agent-memory |
| Dashboard API | 11 | business-intelligence-dashboard, stripe-dashboard-data, financial-analytics |
| Marketing Intelligence | 10 | marketing-scout, marketing-analyst, marketing-predictor, marketing-copywriter |
| WhatsApp/Lisa | 5 | aisensy-orchestrator, dialogflow-fulfillment, generate-lead-reply |
| Stripe Advanced | 9 | stripe-enterprise-intelligence, client-payment-integrity, stripe-payouts-ai |
| CallGear | 6 | fetch-callgear-data, callgear-live-monitor, sync-single-call |
| Utility | 19 | system-health-check, verify-all-keys, ai-config-status |

**Model Cascade:** gemini-3-flash-preview → gemini-2.0-flash → gemini-1.5-flash → gemini-3-pro-preview

---

## ENVIRONMENT VARIABLES (Required Secrets)

### KEEP (Active)
- `GEMINI_API_KEY` — Primary AI (40+ functions)
- `GOOGLE_API_KEY` — Gemini fallback
- `HUBSPOT_ACCESS_TOKEN` — CRM (30+ functions)
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — Payments
- `CALLGEAR_API_KEY` + `CALLGEAR_API_URL` — Call tracking
- `PIPEBOARD_API_KEY` — Meta Ads MCP
- `FB_PIXEL_ID` + `FB_ACCESS_TOKEN` + `META_ACCESS_TOKEN` — Facebook/CAPI
- `OPENAI_API_KEY` — Embeddings only (1 function)
- `LANGSMITH_API_KEY` — Tracing (optional)

### REMOVE (Dead)
- `ANTHROPIC_API_KEY` — Zero active calls

### VERIFY (May be missing)
- `PIPEBOARD_API_KEY` — Required by fetch-facebook-insights (NEW)
- `META_AD_ACCOUNT_ID` — Falls back to hardcoded `act_349832333681399`

---

## SCORING PROJECTIONS

| Milestone | Intelligence Score | Infrastructure | Overall |
|-----------|--------------------|---------------|---------|
| **Current** | 46.7/100 | 82/100 | 63.8/100 |
| After Batch 0 (Deploy) | 46.7 | 85 | 65 |
| After Batch 1 (Cleanup) | 46.7 | 86 | 66 |
| After Batch 2 (Phase 14) | **~82** | 86 | **~83** |
| After Batch 4 (Attribution) | 82 | 88 | 85 |
| After Batch 5+6 (Hardening) | 82 | 92 | **~87** |
| After Batch 7 (Contacts) | 85 | 95 | **~90** |

---

## TOTAL EFFORT ESTIMATE

| Batch | Tasks | Effort | Risk | When |
|-------|-------|--------|------|------|
| 0: Deploy & Commit | 2 tasks | 45min | LOW | NOW |
| 1: Cloud Cleanup | 5 tasks | 1h | LOW | NOW |
| 2: Intelligence Upgrade | 9 fixes (4 sub-batches) | 27-34h | LOW→MED | Week 1-4 |
| 3: Quick Wins | 3 tasks | 2h | LOW | Week 1 |
| 4: Attribution Pipeline | 8 phases | 15-25h | MED | Week 2-5 |
| 5: Frontend Hardening | 5 tasks | 3-5h | LOW | Week 3 |
| 6: Infra Hardening | 6 tasks | 8-10h | MED | Week 4-5 |
| 7: Contact Consolidation | 1 mega-task | 16-24h | HIGH | Week 6+ (needs own plan) |
| **TOTAL** | **39 tasks** | **~73-102h** | — | **6-8 weeks** |

---

## PLAN REFERENCES

| Document | Contents |
|----------|----------|
| `docs/plans/2026-02-12-intelligence-upgrade-corrected.md` | Phase 14 corrected execution plan (addresses 20 HIGH issues) |
| `docs/plans/2026-02-12-phase-15-roadmap.md` | Post-intelligence deployment plan |
| `docs/plans/2026-02-12-deep-dive-cross-check.md` | 5-audit compilation with priority ranking |
| `docs/plans/2026-02-12-full-architecture-brainstorm.md` | Architecture vision |
| `findings.md` | 13 sections of forensic audit findings |
| `progress.md` | 11 sessions, 51 fixes applied |
