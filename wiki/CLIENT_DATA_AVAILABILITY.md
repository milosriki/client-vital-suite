# Client Data Availability Report

## 📊 Available Client Data Fields

### ✅ **Currently Tracked in `client_health_scores` Table**

#### **Core Client Information**
- `email` - Primary identifier
- `firstname`, `lastname` - Client name
- `client_id` - Internal client ID
- `hubspot_contact_id` - HubSpot integration ID
- `assigned_coach` - Coach assignment

#### **Health Scores (0-100)**
- `health_score` - Overall health score (0-100)
- `health_zone` - RED | YELLOW | GREEN | PURPLE
- `engagement_score` - Engagement level (0-100)
- `momentum_score` - Momentum indicator (0-100)
- `package_health_score` - Package utilization score (0-100)
- `relationship_score` - Relationship strength (0-100)
- `financial_score` - Financial health (0-100)
- `churn_risk_score` - Churn probability (0-100)

#### **Session Data** ✅
- `sessions_last_7d` - Sessions in last 7 days
- `sessions_last_30d` - Sessions in last 30 days
- `sessions_last_90d` - Sessions in last 90 days
- `outstanding_sessions` - Remaining sessions in package
- `purchased_sessions` - Total sessions purchased
- `days_since_last_session` - Days since last session
- `next_session_booked` - Boolean if next session is booked

#### **Package Information** ✅
- `package_type` - Type of package (e.g., "Premium", "Basic")
- `package_value_aed` - Package value in AED
- `days_until_renewal` - Days until package renewal

#### **Analytics & Insights**
- `client_segment` - ACTIVE_CONSISTENT | ACTIVE_SPORADIC | INACTIVE_RECENT | INACTIVE_LONG | CHURNED
- `health_trend` - improving | declining | stable
- `intervention_priority` - Priority level for interventions
- `calculated_on` - Date of calculation
- `calculated_at` - Timestamp of calculation
- `calculation_version` - Version of calculation algorithm

---

## 🔄 **How Data is Calculated**

### **Source: `health-calculator` Edge Function**
Location: `supabase/functions/health-calculator/index.ts`

#### **Engagement Score Formula:**
```typescript
- Base: 50 points
- +30 if sessions_last_7d >= 3
- +20 if sessions_last_7d >= 2
- +10 if sessions_last_7d >= 1
- +15 if sessions_last_30d >= 12
- +10 if sessions_last_30d >= 8
- -30 if days_since_last_session > 30
- -15 if days_since_last_session > 14
- -5 if days_since_last_session > 7
```

#### **Package Health Score Formula:**
```typescript
remaining_percent = (outstanding_sessions / purchased_sessions) × 100

Score:
- 90 if remaining >= 50%
- 70 if remaining >= 30%
- 50 if remaining >= 10%
- 30 if remaining < 10%
```

#### **Momentum Score Formula:**
```typescript
avg_weekly_7d = sessions_last_7d
avg_weekly_30d = sessions_last_30d / 4.3
rate_of_change = ((avg_weekly_7d - avg_weekly_30d) / avg_weekly_30d) × 100

Score:
- 90 if rate > +20% (ACCELERATING)
- 70 if rate > 0% (SLIGHTLY UP)
- 50 if rate between -20% and 0% (STABLE)
- 30 if rate < -20% (DECLINING)
```

---

## 📱 **Where Data is Used in UI**

### **1. Clients Page** (`src/pages/Clients.tsx`)
- ✅ Displays all clients with health scores
- ✅ Shows sessions_last_7d, sessions_last_30d, outstanding_sessions
- ✅ Filterable by health zone, segment, coach
- ✅ Search by name/email

### **2. Client Card Component** (`src/components/ClientCard.tsx`)
- ✅ Displays health score and zone
- ✅ Shows sessions_last_7d, sessions_last_30d, outstanding_sessions
- ✅ Shows assigned coach

### **3. Client Detail Page** (`src/pages/ClientDetail.tsx`)
- ✅ Full client profile view
- ✅ Historical health score trends
- ✅ Session history
- ✅ Package details

### **4. Dashboard** (`src/pages/Dashboard.tsx`)
- ✅ Zone distribution charts
- ✅ Client risk matrix
- ✅ Health score trends

### **5. Hooks Available**
- ✅ `useClientHealthScores()` - Fetch all client scores
- ✅ `useRealtimeHealthScores()` - Real-time updates

---

## ⚠️ **Data Source Requirements**

### **Where Does Session Data Come From?**

The `health-calculator` function expects client data with these fields:
- `sessions_last_7d`
- `sessions_last_30d`
- `sessions_last_90d`
- `outstanding_sessions`
- `sessions_purchased`
- `days_since_last_session`

**Current Status:** These fields are calculated/stored in `client_health_scores`, but the **source** of this data needs to be verified:

1. **HubSpot Integration?** - Check if sessions are synced from HubSpot
2. **Manual Entry?** - Check if there's a manual data entry system
3. **Booking System?** - Check if sessions come from a booking platform
4. **API Integration?** - Check if there's an API feeding session data

### **Where Does Package Data Come From?**

Package information (`package_type`, `package_value_aed`, `days_until_renewal`) is stored but needs source verification:

1. **Stripe Integration?** - Check `enrich-with-stripe` function
2. **HubSpot Deals?** - Check if packages are tracked as deals
3. **Manual Entry?** - Check if packages are manually entered

---

## 🔍 **Verification Needed**

### **Check These Functions:**
1. `sync-hubspot-to-supabase` - Does it sync session data?
2. `enrich-with-stripe` - Does it sync package/payment data?
3. `health-calculator` - What is the actual data source it queries?

### **Check These Tables:**
1. `appointments` - Are sessions stored here?
2. `deals` - Are packages stored as deals?
3. `contacts` - Is package info stored on contacts?

---

## 📋 **Summary**

### ✅ **What We HAVE:**
- ✅ Client health scores (calculated)
- ✅ Session counts (7d, 30d, 90d)
- ✅ Outstanding sessions
- ✅ Package type and value
- ✅ Days until renewal
- ✅ All displayed in UI

### ❓ **What We NEED TO VERIFY:**
- ❓ **Source of session data** - Where do sessions come from?
- ❓ **Source of package data** - Where do packages come from?
- ❓ **Data freshness** - How often is data updated?
- ❓ **Data accuracy** - Is the data accurate?

### 🔍 **Current Data Flow:**

#### **How `health-calculator` Works:**
1. Reads from `client_health_scores` table (existing records)
2. Recalculates scores based on existing session/package data
3. Updates records with new scores

**⚠️ IMPORTANT:** The `health-calculator` function **does NOT fetch** session/package data from external sources. It only **recalculates** scores from data already in the table.

#### **Where Session/Package Data Should Come From:**
Based on code analysis:
- **HubSpot Sync** (`sync-hubspot-to-supabase`) - Syncs contacts/deals but **NOT** session/package data
- **Manual Entry** - Data may need to be entered manually
- **Booking System** - If you have a booking platform, it should sync sessions
- **Stripe Integration** - May have package purchase data

### 🎯 **Next Steps:**
1. ✅ **Verify Data Source** - Check where sessions are actually tracked
2. ✅ **Check HubSpot Properties** - Verify if HubSpot has custom properties for sessions/packages
3. ✅ **Check Booking System** - If you use a booking platform, integrate it
4. ✅ **Manual Entry Option** - Consider adding UI for manual session/package entry
5. ✅ **Data Pipeline** - Set up automated sync if data comes from external system

---

## 🚀 **Usage Examples**

### **Query Client Health Scores:**
```typescript
import { useClientHealthScores } from '@/hooks/useClientHealthScores';

const { data: clients } = useClientHealthScores({
  healthZone: 'RED',
  segment: 'INACTIVE_RECENT',
  coach: 'John Doe'
});
```

### **Access Session Data:**
```typescript
clients.forEach(client => {
  console.log(`${client.email}:`);
  console.log(`  Sessions (7d): ${client.sessions_last_7d}`);
  console.log(`  Sessions (30d): ${client.sessions_last_30d}`);
  console.log(`  Outstanding: ${client.outstanding_sessions}`);
  console.log(`  Package: ${client.package_type} (${client.package_value_aed} AED)`);
});
```

---

**Last Updated:** 2025-01-13
**Status:** ✅ Data structure exists | ⚠️ Source verification needed
