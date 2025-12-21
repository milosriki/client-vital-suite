# Stripe Forensics Gap Analysis & Recommendations

## Executive Summary

This document analyzes the current custom Stripe forensics implementation, compares it against Stripe's recommended best practices, identifies gaps, and provides actionable recommendations for a production-ready forensic audit system.

---

## 1. Current Implementation Analysis

### 1.1 What Was Built

**Main Function:** `supabase/functions/stripe-forensics/index.ts` (1,084 lines)

**Actions Supported:**
- `full-audit` - 30-day comprehensive audit
- `complete-intelligence` - Full money flow analysis with all Stripe products
- `money-flow` - Simplified money flow tracking
- `events-timeline` - Event history analysis

**Detection Capabilities:**

1. **Anomaly Detection:**
   - Instant payouts detection (flags all instant payouts as high risk)
   - Card transfers (debit card vs bank account payouts)
   - Payout velocity (>3 payouts/day flagged)
   - High payout ratio (>80% of revenue)
   - Open disputes tracking

2. **Forensic Checks:**
   - **Shadow Admin Detection** - Checks `account.controller.is_controller`
   - **Manual Capability Approval** - Detects manual API activations via events
   - **Application Fee Skimming** - Finds `application_fee_amount` on charges
   - **Transfer Money Redirect** - Detects `transfer_data.destination` routing

3. **Data Collection:**
   - Balance, payouts, charges, refunds, transfers
   - Issuing cards, cardholders, transactions
   - Treasury financial accounts and transactions
   - Terminal devices and configurations
   - Cash balances (limited to 20 customers)
   - Webhook endpoints (limited to 100)
   - Events (7 days only)
   - Disputes (all, no date filter)

**Integration Points:**
- UI: `StripeForensicsTab.tsx`, `StripeCompleteIntelligence.tsx`, `StripeMoneyFlowTab.tsx`
- AI Agents: `smart-agent`, `ptd-agent-gemini`, `ptd-agent-claude`
- Pages: `PTDControl.tsx`, `StripeIntelligence.tsx`

### 1.2 Current Risks & Limitations

**Critical Issues:**

1. **API Rate Limits:**
   - Makes 10+ parallel API calls per request
   - Stripe limit: 100 requests/second per API key
   - Risk of hitting rate limits and getting throttled

2. **Timeout Risk:**
   - `fetchAllStripe` paginates through ALL records
   - No timeout handling
   - Supabase Edge Functions timeout: ~60 seconds
   - Large accounts will exceed timeout

3. **Silent Failures:**
   - All API calls use `.catch(() => null)` or `.catch(() => ({ data: [] }))`
   - Errors are swallowed without logging
   - Returns incomplete data without warning
   - Could hide critical security issues

4. **Incomplete Data:**
   - Events: Only 7 days (line 1008)
   - Customers: Only recent ones (line 1011)
   - Disputes: No date filter - fetches ALL disputes ever (line 1012)
   - Webhooks: Limited to 100 (line 1009)

5. **False Positives:**
   - Instant payouts flagged as "high risk" - many legitimate businesses use them
   - >3 payouts/day flagged - high-volume businesses may legitimately need this
   - 80% payout ratio - some businesses operate on thin margins legitimately
   - No context about business model or normal patterns

6. **Missing Critical Checks:**
   - No Radar risk score analysis
   - No webhook signature verification enforcement
   - No API key permission checks
   - No team member access logs
   - No IP address whitelisting checks
   - No 2FA status verification
   - No account verification status checks

---

## 2. Stripe's Recommended Best Practices

### 2.1 Stripe Radar (Built-in Fraud Detection)

**What Stripe Recommends:**
- Use **Stripe Radar** for ML-powered fraud detection
- Radar provides risk scores (`charge.outcome.risk_score`) on every charge
- Radar learns from your business patterns
- No custom code needed - works automatically

**Current Gap:**
- Code reads `charge.outcome?.risk_score` but doesn't use it for detection
- Relies on custom heuristics instead of Radar's ML models
- Missing Radar rules configuration

### 2.2 Webhook-Based Event Monitoring

**What Stripe Recommends:**
- Use **webhooks** for real-time event monitoring
- Verify webhook signatures using `STRIPE_WEBHOOK_SECRET`
- Store all events in your database for audit trail
- React to events in real-time (not batch polling)

**Current Implementation:**
- ✅ `stripe-webhook` function exists and stores events
- ⚠️ Webhook signature verification is optional (line 49-52)
- ⚠️ Uses batch polling (`full-audit`) instead of event-driven
- ⚠️ Events only stored for 7 days in forensics function

**Gap:**
- Should rely on webhook events (already stored) instead of polling API
- Missing signature verification enforcement
- No real-time alerting on webhook events

### 2.3 Stripe Dashboard & Logs

**What Stripe Recommends:**
- Use **Stripe Dashboard** for comprehensive audit logs
- Dashboard > Developers > Logs shows all API requests with IP addresses
- Dashboard > Settings > Team shows team member access
- Dashboard provides complete financial reconciliation

**Current Gap:**
- Code attempts to replicate Dashboard functionality
- Missing IP address tracking (not available via API)
- Missing team member access logs (not available via API)
- Dashboard is more accurate and complete

### 2.4 Stripe Sigma (SQL Analytics)

**What Stripe Recommends:**
- Use **Stripe Sigma** for SQL-based analytics and reporting
- Write custom SQL queries against Stripe data
- No API rate limits
- Pre-built fraud detection queries available

**Current Gap:**
- No Sigma integration
- Relies on API polling instead of SQL queries
- Missing pre-built fraud detection queries

### 2.5 Audit Logs & Compliance

**What Stripe Recommends:**
- Maintain **immutable audit logs** of all sensitive actions
- Log: logins, permission changes, API key generation, refunds, settings updates
- Retain logs for **several years** for regulatory compliance
- Provide simple export/sync methods

**Current Gap:**
- Events stored but not immutable
- No retention policy
- No export functionality
- Missing many sensitive action types

### 2.6 Real-Time Monitoring & Alerts

**What Stripe Recommends:**
- Implement **configurable alerts** for anomalies:
  - Surges in chargebacks
  - Unusual clusters of declines
  - Upward trends in API error rates
- Use webhooks for real-time notifications

**Current Gap:**
- No alerting system
- No configurable thresholds
- Batch processing only (not real-time)

---

## 3. Open Source Alternatives

### 3.1 FlossPay (Enterprise Payments Aggregator)

**What It Is:**
- Open-source payments aggregator designed for "immutable reliability and forensic auditability"
- Implements idempotency, distributed retries, circuit-breaker mechanisms
- Rooted in Linux principles

**Relevance:**
- ⚠️ **Not Stripe-specific** - designed for general payment aggregation
- ⚠️ **Different use case** - focuses on payment processing, not forensic auditing
- ❌ **Not suitable** for Stripe forensics

**Verdict:** Not applicable to Stripe forensics use case

### 3.2 Open Computer Forensics Architecture (OCFA)

**What It Is:**
- Distributed open-source computer forensics framework
- Used for analyzing digital media in forensics labs
- Last updated: 2015 (outdated)

**Relevance:**
- ⚠️ **Not payment-specific** - general computer forensics
- ⚠️ **Outdated** - last updated 9 years ago
- ❌ **Not suitable** for Stripe forensics

**Verdict:** Not applicable to Stripe forensics use case

### 3.3 Event-Driven Architecture Patterns

**Open-Source Patterns Available:**

1. **Webhook Event Ingestion:**
   - Use existing `stripe-webhook` function ✅
   - Store events in Supabase ✅
   - Build queries on stored events (not API polling)

2. **Time-Series Database:**
   - Use TimescaleDB (PostgreSQL extension) for event storage
   - Better for time-series queries
   - Open-source and available

3. **SQL-Based Analytics:**
   - Use Supabase SQL functions for analysis
   - Query stored events instead of API polling
   - No rate limits

**Verdict:** Use existing infrastructure (Supabase + webhooks) instead of custom API polling

---

## 4. Gap Analysis Summary

| Feature | Current Implementation | Stripe Recommendation | Gap Severity |
|---------|----------------------|----------------------|--------------|
| Fraud Detection | Custom heuristics | Stripe Radar (ML) | 🔴 Critical |
| Event Monitoring | Batch API polling | Webhook events | 🔴 Critical |
| Webhook Verification | Optional | Required | 🟠 High |
| Audit Logs | Partial (7 days) | Complete + Immutable | 🟠 High |
| Real-Time Alerts | None | Configurable alerts | 🟠 High |
| Financial Reconciliation | Custom calculations | Stripe Dashboard | 🟡 Medium |
| SQL Analytics | None | Stripe Sigma | 🟡 Medium |
| Rate Limit Handling | None | Proper pagination/timeouts | 🔴 Critical |
| Error Handling | Silent failures | Proper logging | 🔴 Critical |
| IP Tracking | Not available via API | Dashboard Logs | 🟢 Low (API limitation) |
| Team Access Logs | Not available via API | Dashboard | 🟢 Low (API limitation) |

---

## 5. Recommendations

### 5.1 Immediate Actions (Keep/Deprecate/Replace)

#### ✅ **KEEP:**
1. **`stripe-webhook` function** - This is the correct approach
   - Already stores events in database
   - Real-time event processing
   - Add signature verification enforcement

2. **Event storage in Supabase** - Good foundation
   - `stripe_events` table exists
   - Can build queries on this data
   - No API rate limits

3. **UI Components** - Can be repurposed
   - `StripeForensicsTab.tsx` - Display webhook-based data
   - `StripeMoneyFlowTab.tsx` - Query stored events
   - Remove API polling, use database queries

#### ⚠️ **DEPRECATE:**
1. **`stripe-forensics` function** - Replace with webhook-based approach
   - Mark as deprecated
   - Keep for migration period
   - Redirect to webhook-based queries

2. **Batch polling actions** (`full-audit`, `complete-intelligence`)
   - Replace with SQL queries on stored events
   - No API rate limit risk
   - Faster and more reliable

#### ❌ **REPLACE:**
1. **Custom fraud detection** → **Stripe Radar**
   - Use Radar risk scores from charges
   - Configure Radar rules in Dashboard
   - Remove custom heuristics

2. **API polling** → **Webhook events + SQL queries**
   - Query `stripe_events` table instead of API
   - Build money flow from stored events
   - No rate limits, faster

### 5.2 Minimal Supportable Forensic Flow

**Architecture:**

```
Stripe Events → Webhook (with signature verification) → Supabase Events Table → SQL Queries → UI Dashboard
```

**Components:**

1. **Webhook Receiver** (`stripe-webhook`):
   - ✅ Verify webhook signatures (enforce, don't make optional)
   - ✅ Store all events in `stripe_events` table
   - ✅ Trigger real-time alerts on critical events
   - ✅ Store events indefinitely (for compliance)

2. **SQL-Based Analytics** (New Supabase functions):
   - Query `stripe_events` table for money flow
   - Calculate anomalies from stored events
   - No API calls, no rate limits
   - Use PostgreSQL window functions for time-series analysis

3. **Real-Time Alerts** (New):
   - Monitor `stripe_events` table for critical events
   - Alert on: instant payouts, failed payouts, account changes
   - Use Supabase Realtime or webhooks to trigger alerts

4. **Dashboard Integration**:
   - Use Stripe Dashboard for:
     - IP address tracking (not available via API)
     - Team member access logs (not available via API)
     - Complete financial reconciliation
   - Use custom dashboard for:
     - Money flow visualization (from stored events)
     - Anomaly detection (from SQL queries)
     - Real-time alerts

### 5.3 Implementation Steps

**Phase 1: Fix Webhook (Week 1)**
1. Enforce webhook signature verification in `stripe-webhook`
2. Ensure all Stripe events are subscribed and stored
3. Add event retention policy (keep indefinitely)

**Phase 2: Build SQL Queries (Week 2)**
1. Create Supabase SQL functions for:
   - Money flow calculation (from `stripe_events`)
   - Anomaly detection (from stored events)
   - Payout analysis (from stored events)
2. Replace API polling with SQL queries

**Phase 3: Add Real-Time Alerts (Week 3)**
1. Create alert system based on `stripe_events` table
2. Configure thresholds for:
   - Instant payouts
   - Failed payouts
   - Account changes
   - High-risk charges (Radar score > 60)

**Phase 4: Update UI (Week 4)**
1. Update `StripeForensicsTab` to use SQL queries
2. Remove API polling calls
3. Add real-time alert display
4. Link to Stripe Dashboard for IP/team logs

**Phase 5: Deprecate Old Function (Week 5)**
1. Mark `stripe-forensics` as deprecated
2. Add migration guide
3. Remove from production after 30 days

### 5.4 What to Use Instead

**For Fraud Detection:**
- ✅ **Stripe Radar** - Built-in ML fraud detection
- ✅ **Radar Rules** - Configure in Dashboard
- ✅ **Radar Risk Scores** - Use `charge.outcome.risk_score` from stored events

**For Event Monitoring:**
- ✅ **Webhook Events** - Real-time, stored in Supabase
- ✅ **SQL Queries** - Query stored events, no API limits
- ✅ **Supabase Realtime** - Real-time updates to UI

**For Audit Logs:**
- ✅ **Stripe Dashboard** - Complete audit trail with IP addresses
- ✅ **Stored Events** - Your own audit log in Supabase
- ✅ **Export Functionality** - SQL queries to export data

**For Financial Reconciliation:**
- ✅ **Stripe Dashboard** - Most accurate
- ✅ **Balance Transactions API** - For programmatic access (if needed)
- ✅ **Stored Events** - For custom reporting

**For Analytics:**
- ✅ **Stripe Sigma** - SQL queries against Stripe data (if available)
- ✅ **Supabase SQL** - Query stored events
- ✅ **Custom Dashboards** - Build on stored events

---

## 6. Conclusion

**Current State:**
- Custom forensics system with good intentions but critical flaws
- API rate limit risks, timeout issues, silent failures
- Missing Stripe's recommended best practices

**Recommended Path:**
1. **Use Stripe Radar** for fraud detection (not custom heuristics)
2. **Use webhook events** for monitoring (not API polling)
3. **Use SQL queries** for analytics (not API calls)
4. **Use Stripe Dashboard** for audit logs (not custom code)
5. **Build real-time alerts** on stored events

**No Open-Source Replacement Needed:**
- Stripe provides all necessary tools (Radar, webhooks, Dashboard, Sigma)
- Use existing infrastructure (Supabase + webhooks)
- Build SQL-based analytics on stored events

**Key Takeaway:**
The current custom forensics system attempts to replicate what Stripe already provides better. Instead of building custom fraud detection, use Stripe Radar. Instead of API polling, use webhook events. Instead of custom calculations, use SQL queries on stored events.


