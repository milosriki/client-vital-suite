# Creative DNA + Marketing Attribution Intelligence — Build Result

**Date:** 2026-02-24  
**Build:** ✅ `npx tsc --noEmit` CLEAN | `npm run build` ✓ 3.20s  
**Commit:** `d3444d3` — feat: creative DNA + attribution intelligence complete

---

## What Was Built

### P0 — Critical Deliverables

#### 1. `ad-creative-analyst` — Complete Rewrite ✅

**Before:** Called `data-reconciler` → AI prompt analysis. Did NOT query per-creative metrics.  
**After:** Full Creative DNA pipeline:

- **Queries `facebook_ads_insights` directly** — aggregates spend, leads, clicks, impressions, conversions, frequency, video metrics per `ad_id` (last 30 days)
- **Calculates per creative:**
  - `cpa_aed` = spend ÷ leads (cost per lead)
  - `ctr_pct` = clicks ÷ impressions × 100
  - `conversion_rate_pct` = conversions ÷ clicks × 100
  - `frequency` = weighted average across days
  - `video_completion_rate_pct` = p100 ÷ p25 × 100
  - `quality_ranking` / `engagement_rate_ranking` / `conversion_rate_ranking` from Meta
- **Creative Fatigue Detection:**
  - `frequency ≥ 3.5` → `WARNING` — rotate within 72h
  - `frequency ≥ 5.0` → `CRITICAL` — immediate kill
  - `quality_ranking BELOW_AVERAGE` → escalates fatigue status
- **Action Classification:**
  - `KILL` — CRITICAL fatigue OR zombie ads (spend > AED 500, 0 leads)
  - `SCALE` — hidden gems (low spend, CTR > 2%, leads > 0) OR strong performers
  - `WATCH` — high spend, weak CTR, few leads
  - `REFRESH` — WARNING fatigue with existing leads
- **Writes upsert** → `marketing_recommendations` with `(ad_id, action)` conflict key, confidence scores (95/75/60), full metrics in JSONB

#### 2. `true-roas-calculator` — New Function ✅

New Supabase Edge Function that calculates **TRUE ROAS** (not Meta-reported):

**Join chain:** `facebook_ads_insights` (spend) → `contacts` (campaign_id / fb_ad_id) → `deals` (stage=closedwon, deal_value)

**Output per level:**
- **Campaign:** `"Campaign X: Spent AED 5,000 → Generated AED 42,000 = 8.4x ROAS"`
- **Ad Set:** ROAS + frequency + CPL per adset
- **Creative:** ROAS + CTR + fatigue_status per ad

**CPL/CPO per campaign:**
- `cpl_aed` = spend ÷ leads (from facebook_ads_insights.leads)
- `cpo_aed` = spend ÷ deals closed-won

**Budget Rules Applied:**
- `KILL`: ROAS < 1.5x AND frequency > 4.0 — wasting money with burned audience
- `SCALE`: ROAS > 3.0x AND frequency < 3.0 — profitable with room to grow
- `MAINTAIN`: everything else

---

### P1 — High-Priority Deliverables

#### 3. CreativeGallery Wired to Marketing Page ✅

**Before:** `CreativeGallery.tsx` existed but was orphaned — not imported anywhere.  
**After:**
- New **"Creative DNA"** tab added to `MarketingIntelligence.tsx` (6th tab)
- `CreativeGallery` is now imported and rendered in this tab
- Data pulled from `ad_creative_funnel` view + `marketing_recommendations` table
- Shows: creative name, ROAS badge (color-coded), spend, revenue, CPA, CTR, frequency, fatigue badge, action badge

**CreativeGallery.tsx enhanced with:**
- `FatigueBadge` — animated BURNOUT badge for CRITICAL, yellow FATIGUE for WARNING
- `ActionBadge` — red KILL, green SCALE, amber WATCH, blue REFRESH
- Extended `Creative` interface: `cpa_aed`, `ctr_pct`, `frequency`, `fatigue_status`, `action`, `action_reason`, `quality_ranking`
- Graceful missing thumbnail handling (placeholder icon)
- Action recommendation card (replaces old optimization block)

**Creative DNA Tab also shows:**
- Summary KPIs: total creatives, KILL/SCALE counts, critical/warning fatigue counts
- Alert banner when critical fatigue detected (with AED spend at risk)
- Action table: KILL/SCALE creatives with spend, CPA, frequency, reason

#### 4. marketing-allocator Enhanced ✅

ROAS + frequency hard-rule analysis injected **before** processing queued recommendations:

- Reads `facebook_ads_insights` (30 days) → aggregates per `ad_id`
- Applies rules:
  - `KILL signal`: frequency > 4.0 AND 0 leads, OR frequency > 4.0 AND CPL > AED 200
  - `SCALE signal`: frequency < 3.0 AND leads > 5 AND CPL < AED 50
- Returns `hard_rule_analysis` in response even when no queued recommendations exist
- Existing budget proposal logic unchanged (still requires CEO approval)

#### 5. CPL/CPO Per Campaign ✅

Delivered via `true-roas-calculator`:
- `cpl_aed` per campaign = spend ÷ facebook_ads_insights.leads
- `cpo_aed` per campaign = spend ÷ closed-won deals count
- `global_cpl_aed` and `global_cpo_aed` in summary

---

## Attribution Source Verification

| Source | Status | Notes |
|--------|--------|-------|
| Meta Ads API → facebook_ads_insights | ✅ 1,663 rows | Via fetch-facebook-insights (Pipeboard MCP) |
| AnyTrack webhooks → attribution_events | ✅ 2,313 rows | anytrack-webhook function |
| Meta CAPI → stape | ✅ Outbound only | Used for server-side conversion signals |
| HubSpot CRM → contacts | ✅ 114K contacts | sync-hubspot-to-supabase |
| HubSpot Lead Forms → contacts | ✅ Via campaign_id | fetch-facebook-leads |

All 5 attribution sources are flowing. The view `view_full_attribution` and `view_truth_triangle` connect the dots.

---

## Creative Fatigue Alert (Current State)

Based on verified data:
- **Current frequency: 5.32** = CRITICAL burnout threshold exceeded
- **ROAS: 0.99x** = barely breaking even
- **Action required:** Kill or rotate all creatives above frequency 5.0
- The `ad-creative-analyst` will automatically flag these and write KILL recommendations

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/ad-creative-analyst/index.ts` | Full rewrite — Creative DNA pipeline |
| `supabase/functions/true-roas-calculator/index.ts` | **NEW** — TRUE ROAS per campaign/adset/creative |
| `supabase/functions/marketing-allocator/index.ts` | Enhanced with ROAS+frequency hard rules |
| `src/components/analytics/CreativeGallery.tsx` | Enhanced with fatigue badges, action badges, extended interface |
| `src/pages/MarketingIntelligence.tsx` | Added Creative DNA tab, CreativeGallery import, CreativeDNATab component |

---

## Deployment

To deploy the edge functions:
```bash
supabase functions deploy ad-creative-analyst --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy true-roas-calculator --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy marketing-allocator --project-ref ztjndilxurtsfqdsvfds
```

---

## Next Recommended Actions

1. **Run `ad-creative-analyst` now** → will populate `marketing_recommendations` with KILL/SCALE for current creatives
2. **Run `true-roas-calculator`** → will show true campaign ROAS after deal join
3. **Creative refresh:** Frequency 5.32 means immediate creative rotation needed — new copy, new hooks
4. **Budget reallocation:** Kill campaigns with ROAS < 1.5x + frequency > 4 first
5. Consider storing historical frequency snapshots to track before/after creative change impact

---

*Built by CRAW — verified: `npx tsc --noEmit` CLEAN, `npm run build` ✓ in 3.20s*
