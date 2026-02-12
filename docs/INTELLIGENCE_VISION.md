# PTD Vital Suite — Intelligence Vision & Architecture

## The Question Everything Answers
**"Which Facebook ad is making me money, and which setter/coach is converting those leads?"**

---

## Two AI Systems (Strictly Separated)

### 1. Lisa (Big Sister) — Customer-Facing Booking Agent
- WhatsApp AI with natural pro sales skills
- Books appointments like a real appointment setter
- Updates HubSpot (create contacts, update lifecycle, book meetings)
- NO access to business analytics, dashboards, or internal metrics
- Uses: conversation_intelligence table, whatsapp_interactions, HubSpot API

### 2. Atlas (CEO Brain) — Internal Super Intelligence
- Dashboard chat that can analyze ALL data across all pages
- Cross-references: FB Ads + Calls + HubSpot + AWS + Stripe
- Provides AI recommendations: "Kill this ad", "This setter ghosts 40%", "Coach X closes 3x better"
- Uses: ALL tables, ALL edge functions, Pipeboard MCP, every data source

---

## Complete Data Flow

```
Facebook Ads (Pipeboard MCP)
    ↓ fetch-facebook-insights → facebook_ads_insights (35+ columns)
    ↓
Lead Created (HubSpot webhook / AnyTrack)
    ↓ hubspot-webhook → contacts table
    ↓ anytrack-webhook → attribution_events (fb_ad_id links back to ad)
    ↓
Setter Calls Lead (CallGear)
    ↓ callgear-live-monitor → call_records (contact_id, owner)
    ↓
Assessment Booked (HubSpot deal stage 122237508)
    ↓ hubspot-webhook → deals table (hubspot_owner_id = setter)
    ↓
Assessment Held (AWS truth)
    ↓ aws-truth-alignment → aws_truth_cache (sessions, attendance)
    ↓
Coach Works Client (AWS sessions)
    ↓ health-calculator → client_health_scores (health zone, session data)
    ↓
Payment (Stripe)
    ↓ stripe-webhook → stripe_transactions
    ↓ stripe-dashboard-data → live revenue
    ↓
Closed Won (HubSpot deal stage closedwon)
    ↓ hubspot-webhook → deals.stage = 'closedwon'
```

---

## Dashboard Pages — Every Formula

### Page 1: Executive Dashboard (`/dashboard`, `/`)
| Metric | Formula | Source |
|--------|---------|--------|
| Net Revenue | `stripeData.netRevenue / 100` | stripe-dashboard-data EF |
| Active Members | `stripeData.activeSubscriptions` | stripe-dashboard-data EF |
| New Leads | `COUNT contacts WHERE lifecycle_stage='lead' AND created_at >= range` | contacts table |
| Health Score | `(clients with sessions > 0) / total * 100` | aws_truth_cache |
| Lifetime Revenue | `SUM(lifetime_revenue)` | aws_truth_cache |
| All deltas | `((current - prior) / prior) * 100` | usePeriodComparison hook |

### Page 2: Marketing Intelligence (`/marketing-intelligence`)
| Metric | Formula | Source |
|--------|---------|--------|
| True ROAS | `cash_collected / ad_spend` | business-intelligence-dashboard EF |
| CPL | `ad_spend / new_leads` | EF computed |
| Integrity Score | `verified_revenue / claimed_revenue` | EF cross-check |
| Funnel | Impressions → Clicks → Leads → Appointments → Sales | EF from Meta + HubSpot |
| VisualDNA ROAS | `ad.roas` (direct from Meta) | facebook_ads_insights |

### Page 3: Deep Intelligence (`/deep-intel`)
| Metric | Formula | Source |
|--------|---------|--------|
| 90d ROAS | `historical_baselines.avg_roas WHERE period_days=90` | historical_baselines |
| 90d CPL | `historical_baselines.avg_cpl` | historical_baselines |
| Ghost Rate | `1 - (held / booked)` | funnel_metrics |
| Close Rate | `closed_won / total_deals` | funnel_metrics |
| 12-Stage Funnel | Each stage from funnel_metrics | funnel-stage-tracker EF |
| Health by Owner | marketing/sales/coach/ops verdicts | funnel_metrics |
| Loss Reasons | Primary/secondary with confidence | loss_analysis table |
| Source Truth | FB vs AnyTrack vs DB comparison | source_discrepancy_matrix VIEW |
| Assessment Truth | HubSpot vs AWS cross-check | assessment_truth_matrix VIEW |

### Page 4: Campaign Money Map (`/money-map`)
| Metric | Formula | Source |
|--------|---------|--------|
| CPL | `spend / leads` per campaign | get_campaign_money_map RPC |
| CPO | `spend / deals` per campaign | get_campaign_money_map RPC |
| ROAS | `revenue / spend` per campaign | RPC |
| Status | `ROAS > 2 ? "Scale" : "Kill"` | Client-side threshold |

### Page 5: Sales Pipeline (`/sales-pipeline`)
| Metric | Formula | Source |
|--------|---------|--------|
| Funnel stages | lead → mql → opportunity → closed_won | dynamic_funnel_view |
| Answer Rate | `answered / total * 100` | call_records |
| Conversion Rate | `closedCount / total * 100` | deals table |
| Cash Collected | `SUM(cash_collected) WHERE status='closed'` | deals table |
| Collection Rate | `collected / value * 100` | deals table |

### Page 6: Setter Activity (`/setter-activity-today`)
**STATUS: BROKEN — needs rewrite to use real call_records by hubspot_owner_id**

### Page 7: Sales Coach Tracker (`/sales-coach-tracker`)
**STATUS: BROKEN — monthly sales only sums TOP 3 records (LIMIT 3), not real total**

### Page 8: Meta Dashboard (`/meta-dashboard`)
| Metric | Formula | Source |
|--------|---------|--------|
| All metrics | Direct from columns | facebook_ads_insights table |
| Sync | fetch-facebook-insights → Pipeboard MCP → Meta API | Live sync |

### Page 9: Attribution War Room (`/attribution`)
| Metric | Formula | Source |
|--------|---------|--------|
| True ROAS | `validated revenue / ad_spend` | data-reconciler EF |
| Truth Triangle | HubSpot vs Stripe vs PostHog | **BROKEN — all show same value** |

### Page 10: Overview (`/overview`)
| Metric | Formula | Source |
|--------|---------|--------|
| All health data | From daily_summary + coach_performance | Supabase tables |

### Page 11: Stripe Intelligence (`/stripe`)
| Metric | Formula | Source |
|--------|---------|--------|
| All payment data | Direct from Stripe API | stripe-dashboard-data EF |

---

## Funnel Structure (The Business Core)

### By Stage (HubSpot Deal Stages)
```
1. Lead Created              → contacts table
2. Assessment Booked (122237508) → deals.stage
3. Assessment Held (122237276)   → deals.stage + aws_truth_cache confirmation
4. Deal Created / Qualified      → deals.stage
5. Package Selected              → deals.stage = qualifiedtobuy
6. Payment Pending               → deals.stage = 2900542
7. Closed Won                    → deals.stage = closedwon
```

### By Owner (The Key Breakdown)
```
MARKETING owns:  Lead → Booked     (threshold: ≥40% healthy, ≥25% warning)
SETTER owns:     Booked → Held     (threshold: ≥65% healthy, ≥50% warning)
COACH owns:      Held → Deal       (threshold: ≥25% healthy, ≥15% warning)
OPS owns:        Deal → Payment    (threshold: ≥70% healthy, ≥50% warning)
```

### Setter Funnel (NEW — setter_funnel_matrix VIEW)
```sql
-- Groups by hubspot_owner_id to show:
-- total_leads, booked, held, closed_won, closed_lost
-- lead_to_deal_pct, book_to_held_pct, held_to_close_pct, ghost_rate_pct
```

---

## Cross-Check Pipeline

### The 4-Source Verification
```
Source 1: Facebook Ads (Pipeboard)  → facebook_ads_insights (spend, leads, ROAS)
Source 2: AnyTrack                  → attribution_events (conversion verification + fb_ad_id)
Source 3: HubSpot                   → contacts + deals (CRM truth, stages, owner)
Source 4: Stripe                    → stripe_transactions (actual money collected)
```

### Key Joins for Agent Intelligence
```sql
-- Ad → Lead: attribution_events.fb_ad_id = facebook_ads_insights.ad_id
-- Lead → Deal: deals.hubspot_contact_id = contacts.hubspot_contact_id
-- Lead → Call: call_records.contact_id = contacts.id
-- Deal → Payment: (MISSING FK — stripe_transactions has NO contact_id)
-- Client → Sessions: aws_truth_cache.email = contacts.email
-- Client → Health: client_health_scores.email = contacts.email
```

### Missing Links (Critical Gaps)
1. **stripe_transactions → contacts**: No FK. Cannot trace "this payment came from this lead from this ad"
2. **call_records.contact_id**: Can be NULL (sync lag). Some calls can't be attributed
3. **Truth Triangle**: Not yet wired — shows same value for all 3 sources

---

## Agent Intelligence Requirements

### What Agents Need to Answer
1. "Which ad brings the best QUALITY leads?" → Cross FB metrics + lead_score + deal outcome
2. "Which setter converts best?" → setter_funnel_matrix by owner
3. "Why did we lose this deal?" → loss_analysis with evidence
4. "Is this coach performing?" → aws_truth_cache sessions + client_health_scores
5. "Are we leaking money?" → source_discrepancy_matrix trust verdicts
6. "Should I increase budget on campaign X?" → ROAS trend + CPL trend + lead quality
7. "Who trained but didn't pay?" → JOIN aws_truth_cache (sessions > 0) with stripe failed/missing

### Agent Tools Available (meta-executor.ts)
- `meta_ads_analytics` — Live Pipeboard query (ALL fields)
- `meta_ads_db_query` — Query persisted facebook_ads_insights (no tokens needed)
- `meta_creative_analysis` — Creative quality signals + rankings
- `meta_ads_manager` — List/audit campaigns and ads

### Industry Benchmarks (Hardcoded Thresholds)
| Metric | Target | Source |
|--------|--------|--------|
| ROAS | 3.0x | MarketingDeepIntelligence |
| CPL | AED 30 | MarketingDeepIntelligence |
| Ghost Rate | ≤25% | MarketingDeepIntelligence |
| Close Rate | ≥25% | MarketingDeepIntelligence |
| ROAS Profitable | >2x | CampaignMoneyMap |

---

## What Needs Building Next

### Priority 1: Fix Broken Dashboards
- [ ] Wire CPL/CPO into Dashboard KPIGrid (from funnel_metrics or facebook_ads_insights)
- [ ] Fix SetterActivityToday to use real call_records grouped by hubspot_owner_id
- [ ] Fix SalesCoachTracker monthly total (remove LIMIT 3)
- [ ] Wire Truth Triangle with actual Stripe + PostHog data

### Priority 2: Missing Cross-References
- [ ] Add contact_id FK to stripe_transactions (or create a linking view)
- [ ] Create "trained but unpaid" view (aws sessions > 0 AND no matching stripe payment)
- [ ] Create call review UI (call_records with quality/outcome scoring)

### Priority 3: Super Intelligence Chat
- [ ] Atlas agent should query ALL tables, not just Meta
- [ ] Add executor tools for: HubSpot queries, Stripe queries, AWS queries, call_records
- [ ] Enable "which ad makes money end-to-end" query across all 4 sources
- [ ] Add AI recommendations engine based on cross-referenced data
