# PTD Tracking & Analytics: Ultimate Solution Prompt

> **For:** AI Dev Team | **Synthesizes:** Manus Briefing, data-scientist, business-analyst, Meta CAPI, Context7 patterns  
> **Date:** 2026-03-01 | **North Star:** "Which ad made me money?" — full value flow + attribution

---

## 1. Executive Context

**Business:** PTD Fitness (personaltrainersdubai.com) — personal training sales funnel.  
**Stack:** Webflow, GTM (GTM-PH2SDZQK client / GTM-WRWPQTKB Stape server), HubSpot 7973797, Typeform, Calendly, Meta Pixel 714927822471230, GA4 G-41VE6XV516, TikTok CRTPIGRC77U3OBONC2F0.

**Constraints (non-negotiable):**
- NO n8n, NO Zapier, NO Supabase
- Max $100/month new tools
- HubSpot Free/Starter
- Preferred: HubSpot workflows + Cloudflare Workers

---

## 2. Critical Issues (Priority Order)

| # | Issue | Root Cause | Impact |
|---|-------|------------|--------|
| 1 | GTM conversion tags never fire | Trigger `hubspot_form_submission` never pushed — site uses Typeform/Calendly, not HubSpot forms | 7% of leads (website) untracked |
| 2 | HubSpot lifecycle bug | Workflow `deal-default-122237508` sets `lifecyclestage` to `1184339785` (Schedule) instead of `opportunity` — blocks Closed Won from setting `customer` | ~60% of paying customers invisible to Meta CAPI |
| 3 | GA4 hardcoded values | `generate_lead` = 50 AED, `complete_registration` = 100 AED | Distorted analytics |
| 4 | CAPI user data null | `DT Lead` / `Meta Lead` read `orderData.customer.billing.*` (WooCommerce) — site is not WooCommerce | Advanced Matching broken |
| 5 | HubSpot CAPI 0 AED | Native integration sends 0 for all lifecycle events | 93% of leads; VBB ineffective |
| 6 | 15-contact deal association | 15 contacts per deal instead of 1 | Attribution corrupted |

---

## 3. Value Mapping (Single Source of Truth)

**Must be identical across GTM, GA4, HubSpot CAPI, Purchase webhook.**

### 3.1 Lead Value by Location Tier

| Tier | Neighborhoods | Lead Value (AED) | Predicted LTV (AED) |
|------|---------------|------------------|---------------------|
| Premium | Palm Jumeirah, DIFC, Emirates Hills, JBR | 800 | 12,000 |
| High | Marina, JLT, Business Bay, Jumeirah, Dubai Hills | 600 | 8,000 |
| Standard | Sports City, Motor City, Barsha, Greens, Views, Arabian Ranches, Mirdif | 400 | 5,000 |
| Low | Discovery Gardens, Downtown Deira, Abu Dhabi | 200 | 3,000 |

### 3.2 Lifecycle Event Values for CAPI

| Event | Meta Event Name | Value Formula |
|-------|-----------------|---------------|
| New Lead | `Lead` | `lead_value` from tier |
| Sales Qualified Lead | `salesqualifiedlead` | `lead_value × 2` |
| Opportunity | `opportunity` | `predicted_ltv × 0.3` |
| Customer (Closed Won) | `Purchase` | `deal.amount` (actual) |

---

## 4. Fix Instructions (Copy-Paste Ready)

### 4.1 GTM Fix 1: Page View Trigger

**Problem:** 7 conversion tags fire on `CE hubspot_form_submission Lead` — never fires on Typeform/Calendly flow.

**Action:**
1. Create trigger: `Page View` → `Some Page Views` → `Page Path` `contains` `/thank-you`
2. Re-assign these 7 tags to the new trigger: Meta Lead, DT Lead, Ga4 generate_lead, Gads CT Submit Lead Form, etc.

### 4.2 GTM Fix 2: GA4 Values

**generate_lead:** Change `value` from `50` to `{{CJS Lead Value}}`.  
**complete_registration:** Change `value` from `100` to `{{CJS Lead Value}}` or `{{CJS Predicted LTV}}` × 0.3.

### 4.3 GTM Fix 3: CAPI User Data

**DT Lead + Meta Lead:** Change all User Data fields from `DLV orderData.customer.billing.*` to `DLV form_data.*`.  
**location_tier:** Create CJS variable: URL regex → tier name (premium/high/standard/low).  
**lead_score:** Remove (source incorrect).

### 4.4 HubSpot Fix: Lifecycle Workflow

**Workflow:** `deal-default-122237508` (Assessment Confirmed)  
**Action:** Change `lifecyclestage` from `1184339785` to `opportunity`.

### 4.5 HubSpot Custom Properties

Create on Contact:

| Internal Name | Type | Options |
|---------------|------|---------|
| `location_tier` | Dropdown | premium, high, standard, low |
| `lead_value_aed` | Number | 200, 400, 600, 800 |
| `predicted_ltv_aed` | Number | 3000, 5000, 8000, 12000 |
| `lead_source_platform` | Dropdown | meta_native, tiktok_native, google_website, typeform_website, calendly_website, callgear, organic |

**Workflow:** "Set Lead Value from Location" — trigger on `city`/`neighborhood` update; branch by `contains` → set tier + value + LTV.

### 4.6 Purchase CAPI Webhook (Cloudflare Worker)

**Trigger:** HubSpot workflow on `Deal Stage` = `closedwon`.  
**Action:** Webhook → Cloudflare Worker.

**Worker logic:**
1. Receive deal data (amount, contact email, phone, fbc, fbp, deal_id).
2. SHA256-hash email (lowercase, trimmed) and phone (E.164).
3. POST to `https://sst.personaltrainersdubai.com/fb_capi`:

```json
{
  "event_name": "Purchase",
  "event_time": <unix_timestamp>,
  "event_id": "purchase_{deal_id}_{timestamp}",
  "action_source": "system_generated",
  "user_data": {
    "em": ["<sha256_email>"],
    "ph": ["<sha256_phone>"],
    "fbc": "<from_contact>",
    "fbp": "<from_contact>"
  },
  "custom_data": {
    "currency": "AED",
    "value": <deal.amount>,
    "content_name": "PT Package",
    "content_ids": ["pt-package"],
    "content_type": "product"
  }
}
```

**Meta CAPI:** `em`, `ph` hashed; `fbc`, `fbp` NOT hashed per Meta docs.

---

## 5. Data-Scientist Lens (Attribution & Validation)

- **Attribution:** Use first-touch vs last-touch for lead source; multi-touch for Purchase.
- **Cohort:** Segment by `location_tier` for LTV validation.
- **Statistical:** MoM +100% when prev=0 → flag "from zero"; use confidence intervals for ROI.
- **Validation:** Compare Meta Events Manager vs GA4 vs HubSpot for event counts; reconcile discrepancies.
- **CLV:** `predicted_ltv` = 3× package value; validate against actual churn data.

---

## 6. Business-Analyst Lens (KPIs & Reporting)

- **North Star:** Revenue per ad spend (ROAS).
- **Funnel:** Lead → SQL → Opportunity → Purchase; conversion rates by tier.
- **KPI:** CPL, CPO, CAC, LTV, LTV:CAC.
- **Dashboard:** Value by source (Meta native vs website vs TikTok); value by tier.
- **Alert:** When Purchase events drop or HubSpot CAPI sends 0 for >24h.

---

## 7. Lead Flow Architecture (Corrected)

| Source | Flow | CAPI Status |
|--------|------|-------------|
| Meta native (83%) | Lead Form → HubSpot → HubSpot CAPI | 0 AED ❌ |
| TikTok native | Lead Form → HubSpot | No CAPI ❌ |
| Website (7%) | Typeform/Calendly → /thank-you → GTM | 200–800 AED if trigger fixed ✅ |

---

## 8. Deal Pipeline Stages (Verified)

```
qualifiedtobuy (122178070)
  → decisionmakerboughtin (122237276)
    → assessmentconfirmed (122237508)
      → closedwon / closedlost
```

---

## 9. Execution Checklist

| Step | Action | Owner | Time |
|------|--------|-------|------|
| 1 | GTM: Page View trigger on `/thank-you` | Dev | 2 min |
| 2 | GTM: GA4 `generate_lead` value → `{{CJS Lead Value}}` | Dev | 2 min |
| 3 | GTM: CAPI user data → `form_data.*` | Dev | 15 min |
| 4 | HubSpot: Assessment Confirmed workflow → `opportunity` | Ops | 2 min |
| 5 | HubSpot: Create custom properties + VBB workflow | Dev | 30 min |
| 6 | Cloudflare Worker: Purchase webhook | Dev | 2–4 hrs |
| 7 | HubSpot: 15-contact deal association audit | Ops | 1–2 hrs |

---

## 10. System Credentials

| System | ID |
|--------|-----|
| GTM Client | GTM-PH2SDZQK |
| GTM Server | GTM-WRWPQTKB |
| Stape SST | sst.personaltrainersdubai.com |
| Meta Pixel | 714927822471230 |
| Meta Ad Account | act_349832333681399 |
| GA4 | G-41VE6XV516 |
| HubSpot | 7973797 |
| TikTok | CRTPIGRC77U3OBONC2F0 |

---

## 11. Context7 / MCP Queries (When Implementing)

- **Meta CAPI:** `user_data.em`, `user_data.ph` = SHA256; `fbc`, `fbp` = plain; `action_source` = `system_generated` for backend.
- **GTM:** `dataLayer.push` on `/thank-you` with `form_data`, `location_tier`, `lead_value`, `predicted_ltv`.
- **GA4 Measurement Protocol:** For CRM→GA4 `purchase` events (server-side).

---

*This prompt synthesizes: PTD AI Dev Team Briefing (Feb 28), Deployment Guide (Feb 27), LIFECYCLE BUG EVIDENCE, CORRECTED LEAD FLOW, data-scientist and business-analyst skills, and Meta CAPI patterns.*
