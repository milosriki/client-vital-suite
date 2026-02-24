# BRAINSTORM: Remaining Gaps After Wave 1 Execution
## Date: 2026-02-24 14:21 PST

---

## WHAT WE DID (Wave 1 — 11 agents, 30 minutes)
✅ Security: 21 functions auth'd, 3 P0s fixed (hardcoded password, HubSpot signature, callgear JWT, RLS locked)
✅ Attribution: stripe_payment_id on deals, fb_ad_id sync, CPL/CPO, phone matching
✅ GPS: Pattern analyzer, trust scores, predictions, 30-day retention, CoachLocations wired
✅ HubSpot: 3 root cause bugs (consconsole typo, caller_number reversed, onConflict wrong)
✅ Creative DNA: TRUE ROAS calculator, fatigue detection, budget optimizer, CreativeGallery wired
✅ UI: Currency AED, Creative DNA tab, 3 archived pages restored, empty states
✅ Data: loss_analysis 0→1388, baselines 3→71, missing views created, migration fixed

---

## WHAT'S STILL BROKEN (Verified gaps)

### TIER 1: Revenue-Critical (Fix NOW)

| # | Gap | Evidence | AED Impact | Fix |
|---|-----|----------|------------|-----|
| R1 | **Static currency rates** (USD→AED 3.67 hardcoded) | stripe-dashboard-data:12-13 | Every Stripe amount wrong if rates drift | Create update-currency-rates function + daily cron |
| R2 | **VisualDNA ROAS shows 0** | purchase_value queried but may be NULL in facebook_ads_insights | Marketing page misleading | Join fb_ads_insights → deals for TRUE revenue, not Meta-reported |
| R3 | **daily_summary race condition** | 2 writers: business-intelligence AND daily-report both upsert | Metrics can flip-flop | Single writer (daily-report) + read-only view for business-intelligence |
| R4 | **enhanced_leads still queried** in 4 components | AlertsBar, TodaySnapshot, HubSpotTabs, detectTestData | Stale data, should use contacts | Replace all enhanced_leads → contacts |
| R5 | **exec_sql RPC in ai-trigger-deploy** | Line 295 — raw SQL execution | SQL injection vector | Remove or parameterize |
| R6 | **NorthStarWidget "500k ARR" hardcoded** | NorthStarWidget.tsx:57 | CEO sees wrong target | Pull from org_memory_kv or make configurable |

### TIER 2: Intelligence Gaps (Fix this session)

| # | Gap | Evidence | Fix |
|---|-----|----------|-----|
| I1 | **No cron for new functions** | populate-loss-analysis, populate-baselines, ad-creative-analyst, true-roas-calculator | Create migration with 4 new cron schedules |
| I2 | **sales-objection-handler empty** | 91 lines, no real logic | Build NEPQ-based objection handler |
| I3 | **4 marketing agents could be smarter** | copywriter (235L), historian (373L) — functional but basic | Enhance with Antigravity AI skills |
| I4 | **No deal.propertyChange webhook** | Deal stage changes only sync on scheduled run | Add to HubSpot webhook handler |
| I5 | **Churn prediction exists but not wired to alerts** | ml-churn-score (356L), churn-predictor (399L) — but no proactive alerts | Wire to proactive-insights-generator |

### TIER 3: Attribution Deep Enrichment

| # | Gap | Current State | Absolute Truth Plan |
|---|-----|--------------|---------------------|
| A1 | **AnyTrack → HubSpot lead ID gap** | AnyTrack tracks fb_ad_id but HubSpot native forms don't pass lead_id unless on landing page | Enrich attribution_chain: JOIN anytrack events ON email/phone, not just external_id |
| A2 | **5 HubSpot sync functions, different field mappings** | sync-hubspot-to-supabase, sync-hubspot-contacts, sync-hubspot-data, manual_hubspot_sync, force_sync_hubspot | Consolidate to ONE sync function with full field mapping |
| A3 | **Stape CAPI sends but doesn't verify** | send-to-stape-capi sends events, but no validation they were received by Meta | Add capi-validator call after send, log success/failure |
| A4 | **attribution_events → contacts match rate unknown** | 2,313 events but join coverage unchecked | Add attribution coverage metric to daily-report |
| A5 | **Call → Ad link doesn't exist** | No call_records → attribution_events join | Add phone number bridge: call_records.phone → contacts.phone → attribution_chain.fb_ad_id |

---

## CRON JOBS TO ADD (migration)

```sql
-- Daily at 2:00 AM UTC (6 AM Dubai) — Populate loss analysis
SELECT cron.schedule('daily-loss-analysis', '0 2 * * *', $$ ... loss-analyst ... $$);

-- Daily at 3:00 AM UTC — Populate baselines  
SELECT cron.schedule('daily-baselines', '0 3 * * *', $$ ... populate-baselines ... $$);

-- Daily at 4:00 AM UTC — Creative DNA analysis
SELECT cron.schedule('daily-creative-dna', '0 4 * * *', $$ ... ad-creative-analyst ... $$);

-- Daily at 5:00 AM UTC — True ROAS calculation
SELECT cron.schedule('daily-true-roas', '0 5 * * *', $$ ... true-roas-calculator ... $$);
```

---

## DECISION LOG
1. **Single daily_summary writer** — daily-report owns it, business-intelligence reads only
2. **enhanced_leads → contacts** — migration to aliases already exists, just need frontend cleanup
3. **Currency rates** — free API daily, store in org_memory_kv
4. **Attribution absolute truth** — multi-source JOIN (AnyTrack + HubSpot + Stape + CallGear + Stripe) not single source
5. **Churn alerts** — wire ml-churn-score → proactive-insights-generator cron
