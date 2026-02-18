# PTD FITNESS — MASTER BUILD PLAN
> 8 Research Agents Complete | 30+ Modules Designed | AED 1.3M+ Projected Annual Impact
> Generated: 2026-02-18

---

## 🔴 CRITICAL BLOCKER: AWS RDS IP Whitelist

**Problem:** AWS RDS (`ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com`) only accepts connections from your static IP. Supabase Edge Functions have NO static egress IP — they run on Deno Deploy's global edge network with random IPs.

**This blocks ALL session/package/coach data from flowing into the dashboard.**

### Solution Options (Pick ONE)

| Option | Cost | Setup Time | Reliability | Recommended |
|--------|------|-----------|-------------|-------------|
| **A. EC2 Proxy in me-central-1** | ~$5/mo (t3.micro) | 2 hours | ⭐⭐⭐⭐⭐ | ✅ **YES** |
| B. Cloudflare Worker + Tunnel | ~$5/mo | 3 hours | ⭐⭐⭐⭐ | Alternative |
| C. Open RDS to 0.0.0.0 (with SSL + password) | Free | 5 min | ⭐⭐ (security risk) | ❌ No |
| D. Cron job on YOUR machine pushes to Supabase | Free | 1 hour | ⭐⭐⭐ (depends on your machine uptime) | Backup plan |

### Option A: EC2 Proxy (RECOMMENDED)

Deploy a tiny EC2 instance in the SAME region as RDS (`me-central-1` = UAE/Bahrain). It has a static Elastic IP that you whitelist in the RDS security group. Edge Functions call the proxy, proxy connects to RDS.

```
Supabase Edge Function → EC2 Proxy (Elastic IP) → AWS RDS
                         (whitelisted IP)         (your data)
```

**Setup Steps:**
1. Launch `t3.micro` in `me-central-1` (free tier eligible)
2. Assign Elastic IP (free when attached to running instance)
3. Install Node.js + Express, expose a simple REST API:
   - `POST /query` — accepts SQL, returns JSON rows
   - Auth: Bearer token (shared secret between EC2 and Supabase)
4. Add Elastic IP to RDS security group inbound rules
5. Set `RDS_PROXY_URL` secret in Supabase Edge Functions
6. Update `rds-client.ts` to call proxy instead of direct connection

**Proxy Server Code (deploy on EC2):**
```javascript
// rds-proxy.js — runs on EC2 t3.micro
const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

const PROXY_SECRET = process.env.PROXY_SECRET; // shared with Supabase
const pool = new Pool({
  host: 'ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com',
  port: 5432,
  user: process.env.RDS_USER || 'ptd-milos',
  password: process.env.RDS_PASSWORD,
  database: 'ptd',
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

// Auth middleware
app.use((req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== PROXY_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

// Read-only query endpoint
app.post('/query', async (req, res) => {
  const { sql, params } = req.body;
  // Block write operations
  const normalized = sql.trim().toUpperCase();
  if (normalized.startsWith('INSERT') || normalized.startsWith('UPDATE') || 
      normalized.startsWith('DELETE') || normalized.startsWith('DROP') ||
      normalized.startsWith('ALTER') || normalized.startsWith('CREATE')) {
    return res.status(403).json({ error: 'Read-only proxy' });
  }
  try {
    const result = await pool.query(sql, params);
    res.json({ rows: result.rows, rowCount: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.listen(3100, () => console.log('RDS proxy listening on :3100'));
```

### Option D: Local Cron (BACKUP — no EC2 needed)

Run a script on YOUR machine (which already has the whitelisted IP) every 15 minutes that:
1. Queries RDS directly
2. Pushes results to Supabase via REST API (service role key)

```bash
# cron: */15 * * * * /path/to/sync-sessions.sh
```

**Advantage:** Zero cost, uses your existing whitelisted IP
**Disadvantage:** Depends on your machine being on. If laptop sleeps, data stops flowing.

---

## PHASE 0: DATA FOUNDATION (Day 1-2)

### 0.1 — Choose & Deploy RDS Proxy
- **If EC2:** Launch instance, deploy proxy, whitelist IP, test connection
- **If Local:** Create Node.js script, set up as launchd/cron, test

### 0.2 — Session Sync Pipeline
**Edge Function: `sync-sessions`** (already written, needs proxy URL)
- Queries `enhancesch.vw_schedulers` via proxy
- Upserts to `training_sessions` table in Supabase
- Runs every 15 minutes
- Returns: sessions today, coach breakdown, no-shows

### 0.3 — Package Sync Pipeline  
**Edge Function: `sync-packages`** (NEW)
- Queries `enhancesch.vw_client_packages` via proxy
- Upserts to `client_packages` table in Supabase
- Includes: remaining sessions, pack size, amount, consumption velocity
- Critical for: depletion alerts, renewal projections, package running low

### 0.4 — Process Stripe Events
- Parse 2,780 existing events in `stripe_events`
- Populate `stripe_transactions` (currently 0 rows)
- Set up Stripe webhook for real-time future events

### 0.5 — Data Freshness Monitor
- `<DataFreshness>` component on every dashboard page
- Shows: source, last sync, row count, freshness badge
- 🟢 <15min | 🟡 15-60min | 🔴 >1hr | ⚫ Never synced

---

## PHASE 1: MONEY PROTECTION (Day 2-4) — AED 1.35M/yr impact

### 1.1 — 3-Sessions-Left Alert System 🔴
**Route:** Tab in `/revenue/payments`
**Priority tiers:** CRITICAL (1 left) → HIGH (2-3) → MEDIUM (4-5)
**Actions:** Auto-WhatsApp to client + email coach + sales task
**Upsell logic:** If on 12-pack training 3x/week → recommend 36-pack
**Edge function:** `check-session-depletion` (every 2 hours)
**Projected impact:** +AED 480K/yr (reduced churn)

### 1.2 — Renewal Projection Engine 📊
**Route:** `/revenue/renewals`
**Algorithm:** 5-factor weighted scoring (velocity 20%, history 30%, recency 20%, coach 15%, progression 15%)
**Output:** Daily ranked list: probability × package value = expected revenue
**Downloadable:** CSV for morning sales huddle
**Edge function:** `generate-renewal-projections` (daily 5AM Dubai)
**Projected impact:** +AED 360K/yr

### 1.3 — Failed Payment Dunning 💰
**Route:** Tab in `/revenue/payments`
**7-step sequence:** Stripe retry (day 0) → WhatsApp (day 1) → SMS (day 3) → Coach call (day 5) → Manager (day 7) → Discount offer (day 10) → Suspension (day 14)
**UAE-specific:** 3DS auth failure handling (40% of failures)
**Edge function:** `dunning-processor` (hourly)
**Projected impact:** +AED 195K/yr (64% recovery rate)

### 1.4 — Revenue Leakage Detection
**Route:** Tab in existing `/revenue`
**3 engines:** Session-vs-payment reconciliation, package mismatch finder, over-training detection
**Projected impact:** 5-15% of revenue currently leaking undetected

---

## PHASE 2: DAILY OPS & ALERTS (Day 4-6)

### 2.1 — Daily Operations Board
**Route:** New tab in `/command-center`
**Data:** `training_sessions` (from sync pipeline)
**Features:**
- Live counters: Sessions Today | Completed | No-Shows | Remaining
- City split: Dubai ← → Abu Dhabi
- Coach cards: progress bar, next session countdown, no-show badge
- Color: 🟢 on track | 🟡 light day | 🔴 overloaded
- Auto-refresh: 60 seconds
- **Downloadable:** Today's schedule CSV, No-show report CSV

### 2.2 — Assessment Calendar (Today/Tomorrow/Day After)
**Route:** `/sales/assessments`
**Data:** `training_sessions` WHERE packet LIKE '%assessment%'
**Features:**
- Timeline view: hour blocks with client name, coach, setter, source
- Show probability badges: 🟢 >70% | 🟡 40-70% | 🔴 <40%
- Based on: setter historical show rate × source show rate × time-of-day rate
- Click → client profile with full lead history
- **Downloadable:** Print-friendly PDF for front desk

### 2.3 — Proactive Alert Engine (9 Alert Types)
**Route:** `/alerts` + 🔔 bell icon globally
**Edge function:** `proactive-alert-engine` (every 30 min)

| Alert | Trigger | Priority |
|-------|---------|----------|
| Ghost Client | Active package, 0 sessions 21+ days | 🔴 Critical |
| Client Inactive 14+ days | Active package, no recent sessions | 🔴 High |
| Package Running Low | ≤5 sessions AND depleting within 5 days | 🔴 High |
| Package Expiring ≤7 days | ≥3 unused sessions | 🔴 High |
| New Client at Risk | <2 sessions in first 14 days | 🔴 High |
| Frequency Declining ≥50% | vs 4-week prior average | 🟡 Medium |
| Coach Overloaded | >10 sessions/day | 🟡 Medium |
| Over-Trainer | Sessions used > purchased | 🟡 Medium |
| Assessment No-Show | Confirmed assessment marked no-show | 🟢 Info |

**Each alert:** [Take Action] dropdown → Call / WhatsApp / Reschedule / Snooze

---

## PHASE 3: SALES INTELLIGENCE (Day 6-10)

### 3.1 — Setter Command Center
**Route:** `/sales/setter`
**Sections:**
1. Personal stats: Calls today (progress bar → 50), connect rate, booking rate
2. Smart Lead Queue: Ranked by score (source 25 + area 25 + recency 15 + response time 20 + engagement 15)
3. Outcome logger: One-click buttons (No Answer, Voicemail, Booked, Not Interested, DNC)
4. Team leaderboard: Today's rankings with competitive gamification
5. **Speed-to-lead SLA:** New leads untouched >10min = 🔴 alert

### 3.2 — "Losing on Hello" Detection
**Route:** Tab in `/sales/setter`
**Metrics per setter:**
- <10 second hangup rate (opener problem)
- 10-30 second hangup rate (hook problem)
- 30s → 2min survival rate (pitch quality)
- 2min+ → booking rate (closing skill)
**Diagnosis engine:** Auto-labels each setter's weakness:
- "Opener problem" → needs script coaching
- "Pitch problem" → needs value proposition training
- "Qualification problem" → books low-quality leads
- "Handoff problem" → good calls but low show rate

### 3.3 — Call Pattern Recognition
**Route:** Tab in `/sales/setter`
**Heat maps:**
- Hour × day-of-week × connect rate
- Area-specific optimal call windows
- Optimal retry spacing per lead
- Best day-of-week for bookings

### 3.4 — Revenue per Dial
**Full chain:** Setter dial → connect → booking → show → close → AED
**Metrics:** Revenue per dial, revenue per connect, revenue per hour of calling
**By setter:** Who generates most AED per hour?
**Sankey funnel:** Visual flow from calls to revenue

### 3.5 — Sales Pipeline Velocity
**Route:** New tab in `/sales-pipeline`
**Features:**
- Stage-to-stage conversion rates with real HubSpot stage IDs
- Avg days in each stage
- Bottleneck detection (⚠️ on slow stages)
- Stuck deals >14 days: alert table with [Nudge] [Reassign]
- **Biggest current leak:** Booking → Confirmed = only 19% (80% drop-off!)

### 3.6 — Coach Close Rate Deep Dive
**Route:** `/sales/closer`
**Per coach:**
- Assessments done / closed / close rate / avg deal value / MTD revenue
- Close rate by lead SOURCE (Meta vs referral vs Google)
- Close rate by day-of-week and time-of-day
- 12-week trend (improving or declining?)
- **Combo analysis:** Which setter + coach combo produces most revenue?

### 3.7 — No-Show Prevention System
**Route:** Integrated in assessment calendar
**Prediction factors:** Source, days since booking, setter who booked, time of day
**Auto-sends:** -24h confirmation, -2h reminder, -30min "on your way?"
**If predicted no-show >60%:** Auto-create backup assessment slot

---

## PHASE 4: CLIENT INTELLIGENCE (Day 10-12)

### 4.1 — Client Activity Intelligence
**Route:** `/clients/activity`
**4 tabs:**
- **Utilization Heatmap:** Clients × weeks, color = % of purchased frequency used
- **Frequency Trends:** Increasing ↑ vs Decreasing ↓ vs Stable → (per client)
- **Ghost Clients:** Active package, 21+ days inactive, $ at risk
- **Over-Trainers:** Sessions used > purchased, billing flag

### 4.2 — Coach Performance Deep Dive
**Route:** Enhanced `/coaches`
**Add:** Session calendar heatmap, retention rate, re-purchase rate, revenue attribution per coach
**Leaderboard:** Top 5 🏆, bottom 5 ⚠️
**Downloadable:** PDF performance review for 1-on-1 meetings

### 4.3 — Coach Capacity Dashboard
**Features:**
- Average paid sessions/day per coach (last 30 days)
- Max sessions day, min sessions day
- Active training days
- Capacity utilization: actual / target slots
- Overloaded coaches flagged

---

## PHASE 5: 3-TIER KPI FRAMEWORK (Day 12-14)

### Tier 1: CEO Monthly (route: `/command-center` → CEO tab)
| KPI | Source | Calculation |
|-----|--------|-------------|
| Monthly Revenue | deals (closedwon) | SUM(amount) WHERE close date in month |
| ROAS | facebook_ads_insights + deals | Revenue from ad-sourced / ad spend |
| LTV:CAC | deals + ads | Lifetime value / acquisition cost, by cohort |
| Retention Rate | client_packages | Renewed / expired packages |
| Net Revenue Retention | deals | Revenue from existing clients / same clients last month |
| Revenue per Coach | deals + training_sessions | Revenue attributed per coach |
| Business Health Score | Composite 0-100 | 8 weighted factors |

### Tier 2: Manager Weekly (route: `/command-center` → Manager tab)
| KPI | Refresh |
|-----|---------|
| Assessment funnel: booked → confirmed → showed → closed | Weekly |
| Setter calls/day average (target: 50) | Weekly |
| Close rate by coach | Weekly |
| Average deal value trend ↑↓ | Weekly |
| Pipeline value by stage | Weekly |
| No-show rate | Weekly |
| Setter & coach leaderboards | Weekly |
| Week-over-week ▲▼ | Weekly |

### Tier 3: Team Daily (route: `/command-center` → Team tab, mobile-first)
| KPI | Refresh |
|-----|---------|
| Sessions today by coach | 5 min |
| Failed payments needing action | 30 min |
| Leads untouched >2 hours | 5 min |
| Assessments today + tomorrow | 15 min |
| Package running low alerts | 2 hr |
| Quick actions: Call / WhatsApp / Reschedule / Log | Real-time |

### Lead Funnel Visualization (across all tiers)
```
Lead Created → First Contact → Qualified → Assessment Booked → Confirmed → Showed → Done → Proposal → Closed Won
              SLA: <5min      19% conv     423 deals         80 confirmed   39% show                    123 won
```

---

## PHASE 6: MARKETING ATTRIBUTION (Day 14-17)

### 6.1 — True CPA Dashboard
**Route:** New tab in `/marketing`
**NOT CPL.** Full funnel cost:
- Cost per Lead (CPL)
- Cost per Assessment Booked
- **Cost per Assessment Confirmed** = AED 137K / 80 = **AED 1,714** 🔴
- Cost per Assessment Showed
- **True CPA** = AED 137K / 123 closedwon (from ads) = **AED 1,115**
**By:** Source, campaign, ad set, month
**Current ROAS estimate:** 6.4x (AED 824K revenue / AED 137K spend)

### 6.2 — Truth Triangle Attribution
**Route:** Enhanced `/attribution`
**Meta (Pipeboard) × AnyTrack × HubSpot**
- Confidence scoring: triple match = 1.0, double = 0.7, single = 0.3
- Ghost lead detection

### 6.3 — Creative DNA + Budget Optimizer
**Route:** `/marketing/creative`
- Creative performance matrix: format × hook × CTA
- Fatigue detection: CTR decay per creative
- Budget rules: KILL / SCALE / REFRESH / MAINTAIN
- [Apply] buttons calling Pipeboard tools

---

## SUMMARY: 30 MODULES ACROSS 6 PHASES

| Phase | Modules | Timeline | Impact |
|-------|---------|----------|--------|
| 0. Data Foundation | RDS Proxy + Session Sync + Stripe + Freshness | Day 1-2 | Unblocks everything |
| 1. Money Protection | Depletion Alerts + Renewal Engine + Dunning + Leakage | Day 2-4 | **AED 1.35M/yr** |
| 2. Daily Ops | Ops Board + Assessment Calendar + 9 Alert Types | Day 4-6 | Operational visibility |
| 3. Sales Intelligence | Setter Center + "Losing on Hello" + Patterns + Velocity + Coach Close Rate + No-Show Prevention | Day 6-10 | +AED 300K/yr |
| 4. Client Intelligence | Activity + Coach Performance + Capacity | Day 10-12 | Retention protection |
| 5. 3-Tier KPIs | CEO Monthly + Manager Weekly + Team Daily + Lead Funnel | Day 12-14 | Decision speed |
| 6. Marketing Attribution | True CPA + Truth Triangle + Creative DNA | Day 14-17 | Spend optimization |

## NEW TABLES: 8
`training_sessions`, `client_packages`, `session_depletion_alerts`, `renewal_projections`, `dunning_sequences`, `acquisition_funnel_metrics`, `deal_stage_history`, `creative_dna`

## NEW EDGE FUNCTIONS: 10
`sync-sessions`, `sync-packages`, `check-session-depletion`, `generate-renewal-projections`, `dunning-processor`, `proactive-alert-engine`, `lead-scoring-engine`, `calculate-true-cpa`, `creative-analyzer`, `stripe-process-events`

## NEW PAGES: 8
`PaymentRecovery`, `SetterCommandCenter`, `CloserSalesBoard`, `AssessmentPipeline`, `ClientActivity`, `AlertCenter`, `RenewalProjections`, `CreativeDNA`

## ENHANCED PAGES: 6
`CommandCenter` (3-tier KPIs + Daily Ops), `SalesPipeline` (velocity tab), `RevenueIntelligence` (leakage tab), `Coaches` (deep dive), `MarketingIntelligence` (True CPA tab), `Attribution` (Truth Triangle)

---

## START HERE

**Step 1:** Choose RDS proxy solution (EC2 recommended — $5/mo, 2 hours setup)
**Step 2:** Deploy proxy, test connection, whitelist IP
**Step 3:** I build sync-sessions + sync-packages → data starts flowing
**Step 4:** Phase 1 modules start saving money immediately
