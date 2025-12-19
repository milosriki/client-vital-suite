# 📊 Health Score Formulas & Data Flow Documentation

## 🎯 Complete Health Score System Overview

### **Data Source: `contacts` Table**
Health scores are calculated from the `contacts` table which contains:
- `sessions_last_7d` - Sessions in last 7 days
- `sessions_last_30d` - Sessions in last 30 days  
- `outstanding_sessions` - Remaining sessions
- `sessions_purchased` - Total sessions purchased
- `days_since_last_session` - Days since last activity
- `last_activity_date` - Last activity timestamp
- `assigned_coach` - Coach assignment
- `hubspot_contact_id` - HubSpot ID

---

## 📐 Health Score Calculation Formula

### **Main Health Score Formula:**
```
health_score = (engagement_score × 0.40) + (package_health_score × 0.30) + (momentum_score × 0.30)
```

**Location:** `supabase/functions/health-calculator/index.ts` (line 111-116)

---

## 🔢 Component Scores

### **1. Engagement Score** (40% weight)
**Function:** `calculateEngagementScore()` (lines 33-64)

**Base Score:** 50 points

**Bonuses:**
- **Recent Activity (7 days):**
  - 3+ sessions: +30 points
  - 2 sessions: +20 points
  - 1 session: +10 points

- **Consistency (30 days):**
  - 12+ sessions: +15 points
  - 8+ sessions: +10 points

**Penalties:**
- **Recency:**
  - >30 days inactive: -30 points
  - >14 days inactive: -15 points
  - >7 days inactive: -5 points

**Range:** 0-100

---

### **2. Package Health Score** (30% weight)
**Function:** `calculatePackageHealthScore()` (lines 67-76)

**Formula:**
```
remaining_percentage = (outstanding_sessions / sessions_purchased) × 100
```

**Scoring:**
- ≥50% remaining: 90 points
- ≥30% remaining: 70 points
- ≥10% remaining: 50 points
- <10% remaining: 30 points

**Range:** 30-90

---

### **3. Momentum Score** (30% weight)
**Function:** `calculateMomentumScore()` (lines 78-93)

**Formula:**
```
avg_weekly_7d = sessions_last_7d
avg_weekly_30d = sessions_last_30d / 4.3
rate_of_change = ((avg_weekly_7d - avg_weekly_30d) / avg_weekly_30d) × 100
```

**Scoring:**
- Rate >20%: 90 points (ACCELERATING)
- Rate >0%: 70 points (SLIGHTLY UP)
- Rate >-20%: 50 points (STABLE)
- Rate ≤-20%: 30 points (DECLINING)

**Range:** 30-90

---

## 🎨 Health Zone Assignment

**Function:** `getHealthZone()` (lines 119-124)

**Zones:**
- **PURPLE:** health_score ≥ 85
- **GREEN:** health_score ≥ 70
- **YELLOW:** health_score ≥ 50
- **RED:** health_score < 50

---

## ⚠️ Predictive Risk Score

**Function:** `calculatePredictiveRisk()` (lines 126-165)

**Base Risk:** 50%

**Adjustments:**

**Momentum Impact:**
- DECLINING: +30%
- ACCELERATING: -15%

**Recent Activity:**
- 0 sessions (7d): +25%
- <1 session: +15%
- ≥2 sessions: -10%

**Days Since Last Session:**
- >30 days: +20%
- >14 days: +10%
- >7 days: +5%

**Health Zone:**
- RED zone: +15%
- YELLOW zone: +5%
- GREEN zone: -5%
- PURPLE zone: -10%

**Range:** 0-100%

---

## 🔄 How Health Scores Are Populated

### **1. Calculation Trigger**
**Edge Function:** `health-calculator`  
**Location:** `supabase/functions/health-calculator/index.ts`

**When it runs:**
- Daily automated calculation (via cron/scheduler)
- Manual trigger via API call
- After HubSpot sync (if configured)

### **2. Data Flow**

```
contacts table (source data)
    ↓
health-calculator function
    ↓
Calculates: engagement, package, momentum, health_score
    ↓
Determines: health_zone, churn_risk_score, momentum_indicator
    ↓
Upserts to: client_health_scores table
    ↓
Updates: daily_summary table (aggregated stats)
```

### **3. Real-Time Updates**

**Hook:** `useRealtimeHealthScores()`  
**Location:** `src/hooks/useRealtimeHealthScores.ts`

**What it does:**
- Subscribes to `client_health_scores` table changes
- Updates React Query cache when scores change
- Debounced updates (300ms) to batch rapid changes
- Selective cache updates (only affected clients)

---

## 📊 Daily Summary Aggregation

**Table:** `daily_summary`  
**Updated by:** `health-calculator` function (lines 299-311)

**Fields:**
- `summary_date` - Date (YYYY-MM-DD)
- `total_clients` - Total clients processed
- `avg_health_score` - Average health score
- `red_count` - Clients in RED zone
- `yellow_count` - Clients in YELLOW zone
- `green_count` - Clients in GREEN zone
- `purple_count` - Clients in PURPLE zone
- `critical_interventions` - Count of CRITICAL priority interventions

---

## 🔗 Data Dependencies

### **Input Tables:**
1. **`contacts`** - Source data for calculations
   - Must have: `email`, `sessions_last_7d`, `sessions_last_30d`, `outstanding_sessions`, `sessions_purchased`

### **Output Tables:**
1. **`client_health_scores`** - Calculated scores
   - Fields: `email`, `health_score`, `health_zone`, `engagement_score`, `package_health_score`, `momentum_score`, `churn_risk_score`, `momentum_indicator`, `calculated_on`

2. **`daily_summary`** - Aggregated daily stats
   - Fields: `summary_date`, `avg_health_score`, `red_count`, `yellow_count`, `green_count`, `purple_count`

---

## 🚀 How to Trigger Health Score Calculation

### **Via Edge Function:**
```bash
curl -X POST https://[PROJECT].supabase.co/functions/v1/health-calculator \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"client_emails": ["email1@example.com", "email2@example.com"]}'
```

**Parameters:**
- `client_emails` (optional) - Array of emails to calculate. If empty, calculates for all clients.

---

## 📈 Health Score Usage in UI

### **Dashboard:**
- Shows health distribution (pie chart)
- Lists clients by health zone
- Displays average health score

### **Clients Page:**
- Filters by health zone (RED, YELLOW, GREEN, PURPLE)
- Sorts by health score
- Shows individual client health scores

### **Analytics:**
- Trends over time (weekly patterns)
- Zone distribution charts
- Segment analysis

### **Interventions:**
- Triggers interventions based on health zone
- Priority: CRITICAL for RED zone + high churn risk
- Tracks health_score_at_trigger

---

## 🔍 Monitoring & Debugging

### **Check Calculation Status:**
```sql
SELECT 
  calculated_on,
  COUNT(*) as client_count,
  AVG(health_score) as avg_score,
  COUNT(CASE WHEN health_zone = 'RED' THEN 1 END) as red_count
FROM client_health_scores
GROUP BY calculated_on
ORDER BY calculated_on DESC;
```

### **Check Latest Scores:**
```sql
SELECT 
  email,
  health_score,
  health_zone,
  churn_risk_score,
  calculated_on
FROM client_health_scores
WHERE calculated_on = (SELECT MAX(calculated_on) FROM client_health_scores)
ORDER BY health_score ASC;
```

---

## ⚙️ Configuration

### **Weights (in `health-calculator/index.ts`):**
- Engagement: 40% (line 116)
- Package Health: 30% (line 116)
- Momentum: 30% (line 116)

**To adjust:** Modify line 116 in `health-calculator/index.ts`

### **Debounce Timing:**
- Real-time updates: 300ms (optimized for instant feel)
- Location: `src/hooks/useRealtimeHealthScores.ts` (line 8)

---

## 📝 Notes

1. **Health scores are calculated daily** - Not real-time during the day
2. **Real-time subscriptions** update UI when scores change in database
3. **Scores range 0-100** - All component scores normalized to this range
4. **Zones are deterministic** - Based purely on health_score value
5. **Churn risk is predictive** - Uses momentum + activity patterns

---

**Last Updated:** Based on current codebase analysis  
**Calculation Function:** `supabase/functions/health-calculator/index.ts`  
**Real-time Hook:** `src/hooks/useRealtimeHealthScores.ts`

