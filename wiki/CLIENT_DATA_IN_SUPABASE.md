# 📊 Client Data in Supabase - Scores, Packages, Sessions

## ✅ **YES - ALL CLIENT DATA IS IN SUPABASE**

Your system stores **comprehensive client data** in Supabase, including:
- ✅ Health scores
- ✅ Package information
- ✅ Session counts
- ✅ Engagement metrics
- ✅ Churn risk scores

---

## 🗄️ **MAIN TABLE: `client_health_scores`**

**Location:** `public.client_health_scores`

**Primary Key:** `email` (unique identifier)

---

## 📋 **COMPLETE DATA STRUCTURE**

### **1. Client Identification**
```sql
email TEXT NOT NULL UNIQUE          -- Primary identifier
firstname TEXT                      -- First name
lastname TEXT                       -- Last name
hubspot_contact_id TEXT             -- HubSpot link
assigned_coach TEXT                 -- Coach name
client_segment TEXT                 -- Client segment
```

### **2. Health Scores** ✅
```sql
health_score NUMERIC                -- Overall health (0-100)
health_zone TEXT                    -- RED/YELLOW/GREEN/PURPLE
health_trend TEXT                   -- ACCELERATING/STABLE/DECLINING
engagement_score NUMERIC            -- Engagement level (0-100)
momentum_score NUMERIC              -- Momentum indicator
package_health_score NUMERIC        -- Package utilization score
relationship_score NUMERIC          -- Coach relationship score
financial_score NUMERIC             -- Payment reliability score
```

### **3. Session Data** ✅
```sql
sessions_purchased NUMERIC          -- Total sessions bought
outstanding_sessions NUMERIC         -- Sessions remaining
sessions_last_7d NUMERIC            -- Sessions in last 7 days
sessions_last_30d NUMERIC           -- Sessions in last 30 days
sessions_last_90d NUMERIC           -- Sessions in last 90 days
days_since_last_session NUMERIC     -- Days since last session
```

### **4. Package Information** ✅
```sql
package_type TEXT                   -- Package name/type
package_value_aed NUMERIC           -- Package value in AED
package_health_score NUMERIC        -- Package utilization (0-100)
days_until_renewal NUMERIC          -- Days until package expires
```

### **5. Risk & Prediction** ✅
```sql
churn_risk_score NUMERIC            -- Churn probability (0-100)
predictive_risk_score NUMERIC       -- Predictive risk (0-100)
intervention_priority TEXT          -- HIGH/MEDIUM/LOW
risk_category TEXT                  -- CRITICAL/HIGH/MEDIUM/LOW
momentum_indicator TEXT              -- ACCELERATING/STABLE/DECLINING
early_warning_flag BOOLEAN          -- Early warning flag
risk_factors JSONB                  -- Risk factors array
```

### **6. Calculation Metadata**
```sql
calculated_at TIMESTAMPTZ           -- Last calculation time
calculated_on DATE                  -- Calculation date
calculated_date DATE                -- Calculation date (alternate)
calculation_version TEXT             -- Version of calculation logic
created_at TIMESTAMPTZ              -- Record creation
updated_at TIMESTAMPTZ              -- Last update
```

---

## 📊 **EXAMPLE DATA STRUCTURE**

### **Complete Record Example:**
```json
{
  "email": "john@example.com",
  "firstname": "John",
  "lastname": "Doe",
  "health_score": 78,
  "health_zone": "GREEN",
  "health_trend": "STABLE",
  "engagement_score": 85,
  "momentum_score": 72,
  "package_health_score": 65,
  "relationship_score": 90,
  "financial_score": 95,
  
  "sessions_purchased": 50,
  "outstanding_sessions": 12,
  "sessions_last_7d": 2,
  "sessions_last_30d": 8,
  "sessions_last_90d": 24,
  "days_since_last_session": 3,
  
  "package_type": "12-Week Transformation",
  "package_value_aed": 5000,
  "days_until_renewal": 45,
  
  "churn_risk_score": 15,
  "predictive_risk_score": 12,
  "intervention_priority": "LOW",
  "risk_category": "LOW",
  "momentum_indicator": "STABLE",
  "early_warning_flag": false,
  
  "assigned_coach": "Mathew",
  "client_segment": "Premium",
  "hubspot_contact_id": "12345",
  
  "calculated_at": "2025-01-15T10:30:00Z",
  "calculated_on": "2025-01-15",
  "calculation_version": "AGENT_v1"
}
```

---

## 🔍 **QUERY EXAMPLES**

### **1. Get Client Health Score**
```sql
SELECT 
  email,
  firstname,
  lastname,
  health_score,
  health_zone,
  sessions_purchased,
  outstanding_sessions,
  package_type,
  package_value_aed
FROM client_health_scores
WHERE email = 'john@example.com';
```

### **2. Get Clients by Health Zone**
```sql
SELECT 
  email,
  firstname,
  lastname,
  health_score,
  health_zone,
  sessions_purchased,
  outstanding_sessions
FROM client_health_scores
WHERE health_zone = 'RED'
ORDER BY health_score ASC;
```

### **3. Get Package Information**
```sql
SELECT 
  email,
  package_type,
  package_value_aed,
  sessions_purchased,
  outstanding_sessions,
  package_health_score,
  days_until_renewal
FROM client_health_scores
WHERE package_type IS NOT NULL;
```

### **4. Get Session Statistics**
```sql
SELECT 
  email,
  sessions_purchased,
  outstanding_sessions,
  sessions_last_7d,
  sessions_last_30d,
  sessions_last_90d,
  days_since_last_session
FROM client_health_scores
WHERE outstanding_sessions > 0;
```

### **5. Get High-Risk Clients**
```sql
SELECT 
  email,
  firstname,
  lastname,
  health_score,
  churn_risk_score,
  sessions_purchased,
  outstanding_sessions,
  days_since_last_session,
  intervention_priority
FROM client_health_scores
WHERE churn_risk_score > 70
   OR health_zone = 'RED'
ORDER BY churn_risk_score DESC;
```

---

## 📈 **CALCULATED METRICS**

### **Package Health Score Formula:**
```sql
package_health_score = (outstanding_sessions / sessions_purchased) * 100
```

**Example:**
- Purchased: 50 sessions
- Outstanding: 12 sessions
- Used: 38 sessions
- Package Health: (12/50) * 100 = 24% remaining

### **Health Score Components:**
1. **Engagement Score** - Session attendance, frequency
2. **Package Health** - Utilization rate
3. **Momentum Score** - Trend analysis
4. **Relationship Score** - Coach interaction
5. **Financial Score** - Payment reliability

### **Health Zones:**
- **PURPLE** (90-100): Excellent, high value
- **GREEN** (70-89): Healthy, stable
- **YELLOW** (50-69): At risk, needs attention
- **RED** (0-49): Critical, immediate intervention

---

## 🔄 **DATA SOURCES**

### **1. HubSpot Sync**
- Client information (name, email)
- Package details
- Deal information
- Lifecycle stage

**Function:** `sync-hubspot-to-supabase`

### **2. Health Calculator**
- Calculates all scores
- Updates health zones
- Calculates churn risk
- Updates session counts

**Function:** `health-calculator`

**Runs:** Daily or on-demand

### **3. Session Tracking**
- Tracks session attendance
- Updates session counts
- Calculates days since last session
- Updates package utilization

**Sources:**
- HubSpot activities
- Appointment system
- Manual entry

---

## 📊 **RELATED TABLES**

### **1. `client_lifecycle_history`**
**Purpose:** Track health score over time

**Fields:**
- `email` - Client identifier
- `week_ending_date` - Week tracked
- `health_score` - Score for that week
- `health_zone` - Zone for that week
- `sessions_this_week` - Sessions in week
- `sessions_previous_week` - Previous week
- `week_over_week_change` - Change %
- `engagement_trend` - Trend indicator

**Use Case:** Historical analysis, trend tracking

---

### **2. `churn_patterns`**
**Purpose:** Learn from churned clients

**Fields:**
- `pattern_name` - Pattern identifier
- `days_before_churn` - Days before churn
- `avg_health_score_drop` - Score drop
- `avg_session_frequency_drop` - Frequency drop
- `common_behaviors` - Behavior patterns
- `confidence_score` - Pattern confidence

**Use Case:** Predictive churn detection

---

### **3. `intervention_log`**
**Purpose:** Track interventions taken

**Fields:**
- `client_email` - Client identifier
- `intervention_type` - Type of intervention
- `recommended_at` - When recommended
- `executed_at` - When executed
- `outcome` - Result
- `success_score` - Success rating

**Use Case:** Track intervention effectiveness

---

## 🎯 **KEY METRICS AVAILABLE**

### **Session Metrics:**
- ✅ Total sessions purchased
- ✅ Outstanding sessions remaining
- ✅ Sessions last 7 days
- ✅ Sessions last 30 days
- ✅ Sessions last 90 days
- ✅ Days since last session
- ✅ Session utilization rate

### **Package Metrics:**
- ✅ Package type/name
- ✅ Package value (AED)
- ✅ Package health score (% remaining)
- ✅ Days until renewal
- ✅ Renewal status

### **Health Metrics:**
- ✅ Overall health score (0-100)
- ✅ Health zone (RED/YELLOW/GREEN/PURPLE)
- ✅ Health trend (ACCELERATING/STABLE/DECLINING)
- ✅ Engagement score
- ✅ Momentum score
- ✅ Relationship score
- ✅ Financial score

### **Risk Metrics:**
- ✅ Churn risk score (0-100)
- ✅ Predictive risk score
- ✅ Risk category
- ✅ Intervention priority
- ✅ Early warning flags
- ✅ Risk factors

---

## 🔄 **DATA FLOW**

```
HubSpot CRM
  ↓ (sync-hubspot-to-supabase)
Supabase Database
  ↓ (health-calculator)
client_health_scores table
  ↓ (calculations)
All scores updated:
  - Health score
  - Session counts
  - Package info
  - Risk scores
```

---

## ✅ **VERIFICATION**

### **Check if Data Exists:**
```sql
-- Count clients with health scores
SELECT COUNT(*) FROM client_health_scores;

-- Count clients with packages
SELECT COUNT(*) FROM client_health_scores 
WHERE package_type IS NOT NULL;

-- Count clients with sessions
SELECT COUNT(*) FROM client_health_scores 
WHERE sessions_purchased > 0;
```

### **Check Data Quality:**
```sql
-- Clients missing health scores
SELECT COUNT(*) FROM client_health_scores 
WHERE health_score IS NULL;

-- Clients missing session data
SELECT COUNT(*) FROM client_health_scores 
WHERE sessions_purchased IS NULL;

-- Clients missing package info
SELECT COUNT(*) FROM client_health_scores 
WHERE package_type IS NULL AND package_value_aed IS NULL;
```

---

## 📝 **SUMMARY**

### **✅ YES - All Client Data is in Supabase**

**Table:** `client_health_scores`

**Data Stored:**
1. ✅ **Health Scores** - Overall, engagement, momentum, package, relationship, financial
2. ✅ **Session Data** - Purchased, outstanding, last 7/30/90 days, days since last
3. ✅ **Package Info** - Type, value (AED), health score, days until renewal
4. ✅ **Risk Scores** - Churn risk, predictive risk, intervention priority
5. ✅ **Client Info** - Name, email, coach, segment, HubSpot ID

**Related Tables:**
- ✅ `client_lifecycle_history` - Historical tracking
- ✅ `churn_patterns` - Churn prediction
- ✅ `intervention_log` - Intervention tracking

**Functions:**
- ✅ `health-calculator` - Calculates all scores
- ✅ `sync-hubspot-to-supabase` - Syncs client data
- ✅ `churn-predictor` - Predicts churn risk

---

**All your client scores, packages, and session data is stored in Supabase!** ✅
