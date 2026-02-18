# PTD Fitness — BI Dashboard Master Build Plan
> Generated: 2026-02-18 | Based on 4 research agent specs + full codebase audit

## Architecture Decision: Where Everything Fits

### Current Navigation (18 items) → New Structure (6 zones, 22 items)

The existing sidebar has too many flat items. We restructure into **6 zones** with grouped sub-navigation:

```
SIDEBAR (collapsed = icons only, expanded = grouped)
─────────────────────────────────
🏠 COMMAND CENTER (existing /command-center) — the morning dashboard
   └─ Now includes: Daily Ops Board as a tab

📊 REVENUE & PAYMENTS (new zone)
   ├─ /revenue           (existing — enhanced)
   ├─ /revenue/payments   (NEW — Failed Payment Recovery + Cash Collection)
   └─ /revenue/forecasting (NEW — LTV/CAC + Cohort Analysis)

🎯 SALES OPERATIONS (new zone)
   ├─ /sales-pipeline     (existing — enhanced with velocity)
   ├─ /sales/setter       (NEW — Setter Command Center)
   ├─ /sales/closer       (NEW — Closer/Coach Sales Board)
   └─ /sales/assessments  (NEW — Assessment Pipeline)

👥 CLIENT OPERATIONS (new zone)
   ├─ /clients            (existing)
   ├─ /clients/activity   (NEW — Ghost/Declining/Over-Trainers)
   ├─ /coaches            (existing — enhanced with deep dive)
   └─ /interventions      (existing — now fed by proactive alerts)

📣 MARKETING INTELLIGENCE (existing zone — enhanced)
   ├─ /marketing          (existing — enhanced)
   ├─ /attribution        (existing — becomes True Attribution Engine)
   └─ /marketing/creative (NEW — Creative DNA + Budget Optimizer)

🧠 AI & SYSTEM (existing zone)
   ├─ /intelligence       (existing)
   ├─ /global-brain       (existing)
   └─ /alerts             (NEW — Proactive Alert Center)
```

### UX Design Principles
1. **Every page = 1 decision per 3 seconds.** No decorative charts. Every visual answers a question.
2. **Traffic light system everywhere:** 🟢 Good / 🟡 Watch / 🔴 Act Now
3. **Every row is clickable → drill-down.** Never dead-end data.
4. **Every table = downloadable CSV.** One-click export button on every data view.
5. **Real-time where it matters:** Daily Ops Board (60s poll), Setter Command Center (30s), Alerts (push via Supabase Realtime)
6. **100% data accuracy protocol:** Every number shows its source + last-synced timestamp. Stale data (>1hr) gets ⚠️ badge.

---

## Phase 0: DATA FOUNDATION (Day 1-2)
> Without this, nothing else works. This is the #1 blocker.

### 0.1 — Session Sync Pipeline (AWS RDS → Supabase)
**Why first:** Health scores are 99.7% RED because session data isn't in Supabase. 12 of 20 modules need session data.

```
Edge Function: sync-sessions (NEW)
├─ Connects to RDS via existing rds-client.ts
├─ Queries: enhancesch.vw_schedulers (last 90 days)
├─ Upserts to: training_sessions (NEW table)
├─ Runs: every 15 minutes via cron
├─ Logs: sync_status table (row count, latency, errors)
└─ Time estimate: 3 hours
```

**New table: `training_sessions`**
```sql
CREATE TABLE training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rds_id bigint UNIQUE,              -- id from vw_schedulers
  client_id text,                     -- id_client
  client_name text,
  coach_id text,                      -- id_coach
  coach_name text,
  training_date timestamptz,
  status text,                        -- completed, no_show, cancelled, scheduled
  location text,                      -- Dubai, Abu Dhabi
  branch text,
  package_name text,                  -- name_packet
  session_type text,                  -- training, assessment, etc.
  time_slot text,
  synced_at timestamptz DEFAULT now(),
  CONSTRAINT unique_rds_session UNIQUE (rds_id)
);

-- Indexes for every dashboard query
CREATE INDEX idx_ts_date ON training_sessions(training_date);
CREATE INDEX idx_ts_coach ON training_sessions(coach_name, training_date);
CREATE INDEX idx_ts_client ON training_sessions(client_id, training_date);
CREATE INDEX idx_ts_status ON training_sessions(status);
CREATE INDEX idx_ts_location ON training_sessions(location);
```

### 0.2 — Process Stripe Events
**2,780 unprocessed events.** Create/enhance `stripe-process-events` edge function.
- Parse event types: `invoice.payment_failed`, `invoice.paid`, `charge.succeeded`, `charge.failed`
- Populate `stripe_transactions` (currently 0 rows)
- Create `payment_failures` table for dunning
- Time estimate: 2 hours

### 0.3 — Data Freshness Monitor
Small component `<DataFreshness source="sessions" />` that every dashboard page includes. Shows:
- Last sync time
- Row count
- Status badge (🟢 fresh / 🟡 >30min / 🔴 >2hr / ⚫ never synced)

---

## Phase 1: REVENUE PROTECTION (Day 2-3)
> Direct money impact. Every day without this = money leaking.

### 1.1 — Failed Payment Recovery Dashboard
**Route:** `/revenue/payments`
**Data:** `stripe_transactions` + `payment_failures` (from Phase 0.2)

**UI tabs:**
- **Active Failures** — table: client, amount, failure reason, attempt count, last retry, [Retry Now] [Contact Client]
- **Dunning Pipeline** — 7-step funnel visualization (auto-retry → WhatsApp → SMS → coach call → manager → final → cancel)
- **Recovery Stats** — AED recovered this month, recovery rate %, trend chart

**Edge function:** `payment-dunning-engine` (NEW)
- Automated retry logic with exponential backoff
- 3DS failure special handling (UAE-specific)
- Triggers WhatsApp via Lisa for human follow-up

### 1.2 — Revenue Leakage Detection
**Integrated into:** existing `/revenue` page as new tab "Leakage Detector"
- Session-vs-payment reconciliation (training_sessions JOIN stripe_transactions)
- Clients training without active package
- Clients paying but not training (ghost detection from revenue angle)

---

## Phase 2: DAILY OPERATIONS (Day 3-5)
> Ops Manager opens this at 7am. Proves the session sync works.

### 2.1 — Daily Ops Board
**Route:** New tab in `/command-center` (CommandCenter.tsx already has tab infrastructure)

**Sections:**
1. **Top bar:** Live counters — Sessions Today | Completed | No-Shows | Remaining
2. **City split:** Dubai left, Abu Dhabi right
3. **Coach cards:** Photo, progress bar (5/8 completed), next session countdown, no-show badge
4. **Color coding:** 🟢 on track | 🟡 light day | 🔴 overloaded | ⚫ day off

**Data hook:** `useDailyOps()` → queries `training_sessions WHERE training_date::date = today`
**Auto-refresh:** 60s polling via React Query `refetchInterval`

### 2.2 — Proactive Alert Center
**Route:** `/alerts` + 🔔 bell icon in top nav (global)
**Alert engine:** Edge function `proactive-alert-engine` (NEW) runs every 30 minutes

**9 alert types** (from ops-research spec):
| Alert | Trigger | Priority |
|-------|---------|----------|
| Ghost Client | Active package, 0 sessions 21+ days | 🔴 Critical |
| Client Inactive | No session 14+ days, active package | 🔴 High |
| Package Expiring | ≤7 days, ≥3 unused sessions | 🔴 High |
| New Client at Risk | <2 sessions in first 14 days | 🔴 High |
| Declining Client | Frequency dropped ≥50% | 🟡 Medium |
| Coach Overloaded | >10 sessions/day | 🟡 Medium |
| Coach No-Show Spike | 3+ no-shows in 7 days | 🟡 Medium |
| Over-Trainer | Sessions used > purchased | 🟡 Medium |
| Assessment No-Show | Assessment marked no-show | 🟢 Info |

**Table:** `proactive_alerts` — already exists in schema
**UI:** Slide-out panel, grouped by priority, each alert has [Take Action] dropdown
**Delivery:** Dashboard + WhatsApp push for 🔴 Critical via Lisa

---

## Phase 3: SALES MACHINE (Day 5-8)
> The money-making engine. Setters + Closers + Pipeline.

### 3.1 — Setter Command Center
**Route:** `/sales/setter`

**Sections:**
1. **Personal dashboard:** Calls today (progress bar to 50), connect rate, booking rate
2. **Smart Lead Queue:** Prioritized by lead score (source + area + recency + engagement)
3. **One-click outcome logging:** Button bar (No Answer, Voicemail, Booked, Not Interested, etc.)
4. **Team Leaderboard:** Today's rankings, competitive gamification

**Data:** `call_records` + `contacts` + `deals`
**Click-to-call:** CallGear API integration (`POST /calls/start`)
**Lead scoring:** Computed column on `contacts` updated hourly by `lead-scoring-engine` edge function

### 3.2 — Closer/Coach Sales Board
**Route:** `/sales/closer`

**Sections:**
1. **Today's assessments:** Timeline view, hour blocks, show probability badges
2. **Coach performance table:** Assessments, show rate, close rate, revenue/assessment, MTD revenue
3. **Smart assign:** When new assessment comes in → recommend coach by match score (location + specialty + capacity + close rate)

### 3.3 — Sales Pipeline Velocity
**Enhanced in:** existing `/sales-pipeline` page — add "Velocity" tab

**Sections:**
1. **Funnel visualization:** Stage-to-stage conversion with deal counts
2. **Velocity metrics:** Avg days in each stage, bottleneck detection (⚠️ flag on slow stages)
3. **Stuck deals:** >14 days in stage → alert table with [Nudge] [Reassign] buttons

**New table:** `deal_stage_history` — tracks every stage transition for velocity calculation

### 3.4 — Assessment Pipeline
**Route:** `/sales/assessments`
- Today/tomorrow assessment calendar
- Setter-to-show-rate tracking
- Coach assignment recommendations
- Assessment → package conversion funnel

---

## Phase 4: CLIENT INTELLIGENCE (Day 8-10)
> Retention = revenue protection. Find problems before clients churn.

### 4.1 — Client Activity Intelligence
**Route:** `/clients/activity`

**4 tabs:**
1. **Utilization** — Heatmap: clients × weeks, color = % of purchased frequency used
2. **Declining** — Sparkline trends, clients whose frequency dropped ≥50%
3. **Ghost Clients** — Active package but 21+ days inactive, with $ at risk calculation
4. **Over-Trainers** — Sessions used > sessions purchased, billing flag

**Data:** `training_sessions` JOIN `aws_truth_cache` (package data)

### 4.2 — Coach Performance Deep Dive
**Enhanced in:** existing `/coaches` page

**Add:**
- Session calendar heatmap (month view, intensity = session count)
- Client retention rate per coach
- Re-purchase rate (proxy for satisfaction)
- Revenue attribution per coach
- Downloadable PDF performance review

---

## Phase 5: MARKETING ATTRIBUTION (Day 10-13)
> Depends on Pipeboard + UTM convention being set up.

### 5.1 — True Attribution Engine
**Enhanced in:** existing `/attribution` page

**Truth Triangle:** Meta (Pipeboard) × AnyTrack × HubSpot
- Confidence scoring: triple match = 1.0, double = 0.7, single = 0.3
- Ghost lead detection (Meta claims credit, no HubSpot record)

### 5.2 — Creative DNA + Budget Optimizer
**Route:** `/marketing/creative`

**Sections:**
1. **Creative performance matrix:** Format × hook type × CTA, colored by ROAS
2. **Fatigue detection:** CTR decay charts per creative
3. **Budget rules:** KILL / SCALE / REFRESH / MAINTAIN with [Apply] buttons calling Pipeboard tools
4. **Landing page vs Lead form:** Full funnel comparison (CPL through to true CPA)

---

## Implementation Order (Prioritized by Impact × Feasibility)

| # | Task | Impact | Effort | Depends On | Day |
|---|------|--------|--------|------------|-----|
| 0.1 | Session sync pipeline (RDS → Supabase) | 🔴 Critical | 3hr | Nothing | 1 |
| 0.2 | Process Stripe events → stripe_transactions | 🔴 Critical | 2hr | Nothing | 1 |
| 0.3 | Data freshness component | 🟡 Medium | 1hr | Nothing | 1 |
| 1.1 | Failed payment recovery page | 🔴 High | 4hr | 0.2 | 2 |
| 1.2 | Revenue leakage tab | 🔴 High | 3hr | 0.1 + 0.2 | 2 |
| 2.1 | Daily Ops Board (Command Center tab) | 🔴 High | 4hr | 0.1 | 3 |
| 2.2 | Proactive Alert engine + UI | 🔴 High | 5hr | 0.1 | 3-4 |
| 3.1 | Setter Command Center | 🟡 High | 6hr | Nothing | 4-5 |
| 3.2 | Closer/Coach Sales Board | 🟡 Medium | 4hr | 0.1 | 5 |
| 3.3 | Pipeline Velocity tab | 🟡 Medium | 3hr | Nothing | 6 |
| 3.4 | Assessment Pipeline | 🟡 Medium | 4hr | 0.1 | 6-7 |
| 4.1 | Client Activity Intelligence | 🟡 Medium | 5hr | 0.1 | 7-8 |
| 4.2 | Coach Performance deep dive | 🟡 Medium | 3hr | 0.1 | 8 |
| 5.1 | True Attribution Engine | 🟢 Medium | 5hr | Pipeboard | 9-10 |
| 5.2 | Creative DNA + Budget Optimizer | 🟢 Medium | 5hr | 5.1 | 10-11 |

**Total: ~57 hours of build time → ~11 working days at 5hr/day effective coding**

---

## New Database Tables Needed (6)

| Table | Purpose | Populated By |
|-------|---------|-------------|
| `training_sessions` | Mirror of AWS vw_schedulers | sync-sessions edge fn (every 15min) |
| `payment_failures` | Failed Stripe payments + dunning state | stripe-process-events edge fn |
| `deal_stage_history` | Stage transition log for velocity | pipeline-monitor edge fn enhancement |
| `proactive_alerts` | Already exists — ensure schema matches | proactive-alert-engine edge fn |
| `lead_scores` | Computed lead scores with breakdown | lead-scoring-engine edge fn |
| `creative_dna` | Creative decomposition from Meta | Phase 5 creative analysis |

## New Edge Functions Needed (6)

| Function | Schedule | Purpose |
|----------|----------|---------|
| `sync-sessions` | Every 15 min | AWS RDS → training_sessions |
| `stripe-process-events` | Every 30 min | Parse 2,780+ Stripe events |
| `payment-dunning-engine` | Every 1 hr | Automated payment recovery |
| `proactive-alert-engine` | Every 30 min | Generate alerts from all data |
| `lead-scoring-engine` | Every 1 hr | Score all open leads |
| `creative-analyzer` | Daily | Meta creative performance via Pipeboard |

## New Frontend Pages (6)

| Page | Route | Component |
|------|-------|-----------|
| Payment Recovery | `/revenue/payments` | PaymentRecovery.tsx |
| Setter Command Center | `/sales/setter` | SetterCommandCenter.tsx |
| Closer Sales Board | `/sales/closer` | CloserSalesBoard.tsx |
| Assessment Pipeline | `/sales/assessments` | AssessmentPipeline.tsx |
| Client Activity | `/clients/activity` | ClientActivity.tsx |
| Alert Center | `/alerts` | AlertCenter.tsx |

## Enhanced Existing Pages (5)

| Page | Enhancement |
|------|------------|
| CommandCenter | Add "Daily Ops" tab with coach cards |
| SalesPipeline | Add "Velocity" tab with bottleneck detection |
| RevenueIntelligence | Add "Leakage" tab |
| Coaches | Add deep dive panel with heatmap + retention |
| Attribution/Marketing | Integrate Truth Triangle + Creative DNA |

---

## Data Accuracy Protocol (100% Target)

Every data point on every page must pass these checks:

1. **Source tag:** Small grey text showing where the number comes from (e.g., "Source: call_records · Synced 3 min ago")
2. **Freshness badge:** 🟢 <30min / 🟡 30min-2hr / 🔴 >2hr / ⚫ Never
3. **Cross-validation:** Where possible, show data from 2 sources side-by-side (e.g., HubSpot deal count vs Supabase deal count)
4. **Zero-state handling:** If a table has 0 rows, show "No data yet — [Set Up Sync]" instead of empty charts
5. **Error boundaries:** Every data section wrapped in ErrorBoundary that shows what failed, not a white screen
6. **Audit trail:** All sync operations logged to `sync_logs` with row counts, so discrepancies are traceable

---

## Start Here → Phase 0.1: sync-sessions

This is the single most impactful thing to build first. It unblocks:
- Daily Ops Board
- Client Activity Intelligence  
- Coach Performance
- Assessment Pipeline
- Proactive Alerts
- Health Score accuracy (fixes the 99.7% RED problem)

**Ready to build. Say "go" and I start with sync-sessions.**
