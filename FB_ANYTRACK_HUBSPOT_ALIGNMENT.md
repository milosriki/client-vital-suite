# 🔄 Facebook, AnyTrack & HubSpot Data Alignment Report

## ✅ **STATUS: NO N8N DEPENDENCIES - ALL SUPABASE EDGE FUNCTIONS**

**Confirmed:** System uses **100% Supabase Edge Functions** - NO n8n dependencies. All integrations work independently.

---

## 📊 **DATA STRUCTURE COMPARISON**

### **1. Facebook CAPI (Conversion API) Data**

**Source:** Meta/Facebook Pixel → Stape Gateway → Supabase  
**Storage:** `capi_events_enriched` table  
**Function:** `process-capi-batch`, `send-to-stape-capi`

**Data Structure:**
```json
{
  "event_id": "unique_event_id",
  "event_name": "Purchase" | "Lead" | "InitiateCheckout" | "CompleteRegistration",
  "event_time": "2025-12-14T09:28:30Z",
  "user_data": {
    "em": "hashed_email@example.com",      // SHA-256 hashed
    "ph": "hashed_971501234567",            // SHA-256 hashed, normalized
    "fn": "hashed_firstname",               // SHA-256 hashed
    "ln": "hashed_lastname",                // SHA-256 hashed
    "ct": "hashed_dubai",                   // SHA-256 hashed
    "st": "hashed_dubai",                   // SHA-256 hashed
    "country": "hashed_ae",                 // SHA-256 hashed
    "external_id": "HUBSPOT_123456",        // NOT hashed
    "fbp": "fb.1.1729270000.123456789",    // NEVER hashed
    "fbc": "fb.1.1729270000.AbCdEf123"      // NEVER hashed
  },
  "custom_data": {
    "currency": "AED",
    "value": 500.00,
    "content_name": "12-Week Transformation Package",
    "content_category": "Fitness Program",
    "content_ids": ["PACK-12W"],
    "num_items": 1
  },
  "event_source_url": "https://ptdfitness.com/checkout",
  "action_source": "website"
}
```

**Key Fields:**
- ✅ **PII is SHA-256 hashed** (email, phone, name, city, etc.)
- ✅ **fbp/fbc cookies NEVER hashed** (Meta identifiers)
- ✅ **external_id** links to HubSpot Contact ID
- ✅ **Event names:** Purchase, Lead, InitiateCheckout, CompleteRegistration

---

### **2. AnyTrack Data**

**Source:** AnyTrack Platform → Webhook → Supabase  
**Storage:** `events` table (source='anytrack'), `attribution_events` table (platform='anytrack')  
**Function:** `anytrack-webhook`

**Data Structure:**
```json
{
  "event_id": "anytrack_1234567890_abc123",
  "event_name": "Purchase" | "Lead" | "CompleteRegistration" | "FormSubmit",
  "event_time": "2025-12-14T09:28:30.245Z",
  "source": "anytrack",
  "user_data": {
    "em": "customer@example.com",           // NOT hashed (raw)
    "ph": "+971501234567",                  // NOT hashed (raw)
    "fn": "John",                           // NOT hashed (raw)
    "ln": "Doe",                           // NOT hashed (raw)
    "external_id": "customer_123"
  },
  "custom": {
    "value": 500,
    "currency": "AED",
    "transaction_id": "txn_123",
    "order_id": "order_456",
    "items": [],
    "source_attribution": "google" | "facebook",
    "medium": "cpc",
    "campaign": "summer_sale",
    "gclid": "google_click_id",
    "fbclid": "facebook_click_id",
    "click_id": "WUDv86JpJ4SsopxkOpmbK6FB4pzApY"
  },
  "meta": {
    "anytrack_asset_id": "WUDv86JpJ4Ss",
    "integration_id": "hubspot-ptdfitness",
    "tracking_group": "hubspot",
    "user_agent": "Mozilla/5.0...",
    "location": "Dubai, UAE",
    "brand": "Abraham Oommen PHONE+971 55 700 8760",
    "attributions": [
      {
        "time": "2025-12-09T19:29:00Z",
        "params": {"contactId": "183468189347"},
        "source": "facebook"
      }
    ]
  }
}
```

**Key Fields:**
- ⚠️ **PII is NOT hashed** (raw email, phone, names)
- ✅ **Attribution data** (source, medium, campaign, UTM params)
- ✅ **Click IDs** (gclid, fbclid, click_id)
- ✅ **Multi-touch attribution** (attributions array)
- ✅ **Event names:** Purchase, Lead, CompleteRegistration, FormSubmit, DealNew, etc.

---

### **3. HubSpot Data**

**Source:** HubSpot CRM → API Sync → Supabase  
**Storage:** `contacts` table, `deals` table, `call_records` table  
**Function:** `sync-hubspot-to-supabase`

**Data Structure (Contacts):**
```json
{
  "hubspot_contact_id": "183367999767",
  "email": "nomanashraf1947@gmail.com",
  "first_name": "Noman Khan",
  "last_name": "Madakhail",
  "phone": "+971501234567",
  "lifecycle_stage": "lead" | "marketingqualifiedlead" | "salesqualifiedlead" | "opportunity" | "customer",
  "lead_status": "new" | "contacted" | "appointment_scheduled" | "closed_won",
  "first_touch_source": "google" | "facebook" | "direct",
  "latest_traffic_source": "google",
  "total_events": 5,
  "total_value": 5000.00,
  "owner_id": "hubspot_owner_123",
  "owner_name": "John Smith",
  "city": "Dubai",
  "company_name": "ABC Corp",
  "num_associated_deals": 2,
  "total_deal_value": 10000.00,
  "created_at": "2025-12-01T10:00:00Z",
  "updated_at": "2025-12-14T09:28:30Z"
}
```

**Key Fields:**
- ✅ **Raw PII** (email, phone, names - NOT hashed)
- ✅ **Lifecycle stages** (lead → MQL → SQL → opportunity → customer)
- ✅ **Attribution sources** (first_touch_source, latest_traffic_source)
- ✅ **Deal associations** (num_associated_deals, total_deal_value)
- ✅ **50+ additional fields** (company, engagement scores, etc.)

---

## 🔄 **DATA ALIGNMENT MAPPING**

### **Event Name Mapping**

| Facebook CAPI | AnyTrack | HubSpot Lifecycle | Action |
|---------------|----------|-------------------|--------|
| `Purchase` | `Purchase` | `customer` | ✅ Send to FB CAPI |
| `Lead` | `Lead` | `marketingqualifiedlead` | ✅ Send to FB CAPI |
| `InitiateCheckout` | `DealNew` | `opportunity` | ✅ Send to FB CAPI |
| `CompleteRegistration` | `CompleteRegistration` | `lead` | ✅ Send to FB CAPI |
| N/A | `FormSubmit` | `lead` | ✅ Send to FB CAPI |
| N/A | `salesqualifiedlead` | `salesqualifiedlead` | ✅ Send to FB CAPI |

---

### **PII Field Mapping**

| Field | Facebook CAPI | AnyTrack | HubSpot | Notes |
|-------|---------------|----------|---------|-------|
| **Email** | `user_data.em` (hashed) | `user_data.em` (raw) | `email` (raw) | Hash before sending to FB |
| **Phone** | `user_data.ph` (hashed) | `user_data.ph` (raw) | `phone` (raw) | Hash + normalize UAE format |
| **First Name** | `user_data.fn` (hashed) | `user_data.fn` (raw) | `first_name` (raw) | Hash before sending to FB |
| **Last Name** | `user_data.ln` (hashed) | `user_data.ln` (raw) | `last_name` (raw) | Hash before sending to FB |
| **City** | `user_data.ct` (hashed) | `meta.location` (raw) | `city` (raw) | Hash before sending to FB |
| **External ID** | `user_data.external_id` | `user_data.external_id` | `hubspot_contact_id` | Use HubSpot ID as external_id |
| **fbp Cookie** | `user_data.fbp` (raw) | `custom.fbclid` | N/A | NEVER hash |
| **fbc Cookie** | `user_data.fbc` (raw) | `custom.fbclid` | N/A | NEVER hash |

---

### **Attribution Field Mapping**

| Field | Facebook CAPI | AnyTrack | HubSpot | Notes |
|-------|---------------|----------|---------|-------|
| **Source** | N/A (in UTM) | `custom.source_attribution` | `first_touch_source`, `latest_traffic_source` | Map to UTM |
| **Medium** | N/A (in UTM) | `custom.medium` | N/A | Map to UTM |
| **Campaign** | N/A (in UTM) | `custom.campaign` | N/A | Map to UTM |
| **UTM Source** | `custom_data.utm_source` | `custom.source_attribution` | `hs_analytics_source` | Use AnyTrack if available |
| **UTM Medium** | `custom_data.utm_medium` | `custom.medium` | N/A | Use AnyTrack if available |
| **UTM Campaign** | `custom_data.utm_campaign` | `custom.campaign` | N/A | Use AnyTrack if available |
| **Landing Page** | `event_source_url` | `meta.location` | `hs_analytics_first_url` | Use AnyTrack if available |
| **Referrer** | N/A | `custom.referrer` | N/A | Use AnyTrack if available |

---

### **Conversion Value Mapping**

| Field | Facebook CAPI | AnyTrack | HubSpot | Notes |
|-------|---------------|----------|---------|-------|
| **Value** | `custom_data.value` | `custom.value` | `total_value`, `total_deal_value` | Use AnyTrack value if available |
| **Currency** | `custom_data.currency` | `custom.currency` | N/A | Default: AED |
| **Transaction ID** | `event_id` | `custom.transaction_id` | Deal ID | Use AnyTrack if available |
| **Order ID** | N/A | `custom.order_id` | Deal ID | Use AnyTrack if available |

---

## 🎯 **WHAT TO SEND BACK TO FACEBOOK CAPI**

### **When We See an Event:**

**1. AnyTrack Event Received:**
- ✅ **Store in `events` table** (source='anytrack')
- ✅ **Store in `attribution_events` table** (platform='anytrack')
- ✅ **If Lead event:** Create/update `contacts` table
- ✅ **If Purchase event:** Send to Facebook CAPI (hash PII first!)

**2. HubSpot Contact Updated:**
- ✅ **Store in `contacts` table**
- ✅ **If lifecycle_stage changes:** Map to FB event and send to CAPI
  - `customer` → `Purchase` event
  - `opportunity` → `InitiateCheckout` event
  - `marketingqualifiedlead` → `Lead` event

**3. HubSpot Deal Created/Updated:**
- ✅ **Store in `deals` table**
- ✅ **If deal stage = closed_won:** Send `Purchase` event to FB CAPI
- ✅ **If deal stage = opportunity:** Send `InitiateCheckout` event to FB CAPI

---

## 📋 **EVENT SENDING LOGIC**

### **Priority Order for Data Sources:**

1. **AnyTrack** (highest priority - has attribution data)
   - Use AnyTrack event data
   - Hash PII before sending to FB
   - Use AnyTrack attribution (source, medium, campaign)

2. **HubSpot** (fallback - enrich with HubSpot data)
   - Use HubSpot contact/deal data
   - Hash PII before sending to FB
   - Use HubSpot attribution if AnyTrack not available

3. **Facebook Pixel** (direct - already hashed)
   - Use pixel data directly
   - Already hashed, ready to send

---

## 🔧 **IMPLEMENTATION CHECKLIST**

### **✅ Current Status:**

- ✅ **AnyTrack Webhook:** Receives events → Stores in `events` + `attribution_events`
- ✅ **HubSpot Sync:** Syncs contacts/deals → Stores in `contacts` + `deals`
- ✅ **Facebook CAPI:** Processes events → Sends to Stape Gateway → Meta
- ✅ **No n8n Dependencies:** All Supabase Edge Functions

### **⚠️ What Needs to Be Done:**

1. **Create Unified Event Processor:**
   - Function: `unified-event-processor`
   - Purpose: When AnyTrack/HubSpot event received, automatically send to FB CAPI
   - Logic:
     - Check if event matches FB CAPI criteria (Purchase, Lead, etc.)
     - Hash PII from AnyTrack/HubSpot data
     - Enrich with attribution data
     - Send to `capi_events_enriched` table
     - Trigger `process-capi-batch` function

2. **Enhance Attribution Matching:**
   - Match AnyTrack events to HubSpot contacts by email
   - Match HubSpot contacts to AnyTrack events by email
   - Create unified attribution view

3. **Auto-Sync to Facebook:**
   - When AnyTrack Purchase event → Auto-send to FB CAPI
   - When HubSpot deal closed_won → Auto-send to FB CAPI
   - When HubSpot contact becomes customer → Auto-send to FB CAPI

---

## 📊 **UNIFIED DATA VIEW**

### **Query to See All Events Together:**

```sql
-- All events from all sources
SELECT 
  'anytrack' as source,
  event_id,
  event_name,
  event_time,
  user_data->>'em' as email,
  custom->>'value' as value,
  custom->>'source_attribution' as attribution_source
FROM events 
WHERE source = 'anytrack'

UNION ALL

SELECT 
  'hubspot' as source,
  hubspot_contact_id as event_id,
  CASE 
    WHEN lifecycle_stage = 'customer' THEN 'Purchase'
    WHEN lifecycle_stage = 'opportunity' THEN 'InitiateCheckout'
    WHEN lifecycle_stage IN ('marketingqualifiedlead', 'salesqualifiedlead') THEN 'Lead'
    ELSE 'Lead'
  END as event_name,
  updated_at as event_time,
  email,
  total_value::text as value,
  latest_traffic_source as attribution_source
FROM contacts 
WHERE lifecycle_stage IN ('customer', 'opportunity', 'marketingqualifiedlead', 'salesqualifiedlead')

ORDER BY event_time DESC;
```

---

## 🚫 **N8N DEPENDENCY CHECK**

### **✅ Confirmed: NO N8N Dependencies**

**All integrations use Supabase Edge Functions:**

1. **AnyTrack:** `anytrack-webhook` Edge Function ✅
2. **HubSpot:** `sync-hubspot-to-supabase` Edge Function ✅
3. **Facebook CAPI:** `process-capi-batch`, `send-to-stape-capi` Edge Functions ✅
4. **Attribution:** `attribution_events` table + Edge Functions ✅

**n8n References Found:**
- ⚠️ `backend/n8n/AGGREGATOR_FUNCTION.js` - **Legacy code, NOT used**
- ⚠️ `N8N_WORKFLOW_ANALYSIS.md` - **Documentation only, NOT active**
- ✅ **No active n8n workflows or dependencies**

**System Status:** 🟢 **100% Supabase Edge Functions - NO n8n required**

---

## 🎯 **RECOMMENDATIONS**

### **1. Create Unified Event Processor Function:**

```typescript
// supabase/functions/unified-event-processor/index.ts
// When AnyTrack/HubSpot event received:
// 1. Check if it should be sent to FB CAPI
// 2. Hash PII
// 3. Enrich with attribution
// 4. Insert into capi_events_enriched
// 5. Trigger batch send
```

### **2. Create Attribution Matching Function:**

```typescript
// supabase/functions/match-attribution/index.ts
// Match events across platforms by:
// - Email (primary)
// - External ID (HubSpot contact ID)
// - Transaction ID
// - Time window (within 7 days)
```

### **3. Create Unified Dashboard View:**

```sql
-- View: unified_events_view
-- Shows all events from AnyTrack, HubSpot, Facebook together
-- With attribution data aligned
```

---

## ✅ **SUMMARY**

**Data Sources:**
- ✅ **Facebook CAPI:** Receives hashed PII, sends to Meta
- ✅ **AnyTrack:** Receives raw PII + attribution, stores in Supabase
- ✅ **HubSpot:** Receives raw PII + CRM data, stores in Supabase

**Alignment Strategy:**
1. **AnyTrack events** → Hash PII → Send to FB CAPI
2. **HubSpot events** → Hash PII → Send to FB CAPI
3. **Match by email** → Create unified attribution view
4. **Auto-sync** → When conversion events occur, auto-send to FB CAPI

**No n8n Required:** ✅ All Supabase Edge Functions

---

**Last Updated:** 2025-12-15  
**Status:** 🟢 Ready for unified event processing implementation
