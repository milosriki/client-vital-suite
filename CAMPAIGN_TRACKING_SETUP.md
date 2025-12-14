# 🎯 Campaign Tracking & Control Setup

## ✅ **UPDATED ARCHITECTURE**

### **1. Stape is Now Optional**
- ✅ **Works without Stape key** - Events stored but not sent to Meta CAPI
- ✅ **Add Stape key later** - Just set `STAPE_CAPIG_API_KEY` in Supabase secrets
- ✅ **No breaking changes** - System continues to work

### **2. HubSpot Native AnyTrack Integration**
- ✅ **Use HubSpot's native AnyTrack connection** (not our webhook)
- ✅ **HubSpot sends webhooks** when AnyTrack events occur
- ✅ **New function:** `hubspot-anytrack-webhook` receives HubSpot webhooks
- ✅ **Automatic attribution tracking** from HubSpot properties

### **3. Dynamic Facebook Campaign Tracking**
- ✅ **Extracts campaign/ad data** from events automatically
- ✅ **No hardcoded ads** - Tracks all campaigns dynamically
- ✅ **Campaign performance view** - See which campaigns generate leads
- ✅ **Facebook campaign ID, Ad ID, Adset ID** tracking

---

## 🔧 **SETUP INSTRUCTIONS**

### **Step 1: Configure HubSpot Native AnyTrack**

1. **In HubSpot:**
   - Go to **Settings** → **Integrations** → **AnyTrack**
   - Connect AnyTrack account
   - Enable webhooks for:
     - Contact creation/updates
     - Deal creation/updates
     - Lifecycle stage changes

2. **Set Webhook URL:**
   ```
   https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/hubspot-anytrack-webhook
   ```

3. **HubSpot will automatically send:**
   - Contact events with AnyTrack attribution
   - Deal events with conversion data
   - Campaign/ad information in properties

---

### **Step 2: Apply Campaign Tracking Migration**

```bash
# Apply migration to add campaign tracking columns
supabase db push
```

**Or manually:**
```sql
-- Run migration: 20251215000003_add_campaign_tracking.sql
```

---

### **Step 3: (Optional) Add Stape Key**

**If you want to send events to Facebook CAPI:**

```bash
# Set Stape API key in Supabase secrets
supabase secrets set STAPE_CAPIG_API_KEY=your_stape_key_here --project-ref ztjndilxurtsfqdsvfds
```

**If no key:** Events are stored but not sent to Meta CAPI (still tracked in your system)

---

## 📊 **CAMPAIGN TRACKING DATA**

### **What Gets Tracked:**

1. **Campaign Information:**
   - Campaign ID (`fb_campaign_id`)
   - Campaign Name (`fb_campaign_name`)
   - Source (`source`)
   - Medium (`medium`)
   - UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`)

2. **Facebook Ad Details:**
   - Ad ID (`fb_ad_id`)
   - Ad Name (`fb_ad_name`)
   - Adset ID (`fb_adset_id`)
   - Adset Name (`fb_adset_name`)

3. **Attribution Data:**
   - First touch source
   - Last touch source
   - Multi-touch attribution
   - Click IDs (fbclid, gclid)

---

## 🎯 **CAMPAIGN PERFORMANCE VIEW**

### **Query Campaign Performance:**

```sql
-- See all campaigns and their performance
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

---

## 🔍 **HOW IT WORKS**

### **Data Flow:**

```
HubSpot (Native AnyTrack)
    ↓
Webhook → hubspot-anytrack-webhook Edge Function
    ↓
Extract Campaign/Ad Data
    ↓
Store in events + attribution_events tables
    ↓
Campaign Performance View (auto-aggregated)
```

### **Facebook Campaign Detection:**

The system automatically extracts Facebook campaign data from:

1. **HubSpot Properties:**
   - `hs_analytics_campaign_id`
   - `hs_analytics_first_touch_converting_campaign`
   - `fbclid` (Facebook click ID)
   - Custom properties set by AnyTrack

2. **AnyTrack Attribution:**
   - `mainAttribution.source` = "facebook"
   - `mainAttribution.campaign`
   - `fbclid` parameter

3. **Event Metadata:**
   - `meta.attributions` array
   - `custom.fb_campaign_id`
   - `custom.fb_ad_id`

---

## 📈 **CAMPAIGN CONTROL DASHBOARD**

### **View in Supabase Dashboard:**

1. **Table Editor:**
   - `attribution_events` → Filter by `source = 'facebook'`
   - See campaign IDs, ad IDs, performance

2. **SQL Editor:**
   - Run `SELECT * FROM campaign_performance`
   - See aggregated campaign metrics

3. **Custom Dashboard (Future):**
   - Build React component using `campaign_performance` view
   - Show real-time campaign performance
   - Filter by date range, source, campaign

---

## ✅ **VERIFICATION**

### **Check Campaign Tracking:**

```sql
-- See recent Facebook campaigns
SELECT 
  fb_campaign_id,
  fb_campaign_name,
  campaign,
  source,
  COUNT(*) as events,
  SUM(value) as total_value,
  COUNT(DISTINCT email) as unique_leads
FROM attribution_events
WHERE source = 'facebook' OR fb_campaign_id IS NOT NULL
GROUP BY fb_campaign_id, fb_campaign_name, campaign, source
ORDER BY events DESC
LIMIT 10;
```

### **Check HubSpot AnyTrack Webhook:**

```sql
-- See events from HubSpot native AnyTrack
SELECT 
  event_id,
  event_name,
  event_time,
  custom->>'source_attribution' as source,
  custom->>'campaign' as campaign,
  custom->>'fb_campaign_id' as fb_campaign_id
FROM events
WHERE source = 'hubspot_anytrack'
ORDER BY event_time DESC
LIMIT 10;
```

---

## 🎯 **BENEFITS**

### **✅ Dynamic Campaign Tracking:**
- No hardcoded ads
- Automatically tracks all campaigns
- Works with new campaigns immediately

### **✅ Native HubSpot Integration:**
- Uses HubSpot's built-in AnyTrack connection
- No duplicate webhooks
- Better data quality

### **✅ Optional Stape:**
- System works without Stape key
- Add key when ready
- No breaking changes

### **✅ Campaign Visibility:**
- See which campaigns generate leads
- Track ROI per campaign
- Optimize ad spend

---

## 📝 **NEXT STEPS**

1. ✅ **Apply migration** - Add campaign tracking columns
2. ✅ **Configure HubSpot webhook** - Point to `hubspot-anytrack-webhook`
3. ✅ **Test webhook** - Create test contact/deal in HubSpot
4. ✅ **Verify campaign data** - Check `attribution_events` table
5. ✅ **(Optional) Add Stape key** - Enable Facebook CAPI sending

---

**Status:** 🟢 Ready to deploy  
**Last Updated:** 2025-12-15
