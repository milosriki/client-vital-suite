# Meta CAPI Best Practices & Data Strategy

## Meta's Algorithm Optimization

### What Meta Needs for Best Performance

Meta's algorithm learns from your conversion data to optimize ad delivery. The more complete and accurate your data, the better Meta can:
1. **Find similar customers** (Lookalike Audiences)
2. **Predict conversion likelihood** (Campaign Budget Optimization)
3. **Attribute conversions correctly** (Conversion Lift)

### Critical Data Points (Priority Order)

**1. Event Match Quality Parameters** (Most Important)
```javascript
{
  // HIGHEST PRIORITY - Unhashed browser identifiers
  fbp: "fb.1.1729270000.123456789",    // Meta's first-party cookie
  fbc: "fb.1.1729270000.AbCdEf123",    // Click ID from fb ads

  // HIGH PRIORITY - Hashed PII (hash on server)
  em: [hash("email@example.com")],     // Email (SHA-256)
  ph: [hash("971501234567")],          // Phone with country code
  
  // MEDIUM PRIORITY - Additional matching
  fn: hash("ahmed"),                    // First name
  ln: hash("khalil"),                   // Last name
  ct: hash("dubai"),                    // City
  st: hash("dubai"),                    // State/Region
  zp: hash("12345"),                    // Postal code
  country: hash("ae"),                  // ISO country code
  
  // USEFUL - External identifiers
  external_id: "CUST_123",             // Your system's user ID
}
```

**2. Conversion Value Data**
```javascript
{
  currency: "AED",                      // ISO currency code
  value: 500.00,                        // Transaction value in AED
  content_name: "12-Week Transformation Package",
  content_category: "Fitness Program",
  content_ids: ["PACK-12W"],           // Product SKUs
  num_items: 1,                         // Quantity
}
```

**3. Event Timing & Context**
```javascript
{
  event_time: 1729350000,               // Unix timestamp (seconds)
  event_source_url: "https://ptdfitness.com/checkout",
  action_source: "website",             // or "app", "chat", "email"
}
```

## Complete Event Schema

### Perfect Purchase Event
```javascript
{
  // Meta Standard Event
  event_name: "Purchase",
  event_time: 1729350000,
  event_id: "ORD-DXB-12345",           // Unique, prevents duplicates
  
  // User Data (ALL will be SHA-256 hashed except fbp/fbc)
  user_data: {
    // Browser identifiers (NEVER hash)
    fbp: "fb.1.1729270000.123456789",
    fbc: "fb.1.1729270000.AbCdEf123",
    
    // PII (hash on server)
    em: ["email@example.com"],          // Can send multiple
    ph: ["971501234567"],                // Include country code
    fn: "ahmed",
    ln: "khalil",
    ct: "dubai",
    st: "dubai",
    country: "ae",                       // ISO 3166-1 alpha-2
    zp: "",                              // Optional in UAE
    
    // External ID
    external_id: "HUBSPOT_123456",     // HubSpot Contact ID
  },
  
  // Purchase Data
  custom_data: {
    currency: "AED",
    value: 500.00,
    content_name: "12-Week Transformation",
    content_category: "Personal Training",
    content_ids: ["PACK-12W-TRANSFORM"],
    num_items: 1,
  },
  
  // Context
  event_source_url: "https://ptdfitness.com/checkout/success",
  action_source: "website",
}
```

## Data Enrichment Strategy

### 1. HubSpot Data (Primary Source)

**Contact Properties to Pull:**
```javascript
{
  // Identity
  email: "client@example.com",
  phone: "+971501234567",
  firstname: "Ahmed",
  lastname: "Khalil",
  
  // Location
  city: "Dubai",
  state: "Dubai",
  country: "AE",
  zip: "",
  
  // Lifecycle
  lifecyclestage: "customer",          // → Maps to Purchase event
  hs_lead_status: "CONNECTED",
  
  // Attribution
  hs_analytics_source: "ORGANIC_SEARCH",
  hs_analytics_first_url: "https://ptdfitness.com/programs",
  hs_analytics_last_url: "https://ptdfitness.com/checkout",
  
  // Timestamps
  createdate: "2025-01-15T10:30:00Z",
  closedate: "2025-01-20T14:00:00Z",
  
  // Custom
  hs_object_id: "12345678",            // HubSpot Contact ID
}
```

**Lifecycle Stage Mapping:**
| HubSpot Lifecycle | Meta Event | Value Strategy |
|------------------|------------|----------------|
| lead | Lead | $0 (potential) |
| marketingqualifiedlead | Lead | Estimated package value |
| salesqualifiedlead | Lead | Discussed package value |
| opportunity | InitiateCheckout | Deal amount from HubSpot |
| customer | Purchase | Actual purchase amount |

### 2. Stripe Data (Value Enrichment)

**What to Pull from Stripe:**
```javascript
{
  // Customer
  stripe_customer_id: "cus_ABC123",
  
  // Payment
  charge_id: "ch_XYZ789",
  amount: 50000,                       // 500.00 AED in cents
  currency: "aed",
  payment_method: "card",
  
  // Subscription (for recurring revenue)
  subscription_id: "sub_DEF456",
  subscription_status: "active",
  plan_amount: 50000,                  // Monthly value
  billing_interval: "month",
  
  // Invoice
  invoice_id: "in_GHI789",
  invoice_amount: 50000,
  
  // Attribution
  metadata: {
    hubspot_deal_id: "123456",
    package_type: "12-week-transform",
  }
}
```

**Enrichment Logic:**
```javascript
// Priority order for value determination:
1. Stripe Charge Amount (most accurate)
2. Stripe Invoice Amount
3. HubSpot Deal Amount
4. Default package pricing
5. $0 for leads

// Example:
if (stripe_charge_id) {
  value = stripe_charge.amount / 100;  // Convert cents to AED
} else if (hubspot_deal_amount) {
  value = hubspot_deal_amount;
} else if (event_name === "Purchase") {
  value = 500;  // Default package value
}
```

## Batch Processing Strategy

### Optimal Timing for Meta CAPI

**Meta's Recommendations:**
- Send events as close to real-time as possible
- If batching, send within 24 hours
- Morning batches (2-4 AM) avoid peak processing
- Multiple smaller batches > one large batch

**Our Implementation:**
```javascript
{
  // Batch Config
  batch_size: 200,                    // Meta's batch limit
  batch_time: "02:00:00",            // 2 AM Dubai time
  timezone: "Asia/Dubai",
  days_of_week: [1,2,3,4,5,6,7],    // Daily
}
```

### Batch Processing Flow

```
1. HubSpot Sync (Every 6 hours)
   ↓
   Pull recent contacts with lifecycle changes
   ↓
   Insert into capi_events_enriched (send_status: pending)

2. Stripe Enrichment (Every hour)
   ↓
   Find pending events with email match
   ↓
   Enrich with Stripe payment/subscription data
   ↓
   Update events (send_status: enriched)

3. Batch Processing (Scheduled times: 2 AM, 2 PM)
   ↓
   Fetch up to 200 pending/enriched events
   ↓
   Hash PII fields (except fbp/fbc)
   ↓
   Send to Stape CAPI gateway
   ↓
   Update events (send_status: sent)
   ↓
   Log to batch_jobs table
```

## Perfect Event Structure by Type

### Purchase Event (Customer Lifecycle)
```json
{
  "event_name": "Purchase",
  "event_time": 1729350000,
  "event_id": "ORD-DXB-12345",
  "user_data": {
    "em": ["hashed_email"],
    "ph": ["hashed_971501234567"],
    "fn": "hashed_ahmed",
    "ln": "hashed_khalil",
    "ct": "hashed_dubai",
    "country": "hashed_ae",
    "external_id": "HUBSPOT_123456",
    "fbp": "fb.1.1729270000.123456789",
    "fbc": "fb.1.1729270000.AbCdEf123"
  },
  "custom_data": {
    "currency": "AED",
    "value": 500.00,
    "content_name": "12-Week Transformation Package",
    "content_category": "Personal Training",
    "content_ids": ["PACK-12W-TRANSFORM"],
    "num_items": 1
  },
  "event_source_url": "https://ptdfitness.com/checkout/success",
  "action_source": "website"
}
```

### Lead Event (MQL/SQL)
```json
{
  "event_name": "Lead",
  "event_time": 1729350000,
  "event_id": "LEAD-DXB-12345",
  "user_data": {
    "em": ["hashed_email"],
    "ph": ["hashed_971501234567"],
    "fn": "hashed_ahmed",
    "ln": "hashed_khalil",
    "ct": "hashed_dubai",
    "country": "hashed_ae",
    "external_id": "HUBSPOT_123456",
    "fbp": "fb.1.1729270000.123456789"
  },
  "custom_data": {
    "currency": "AED",
    "value": 0,                         // No value yet
    "content_name": "Marketing Qualified Lead",
    "content_category": "Lead Generation"
  },
  "event_source_url": "https://ptdfitness.com/contact",
  "action_source": "website"
}
```

### InitiateCheckout Event (Opportunity)
```json
{
  "event_name": "InitiateCheckout",
  "event_time": 1729350000,
  "event_id": "OPP-DXB-12345",
  "user_data": {
    "em": ["hashed_email"],
    "ph": ["hashed_971501234567"],
    "external_id": "HUBSPOT_123456",
    "fbp": "fb.1.1729270000.123456789"
  },
  "custom_data": {
    "currency": "AED",
    "value": 500.00,                    // Expected deal value
    "content_name": "12-Week Package - Consultation",
    "content_category": "Fitness Consultation"
  },
  "event_source_url": "https://ptdfitness.com/booking",
  "action_source": "website"
}
```

## Data Quality Checklist

### ✅ Must Have (Event Match Quality 8-10/10)
- [ ] fbp cookie (from website pixel)
- [ ] Email (hashed)
- [ ] Phone with country code (hashed, format: 971501234567)
- [ ] Event timestamp (within 7 days)
- [ ] Unique event_id (prevents duplicates)
- [ ] Accurate event_name (use standard events)

### ✅ Should Have (Event Match Quality 6-8/10)
- [ ] fbc click ID (from ad clicks)
- [ ] First name & Last name (hashed)
- [ ] City, State, Country (hashed)
- [ ] external_id (your system ID)
- [ ] Conversion value (for value-based optimization)
- [ ] Content parameters (name, category, ids)

### ⚠️ Nice to Have (Event Match Quality 4-6/10)
- [ ] Zip code
- [ ] Multiple emails/phones if available
- [ ] Complete transaction details
- [ ] Custom parameters

## Common Mistakes to Avoid

### ❌ DON'T:
1. **Hash fbp/fbc cookies** - These are Meta identifiers, send raw
2. **Send future timestamps** - Must be past events only
3. **Use milliseconds** - Use Unix seconds (10 digits)
4. **Send duplicate event_ids** - Use unique IDs per event
5. **Mix hashed and unhashed PII** - Hash all or none
6. **Send without email OR fbp** - Need at least one identifier
7. **Batch over 200 events** - Meta's limit
8. **Send stale events** - Best within 24 hours, max 7 days
9. **Forget to normalize** - Phone: +971 format, Email: lowercase

### ✅ DO:
1. **Always include fbp** if available from website pixel
2. **Use Unix seconds** for event_time
3. **Normalize before hashing** (lowercase email, format phone)
4. **Send real values** for Purchase events
5. **Use standard event names** (Purchase, Lead, InitiateCheckout)
6. **Include external_id** (HubSpot Contact ID)
7. **Batch 50-200 events** for efficiency
8. **Send within 24 hours** of occurrence
9. **Include content_name** for better attribution

## Database Schema Strategy

### capi_events_enriched Table Design

```sql
-- Raw data from HubSpot (PII NOT hashed)
email, phone, first_name, last_name, city, state, country, zip_code

-- Meta identifiers (NEVER hash)
fbp, fbc

-- HubSpot context
hubspot_contact_id, lifecycle_stage, lead_source, original_source

-- Stripe enrichment
stripe_customer_id, stripe_charge_id, payment_method, subscription_id

-- Event details
event_name, event_time, event_id, value, currency, content_name

-- Batch control
batch_id, batch_scheduled_for, send_status, sent_at, send_attempts

-- Meta response
meta_event_id, meta_response
```

**Why NOT hash in database:**
- Allows re-processing if Meta's requirements change
- Enables matching with Stripe/other systems
- Hashing happens at send-time in edge function

## Batch Timing Strategy

### Recommended Schedule

**Morning Batch (2:00 AM Dubai):**
- Process previous day's events
- Lower API traffic = better performance
- Allows overnight data collection

**Afternoon Batch (2:00 PM Dubai):**
- Process morning events
- Catches same-day conversions
- Better for time-sensitive campaigns

**Real-Time for High-Value:**
- VIP client purchases (> 5000 AED)
- Time-sensitive promotions
- Immediate conversion tracking

### Implementation
```javascript
// In batch_config table:
{
  config_name: "daily_morning_batch",
  batch_time: "02:00:00",
  timezone: "Asia/Dubai",
  batch_size: 200,
  enabled: true,
  days_of_week: [1,2,3,4,5,6,7],  // Every day
}
```

## Integration Architecture

### Complete Data Flow

```
┌─────────────┐
│   HubSpot   │ Contact lifecycle changes
└──────┬──────┘
       │ (API: /crm/v3/objects/contacts)
       │
       ▼
┌─────────────────────────────────────┐
│ sync-hubspot-to-capi Edge Function  │
│ • Fetch contacts with lifecycle     │
│ • Map lifecycle → Meta event        │
│ • Insert to capi_events_enriched    │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ enrich-with-stripe Edge Function    │
│ • Match email → Stripe customer     │
│ • Pull payment/subscription data    │
│ • Update value, payment_method      │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ capi_events_enriched Table          │
│ • send_status: 'pending'            │
│ • Complete user data                │
│ • Enriched value from Stripe        │
└──────┬──────────────────────────────┘
       │
       │ (Scheduled or manual trigger)
       ▼
┌─────────────────────────────────────┐
│ process-capi-batch Edge Function    │
│ • Fetch pending events (limit 200)  │
│ • Hash PII (SHA-256)                │
│ • Format for Meta CAPI              │
│ • Send to Stape gateway             │
│ • Update send_status: 'sent'        │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Stape CAPI Gateway                  │
│ URL: https://ap.stape.info          │
│ ID: ecxdsmmg                        │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Meta Conversions API                │
│ • Receives hashed data              │
│ • Matches to Meta users             │
│ • Feeds algorithm                   │
└─────────────────────────────────────┘
```

## API Endpoints

### 1. Sync HubSpot Contacts
```bash
POST /functions/v1/sync-hubspot-to-capi

Body:
{
  "contact_ids": ["12345", "67890"],  # Optional, sync specific
  "batch_scheduled_for": "2025-10-20T02:00:00Z",  # Optional
  "mode": "test"
}

Response:
{
  "success": true,
  "events_synced": 45,
  "events": [...]
}
```

### 2. Enrich with Stripe
```bash
POST /functions/v1/enrich-with-stripe

Body:
{
  "event_ids": ["uuid1", "uuid2"]  # Optional, enrich specific
}

Response:
{
  "success": true,
  "events_enriched": 32,
  "events": [...]
}
```

### 3. Process Batch
```bash
POST /functions/v1/process-capi-batch

Body:
{
  "batch_id": "uuid",      # Optional, create new if empty
  "limit": 200,
  "mode": "test"
}

Response:
{
  "success": true,
  "batch_id": "uuid",
  "events_processed": 150,
  "events_sent": 148,
  "events_failed": 2,
  "errors": [...]
}
```

## Testing & Validation

### Test Event Verification

**1. Send Test Event:**
```bash
# Via PTD Control → CAPI tab
Email: test@ptdfitness.com
Value: 100 AED
Use test_event_code: TEST12345
```

**2. Verify in Meta Events Manager:**
- Go to: Events Manager → Your Pixel → Test Events
- Look for event with matching email hash
- Check Event Match Quality score (aim for 8+/10)

**3. Check Data Enrichment:**
```sql
-- In Supabase SQL Editor
SELECT 
  event_id,
  event_name,
  email,
  value,
  stripe_customer_id,
  hubspot_contact_id,
  send_status,
  meta_response
FROM capi_events_enriched
WHERE mode = 'test'
ORDER BY created_at DESC
LIMIT 10;
```

### Production Validation

**Event Match Quality Requirements:**
- 8.0+/10: Excellent (50%+ match rate expected)
- 6.0-7.9: Good (30-50% match rate)
- <6.0: Poor (improve data quality)

**Monitor These Metrics:**
1. Events Received (in Meta Events Manager)
2. Event Match Quality score
3. Matched Events vs Total Events
4. Attribution in Ad Reports

## FAQ

**Q: Should I send every HubSpot contact change?**
A: No, only send meaningful lifecycle progressions:
- lead → Lead event
- opportunity → InitiateCheckout event  
- customer → Purchase event
- Skip: subscriber, evangelist, other stages

**Q: When should I use test mode vs live mode?**
A: 
- Test mode: Use test_event_code, verify in Test Events tab
- Live mode: Production events, affects ad optimization
- Always test with test_event_code first!

**Q: How often should batches run?**
A: 
- Minimum: Once daily (morning batch)
- Recommended: Twice daily (morning + afternoon)
- Optimal: Every 6 hours for recent data

**Q: What if Stripe customer doesn't exist?**
A: Send event anyway with HubSpot data. Even without Stripe enrichment, fbp + email provide strong matching.

**Q: Should I deduplicate events?**
A: Yes! Use unique event_id format:
- Purchase: `ORD-{location}-{id}`
- Lead: `LEAD-{source}-{contact_id}`
- Always check for existing event_id before inserting

**Q: How do I handle refunds?**
A: Don't send negative Purchase events. Meta handles this via attribution windows.

## Performance Optimization

### Database Indexes
```sql
-- Already created in migration:
idx_capi_enriched_send_status  -- Fast queue queries
idx_capi_enriched_batch_scheduled  -- Batch job queries
idx_capi_enriched_hubspot_id  -- HubSpot matching
idx_capi_enriched_stripe_id  -- Stripe matching
```

### Rate Limiting
- HubSpot API: 100 requests/10 seconds
- Stripe API: 100 requests/second
- Stape CAPI: No published limit (use 50ms delay between events)

### Error Handling
```javascript
// Retry logic for failed events:
if (send_attempts < 3 && send_status === 'failed') {
  // Retry after 1 hour
  retry_at = event.updated_at + 3600 seconds
}

// After 3 failures, mark as permanently failed
if (send_attempts >= 3) {
  send_status = 'permanently_failed'
  // Alert admin
}
```

## Security & Compliance

### PII Handling
- ✅ Store unhashed in database (encrypted at rest by Supabase)
- ✅ Hash with SHA-256 before sending to Meta
- ✅ Never log PII in edge function logs
- ✅ Use SECURITY DEFINER for database functions
- ✅ Enable RLS on all tables

### GDPR Compliance
- Allow users to request data deletion
- Remove from both database and Meta (use deletion API)
- Track consent status in HubSpot

## Monitoring Dashboard

### Key Metrics to Track

**Data Pipeline Health:**
1. Events synced from HubSpot (daily)
2. Enrichment success rate (Stripe matches)
3. Batch processing success rate
4. Average event age when sent

**Meta CAPI Performance:**
1. Events sent vs events received
2. Event match quality scores
3. Attribution in campaign reports
4. Conversion value accuracy

## Next Steps

1. ✅ Configure HubSpot API key (done)
2. ✅ Configure Stripe integration (done)
3. ✅ Set Stape CAPI credentials (done)
4. [ ] Test sync-hubspot-to-capi function
5. [ ] Test enrich-with-stripe function
6. [ ] Send test batch to Meta
7. [ ] Verify events in Meta Events Manager
8. [ ] Set up scheduled batch jobs (cron)
9. [ ] Monitor event match quality
10. [ ] Scale to production

## Support Resources

- [Meta CAPI Documentation](https://developers.facebook.com/docs/marketing-api/conversions-api)
- [Stape CAPI Gateway](https://app.stape.io)
- [HubSpot CRM API](https://developers.hubspot.com/docs/api/crm/contacts)
- [Stripe API Reference](https://docs.stripe.com/api)
