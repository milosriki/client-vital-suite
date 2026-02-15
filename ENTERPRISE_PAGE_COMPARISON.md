# Enterprise Page-by-Page Comparison: Pros, Cons, Design, Compatibility

> Each of the 7 page pairs is analyzed individually. NOT consolidated.
> Purpose: Test each enterprise page independently before integrating.

---

## PAGE PAIR 1: Operations.tsx → SystemObservability.tsx

### EXISTING: `src/pages/Operations.tsx` (127 lines)

**What it does:**
- Tab-based operations center with 4 tabs: HubSpot, Calls, Automation, System
- Pure layout shell — delegates all data/rendering to child components
- Test/Live mode toggle persisted in localStorage
- The Calls tab embeds the entire `CallTracking` page component
- The Automation tab has 3 nested sub-tabs (Strategy, Analyzer, Rules)
- The System tab shows `SettingsTab` with configuration options

**Data:** All real — delegated to `HubSpotCommandCenter`, `CallTracking`, `WorkflowStrategy`, `HubSpotAnalyzer`, `AutomationTab`, `SettingsTab`

**Design:** Standard shadcn `Tabs` with icons. Light/neutral theme. Functional, not flashy.

### ENTERPRISE: `.worktrees/enterprise-upgrade/src/pages/SystemObservability.tsx` (133 lines)

**What it does:**
- System health monitoring dashboard
- 4 metric cards: Uptime (99.98%), Avg Latency (840ms), Daily AI Tokens (1.2M), Truth DNA Drift (0.02%)
- Edge Function Registry showing 4 functions with health status + latency
- Materialized Truth Sync cycle progress (12m/15m)
- Critical Alerts section showing log-style error messages
- "Force Immediate Sync" button (non-functional)

**Data:** 100% hardcoded mock data. Zero Supabase queries.

**Design:** Full black background (`bg-black`), dark glassmorphism cards, neon green/red status indicators, monospace fonts, pulsing sync animation. Enterprise "mission control" aesthetic.

### PROS of Enterprise Version
- **Visual design is significantly more advanced** — dark theme with glassmorphism, neon indicators, professional monitoring aesthetic
- **Focused scope** — single responsibility (system health) vs Operations' 4-tab catch-all
- **Edge Function Registry** concept is valuable — monitors the 143 deployed functions
- **Truth Sync Cycle** concept shows materialized view refresh status
- **Critical Alerts** section is a genuinely new capability not found anywhere on main

### CONS of Enterprise Version
- **100% mock data** — every metric, function status, and alert is hardcoded
- **Loses ALL Operations functionality** — HubSpot CRM, Call Tracking, Workflow Automation, Settings are all gone
- **Only shows 4 of 143 functions** — hardcoded array, no pagination or search
- **"Force Immediate Sync" button does nothing** — no onClick handler
- **"Refresh All" button does nothing** — no onClick handler
- **No time range filter** — existing Observability.tsx on main has 1h/24h/7d time range
- **Missing existing Observability features** — main already has `Observability.tsx` (454 lines) with real AI execution metrics, cost tracking, provider breakdown, latency monitoring. The enterprise version is a visual downgrade in terms of actual data

### DESIGN DIFFERENCES
| Aspect | Operations.tsx | SystemObservability.tsx |
|:-------|:--------------|:----------------------|
| Theme | Light/neutral with shadcn defaults | Full black (`bg-black`) with glassmorphism |
| Layout | Tab-based orchestration shell | Single-scroll monitoring dashboard |
| Typography | Standard sans-serif | Monospace for metrics, uppercase tracking-widest labels |
| Color accents | shadcn defaults | Neon emerald/amber status LEDs with box-shadow glow |
| Data density | High (delegates to full sub-pages) | Medium (4 metrics + 4 functions) |
| Interactive elements | Mode toggle, 4+3 tab navigation | None functional |

### COMPATIBILITY REQUIREMENTS TO TEST
1. **Fix import:** `DashboardHeader` from `@/components/dashboard/layout/DashboardHeader` — EXISTS on main ✓
2. **Fix import:** `MetricCard` from `@/components/dashboard/cards/MetricCard` — EXISTS on main ✓
3. **Unused imports:** `useState`, `Database`, `Clock`, `Search`, `Badge` — remove or use
4. **Add route:** No route exists in main.tsx — add `/system-observability`
5. **To test standalone:** Copy file to `src/pages/`, fix imports, add route, run `npm run build`

### VERDICT
These are **NOT the same domain**. Operations is a business operations hub. SystemObservability is a technical monitoring dashboard. They should COEXIST, not replace. However, SystemObservability overlaps heavily with the existing `Observability.tsx` (454 lines, real data). The enterprise version is visually better but functionally empty compared to main's Observability page.

---

## PAGE PAIR 2: SetterActivityToday.tsx → AIAdvisor.tsx

### EXISTING: `src/pages/SetterActivityToday.tsx` (377 lines)

**What it does:**
- Daily sales setter activity tracker
- Shows today's calls with real-time data from `call_records` table
- Shows today's bookings from `deals` table (BOOKED/HELD/ASSESSMENT_DONE stages)
- Owner/setter filter dropdown (re-fetches data per setter)
- KPI row: Total Calls, Reached, Booked, Conversion Rate
- Performance bar: Connection rate, Pipeline value in AED, last updated
- Two tables: Call Activity (time, caller, direction, status, duration, owner) and Booked Assessments (deal, stage, value, owner, time)

**Data:** 100% real from Supabase — `call_records`, `deals`, `contacts` tables. Uses `useDedupedQuery` (TanStack wrapper). Dubai timezone-aware date calculations.

**Design:** Standard shadcn cards and tables. Light theme. Compact KPI row with green/blue accents.

### ENTERPRISE: `.worktrees/enterprise-upgrade/src/pages/AIAdvisor.tsx` (145 lines)

**What it does:**
- AI intervention queue showing 2 hardcoded clients
- Summary HUD: Active Interventions count, Revenue at Risk (AED 45,000), Projected Recovery (AED 32,400)
- Intervention cards with client name, churn probability, reason, pre-written "Lisa Script"
- "Send to WhatsApp" and "Regenerate Logic" buttons (both non-functional)
- Right sidebar: Advisor IQ stats (model, accuracy, tokens/insight)
- "Deep Learning Active" decorative section

**Data:** 100% hardcoded mock data. Zero Supabase queries. Zero edge function calls.

**Design:** Full black background, violet/red/emerald accent cards with glassmorphism, monospace fonts, "Sparkles" animation on scripts.

### PROS of Enterprise Version
- **AI-powered concept** — the idea of proactive intervention scripts generated by Gemini is genuinely valuable
- **Visual design is premium** — dark glassmorphism, violet glow effects, the "Lisa Script" card design is excellent
- **Revenue impact framing** — showing "Revenue at Risk" and "Projected Recovery" is business-valuable
- **WhatsApp integration concept** — "Send to WhatsApp" as a one-click action is operationally smart
- **Churn probability display** — each client shows a percentage risk

### CONS of Enterprise Version
- **100% mock data** — every client, script, and metric is hardcoded
- **Loses ALL setter tracking** — daily calls, bookings, conversion rates, per-setter filtering all gone
- **Only 2 clients shown** — no pagination, no search, no real query
- **"Send to WhatsApp" does nothing** — no onClick handler
- **"Regenerate Logic" does nothing** — no onClick handler
- **Duplicates existing functionality** — `AIBusinessAdvisor.tsx` (241 lines) on main ALREADY does this with REAL data: queries `client_health_scores` for at-risk clients, calls `ptd-agent-gemini` edge function to generate scripts, has working copy-to-clipboard
- **No setter filter** — can't filter by team member
- **Lisa Scripts are pre-written strings** — not actually generated by Gemini
- **Advisor IQ stats are fake** — "98.4% accuracy", "420 avg tokens" are decorative

### DESIGN DIFFERENCES
| Aspect | SetterActivityToday.tsx | AIAdvisor.tsx |
|:-------|:----------------------|:-------------|
| Theme | Light, standard shadcn | Dark black, glassmorphism |
| Purpose | Activity tracking (calls + bookings) | AI intervention scripts |
| Data model | Call records + deals | At-risk clients + AI scripts |
| Interactivity | Owner filter dropdown, real-time refresh | Click intervention card (visual only) |
| Metric style | Compact KPI row with 4 cards | 3 large accent cards (violet/red/emerald) |
| Typography | Standard | Monospace for stats, italic for scripts |

### COMPATIBILITY REQUIREMENTS TO TEST
1. **Fix import:** `DashboardHeader` from `@/components/dashboard/layout/DashboardHeader` — EXISTS on main ✓
2. **Unused imports:** `Mail`, `Phone`, `ArrowRight`, `ChevronDown` — remove or use
3. **Add route:** No route exists — add `/ai-advisor` (NOTE: `/ai-advisor` collides with existing `/ai-advisor` route which loads `AIBusinessAdvisor`)
4. **Route conflict:** Main already has `AIBusinessAdvisor.tsx` at `/ai-advisor`. Need different route like `/enterprise-advisor`
5. **To test standalone:** Copy file, fix imports, add unique route, run `npm run build`

### VERDICT
These are **completely different pages**. SetterActivityToday tracks daily sales activity with real data. AIAdvisor shows AI intervention scripts with mock data. Main ALREADY has `AIBusinessAdvisor.tsx` which does what AIAdvisor tries to do, but with real Gemini AI generation and real client data. The enterprise version's visual design is better, but its functionality is a downgrade from the existing AIBusinessAdvisor.

---

## PAGE PAIR 3: YesterdayBookings.tsx → CallAnalytics.tsx

### EXISTING: `src/pages/YesterdayBookings.tsx` (369 lines)

**What it does:**
- Yesterday's booking report (read-only)
- Queries `intervention_log` for booking/assessment/scheduled interventions from yesterday
- Queries `client_health_scores` for GREEN/PURPLE zone clients from yesterday
- Merges and deduplicates both data sources by email
- Summary cards: Total Bookings, Total Value (AED), Average Value (AED)
- Detailed table: Time, Client (name + email + city), Coach/Setter, Type, Value, Status
- Expanded booking detail cards with notes
- Data source transparency alert showing exact tables and date range

**Data:** 100% real from Supabase — `intervention_log`, `client_health_scores`. Uses `useDedupedQuery`. Dubai timezone-aware.

**Design:** Standard shadcn cards and table. Light theme with health zone color coding (GREEN/PURPLE/RED badges).

### ENTERPRISE: `.worktrees/enterprise-upgrade/src/pages/CallAnalytics.tsx` (157 lines)

**What it does:**
- Call intelligence dashboard (conceptual)
- 4 metric cards: Total Calls (1,284), Avg Intent IQ (72%), Booking Conv % (34.2%), Revenue Shadow (AED 120K)
- "Intent Velocity (Hourly)" chart placeholder (empty)
- "Top Setters (By IQ)" card showing 3 stub setters with `{[1,2,3].map(...)}`
- "Live Call Stream" table with 2 hardcoded call records showing lead, direction, IQ score, Atlas AI verdict, status

**Data:** 100% hardcoded mock data. Zero queries.

**Design:** Full black, dark glassmorphism, violet glow on high-IQ scores, neon badges, "LIVE" indicator badge, PhoneIncoming/PhoneOutgoing directional icons.

### PROS of Enterprise Version
- **"Intent IQ" concept is new** — scoring calls by conversation quality is not in the existing codebase
- **"Atlas AI Summary" per call** — AI-generated verdict for each call is a valuable concept
- **Visual design is premium** — dark theme with violet IQ glow, directional call icons, live status badges
- **Call-to-cash framing** — "Revenue Shadow" metric connects calls to revenue
- **DataTableCard usage** — uses the shared component with custom render functions per column

### CONS of Enterprise Version
- **100% mock data** — all metrics and call records are hardcoded
- **BUILD ERRORS** — `Target` and `DollarSign` icons used but never imported (lines 33-34). Will not compile.
- **Missing component imports** — `DataTableCard` from `@/components/dashboard/cards/DataTableCard` EXISTS on main ✓
- **Intent IQ not implemented anywhere** — no edge function, no database column, no scoring logic exists
- **Chart is empty** — "Intent Velocity (Hourly)" is just a dashed placeholder
- **Top Setters shows stub data** — `Setter 1`, `Setter 2`, `Setter 3` with fake IQ scores
- **Only 2 call records** — no pagination, no date range filter, no real-time
- **Loses yesterday's booking tracking** — booking outcomes, revenue summaries, multi-source fusion all gone
- **`loading` state declared but never used** — `setLoading` never called

### DESIGN DIFFERENCES
| Aspect | YesterdayBookings.tsx | CallAnalytics.tsx |
|:-------|:---------------------|:-----------------|
| Theme | Light, standard shadcn | Dark black, glassmorphism |
| Time frame | Yesterday (fixed) | Conceptually "14d" and "live" |
| Data focus | Booking outcomes (downstream) | Call performance (upstream) |
| Metric style | Summary cards (count, total AED, avg AED) | 4 cards with delta arrows |
| Table style | HTML with shadcn styling | DataTableCard with custom renders |
| Unique features | Multi-source data fusion, deduplication | Intent IQ scoring, AI verdict |

### COMPATIBILITY REQUIREMENTS TO TEST
1. **Fix build error:** Add `Target, DollarSign` to lucide-react import
2. **Fix import:** `DashboardHeader` — EXISTS on main ✓
3. **Fix import:** `DataTableCard` — EXISTS on main ✓
4. **Fix import:** `MetricCard` — EXISTS on main ✓
5. **Remove unused:** `useEffect`, `PhoneCall`, `MessageSquare`, `Search`, `Filter`, `BarChart3`, `Clock`
6. **Add route:** `/call-analytics` (no conflict)
7. **To test standalone:** Fix 2 missing icon imports, copy file, add route, run `npm run build`

### VERDICT
Different domains. YesterdayBookings tracks booking outcomes. CallAnalytics tracks call performance. They could COEXIST as complementary views. The enterprise version introduces "Intent IQ" which is a genuinely new concept but has zero implementation. The biggest gap is that CallAnalytics has no data layer at all — it would need to query `call_records` (like SetterActivityToday already does) and add the IQ scoring concept on top.

---

## PAGE PAIR 4: AIBusinessAdvisor.tsx → AIAdvisor.tsx

### EXISTING: `src/pages/AIBusinessAdvisor.tsx` (241 lines)

**What it does:**
- AI-powered intervention tool for at-risk clients
- Left panel: Scrollable list of RED/YELLOW zone clients from `client_health_scores`, sorted worst-first
- Right panel: AI-generated 3-step intervention script (text + email + advisor tip)
- Calls `ptd-agent-gemini` edge function with client health data as context
- Copy All Scripts button (clipboard + toast)
- Regenerate button (re-calls Gemini for same client)

**Data:** Real queries — `client_health_scores` for client list, `ptd-agent-gemini` edge function for AI generation.

**Design:** Dark-ish but standard. Two-panel layout. Red/Yellow health zone badges. Pre-formatted script in `<pre>` block with `ScrollArea`. Simple, functional.

### ENTERPRISE: `.worktrees/enterprise-upgrade/src/pages/AIAdvisor.tsx` (145 lines)

**What it does:**
- AI intervention queue (same concept)
- 3 summary cards: Active Interventions, Revenue at Risk, Projected Recovery
- Intervention cards with pre-written Lisa Scripts (not AI-generated)
- "Send to WhatsApp" and "Regenerate Logic" buttons (non-functional)
- Right sidebar: Advisor IQ stats, Deep Learning status indicator

**Data:** 100% hardcoded. No queries. No AI generation.

**Design:** Full black, glassmorphism everywhere, violet/red/emerald accent cards, sparkles animation, monospace stats.

### PROS of Enterprise Version
- **Revenue impact framing** — "Revenue at Risk" (AED 45K) and "Projected Recovery" (AED 32.4K) add business context that the existing version lacks
- **Visual design is significantly more polished** — glassmorphism cards, gradient accents, the Lisa Script card design with Sparkles overlay is beautiful
- **"Send to WhatsApp" concept** — one-click delivery to WhatsApp is operationally valuable (existing only has clipboard copy)
- **Churn probability percentage** — "92% Churn Probability" is more impactful than just "RED zone"
- **Model transparency** — showing "Gemini 3 Flash" model name, accuracy, token usage builds trust

### CONS of Enterprise Version
- **Zero real data** — existing version queries REAL at-risk clients; enterprise has 2 hardcoded names
- **Zero AI generation** — existing version ACTUALLY calls Gemini via `ptd-agent-gemini`; enterprise has pre-written scripts
- **Non-functional buttons** — both "Send to WhatsApp" and "Regenerate Logic" do nothing
- **No client list** — existing version shows ALL at-risk clients sorted by severity; enterprise shows only 2
- **No copy-to-clipboard** — existing has working clipboard copy with toast
- **Fake stats** — "98.4% accuracy" is not measured; "420 avg tokens" is not from real data
- **Shorter** — 145 lines vs 241 lines means less actual functionality
- **No loading state** — existing shows spinner while Gemini generates; enterprise is static

### DESIGN DIFFERENCES
| Aspect | AIBusinessAdvisor.tsx | AIAdvisor.tsx |
|:-------|:---------------------|:-------------|
| Theme | Dark-ish standard | Full black glassmorphism |
| Layout | 4/12 + 8/12 two-panel | 2/3 + 1/3 with summary cards on top |
| Client list | Real data, all at-risk clients, scrollable | 2 hardcoded intervention cards |
| Script display | `<pre>` in ScrollArea | Styled card with Sparkles overlay |
| Actions | Copy to clipboard, Regenerate (both work) | Send to WhatsApp, Regenerate (both broken) |
| AI integration | Real Gemini call | None |
| Revenue context | None | Revenue at Risk + Projected Recovery |

### COMPATIBILITY REQUIREMENTS TO TEST
1. **Fix import:** `DashboardHeader` — EXISTS on main ✓
2. **Remove unused:** `Mail`, `Phone`, `ArrowRight`, `ChevronDown`
3. **Route conflict:** Main has `/ai-advisor` pointing to `AIBusinessAdvisor`. Need unique route like `/enterprise-advisor`
4. **To test standalone:** Copy file, fix imports, add unique route, run `npm run build`

### VERDICT
This is a **genuine replacement candidate**. Same domain (AI intervention for at-risk clients). The enterprise version has a better visual design and adds revenue context, but the existing version has ALL the actual functionality (real data, real AI, working buttons). The ideal outcome is to **apply the enterprise design** to the existing version's data layer and AI integration.

---

## PAGE PAIR 5: Observability.tsx → SystemObservability.tsx

### EXISTING: `src/pages/Observability.tsx` (454 lines)

**What it does:**
- AI execution monitoring with REAL data from `ai_execution_metrics` table
- Time range filtering: 1h / 24h / 7d
- 4 stats cards: Total Executions, Success Rate, Avg Latency (ms), Total Cost (USD)
- By Function breakdown: top 15 functions by call count, error count, avg latency, cost
- By AI Provider breakdown: provider, cost, call count, tokens, proportional bar chart
- Recent Executions table: status, function, provider, model, latency, tokens in/out, cost, timestamp, error message
- Manual Refresh button
- LangSmith external link

**Data:** Real from `ai_execution_metrics` Supabase table. 500-record limit. Aggregates client-side into function/provider breakdowns.

**Design:** Standard shadcn cards. Light theme. Functional data-dense layout. Proportional bars for provider cost. Status badges (green/red/yellow).

### ENTERPRISE: `.worktrees/enterprise-upgrade/src/pages/SystemObservability.tsx` (133 lines)

**What it does:**
- System health overview with 4 metric cards (hardcoded)
- Edge Function Registry with 4 hardcoded functions
- Materialized Truth Sync cycle progress
- Critical Alerts section

**Data:** 100% hardcoded.

**Design:** Full black, glassmorphism, neon status LEDs, pulsing sync animation, monospace log-style alerts.

### PROS of Enterprise Version
- **"Edge Function Registry" is a NEW concept** — monitoring individual functions by name/health/latency. Existing Observability groups by function but doesn't show a "registry" view
- **"Materialized Truth Sync" is NEW** — monitoring the 15-min cron refresh cycle. Doesn't exist on main
- **"Critical Alerts" is NEW** — showing recent errors in a log-style format. Existing page shows errors in a table but not as a live alert feed
- **Visual design is more polished** — neon LED health indicators, glassmorphism cards, the sync progress animation is visually compelling
- **Focused scope** — infrastructure monitoring only, vs existing page which mixes AI metrics with infrastructure

### CONS of Enterprise Version
- **100% mock data** — existing page has 454 lines of REAL data with real aggregation
- **Shows 4 of 143 functions** — hardcoded. Existing groups ALL functions from real metrics
- **No time range filter** — existing has 1h/24h/7d. Enterprise has none
- **No cost tracking** — existing tracks cost per function and per provider. Enterprise has none
- **No provider breakdown** — existing shows Gemini provider stats. Enterprise has none
- **No token tracking** — existing counts tokens in/out. Enterprise just says "1.2M" (fake)
- **No error details** — existing shows error messages per execution. Enterprise shows 2 hardcoded log lines
- **No search or pagination** — just 4 static items
- **3x shorter** — 133 lines vs 454 lines

### DESIGN DIFFERENCES
| Aspect | Observability.tsx | SystemObservability.tsx |
|:-------|:-----------------|:----------------------|
| Theme | Light, standard | Full black, glassmorphism |
| Data records | Up to 500 real executions | 4 hardcoded functions |
| Aggregation | By function (top 15) + by provider | None |
| Filtering | Time range: 1h/24h/7d | None |
| Cost tracking | Per-function and per-provider in USD | None (shows "0.02%" as decorative text) |
| Unique features | Provider proportional bars, LangSmith link | Function Registry, Sync Cycle, Alert Feed |

### COMPATIBILITY REQUIREMENTS TO TEST
1. **Fix import:** `DashboardHeader` — EXISTS on main ✓
2. **Fix import:** `MetricCard` from `cards/MetricCard` — EXISTS on main ✓
3. **Remove unused:** `useState`, `Database`, `Clock`, `Search`, `Badge`
4. **Add route:** `/system-observability` (no conflict with existing `/observability`)
5. **To test standalone:** Copy file, fix imports, add route, run `npm run build`

### VERDICT
**HIGH overlap** — same domain. Existing is functionally superior (real data, filtering, aggregation, cost tracking). Enterprise adds NEW concepts (function registry, sync cycle, alerts) but with zero data. Best path: **merge the enterprise UI concepts INTO the existing Observability page** rather than replacing it.

---

## PAGE PAIR 6: ReconciliationDashboard.tsx → EnterpriseStrategy.tsx

### EXISTING: `src/pages/ReconciliationDashboard.tsx` (269 lines)

**What it does:**
- "Leak Detector" — AWS Backoffice vs HubSpot reconciliation
- Calls `aws-truth-alignment` edge function for data
- Summary: Total Checked, Identity Matches, Auto-Aligned, Discrepancies
- "Run Audit" button (triggers re-fetch)
- "Force Align All" button (triggers mutation that auto-aligns discrepancies)
- Discrepancy table: email, field, old state, new truth, status

**Data:** Real via `aws-truth-alignment` Supabase edge function. Uses TanStack `useQuery` + `useMutation`.

**Design:** Dark gradient header (red-to-orange). Standard table. "Force Align All" as a primary destructive action.

### ENTERPRISE: `.worktrees/enterprise-upgrade/src/pages/EnterpriseStrategy.tsx` (163 lines)

**What it does:**
- "Strategy Command" — multi-source revenue intelligence
- Segment Capacity HUD: shows zone/gender capacity loads with progress bars, STOP SPEND / READY TO PUSH badges
- Revenue Shadow card: projected revenue (AED) with leak prediction
- Tabs: Revenue Genome / Financial Leaks / Creative DNA (only first tab has content — a placeholder)
- Fixed bottom action bar: leak count, scale opportunity count, "Download CFO Report", "Apply Budget Decisions"
- "Sync Truth" refresh button (works — re-calls ReconciliationService)

**Data:** PARTIALLY REAL — uses `ReconciliationService.ts` which queries `mv_enterprise_truth_genome` and `view_segment_capacity_hud` views. These views DON'T EXIST YET (migrations not deployed), but the service layer is wired.

**Design:** Full black, glassmorphism, violet revenue shadow card, red pulsing capacity alerts, fixed bottom command bar, neon progress bars, monospace metrics.

### PROS of Enterprise Version
- **Multi-source reconciliation concept** — bridges FB + AnyTrack + HubSpot + CallGear + Stripe (5 sources vs existing's 2 sources: AWS + HubSpot)
- **Segment Capacity HUD is genuinely new** — no page on main shows coach capacity by zone/gender
- **"Revenue Shadow" predictive metric** — projects future revenue from high-intent leads. Doesn't exist on main
- **"STOP SPEND" / "READY TO PUSH" badges** — actionable capacity-based ad spend signals. NEW concept
- **ReconciliationService architecture** — proper service layer pattern (existing page calls edge function directly)
- **Visual design is premium** — dark theme with violet revenue card, red capacity alerts, fixed action bar
- **Fixed bottom action bar** — persistent access to CFO report and budget decisions

### CONS of Enterprise Version
- **Migrations don't work** — the views it queries (`mv_enterprise_truth_genome`, `view_segment_capacity_hud`) are created by migrations with 7 BLOCKER-level column mismatches (see ENTERPRISE_ARCHITECTURE_PLAN.md Section 7)
- **2 of 3 tabs are empty** — "Financial Leaks" and "Creative DNA" are placeholder divs
- **"Download CFO Report" does nothing** — no onClick
- **"Apply Budget Decisions" does nothing** — no onClick
- **`indicatorClassName` prop doesn't exist** on shadcn Progress component — TypeScript error
- **Loses AWS alignment functionality** — existing "Force Align All" mutation that auto-aligns discrepancies is not in enterprise version
- **`select('*')` usage** — against project conventions (Batch 6 remediated this)
- **`as any` type casts** — ReconciliationService bypasses TypeScript

### DESIGN DIFFERENCES
| Aspect | ReconciliationDashboard.tsx | EnterpriseStrategy.tsx |
|:-------|:--------------------------|:---------------------|
| Theme | Dark gradient header, standard body | Full black glassmorphism |
| Data scope | 2-source (AWS + HubSpot) | 5-source conceptual (FB + AT + HS + CG + Stripe) |
| Primary action | "Force Align All" (destructive mutation) | "Apply Budget Decisions" (non-functional) |
| Unique UI | Discrepancy ledger table | Segment Capacity HUD with progress bars |
| Layout | Summary cards + table | HUD grid + tabs + fixed action bar |
| Reconciliation | Session count alignment | Revenue + intent + capacity reconciliation |

### COMPATIBILITY REQUIREMENTS TO TEST
1. **Fix import:** `DashboardHeader` — EXISTS on main ✓ (but imported and NOT used in JSX — can remove)
2. **Fix TypeScript:** `indicatorClassName` prop on `Progress` — remove or extend the Progress component
3. **Remove unused imports:** `Phone`, `AlertTriangle`, `LayoutGrid`, `Filter`, `CheckCircle2`, `Zap`, `ShieldAlert`
4. **Service dependency:** `ReconciliationService.ts` must be copied from worktree to `src/services/enterprise/`
5. **Database dependency:** CANNOT test with real data until migrations are fixed and deployed
6. **Workaround for testing:** Modify ReconciliationService to return mock data until migrations work
7. **Add route:** `/enterprise-strategy` (no conflict with `/reconciliation`)
8. **To test standalone:** Copy page + service, fix imports, mock the service data, add route, run `npm run build`

### VERDICT
**Different domains** but related. ReconciliationDashboard does AWS↔HubSpot session alignment. EnterpriseStrategy does multi-source revenue intelligence with capacity awareness. They SHOULD coexist. EnterpriseStrategy introduces genuinely new concepts (capacity HUD, revenue shadow, 5-source reconciliation), but needs its migrations fixed before it can work with real data. This is the **highest-value enterprise page** — worth finishing.

---

## PAGE PAIR 7: AIKnowledge.tsx → KnowledgeBase.tsx

### EXISTING: `src/pages/AIKnowledge.tsx` (303 lines)

**What it does:**
- Knowledge Graph browser
- Queries `knowledge_base` table with server-side category filter
- Client-side text search across content and source fields
- Stats cards: Total Entities, Interventions, Patterns, Strategy counts
- Category dropdown filter (All, Interventions, Patterns, Business, Coach Tips, Health Scoring)
- 3-column card grid: category badge, date, source title, content (4-line clamp), confidence percentage
- "View Details" button on hover (non-functional)
- Navigation buttons: Back to home, View Decision Logic

**Data:** Real from `knowledge_base` Supabase table. Dual query: entries + category counts. Uses `useDedupedQuery`.

**Design:** Standard shadcn cards. Light theme. Color-coded category badges. Confidence percentage display.

### ENTERPRISE: `.worktrees/enterprise-upgrade/src/pages/KnowledgeBase.tsx` (152 lines)

**What it does:**
- "Global Brain" knowledge search interface
- Hero search bar with gradient glow effect, Cmd+K indicator
- Quick filter tag chips (Ad Copy, Objections, Onboarding, Pricing, Zones)
- "High-Confidence Insights" grid: 3 hardcoded cards with category, match percentage, title, tags, date
- "Memory Fabric" stats sidebar: Total Entries (1,284), Vector Embeddings (SYNCED), Last Pattern Learned
- Quick Shortcuts: "New Sales Training", "Export Knowledge Graph" (non-functional)

**Data:** 100% hardcoded mock data. Zero queries.

**Design:** Full black, huge hero search with animated gradient glow, violet category badges, glassmorphism cards, "Memory Fabric" sidebar with decorative blur, Cmd+K keyboard indicator (purely visual).

### PROS of Enterprise Version
- **Visual search experience is dramatically better** — hero search bar with gradient glow is engaging. Existing is a small input field in a card
- **"Match percentage" concept is NEW** — "98% Match" suggests vector similarity search. Existing shows "confidence" which is stored, not computed
- **"Memory Fabric" sidebar** — framing the knowledge base as a "Global Brain" with vector embeddings is conceptually superior
- **Tag chips for quick filtering** — more intuitive than a dropdown select
- **Visual design is premium** — the hero search with animated glow, the card hover effects, the sidebar blur effects
- **"Export Knowledge Graph" concept** — not in existing version

### CONS of Enterprise Version
- **100% mock data** — existing queries REAL knowledge_base table
- **BUILD ERROR** — `Button` component is used (lines 140, 143 for Quick Shortcuts) but never imported
- **Zero search functionality** — the hero search captures text but does nothing. No filtering, no API call, no vector search
- **Only 3 hardcoded insights** — existing shows ALL entries with server-side category filtering
- **No category filter** — tag chips have no onClick handlers. Existing has working server-side category filter
- **No stats from real data** — "1,284" is hardcoded. Existing counts actual entries per category
- **No "View Details" capability** — cards show "Read Full →" but with no navigation
- **Cmd+K is fake** — no keyboard listener, purely decorative
- **Shorter** — 152 lines vs 303 lines
- **No confidence/date sorting** — existing sorts by `created_at DESC`

### DESIGN DIFFERENCES
| Aspect | AIKnowledge.tsx | KnowledgeBase.tsx |
|:-------|:---------------|:-----------------|
| Theme | Light, standard | Full black, glassmorphism |
| Search | Small Input in a card | Hero search with gradient glow, centered |
| Filtering | Category dropdown (server-side) + text search (client-side) | Tag chips (non-functional) |
| Grid | 3-column responsive | 2-column with sidebar |
| Card design | Category badge + source + content + confidence | Category + match% + title + tags + date |
| Stats | 4 cards with real category counts | Sidebar with 3 decorative stats |
| Unique features | Server-side filtering, confidence display, dual query | Hero search UX, match percentage, tag chips |

### COMPATIBILITY REQUIREMENTS TO TEST
1. **Fix build error:** Add `import { Button } from "@/components/ui/button"`
2. **Fix import:** `DashboardHeader` — EXISTS on main ✓
3. **Remove unused:** `Library`, `cn` (no conditional classes used)
4. **Add route:** `/knowledge-base` (no conflict with `/ai-knowledge`)
5. **To test standalone:** Add Button import, copy file, add route, run `npm run build`

### VERDICT
**HIGH overlap** — same domain (knowledge browsing). Existing has all the functionality (real data, filtering, counts). Enterprise has dramatically better visual design (hero search, tag chips, Memory Fabric sidebar). Best path: **apply enterprise visual design to existing data layer**. The vector search / match percentage concept could be genuinely new functionality if connected to the `knowledge_chunks` table with embeddings.

---

## BONUS: ClientHealth.tsx and CoachPerformance.tsx (No Direct Replacements)

### ClientHealth.tsx — NEW PAGE (no existing equivalent)

**What it does:** Master-detail view for client health. Left panel is a scrollable client list with search. Right panel is a detailed "X-Ray" with health score, LTV, next session, and activity timeline.

**Closest existing:** `AIBusinessAdvisor.tsx` has a similar master-detail pattern for at-risk clients, but focused on AI scripts rather than health data.

**Unique value:** Activity Timeline concept (session history, health score drops) doesn't exist on any current page.

**Compatibility to test:**
1. Fix 3 missing icon imports: `DollarSign`, `Clock`, `Target`
2. Fix import path: `MetricCard` from `cards/MetricCard` — EXISTS on main ✓
3. Remove unused: `DashboardHeader` (imported but not used in JSX), `Filter`, `ArrowRight`
4. Add route: `/client-health`
5. Wire real data: Replace mock `clients` array with `client_health_scores` query

### CoachPerformance.tsx — NEW PAGE (no existing equivalent)

**What it does:** Coach capacity monitoring with heatmap table. Shows coach load percentages, session counts, LTV:CAC ratios, and AT LIMIT/SCALABLE verdicts. Sidebar has capacity predictions and zone performance.

**Closest existing:** No page currently monitors coach performance or capacity.

**Unique value:** Coach load balancing, capacity prediction, zone-based performance. Genuinely new domain.

**Compatibility to test:**
1. Fix `indicatorClassName` on Progress component
2. Fix imports: `DashboardHeader`, `DataTableCard`, `MetricCard` — all EXIST on main ✓
3. Add missing import: `Button` (used but not imported on line 116)
4. Remove unused: `MapPin`, `UserCheck`, `BarChart3`, `Target`, `AlertCircle`, `activeZone` state
5. Add route: `/coach-performance`
6. Database dependency: Needs `staff.home_zone` and `staff.gender` columns (don't exist — requires new migration)

---

## TESTING PRIORITY ORDER

Based on value, compatibility, and effort to test:

| Priority | Page | Effort to Test | Value |
|:---------|:-----|:---------------|:------|
| 1 | **EnterpriseStrategy.tsx** | MEDIUM (needs service + mock data) | HIGHEST — only page with real data architecture |
| 2 | **AIAdvisor.tsx** | LOW (just fix 1 import) | MEDIUM — visual upgrade of existing AIBusinessAdvisor |
| 3 | **KnowledgeBase.tsx** | LOW (add 1 missing import) | MEDIUM — hero search UX concept |
| 4 | **ClientHealth.tsx** | LOW (fix 3 missing icons) | MEDIUM — new domain, master-detail pattern |
| 5 | **SystemObservability.tsx** | LOW (fix unused imports) | LOW-MEDIUM — visual concepts for existing Observability |
| 6 | **CallAnalytics.tsx** | LOW (fix 2 missing icons) | LOW — Intent IQ concept but 100% mock |
| 7 | **CoachPerformance.tsx** | HIGH (needs DB migration for staff columns) | LOW — blocked by missing database columns |

---

## QUICK-START: How to Test ANY Enterprise Page

```bash
# 1. Copy a single page from worktree to main
cp .worktrees/enterprise-upgrade/src/pages/AIAdvisor.tsx src/pages/EnterpriseAIAdvisor.tsx

# 2. Fix imports in the copied file (see compatibility sections above)

# 3. Add route to src/main.tsx (lazy import + route path)

# 4. Build test
npm run build

# 5. Run dev server and navigate to the new route
npm run dev
# Visit http://localhost:5173/enterprise-advisor
```

For EnterpriseStrategy specifically:
```bash
# Also copy the service layer
mkdir -p src/services/enterprise
cp .worktrees/enterprise-upgrade/src/services/enterprise/ReconciliationService.ts src/services/enterprise/

# Copy the components
cp .worktrees/enterprise-upgrade/src/components/dashboard/cards/CreativeDNACard.tsx src/components/dashboard/cards/
cp .worktrees/enterprise-upgrade/src/components/dashboard/tables/RevenueGenomeTable.tsx src/components/dashboard/tables/
mkdir -p src/components/dashboard/drawers
cp .worktrees/enterprise-upgrade/src/components/dashboard/drawers/LeadDetailDrawer.tsx src/components/dashboard/drawers/
```

---

*Generated by Senior Architect cross-check | Feb 14, 2026*
