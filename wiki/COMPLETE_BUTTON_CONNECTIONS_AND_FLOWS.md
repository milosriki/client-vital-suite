# 🔘 Complete Button Connections & Flows

## 📋 Table of Contents

1. [Dashboard Page](#dashboard-page)
2. [Sales Pipeline Page](#sales-pipeline-page)
3. [Stripe Intelligence Page](#stripe-intelligence-page)
4. [Call Tracking Page](#call-tracking-page)
5. [Clients Page](#clients-page)
6. [PTD Control Page](#ptd-control-page)
7. [Operations Page](#operations-page)
8. [AI Dev Console](#ai-dev-console)
9. [Navigation Bar](#navigation-bar)
10. [Dashboard Components](#dashboard-components)

---

## 🏠 Dashboard Page (`/`)

### **Quick Action Buttons**

#### 1. **Pipeline Button** (Top Right)

- **Location**: Header, next to tabs
- **Action**: `onClick={() => navigate('/sales-pipeline')}`
- **Flow**:

  ```
  Click → Navigate to /sales-pipeline → Sales Pipeline Page
  ```

- **Icon**: LayoutGrid
- **Label**: "Pipeline"

#### 2. **AI Control Button** (Top Right)

- **Location**: Header, next to Pipeline button
- **Action**: `onClick={() => navigate('/ptd-control')}`
- **Flow**:

  ```
  Click → Navigate to /ptd-control → PTD Control Panel
  ```

- **Icon**: Sparkles
- **Label**: "AI Control"

#### 3. **Refresh Button** (Mission Control Header)

- **Location**: Top header component
- **Action**: `handleRefresh()`
- **Flow**:

  ```
  Click → setIsRefreshing(true) 
       → refetchClients() 
       → setLastUpdated(new Date())
       → toast("Data refreshed")
       → setIsRefreshing(false)
  ```

- **API Calls**: Refetches `client-health-scores-dashboard` query
- **Side Effects**: Updates lastUpdated timestamp, shows toast notification

### **Tab Navigation**

#### 4. **Today Tab**

- **Action**: `setActiveTab("today")`
- **Flow**: Shows Today tab content (Executive Briefing, KPIs, etc.)

#### 5. **Sales Tab**

- **Action**: `setActiveTab("sales")`
- **Flow**: Shows Kanban Board and sales stats

#### 6. **Clients Tab**

- **Action**: `setActiveTab("clients")`
- **Flow**: Shows Live Health Distribution and health summary

#### 7. **HubSpot Tab**

- **Action**: `setActiveTab("hubspot")`
- **Flow**: Shows HubSpot Live Activity feed

#### 8. **Revenue Tab**

- **Action**: `setActiveTab("revenue")`
- **Flow**: Shows Live Revenue Chart and revenue breakdown

### **Metric Card Clicks** (KPIGrid)

#### 9. **Revenue Metric Click**

- **Action**: `onMetricClick("revenue")`
- **Flow**:

  ```
  Click → handleMetricClick("revenue") 
       → navigate("/analytics")
  ```

#### 10. **Clients Metric Click**

- **Action**: `onMetricClick("clients")`
- **Flow**:

  ```
  Click → navigate("/clients")
  ```

#### 11. **Attention Metric Click**

- **Action**: `onMetricClick("attention")`
- **Flow**:

  ```
  Click → navigate("/clients?zone=RED")
  ```

#### 12. **Pipeline Metric Click**

- **Action**: `onMetricClick("pipeline")`
- **Flow**:

  ```
  Click → navigate("/sales-pipeline")
  ```

#### 13. **Leads Metric Click**

- **Action**: `onMetricClick("leads")`
- **Flow**:

  ```
  Click → navigate("/clients")
  ```

#### 14. **Calls Metric Click**

- **Action**: `onMetricClick("calls")`
- **Flow**:

  ```
  Click → navigate("/call-tracking")
  ```

#### 15. **Appointments Metric Click**

- **Action**: `onMetricClick("appointments")`
- **Flow**:

  ```
  Click → navigate("/interventions")
  ```

#### 16. **Alerts Metric Click**

- **Action**: `onMetricClick("alerts")`
- **Flow**:

  ```
  Click → navigate("/interventions")
  ```

### **Health Zone Buttons** (Clients Tab)

#### 17. **GREEN Zone Button**

- **Action**: `onClick={() => navigate('/clients?zone=GREEN')}`
- **Flow**:

  ```
  Click → Navigate to Clients page with GREEN filter
  ```

#### 18. **YELLOW Zone Button**

- **Action**: `onClick={() => navigate('/clients?zone=YELLOW')}`
- **Flow**:

  ```
  Click → Navigate to Clients page with YELLOW filter
  ```

#### 19. **RED Zone Button**

- **Action**: `onClick={() => navigate('/clients?zone=RED')}`
- **Flow**:

  ```
  Click → Navigate to Clients page with RED filter
  ```

#### 20. **PURPLE Zone Button**

- **Action**: `onClick={() => navigate('/clients?zone=PURPLE')}`
- **Flow**:

  ```
  Click → Navigate to Clients page with PURPLE filter
  ```

### **Quick Stat Cards** (Sales Tab)

#### 21. **Open Deals Card**

- **Action**: `onClick={() => navigate('/sales-pipeline')}`
- **Flow**:

  ```
  Click → Navigate to Sales Pipeline
  ```

---

## 📊 Sales Pipeline Page (`/sales-pipeline`)

### **Header Actions**

#### 22. **Days Filter Dropdown**

- **Action**: `setDaysFilter(value)`
- **Flow**:

  ```
  Select → Updates daysFilter state 
        → Refetches queries with new date filter
        → Updates: lead-funnel, contacts, deals-summary, call-records, appointments-summary
  ```

- **Options**: Today, Last 2-90 days, All time

#### 23. **Sync HubSpot Button**

- **Location**: Top right controls
- **Action**: `onClick={() => syncFromHubspot.mutate(false)}`
- **Flow**:

  ```
  Click → setIsSyncing(true)
       → supabase.functions.invoke('sync-hubspot-to-supabase', { clear_fake_data: false })
       → toast.success("Synced X contacts, Y leads, Z deals, W calls")
       → queryClient.invalidateQueries(['lead-funnel', 'contacts', 'deals-summary', 'call-records'])
       → setIsSyncing(false)
  ```

- **API**: `sync-hubspot-to-supabase` Edge Function
- **Side Effects**: Refreshes all sales data, shows success toast

#### 24. **Clear Test Data Button** (Trash Icon)

- **Location**: Next to Sync button (in Dialog)
- **Action**: `onClick={() => syncFromHubspot.mutate(true)}`
- **Flow**:

  ```
  Click → Opens confirmation dialog
       → Confirm → syncFromHubspot.mutate(true)
       → Deletes all fake/test data
       → Syncs real data from HubSpot
       → Refreshes all queries
  ```

- **Warning**: Cannot be undone

#### 25. **Cancel Clear Data Button**

- **Action**: `onClick={() => {}}` (Closes dialog)
- **Flow**: Closes confirmation dialog

### **Tab Navigation**

#### 26. **Leads Tab**

- **Action**: `setActiveTab("leads")`
- **Flow**: Shows leads table

#### 27. **Enhanced Leads Tab**

- **Action**: `setActiveTab("enhanced")`
- **Flow**: Shows Facebook Ad leads with campaign data

#### 28. **Contacts Tab**

- **Action**: `setActiveTab("contacts")`
- **Flow**: Shows contacts table

#### 29. **Deals Tab**

- **Action**: `setActiveTab("deals")`
- **Flow**: Shows deals table

#### 30. **Calls Tab**

- **Action**: `setActiveTab("calls")`
- **Flow**: Shows call records table

#### 31. **Appointments Tab**

- **Action**: `setActiveTab("appointments")`
- **Flow**: Shows appointments table

### **Call Details Dialog**

#### 32. **View Call Transcript Button** (FileText icon)

- **Location**: In calls table row
- **Action**: Opens Dialog
- **Flow**:

  ```
  Click → Opens Dialog with call details
       → Shows recording (if available)
       → Shows transcription (if available)
       → Shows outcome badge
  ```

---

## 💳 Stripe Intelligence Page (`/stripe`)

### **Header Controls**

#### 33. **Date Range Preset Select**

- **Action**: `handlePresetChange(preset)`
- **Flow**:

  ```
  Select → setSelectedPreset(preset)
        → setDateRange(preset.getValue())
        → Refetches stripe-dashboard-data with new date range
  ```

- **Options**: Today, Last 7/30 days, This/Last month, Last 3 months, This year, All time

#### 34. **Custom Date Range Calendar**

- **Action**: `onSelect={(range) => setDateRange({ from, to })}`
- **Flow**:

  ```
  Select dates → Updates dateRange state
              → setSelectedPreset("Custom")
              → Refetches stripe-dashboard-data
  ```

#### 35. **Status Filter Select**

- **Action**: `setStatusFilter(value)`
- **Flow**:

  ```
  Select → Updates statusFilter state
        → Refetches stripe-dashboard-data with status filter
  ```

- **Options**: All Status, Active, Canceled, Past Due

#### 36. **Refresh Button**

- **Action**: `onClick={() => refetch()}`
- **Flow**:

  ```
  Click → setIsRefetching(true)
       → Refetches stripe-dashboard-data query
       → setIsRefetching(false)
  ```

#### 37. **Open Stripe Dashboard Button** (External Link)

- **Action**: Opens `https://dashboard.stripe.com` in new tab
- **Flow**:

  ```
  Click → window.open("https://dashboard.stripe.com", "_blank")
  ```

### **Tab Navigation**

#### 38. **Overview Tab**

- **Action**: `setActiveTab("overview")`
- **Flow**: Shows period summary cards

#### 39. **Payments Tab**

- **Action**: `setActiveTab("payments")`
- **Flow**: Shows payments list with scroll area

#### 40. **Subscriptions Tab**

- **Action**: `setActiveTab("subscriptions")`
- **Flow**: Shows subscriptions list

#### 41. **Payouts Tab**

- **Action**: `setActiveTab("payouts")`
- **Flow**: Shows payouts list

#### 42. **Customers Tab**

- **Action**: `setActiveTab("customers")`
- **Flow**: Shows customers list

### **AI Chat Panel**

#### 43. **Quick Question Buttons**

- **Action**: `onClick={() => setInputMessage(q)}`
- **Flow**:

  ```
  Click → Sets inputMessage to question text
       → User can then send or edit
  ```

- **Questions**:
  - "What's my revenue this period?"
  - "Show payment trends"
  - "Any failed payments?"
  - "Compare to last month"
  - "Top customers by value"

#### 44. **Send Message Button**

- **Action**: `onClick={handleSendMessage}`
- **Flow**:

  ```
  Click → Validates inputMessage
       → setIsStreaming(true)
       → Adds user message to chat
       → Calls stripe-payouts-ai function (POST)
       → Streams response chunks
       → Updates assistant message in real-time
       → setIsStreaming(false)
  ```

- **API**: `stripe-payouts-ai` Edge Function
- **Method**: POST with streaming response
- **Body**: `{ action: "chat", message, context, history }`

#### 45. **Input Enter Key**

- **Action**: `onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}`
- **Flow**: Same as Send Message Button

---

## 📞 Call Tracking Page (`/call-tracking`)

### **Filter Controls**

#### 46. **Owner Filter**

- **Action**: `onFilterChange("owner", value)`
- **Flow**:

  ```
  Select → setFilters({ ...filters, owner: value })
        → Filters enrichedCalls by owner_name
  ```

#### 47. **Quality Filter**

- **Action**: `onFilterChange("quality", value)`
- **Flow**:

  ```
  Select → setFilters({ ...filters, quality: value })
        → Filters by lead_score:
           - hot: score >= 80
           - warm: 60 <= score < 80
           - cold: score < 60
  ```

#### 48. **Status Filter**

- **Action**: `onFilterChange("status", value)`
- **Flow**:

  ```
  Select → setFilters({ ...filters, status: value })
        → Filters by call_status:
           - completed: call_status === 'completed'
           - missed: ['missed', 'no_answer']
           - initiated: call_status === 'initiated'
  ```

#### 49. **Location Filter**

- **Action**: `onFilterChange("location", value)`
- **Flow**:

  ```
  Select → setFilters({ ...filters, location: value })
        → Filters by city or dubai_area
  ```

#### 50. **Clear Filters Button**

- **Action**: `onClearFilters()`
- **Flow**:

  ```
  Click → setFilters({ owner: 'all', quality: 'all', status: 'all', location: 'all' })
       → Resets all filters to 'all'
  ```

---

## 👥 Clients Page (`/clients`)

### **Header Actions**

#### 51. **Refresh Button**

- **Action**: `onRefresh={async () => { await refetch(); }}`
- **Flow**:

  ```
  Click → Refetches client-health-scores query
       → Updates client list
  ```

### **Search & Filters**

#### 52. **Search Input**

- **Action**: `onChange={(e) => setSearchTerm(e.target.value)}`
- **Flow**:

  ```
  Type → Updates searchTerm state
      → Filters clients by name or email (case-insensitive)
  ```

#### 53. **Health Zone Filter**

- **Action**: `setHealthZoneFilter(value)`
- **Flow**:

  ```
  Select → Updates healthZoneFilter state
         → Refetches useClientHealthScores hook with new filter
         → Updates client list
  ```

- **Options**: All Zones, RED, YELLOW, GREEN, PURPLE

#### 54. **Segment Filter**

- **Action**: `setSegmentFilter(value)`
- **Flow**:

  ```
  Select → Updates segmentFilter state
         → Refetches useClientHealthScores hook
  ```

- **Options**: All Segments, ACTIVE_CONSISTENT, ACTIVE_SPORADIC, INACTIVE_RECENT, INACTIVE_LONG, CHURNED

#### 55. **Coach Filter**

- **Action**: `setCoachFilter(value)`
- **Flow**:

  ```
  Select → Updates coachFilter state
         → Refetches useClientHealthScores hook
  ```

- **Options**: All Coaches + unique coach names from data

### **Zone Distribution Chart**

#### 56. **Zone Click** (In Chart)

- **Action**: `onZoneSelect={setHealthZoneFilter}`
- **Flow**:

  ```
  Click zone → setHealthZoneFilter(zone)
            → Refetches clients with zone filter
  ```

### **Error State**

#### 57. **Try Again Button**

- **Action**: `onClick={() => refetch()}`
- **Flow**:

  ```
  Click → Refetches client-health-scores query
  ```

---

## 🎛️ PTD Control Page (`/ptd-control`)

### **Mode Switch**

#### 58. **Test/Live Mode Toggle**

- **Action**: `onCheckedChange={(checked) => setMode(checked ? "live" : "test")}`
- **Flow**:

  ```
  Toggle → Updates mode state
        → localStorage.setItem("ptd-mode", mode)
        → Passes mode to all tab components
  ```

- **Persistence**: Saved to localStorage

### **Tab Navigation**

#### 59. **Dashboard Tab**

- **Action**: `setActiveTab("dashboard")`
- **Flow**: Shows DashboardTab component

#### 60. **Stripe Tab**

- **Action**: `setActiveTab("stripe")`
- **Flow**: Shows StripeDashboardTab component

#### 61. **Forensics Tab**

- **Action**: `setActiveTab("forensics")`
- **Flow**: Shows StripeForensicsTab component

#### 62. **HubSpot Tab**

- **Action**: `setActiveTab("hubspot")`
- **Flow**: Shows HubSpotCommandCenter component

#### 63. **Health Tab**

- **Action**: `setActiveTab("health")`
- **Flow**: Shows HealthIntelligenceTab component

#### 64. **CAPI Tab**

- **Action**: `setActiveTab("capi")`
- **Flow**: Shows CAPITab component

#### 65. **Ad Events Tab**

- **Action**: `setActiveTab("events")`
- **Flow**: Shows AdEventsTab component

#### 66. **Coaches Tab**

- **Action**: `setActiveTab("coaches")`
- **Flow**: Shows CoachReviewsTab component

#### 67. **Pipeline Tab**

- **Action**: `setActiveTab("enrichment")`
- **Flow**: Shows DataEnrichmentTab component

#### 68. **Automation Tab**

- **Action**: `setActiveTab("automation")`
- **Flow**: Shows AutomationTab component

#### 69. **Settings Tab**

- **Action**: `setActiveTab("settings")`
- **Flow**: Shows SettingsTab component

---

## ⚙️ Operations Page (`/operations`)

### **Mode Switch**

#### 70. **Test/Live Mode Toggle**

- **Action**: `onCheckedChange={(checked) => setMode(checked ? "live" : "test")}`
- **Flow**: Same as PTD Control mode toggle

### **Tab Navigation**

#### 71. **HubSpot Tab**

- **Action**: `setActiveTab("hubspot")`
- **Flow**: Shows HubSpotCommandCenter component

#### 72. **Calls Tab**

- **Action**: `setActiveTab("calls")`
- **Flow**: Shows CallTracking page component (embedded)

#### 73. **Automation Tab**

- **Action**: `setActiveTab("automation")`
- **Flow**: Shows nested tabs:
  - Strategy → WorkflowStrategy component
  - Analyzer → HubSpotAnalyzer component
  - Rules → AutomationTab component

#### 74. **System Tab**

- **Action**: `setActiveTab("system")`
- **Flow**: Shows SettingsTab component

---

## 🤖 AI Dev Console (`/ai-dev`)

### **Command Input**

#### 75. **Submit Command Button**

- **Action**: `onSubmit={handleSubmit}`
- **Flow**:

  ```
  Submit → Prevents default
        → Validates command
        → Calls API to create action
        → Refreshes pending actions
        → Resets form
  ```

#### 76. **Quick Command Buttons**

- **Action**: `onClick={() => handleQuickCommand(qc.command)}`
- **Flow**:

  ```
  Click → Sets command input to quick command text
       → User can edit or submit
  ```

- **Quick Commands**: Predefined command templates

#### 77. **Refresh Actions Button**

- **Action**: `onClick={() => refetch()}`
- **Flow**:

  ```
  Click → Refetches pending/executing/history actions
  ```

### **Action Management**

#### 78. **Approve Action Button**

- **Action**: `onClick={() => approveAction.mutate(selectedAction.id)}`
- **Flow**:

  ```
  Click → Calls approve mutation
       → Updates action status to 'executing'
       → Moves to executing tab
  ```

#### 79. **Reject Action Button**

- **Action**: Opens reject dialog → `onClick={() => rejectAction.mutate({ id, reason })}`
- **Flow**:

  ```
  Click → Opens reject dialog
       → Enter reason
       → Confirm → Updates action status to 'rejected'
       → Moves to history tab
  ```

#### 80. **Preview Action Button**

- **Action**: `onClick={onPreview}`
- **Flow**:

  ```
  Click → Opens preview dialog
       → Shows action details
  ```

#### 81. **Close Preview Dialog**

- **Action**: `onClick={() => setPreviewOpen(false)}`
- **Flow**: Closes preview dialog

#### 82. **Close Reject Dialog**

- **Action**: `onClick={() => setRejectDialogOpen(false)}`
- **Flow**: Closes reject dialog

### **Tab Navigation**

#### 83. **Pending Tab**

- **Action**: `setActiveTab("pending")`
- **Flow**: Shows pending actions list

#### 84. **Executing Tab**

- **Action**: `setActiveTab("executing")`
- **Flow**: Shows executing actions list

#### 85. **History Tab**

- **Action**: `setActiveTab("history")`
- **Flow**: Shows history actions list

---

## 🧭 Navigation Bar (Global)

### **Main Navigation Links**

#### 86. **Dashboard Link**

- **Path**: `/` or `/dashboard`
- **Action**: `navigate("/")`
- **Flow**: Navigate to Dashboard page

#### 87. **Sales Link**

- **Path**: `/sales-pipeline`
- **Action**: `navigate("/sales-pipeline")`
- **Flow**: Navigate to Sales Pipeline page

#### 88. **Stripe Link**

- **Path**: `/stripe`
- **Action**: `navigate("/stripe")`
- **Flow**: Navigate to Stripe Intelligence page

#### 89. **Calls Link**

- **Path**: `/call-tracking`
- **Action**: `navigate("/call-tracking")`
- **Flow**: Navigate to Call Tracking page

#### 90. **HubSpot Link**

- **Path**: `/hubspot-live`
- **Action**: `navigate("/hubspot-live")`
- **Flow**: Navigate to HubSpot Live Data page

#### 91. **Audit Link**

- **Path**: `/audit-trail`
- **Action**: `navigate("/audit-trail")`
- **Flow**: Navigate to Audit Trail page

#### 92. **Clients Link**

- **Path**: `/clients`
- **Action**: `navigate("/clients")`
- **Flow**: Navigate to Clients page

#### 93. **Coaches Link**

- **Path**: `/coaches`
- **Action**: `navigate("/coaches")`
- **Flow**: Navigate to Coaches page

#### 94. **Interventions Link**

- **Path**: `/interventions`
- **Action**: `navigate("/interventions")`
- **Flow**: Navigate to Interventions page

#### 95. **AI Knowledge Link**

- **Path**: `/ai-knowledge`
- **Action**: `navigate("/ai-knowledge")`
- **Flow**: Navigate to AI Knowledge page

#### 96. **AI Learning Link**

- **Path**: `/ai-learning`
- **Action**: `navigate("/ai-learning")`
- **Flow**: Navigate to AI Learning page

### **More Menu Links**

#### 97. **AI Dev Console**

- **Path**: `/ai-dev`
- **Action**: `navigate("/ai-dev")`

#### 98. **CEO War Room**

- **Path**: `/war-room`
- **Action**: `navigate("/war-room")`

#### 99. **Analytics**

- **Path**: `/analytics`
- **Action**: `navigate("/analytics")`

#### 100. **Marketing Stress Test**

- **Path**: `/marketing-stress-test`
- **Action**: `navigate("/marketing-stress-test")`

#### 101. **PTD Control**

- **Path**: `/ptd-control`
- **Action**: `navigate("/ptd-control")`

#### 102. **AI CEO**

- **Path**: `/ultimate-ceo`
- **Action**: `navigate("/ultimate-ceo")`

#### 103. **HubSpot Analyzer**

- **Path**: `/hubspot-analyzer`
- **Action**: `navigate("/hubspot-analyzer")`

#### 104. **Coach Tracker**

- **Path**: `/sales-coach-tracker`
- **Action**: `navigate("/sales-coach-tracker")`

#### 105. **Yesterday Bookings**

- **Path**: `/yesterday-bookings`
- **Action**: `navigate("/yesterday-bookings")`

#### 106. **Workflow Strategy**

- **Path**: `/workflow-strategy`
- **Action**: `navigate("/workflow-strategy")`

### **Sync Button** (Navigation Bar)

#### 107. **Sync HubSpot Button**

- **Action**: `handleSync()`
- **Flow**:

  ```
  Click → setIsSyncing(true)
       → supabase.functions.invoke('sync-hubspot-to-supabase')
       → toast.success("Sync Complete")
       → setIsSyncing(false)
  ```

- **API**: `sync-hubspot-to-supabase` Edge Function

### **Quick Actions** (Mobile Menu)

#### 108. **Sync HubSpot** (Mobile)

- **Action**: Same as Sync Button (#107)

#### 109. **Open Stripe** (Mobile)

- **Action**: Opens `https://dashboard.stripe.com` in new tab

#### 110. **Open HubSpot** (Mobile)

- **Action**: Opens `https://app.hubspot.com` in new tab

---

## 📦 Dashboard Components

### **QuickActionsPanel Component**

#### 111. **Sync HubSpot Button**

- **Action**: `syncHubSpot()`
- **Flow**:

  ```
  Click → setLoading("sync")
       → supabase.functions.invoke('sync-hubspot-to-supabase')
       → toast("Sync Complete: X contacts synced")
       → setLoading(null)
  ```

- **API**: `sync-hubspot-to-supabase`

#### 112. **Run BI Agent Button**

- **Action**: `runBIAgent()`
- **Flow**:

  ```
  Click → setLoading("bi-agent")
       → supabase.functions.invoke('business-intelligence')
       → toast("BI Agent Complete: X clients analyzed")
       → setLoading(null)
  ```

- **API**: `business-intelligence`

#### 113. **Generate Interventions Button**

- **Action**: `generateInterventions()`
- **Flow**:

  ```
  Click → setLoading("interventions")
       → supabase.functions.invoke('intervention-recommender')
       → toast("Interventions Generated: X recommendations")
       → setLoading(null)
  ```

- **API**: `intervention-recommender`

#### 114. **View Clients Button**

- **Action**: `navigate("/clients")`
- **Flow**: Navigate to Clients page

#### 115. **Call Tracking Button**

- **Action**: `navigate("/call-tracking")`
- **Flow**: Navigate to Call Tracking page

#### 116. **AI Control Button**

- **Action**: `navigate("/ptd-control")`
- **Flow**: Navigate to PTD Control page

### **LiveQuickActions Component**

#### 117. **Run BI Agent**

- **Action**: `onRunBI()` (prop function)
- **Flow**: Calls parent's Run BI function

#### 118. **Sync HubSpot**

- **Action**: `onSyncHubSpot()` (prop function)
- **Flow**: Calls parent's Sync function

#### 119. **Churn Predictor**

- **Action**: `runChurnPredictor()`
- **Flow**:

  ```
  Click → setIsRunningChurn(true)
       → supabase.functions.invoke('churn-predictor')
       → toast("Churn Analysis Complete")
       → setIsRunningChurn(false)
  ```

- **API**: `churn-predictor`

#### 120. **Daily Report**

- **Action**: `generateDailyReport()`
- **Flow**:

  ```
  Click → setIsRunningReport(true)
       → supabase.functions.invoke('daily-report')
       → toast("Report Generated")
       → setIsRunningReport(false)
  ```

- **API**: `daily-report`

#### 121. **PTD Control**

- **Action**: `navigate('/ptd-control')`
- **Flow**: Navigate to PTD Control page

#### 122. **At-Risk Clients**

- **Action**: `navigate('/clients?zone=RED')`
- **Flow**: Navigate to Clients page with RED filter

---

## 🔄 Complete Flow Diagrams

### **Sync HubSpot Flow**

```
User clicks Sync Button
  ↓
setIsSyncing(true)
  ↓
supabase.functions.invoke('sync-hubspot-to-supabase')
  ↓
Edge Function executes:
  - Fetches contacts from HubSpot API
  - Fetches leads from HubSpot API
  - Fetches deals from HubSpot API
  - Fetches call records from HubSpot API
  - Upserts to Supabase tables
  ↓
Returns: { contacts_synced, leads_synced, deals_synced, calls_synced }
  ↓
toast.success("Synced X contacts, Y leads...")
  ↓
queryClient.invalidateQueries(['lead-funnel', 'contacts', ...])
  ↓
All queries refetch automatically
  ↓
setIsSyncing(false)
```

### **Run BI Agent Flow**

```
User clicks Run BI Agent
  ↓
setLoading("bi-agent")
  ↓
supabase.functions.invoke('business-intelligence')
  ↓
Edge Function executes:
  - Analyzes client health scores
  - Detects patterns
  - Generates insights
  - Updates daily_summary table
  ↓
Returns: { clients_analyzed, insights_generated }
  ↓
toast("BI Agent Complete: X clients analyzed")
  ↓
setLoading(null)
```

### **Generate Interventions Flow**

```
User clicks Generate Interventions
  ↓
setLoading("interventions")
  ↓
supabase.functions.invoke('intervention-recommender')
  ↓
Edge Function executes:
  - Identifies at-risk clients
  - Uses AI to generate recommendations
  - Creates intervention_log entries
  ↓
Returns: { interventions_created }
  ↓
toast("Interventions Generated: X recommendations")
  ↓
setLoading(null)
```

### **Navigate to Client Detail Flow**

```
User clicks client row/name
  ↓
navigate(`/clients/${email}`)
  ↓
Router loads ClientDetail component
  ↓
Component fetches:
  - Client health scores
  - Intervention history
  - Activity timeline
  - Coach assignments
  ↓
Renders client detail page
```

### **Stripe AI Chat Flow**

```
User types message or clicks quick question
  ↓
handleSendMessage()
  ↓
Validates input
  ↓
setIsStreaming(true)
  ↓
Adds user message to chatMessages
  ↓
POST to stripe-payouts-ai function
  Body: {
    action: "chat",
    message: userMessage,
    context: { balance, metrics, payments, ... },
    history: chatMessages
  }
  ↓
Streams response chunks
  ↓
Updates assistant message in real-time
  ↓
setIsStreaming(false)
```

---

## 📊 API Functions Called

### **Edge Functions Invoked**

1. **sync-hubspot-to-supabase**
   - Called from: Sales Pipeline, Navigation, Quick Actions
   - Parameters: `{ clear_fake_data: boolean, sync_type: 'all' }`
   - Returns: `{ contacts_synced, leads_synced, deals_synced, calls_synced }`

2. **business-intelligence**
   - Called from: Quick Actions Panel
   - Returns: `{ clients_analyzed, insights_generated }`

3. **intervention-recommender**
   - Called from: Quick Actions Panel
   - Returns: `{ interventions_created }`

4. **churn-predictor**
   - Called from: Live Quick Actions
   - Returns: `{ clients_analyzed }`

5. **daily-report**
   - Called from: Live Quick Actions
   - Returns: `{ report_generated }`

6. **stripe-dashboard-data**
   - Called from: Stripe Intelligence page
   - Parameters: `{ startDate, endDate, status, limit }`
   - Returns: Stripe dashboard data

7. **stripe-forensics**
   - Called from: Stripe Intelligence page
   - Parameters: `{ action: "complete-intelligence", days: 30 }`
   - Returns: Forensic analysis data

8. **stripe-payouts-ai**
   - Called from: Stripe AI Chat
   - Method: POST with streaming
   - Parameters: `{ action: "chat", message, context, history }`
   - Returns: Streaming text response

---

## 🎯 Summary Statistics

- **Total Buttons/Actions Documented**: 122+
- **Navigation Routes**: 26
- **API Functions**: 8+
- **Page Components**: 26
- **Dashboard Components**: 39+

---

## 📝 Notes

1. **State Management**: Most buttons use React Query for data fetching and state management
2. **Error Handling**: All API calls include try/catch with toast notifications
3. **Loading States**: Buttons show loading indicators during async operations
4. **Real-time Updates**: Many pages subscribe to Supabase real-time channels
5. **Persistence**: Mode switches (test/live) are saved to localStorage
6. **Navigation**: Uses React Router for client-side routing
7. **External Links**: Stripe and HubSpot buttons open external sites in new tabs

---

**Last Updated**: Based on current codebase analysis
**Total Actions**: 122+ button connections mapped
