# 📊 HubSpot Contacts & Leads - Complete Data Guide

## ✅ **CURRENTLY SYNCED DATA**

### **Basic Contact Information** ✅

**Fields Synced:**
- ✅ `hubspot_contact_id` - HubSpot ID
- ✅ `email` - Email address
- ✅ `first_name` - First name
- ✅ `last_name` - Last name
- ✅ `phone` - Phone number (or mobilephone)
- ✅ `city` - City
- ✅ `location` - Location
- ✅ `neighborhood` - Neighborhood
- ✅ `job_title` - Job title

### **Ownership & Assignment** ✅

- ✅ `owner_id` - HubSpot owner ID
- ✅ `owner_name` - Owner name (mapped)
- ✅ `hubspot_team` - Team ID
- ✅ `count_of_reassignations` - Reassignment count

### **Lifecycle & Status** ✅

- ✅ `lifecycle_stage` - Lifecycle stage (lead, mql, sql, customer, etc.)
- ✅ `custom_lifecycle_stage` - Custom stage
- ✅ `lead_status` - Lead status (hs_lead_status)
- ✅ `status` - General status
- ✅ `contact_unworked` - Unworked flag
- ✅ `currently_in_prospecting` - In prospecting flag

### **Engagement & Activity** ✅

- ✅ `call_attempt_count` - Number of call attempts
- ✅ `last_activity_date` - Last activity timestamp
- ✅ `first_outbound_call_time` - First call time
- ✅ `speed_to_lead_minutes` - Speed to lead
- ✅ `sla_first_touch` - SLA first touch description
- ✅ `time_of_entry` - Entry timestamp

### **Conversion & Forms** ✅

- ✅ `first_conversion_date` - First conversion date
- ✅ `num_form_submissions` - Form submission count
- ✅ `num_unique_forms_submitted` - Unique forms count
- ✅ `recent_conversion` - Recent conversion event
- ✅ `recent_conversion_date` - Recent conversion date
- ✅ `member_accessed_private_content` - Private content access count
- ✅ `registered_member` - Registered member count

### **Attribution & Traffic** ✅

- ✅ `latest_traffic_source` - Latest traffic source
- ✅ `latest_traffic_source_2` - Secondary traffic source
- ✅ `first_touch_source` - First touch source
- ✅ `first_touch_time` - First touch timestamp
- ✅ `last_touch_source` - Last touch source
- ✅ `last_touch_time` - Last touch timestamp
- ✅ `email_domain` - Email domain

### **Additional Data** ✅

- ✅ `facebook_id` - Facebook ID
- ✅ `google_id` - Google ID
- ✅ `ghl_contact_id` - GoHighLevel contact ID
- ✅ `segment_memberships` - Segment memberships array
- ✅ `total_events` - Total events count
- ✅ `total_value` - Total value
- ✅ `delegation_date` - Delegation date
- ✅ `created_at` - Created timestamp
- ✅ `updated_at` - Updated timestamp

---

## ⚠️ **MISSING / COULD BE ADDED**

### **1. Company Information** ⚠️

**Not Currently Synced:**
- ⚠️ `company_name` - Company name
- ⚠️ `company_id` - HubSpot company ID
- ⚠️ `company_size` - Company size
- ⚠️ `industry` - Industry
- ⚠️ `website` - Website URL
- ⚠️ `company_domain` - Company domain

**How to Add:**
```sql
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS company_id TEXT,
ADD COLUMN IF NOT EXISTS company_size TEXT,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS company_domain TEXT;
```

**Sync Code:**
```typescript
// In sync-hubspot-to-supabase/index.ts
properties: [
  // ... existing properties
  'company', 'company_name', 'company_size', 'industry', 'website', 'domain'
]
```

---

### **2. Deal & Revenue Information** ⚠️

**Not Currently Synced:**
- ⚠️ `associated_deal_ids` - Array of deal IDs
- ⚠️ `total_deal_value` - Total deal value
- ⚠️ `open_deal_value` - Open deal value
- ⚠️ `closed_deal_value` - Closed deal value
- ⚠️ `num_associated_deals` - Number of deals
- ⚠️ `last_deal_created_date` - Last deal created

**How to Add:**
```sql
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS associated_deal_ids TEXT[],
ADD COLUMN IF NOT EXISTS total_deal_value DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS open_deal_value DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS closed_deal_value DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_associated_deals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_deal_created_date TIMESTAMPTZ;
```

**Sync Code:**
```typescript
properties: [
  // ... existing properties
  'num_associated_deals', 'total_revenue', 'hs_analytics_num_visits',
  'hs_analytics_num_page_views', 'hs_analytics_num_event_completions'
]
```

---

### **3. Communication Preferences** ⚠️

**Not Currently Synced:**
- ⚠️ `email_opt_out` - Email opt-out status
- ⚠️ `marketing_opt_out` - Marketing opt-out
- ⚠️ `preferred_contact_method` - Preferred method
- ⚠️ `timezone` - Timezone
- ⚠️ `language` - Language preference

**How to Add:**
```sql
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS marketing_opt_out BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT,
ADD COLUMN IF NOT EXISTS language TEXT;
```

---

### **4. Social Media & Online Presence** ⚠️

**Not Currently Synced:**
- ⚠️ `twitterhandle` - Twitter handle
- ⚠️ `linkedinbio` - LinkedIn bio
- ⚠️ `linkedinconnections` - LinkedIn connections
- ⚠️ `twitterfollowers` - Twitter followers
- ⚠️ `klout_score` - Klout score

**How to Add:**
```sql
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS twitter_handle TEXT,
ADD COLUMN IF NOT EXISTS linkedin_bio TEXT,
ADD COLUMN IF NOT EXISTS linkedin_connections INTEGER,
ADD COLUMN IF NOT EXISTS twitter_followers INTEGER,
ADD COLUMN IF NOT EXISTS klout_score INTEGER;
```

---

### **5. Engagement Scores** ⚠️

**Not Currently Synced:**
- ⚠️ `hs_lead_status` - Lead status (already synced as `lead_status`)
- ⚠️ `hs_analytics_score` - Analytics score
- ⚠️ `hs_social_facebook_clicks` - Facebook clicks
- ⚠️ `hs_social_twitter_clicks` - Twitter clicks
- ⚠️ `hs_social_linkedin_clicks` - LinkedIn clicks
- ⚠️ `num_notes` - Number of notes
- ⚠️ `num_meetings` - Number of meetings
- ⚠️ `num_emails` - Number of emails

**How to Add:**
```sql
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS analytics_score INTEGER,
ADD COLUMN IF NOT EXISTS facebook_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS twitter_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS linkedin_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_notes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_meetings INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_emails INTEGER DEFAULT 0;
```

---

### **6. Custom Properties** ⚠️

**Your HubSpot may have custom properties like:**
- ⚠️ `assigned_coach` - Assigned coach (seen in fetch-hubspot-live)
- ⚠️ `assessment_scheduled` - Assessment scheduled
- ⚠️ `assessment_date` - Assessment date
- ⚠️ `package_type` - Package type
- ⚠️ `sessions_purchased` - Sessions purchased
- ⚠️ `outstanding_sessions` - Outstanding sessions
- ⚠️ `coach_notes` - Coach notes
- ⚠️ `preferred_location` - Preferred location
- ⚠️ `fitness_goals` - Fitness goals

**How to Add (Example):**
```sql
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS assigned_coach TEXT,
ADD COLUMN IF NOT EXISTS assessment_scheduled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS assessment_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS package_type TEXT,
ADD COLUMN IF NOT EXISTS sessions_purchased INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS outstanding_sessions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS coach_notes TEXT,
ADD COLUMN IF NOT EXISTS preferred_location TEXT,
ADD COLUMN IF NOT EXISTS fitness_goals TEXT;
```

---

### **7. Activity Timeline** ⚠️

**Currently:** Basic activity tracking exists
**Could Enhance:**
- ⚠️ Full activity timeline (emails, calls, meetings, notes)
- ⚠️ Activity frequency
- ⚠️ Last email sent date
- ⚠️ Last email opened date
- ⚠️ Last email clicked date
- ⚠️ Last meeting date
- ⚠️ Next meeting date

**Table Already Exists:** `contact_activities`
**Enhancement:** Sync more activity types

---

## 🔧 **HOW TO ADD MORE FIELDS**

### **Step 1: Add Database Columns**

Create a migration:
```sql
-- Migration: add_more_hubspot_fields.sql
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS company_id TEXT,
ADD COLUMN IF NOT EXISTS total_deal_value DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_associated_deals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS assigned_coach TEXT,
ADD COLUMN IF NOT EXISTS assessment_scheduled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS assessment_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS analytics_score INTEGER,
ADD COLUMN IF NOT EXISTS num_notes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_meetings INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_emails INTEGER DEFAULT 0;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_contacts_company ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_coach ON public.contacts(assigned_coach);
CREATE INDEX IF NOT EXISTS idx_contacts_assessment ON public.contacts(assessment_date);
```

### **Step 2: Update Sync Function**

Edit `supabase/functions/sync-hubspot-to-supabase/index.ts`:

```typescript
// Add to properties array (line ~158)
properties: [
  // ... existing properties
  'company', 'company_name', 'company_size', 'industry', 'website', 'domain',
  'num_associated_deals', 'total_revenue', 'hs_analytics_score',
  'assigned_coach', 'assessment_scheduled', 'assessment_date',
  'num_notes', 'num_meetings', 'num_emails',
  'hs_social_facebook_clicks', 'hs_social_twitter_clicks', 'hs_social_linkedin_clicks'
]

// Add to mapping (line ~179)
return {
  // ... existing fields
  company_name: props.company || props.company_name,
  company_id: props.company_id || null,
  total_deal_value: parseFloat(props.total_revenue) || 0,
  num_associated_deals: parseInt(props.num_associated_deals) || 0,
  assigned_coach: props.assigned_coach,
  assessment_scheduled: props.assessment_scheduled === 'true' || props.assessment_scheduled === true,
  assessment_date: props.assessment_date || null,
  analytics_score: parseInt(props.hs_analytics_score) || 0,
  num_notes: parseInt(props.num_notes) || 0,
  num_meetings: parseInt(props.num_meetings) || 0,
  num_emails: parseInt(props.num_emails) || 0,
  // ... rest of fields
};
```

### **Step 3: Update TypeScript Types**

Run:
```bash
supabase gen types typescript --project-id ztjndilxurtsfqdsvfds > src/integrations/supabase/types.ts
```

---

## 📋 **RECOMMENDED ADDITIONS**

### **Priority 1: High Value** 🔴

1. **Company Information**
   - Company name, size, industry
   - Helps with B2B targeting

2. **Deal Information**
   - Associated deals, deal value
   - Revenue tracking

3. **Custom Properties**
   - `assigned_coach` - Already referenced in code
   - `assessment_scheduled` - Already referenced in code
   - `assessment_date` - Already referenced in code

### **Priority 2: Medium Value** 🟡

4. **Engagement Scores**
   - Analytics score
   - Social media engagement

5. **Activity Counts**
   - Notes, meetings, emails count
   - Better engagement tracking

### **Priority 3: Nice to Have** 🟢

6. **Communication Preferences**
   - Opt-out status
   - Preferred contact method

7. **Social Media**
   - LinkedIn, Twitter data
   - Social engagement

---

## 🚀 **QUICK IMPLEMENTATION**

### **Add Most Important Fields:**

```sql
-- Quick migration for priority fields
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS company_id TEXT,
ADD COLUMN IF NOT EXISTS total_deal_value DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_associated_deals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS assigned_coach TEXT,
ADD COLUMN IF NOT EXISTS assessment_scheduled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS assessment_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS analytics_score INTEGER,
ADD COLUMN IF NOT EXISTS num_notes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_meetings INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_emails INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_contacts_company ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_coach ON public.contacts(assigned_coach);
```

Then update sync function to include these properties.

---

## 📊 **CURRENT DATA SUMMARY**

### **What You Have:**
- ✅ **30+ contact fields** synced
- ✅ **Basic info** (name, email, phone)
- ✅ **Lifecycle tracking** (stages, status)
- ✅ **Engagement data** (calls, forms, conversions)
- ✅ **Attribution** (traffic sources, touchpoints)
- ✅ **Activity tracking** (last activity, call attempts)

### **What's Missing:**
- ⚠️ **Company data** (name, size, industry)
- ⚠️ **Deal data** (associated deals, revenue)
- ⚠️ **Custom properties** (coach, assessment, package)
- ⚠️ **Engagement scores** (analytics score, social clicks)
- ⚠️ **Activity counts** (notes, meetings, emails)

---

## ✅ **NEXT STEPS**

1. **Review your HubSpot custom properties**
   - Check which custom fields you use
   - Identify most important ones

2. **Create migration** for new fields
   - Use SQL above as template
   - Add your custom properties

3. **Update sync function**
   - Add properties to fetch list
   - Map to database columns

4. **Test sync**
   - Run sync function
   - Verify data populated

5. **Update frontend**
   - Display new fields
   - Add filters/search

---

**Want me to create the migration and update the sync function?** 🚀
