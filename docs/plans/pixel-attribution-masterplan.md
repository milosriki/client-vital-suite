# Pixel Training & Attribution Masterplan — PTD Fitness

## Current State (What You Have)
| Tool | Status | What It Does |
|------|--------|-------------|
| **Meta Pixel** `714927822471230` | ✅ Installed in index.html | Browser-side tracking (blocked by iOS 30-70%) |
| **AnyTrack** `WUDv86JpJ4Ss` | ✅ Connected | Server-side conversion relay to Meta CAPI + Google |
| **HubSpot** | ✅ Connected to FB Ads | Can sync lifecycle stage changes → FB CAPI natively |
| **Stape** | ⚠️ Has account, needs setup | Server-side GTM container |
| **GTM** | ⚠️ Exists, needs better setup | Web container, should pair with Stape server container |
| **Our CAPI edge function** | ⚠️ Had silent failure (fixed) | Direct Meta CAPI calls from Supabase |

## The Problem
- Closedwon deals (AED 3M+/month) aren't feeding back to Facebook
- Pixel only sees website visits, not CRM conversions (offline sales happen via phone/WhatsApp)
- iOS users who opt out = invisible to pixel
- Multiple tools doing overlapping things with no clear data flow
- Facebook algorithm can't optimize for REAL buyers because it only sees form fills

## The Architecture (2026 Best Practice)

### 3 Layers of Conversion Signal — All Must Fire

```
Layer 1: BROWSER (Meta Pixel via GTM)
  → PageView, ViewContent, Lead (form fill)
  → Blocked by: iOS opt-out, ad blockers
  → Coverage: ~40-60% of traffic

Layer 2: SERVER (Stape sGTM → Meta CAPI)
  → Same events as browser + enhanced user data
  → Deduplicates with browser via event_id
  → Coverage: ~90% of web traffic (bypasses ad blockers)

Layer 3: OFFLINE/CRM (HubSpot or Direct CAPI)
  → Lifecycle changes: Lead → MQL → SQL → Customer
  → Deal closedwon with revenue value (AED)
  → Phone calls that convert (from CallGear)
  → Coverage: 100% of CRM conversions
  → 28-DAY attribution window (vs 7-day for pixel!)
```

### Data Flow Diagram
```
[Facebook Ad Click]
    ↓ fbclid captured
[Landing Page / TypeForm]
    ↓ AnyTrack captures fbclid + creates click_id
    ↓ GTM web fires PageView + Lead to Meta Pixel
    ↓ Stape sGTM fires same events to Meta CAPI (deduped)
[HubSpot Contact Created]
    ↓ AnyTrack relays "Lead" event to CAPI
[Setter Calls Lead]
    ↓ CallGear records call
[Deal Created in HubSpot]
    ↓ HubSpot syncs "MQL" lifecycle event to FB CAPI
[Deal Closedwon]
    ↓ THREE options (pick best):
    ↓ Option A: HubSpot native CAPI sync (lifecycle → Customer)
    ↓ Option B: Webhook → Stape sGTM → CAPI (with revenue value)
    ↓ Option C: Our edge function → direct CAPI (most control)
[Revenue Value Sent to Facebook]
    ↓ Facebook algorithm learns: "THIS is what a buyer looks like"
    ↓ Optimize for Purchase, not just Lead
```

## Implementation Plan

### Phase 1: Fix the Foundation (Day 1-2)
**Goal: Make sure basic events work end-to-end**

1. **Audit current AnyTrack setup**
   - Verify AnyTrack tracking tag on all pages
   - Check AnyTrack → Meta CAPI connection is active
   - Verify AnyTrack → HubSpot integration for conversion events
   - Check which events are flowing: PageView, Lead, CompleteRegistration

2. **Audit GTM web container**
   - List all current tags and triggers
   - Verify Meta Pixel fires through GTM (not double-firing with index.html)
   - Remove manual pixel from index.html if GTM handles it (avoid duplicates!)

3. **Fix TypeForm UTM passing**
   - Both forms `GTp9Uet7` and `rgPsDS7A`
   - fbclid, gclid, utm_source, utm_medium, utm_campaign must pass through
   - Hidden fields or URL parameter capture

### Phase 2: Server-Side Tracking via Stape (Day 3-5)
**Goal: 90%+ event coverage, bypass iOS/ad blockers**

1. **Set up Stape server GTM container**
   - Create container in Stape admin
   - Set up custom subdomain (e.g., `track.ptdfitness.com`)
   - Install GA4 web tag → sends to sGTM
   - Install Custom Loader power-up (prevents ad blocker interference)

2. **Configure FB CAPI tag in sGTM**
   - API Access Token from Meta Business Manager
   - Pixel ID: `714927822471230`
   - Event deduplication: same `event_id` for browser + server events
   - Enable Event Enhancement (gtmeec cookie) for user data enrichment

3. **Events to configure:**
   | Event | Trigger | Value |
   |-------|---------|-------|
   | PageView | All pages | — |
   | ViewContent | Service pages | — |
   | Lead | TypeForm submit / contact form | — |
   | CompleteRegistration | HubSpot lifecycle → Lead | — |
   | InitiateCheckout | Deal created | Deal value AED |
   | Purchase | Deal closedwon | Deal value AED |

### Phase 3: Offline Conversions — The Game Changer (Day 5-7)
**Goal: Feed REAL revenue back to Facebook with 28-day attribution**

This is where the money is. Facebook offline conversions get a **28-day attribution window** (vs 7-day for pixel). This means Facebook can connect a sale that happened 3 weeks after an ad click.

**Option A: HubSpot Native (Simplest)**
- In HubSpot → Marketing → Ads → Events tab
- Create lifecycle stage events:
  - `Lead` → fires when contact becomes Lead
  - `Customer` → fires when lifecycle = Customer
- Share: email, phone, click_id
- Share with: "All contacts that move to lifecycle stage"
- Requires: Marketing Hub Pro or Enterprise

**Option B: Webhook → Stape sGTM → CAPI (Most Flexible)**
- HubSpot workflow: When deal stage = closedwon
  - Send webhook to `https://track.ptdfitness.com/webhook`
  - Include: email, phone, deal value, deal name, fbclid (from contact)
- Stape Data Client catches webhook
- FB CAPI tag sends Purchase event with:
  - `action_source: "system_generated"`
  - `value: deal_amount_aed`
  - `currency: "AED"`
  - User data: email (hashed), phone (hashed)

**Option C: Direct CAPI from Supabase (Most Control)**
- Already have edge function infrastructure
- On deal closedwon → fire edge function
- Send to `graph.facebook.com/v21.0/{pixel_id}/events`
- Include all available user parameters for maximum Event Match Quality

**Recommendation: Use A + B together**
- HubSpot native for lifecycle events (simple, automatic)
- Stape webhook for Purchase with exact revenue (more data control)

### Phase 4: Optimize Event Match Quality (Ongoing)
**Goal: Get Event Match Quality score to 8+/10 in Meta Events Manager**

Facebook scores each event on how well it can match to a user. Higher score = better optimization.

**Parameters that improve match quality** (send as many as possible):
- `em` — email (hashed SHA256)
- `ph` — phone (hashed, E.164 format: +971...)
- `fn` — first name (hashed)
- `ln` — last name (hashed)
- `ct` — city (hashed)
- `st` — state (hashed)
- `zp` — zip code (hashed)
- `country` — country code (hashed)
- `fbp` — Facebook browser ID (from `_fbp` cookie)
- `fbc` — Facebook click ID (from `_fbc` cookie or fbclid)
- `client_ip_address`
- `client_user_agent`
- `external_id` — your internal contact ID (hashed)

**For PTD Fitness specifically:**
- We have email + phone on 95%+ of contacts ✅
- We have fbclid via AnyTrack/UTM capture ✅
- We have names, city (Dubai/Abu Dhabi) ✅
- Missing: zip codes (not standard in UAE — skip)

### Phase 5: Campaign Optimization Signals (Week 2+)
**Goal: Train Facebook to find buyers, not just leads**

1. **Create Custom Conversions in Meta Events Manager:**
   - "Qualified Lead" = lifecycle MQL (medium value)
   - "Sales Appointment" = deal created (higher value)  
   - "Closed Deal" = closedwon (highest value, with AED amount)

2. **Change campaign optimization target:**
   - Current: Optimizing for "Lead" (form fill) ← too broad
   - Better: Optimize for "Purchase" (closedwon with value)
   - Best: Value-based optimization → maximize total AED revenue

3. **Build Value-Based Lookalike Audiences:**
   - Upload customer list with lifetime value
   - Facebook finds people similar to your BEST customers, not just any lead

## Tools Consolidation

### Keep & Strengthen
- **AnyTrack** — great for automatic click_id relay + multi-platform
- **Stape sGTM** — server-side backbone, offline conversions, 28-day window
- **HubSpot CAPI** — native lifecycle sync (easy, reliable)

### Potentially Redundant
- **Manual Meta Pixel in index.html** — remove if GTM handles it
- **Our CAPI edge function** — keep as backup/custom events only
- **Direct FB API calls from frontend** — eliminate, all should go server-side

### Missing
- **CallGear → CAPI bridge** — when call converts, send to Facebook
- **Stripe → CAPI bridge** — when payment received, send Purchase with exact amount

## Key Metrics to Track
| Metric | Where | Target |
|--------|-------|--------|
| Event Match Quality | Meta Events Manager | 8+/10 |
| Conversion Attribution % | CVS Dashboard | 90%+ of closedwon attributed |
| ROAS | Meta Ads Manager | Track improvement after each phase |
| Cost Per Qualified Lead | Meta Ads Manager | Should decrease as pixel learns |
| 28-day attributed revenue | Meta Events Manager | Match CVS closedwon numbers |

## Quick Wins (Do First)
1. ✅ Check if HubSpot CAPI sync is already active (Marketing → Ads → Events)
2. ✅ Verify AnyTrack is sending Lead events to Meta
3. Remove duplicate pixel (index.html vs GTM)
4. Add `Purchase` event via HubSpot lifecycle → Customer
5. Pass deal value in AED with Purchase event
