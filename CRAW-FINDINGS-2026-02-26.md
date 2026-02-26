# CRAW Findings — Feb 26, 2026
# Claude Code: READ THIS FIRST before any work

## Critical Bug Fixed: Dashboard Shows "Never" for All Clients

**Root Cause**: `client_packages_live` had ALL 5,270 rows with `last_coach = NULL`, `last_session_date = NULL`, `sessions_per_week = 0`, `future_booked = 0`. The sync bridge (`scripts/aws-sync-bridge.cjs`) copied packages from AWS but never enriched them with session data.

**Fix Applied**: Added `enrichPackages()` function to sync bridge (commit `3ed6713`). After package sync, it queries AWS RDS for last completed session per client and PATCHes the columns. 2,425 packages enriched, 0 errors.

**Dashboard Impact**:
- "Last Session: Never" → Now shows real dates
- "Inactive" badge on everyone → Now correctly shows Active/Inactive
- Priority = LOW for 76% churn → Still needs fix (priority only checks depletion, NOT churn risk)

**Remaining UI Fix Needed**: In `src/pages/Coaches.tsx`:
- Line ~365: `depletion_priority` only considers sessions remaining / sessions_per_week
- Should ALSO factor in `churn_score` — if churn > 60%, priority should be HIGH minimum
- Line ~330: `is_active` = `remaining > 0 && daysSince < 60` — correct now that `last_session_date` is populated

---

## AWS Cancel Status Discovery

AWS has NO plain "Cancelled" status. Real statuses:
- `Completed` (83,035 all-time)
- `Cancelled-Rebooked` (29,431) — **NOT a real cancel**
- `Cancelled-Trainer Not Charged` (3,688) — real cancel
- `Cancelled-Trainer Charged` (2,747) — **WORST** (coach cancelled)
- `Cancelled-Client is not Charged` (1,640) — real cancel
- `Cancelled-Client is Charged` (370) — revenue impact

**Code using wrong filter**: Any code filtering `status = 'Cancelled'` will return ZERO rows. Must use:
```sql
status LIKE 'Cancelled-%' AND status != 'Cancelled-Rebooked'
```

**Key coach findings**:
- Vukasin Dizdar: ALL 36 cancels are "Trainer Charged" (HE cancels)
- Daniel James: ALL 20 cancels are "Trainer Charged"
- Nicolas Mercado: 25 cancels but ZERO trainer-charged (clients cancel)

---

## AWS View Mapping (Use PowerBI Views for Richer Data)

### Scheduler Views (same 123,681 rows, different columns):

| View | Unique Columns | Use For |
|------|---------------|---------|
| `vw_schedulers` (current) | `session_id`, `session_type`, `training_date_utc` | Basic session data |
| `vw_powerbi_schedulers` | + `base_value`, `price_for_comission`, `client_review_trainer`, `email`, `origin`, `workout`, `virtual_training` | **SWITCH TO THIS** |
| `vw_powerbi_schedulers_full` | Same as above minus `virtual_training`, `rejected_by_client_date` | Alternative |

### Package Views:

| View | Unique Columns |
|------|---------------|
| `vw_client_packages` (current) | `package_code`, `expiry_date_utc`, `settlement_date_utc` |
| `vw_powerbi_clientpackages` | + `base_value`, `status`, `paymentprovider`, `settlement`, `installment`, `purchase_origin`, `promo_reference_price`, `vatvalue`, `phone_namber` |

### Client Views:

| View | Unique Columns |
|------|---------------|
| `vw_client_master` (current) | `phone_number`, `city`, `country` |
| `vw_powerbi_clients` | + `birthdate`, `gender`, `nationality`, `height`, `weight`, `injury`, `goals`, `marketing_campaign`, `app_version`, `membership_type` |

**RECOMMENDATION**: Switch sync bridge to PowerBI views. Same rows, much richer data. Zero extra cost.

---

## Company Metrics (AWS Verified, Feb 26)

### Portfolio
- 21,363 total clients in master
- 1,526 active packages, 12,914 sessions remaining
- AED 11,358,499 total portfolio
- 209 active clients (trained in 30d)
- 28 SLOWING (trained 30d ago, not 14d) — AED 417K early warning
- 960 FROZEN (>60d) — AED 8.5M (mostly legacy write-offs)

### Activity (MTD Feb)
- 236 clients completed sessions this month
- 1,366 completed sessions MTD
- 925 clients have ACTIVE packages but ZERO sessions this month

### Cancel Rates (real cancels, excl rebooked)
- Company: 15.3% (296 real / 1,643 completed)
- Worst: Igor 97.7%, Vukasin 58.1%, Wissal 30%, Zouheir 26.8%, Nicolas 25.3%
- Best: Nazanin 0%, Marko 1.5%, Nemanja G 2.1%

### Commission Structure
- Tiered slabs: AED 20-400/session based on volume
- Base salary: AED 8,500/month
- Last full data: Jan 2025 (AED 274,685 total payroll)

### Team Structure (6 leaders, 33 active coaches)
- Filip Tomic (13): Nicolas, Sladjan, Zouheir, Max, Medya, Miljan, Zaid, Wissal +5
- Nevena Antonijevic (6): Darko, Jackson, Marina, Marko, Shohre, Menna
- Sanja Spasić (6): Danni, Matt, Natasha×2, Nemanja, Abigail
- Tea Vukovic (3): Ksenia, Nazanin, Sanja
- Dimitrije Milovanovic (1): Vukasin Dizdar
- Boris Lilic (1): Daniel Herbert

---

## Untapped Data Sources in AWS

1. **80K client reviews** (`vw_powerbi_client_reviews`) — star ratings 1-5, all coaches 4.75-5.00
2. **Session pricing** (`vw_powerbi_schedulers_full.base_value`) — per-session AED
3. **Commission data** (`pbi_commission_summary`) — targets, actuals, CBIR
4. **Demographics** (`vw_powerbi_clients`) — age, gender, goals, marketing_campaign
5. **169 active subscriptions** (`vw_powerbi_active_subscriptions`) — recurring billing
6. **10,030 subscription history** records
7. **66K initial consultations** (`initial_consultation`)
8. **86K loyalty transactions** (`vw_powerbi_loyalty_transactions`)
9. **217 session GPS addresses** (`scheduler_log_address`)

---

## RDS Connection Details

```
Host: ptd-prod-replica-1.c5626gic29ju.me-central-1.rds.amazonaws.com
Port: 5432
Database: ptd
Schema: enhancesch

User 1: ptd-milos / tiM6s1uzuspOsipr (backoffice)
User 2: 4revops / vakiphetH1qospuS (PowerBI)
Both have IDENTICAL read-only access.

Use pg module with separate params (NOT connection string — password has trailing @):
{ host, port, database, user, password, ssl: { rejectUnauthorized: false } }
```

---

## Health Score v3 Proposal

Current v2: Recency + Frequency + Consistency + Package + Engagement = 100pts

Proposed v3 (with PowerBI data):
- Recency (20) — days since last completed
- Frequency (20) — sessions/week vs plan
- Consistency (15) — trend 14d vs prior 14d
- Package Health (10) — remaining vs expiry
- Engagement (10) — future bookings
- Satisfaction (10) — avg review rating ⭐ NEW
- Revenue Value (10) — session price tier NEW
- Demographic Risk (5) — age/gender churn correlation NEW

---

## Files Modified Today

- `scripts/aws-sync-bridge.cjs` — Added enrichPackages() function (commit `3ed6713`)
- Sync bridge now: sessions → packages → enrichment (83s total)
- 20-concurrent PATCH for speed

## TODO for Claude Code

1. Fix priority in `src/pages/Coaches.tsx` to include churn risk (not just depletion)
2. Switch sync bridge to use PowerBI views (richer columns)
3. Build Health Score v3 with satisfaction + pricing data
4. Sync client reviews to Supabase (new table `client_reviews`)
5. Sync client demographics to Supabase (enrich `clients_full` or new table)
6. Fix cancel rate calculations everywhere to use correct status filters
