# PTD Deep Evaluation — Root Causes, Dependencies, Risk

> **Date:** 2026-03-01  
> **Scope:** PTD Tracking + Vital Suite + Full App  
> **Method:** Deep evaluation — root causes, dependency chains, risk levels, "done" criteria

---

## 1. Executive Summary

**Current state:** 64/100 overall. North Star *"Which ad made me money?"* is **blocked** by 4 critical chains. PTD tracking fixes (Mega Prompt) address ~40% of the attribution gap; Vital Suite (Deal↔Stripe, call→ad) addresses the remaining 60%.

**Deep finding:** The problem is not "fix X" — it's **broken dependency chains**. Fixing GTM trigger without dataLayer form_data leaves CAPI user_data empty. Fixing lifecycle without Workflow 4 leaves Purchase at 0. Fixing HubSpot without Typeform/Calendly integration leaves 7% of leads orphaned.

---

## 2. Root Cause Analysis (5 Whys)

### 2.1 Why can't we answer "Which ad made me money?"

| Level | Answer |
|-------|--------|
| **1** | Because we can't compute revenue per ad. |
| **2** | Because deal revenue isn't linked to ad_id. |
| **3** | Because (a) contact→ad link is fragile (attribution_events 2-hop), (b) deal→Stripe missing, (c) CAPI sends 0 value. |
| **4** | Because (a) HubSpot lifecycle bug blocks customer stage, (b) HubSpot native CAPI doesn't support dynamic value for lifecycle events, (c) extracted_ad_id exists but isn't wired to Purchase event. |
| **5** | Because workflows were configured for a different funnel (Schedule vs opportunity), HubSpot CAPI was built for form submissions not CRM lifecycle, and no server-side Purchase webhook exists. |

**Root cause:** Configuration drift + product mismatch (HubSpot CAPI ≠ CRM lifecycle value) + missing integration (Cloudflare Worker for Purchase).

---

### 2.2 Why do GTM conversion tags never fire?

| Level | Answer |
|-------|--------|
| **1** | Because the trigger `hubspot_form_submission` never fires. |
| **2** | Because the site uses Typeform/Calendly, not HubSpot forms. |
| **3** | Because the original setup assumed HubSpot forms; no one updated when Typeform/Calendly were adopted. |
| **4** | Because there's no change control linking "form provider change" to "GTM trigger audit." |
| **5** | Because tracking is treated as one-time setup, not living config. |

**Root cause:** Assumption lock-in (HubSpot forms) + no regression test when form provider changed.

---

### 2.3 Why does HubSpot CAPI send 0 AED?

| Level | Answer |
|-------|--------|
| **1** | Because lifecycle stage events don't include deal amount. |
| **2** | Because HubSpot native CAPI maps lifecycle stages to Meta events but doesn't support dynamic value per contact/deal. |
| **3** | Because the CAPI integration was designed for form submissions (where you can hardcode value), not CRM-driven events. |
| **4** | Because there's no webhook path from HubSpot → external CAPI sender with deal context. |
| **5** | Because the constraint "no n8n/Zapier" blocks the easiest path; Cloudflare Worker was never built. |

**Root cause:** Product limitation (HubSpot CAPI) + missing custom integration (Worker).

---

## 3. Dependency Chains (What Depends on What)

### 3.1 PTD Tracking Chain (Mega Prompt Scope)

```
[Typeform/Calendly] ──► [Thank-you page] ──► [GTM Page View trigger] ──► [7 conversion tags]
       │                        │                        │
       │                        │                        └──► Meta Lead, DT Lead, GA4, GAds
       │                        │
       │                        └──► dataLayer.push(form_data, lead_value) ──► CAPI user_data
       │
       └──► HubSpot integration? ──► Contact created ──► Workflow 1 (extract) ──► extracted_ad_id
                                                                        │
                                                                        └──► Workflow 2 (tier) ──► lead_value_aed

[Deal Closed Won] ──► Workflow 4 ──► capi_purchase_value on contact
       │
       └──► Webhook ──► Cloudflare Worker ──► Stape /fb_capi ──► Meta Purchase event
```

**Critical path:** If Typeform/Calendly don't create HubSpot contacts, the entire website-lead chain is GTM-only (CAPI/GA4 fire) but no CRM record. Attribution to deal is impossible.

**Blocking dependencies:**
- GTM thank-you trigger **blocks** all 7 tags
- dataLayer form_data **blocks** CAPI user_data (Advanced Matching)
- Workflow 4 **blocks** Worker having deal amount
- HubSpot webhook **blocks** Worker firing

---

### 3.2 Vital Suite Chain (Out of PTD Scope)

```
[Facebook Ad] ──► [Lead] ──► [Call?] ──► [Deal] ──► [Stripe Payment]
     │              │           │           │              │
     │              │           │           │              └──► stripe_transactions
     │              │           │           │
     │              │           │           └──► deal.amount (HubSpot)
     │              │           │
     │              │           └──► call_records (no ad_id)
     │              │
     │              └──► attribution_events.fb_ad_id (2-hop to contact)
     │
     └──► facebook_ads_insights (spend, leads, ROAS reported)
```

**Gap:** No single table has (ad_id, contact_id, deal_id, stripe_payment_id). The join is 4-hop and fragile.

---

## 4. Risk Levels (Deep)

### 4.1 Implementation Risk

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Stape /fb_capi endpoint doesn't accept Worker POST format | Medium | High | Verify Stape CAPI client tag config; test with curl before Worker |
| HubSpot webhook doesn't include deal associations | Medium | High | HubSpot workflow "Send webhook" — verify payload includes deal + primary contact |
| Typeform/Calendly have no HubSpot integration | High | Medium | Check integrations; fallback = HubSpot form on thank-you |
| Location tier workflow: city/ip_city empty for many contacts | High | Medium | Meta native leads may not have city; use default "low" |
| 15-contact deal: which is "primary"? | High | High | HubSpot API: primary contact association; workflow must use correct one |

### 4.2 Data Quality Risk

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| hs_analytics_first_url missing for some PAID_SOCIAL contacts | Medium | Medium | Workflow 1 skips; extraction_status = no_url |
| deal.amount in wrong currency | Low | High | HubSpot company currency = AED; verify |
| Duplicate Purchase events (Pixel + Worker) | Medium | Medium | event_id dedup: use purchase_{deal_id}_{ts}; Meta dedupes 48h |
| form_data undefined when CAPI fires | High | High | CJS variable fallback: if !form_data use 400 (standard default) |

### 4.3 Operational Risk

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Workflow 472915365 reverted by another user | Low | High | Document in runbook; lock workflow after fix |
| Cloudflare Worker secret leaked | Low | High | Use env var; rotate if exposed |
| GTM publish breaks existing tags | Medium | Medium | Preview mode; test thank-you flow before publish |

---

## 5. "Done" Criteria (Deep Definition)

### 5.1 PTD Tracking "Done"

| Criterion | Verification Method | Evidence |
|-----------|---------------------|----------|
| Lifecycle bug fixed | New Closed Won contact has lifecyclestage = customer | HubSpot contact record |
| Workflow 4 runs | Closed deal → contact has capi_purchase_value | HubSpot contact property |
| GTM thank-you fires | Visit /thank-you → 7 tags fire in GTM Preview | GTM Preview Network tab |
| CAPI has value | Meta Events Manager → Lead event has value 200–800 | Events Manager Test Events |
| Purchase has value | Meta Events Manager → Purchase event has deal.amount | Events Manager Test Events |
| Worker receives webhook | HubSpot Closed Won → Worker logs show POST | Cloudflare Workers log |
| Website leads → HubSpot | Typeform submit → HubSpot contact created | HubSpot contact created date |

**Not "done" until:** All 7 verified with real or test data.

---

### 5.2 Vital Suite "Done" (North Star)

| Criterion | Verification Method |
|-----------|---------------------|
| Deal↔Stripe link | stripe_transactions has deal_id or invoice_id → deal |
| Call→ad link | call_records has fb_ad_id or attribution_events join |
| ROAS per ad | Dashboard shows revenue per ad_id |
| No runtime crashes | snapshot?.kpis, (x ?? 0).toFixed(n) everywhere |
| VisualDNA ROAS | purchase_value on ad objects |

**PTD Mega Prompt does NOT achieve Vital Suite "done."** It achieves PTD tracking "done."

---

## 6. Statistical Validity (Deep)

### 6.1 Sample Size

| Metric | Current Sample | Required for 80% Power | Status |
|--------|----------------|------------------------|--------|
| Leads per ad | Variable | 30+ per cohort | Some ads < 30 |
| Deals per source | 1 FB sold, 0 Google (from 18 sampled) | 30+ per cohort | Underpowered |
| Conversion rate | 1/18 = 5.6% | 100+ leads for stable rate | Unstable |
| ROAS confidence | N/A | 50+ purchases per ad set | Not achievable yet |

**Implication:** Even after fixes, early results will be noisy. Report with confidence intervals; flag "insufficient data" when n < 30.

### 6.2 Attribution Model Drift

| Platform | Default Attribution | PTD Sales Cycle |
|----------|---------------------|-----------------|
| Meta | 7-day click, 1-day view | 15+ days |
| GA4 | 30-day data-driven | 15+ days |
| Google Ads | 30-day (configurable) | 15+ days |

**Implication:** Meta under-attributes; GA4/Google may over-attribute. Cross-platform comparison will never match. Use first-touch for lead source; multi-touch for Purchase.

---

## 7. Hidden Assumptions (Deep)

| Assumption | If False | Impact |
|------------|----------|--------|
| Thank-you page URL is `/thank-you` | Trigger never fires | All 7 tags dead |
| Typeform/Calendly redirect to same domain | GTM fires in same container | May fire in iframe; dataLayer not shared |
| HubSpot workflow can "Copy property" from deal to contact | Workflow 4 impossible | Need Custom Code or different design |
| Stape has /fb_capi route that accepts JSON | Worker fails | Need to verify Stape client tag endpoint |
| HubSpot "Send webhook" includes associated objects | Worker gets empty payload | Need to configure workflow to fetch deal + contact |
| city/ip_city populated for Meta leads | Location tier = "low" for most | Workflow 2 underperforms |
| deal.amount is numeric | CAPI value invalid | Parse to number; default 0 |

---

## 8. Edge Cases (Deep)

| Edge Case | Handling |
|-----------|----------|
| Contact has no email | CAPI user_data.em = []; use external_id (hashed contact_id) |
| Contact has no phone | CAPI user_data.ph = [] |
| Deal has 0 amount | Send 0; or skip Purchase event (configurable) |
| Multiple contacts on deal | Use primary; HubSpot API: GET deal associations, filter type = primary |
| Lead from TikTok | No hsa_* params; extracted_ad_id = ""; use hs_analytics_source only |
| Thank-you page is Typeform embed | dataLayer may be in parent; verify scope |
| Worker receives duplicate webhook (retry) | event_id = purchase_{deal_id}_{ts}; Meta dedupes |
| HubSpot workflow runs before contact updated | Workflow 4: use "enrollment" not "immediate" — wait for deal stage |

---

## 9. Cross-Domain Impact Matrix

| Fix | PTD Tracking | Vital Suite | Dashboard | Agent |
|-----|--------------|-------------|-----------|-------|
| Lifecycle customer | ✅ CAPI visibility | — | — | — |
| Workflow 4 | ✅ Purchase value | — | — | — |
| GTM thank-you | ✅ Website CAPI | — | — | — |
| Cloudflare Worker | ✅ Purchase CAPI | — | — | — |
| extracted_ad_id | ✅ Ad attribution | ✅ attribution_events | ✅ CampaignMoneyMap | ✅ marketing-scout |
| Deal↔Stripe | — | ✅ Revenue truth | ✅ VisualDNA ROAS | ✅ ROAS calc |
| call→ad | — | ✅ Call attribution | — | — |
| snapshot null fix | — | — | ✅ No crash | — |

---

## 10. Recommended Execution Order (Dependency-Aware)

```
1. HubSpot: Fix 472915365 + deal-default-122237508 (unblocks CAPI visibility)
2. HubSpot: Create properties + Workflow 4 (unblocks Worker payload)
3. HubSpot: Make Workflow 1 permanent (unblocks extracted_ad_id)
4. GTM: Thank-you trigger + re-assign tags (unblocks website conversions)
5. GTM: CJS Lead Value + form_data (unblocks CAPI user_data)
6. Webflow: dataLayer.push on thank-you (unblocks form_data)
7. Typeform/Calendly: HubSpot integration check (unblocks website→CRM)
8. Cloudflare: Worker (depends on 2, 4)
9. HubSpot: Workflow → Worker webhook (depends on 8)
10. Validation: End-to-end test
```

**Critical path:** Steps 1–3 can run in parallel. Step 8 (Worker) blocks step 9. Step 6 (dataLayer) blocks step 5 from working fully.

---

## 11. Deep Evaluation Scorecard

| Dimension | Score | Deep Reason |
|------------|-------|-------------|
| **Attribution completeness** | 35 | Ad→lead yes; lead→deal fragile; deal→revenue no |
| **Value flow** | 25 | CAPI sends 0; no Purchase webhook; GA4 hardcoded |
| **Data quality** | 60 | extracted_* correct when workflow runs; city often empty |
| **Integration coverage** | 45 | Meta 83% covered; Website 7% gap; TikTok unknown |
| **Operational readiness** | 50 | Workflows exist but misconfigured; Worker not built |
| **Statistical validity** | 40 | Sample too small; attribution windows misaligned |
| **Risk mitigation** | 55 | Assumptions documented; edge cases identified |
| **"Done" clarity** | 75 | Criteria defined; verification methods specified |

**Overall deep score: 48/100** — Lower than 64 because deep evaluation surfaces hidden dependencies and risks not in surface evaluation.

---

## 12. Summary: What Deep Evaluation Adds

| Surface Eval | Deep Eval |
|---------------|-----------|
| "Fix workflow 472915365" | Root cause: Schedule vs opportunity; dependency: unblocks 60% of customers for CAPI |
| "Create Cloudflare Worker" | Assumption: Stape accepts format; risk: HubSpot payload may not include deal; edge case: duplicate webhooks |
| "GTM thank-you trigger" | Dependency: dataLayer must have form_data or CAPI user_data empty; Typeform iframe may break scope |
| "7% website leads" | Critical: Typeform/Calendly may not create HubSpot contact; entire website attribution to deal = impossible without integration |
| "64/100" | 48/100 when dependency chains, statistical validity, and hidden assumptions included |

---

*Deep evaluation synthesizes: PTD-BRAINSTORM-FULL-APP-MEGA-PROMPT, PTD-LEAD-TO-PROPERTIES-EVALUATION, 10X-EVALUATION-REPORT, BRAINSTORM-PERFECT-DATA, KNOWLEDGE.md, root cause analysis, dependency mapping, risk assessment.*
