# Pixel Training & Attribution Masterplan — PTD Fitness

## EXACT CURRENT SETUP AUDIT

### What's installed on your site (index.html)
1. **GTM Web Container** `GTM-PH2SDZQK` ✅
2. **Meta Pixel** `714927822471230` — hardcoded in index.html ⚠️ (should be in GTM only)
3. **AnyTrack** — loaded via GTM (not visible in index.html directly)

### What's connected
- **AnyTrack → HubSpot**: Native integration, sends Lead/MQL/SQL/Purchase events ✅
- **AnyTrack → Events table**: 5,696 events captured ✅  
- **AnyTrack → Attribution events**: 1,980 events ✅
- **AnyTrack → Meta CAPI**: Should be relaying — VERIFY in AnyTrack dashboard
- **HubSpot → FB Ads**: Connected but lifecycle CAPI sync NOT confirmed
- **Stape sGTM**: Account exists, NOT configured yet
- **Calendly → HubSpot**: Connected (123 contacts with utm=leadformcalednly)

### Critical gaps found
| Gap | Impact | Fix |
|-----|--------|-----|
| `fbc` = 0/10,068 contacts | FB can't match events to ad clicks | Capture `_fbc` cookie, pass to HubSpot |
| `fbp` = 0/10,068 contacts | No browser ID matching | Same — cookie capture |
| Native lead form events have NULL user data | Can't attribute lead form leads back | Use email/phone hash matching instead |
| Meta Pixel in index.html AND GTM | Possible double-firing | Remove from index.html |
| Stape sGTM not set up | No server-side backup | Configure with custom domain |
| TypeForm hidden fields missing | UTMs lost on form submit | Add hidden fields |

## Lead Entry Points (ALL Must Track)
| Source | Type | fbclid/UTM Capture | CAPI Signal | Status |
|--------|------|-------------------|-------------|--------|
| **Facebook Lead Form** (native) | In-app FB form | FB owns the data — no fbclid needed, matches by internal ID | AnyTrack relays but with NULL user data! | ⚠️ Fix: use email/phone |
| **TypeForm** `GTp9Uet7` `rgPsDS7A` | iFrame embed | Hidden fields needed | Hard — iframe isolation | ❌ Broken |
| **Calendly** | iFrame embed | Supports Meta Pixel + UTM pass | Native pixel integration | ⚠️ Check |
| **Native website forms** | Direct | GTM captures fbclid | Full control | ✅ Best |
| **WhatsApp (Lisa AI)** | Chat | wa.me click = no fbclid | Manual match via phone | ⚠️ Partial |
| **Google Ads** | Search | gclid auto-captured | AnyTrack relays | ⚠️ Verify |
| **Organic/Direct** | No ad | No click ID | N/A | — |
| **Referral** | External | UTM if tagged | N/A | — |

### "Organic" Is Not Always Organic
Many contacts show as "organic" because:
- TypeForm strips UTM params (iframe isolation)
- Calendly booking doesn't pass fbclid back
- WhatsApp click-to-chat loses all URL params
- User clicks ad → browses → comes back later = "direct"
- Proper server-side tracking fixes most of these

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

## Facebook Native Lead Forms — Special Case
Native lead forms (user fills form inside Facebook/Instagram, never visits website):
- **No pixel fires** — user never touches your site
- **No cookies** — no fbc, fbp, nothing
- **No GTM** — completely bypasses your website
- **BUT Facebook already knows who they are** — they're logged in!

### How native leads flow today
```
FB Lead Form → Facebook stores lead internally
     ↓ (FB-HubSpot native sync OR AnyTrack relay)
HubSpot contact created
     ↓ properties: email, phone, name, ad_id (from HubSpot form association)
Our events table: 5 AdLeadInitialLead events — ALL with null email/phone ❌
```

### The fix for native lead forms
To send conversion events BACK for native leads, you DON'T need fbc/fbp.
Facebook matches by **hashed email + phone** — and they have both from the form.

**Setup:**
1. HubSpot workflow: When deal stage = closedwon
2. Check: does contact have `first_touch_source = PAID_SOCIAL`?
3. If yes → send CAPI Purchase event with:
   - `action_source: "system_generated"` (offline/CRM conversion)
   - `event_name: "Purchase"`
   - `value: deal_amount_aed` / `currency: "AED"`
   - `em: sha256(email)` — Facebook matches to their user
   - `ph: sha256(phone_e164)` — +971... format
   - `fn: sha256(firstname)`, `ln: sha256(lastname)`
   - `external_id: sha256(hubspot_contact_id)`
4. Facebook matches by email/phone → attributes to original ad → algorithm learns

### Why this works
- 2,688 PAID_SOCIAL contacts have ad_id + campaign_id ✅
- ALL native lead form users gave Facebook their email/phone (required by form)
- Facebook can match with just email hash — no cookie needed
- **This is actually MORE reliable than pixel matching** for offline conversions

### Three paths to send it
| Method | Tool | Effort | Reliability |
|--------|------|--------|-------------|
| **Stape HubSpot CRM App** | Stape | 10 min | ✅ Auto on lifecycle change |
| **HubSpot native CAPI** | HubSpot Ads | 5 min | ✅ Built-in, lifecycle based |
| **Webhook → sGTM** | Stape sGTM | 1 hr | ✅ Most flexible, has AED value |
| **Our edge function** | Supabase | Custom | ✅ Full control |

**Recommendation: Use ALL THREE stacked**
- Stape HubSpot App for lifecycle events (auto)
- HubSpot native CAPI for backup (auto)
- Webhook → sGTM for Purchase with exact AED amount (manual trigger)

## Stape Solutions Available (What to Use)
| Solution | Purpose | Priority |
|----------|---------|----------|
| **Stape HubSpot CRM App** | Auto-sends lead lifecycle changes to Meta CAPI. FREE. Direct HubSpot→Meta pipeline. No sGTM needed for this. | 🔴 HIGH |
| **Facebook CAPI Tag** | sGTM tag for sending any event to Meta CAPI | 🔴 HIGH |
| **Custom GTM/GA4 Loader** | Makes tracking ad-blocker resistant | 🟡 MEDIUM |
| **Cookie Keeper** | Extends first-party cookie life in Safari ITP | 🟡 MEDIUM |
| **Data Tag/Client** | Transfers data from web GTM → server GTM | 🔴 HIGH |
| **sGTM Preview Header** | Debug webhooks coming into sGTM | 🟢 Setup tool |
| **GEO Headers** | Adds location data to events (improves EMQ) | 🟡 MEDIUM |

### Stape HubSpot CRM App (Easiest Win)
Direct integration: HubSpot contact lifecycle changes → Meta CAPI
- Install from HubSpot marketplace
- Maps deal stages to Meta conversion events
- Sends email, phone, name (hashed) for matching
- Supports offline conversions with 28-day window
- **No server GTM container needed for this path**

## TypeForm CAPI Challenge (Hardest Problem)
TypeForm is iframe-based = isolated from parent page. Two approaches:

### Approach 1: Redirect to Thank You Page (Simpler)
- TypeForm submits → redirects to `/thank-you?email=X&phone=Y&fbclid=Z`
- GTM fires Lead event on thank you page with all params
- Stape sGTM sends CAPI event with user data
- **Downsides**: PII in URL, duplicate refreshes, no TypeForm submission ID

### Approach 2: JavaScript iFrame Listener (Better)
- Add listener script in GTM web container
- TypeForm sends postMessage on submit
- Capture form data + match with stored fbclid from cookie
- Fire GTM event → sGTM → CAPI
- **Needs**: Custom JavaScript tag in GTM

### Critical: TypeForm Hidden Fields for UTM
Both forms `GTp9Uet7` and `rgPsDS7A` need hidden fields:
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- `fbclid`, `gclid`, `click_id` (AnyTrack)
- Populated via URL params on embed page

## Calendly Integration
Calendly supports:
- **Meta Pixel** natively (Settings → Integrations → add Pixel ID)
- Fires: `invitee_page_view`, `invitee_calendar_view`, `invitee_booked`
- **UTM tracking**: Calendly preserves UTM params from URL
- **HubSpot integration**: Auto-creates/updates contacts on booking
- **Missing**: No native CAPI support → use Calendly webhook → Stape sGTM

## Google Ads Attribution
- AnyTrack captures gclid automatically
- Stape sGTM can send Google Ads conversion events
- Google Enhanced Conversions = similar to Meta CAPI (server-side)
- HubSpot also has native Google Ads lifecycle sync

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

## Event Match Quality (EMQ) — The Score That Matters
Meta rates each event 0-10 on how well it can match to a user profile.
- EMQ 6→7 = noticeable improvement
- EMQ 8→9 = 18% CPA drop, 22% ROAS improvement (real data from Reddit/case studies)
- EMQ 9+ = unfair competitive advantage

**For PTD Fitness we can hit 9+:**
- ✅ Email on 95% of contacts
- ✅ Phone on 90%+ (Dubai numbers, unique)
- ✅ First/last name
- ✅ City (Dubai or Abu Dhabi)
- ✅ Country (AE)
- ⚠️ fbclid — depends on TypeForm/Calendly fix
- ⚠️ fbp browser ID — need Cookie Keeper for Safari

## The "3 Weeks Later" Problem — SOLVED by Offline Conversions
PTD sales cycle:
1. Day 0: FB ad click → TypeForm/WhatsApp inquiry
2. Day 1-3: Setter calls → books assessment
3. Day 7-14: Assessment → proposal
4. Day 14-21: Close deal → payment

**Pixel attribution window = 7 days** → misses 60%+ of sales
**Offline conversion window = 28 days** → catches almost everything

This is why feeding closedwon deals back via CAPI/offline is critical.
Facebook literally cannot see your revenue right now.

## Quick Wins (Priority Order)
1. **Install Stape HubSpot CRM App** — FREE, 10 min, auto-sends lifecycle changes to Meta
2. **Check if HubSpot native CAPI sync is active** (Marketing → Ads → Events)
3. **Verify AnyTrack Lead events flowing** — check AnyTrack dashboard
4. **Remove duplicate pixel** (index.html manual pixel vs GTM — pick one)
5. **Add Purchase event** via HubSpot lifecycle → Customer with AED deal value
6. **Add Calendly Meta Pixel** in Calendly settings
7. **Fix TypeForm hidden fields** for UTM/fbclid capture on both forms
8. **Set up Stape sGTM container** with custom subdomain

## Reference Links
- [AnyTrack + Meta CAPI + HubSpot](https://anytrack.io/connect-metacapicrm-and-hubspot)
- [AnyTrack Docs](https://readme.anytrack.io/docs/what-is-anytrack)
- [Facebook CAPI via GTM Server-Side](https://developers.facebook.com/docs/marketing-api/conversions-api/guides/gtm-server-side/)
- [HubSpot CAPI Lifecycle Sync](https://knowledge.hubspot.com/ads/create-and-sync-ad-conversion-events-with-your-facebook-ads-account)
- [Stape Solutions](https://stape.io/solutions)
- [Stape HubSpot CRM App](https://stape.io/solutions/hubspot-meta-leads-api)
- [Stape FB Attribution Tips](https://stape.io/blog/actionable-tips-to-improve-facebook-conversion-attribution)
- [Stape Offline Conversions](https://stape.io/blog/facebook-offline-conversion-using-server-gtm)
- [Stape FB CAPI Setup Guide](https://stape.io/blog/how-to-set-up-facebook-conversion-api)
- [TypeForm CAPI Tracking (Hard)](https://conversiontracking.io/blog/typeform-facebook-meta-conversions-api-capi-conversion-tracking)
- [Calendly Meta Pixel](https://calendly.com/integration/facebook-pixel)
