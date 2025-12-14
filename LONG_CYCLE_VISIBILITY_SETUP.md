# 🎯 Long Sales Cycle Visibility & Protection Setup

## ✅ **WHAT'S BEEN CREATED**

### **1. Unified Customer Journey View** ✅
- **View:** `customer_journey_view`
- **Shows:** AnyTrack events + Calendly appointments + Calls + Lifecycle stages
- **Metrics:** Days since touches, engagement scores, risk indicators

### **2. Journey Timeline Events View** ✅
- **View:** `journey_timeline_events`
- **Shows:** Chronological timeline of ALL events (AnyTrack, Calls, Appointments, Lifecycle changes)
- **Use:** See full customer journey in one place

### **3. Long Cycle Protection View** ✅
- **View:** `long_cycle_protection`
- **Purpose:** **Prevents closing leads too early**
- **Shows:** Warnings, recommendations, recent activity flags
- **Alerts:** 🚨 DO NOT CLOSE warnings when there's recent activity

### **4. Calendly Webhook Function** ✅
- **Function:** `calendly-webhook`
- **Receives:** Calendly appointment events (scheduled, completed, cancelled, no-show)
- **Stores:** Appointments in `appointments` table
- **Links:** To contacts by email automatically

---

## 📊 **HOW TO USE**

### **1. View Full Customer Journey:**

```sql
-- See complete journey for a contact
SELECT * FROM customer_journey_view 
WHERE email = 'customer@example.com';

-- See all long cycles with recent activity
SELECT 
  email,
  first_name,
  lifecycle_stage,
  days_in_cycle,
  days_since_last_touch,
  total_calls,
  total_appointments,
  anytrack_events,
  close_risk,
  warning_dont_close
FROM customer_journey_view
WHERE cycle_length = 'long_cycle'
  AND warning_dont_close = true
ORDER BY days_since_last_touch ASC;
```

### **2. Check Before Closing a Lead:**

```sql
-- ALWAYS check this before closing a lead!
SELECT 
  email,
  first_name,
  lifecycle_stage,
  closure_recommendation,
  days_in_cycle,
  days_since_call,
  days_since_appointment,
  days_since_anytrack,
  recent_call,
  recent_appointment,
  has_upcoming_appointment,
  total_calls,
  total_appointments,
  appointment_completion_rate
FROM long_cycle_protection
WHERE email = 'lead@example.com';
```

**Look for:**
- 🚨 **DO NOT CLOSE** warnings
- ⚠️ **WAIT** recommendations
- Recent activity flags (recent_call, recent_appointment)
- Upcoming appointments

### **3. See Timeline of All Events:**

```sql
-- Complete timeline for a contact
SELECT 
  event_date,
  event_source,
  event_type,
  event_description,
  campaign_name,
  attribution_source
FROM journey_timeline_events
WHERE email = 'customer@example.com'
ORDER BY event_date DESC;
```

### **4. Compare Calls vs Appointments:**

```sql
-- See call-to-appointment conversion
SELECT 
  email,
  first_name,
  total_calls,
  completed_calls,
  total_appointments,
  completed_appointments,
  CASE 
    WHEN total_calls > 0 
    THEN ROUND((total_appointments::numeric / total_calls) * 100, 1)
    ELSE 0
  END as call_to_appointment_rate,
  CASE 
    WHEN total_appointments > 0 
    THEN ROUND((completed_appointments::numeric / total_appointments) * 100, 1)
    ELSE 0
  END as appointment_completion_rate
FROM customer_journey_view
WHERE total_calls > 0 OR total_appointments > 0
ORDER BY total_calls DESC;
```

---

## 🚨 **PROTECTION RULES**

### **DO NOT CLOSE IF:**
1. ✅ **Recent call** (< 7 days)
2. ✅ **Recent appointment** (< 14 days)
3. ✅ **Upcoming appointment** scheduled
4. ✅ **Recent AnyTrack activity** (< 7 days)
5. ✅ **Long cycle** (> 60 days) but still engaged
6. ✅ **Multiple touches** (> 5) with recent activity

### **SAFE TO CLOSE IF:**
- ❌ No calls > 30 days
- ❌ No appointments > 30 days
- ❌ No AnyTrack activity > 30 days
- ❌ No upcoming appointments
- ❌ Short cycle (< 30 days) with no engagement

---

## 🔧 **SETUP CALENDLY WEBHOOK**

### **Step 1: Configure in Calendly**

1. **Go to Calendly Settings** → **Integrations** → **Webhooks**
2. **Create New Webhook:**
   - **URL:** `https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/calendly-webhook`
   - **Events:** 
     - ✅ `invitee.created` (Appointment scheduled)
     - ✅ `invitee.canceled` (Appointment cancelled)
     - ✅ `invitee.updated` (Appointment rescheduled)
3. **Save webhook**

### **Step 2: Test**

Create a test appointment in Calendly, then check:

```sql
-- See recent appointments
SELECT * FROM appointments 
ORDER BY created_at DESC 
LIMIT 10;

-- Check if linked to contacts
SELECT 
  a.title,
  a.start_time,
  a.status,
  c.email,
  c.first_name
FROM appointments a
LEFT JOIN contacts c ON c.id = a.contact_id
ORDER BY a.created_at DESC;
```

---

## 📈 **VISIBILITY DASHBOARD QUERIES**

### **1. Long Cycles Still Active:**

```sql
SELECT 
  email,
  first_name,
  days_in_cycle,
  days_since_last_touch,
  total_calls,
  total_appointments,
  engagement_score,
  close_risk
FROM customer_journey_view
WHERE cycle_length = 'long_cycle'
  AND warning_dont_close = true
ORDER BY engagement_score DESC;
```

### **2. Leads at Risk of Premature Closure:**

```sql
SELECT 
  email,
  first_name,
  lifecycle_stage,
  closure_recommendation,
  days_since_call,
  days_since_appointment,
  has_upcoming_appointment
FROM long_cycle_protection
WHERE closure_recommendation LIKE '🚨%'
ORDER BY days_since_last_touch ASC;
```

### **3. Call vs Appointment Performance:**

```sql
SELECT 
  COUNT(*) as total_leads,
  AVG(total_calls) as avg_calls_per_lead,
  AVG(total_appointments) as avg_appointments_per_lead,
  AVG(CASE WHEN total_calls > 0 THEN (total_appointments::numeric / total_calls) * 100 ELSE 0 END) as avg_call_to_appointment_rate,
  AVG(CASE WHEN total_appointments > 0 THEN (completed_appointments::numeric / total_appointments) * 100 ELSE 0 END) as avg_appointment_completion_rate
FROM customer_journey_view
WHERE total_calls > 0 OR total_appointments > 0;
```

---

## ✅ **VERIFICATION**

### **Check Views Created:**

```sql
-- List all views
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name LIKE '%journey%' OR table_name LIKE '%cycle%' OR table_name LIKE '%protection%';
```

### **Test Long Cycle Protection:**

```sql
-- Find a lead and check protection
SELECT * FROM long_cycle_protection 
WHERE email = 'test@example.com';
```

---

## 🎯 **BEST PRACTICES**

### **Before Closing ANY Lead:**

1. ✅ **Check `long_cycle_protection` view**
2. ✅ **Look for 🚨 warnings**
3. ✅ **Check recent activity** (calls, appointments, AnyTrack)
4. ✅ **Verify no upcoming appointments**
5. ✅ **Review full timeline** in `journey_timeline_events`

### **For Long Cycles:**

- ✅ **Don't kill leads** with recent activity
- ✅ **Track engagement score** (should be > 50)
- ✅ **Compare calls to appointments** (conversion rate)
- ✅ **Wait for natural conclusion** (no activity > 30 days)

---

**Status:** 🟢 **READY TO USE**

**Views Created:**
- ✅ `customer_journey_view` - Unified journey metrics
- ✅ `journey_timeline_events` - Chronological timeline
- ✅ `long_cycle_protection` - Closure warnings

**Function Created:**
- ✅ `calendly-webhook` - Receives Calendly events

**Next:** Configure Calendly webhook → Test → Use views before closing leads!
