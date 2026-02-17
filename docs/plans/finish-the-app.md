# Finish The App — Batch Execution Plan

## What's Done ✅
- [x] Data quality: 98% closedwon→contact, 95% channel attribution, AED 9.5M attributed
- [x] 50+ pages wired to real Supabase data
- [x] Setter Command Center, Lead Follow-Up, Executive Overview enhanced
- [x] Delegation tracking (4,354 records, analytics views)
- [x] Call owner attribution (85%), call duration bug fixed
- [x] Bundle surgery (-77%), contrast fixes, chart colors standardized
- [x] Stripe integration (134 txns, 1,241 subs, new/renewal tagging)
- [x] Nav reorganized for sales manager workflow
- [x] CallGear integration plan documented
- [x] Pixel/attribution masterplan documented (all sources mapped)

## What's Left — 4 Batches

### BATCH 1: Data Completeness (Day 1)
**Goal: Close remaining data gaps**

1. **Pipeline stage labels** — map numeric IDs to names
   - `1064059183`, `122178070`, `966318643`, etc. → real stage names from HubSpot
   - One API call to get pipeline stages, then bulk UPDATE

2. **991 closedwon deals missing AED value** — backfill from HubSpot `amount` property
   - Batch read 991 deals, update amount

3. **Deal→contact for open pipeline** — 11,005 open deals, link the important ones
   - Focus: deals in `qualifiedtobuy` (5,114) and `decisionmakerboughtin` (455)
   - Same approach: batch associations → sync missing contacts → link

4. **Attribution for remaining 39% closedwon** — 1,087 deals have value but no channel
   - Try: URL extraction from contact's raw_properties
   - Try: Match via AnyTrack events (email join)

### BATCH 2: Page Polish & Missing UI (Day 2-3)
**Goal: Every page enterprise-grade, no dead ends**

1. **Delegation tracking page** — wire `view_delegation_analytics` + `view_hot_potato_leads` into Setter Command Center tab or standalone page. Show:
   - Setter flow: who gets leads, who loses them, net
   - Hot potato leads (3+ delegations) with conversion outcomes
   - Delegation source breakdown (auto vs manual vs bulk)

2. **Revenue by Channel dashboard** — NEW page or tab showing:
   - AED 5.77M Facebook | AED 1.17M Google | AED 1.97M Offline breakdown
   - Ad spend (AED 384K) vs revenue = ROAS per channel
   - Monthly trend: spend vs closedwon revenue

3. **Pipeline stages display fix** — show real names not IDs on SalesPipeline page

4. **Page-by-page polish pass** — 30 pages:
   - Check: loading states, error states, empty states
   - Check: all numbers use Number() (no string concatenation)
   - Check: AED currency display consistent
   - Check: no console.log in production
   - Check: skeleton loaders on heavy queries

### BATCH 3: Intelligence Upgrade (Day 4-5)
**Goal: Atlas score 46.7 → 80+**

Per `docs/plans/2026-02-12-intelligence-upgrade-corrected.md`:

1. **Action system** — Atlas generates specific, actionable recommendations:
   - "Call lead X — showed buying signal 3 days ago, no follow-up"
   - "Move deal Y to closedlost — no activity in 45 days"
   - "Setter Z conversion dropped 30% — review call recordings"

2. **Data freshness alerts** — surface stale sync, missing data, pipeline stuck

3. **Morning brief edge function** — daily summary at 6am Dubai time:
   - Yesterday: X leads, Y calls, Z deals moved, AED W revenue
   - Attention needed: stale leads, missed callbacks, stuck deals
   - Team performance: setter rankings for the day

4. **Proactive intelligence on Executive Overview** — expand the alerts section:
   - Link to specific contacts/deals that need action
   - Priority scoring (high/medium/low)
   - One-click actions (call now, send email, escalate)

### BATCH 4: Integrations & Pixel Training (Day 6-7)
**Goal: Close the attribution loop, data flows everywhere**

1. **Stape HubSpot CRM App** — install from HubSpot marketplace (10 min)
   - Auto-sends lifecycle changes to Meta CAPI
   - No coding needed

2. **HubSpot native CAPI sync** — enable in Marketing → Ads → Events
   - Create lifecycle event for "Customer" stage
   - Share email + phone + click_id
   - Include deal value in AED

3. **GTM cleanup** — remove duplicate pixel from index.html
   - Fire Meta Pixel from GTM only (deduplicated)
   - Add AnyTrack tag in GTM if not already there

4. **TypeForm hidden fields** — both forms `GTp9Uet7` and `rgPsDS7A`
   - Add: utm_source, utm_medium, utm_campaign, fbclid, gclid, click_id
   - Pass via URL params on embed page

5. **Calendly Meta Pixel** — add pixel ID in Calendly settings

6. **CallGear API key** — get from Milos, set in Supabase secrets, test sync

## Priority Order (if time is limited)
1. Batch 1 items 1-2 (pipeline labels + deal values) — 1 hour
2. Batch 2 item 2 (Revenue by Channel) — high CEO value — 2 hours
3. Batch 2 item 3 (pipeline stage fix) — 30 min
4. Batch 4 items 1-2 (Stape + HubSpot CAPI) — needs Milos action — 30 min
5. Batch 3 item 3 (morning brief) — 2 hours
6. Everything else

## Definition of Done
- [ ] Every closedwon deal linked to a contact
- [ ] Every page shows real data, no mocks, no console.log
- [ ] Revenue attributable to ad channel for 80%+ of closedwon
- [ ] Pipeline stages show real names
- [ ] CAPI sending Purchase events back to Facebook
- [ ] Atlas intelligence score > 80
- [ ] Morning brief running daily at 6am Dubai
- [ ] CallGear syncing (needs API key)
- [ ] All deployed to Vercel production
