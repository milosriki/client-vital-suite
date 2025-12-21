# Facebook & Google → HubSpot → Supabase Data Alignment Report

## Data Flow Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Facebook Ads   │     │   Google Ads    │     │  Other Sources  │
│  (Lead Forms)   │     │  (Lead Forms)   │     │  (Website, etc) │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ UTM params            │ UTM params            │
         │ (fbclid, etc)         │ (gclid, etc)          │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      HubSpot CRM                                │
│  (All leads become "Contacts" with UTM attribution)            │
│  - utm_source: facebook/google/organic                          │
│  - utm_campaign: Campaign name/ID                               │
│  - hs_analytics_source: Traffic source                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Sync (sync-hubspot-to-supabase)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase                                   │
│                                                                 │
│  contacts table (unified schema):                               │
│  - email, first_name, last_name                                 │
│  - lifecycle_stage (lead, mql, sql, opportunity, customer)      │
│  - utm_source, utm_medium, utm_campaign, utm_content, utm_term  │
│  - first_touch_source, last_touch_source                        │
│  - owner_name, lead_status                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Key Points

### 1. Facebook Leads
- **Source**: Facebook Lead Forms or Website with FB Pixel
- **Tracking**: fbclid parameter, UTM parameters
- **In HubSpot**: Stored as Contacts with `utm_source=facebook`
- **In Supabase**: `contacts.utm_source='facebook'`

### 2. Google Ads Leads
- **Source**: Google Lead Forms or Website with Google Ads tracking
- **Tracking**: gclid parameter, UTM parameters
- **In HubSpot**: Stored as Contacts with `utm_source=google` or `googleads`
- **In Supabase**: `contacts.utm_source='google'` or `googleads`

### 3. AnyTrack Events (Click-Level)
- **Purpose**: Tracks clicks BEFORE form submission
- **Data**: `attribution_events` table (source, campaign, fb_campaign_id)
- **Note**: Often has NO email (click happened before lead submitted form)
- **Use**: Match with contacts post-conversion for full funnel view

## Current Status

### ✅ Fixed Issues
1. HubSpot sync now pulls UTM parameters:
   - `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
   - `hs_analytics_first_touch_converting_campaign`
   - `hs_analytics_last_touch_converting_campaign`

2. Unified prompts updated to reflect correct data flow

3. All agents now use `contacts` table (unified schema)

### ⚠️ Remaining Actions Needed
1. **Trigger HubSpot Re-sync**: Run sync to populate UTM fields for existing contacts
2. **Check HubSpot Properties**: Ensure UTM fields are being captured on forms
3. **Test Attribution Flow**: Submit test lead from FB/Google and verify UTM tracking

## SQL Queries for Verification

### Check attribution distribution:
```sql
SELECT 
  COALESCE(utm_source, first_touch_source, 'unknown') as source,
  COUNT(*) as count
FROM contacts 
GROUP BY COALESCE(utm_source, first_touch_source, 'unknown')
ORDER BY count DESC;
```

### Find Facebook leads:
```sql
SELECT email, first_name, utm_source, utm_campaign, created_at
FROM contacts 
WHERE utm_source ILIKE '%facebook%' OR first_touch_source ILIKE '%facebook%'
ORDER BY created_at DESC;
```

### Find Google leads:
```sql
SELECT email, first_name, utm_source, utm_campaign, created_at
FROM contacts 
WHERE utm_source ILIKE '%google%' OR first_touch_source ILIKE '%google%'
ORDER BY created_at DESC;
```

### Match AnyTrack events with contacts:
```sql
SELECT 
  c.email,
  c.utm_source as hubspot_source,
  a.source as anytrack_source,
  a.campaign as anytrack_campaign
FROM contacts c
JOIN attribution_events a ON c.email = a.email
WHERE a.source IN ('facebook', 'googleads');
```

## Unified Data Schema

### Primary Source of Truth: `contacts` table

| Field | Description | Source |
|-------|-------------|--------|
| `email` | Primary identifier | HubSpot |
| `lifecycle_stage` | lead/mql/sql/opportunity/customer | HubSpot |
| `utm_source` | facebook/google/organic | HubSpot (from UTM) |
| `utm_campaign` | Campaign name or ID | HubSpot (from UTM) |
| `first_touch_source` | First traffic source | HubSpot Analytics |
| `owner_name` | Sales rep assigned | HubSpot |

### Click-Level Attribution: `attribution_events` table

| Field | Description | Source |
|-------|-------------|--------|
| `source` | facebook/googleads/anytrack | AnyTrack |
| `campaign` | Campaign ID | AnyTrack |
| `fb_campaign_id` | Facebook Campaign ID | AnyTrack |
| `fb_ad_id` | Facebook Ad ID | AnyTrack |

## Next Steps

1. **Re-sync HubSpot data** to populate UTM fields:
   ```
   POST /functions/v1/sync-hubspot-to-supabase
   { "incremental": false }
   ```

2. **Verify attribution flow** by checking contacts with UTM data

3. **Set up attribution matching** between AnyTrack clicks and HubSpot contacts

4. **Create attribution dashboard** showing leads by source (FB vs Google)

---

**Report Generated**: December 16, 2025
**Status**: Alignment updated, re-sync needed
