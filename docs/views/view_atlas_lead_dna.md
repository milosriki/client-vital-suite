# View: view_atlas_lead_dna

## Overview

**Purpose**: THE core intelligence view that answers "Which Facebook ad made me money?"

**Location**: `supabase/migrations/20260215000002_view_atlas_lead_dna.sql`

**Type**: Analytical View (Non-Materialized)

## Problem Statement

Marketing teams need to trace the full customer journey from ad click to actual revenue:
- Which Facebook ads generate leads?
- Which leads actually pay?
- What's the real ROI per creative, not just lead count?
- Which leads show high intent but haven't converted yet?

Traditional attribution stops at lead generation. This view connects ads → contacts → calls → revenue.

## Architecture

### Data Sources

| Table | Purpose | Join Key |
|-------|---------|----------|
| `facebook_creatives` | Ad creative metadata (copy, image, status) | `ad_id` |
| `contacts` | Lead records | `email` (primary) |
| `attribution_events` | Facebook ad attribution data | `email` → `contacts.email` |
| `call_records` | Call tracking data | `caller_number` → `contacts.phone` |
| `stripe_transactions` | Payment transactions | `customer_id` |
| `known_cards` | **Bridge table** linking Stripe customers to emails | `customer_id` → `stripe_transactions.customer_id`, `customer_email` → `contacts.email` |

### CTE Breakdown

#### 1. `ad_performance`
```sql
SELECT ad_id, creative_name, body AS ad_copy, image_url, status AS ad_status
FROM facebook_creatives
```
**Purpose**: Denormalizes ad creative details for easy access.

#### 2. `lead_journey`
```sql
SELECT DISTINCT ON (c.id) c.id, c.email, c.phone, ae.fb_ad_id, ae.source
FROM contacts c
JOIN attribution_events ae ON lower(ae.email) = lower(c.email)
WHERE ae.fb_ad_id IS NOT NULL
ORDER BY c.id, ae.event_time DESC
```
**Purpose**: Links contacts to Facebook ads via email matching. Uses `DISTINCT ON` to handle multiple attribution events per contact (takes most recent).

**Key Decision**: Case-insensitive email matching via `lower()` functions.

#### 3. `call_intent`
```sql
SELECT caller_number,
       SUM(duration_seconds) AS total_call_duration,
       COUNT(*) AS total_calls
FROM call_records
GROUP BY caller_number
```
**Purpose**: Aggregates call behavior per phone number. Total duration and call count are intent signals.

#### 4. `revenue_truth`
```sql
SELECT lower(kc.customer_email) AS customer_email_lower,
       SUM(st.amount) / 100 AS total_cash_collected
FROM stripe_transactions st
JOIN known_cards kc ON kc.customer_id = st.customer_id
WHERE st.status = 'succeeded'
GROUP BY lower(kc.customer_email)
```
**Purpose**: Links Stripe transactions to emails via the `known_cards` bridge table. Only counts successful payments.

**Critical Pattern**: Stripe uses `customer_id`, but contacts use `email`. The `known_cards` table maps customer_id → customer_email.

## Output Schema

| Column | Type | Description |
|--------|------|-------------|
| `contact_id` | uuid | Contact identifier |
| `full_name` | text | Concatenated first_name + last_name |
| `email` | text | Contact email |
| `city` | text | Contact location |
| `custom_lifecycle_stage` | text | HubSpot lifecycle stage |
| `ad_id` | text | Facebook ad ID that generated this lead |
| `creative_name` | text | Ad creative name |
| `ad_copy` | text | Ad body text |
| `image_url` | text | Ad image URL |
| `call_duration_seconds` | numeric | Total call time (all calls) |
| `call_count` | numeric | Number of calls made |
| `verified_revenue` | numeric | Actual Stripe revenue (in AED, amount/100) |
| `atlas_lead_status` | text | Lead quality classification |

## Lead Status Logic

The `atlas_lead_status` column categorizes leads by intent and revenue:

```sql
CASE
    WHEN ci.total_call_duration > 900 AND COALESCE(rt.total_cash_collected, 0) = 0
      THEN 'High Intent - Pending'        -- Long calls (>15min), no payment yet → follow up!
    WHEN COALESCE(rt.total_cash_collected, 0) > 0
      THEN 'Verified Winner'               -- Lead has paid → true ROI
    WHEN ci.total_call_duration < 60 AND ci.total_calls > 0
      THEN 'Low Intent - Potential Waste' -- Short calls (<1min) → likely wrong number
    ELSE 'Neutral'                        -- Everything else
END
```

**Why these thresholds?**
- **900 seconds (15 minutes)**: Industry standard for "qualified sales conversation"
- **60 seconds (1 minute)**: Typically just ringing or wrong number
- **Revenue > 0**: The ultimate qualifier — they paid

## Performance Optimizations

### Indexes Created

1. **idx_attribution_events_email_lower**
   ```sql
   CREATE INDEX idx_attribution_events_email_lower
   ON attribution_events (lower(email)) WHERE email IS NOT NULL;
   ```
   **Why**: Enables fast case-insensitive email matching in the lead_journey CTE.

2. **idx_known_cards_email_lower**
   ```sql
   CREATE INDEX idx_known_cards_email_lower
   ON known_cards (lower(customer_email)) WHERE customer_email IS NOT NULL;
   ```
   **Why**: Speeds up revenue attribution via email matching.

3. **idx_stripe_txn_succeeded** (Partial Index)
   ```sql
   CREATE INDEX idx_stripe_txn_succeeded
   ON stripe_transactions (customer_id) WHERE status = 'succeeded';
   ```
   **Why**: We only care about successful payments. Partial index is smaller and faster.

### Query Performance

- **View Type**: Non-materialized (computed on-demand)
- **Expected Latency**: <2 seconds for full table scan (10K+ leads)
- **Bottleneck**: The `revenue_truth` CTE (JOIN between stripe_transactions and known_cards)
- **Recommendation**: Consider materializing this view if query frequency > 10/minute

## Use Cases

### 1. True Ad ROI Report
```sql
SELECT
    ad_id,
    creative_name,
    COUNT(*) as lead_count,
    COUNT(*) FILTER (WHERE verified_revenue > 0) as paying_customers,
    ROUND(SUM(verified_revenue), 2) as total_revenue,
    ROUND(AVG(verified_revenue), 2) as avg_revenue_per_lead
FROM view_atlas_lead_dna
GROUP BY ad_id, creative_name
ORDER BY total_revenue DESC;
```

### 2. High-Intent Lead Alerts
```sql
SELECT full_name, email, city, ad_id, call_duration_seconds
FROM view_atlas_lead_dna
WHERE atlas_lead_status = 'High Intent - Pending'
  AND call_duration_seconds > 1200  -- More than 20 minutes
ORDER BY call_duration_seconds DESC;
```

### 3. Ad Wastage Detection
```sql
SELECT
    ad_id,
    creative_name,
    COUNT(*) as low_quality_leads,
    ROUND(AVG(call_duration_seconds), 2) as avg_call_duration
FROM view_atlas_lead_dna
WHERE atlas_lead_status = 'Low Intent - Potential Waste'
GROUP BY ad_id, creative_name
HAVING COUNT(*) > 5
ORDER BY low_quality_leads DESC;
```

### 4. Revenue Attribution by City
```sql
SELECT
    city,
    COUNT(*) as total_leads,
    SUM(verified_revenue) as total_revenue,
    ROUND(SUM(verified_revenue) / NULLIF(COUNT(*), 0), 2) as revenue_per_lead
FROM view_atlas_lead_dna
WHERE verified_revenue > 0
GROUP BY city
ORDER BY total_revenue DESC;
```

## Known Limitations

1. **Email Matching**: Assumes email is the same across all systems. If a customer uses different emails for Facebook vs Stripe, attribution breaks.

2. **Phone Matching**: Call records join on `caller_number`, but if lead calls from a different number, calls won't be attributed.

3. **Multiple Ads per Lead**: Uses `DISTINCT ON` to pick the most recent ad. If a lead interacted with multiple ads before converting, we only credit the last one (last-touch attribution model).

4. **Currency Assumption**: Stripe amounts are divided by 100 (cents → dollars/AED). This assumes all transactions are in the same currency.

5. **Missing Bridge**: If a Stripe customer is not in `known_cards`, their revenue won't be attributed (orphaned revenue).

## Maintenance

### Regular Checks

1. **Missing Attribution**:
   ```sql
   -- Contacts with revenue but no ad attribution
   SELECT COUNT(*)
   FROM contacts c
   JOIN known_cards kc ON lower(kc.customer_email) = lower(c.email)
   JOIN stripe_transactions st ON st.customer_id = kc.customer_id AND st.status = 'succeeded'
   WHERE NOT EXISTS (
       SELECT 1 FROM attribution_events ae WHERE lower(ae.email) = lower(c.email)
   );
   ```

2. **Orphaned Revenue**:
   ```sql
   -- Stripe customers not in known_cards
   SELECT customer_id, COUNT(*), SUM(amount) as orphaned_revenue
   FROM stripe_transactions
   WHERE status = 'succeeded'
     AND customer_id NOT IN (SELECT DISTINCT customer_id FROM known_cards)
   GROUP BY customer_id;
   ```

3. **View Performance**:
   ```sql
   EXPLAIN (ANALYZE, BUFFERS)
   SELECT * FROM view_atlas_lead_dna LIMIT 100;
   ```

### Migration Dependencies

- **Depends on**: `contacts`, `attribution_events`, `facebook_creatives`, `call_records`, `stripe_transactions`, `known_cards` tables
- **Used by**: `attribution_intelligence` tool in `tool-definitions.ts`

## Related Views

- **view_campaign_full_funnel**: Campaign-level aggregation (impressions → clicks → leads → deals)
- **view_truth_triangle**: Monthly Meta/HubSpot/Stripe reconciliation
- **view_enterprise_truth_genome**: Executive-level attribution summary

## Testing

Test file: `supabase/migrations/tests/test_view_atlas_lead_dna.sql`

Run tests:
```bash
psql $DATABASE_URL -f supabase/migrations/tests/test_view_atlas_lead_dna.sql
```

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-02-15 | Claude Opus 4.6 | Initial creation |

## References

- PRD Task: [PRD-INTELLIGENCE-95.md](../../PRD-INTELLIGENCE-95.md) - Task 4
- Migration: [20260215000002_view_atlas_lead_dna.sql](../../supabase/migrations/20260215000002_view_atlas_lead_dna.sql)
- Attribution Pipeline Design: [autonomous-execution-plan.md](../plans/autonomous-execution-plan.md) - Batch 4
