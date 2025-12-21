# 🔄 Facebook (Meta) & HubSpot Sync + Long Sales Cycle Tracking

## 📊 **OVERVIEW**

Your system has **three-way sync** between:
1. **HubSpot** (CRM - source of truth)
2. **Supabase** (Database - unified data store)
3. **Meta/Facebook** (CAPI - conversion tracking)

Plus **attribution tracking** that follows leads through **long sales cycles** (weeks/months).

---

## 🔄 **SYNC ARCHITECTURE**

### **1. HubSpot → Supabase Sync**

**Function:** `sync-hubspot-to-supabase`

**What It Syncs:**
- ✅ Contacts (with lifecycle stages)
- ✅ Leads (with status)
- ✅ Deals (with stages)
- ✅ Calls (call tracking data)
- ✅ Activities (emails, meetings, notes)

**How It Works:**
```
HubSpot API → Edge Function → Supabase Database
```

**Sync Modes:**
- **Incremental:** Only syncs changes since last sync (faster)
- **Full:** Syncs everything (slower, but complete)
- **Batch:** Processes in batches of 100 records

**Frequency:**
- Can be triggered manually
- Can be scheduled (hourly/daily)
- Tracks sync status in `sync_logs` table

**Key Features:**
- ✅ Handles pagination (large datasets)
- ✅ Resume capability (cursor-based)
- ✅ Error handling per record
- ✅ Duplicate prevention (upsert)

---

### **2. HubSpot → Meta CAPI Sync**

**Function:** `sync-hubspot-to-capi`

**What It Does:**
Converts HubSpot contacts → Meta Conversion API events

**Mapping Logic:**

| HubSpot Lifecycle Stage | Meta Event Name | When Sent |
|------------------------|-----------------|-----------|
| `lead` | `Lead` | Immediately |
| `marketingqualifiedlead` | `Lead` | Immediately |
| `salesqualifiedlead` | `Lead` | Immediately |
| `opportunity` | `InitiateCheckout` | When deal created |
| `customer` | `Purchase` | When deal closed |

**Data Flow:**
```
HubSpot Contact
  ↓
Edge Function (sync-hubspot-to-capi)
  ↓
Hash PII (SHA-256) ← Meta requirement
  ↓
Store in capi_events_enriched table
  ↓
Enrich with Stripe data (value)
  ↓
Send to Meta via Stape gateway
```

**PII Hashing (Meta Requirement):**
- ✅ Email → SHA-256 hash
- ✅ Phone → SHA-256 hash
- ✅ First Name → SHA-256 hash
- ✅ Last Name → SHA-256 hash
- ✅ City, State, Zip → SHA-256 hash
- ❌ `fbp` & `fbc` cookies → **NOT hashed** (browser identifiers)

**Why Hash?**
Meta requires PII to be hashed for privacy compliance (GDPR, CCPA).

---

### **3. Data Enrichment Pipeline**

**Step 1: HubSpot Sync**
```
HubSpot → Supabase (contacts, deals, lifecycle)
```

**Step 2: Stripe Enrichment**
```
Function: enrich-with-stripe
Matches: email → Stripe customer
Adds: Payment value, subscription data
```

**Step 3: CAPI Event Creation**
```
Function: process-capi-batch
Fetches: Pending events from capi_events_enriched
Sends: To Meta via Stape gateway
Updates: send_status = 'sent'
```

---

## 🎯 **LONG SALES CYCLE TRACKING**

### **How It Follows Long Sales Cycles**

Your system tracks leads through **entire journey** from first touch to purchase, even if it takes **weeks or months**.

#### **1. Attribution Events Table**

**Table:** `attribution_events`

**Tracks:**
- ✅ First touch (where lead came from)
- ✅ Last touch (what converted them)
- ✅ All touchpoints in between
- ✅ UTM parameters (source, medium, campaign)
- ✅ Landing pages
- ✅ Referrers
- ✅ Time between touches

**Key Fields:**
```sql
- event_id (unique)
- email (contact identifier)
- first_name, last_name
- event_name (Lead, Purchase, etc.)
- event_time (timestamp)
- source (google, facebook, organic, etc.)
- medium (cpc, cpm, organic, etc.)
- campaign (campaign name)
- utm_source, utm_medium, utm_campaign
- landing_page
- referrer
- platform (anytrack, hubspot, etc.)
```

#### **2. Contacts Table - Journey Tracking**

**Table:** `contacts`

**Tracks Long-Term Journey:**
```sql
- first_touch_source (where they first came from)
- first_touch_time (when first touch happened)
- last_touch_source (what converted them)
- last_touch_time (when conversion happened)
- total_events (how many touchpoints)
- total_value (cumulative value)
- lifecycle_stage (current stage)
```

**Example Journey:**
```
Day 1:   First Touch → Google Ads → Lead event
Day 5:   Email Open → Nurture campaign
Day 12:  Website Visit → Organic search
Day 20:  Form Submit → Landing page
Day 35:  Call → Appointment booked
Day 45:  Purchase → Closed deal
```

**All tracked in:** `attribution_events` table

#### **3. Lifecycle Stage Tracking**

**HubSpot Lifecycle Stages:**
```
lead → marketingqualifiedlead → salesqualifiedlead → opportunity → customer
```

**Your System Tracks:**
- ✅ When stage changed
- ✅ How long in each stage
- ✅ What triggered stage change
- ✅ Value at each stage

**Table:** `client_lifecycle_history`

**Tracks:**
- Email (contact identifier)
- Week ending date
- Lifecycle stage
- Health score
- Predictive risk score
- Changes over time

---

## 📈 **ATTRIBUTION MODELS**

### **1. First Touch Attribution**
**Question:** Where did the lead first come from?

**Tracks:**
- First ad click
- First website visit
- First form submission

**Stored In:**
- `contacts.first_touch_source`
- `contacts.first_touch_time`
- `attribution_events` (first event)

### **2. Last Touch Attribution**
**Question:** What converted them?

**Tracks:**
- Last ad click before purchase
- Last email opened
- Last call made

**Stored In:**
- `contacts.last_touch_source`
- `contacts.last_touch_time`
- `attribution_events` (last event)

### **3. Multi-Touch Attribution**
**Question:** What was the full journey?

**Tracks:**
- All touchpoints between first and last
- Time between touches
- Value at each touchpoint

**Stored In:**
- `attribution_events` table (all events)
- `contacts.total_events` (count)

---

## 🔍 **HOW LONG CYCLES ARE TRACKED**

### **Scenario: 60-Day Sales Cycle**

**Day 1 - First Touch:**
```
Event: Lead
Source: Facebook Ads
Campaign: "Dubai Fitness Transformation"
Stored: attribution_events table
Updated: contacts.first_touch_source = "facebook"
```

**Day 5 - Email Engagement:**
```
Event: Email Open
Source: Email Campaign
Stored: attribution_events table
Updated: contacts.total_events += 1
```

**Day 15 - Website Return:**
```
Event: PageView
Source: Organic Search
Stored: attribution_events table
Updated: contacts.total_events += 1
```

**Day 30 - Form Submission:**
```
Event: FormSubmit
Source: Landing Page
Stored: attribution_events table
Updated: contacts.total_events += 1
```

**Day 45 - Appointment:**
```
Event: Appointment Set
Source: Call
Stored: attribution_events table
Updated: contacts.total_events += 1
```

**Day 60 - Purchase:**
```
Event: Purchase
Source: Website Checkout
Stored: attribution_events table
Updated: 
  - contacts.last_touch_source = "website"
  - contacts.last_touch_time = now()
  - contacts.total_value = 500 AED
  - contacts.lifecycle_stage = "customer"
```

**All Events Linked:**
- Same `email` across all events
- `attribution_events` table has full journey
- Can query: "Show me all touchpoints for john@example.com"

---

## 🔄 **SYNC FLOW DIAGRAM**

```
┌─────────────┐
│   HubSpot   │ ← Source of Truth (CRM)
└──────┬──────┘
       │
       │ (API Sync)
       ▼
┌─────────────────────────────────────┐
│ sync-hubspot-to-supabase            │
│ • Contacts                          │
│ • Deals                             │
│ • Lifecycle Stages                  │
│ • Activities                        │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────┐
│  Supabase   │ ← Unified Database
│  Database   │
└──────┬──────┘
       │
       ├─────────────────┬─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  contacts   │  │attribution_ │  │capi_events_ │
│   table     │  │  events     │  │  enriched   │
└─────────────┘  └─────────────┘  └──────┬──────┘
                                         │
                                         │ (Enrich with Stripe)
                                         ▼
                              ┌─────────────────────┐
                              │ enrich-with-stripe  │
                              │ • Match email       │
                              │ • Add payment value │
                              └──────────┬──────────┘
                                         │
                                         │ (Send to Meta)
                                         ▼
                              ┌─────────────────────┐
                              │ process-capi-batch  │
                              │ • Hash PII          │
                              │ • Format for Meta   │
                              │ • Send via Stape    │
                              └──────────┬──────────┘
                                         │
                                         ▼
                              ┌─────────────┐
                              │ Meta/FB CAPI│ ← Conversion Tracking
                              └─────────────┘
```

---

## 📊 **KEY TABLES FOR LONG CYCLE TRACKING**

### **1. `attribution_events`**
**Purpose:** Complete journey tracking

**Key Fields:**
- `email` - Links all events together
- `event_time` - When it happened
- `source`, `medium`, `campaign` - Attribution
- `event_name` - Type of event

**Query Example:**
```sql
-- Get full journey for a contact
SELECT * FROM attribution_events 
WHERE email = 'john@example.com' 
ORDER BY event_time ASC;
```

### **2. `contacts`**
**Purpose:** Summary of journey

**Key Fields:**
- `first_touch_source` - Where they came from
- `first_touch_time` - When first touch
- `last_touch_source` - What converted
- `last_touch_time` - When converted
- `total_events` - Touchpoint count
- `total_value` - Cumulative value

**Query Example:**
```sql
-- Find contacts with long cycles (>30 days)
SELECT email, 
       first_touch_time, 
       last_touch_time,
       last_touch_time - first_touch_time as cycle_length
FROM contacts 
WHERE last_touch_time - first_touch_time > INTERVAL '30 days';
```

### **3. `client_lifecycle_history`**
**Purpose:** Stage progression over time

**Key Fields:**
- `email` - Contact identifier
- `week_ending_date` - Time period
- `lifecycle_stage` - Stage at that time
- `health_score` - Health at that time

**Query Example:**
```sql
-- Track stage progression
SELECT email, week_ending_date, lifecycle_stage 
FROM client_lifecycle_history 
WHERE email = 'john@example.com' 
ORDER BY week_ending_date ASC;
```

---

## 🎯 **SYNC FEATURES FOR LONG CYCLES**

### **1. Incremental Sync**
**Benefit:** Only syncs changes, not everything

**How It Works:**
- Tracks `last_sync_time` in `sync_logs`
- Only fetches records modified since last sync
- Handles long cycles efficiently

**Example:**
```
Last sync: 2025-01-01
Current sync: 2025-01-15
Only syncs: Records changed between Jan 1-15
```

### **2. Cursor-Based Pagination**
**Benefit:** Handles large datasets without timeout

**How It Works:**
- Processes in batches
- Saves cursor position
- Can resume if interrupted

**Example:**
```
Batch 1: Records 1-100 (cursor: "abc123")
Batch 2: Records 101-200 (cursor: "def456")
...
```

### **3. Event Deduplication**
**Benefit:** Prevents duplicate events

**How It Works:**
- Uses `event_id` + `source` as unique key
- Upsert instead of insert
- Handles retries safely

**Example:**
```
Event ID: "hubspot_123_20250115"
Source: "hubspot"
If exists: Update
If not: Insert
```

---

## 🔄 **SYNC SCHEDULE**

### **Recommended Schedule:**

**HubSpot → Supabase:**
- **Frequency:** Hourly (or every 4 hours)
- **Type:** Incremental
- **Function:** `sync-hubspot-to-supabase`

**HubSpot → Meta CAPI:**
- **Frequency:** Daily (or on lifecycle change)
- **Type:** On-demand (when stage changes)
- **Function:** `sync-hubspot-to-capi`

**Stripe Enrichment:**
- **Frequency:** Daily
- **Type:** Batch
- **Function:** `enrich-with-stripe`

**Meta CAPI Send:**
- **Frequency:** Every 4 hours
- **Type:** Batch (pending events)
- **Function:** `process-capi-batch`

---

## 📈 **TRACKING LONG SALES CYCLES - EXAMPLE**

### **Real Scenario: 45-Day Cycle**

**Day 1:**
```
HubSpot: Contact created (lifecycle: lead)
Sync: → Supabase contacts table
Event: attribution_events (Lead, source: facebook)
Meta: CAPI event sent (Lead)
```

**Day 10:**
```
HubSpot: Lifecycle changed (marketingqualifiedlead)
Sync: → Supabase contacts table (updated lifecycle)
Event: attribution_events (Email Open)
Meta: No CAPI event (not conversion)
```

**Day 25:**
```
HubSpot: Deal created (lifecycle: opportunity)
Sync: → Supabase deals table
Event: attribution_events (FormSubmit)
Meta: CAPI event sent (InitiateCheckout)
```

**Day 45:**
```
HubSpot: Deal closed (lifecycle: customer)
Sync: → Supabase deals table (closed_won)
Stripe: Payment received (500 AED)
Enrichment: → capi_events_enriched (value added)
Event: attribution_events (Purchase)
Meta: CAPI event sent (Purchase, value: 500 AED)
```

**Result:**
- ✅ Full 45-day journey tracked
- ✅ All touchpoints recorded
- ✅ Attribution preserved
- ✅ Value tracked correctly
- ✅ Meta gets conversion data

---

## ✅ **SUMMARY**

### **Sync Capabilities:**
1. ✅ **HubSpot → Supabase:** Full CRM sync (contacts, deals, activities)
2. ✅ **HubSpot → Meta CAPI:** Conversion tracking with PII hashing
3. ✅ **Stripe Enrichment:** Adds payment value to events
4. ✅ **Meta CAPI Send:** Batch sends to Facebook

### **Long Cycle Tracking:**
1. ✅ **Attribution Events:** Complete journey (all touchpoints)
2. ✅ **Contacts Table:** First/last touch summary
3. ✅ **Lifecycle History:** Stage progression over time
4. ✅ **Multi-Touch Attribution:** Full journey analysis

### **Key Features:**
- ✅ Incremental sync (efficient)
- ✅ Cursor pagination (handles large datasets)
- ✅ Event deduplication (prevents duplicates)
- ✅ PII hashing (Meta compliance)
- ✅ Value enrichment (Stripe integration)
- ✅ Long-term tracking (weeks/months)

---

**Your system can track leads from first touch to purchase, even if it takes 60+ days!** 🎯
