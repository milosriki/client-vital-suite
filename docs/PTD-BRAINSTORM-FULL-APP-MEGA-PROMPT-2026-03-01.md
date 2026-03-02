# PTD Full App: Brainstorm + Steps + Mega EMA Prompt

> **Date:** 2026-03-01  
> **Method:** Brainstorming skill (design-first, no implementation until lock)  
> **Output:** Full app steps + Mega EMA Prompt for AI agents

---

## Part 1: Understanding Summary (Brainstorm Lock)

### What Is Being Built
- **PTD Tracking & Attribution System** — End-to-end pipeline so PTD Fitness can answer: *"Which ad made me money?"*
- **Scope:** GTM, HubSpot, Meta CAPI, Cloudflare Workers, GA4, Typeform/Calendly, TikTok
- **North Star:** Revenue per ad spend (ROAS) with ad-level attribution

### Why It Exists
- 83% of leads from Meta native forms; 7% from website (Typeform/Calendly); attribution chain broken
- HubSpot CAPI sends 0 AED; lifecycle bug blocks 60% of customers from Meta
- GTM conversion tags never fire (wrong trigger); CAPI user data null (WooCommerce fields on non-WooCommerce site)

### Who It Is For
- PTD Fitness ops/sales team
- AI Dev Team (implementation)
- Future: Marketing analyst, data-scientist

### Key Constraints
- NO n8n, NO Zapier, NO Supabase (for PTD tracking layer)
- Max $100/month new tools
- HubSpot Free/Starter (or Marketing Hub Starter $20/mo)
- Preferred: HubSpot workflows + Cloudflare Workers

### Explicit Non-Goals
- No Deal↔Stripe wiring in this phase (separate Vital Suite scope)
- No call→ad attribution in this phase (separate scope)
- No TikTok CAPI (Meta-only for now)

---

## Part 2: Assumptions

| # | Assumption | Rationale |
|---|------------|-----------|
| A1 | Typeform/Calendly can send webhook to HubSpot or Cloudflare | Required for website leads → HubSpot contact |
| A2 | Stape SST (sst.personaltrainersdubai.com) accepts Purchase events from Cloudflare Worker | Per PTD-ULTIMATE; Stape is server-side GTM |
| A3 | HubSpot workflow 472915365 can be edited (lifecyclestage action) | Ops has access |
| A4 | Webflow thank-you page exists at `/thank-you` | Per GTM fix spec |
| A5 | Location tier mapping (city/neighborhood → value) is stable | Premium/High/Standard/Low per PTD-ULTIMATE |
| A6 | Meta native leads have no fbc/fbp (in-app form) | Acceptable; use email/phone for CAPI matching |

---

## Part 3: Full App Steps (Implementation Plan)

### Phase 1: HubSpot Fixes (Ops + Dev) — 1–2 hrs

| Step | Action | Owner | Time | Verification |
|------|--------|-------|------|--------------|
| 1.1 | Fix workflow 472915365: Change `lifecyclestage` from `1184339785` to `customer` | Ops | 2 min | New Closed Won contact shows customer |
| 1.2 | Fix workflow deal-default-122237508: Change `lifecyclestage` from `1184339785` to `opportunity` | Ops | 2 min | Assessment Confirmed → opportunity |
| 1.3 | Create contact properties: `fb_lead_id`, `fb_browser_id`, `fb_click_id`, `capi_purchase_sent`, `capi_purchase_value` | Ops | 10 min | Properties visible in HubSpot |
| 1.4 | Make Workflow 1 (extract hsa_ad, hsa_cam, hsa_grp) permanent; verify `objectRequestOptions.properties` includes `hs_analytics_first_url` | Ops | 5 min | New PAID_SOCIAL contact gets extracted_ad_id |
| 1.5 | Create Workflow 4: Deal closedwon → Copy `deal.amount` to primary contact `capi_purchase_value` | Dev | 15 min | Closed deal → contact has capi_purchase_value |

### Phase 2: GTM Fixes (Dev) — 30 min

| Step | Action | Owner | Time | Verification |
|------|--------|-------|------|--------------|
| 2.1 | Create trigger: Page View → Page Path contains `/thank-you` | Dev | 2 min | Preview: visit /thank-you → trigger fires |
| 2.2 | Re-assign 7 tags (Meta Lead, DT Lead, GA4 generate_lead, Gads CT Submit Lead Form, etc.) to new trigger | Dev | 10 min | Tags fire on thank-you |
| 2.3 | Create CJS variable `{{CJS Lead Value}}`: URL regex → tier → 200/400/600/800 | Dev | 10 min | Variable returns correct value |
| 2.4 | Change GA4 `generate_lead` value from `50` to `{{CJS Lead Value}}` | Dev | 2 min | GA4 event has tier value |
| 2.5 | Change GA4 `complete_registration` value from `100` to `{{CJS Lead Value}}` or `{{CJS Predicted LTV}}` × 0.3 | Dev | 2 min | GA4 event has tier value |
| 2.6 | Change DT Lead + Meta Lead User Data from `orderData.customer.billing.*` to `form_data.*` | Dev | 5 min | CAPI receives form_data |
| 2.7 | Add `dataLayer.push` on /thank-you page: `{ event: 'lead_submitted', form_data: {...}, lead_value, location_tier }` | Dev | 10 min | dataLayer has form_data on thank-you |

### Phase 3: Cloudflare Worker (Dev) — 2–4 hrs

| Step | Action | Owner | Time | Verification |
|------|--------|-------|------|--------------|
| 3.1 | Create Cloudflare Worker: POST /webhook/purchase | Dev | 1 hr | Worker accepts POST |
| 3.2 | Verify HubSpot webhook signature (HMAC-SHA256) or shared secret | Dev | 30 min | Invalid signature → 403 |
| 3.3 | Parse JSON: deal amount, contact email, phone, deal_id | Dev | 30 min | Payload parsed |
| 3.4 | SHA256-hash email (lowercase, trimmed) and phone (E.164) | Dev | 15 min | Hashed per Meta CAPI |
| 3.5 | POST to `https://sst.personaltrainersdubai.com/fb_capi` with Purchase event | Dev | 30 min | Meta Events Manager shows Purchase |
| 3.6 | HubSpot workflow: Deal closedwon → Webhook to Worker URL | Ops | 15 min | Closed deal triggers Worker |

### Phase 4: Website Leads → HubSpot (Dev) — 1–2 hrs

| Step | Action | Owner | Time | Verification |
|------|--------|-------|------|--------------|
| 4.1 | Typeform: Add HubSpot integration or webhook to create contact | Dev | 30 min | Typeform submit → HubSpot contact |
| 4.2 | Calendly: Add HubSpot integration or webhook to create contact | Dev | 30 min | Calendly booking → HubSpot contact |
| 4.3 | OR: Add HubSpot form on thank-you page (fallback) | Dev | 30 min | Thank-you page creates contact |

### Phase 5: HubSpot Workflow 2 — Location Tier (Dev) — 30 min

| Step | Action | Owner | Time | Verification |
|------|--------|-------|------|--------------|
| 5.1 | Create workflow "Set Lead Value from Location": Trigger on contact created | Dev | 5 min | Workflow enrolls |
| 5.2 | Branch on `city` / `ip_city` contains: Palm Jumeirah, DIFC, etc. → premium (800) | Dev | 10 min | Premium contacts get 800 |
| 5.3 | Branch: Marina, JLT, etc. → high (600); Sports City, etc. → standard (400); else → low (200) | Dev | 10 min | All tiers set |
| 5.4 | Set `location_tier`, `lead_value_aed`, `predicted_ltv_aed` | Dev | 5 min | Properties populated |

### Phase 6: Audit & Validation (Ops) — 1–2 hrs

| Step | Action | Owner | Time | Verification |
|------|--------|-------|------|--------------|
| 6.1 | 15-contact deal association audit: Why 15 contacts per deal? Fix to 1 primary | Ops | 1 hr | Deals have 1 primary contact |
| 6.2 | Compare Meta Events Manager vs GA4 vs HubSpot event counts | Ops | 30 min | Discrepancy log |
| 6.3 | Test: Meta native lead → lifecycle → Purchase in Events Manager | Ops | 15 min | Purchase shows with value |

---

## Part 4: Decision Log

| Decision | Alternatives | Why Chosen |
|----------|--------------|------------|
| Cloudflare Worker for Purchase CAPI | n8n, Zapier, Supabase Edge Function | Constraint: NO n8n/Zapier; Supabase excluded for PTD layer; Worker fits $0 cost |
| Page View trigger for thank-you | Custom Event (lead_submitted) | Simpler; thank-you page = conversion; no code change if dataLayer not ready |
| Workflow 4 copies deal.amount to contact | Worker fetches from HubSpot API | Simpler; workflow has deal context; Worker receives in webhook payload |
| Location tier via enrollment branches | Custom Code (Operations Hub) | Hub Free/Starter may not have Custom Code; branches = no code |
| fb_lead_id, fb_browser_id, fb_click_id created | Skip (native leads have none) | Future-proof; website leads may have fbc/fbp; Conversion Leads needs fb_lead_id |

---

## Part 5: Mega EMA Prompt (Skill / Agent Prompt)

**Use this prompt to drive an AI agent or skill to execute the full PTD tracking implementation.**

---

```
# PTD Tracking: Mega EMA Execution Prompt

You are implementing the PTD Fitness tracking and attribution system. Your North Star: "Which ad made me money?" — full value flow from lead to Purchase event in Meta CAPI.

## Context (Read First)
- Business: PTD Fitness (personaltrainersdubai.com) — personal training, Dubai/Abu Dhabi
- Stack: Webflow, GTM (GTM-PH2SDZQK client, GTM-WRWPQTKB Stape server), HubSpot 7973797, Typeform, Calendly, Meta Pixel 714927822471230, GA4 G-41VE6XV516
- Constraints: NO n8n, NO Zapier, NO Supabase for PTD layer. Max $100/mo. HubSpot Free/Starter. Prefer HubSpot workflows + Cloudflare Workers.

## Execution Order (Do in This Sequence)

### Phase 1: HubSpot (Ops)
1. Fix workflow 472915365: Set lifecyclestage = `customer` (not 1184339785)
2. Fix workflow deal-default-122237508 (Assessment Confirmed): Set lifecyclestage = `opportunity` (not 1184339785)
3. Create contact properties: fb_lead_id, fb_browser_id, fb_click_id, capi_purchase_sent, capi_purchase_value (all string/number as appropriate)
4. Make "Extract Attribution" workflow permanent (trigger: Contact created, hs_analytics_source = PAID_SOCIAL; Custom Code extracts hsa_ad, hsa_cam, hsa_grp from hs_analytics_first_url; set extracted_ad_id, extracted_campaign_id, extracted_adset_id, extracted_lead_source_type)
5. Create Workflow 4: Trigger = Deal stage = closedwon; Action = Copy deal.amount to primary contact's capi_purchase_value

### Phase 2: GTM (Dev)
1. Create trigger: Page View, Page Path contains `/thank-you`
2. Re-assign these 7 tags to the new trigger: Meta Lead, DT Lead, GA4 generate_lead, Gads CT Submit Lead Form, and any other conversion tags currently on hubspot_form_submission
3. Create CJS variable {{CJS Lead Value}}: Parse URL or page for location tier; return 200 (low), 400 (standard), 600 (high), 800 (premium) per tier mapping
4. Change GA4 generate_lead value from 50 to {{CJS Lead Value}}
5. Change GA4 complete_registration value to {{CJS Lead Value}} or {{CJS Predicted LTV}} × 0.3
6. Change DT Lead and Meta Lead User Data: Replace orderData.customer.billing.* with form_data.* (or DLV form_data.*)
7. On /thank-you page: Add dataLayer.push({ event: 'lead_submitted', form_data: { email, phone, lead_value, location_tier }, lead_value, location_tier })

### Phase 3: Cloudflare Worker (Dev)
1. Create Worker at /webhook/purchase
2. Accept POST only; verify HubSpot webhook signature or shared secret
3. Parse JSON: deal amount, contact email, phone, deal_id, fbc, fbp (if available)
4. SHA256-hash email (lowercase, trimmed) and phone (E.164) for Meta CAPI user_data.em and user_data.ph
5. fbc, fbp: send plain (NOT hashed) per Meta docs
6. POST to https://sst.personaltrainersdubai.com/fb_capi with:
   - event_name: "Purchase"
   - event_time: Unix timestamp
   - event_id: "purchase_{deal_id}_{timestamp}"
   - action_source: "system_generated"
   - user_data: { em: [sha256_email], ph: [sha256_phone], fbc, fbp }
   - custom_data: { currency: "AED", value: deal.amount, content_name: "PT Package", content_ids: ["pt-package"], content_type: "product" }
7. HubSpot workflow: Deal closedwon → Send webhook to Worker URL with deal + contact data

### Phase 4: Website Leads → HubSpot
1. Typeform: Add HubSpot integration or webhook to create contact on submit
2. Calendly: Add HubSpot integration or webhook to create contact on booking
3. OR: Add HubSpot embed form on thank-you page

### Phase 5: Location Tier Workflow
1. Create workflow "Set Lead Value from Location"
2. Trigger: Contact created
3. Branches: city/ip_city contains "Palm Jumeirah"|"DIFC"|"Emirates Hills"|"JBR" → location_tier=premium, lead_value_aed=800, predicted_ltv_aed=12000
4. Branches: "Marina"|"JLT"|"Business Bay"|"Jumeirah"|"Dubai Hills" → high, 600, 8000
5. Branches: "Sports City"|"Motor City"|"Barsha"|"Greens"|"Views"|"Arabian Ranches"|"Mirdif" → standard, 400, 5000
6. Else → low, 200, 3000

### Phase 6: Validation
1. Audit: Why do some deals have 15 contacts? Fix to 1 primary contact per deal
2. Compare Meta Events Manager vs GA4 vs HubSpot event counts; log discrepancies
3. Test: Create test lead → move to Closed Won → verify Purchase in Meta Events Manager with value

## Value Mapping (Single Source of Truth)
- Lead: lead_value (200/400/600/800 by tier)
- SQL: lead_value × 2
- Opportunity: predicted_ltv × 0.3
- Purchase: deal.amount (actual)

## System IDs
- GTM Client: GTM-PH2SDZQK | GTM Server: GTM-WRWPQTKB
- Stape SST: sst.personaltrainersdubai.com
- Meta Pixel: 714927822471230 | Ad Account: act_349832333681399
- GA4: G-41VE6XV516 | HubSpot: 7973797

## Context7 / Docs to Check Before Implementing
- Meta CAPI: user_data.em, user_data.ph = SHA256; fbc, fbp = plain; action_source = system_generated
- GTM: dataLayer.push, Custom Event trigger, CJS variable
- HubSpot: objectRequestOptions.properties for Custom Code; lifecycle forward-only
- Cloudflare: Worker POST handler, webhook signature verification

## Exit Criteria
- [ ] Workflow 472915365 sets customer
- [ ] Workflow deal-default-122237508 sets opportunity
- [ ] Workflow 1 (extract attribution) permanent and running
- [ ] Workflow 4 (copy deal amount) created
- [ ] GTM thank-you trigger fires 7 conversion tags
- [ ] GA4 events have tier-based value
- [ ] CAPI user_data uses form_data
- [ ] Cloudflare Worker sends Purchase to Stape
- [ ] Typeform/Calendly create HubSpot contacts
- [ ] Location tier workflow populates lead_value_aed, predicted_ltv_aed
- [ ] Meta Events Manager shows Purchase with value
```

---

## Part 6: Related Docs

| Doc | Purpose |
|-----|---------|
| PTD-ULTIMATE-SOLUTION-PROMPT-2026-03-01.md | GTM, CAPI, value mapping |
| PTD-LEAD-TO-PROPERTIES-EVALUATION-2026-03-01.md | Lead → property trace |
| PTD-CONTEXT7-SOLUTIONS-ALL-2026-03-01.md | Context7 patterns |
| PTD-HUBSPOT-BEST-WAY-2026-03-01.md | Workflows, deal findings |
| BRAINSTORM-PERFECT-DATA-2026-03-01.md | Vital Suite evaluation |
| 10X-EVALUATION-REPORT-2026-03-01.md | 10x priorities |

---

*Brainstorm complete. Understanding lock confirmed. Design accepted. Ready for implementation handoff.*
