# PTD Lead → Properties: Full Trace Evaluation

> **Date:** 2026-03-01  
> **Context7 MCP:** HubSpot, GTM, Meta CAPI, Cloudflare  
> **Purpose:** Ensure every lead detail tracks to a HubSpot property. Evaluate all history.

---

## 1. Lead Source → Property Map (Single Source of Truth)

### 1.1 Meta Native Lead (83% of leads)

| Detail | Source | HubSpot Property | Status | Notes |
|--------|--------|-----------------|--------|-------|
| Ad ID | `hsa_ad` in first URL | `extracted_ad_id` | ✅ Via custom code | Workflow 1 extracts |
| Campaign ID | `hsa_cam` in first URL | `extracted_campaign_id` | ✅ Via custom code | Workflow 1 extracts |
| Adset ID | `hsa_grp` in first URL | `extracted_adset_id` | ✅ Via custom code | Workflow 1 extracts |
| Lead source type | `hsa_la=true` | `extracted_lead_source_type` | ✅ Via custom code | native_lead_form |
| Traffic source | Meta integration | `hs_analytics_source` | ✅ Auto | PAID_SOCIAL |
| First URL (raw) | Meta redirect | `hs_analytics_first_url` | ✅ Auto | Contains hsa_* params |
| Email | Meta Lead Form | `email` | ✅ Auto | From form |
| Phone | Meta Lead Form | `phone` | ✅ Auto | From form |
| Name | Meta Lead Form | `firstname`, `lastname` | ✅ Auto | From form |
| Meta Lead ID | Meta API | `fb_lead_id` | ❌ NOT CREATED | Needed for Conversion Leads |
| _fbp cookie | Browser (not available) | `fb_browser_id` | ❌ NOT CREATED | Native form = no browser |
| _fbc / fbclid | URL (not in native) | `fb_click_id` | ❌ NOT CREATED | Native form = no click ID |
| Location tier | city/neighborhood | `location_tier` | ⚠️ Manual/branch | Workflow 2 needed |
| Lead value (AED) | tier → value | `lead_value_aed` | ⚠️ Manual/branch | Workflow 2 needed |
| Predicted LTV | tier → LTV | `predicted_ltv_aed` | ⚠️ Manual/branch | Workflow 2 needed |

**Gap:** Meta native leads have NO fbc/fbp (form submitted in-app). `fb_lead_id` from Meta API must be captured at lead creation — check HubSpot-Meta integration settings.

---

### 1.2 Website Lead (Typeform/Calendly — 7%)

| Detail | Source | HubSpot Property | Status | Notes |
|--------|--------|-----------------|--------|-------|
| Form submission | Typeform/Calendly | — | ❌ GAP | No HubSpot form = no auto contact |
| Lead value | URL/tier | — | ❌ GAP | Would need dataLayer → ? |
| Location tier | Form field / IP | — | ❌ GAP | Typeform/Calendly → HubSpot? |
| fbc, fbp | Browser cookies | — | ❌ GAP | GTM has; HubSpot doesn't |
| UTM params | URL | `utm_*` | ⚠️ IF contact exists | Only if Typeform/Calendly pass to HubSpot |

**Critical:** Website leads may NOT create HubSpot contacts unless:
- Typeform has HubSpot integration (webhook or Zapier)
- Calendly has HubSpot integration
- A separate form (e.g. on thank-you page) submits to HubSpot

**GTM fix (PTD-ULTIMATE):** Page View trigger on `/thank-you` fires tags — but GTM cannot create HubSpot contacts. The `form_data` in dataLayer is for CAPI/GA4 only.

---

### 1.3 TikTok Native Lead

| Detail | Source | HubSpot Property | Status | Notes |
|--------|--------|-----------------|--------|-------|
| Ad/campaign IDs | TikTok integration | — | ❓ Unknown | Check HubSpot-TikTok integration |
| Traffic source | Integration | `hs_analytics_source` | ⚠️ May differ | e.g. PAID_SOCIAL or custom |
| CAPI | — | — | ❌ No CAPI | HubSpot native CAPI = Meta only |

---

## 2. Custom Code Action Evaluation (Extract Facebook IDs)

**Script:** Extract `hsa_ad`, `hsa_cam`, `hsa_grp` from `hs_analytics_first_url`

### 2.1 Context7 Alignment

| Aspect | Context7 Pattern | Script | Verdict |
|--------|------------------|--------|---------|
| Trigger | Workflow enrollment on contact | Contact created, PAID_SOCIAL | ✅ |
| Input | `objectRequestOptions.properties` | `hs_analytics_first_url` | ✅ Must include in workflow |
| Output | `outputFields` | extracted_ad_id, extracted_campaign_id, extracted_adset_id, extracted_lead_source_type, extraction_status | ✅ |
| URL parsing | — | `split('?')[1]`, `split('&')`, `decodeURIComponent` | ✅ Correct |
| Param names | HubSpot Ad Tracking | `hsa_ad`, `hsa_cam`, `hsa_grp`, `hsa_la` | ✅ Per Meta/HubSpot docs |

### 2.2 Gaps in Script

| Gap | Fix |
|-----|-----|
| `extraction_status` output not in PROPERTIES list | Add to "Set property" actions or remove from output |
| No `utm_campaign` extraction | Optional: add `extracted_utm_campaign` from params |
| `hsa_acc` = account ID | Optional: add `extracted_ad_account_id` for multi-account |
| Website form detection | `hsa_acc` without `hsa_la` → website_form ✅ |

### 2.3 Workflow Requirements (Context7)

Per HubSpot Custom Action docs:
- **objectRequestOptions.properties:** Must include `hs_analytics_first_url`
- **Enrollment:** Contact created + `hs_analytics_source` = PAID_SOCIAL
- **Set property actions:** Map each output to contact property (extracted_ad_id, etc.)

---

## 3. Full Property Checklist (All Details Must Land Somewhere)

### 3.1 Required for "Which ad made me money?"

| Property | Purpose | Created? | Populated By |
|----------|---------|----------|--------------|
| `extracted_ad_id` | Ad-level attribution | ✅ | Workflow 1 (custom code) |
| `extracted_campaign_id` | Campaign ROAS | ✅ | Workflow 1 |
| `extracted_adset_id` | Adset optimization | ✅ | Workflow 1 |
| `extracted_lead_source_type` | native vs website | ✅ | Workflow 1 |
| `hs_analytics_first_url` | Raw source (HubSpot) | ✅ | Auto |
| `hs_analytics_source` | Channel (HubSpot) | ✅ | Auto |
| `location_tier` | Value tier | ✅ | Workflow 2 or manual |
| `lead_value_aed` | CAPI value | ✅ | Workflow 2 |
| `predicted_ltv_aed` | CAPI value | ✅ | Workflow 2 |
| `fb_lead_id` | Meta Conversion Leads | ❌ | HubSpot-Meta integration |
| `fb_browser_id` | CAPI fbp | ❌ | Only for website (GTM→?) |
| `fb_click_id` | CAPI fbc | ❌ | Only for website (GTM→?) |
| `capi_purchase_value` | Purchase event value | ❌ | Workflow 4 (deal→contact) |
| `capi_purchase_sent` | Dedup flag | ❌ | After CAPI send |

### 3.2 Deal → Contact Link (for Purchase CAPI)

| Property | Purpose | Created? | Populated By |
|----------|---------|----------|--------------|
| `deal.amount` | Purchase value | ✅ | Deal property |
| Contact `email` | CAPI user_data.em | ✅ | Contact |
| Contact `phone` | CAPI user_data.ph | ✅ | Contact |
| `capi_purchase_value` | Copy of deal.amount | ❌ | Workflow 4 |

---

## 4. History Synthesis (All Docs Cross-Referenced)

| Doc | Key Finding |
|-----|-------------|
| KNOWLEDGE.md | No ad_id→contact link; Deal↔Stripe missing; attribution_events has fb_ad_id |
| PTD-ULTIMATE-SOLUTION-PROMPT | GTM trigger broken; lifecycle 1184339785 bug; CAPI 0 AED |
| PTD-CONTEXT7-SOLUTIONS-ALL | GTM dataLayer.push; HubSpot lifecycle forward-only; Cloudflare webhook pattern |
| PTD-HUBSPOT-BEST-WAY | Workflow 472915365 sets 1184339785 not customer; Workflow 4 not created |
| 2026 Tracking Best Practices | SST standard; dual Pixel+CAPI; event_id dedup; value 500 AED |
| HubSpot Native CAPI | Lifecycle events send 0 value; only form submission supports value |
| Custom Code Action (user) | Extracts hsa_* correctly; trigger PAID_SOCIAL; needs permanent workflow |

---

## 5. Execution Order (Lead → Properties Complete)

| Step | Action | Impact |
|------|--------|--------|
| 1 | Fix workflow 472915365: `lifecyclestage` = `customer` | 60% customers visible to Meta |
| 2 | Create Workflow 4: Deal closedwon → copy amount to contact `capi_purchase_value` | Purchase CAPI with real value |
| 3 | Create properties: `fb_lead_id`, `fb_browser_id`, `fb_click_id`, `capi_purchase_sent`, `capi_purchase_value` | CAPI completeness |
| 4 | Make Workflow 1 (extract attribution) permanent | Ad-level attribution |
| 5 | Verify Workflow 1 `objectRequestOptions.properties` includes `hs_analytics_first_url` | Extraction works |
| 6 | GTM: dataLayer.push on /thank-you with form_data, lead_value, location_tier | Website leads → CAPI |
| 7 | Typeform/Calendly: Add HubSpot webhook or form to create contact | Website leads → HubSpot |
| 8 | Cloudflare Worker: Purchase webhook with deal+contact data → Meta CAPI | Offline conversions |

---

## 6. Context7-Verified Patterns

| Pattern | Source | Use |
|---------|--------|-----|
| HubSpot lifecycle forward-only | /websites/developers_hubspot | Cannot set backward without clear |
| HubSpot objectRequestOptions.properties | Custom action guide | Must pass hs_analytics_first_url to custom code |
| GTM dataLayer.push | /websites/developers_google_tag-platform | Custom event for lead_submitted |
| Meta CAPI em/ph SHA256, fbc/fbp plain | developers.facebook.com | user_data format |
| Cloudflare Worker POST + verify | /cloudflare/cloudflare-docs | Webhook handler |

---

## 7. Summary: Lead Must Track to Properties

**✅ Already tracking:**
- Meta native: hs_analytics_source, hs_analytics_first_url, email, phone, name
- Extracted: ad_id, campaign_id, adset_id, lead_source_type (via custom code when workflow runs)

**❌ Not tracking:**
- fb_lead_id, fb_browser_id, fb_click_id (CAPI matching)
- capi_purchase_value, capi_purchase_sent (Purchase event)
- Website leads: no HubSpot contact unless Typeform/Calendly integrate

**⚠️ Partially tracking:**
- location_tier, lead_value_aed, predicted_ltv_aed (need Workflow 2)
- Website: GTM has form_data but HubSpot doesn't

---

*Evaluation synthesizes: KNOWLEDGE.md, PTD-ULTIMATE-SOLUTION-PROMPT, PTD-CONTEXT7-SOLUTIONS-ALL, PTD-HUBSPOT-BEST-WAY, 2026 Tracking Best Practices, HubSpot Native CAPI, Custom Code Action script, Context7 MCP query-docs.*
