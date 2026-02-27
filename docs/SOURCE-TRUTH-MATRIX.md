# SOURCE TRUTH MATRIX (Research-Only)

Date: 2026-02-27
Mode: Research-first (no code fixes in this phase)

## Method
1. Parsed route map from `src/main.tsx`.
2. Parsed left-nav from `src/components/Navigation.tsx`.
3. Scanned route component files for source signals:
   - Supabase `from/rpc/functions.invoke`
   - HubSpot markers (`hubspot`, `hs_`)
   - Call markers (`callgear`, call objects)
   - Meta markers (`meta`, `facebook`, campaign/adset terms)
   - AWS markers (`training_sessions_live`, `client_packages_live`, `rds`, `aws`)
4. Correlated with runtime history signatures from `reports/systematic-debug-history-findings.md`.

## Global Source Hierarchy (Approved)
1. AWS (read-only): clients/coaches/sessions/activity/health base truth
2. CallGear: call event/status truth (cross-check to HubSpot)
3. HubSpot: lead/contact/deal workflow truth
4. Meta Ads MCP: ad platform truth (spend/performance)
5. Supabase: canonical serving/computed layer for UI

Conflict rule:
- Event truth (session/call event) > CRM workflow state > UI cache convenience.

---

## Research Findings (High-Confidence)

### A) Recurring failure signatures (10-day history)
- `toFixed` runtime family: 218
- Auth/401 family: 157
- Missing-column/42703 family: 108
- Wrong cancel-status logic family: 102
- SIGTERM/SIGKILL execution instability: 49
- `snapshot_date` null family: 46

### B) Route/source scan coverage
- Scanned routes: 37
- Highest mixed-source pages:
  - `/marketing` (HubSpot + Meta + Supabase function + AWS-derived values)
  - `/command-center` (Supabase + RPC + Meta markers)
  - `/calls` (call-heavy + AWS markers + Supabase)
  - `/sales-pipeline` (HubSpot-heavy + Meta markers + AWS markers)

### C) Navigation/route wiring observations
- `/lead-follow-up` -> redirects to `/lead-tracking`
- `/attribution-leaks-detail` -> redirects to `/marketing`
- `/workflow-strategy` -> redirects to `/command-center`

These redirects are intentional but can hide source ownership if not explicitly labeled in UI.

---

## Tab Source Matrix (Current + Target)

| Tab | Current Source Pattern (Observed) | Required Source-of-Truth (Target) | Confidence |
|---|---|---|---|
| AI Intelligence (`/intelligence`) | Supabase + mixed marketing markers | AWS-derived coach/client health + Supabase computed insights | Medium |
| Command Center (`/command-center`) | Supabase + RPC + marketing markers | Supabase computed from AWS+HubSpot+Meta+CallGear marts | High |
| Marketing (`/marketing`) | Supabase + Meta + HubSpot markers + runtime crash history | Meta MCP + HubSpot + attribution marts (null-safe rendering) | High |
| Pipeline (`/sales-pipeline`) | Supabase + HubSpot markers | HubSpot lifecycle truth + CallGear cross-check | High |
| Revenue (`/revenue`) | Supabase function + HubSpot markers | Stripe + closed-won HubSpot + package linkage | Medium |
| Attribution (`/attribution`) | Uses Marketing page route | Meta/HubSpot attribution reconciliation mart | High |
| Clients (`/clients`) | Supabase table reads | AWS client/session health + HubSpot enrichment fields | Medium |
| Coaches (`/coaches`) | Supabase table reads + AWS markers | AWS activity truth + GPS verification + trust layer | High |
| Risks (`/interventions`) | Supabase | Computed interventions from AWS+HubSpot signals | Medium |
| AI Brain (`/global-brain`) | Supabase/memory signals | Computed knowledge layer (not source-of-record) | Medium |
| AI Advisor (`/ai-advisor`) | Function invoke | Advisory layer over canonical marts | Medium |
| Daily Ops (`/daily-ops`) | Snapshot-based (null history) | Supabase ops snapshots from canonical marts | High |
| Client Activity (`/client-activity`) | Supabase list + AWS markers | AWS sessions primary, HubSpot notes secondary | Medium |
| Predictions (`/predictions`) | Supabase predictions | Canonical prediction pipeline using AWS activity truth | Medium |
| Alert Center (`/alert-center`) | Supabase queries | Rule engine over canonical marts with freshness | Medium |
| Coach GPS (`/coach-locations`) | Supabase `mdm_*` pipeline | TinyMDM-derived truth + session crosscheck | High |
| Meta Ads (`/meta-ads`) | Meta components | Meta MCP truth | High |
| Lead Tracking (`/lead-tracking`) | Supabase + lead tables | HubSpot lead/contact/deal truth | High |
| Lead Follow-Up (`/lead-follow-up`) | Redirect -> lead-tracking | HubSpot + call cadence SLA + WhatsApp context | High |
| Attribution Leaks (`/attribution-leaks-detail`) | Redirect -> marketing | Attribution reconciliation view | High |
| Workflow Strategy (`/workflow-strategy`) | Redirect -> command-center | HubSpot workflow effectiveness + outcomes | Medium |
| Sales Tracker (`/sales-tracker`) | Mixed (HubSpot + AWS markers) | HubSpot closed-won + coach activity from AWS | High |
| Call Analytics (`/calls`) | call-heavy + mixed | CallGear event truth + HubSpot call outcome | High |
| Setter Command (`/setter-command-center`) | call + contacts + delegation | HubSpot + CallGear + owner integrity | High |
| Skills (`/skills`) | Internal orchestration | Internal only (not business source tab) | High |
| War Room (`/war-room`) | function invokes | Aggregated escalation layer | Medium |
| Audit Trail (`/audit`) | function + HubSpot markers | Immutable operational event trail | Medium |
| Strategy (`/enterprise/strategy`) | enterprise computed | Business intelligence over canonical marts | Medium |
| Call Deep Dive (`/enterprise/call-analytics`) | enterprise call page | CallGear + HubSpot joined call quality | High |
| System Health (`/enterprise/observability`) | observability page | Runtime + sync health + pipeline freshness | High |
| Health Detail (`/enterprise/client-health`) | enterprise health page | AWS-derived health score canonical view | High |
| Coach Stats (`/enterprise/coach-performance`) | enterprise coach page | AWS session performance + GPS trust + call outcomes | High |
| Knowledge Base (`/enterprise/knowledge-base`) | static/knowledge | Documentation layer only | High |

---

## Most Effective Wiring to Finish (Research Recommendation)

### Canonical marts (Supabase)
1. `mart_health_client_daily` (AWS only)
2. `mart_health_coach_daily` (AWS + GPS verification)
3. `mart_lead_lifecycle_daily` (HubSpot + CallGear cross-check)
4. `mart_marketing_daily` (Meta + HubSpot attribution)
5. `mart_revenue_daily` (Stripe + closed-won)
6. `mart_ops_snapshot_daily` (single source for Command Center/Daily Ops)

### Why this is effective
- Removes per-page ad-hoc joins
- Makes source ownership explicit
- Cuts repeated runtime null/type crashes
- Enables freshness SLA + source badge per card

---

## Immediate Research-Validated Priorities
P0
1. Marketing runtime safety (`toFixed` family) and missing data guards
2. Daily Ops snapshot contract (`snapshot_date` null family)
3. Health contract alignment to canonical fields (42703 family)

P1
4. CallGear↔HubSpot call outcomes reconciliation in calls/sales tabs
5. Lead-tracking contract completeness (owner/status/deal linkage)

P2
6. Source badges + freshness stamps on all critical widgets
7. Redirect-tab ownership labels (Lead Follow-Up / Attribution Leaks / Workflow Strategy)

---

## Evidence References
- `docs/source-scan-routes.json`
- `reports/systematic-debug-history-findings.md`
- `src/main.tsx`
- `src/components/Navigation.tsx`
