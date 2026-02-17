# Lead Follow-Up Command Center — PRD

## Purpose
Single page where Milos can see EVERY lead's status, who's calling them, what's overdue, 
who needs reassignment, and which leads are going cold. No lead gets buried.

## Data Source Mapping (Spreadsheet Column → Supabase Table.Column)

### Contact Identity
| Spreadsheet Column | DB Source |
|---|---|
| Record ID | contacts.hubspot_contact_id |
| HubSpot Profile Link | `https://app.hubspot.com/contacts/7973797/record/0-1/{hubspot_contact_id}` |
| First/Last/Full Name | contacts.first_name, last_name |
| Email | contacts.email |
| Phone/Mobile/WhatsApp | contacts.phone, contacts.mobile_phone |
| City/Emirate | contacts.city |

### Ownership & Stage  
| Spreadsheet Column | DB Source |
|---|---|
| Contact Owner | contacts.owner_name |
| Lifecycle Stage | contacts.lifecycle_stage |
| Lead Source | contacts.lead_source OR contacts.utm_source |
| Create Date | contacts.created_at |
| Days Since Created | NOW() - contacts.created_at |

### Call Activity
| Spreadsheet Column | DB Source |
|---|---|
| Call Status | DERIVED: latest call_records.call_status for this contact |
| Last Call Outcome | latest call_records.call_outcome |
| Last Call Date | latest call_records.created_at |
| Last Call Notes | latest call_records.transcription (summary) |
| Total Outgoing Calls | COUNT(call_records) WHERE direction='outbound' |
| Last Activity Date | GREATEST(latest call, latest deal update, latest contact update) |
| Days Since Last Contact | NOW() - last_activity_date |

### Deal Pipeline
| Spreadsheet Column | DB Source |
|---|---|
| Has Deal | EXISTS deals WHERE contact_id = contacts.id |
| Deal Name/Stage/Amount | deals.deal_name, stage, deal_value |
| Deal Created/Close Date | deals.created_at, close_date |
| Days in Current Stage | NOW() - deals.updated_at (approximate) |

### Coach & Assessment  
| Spreadsheet Column | DB Source |
|---|---|
| Assigned Coach | contacts.assigned_coach |
| Assessment Status | assessment_truth_matrix.truth_status |
| Health Score | client_health_scores.health_score |

### Issue Flags (COMPUTED)
| Flag | Logic |
|---|---|
| Missing Coach | lifecycle_stage IN ('customer','opportunity') AND assigned_coach IS NULL |
| Missing Deal | lifecycle_stage NOT IN ('subscriber','lead') AND no associated deal |
| No Calls Made | total_outgoing_calls = 0 |
| Going Cold | days_since_last_contact > 7 AND lifecycle_stage IN ('lead','mql') |
| Overdue Task | has overdue task in HubSpot (need to sync) |

### Priority Scoring (COMPUTED)
| Priority | Criteria |
|---|---|
| 🔥 HIGH (1) | Going cold + has deal > AED 10K, OR overdue callback |
| 🟡 MEDIUM (2) | No calls in 3+ days, OR missing coach with active deal |
| 🟢 LOW (3) | Everything else in lead/mql stage |

## SQL View: `view_lead_follow_up`

```sql
CREATE OR REPLACE VIEW view_lead_follow_up AS
WITH latest_calls AS (
  SELECT DISTINCT ON (caller_number)
    caller_number,
    call_status,
    call_outcome,
    created_at AS last_call_date,
    agent_name AS last_call_agent,
    duration_seconds
  FROM call_records
  ORDER BY caller_number, created_at DESC
),
call_counts AS (
  SELECT 
    caller_number,
    COUNT(*) AS total_calls,
    COUNT(*) FILTER (WHERE call_status = 'answered') AS answered_calls
  FROM call_records
  GROUP BY caller_number
),
latest_deals AS (
  SELECT DISTINCT ON (contact_id)
    contact_id,
    id AS deal_id,
    deal_name,
    stage AS deal_stage,
    deal_value,
    close_date,
    created_at AS deal_created,
    updated_at AS deal_updated
  FROM deals
  WHERE status != 'MERGED_DUPLICATE'
  ORDER BY contact_id, created_at DESC
)
SELECT
  c.id,
  c.hubspot_contact_id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.city,
  c.owner_name AS setter_name,
  c.lifecycle_stage,
  c.lead_source,
  c.utm_source,
  c.utm_campaign,
  c.created_at AS contact_created,
  EXTRACT(DAY FROM NOW() - c.created_at)::int AS days_since_created,
  -- Call data
  lc.call_status AS last_call_status,
  lc.call_outcome AS last_call_outcome,
  lc.last_call_date,
  lc.last_call_agent,
  COALESCE(cc.total_calls, 0) AS total_calls,
  COALESCE(cc.answered_calls, 0) AS answered_calls,
  -- Activity
  GREATEST(lc.last_call_date, ld.deal_updated, c.updated_at) AS last_activity_date,
  EXTRACT(DAY FROM NOW() - GREATEST(lc.last_call_date, ld.deal_updated, c.updated_at))::int AS days_since_last_contact,
  -- Deal
  ld.deal_id IS NOT NULL AS has_deal,
  ld.deal_name,
  ld.deal_stage,
  ld.deal_value,
  ld.close_date,
  ld.deal_created,
  EXTRACT(DAY FROM NOW() - ld.deal_updated)::int AS days_in_deal_stage,
  -- Coach
  c.assigned_coach,
  -- Flags
  (c.lifecycle_stage IN ('customer','opportunity') AND c.assigned_coach IS NULL) AS missing_coach,
  (c.lifecycle_stage NOT IN ('subscriber','lead','other') AND ld.deal_id IS NULL) AS missing_deal,
  (COALESCE(cc.total_calls, 0) = 0) AS no_calls_made,
  (EXTRACT(DAY FROM NOW() - GREATEST(lc.last_call_date, c.updated_at)) > 7 
   AND c.lifecycle_stage IN ('lead','marketingqualifiedlead')) AS going_cold,
  -- Priority
  CASE
    WHEN EXTRACT(DAY FROM NOW() - GREATEST(lc.last_call_date, c.updated_at)) > 7 
         AND ld.deal_value > 10000 THEN 1
    WHEN COALESCE(cc.total_calls, 0) = 0 THEN 1
    WHEN EXTRACT(DAY FROM NOW() - GREATEST(lc.last_call_date, c.updated_at)) > 3 THEN 2
    WHEN c.lifecycle_stage IN ('customer','opportunity') AND c.assigned_coach IS NULL THEN 2
    ELSE 3
  END AS priority_number,
  -- Attribution
  c.attributed_ad_id,
  c.attribution_source
FROM contacts c
LEFT JOIN latest_calls lc ON c.phone = lc.caller_number
LEFT JOIN call_counts cc ON c.phone = cc.caller_number  
LEFT JOIN latest_deals ld ON c.id::text = ld.contact_id
WHERE c.status != 'MERGED_DUPLICATE'
  AND c.lifecycle_stage IN ('lead','marketingqualifiedlead','salesqualifiedlead','opportunity','customer')
ORDER BY priority_number ASC, days_since_last_contact DESC NULLS LAST;
```

## Frontend Page: `/lead-follow-up`

### Layout
1. **Priority Summary Cards** (top row):
   - 🔥 HIGH priority count + "needs immediate action"
   - 🟡 MEDIUM count
   - 🟢 LOW count  
   - Total leads in pipeline
   - Leads going cold (>7d no contact)
   - Missing coach count

2. **Filters** (below cards):
   - By Setter (owner_name dropdown)
   - By Priority (1/2/3)
   - By Lifecycle Stage
   - By Flag (going cold, no calls, missing coach, missing deal)
   - Search by name/email/phone

3. **Lead Table** (main content):
   - Sortable columns matching the spreadsheet
   - Color-coded rows by priority
   - Expandable rows showing call history + deal details
   - Click-to-call phone links
   - Link to HubSpot profile
   - Days since last contact as color-coded badge (green<3d, yellow 3-7d, red >7d)

4. **Setter Accountability Panel** (right sidebar or tab):
   - Per-setter: how many leads assigned, how many called today, how many going cold
   - "No calls in 24h" alert per setter
