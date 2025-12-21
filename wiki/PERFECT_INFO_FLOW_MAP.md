# 🌊 Perfect Information Flow Map

## 📋 Complete Data Flow Architecture

This document maps the complete information flow from external data sources through the entire application stack to UI components.

---

## 🏗️ Architecture Overview

```
External APIs → Edge Functions → Supabase Database → Real-time Subscriptions → React Query → React Components → UI
```

---

## 📊 Data Flow Layers

### **Layer 1: External Data Sources**

#### **1. HubSpot CRM**

- **Data Types**: Contacts, Deals, Companies, Engagements, Calls
- **Sync Method**: Edge Function `sync-hubspot-to-supabase`
- **Frequency**: Manual trigger or scheduled

- **Flow**:

  ```
  HubSpot API → Edge Function → Supabase Tables:
    - contacts
    - deals
    - call_records
    - appointments
  ```

#### **2. Stripe Payment Processor**

- **Data Types**: Payments, Subscriptions, Customers, Payouts, Balance

- **Sync Method**: Edge Function `stripe-dashboard-data`
- **Frequency**: On-demand (user request)
- **Flow**:

  ```
  Stripe API → Edge Function → Direct Return (no DB storage)
  OR
  Stripe API → Edge Function → Supabase Tables:

    - stripe_payments (if cached)
  ```

#### **3. Facebook/Meta Ads**

- **Data Types**: Campaigns, Ads, Insights, Conversions
- **Sync Method**: Edge Function `fetch-facebook-insights`
- **Frequency**: Scheduled or on-demand
- **Flow**:

  ```

  Facebook Graph API → Edge Function → Supabase Tables:
    - facebook_ads_insights
    - enhanced_leads (with campaign data)
  ```

#### **4. CallGear (Call Tracking)**

- **Data Types**: Call Records, Transcripts, Recordings
- **Sync Method**: Edge Function `callgear-supervisor`
- **Frequency**: Real-time webhooks + scheduled sync
- **Flow**:

  ```
  CallGear Webhook → Edge Function → Supabase Tables:
    - call_records
    - call_transcriptions
  ```

---

### **Layer 2: Edge Functions (Data Processing)**

#### **Data Transformation Functions**

**1. `sync-hubspot-to-supabase`**

```
Input: { clear_fake_data: boolean, sync_type: 'all' }
Process:

  1. Authenticate with HubSpot API
  2. Fetch contacts, deals, calls, appointments
  3. Transform HubSpot format → Supabase format
  4. Upsert to database tables
  5. Handle errors → sync_errors table
Output: { contacts_synced, leads_synced, deals_synced, calls_synced }
```

**2. `stripe-dashboard-data`**

```

Input: { startDate, endDate, status, limit }
Process:
  1. Authenticate with Stripe API
  2. Fetch payments, subscriptions, customers, payouts
  3. Calculate metrics (MRR, revenue, success rate)
  4. Format chart data
Output: { balance, metrics, payments, subscriptions, customers, payouts, chartData }
```

**3. `business-intelligence`**

```
Input: {}
Process:
  1. Query client_health_scores
  2. Analyze patterns
  3. Generate insights
  4. Update daily_summary table
Output: { clients_analyzed, insights_generated, analysis }
```

**4. `intervention-recommender`**

```
Input: {}
Process:
  1. Identify at-risk clients (health_score < threshold)
  2. Use AI to generate recommendations
  3. Insert to intervention_log table
Output: { interventions_created }
```

**5. `churn-predictor`**

```
Input: {}
Process:
  1. Analyze client behavior patterns
  2. Calculate churn risk scores
  3. Update client_health_scores.churn_risk_score
Output: { clients_analyzed }
```

**6. `health-calculator`**

```
Input: {}
Process:

  1. Fetch client data from contacts, deals, call_records
  2. Calculate health scores (0-100)
  3. Classify health zones (GREEN, YELLOW, RED, PURPLE)
  4. Upsert to client_health_scores table
Output: { clients_calculated, health_scores_updated }
```

---

### **Layer 3: Supabase Database**

#### **Core Tables & Data Flow**

**1. `contacts` (HubSpot Contacts)**

```
Source: HubSpot CRM
Sync: sync-hubspot-to-supabase Edge Function

Fields: id, email, first_name, last_name, phone, lifecycle_stage, lead_status, owner_name, total_value, created_at
Real-time: ✅ Subscribed in Sales Pipeline page
Used By: Dashboard, Sales Pipeline, Clients, Call Tracking
```

**2. `deals` (HubSpot Deals)**

```
Source: HubSpot CRM

Sync: sync-hubspot-to-supabase Edge Function
Fields: id, deal_name, deal_value, status, stage, pipeline, close_date, cash_collected
Real-time: ✅ Subscribed in Sales Pipeline page
Used By: Dashboard, Sales Pipeline, War Room, Analytics
```

**3. `call_records` (Call Tracking)**

```

Source: CallGear API / HubSpot
Sync: callgear-supervisor Edge Function
Fields: id, caller_number, call_status, call_direction, duration_seconds, transcription, recording_url, appointment_set
Real-time: ✅ Subscribed in Sales Pipeline page
Used By: Call Tracking, Sales Pipeline, Dashboard
```

**4. `client_health_scores` (Calculated Health)**

```
Source: health-calculator Edge Function
Sync: Scheduled daily or manual trigger
Fields: email, health_score, health_zone, churn_risk_score, calculated_on, package_value_aed, assigned_coach
Real-time: ✅ Subscribed via useRealtimeHealthScores hook
Used By: Dashboard, Clients, Client Detail, Coaches, Analytics
```

**5. `intervention_log` (AI Recommendations)**

```
Source: intervention-recommender Edge Function
Sync: Manual trigger or scheduled
Fields: id, client_email, intervention_type, recommendation, status, created_at
Real-time: ✅ Subscribed via useRealtimeHealthScores hook
Used By: Dashboard, Interventions, Client Detail
```

**6. `daily_summary` (Daily Analytics)**

```
Source: business-intelligence Edge Function
Sync: Scheduled daily
Fields: summary_date, patterns_detected, critical_interventions, interventions_recommended
Real-time: ❌ Polled every 5 minutes
Used By: Dashboard, Overview
```

**7. `coach_performance` (Coach Metrics)**

```
Source: Calculated from client_health_scores
Sync: Scheduled or manual
Fields: coach_name, report_date, clients_assigned, avg_health_score, clients_at_risk
Real-time: ✅ Subscribed via useRealtimeHealthScores hook
Used By: Coaches, Dashboard, Analytics

```

**8. `enhanced_leads` (Facebook Ad Leads)**

```
Source: Facebook Conversions API
Sync: fetch-facebook-insights Edge Function
Fields: id, email, first_name, last_name, phone, campaign_id, campaign_name, ad_id, ad_name, lead_score, ltv_prediction
Real-time: ❌ Polled every 30 seconds
Used By: Sales Pipeline, Call Tracking, War Room
```

**9. `notifications` (System Notifications)**

```

Source: Various Edge Functions & System Events
Sync: Real-time inserts
Fields: id, type, title, message, category, metadata, read_at, created_at
Real-time: ✅ Subscribed in NotificationCenter component
Used By: Navigation Bar, All Pages
```

**10. `prepared_actions` (AI Actions)**

```
Source: AI Dev Console, Ultimate CEO
Sync: ptd-self-developer Edge Function
Fields: id, command, status, priority, executed_at, result

Real-time: ❌ Polled every 15 seconds
Used By: AI Dev Console, Ultimate CEO
```

---

### **Layer 4: Real-time Subscriptions**

#### **Supabase Realtime Channels**

**1. `health_scores_changes`**

```typescript
Channel: 'health_scores_changes'
Tables: 
  - client_health_scores (INSERT, UPDATE, DELETE)

  - intervention_log (INSERT, UPDATE, DELETE)
  - coach_performance (INSERT, UPDATE, DELETE)
  - weekly_patterns (INSERT, UPDATE, DELETE)
Action: Invalidates React Query cache
Hook: useRealtimeHealthScores()
Used In: Dashboard (global)
```

**2. `calls-realtime`**

```typescript
Channel: 'calls-realtime'
Table: call_records (INSERT, UPDATE, DELETE)
Action: Invalidates ['call-records'] query
Used In: Sales Pipeline page
```

**3. `leads-realtime`**

```typescript
Channel: 'leads-realtime'
Table: leads (INSERT, UPDATE, DELETE)
Action: Invalidates ['lead-funnel'] query
Used In: Sales Pipeline page
```

**4. `deals-realtime`**

```typescript
Channel: 'deals-realtime'
Table: deals (INSERT, UPDATE, DELETE)
Action: Invalidates ['deals-summary'] query
Used In: Sales Pipeline page
```

**5. `appointments-realtime`**

```typescript
Channel: 'appointments-realtime'
Table: appointments (INSERT, UPDATE, DELETE)
Action: Invalidates ['appointments-summary'] query
Used In: Sales Pipeline page
```

**6. `notifications-realtime`**

```typescript
Channel: 'notifications-realtime'
Table: notifications (INSERT)
Action: 
  - Invalidates ['notifications'] query

  - Plays sound (if critical/important)
  - Shows browser notification
Used In: NotificationCenter component
```

**7. `deals-monitor`**

```typescript
Channel: 'deals-monitor'
Table: deals (INSERT with status='closed')
Action: Creates notification if deal_value > threshold
Used In: useNotifications hook (global)
```

**8. `health-monitor`**

```typescript
Channel: 'health-monitor'
Table: client_health_scores (UPDATE)
Action: Creates critical notification if churn_risk_score > 80
Used In: useNotifications hook (global)
```

**9. `errors-monitor`**

```typescript
Channel: 'errors-monitor'
Table: sync_errors (INSERT)
Action: Creates critical notification
Used In: useNotifications hook (global)
```

**10. `sync_errors_realtime`**

```typescript
Channel: 'sync_errors_realtime'
Table: sync_errors (INSERT)
Action: Updates realtimeErrors state
Used In: ErrorMonitorPanel component
```

---

### **Layer 5: React Query (Data Fetching & Caching)**

#### **Query Patterns**

**1. useDedupedQuery Hook**

```typescript
Purpose: Prevents duplicate queries from React StrictMode
Dedupe Interval: 800ms default
Usage: All data fetching queries
Example:

  useDedupedQuery({
    queryKey: ["client-health-scores-dashboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_health_scores")
        .select("*");
      return data;
    },
    refetchInterval: 60000, // 1 minute
  })
```

**2. Query Key Structure**

```typescript

// Defined in src/config/queryKeys.ts
QUERY_KEYS = {
  clients: {
    all: ['clients'],
    byZone: (zone) => ['clients', 'zone', zone],
    byEmail: (email) => ['clients', email],
  },
  interventions: {
    all: ['interventions'],
    byStatus: (status) => ['interventions', status],
  },
  // ... more keys
}
```

**3. Query Invalidation Flow**

```
Database Change → Realtime Subscription → queryClient.invalidateQueries() → React Query Refetch → Component Re-render
```

**4. Refetch Intervals**

```
Dashboard Queries: 60 seconds (1 minute)

Daily Summary: 300 seconds (5 minutes)
Sales Pipeline: 30 seconds
Real-time Critical: 15 seconds (AI actions)
Stale Time: 5 minutes default
```

---

### **Layer 6: React Components (UI Rendering)**

#### **Component Data Flow**

**1. Dashboard Component**

```
Data Sources:
  - client_health_scores (via useDedupedQuery)
  - daily_summary (via useDedupedQuery)
  - deals (via useDedupedQuery)
  - contacts (via useDedupedQuery)
  - call_records (via useDedupedQuery)

Real-time Subscriptions:
  - useRealtimeHealthScores() (global hook)

  - useNotifications() (global hook)

Data Flow:
  Supabase → React Query → Component State → UI Components:
    - KPIGrid
    - ExecutiveBriefing
    - PredictiveAlerts
    - LiveHealthDistribution
    - CoachLeaderboard
    - LiveActivityFeed
    - LiveRevenueChart
    - ClientRiskMatrix
```

**2. Sales Pipeline Component**

```
Data Sources:
  - contacts (mapped to leads)
  - enhanced_leads
  - deals

  - call_records
  - appointments
  - kpi_tracking
  - business_forecasts

Real-time Subscriptions:
  - calls-realtime channel
  - leads-realtime channel
  - deals-realtime channel
  - appointments-realtime channel

Data Flow:
  Supabase → React Query → Filter Logic → UI Components:
    - Lead Funnel Visualization
    - Call Status Overview
    - Data Tables (Leads, Contacts, Deals, Calls, Appointments)
```

**3. Stripe Intelligence Component**

```
Data Sources:
  - stripe-dashboard-data Edge Function (on-demand)
  - stripe-forensics Edge Function (on-demand)

Real-time Subscriptions:
  ❌ None (on-demand fetching)

Data Flow:
  User Action (date filter) → Edge Function → React Query → UI Components:
    - Key Metrics Cards
    - Revenue Chart
    - Payment Status Pie Chart
    - Payments List
    - Subscriptions List
    - Payouts List
    - Customers List
    - AI Chat Panel
```

**4. Call Tracking Component**

```
Data Sources:
  - call_records
  - contacts (for enrichment)
  - enhanced_leads (for enrichment)

Real-time Subscriptions:
  ❌ None (polling every 30 seconds)

Data Flow:
  Supabase → React Query → Enrichment Logic → Filter Logic → UI Components:
    - Stats Grid
    - Call Filters
    - Call Cards (enriched with contact/lead data)
```

**5. Clients Component**

```
Data Sources:
  - client_health_scores (via useClientHealthScores hook)

Real-time Subscriptions:
  - useRealtimeHealthScores() (global)

Data Flow:
  Supabase → React Query → Filter Logic → UI Components:
    - Zone Distribution Chart
    - Client Table
```

---

## 🔄 Complete Flow Examples

### **Example 1: HubSpot Sync Flow**

```
User clicks "Sync HubSpot" button
  ↓
onClick handler triggers
  ↓
setIsSyncing(true)
  ↓
supabase.functions.invoke('sync-hubspot-to-supabase', { clear_fake_data: false })
  ↓
Edge Function executes:
  1. Authenticate with HubSpot API
  2. Fetch contacts (limit 1000, paginated)
  3. Fetch deals (limit 1000, paginated)
  4. Fetch call records
  5. Fetch appointments
  6. Transform data format
  7. Upsert to Supabase tables:
     - contacts
     - deals
     - call_records
     - appointments
  ↓
Database triggers:
  - RLS policies check permissions
  - Triggers fire (if any)
  - Real-time events emitted
  ↓
Real-time Subscriptions receive events:
  - calls-realtime channel → invalidates ['call-records']
  - leads-realtime channel → invalidates ['lead-funnel']
  - deals-realtime channel → invalidates ['deals-summary']
  - appointments-realtime channel → invalidates ['appointments-summary']
  ↓
React Query invalidates queries:
  - queryClient.invalidateQueries(['call-records'])
  - queryClient.invalidateQueries(['lead-funnel'])
  - queryClient.invalidateQueries(['deals-summary'])
  - queryClient.invalidateQueries(['appointments-summary'])
  ↓
React Query refetches data:
  - useDedupedQuery hooks automatically refetch
  - Components receive new data
  ↓
Components re-render:
  - Sales Pipeline updates with new data
  - Dashboard metrics update
  - Call Tracking updates
  ↓
toast.success("Synced X contacts, Y leads...")
  ↓
setIsSyncing(false)
```

### **Example 2: Health Score Calculation Flow**

```
Scheduled trigger (daily) OR User clicks "Run BI Agent"
  ↓
Edge Function: health-calculator invoked
  ↓
Function fetches data:
  1. contacts table (client info)
  2. deals table (revenue data)
  3. call_records table (engagement data)
  4. appointments table (activity data)
  ↓
Calculate health scores:
  - Engagement score (0-40 points)
  - Revenue score (0-30 points)
  - Activity score (0-30 points)
  - Total: 0-100 points
  ↓
Classify health zones:
  - GREEN: 70-100
  - YELLOW: 50-69
  - RED: 0-49
  - PURPLE: VIP clients (special logic)
  ↓
Upsert to client_health_scores table:
  - email (primary key)
  - health_score
  - health_zone
  - calculated_on (timestamp)
  ↓
Database triggers:
  - Real-time event emitted
  ↓
Real-time Subscription receives event:
  - health_scores_changes channel
  ↓
useRealtimeHealthScores hook:
  - queryClient.invalidateQueries(['clients'])
  - queryClient.invalidateQueries(['daily-summary'])
  ↓
React Query refetches:
  - Dashboard queries refetch
  - Clients page queries refetch
  - Client Detail queries refetch
  ↓
Components re-render:
  - Dashboard shows updated health distribution
  - Clients table shows updated zones
  - KPIs update
```

### **Example 3: Real-time Notification Flow**

```
System event occurs (e.g., high churn risk detected)
  ↓
Edge Function or Database Trigger creates notification:
  INSERT INTO notifications (type, title, message, category)
  VALUES ('critical', 'High Churn Risk', 'Client X has 85% churn risk', 'churn')
  ↓
Database emits real-time event:
  - Table: notifications
  - Event: INSERT
  ↓
Real-time Subscription receives event:
  - notifications-realtime channel
  ↓
NotificationCenter component:
  1. queryClient.invalidateQueries(['notifications'])
  2. Check notification type (critical/important)
  3. If critical/important:
     - playNotificationSound()
     - showBrowserNotification()
  ↓
React Query refetches notifications:
  - useQuery(['notifications']) refetches
  ↓
Component updates:
  - Notification badge count updates
  - Notification list updates
  - Sound plays (if enabled)
  - Browser notification shows (if permission granted)
```

### **Example 4: AI Chat Flow (Stripe Intelligence)**

```
User types message in AI Chat input
  ↓
User clicks "Send" or presses Enter
  ↓
handleSendMessage() executes:
  - Validates input
  - setIsStreaming(true)

  - Adds user message to chatMessages state
  ↓
POST request to stripe-payouts-ai Edge Function:
  {
    action: "chat",
    message: userMessage,

    context: {
      balance: stripeData.balance,
      metrics: stripeData.metrics,
      recentPayments: stripeData.payments.slice(0, 10),
      customers: stripeData.customers.length,
      subscriptions: stripeData.subscriptions.length,

      account: stripeData.account,
      dateRange: { from, to },
      forensics: forensicData
    },
    history: chatMessages
  }

  ↓
Edge Function processes:
  1. Receives context and message
  2. Calls AI API (OpenAI/Gemini) with context
  3. Streams response chunks
  ↓

Frontend receives stream:
  - Reads chunks via ReadableStream
  - Decodes text
  - Updates assistant message in real-time
  ↓
Component updates:
  - chatMessages state updates with streaming text
  - UI shows typing indicator
  ↓
Stream completes:

  - setIsStreaming(false)
  - Final message saved to chatMessages
```

---

## 📈 Data Flow Patterns

### **Pattern 1: Polling (Periodic Refresh)**

```
Component mounts → useDedupedQuery with refetchInterval → Automatic refetch → Component updates
Example: Dashboard queries (60s interval)
```

### **Pattern 2: Real-time (Event-Driven)**

```
Database change → Realtime subscription → Query invalidation → Automatic refetch → Component updates
Example: Health scores, notifications

```

### **Pattern 3: On-Demand (User Triggered)**

```
User action → Edge Function call → Response → Component updates
Example: Stripe data, HubSpot sync
```

### **Pattern 4: Cached (Stale-While-Revalidate)**

```
Component mounts → Check cache → Show cached data → Fetch fresh data → Update cache → Component updates
Example: React Query default behavior
```

### **Pattern 5: Optimistic Updates**

```
User action → Update UI immediately → API call → Revert on error OR confirm on success
Example: Notification read status
```

---

## 🔍 Query Optimization Strategies

### **1. Deduplication**

- `useDedupedQuery` hook prevents duplicate queries
- 800ms dedupe interval
- Returns cached data if duplicate detected

### **2. Query Key Structure**

- Hierarchical keys: `['clients', 'zone', 'RED']`
- Enables granular invalidation

### **3. Stale Time**

- Default: 5 minutes
- Fresh data shown immediately
- Stale data refetched in background

### **4. Refetch Intervals**

- Critical data: 15-30 seconds
- Standard data: 60 seconds
- Summary data: 5 minutes

### **5. Real-time Subscriptions**

- Event-driven updates
- Immediate invalidation
- No polling overhead

---

## 🎯 Data Flow Summary

### **Data Sources → Edge Functions → Database → Real-time → React Query → Components**

**Total Data Sources**: 4 (HubSpot, Stripe, Facebook, CallGear)
**Total Edge Functions**: 20+
**Total Database Tables**: 30+
**Total Real-time Channels**: 10+
**Total React Query Keys**: 50+
**Total Components**: 100+

---

## 📝 Key Takeaways

1. **Single Source of Truth**: Supabase Database
2. **Real-time Updates**: Event-driven via subscriptions
3. **Caching Strategy**: React Query with stale-while-revalidate
4. **Data Transformation**: Edge Functions handle API format conversion
5. **Error Handling**: Graceful fallbacks and error notifications
6. **Performance**: Deduplication, caching, and optimized queries
7. **Scalability**: Real-time subscriptions reduce polling overhead

---

**Last Updated**: Based on complete codebase analysis
**Total Flow Paths Mapped**: 50+
**Real-time Channels**: 10+
**Edge Functions**: 20+
**Database Tables**: 30+
