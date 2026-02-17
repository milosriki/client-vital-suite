# CVS Design Audit — Complete Page-by-Page Truth Map

Generated: 2026-02-17 by CRAW (Opus 4.6)

## Page Inventory: 44 Routes → 37 Unique Components

### Deduplication (7 routes are aliases):
- `/meta-dashboard` → MarketingIntelligence (alias)
- `/attribution-leaks` → MarketingIntelligence (alias)
- `/attribution` → MarketingIntelligence (alias)
- `/marketing-intelligence` → MarketingIntelligence (alias)
- `/deep-intel` → MarketingIntelligence (alias)
- `/dashboard` → ExecutiveOverview (alias)
- `/` (index) → ExecutiveOverview (alias)

### 37 Unique Pages — Full Audit

| # | Route | Component | Lines | Queries | Loading | Contrast Issues | Data Status | Domain |
|---|-------|-----------|-------|---------|---------|----------------|-------------|--------|
| 1 | `/` | ExecutiveOverview | 396 | 2 | ✅ 22 | 2 | ✅ Real data | LANDING |
| 2 | `/revenue` | RevenueIntelligence | 711 | 4 | ⚠️ 3 | 10 | ✅ Real | 💰 Revenue |
| 3 | `/sales-pipeline` | SalesPipeline | 606 | 18 | ⚠️ 3 | 6 | ✅ Real (SLOW: 18 queries) | 💰 Revenue |
| 4 | `/stripe` | StripeIntelligence | 405 | 0+hook | ⚠️ 5 | 2 | ✅ Real via useStripeTransactions | 💰 Revenue |
| 5 | `/money-map` | CampaignMoneyMap | 171 | 4 | ⚠️ 3 | 4 | ✅ Real | 💰 Revenue |
| 6 | `/reconciliation` | ReconciliationDashboard | 268 | 6 | ⚠️ 2 | 5 | ✅ Real | 💰 Revenue |
| 7 | `/yesterday-bookings` | YesterdayBookings | 368 | 3 | ⚠️ 3 | 13 | ✅ Real | 💰 Revenue |
| 8 | `/marketing` | MarketingIntelligence | 1155 | 5 | ✅ 20 | **67** ⛔ | ✅ Real (WORST contrast) | 📢 Marketing |
| 9 | `/command-center` | CommandCenter | 1108 | 16 | ✅ 21 | **28** ⛔ | ✅ Real (SLOW: 16 queries) | 📢 Marketing |
| 10 | `/hubspot-analyzer` | HubSpotAnalyzer | 150 | 5 | ✅ 8 | 0 | ✅ Real | 📢 Marketing |
| 11 | `/hubspot-live` | HubSpotLiveData | 112 | 2 | ⚠️ 3 | 1 | ✅ Real | 📢 Marketing |
| 12 | `/call-tracking` | CallTracking | 368 | 5 | ✅ 7 | 11 | ✅ Real | 📢 Marketing |
| 13 | `/setter-activity-today` | SetterActivityToday | 376 | 5 | ⚠️ 5 | **18** ⛔ | ✅ Real | 📢 Marketing |
| 14 | `/sales-coach-tracker` | SalesCoachTracker | 504 | 7 | ✅ 10 | 14 | ✅ Real (was broken, FIXED) | 📢 Marketing |
| 15 | `/overview` | Overview | 759 | 7 | ✅ 13 | 7 | ✅ Real | 👥 Clients |
| 16 | `/clients` | Clients | 185 | 0+hook | ⚠️ 4 | 4 | ✅ Real via useClientHealthScores | 👥 Clients |
| 17 | `/clients/:email` | ClientDetail | 627 | 4 | ✅ 13 | **32** ⛔ | ✅ Real | 👥 Clients |
| 18 | `/coaches` | Coaches | 150 | 4 | ⚠️ 4 | 5 | ✅ Real | 👥 Clients |
| 19 | `/interventions` | Interventions | 416 | 3 | ⚠️ 4 | 13 | ✅ Real | 👥 Clients |
| 20 | `/leaderboard` | TeamLeaderboard | 264 | 3 | ⚠️ 3 | 4 | ✅ Real | 👥 Clients |
| 21 | `/executive-dashboard` | ExecutiveDashboard | 518 | 8 | ⚠️ 2 | 7 | ✅ Real | 🧠 Intel |
| 22 | `/ai-advisor` | AIBusinessAdvisor | 240 | 4 | ⚠️ 3 | 4 | ⚠️ Needs AI agent call | 🧠 Intel |
| 23 | `/global-brain` | GlobalBrain | 469 | 1 | ✅ 9 | 0 | ⚠️ Depends on agent_memory | 🧠 Intel |
| 24 | `/ai-knowledge` | AIKnowledge | 302 | 4 | ⚠️ 4 | 11 | ⚠️ agent_knowledge (60 rows) | 🧠 Intel |
| 25 | `/ai-learning` | AILearning | 402 | 4 | ✅ 6 | 12 | ⚠️ agent_conversations (64 rows) | 🧠 Intel |
| 26 | `/war-room` | WarRoom | 186 | 3 | ⚠️ 3 | 0 | ✅ Real | 🧠 Intel |
| 27 | `/skills-matrix` | SkillCommandCenter | 649 | 6 | ✅ 15 | 11 | ⚠️ Mostly static/config | 🧠 Intel |
| 28 | `/observability` | Observability | 457 | 1 | ⚠️ 3 | 12 | ⚠️ Mixed real+links | ⚙️ System |
| 29 | `/master-control` | MasterControlPanel | 250 | 2 | ❌ 0 | 4 | ⚠️ Config toggles | ⚙️ System |
| 30 | `/audit-trail` | AuditTrail | 471 | 4 | ✅ 8 | 14 | ✅ Real | ⚙️ System |
| 31 | `/ai-dev` | AIDevConsole | 122 | 0+hook | ⚠️ 2 | 1 | ⚠️ Dev tool | ⚙️ System |
| 32 | `/analytics` | Analytics | 241 | 4 | ✅ 6 | 2 | ✅ Real | ⚙️ System |
| 33 | `/operations` | Operations | 126 | 0 | ❌ 0 | 3 | ❌ EMPTY — no queries | ⚙️ System |
| 34 | `/admin/edge-functions` | EdgeFunctions | ? | ? | ? | ? | ⚠️ Admin only | ⚙️ System |

### Enterprise Pages (7 — ALL duplicate core pages):
| # | Route | Component | Lines | Queries | Contrast | Duplicates |
|---|-------|-----------|-------|---------|----------|-----------|
| 35 | `/enterprise/strategy` | EnterpriseStrategy | 195 | 0+hook | **17** ⛔ | ExecutiveDashboard |
| 36 | `/enterprise/call-analytics` | CallAnalytics | 97 | 0+hook | 3 | CallTracking |
| 37 | `/enterprise/observability` | SystemObservability | 138 | 0+hook | 9 | Observability |
| 38 | `/enterprise/ai-advisor` | AIAdvisor | 213 | 2 | 4 | AIBusinessAdvisor |
| 39 | `/enterprise/client-health` | ClientHealth | 160 | 0+hook | 7 | Overview |
| 40 | `/enterprise/coach-performance` | CoachPerformance | 196 | 0+hook | 5 | Coaches |
| 41 | `/enterprise/knowledge-base` | KnowledgeBase | 175 | 0+hook | 10 | AIKnowledge |

## Critical Findings

### 1. Contrast Emergency (1,134 instances)
Top offenders:
- MarketingIntelligence: **67 low-contrast instances** ⛔
- ClientDetail: **32** ⛔
- CommandCenter: **28** ⛔
- SetterActivityToday: **18** ⛔
- EnterpriseStrategy: **17** ⛔

### 2. Performance Bottlenecks
- SalesPipeline: **18 queries** on mount
- CommandCenter: **16 queries** on mount
- ExecutiveDashboard: **8 queries** on mount

### 3. Missing/Empty Data
- `loss_analysis`: 75 rows exist BUT columns have NULL values (contact_name, loss_reason, deal_value all NULL)
- `historical_baselines`: 3 rows, populated ✅
- `deal_stripe_revenue`: VIEW exists but 0 rows ❌
- `Operations` page: **Zero queries, appears empty**

### 4. Navigation Problems
Current sidebar: 3 groups (COMMERCIAL 7 + OPERATIONS 4 + INTELLIGENCE 5) = 16 visible
Plus 11 overflow items hidden in "System" dropdown = **27 total nav items**
Missing from nav entirely: `/revenue`, `/setter-activity-today`, `/sales-coach-tracker`, all enterprise pages

### 5. Duplicate Pages to Kill
7 enterprise pages duplicate core pages with minor styling differences.
5 marketing aliases all point to MarketingIntelligence.
`/executive-dashboard` overlaps with `/` (ExecutiveOverview).
