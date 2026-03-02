# PTD HubSpot: Best Way Forward (Data-Scientist Validated)

> **Synthesizes:** Exact HubSpot setup, deal findings (3 contacts), data-scientist lens, Python API script  
> **Date:** 2026-03-01

---

## 1. Deal Findings Summary (Data Validation)

| Contact | Source | Deals | Sold? | Amount |
|---------|--------|-------|-------|--------|
| Carina Fiche | PAID_SOCIAL (Facebook) | 2 | ✅ Yes | 4,296.60 AED |
| Alexandra Lee | Google Ads | 1 | ❌ Pipeline | — |
| Aphraem Dsilva | PAID_SOCIAL | 2 | ❌ Pipeline | — |

**Statistical insight:** 1 of 18 sampled leads converted. **0 of 8 Google Ads leads sold** vs 1 of 10 Facebook. Sample too small for significance, but suggests:
- Facebook native forms drive volume; Google Ads may drive different intent
- Need cohort analysis by `hs_analytics_source` with conversion rate + confidence intervals

**Pipeline stage codes (from data):**
- `122178070` = qualifiedtobuy
- `122237276` = decisionmakerboughtin
- `122237508` = (verify in HubSpot UI)
- `2900542` = unknown
- `1064059183` = test pipeline 729570995
- `closedwon` / `closedlost` = standard

---

## 2. Exact HubSpot Setup (Single Source of Truth)

### 2.1 Contact Properties

| Property | Internal Name | Type | Status | Purpose |
|----------|---------------|------|--------|---------|
| Lead Value | `lead_value` | Number | CREATED | VBB value |
| Predicted LTV | `predicted_ltv` | Number | EXISTS | LTV prediction |
| Location Tier | `location_tier` | Enum | EXISTS | premium/high/standard/low |
| Extracted Ad ID | `extracted_ad_id` | String | CREATED | From `hsa_ad` in first_url |
| Extracted Campaign ID | `extracted_campaign_id` | String | CREATED | From `hsa_cam` |
| Extracted Adset ID | `extracted_adset_id` | String | CREATED | From `hsa_grp` |
| Lead Source Type | `extracted_lead_source_type` | Enum | CREATED | native_lead_form / website |
| FB Lead ID | `fb_lead_id` | String | **NEEDS CREATION** | Meta lead_id |
| FB Browser ID | `fb_browser_id` | String | **NEEDS CREATION** | _fbp cookie |
| FB Click ID | `fb_click_id` | String | **NEEDS CREATION** | _fbc cookie |
| CAPI Purchase Sent | `capi_purchase_sent` | Boolean | **NEEDS CREATION** | Dedup flag |
| CAPI Purchase Value | `capi_purchase_value` | Number | **NEEDS CREATION** | Value sent to Meta |

### 2.2 Deal Properties

| Property | Internal Name | Type | Status |
|----------|---------------|------|--------|
| Lead Value | `lead_value` | Number | CREATED |
| Predicted LTV | `predicted_ltv` | Number | CREATED |
| Location Tier | `location_tier` | Enum | CREATED |

---

## 3. Workflows (Exact Spec)

### Workflow 1: Extract Attribution from First URL ✅
- **Trigger:** Contact created, `hs_analytics_source = PAID_SOCIAL`
- **Action:** Custom Code (Node.js 18) — extract `hsa_ad`, `hsa_cam`, `hsa_grp` from `hs_analytics_first_url`
- **Set:** `extracted_ad_id`, `extracted_campaign_id`, `extracted_adset_id`, `extracted_lead_source_type`
- **Status:** Script exists; ran once for 100+ contacts. **Make permanent workflow.**

### Workflow 2: Set Location Tier and Values ⚠️
- **Trigger:** Contact created
- **Action:** Branch on `city` / `ip_city` / neighborhood → set `location_tier`, `lead_value`, `predicted_ltv`
- **Blocker:** Requires Operations Hub Pro for Custom Code. **Fallback:** Use enrollment-based branches (no code) if properties exist.

### Workflow 3: Fix Closed Won Lifecycle 🔴 CRITICAL
- **Workflow ID:** 472915365 — "Pipeline is Sales Pipeline, deal stage is Closed won"
- **Bug:** Sets `lifecyclestage` = `1184339785` (Schedule) instead of `customer`
- **Fix:** Change action to set `lifecyclestage` = `customer`
- **Note:** Workflow 584645210 "Step 14 - NEW CUSTOMER" was correct but DISABLED — consider re-enabling or fixing 472915365

### Workflow 4: Copy Deal Amount to Contact 🔴 NEW
- **Trigger:** `dealstage = closedwon`
- **Action:** Copy `deal.amount` to primary associated contact's `capi_purchase_value`
- **Purpose:** Supabase/Cloudflare CAPI can send actual value with Purchase event
- **Status:** NOT CREATED

---

## 4. Best Way Forward (Prioritized)

| # | Action | Impact | Effort | Owner |
|---|--------|--------|--------|-------|
| 1 | Fix workflow 472915365: set `customer` not `1184339785` | 60% of customers visible to Meta | 2 min | Ops |
| 2 | Create Workflow 4: copy deal amount → contact | Enables Purchase CAPI with real value | 15 min | Dev |
| 3 | Create 4 missing contact properties (fb_lead_id, fb_browser_id, fb_click_id, capi_purchase_sent, capi_purchase_value) | CAPI dedup + value | 10 min | Ops |
| 4 | Make Workflow 1 permanent (extract attribution) | Ad-level attribution | 5 min | Ops |
| 5 | Workflow 2: Location tier (enrollment branches if no Ops Hub) | VBB values in CRM | 30 min | Dev |
| 6 | Python script: move token to `HUBSPOT_TOKEN` env var | Security | 1 min | Dev |

---

## 5. Python API Script — Security & Usage

**⚠️ SECURITY:** The script contains a hardcoded HubSpot token. **Immediately:**
1. Move to env: `HUBSPOT_TOKEN = os.environ.get("HUBSPOT_TOKEN")`
2. Rotate the exposed token in HubSpot (Settings → Integrations → Private Apps)
3. Never commit tokens to git

**Usage:** Run for last 30 days comparison (Facebook vs HubSpot). Output: `fb_vs_hubspot_comparison.json`.

**Data-scientist validation:**
- Compare `fb_pixel_leads` vs `hs_paid_social` — match rate
- Segment by `hs_analytics_source` for conversion by channel
- Flag when `match_rate < 80%` for investigation

---

## 6. Data-Scientist Recommendations

| Recommendation | Rationale |
|----------------|-----------|
| **Cohort by source** | Compute conversion rate (Lead → Purchase) by `hs_analytics_source`; report with 95% CI |
| **Power analysis** | 8 Google Ads leads → insufficient for significance; need 30+ per cohort for 80% power |
| **Attribution** | Use `extracted_ad_id` when present; fallback to `hs_analytics_source` for source-level ROAS |
| **CLV validation** | Compare `predicted_ltv` vs actual revenue from closed deals; adjust tier multipliers if drift >20% |
| **Deduplication** | `capi_purchase_sent` prevents double-sending Purchase to Meta; set after successful CAPI call |

---

## 7. Cross-Reference

| Doc | Purpose |
|-----|---------|
| PTD-ULTIMATE-SOLUTION-PROMPT-2026-03-01.md | GTM, CAPI, value mapping |
| KNOWLEDGE.md | Vital Suite attribution gaps, Deal↔Stripe |
| CRAW-FINDINGS-2026-02-26.md | AWS cancel status, PowerBI views |

---

*Consolidates: Exact HubSpot Setup, Deal Findings (3 contacts), workflows_complete.json, extraction script, data-scientist validation.*
