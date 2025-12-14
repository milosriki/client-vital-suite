# ✅ Campaign Tracking Setup Complete

## 🎯 **WHAT'S BEEN UPDATED**

### **1. Stape is Now Optional** ✅
- ✅ **`process-capi-batch`** - Works without Stape key (stores events, doesn't send)
- ✅ **`send-to-stape-capi`** - Returns success if no key (doesn't throw error)
- ✅ **Add Stape key later** - Just set `STAPE_CAPIG_API_KEY` in Supabase secrets

### **2. HubSpot Native AnyTrack Integration** ✅
- ✅ **New function:** `hubspot-anytrack-webhook`
- ✅ **Receives webhooks** from HubSpot when AnyTrack events occur
- ✅ **Extracts campaign/ad data** automatically
- ✅ **Tracks Facebook campaigns** dynamically

### **3. Dynamic Campaign Tracking** ✅
- ✅ **Migration applied:** `add_campaign_tracking`
- ✅ **New columns:** `fb_campaign_id`, `fb_ad_id`, `fb_adset_id`, etc.
- ✅ **Campaign performance view:** `campaign_performance`
- ✅ **No hardcoded ads** - Tracks all campaigns automatically

---

## 🔧 **NEXT STEPS**

### **Step 1: Configure HubSpot Webhook**

1. **In HubSpot Dashboard:**
   - Go to **Settings** → **Integrations** → **AnyTrack**
   - Connect your AnyTrack account (if not already connected)
   - Go to **Settings** → **Integrations** → **Webhooks**
   - Create new webhook subscription:
     - **Event:** Contact creation, Contact property changes, Deal creation, Deal property changes
     - **URL:** `https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/hubspot-anytrack-webhook`
     - **Method:** POST

2. **Test the webhook:**
   - Create a test contact in HubSpot
   - Check Supabase logs: `supabase functions logs hubspot-anytrack-webhook`
   - Verify event appears in `events` table with `source = 'hubspot_anytrack'`

### **Step 2: (Optional) Add Stape Key**

**Only if you want to send events to Facebook CAPI:**

```bash
supabase secrets set STAPE_CAPIG_API_KEY=your_key_here --project-ref ztjndilxurtsfqdsvfds
```

**If no key:** System works fine, events are stored but not sent to Meta CAPI.

---

## 📊 **VIEW CAMPAIGN DATA**

### **Query Campaign Performance:**

```sql
-- See all campaigns
SELECT * FROM campaign_performance 
ORDER BY total_value DESC;

-- See Facebook campaigns specifically
SELECT * FROM campaign_performance 
WHERE source = 'facebook'
ORDER BY purchases DESC;

-- See which campaigns generate leads
SELECT 
  campaign_name,
  source,
  leads,
  purchases,
  total_value,
  unique_leads
FROM campaign_performance
WHERE leads > 0
ORDER BY leads DESC;
```

### **View Recent Facebook Campaign Events:**

```sql
SELECT 
  event_id,
  event_name,
  event_time,
  fb_campaign_id,
  fb_campaign_name,
  fb_ad_id,
  fb_ad_name,
  campaign,
  source,
  value,
  email
FROM attribution_events
WHERE source = 'facebook' OR fb_campaign_id IS NOT NULL
ORDER BY event_time DESC
LIMIT 20;
```

---

## ✅ **VERIFICATION**

### **Check Migration Applied:**

```sql
-- Check campaign columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'attribution_events' 
  AND column_name LIKE 'fb_%';
```

### **Check Function Deployed:**

```bash
# List all functions
supabase functions list

# Should see: hubspot-anytrack-webhook
```

### **Test HubSpot Webhook:**

```bash
# Watch logs
supabase functions logs hubspot-anytrack-webhook --follow

# Create test contact in HubSpot, then check logs
```

---

## 🎯 **HOW IT WORKS**

### **Data Flow:**

```
HubSpot (Native AnyTrack Connected)
    ↓
AnyTrack Event Occurs
    ↓
HubSpot Sends Webhook
    ↓
hubspot-anytrack-webhook Edge Function
    ↓
Extract Campaign/Ad Data
    ↓
Store in events + attribution_events
    ↓
Campaign Performance View (auto-updated)
```

### **Campaign Detection:**

The system automatically extracts Facebook campaign data from:

1. **HubSpot Properties:**
   - `hs_analytics_campaign_id`
   - `hs_analytics_first_touch_converting_campaign`
   - `fbclid` (Facebook click ID)
   - Custom properties from AnyTrack

2. **AnyTrack Attribution:**
   - `mainAttribution.source` = "facebook"
   - `mainAttribution.campaign`
   - `fbclid` parameter

3. **Event Metadata:**
   - `meta.attributions` array
   - `custom.fb_campaign_id`
   - `custom.fb_ad_id`

---

## 📈 **BENEFITS**

✅ **No Hardcoded Ads** - Automatically tracks all campaigns  
✅ **Native HubSpot Integration** - Uses HubSpot's built-in AnyTrack connection  
✅ **Optional Stape** - System works without Stape key  
✅ **Campaign Visibility** - See which campaigns generate leads  
✅ **Dynamic Tracking** - Works with new campaigns immediately  

---

**Status:** 🟢 **READY TO USE**

**Functions Deployed:**
- ✅ `hubspot-anytrack-webhook` (new)
- ✅ `process-capi-batch` (updated - Stape optional)
- ✅ `send-to-stape-capi` (updated - Stape optional)

**Database:**
- ✅ Migration applied: `add_campaign_tracking`
- ✅ View created: `campaign_performance`

**Next:** Configure HubSpot webhook URL → Test → View campaigns!
