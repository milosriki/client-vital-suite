# 📊 AnyTrack Data Location Report

## ✅ **STATUS: DATA ACTIVE & STORED**

AnyTrack data is **actively being received and stored** in your Supabase database.

---

## 📍 **WHERE ANYTRACK DATA IS STORED**

AnyTrack webhook events are stored in **3 main tables**:

### **1. `events` Table** (Main Event Storage)
**Location:** `public.events`  
**Status:** ✅ **373 events** from AnyTrack currently stored

**Data Stored:**
- `event_id` - Unique event identifier
- `event_name` - Event type (Purchase, Lead, CompleteRegistration, etc.)
- `event_time` - Timestamp of the event
- `source` - Set to `"anytrack"`
- `user_data` - JSONB containing:
  - `em` (email)
  - `ph` (phone)
  - `fn` (first name)
  - `ln` (last name)
  - `external_id` (customer/client ID)
- `custom` - JSONB containing:
  - `value` (conversion value)
  - `currency` (default: AED)
  - `transaction_id`
  - `order_id`
  - `items` (array of items)
  - `source_attribution`, `medium`, `campaign` (attribution data)
  - `gclid`, `fbclid`, `click_id` (tracking IDs)
- `meta` - JSONB containing:
  - `anytrack_asset_id`
  - `integration_id`
  - `tracking_group`
  - `user_agent`, `location`, `brand`
  - `attributions` (array)

**Current Stats:**
- **Total Events:** 373
- **Unique Events:** 373
- **Earliest Event:** 2025-12-12 08:56:55 UTC
- **Latest Event:** 2025-12-14 09:28:30 UTC

**Query Example:**
```sql
SELECT 
  event_id,
  event_name,
  event_time,
  user_data->>'em' as email,
  custom->>'value' as value,
  custom->>'currency' as currency,
  custom->>'source_attribution' as source
FROM events 
WHERE source = 'anytrack'
ORDER BY event_time DESC
LIMIT 10;
```

---

### **2. `attribution_events` Table** (Attribution Tracking)
**Location:** `public.attribution_events`  
**Status:** ✅ **138 attribution events** from AnyTrack currently stored

**Data Stored:**
- `event_id` - Links to `events` table
- `event_name` - Purchase, Lead, CompleteRegistration
- `event_time` - Timestamp
- `email`, `phone`, `first_name`, `last_name` - Contact info
- `value`, `currency` - Conversion value
- `source`, `medium`, `campaign` - Attribution source
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` - UTM parameters
- `landing_page`, `referrer` - Traffic source details
- `platform` - Set to `"anytrack"`
- `device_type`, `browser`, `os` - Device/browser info
- `session_id`, `user_agent`, `ip_address` - Session tracking
- `attribution_model`, `attribution_weight` - Attribution modeling

**Current Stats:**
- **Total Attribution Events:** 138
- **Unique Events:** 138
- **Earliest Event:** 2025-12-12 08:56:55 UTC
- **Latest Event:** 2025-12-14 09:20:32 UTC

**Query Example:**
```sql
SELECT 
  event_id,
  event_name,
  event_time,
  email,
  first_name,
  last_name,
  value,
  currency,
  source,
  medium,
  campaign,
  utm_source,
  utm_medium,
  landing_page
FROM attribution_events 
WHERE platform = 'anytrack'
ORDER BY event_time DESC
LIMIT 10;
```

---

### **3. `contacts` Table** (Lead/Contact Management)
**Location:** `public.contacts`  
**Status:** ✅ Contacts created/updated from AnyTrack Lead events

**Data Stored:**
- `email` - Contact email (unique)
- `first_name`, `last_name` - Contact name
- `phone` - Contact phone
- `first_touch_source` - Set to AnyTrack attribution source
- `first_touch_time` - First event timestamp
- `latest_traffic_source` - Latest attribution source
- `last_touch_source` - Last attribution source
- `last_touch_time` - Last event timestamp
- `total_events` - Count of events from AnyTrack
- `total_value` - Aggregated conversion value
- Plus 50+ additional HubSpot fields (company, lifecycle_stage, etc.)

**Query Example:**
```sql
SELECT 
  email,
  first_name,
  last_name,
  first_touch_source,
  first_touch_time,
  latest_traffic_source,
  total_events,
  total_value
FROM contacts 
WHERE first_touch_source = 'anytrack' 
   OR latest_traffic_source = 'anytrack'
ORDER BY first_touch_time DESC
LIMIT 10;
```

---

## 🔄 **DATA FLOW**

```
AnyTrack Platform
    ↓
Webhook POST Request
    ↓
Supabase Edge Function: anytrack-webhook
    ↓
┌─────────────────────────────────────┐
│  1. events table (all events)       │
│  2. attribution_events (conversions)│
│  3. contacts (leads only)           │
└─────────────────────────────────────┘
```

---

## 📊 **HOW TO VIEW ANYTRACK DATA**

### **Option 1: Supabase Dashboard**
1. Go to **Supabase Dashboard** → **Table Editor**
2. Navigate to:
   - `events` table → Filter: `source = 'anytrack'`
   - `attribution_events` table → Filter: `platform = 'anytrack'`
   - `contacts` table → Filter: `first_touch_source = 'anytrack'`

### **Option 2: SQL Editor**
Run queries in **Supabase Dashboard** → **SQL Editor**:

**Recent AnyTrack Events:**
```sql
SELECT * FROM events 
WHERE source = 'anytrack' 
ORDER BY event_time DESC 
LIMIT 20;
```

**AnyTrack Conversions (Purchase/Lead):**
```sql
SELECT * FROM attribution_events 
WHERE platform = 'anytrack' 
  AND event_name IN ('Purchase', 'Lead', 'CompleteRegistration')
ORDER BY event_time DESC;
```

**Contacts from AnyTrack:**
```sql
SELECT 
  email,
  first_name,
  last_name,
  first_touch_source,
  first_touch_time,
  total_events,
  total_value
FROM contacts 
WHERE first_touch_source LIKE '%anytrack%' 
   OR latest_traffic_source LIKE '%anytrack%'
ORDER BY first_touch_time DESC;
```

**AnyTrack Event Summary:**
```sql
SELECT 
  event_name,
  COUNT(*) as count,
  SUM((custom->>'value')::numeric) as total_value,
  MIN(event_time) as first_event,
  MAX(event_time) as last_event
FROM events 
WHERE source = 'anytrack'
GROUP BY event_name
ORDER BY count DESC;
```

---

## 🔍 **DATA STRUCTURE DETAILS**

### **Events Table Structure:**
```json
{
  "event_id": "anytrack_1234567890_abc123",
  "event_name": "Purchase",
  "event_time": "2025-12-14T09:28:30.245Z",
  "source": "anytrack",
  "status": "completed",
  "user_data": {
    "em": "customer@example.com",
    "ph": "+971501234567",
    "fn": "John",
    "ln": "Doe",
    "external_id": "customer_123"
  },
  "custom": {
    "value": 500,
    "currency": "AED",
    "transaction_id": "txn_123",
    "order_id": "order_456",
    "source_attribution": "google",
    "medium": "cpc",
    "campaign": "summer_sale"
  },
  "meta": {
    "anytrack_asset_id": "asset_789",
    "integration_id": "int_456",
    "location": "Dubai, UAE",
    "user_agent": "Mozilla/5.0..."
  }
}
```

### **Attribution Events Structure:**
```json
{
  "event_id": "anytrack_1234567890_abc123",
  "event_name": "Purchase",
  "event_time": "2025-12-14T09:28:30.245Z",
  "email": "customer@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "value": 500,
  "currency": "AED",
  "source": "google",
  "medium": "cpc",
  "campaign": "summer_sale",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "summer_sale",
  "landing_page": "https://example.com/checkout",
  "referrer": "https://google.com",
  "platform": "anytrack"
}
```

---

## 📈 **CURRENT DATA STATISTICS**

### **Events Table:**
- ✅ **373 total events** from AnyTrack
- ✅ **373 unique events** (no duplicates)
- ✅ **Date Range:** Dec 12 - Dec 14, 2025
- ✅ **Active:** Receiving new events

### **Attribution Events Table:**
- ✅ **138 attribution events** (conversions only)
- ✅ **138 unique events**
- ✅ **Date Range:** Dec 12 - Dec 14, 2025
- ✅ **Event Types:** Purchase, Lead, CompleteRegistration

### **Contacts Table:**
- ✅ Contacts created/updated from AnyTrack Lead events
- ✅ Attribution data synced to contact records
- ✅ Event counts and values aggregated

---

## 🔗 **RELATED TABLES**

### **`sync_logs` Table**
Tracks AnyTrack sync status:
```sql
SELECT * FROM sync_logs 
WHERE platform = 'anytrack' 
ORDER BY started_at DESC 
LIMIT 10;
```

### **`system_settings` Table**
Stores AnyTrack sync configuration:
```sql
SELECT * FROM system_settings 
WHERE key = 'last_anytrack_sync';
```

---

## 🎯 **QUICK ACCESS QUERIES**

### **Get All AnyTrack Data:**
```sql
-- All events
SELECT * FROM events WHERE source = 'anytrack';

-- Attribution events
SELECT * FROM attribution_events WHERE platform = 'anytrack';

-- Contacts from AnyTrack
SELECT * FROM contacts 
WHERE first_touch_source LIKE '%anytrack%' 
   OR latest_traffic_source LIKE '%anytrack%';
```

### **Get Recent Activity:**
```sql
-- Last 24 hours
SELECT * FROM events 
WHERE source = 'anytrack' 
  AND event_time > NOW() - INTERVAL '24 hours'
ORDER BY event_time DESC;
```

### **Get Conversion Summary:**
```sql
SELECT 
  DATE(event_time) as date,
  event_name,
  COUNT(*) as events,
  SUM((custom->>'value')::numeric) as total_value
FROM events 
WHERE source = 'anytrack'
GROUP BY DATE(event_time), event_name
ORDER BY date DESC, event_name;
```

---

## ✅ **VERIFICATION**

**Data is actively flowing:**
- ✅ Webhook function deployed: `anytrack-webhook`
- ✅ Events being received: 373 events stored
- ✅ Attribution tracking: 138 conversion events
- ✅ Contacts syncing: Leads creating/updating contacts
- ✅ Latest event: Dec 14, 2025 09:28:30 UTC

**All systems operational!** 🎉

---

**Last Updated:** 2025-12-15  
**Project:** PTD Fitness Business Intelligence System
