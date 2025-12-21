# 📊 Complete Dashboard & Pages Inventory

## 🎯 All Routes & Pages

### **Main Navigation Pages** (Primary Nav Bar)

1. **Dashboard** (`/` or `/dashboard`)
   - Main overview dashboard
   - KPI metrics, revenue charts, client health
   - Live activity feed
   - Quick actions panel
   - System status

2. **Sales Pipeline** (`/sales-pipeline`)
   - Sales pipeline visualization
   - Deal tracking and management
   - Revenue forecasting

3. **Stripe** (`/stripe`)
   - Stripe Intelligence Dashboard
   - Payment processing insights
   - Revenue analytics
   - Stripe forensics

4. **Call Tracking** (`/call-tracking`)
   - Call logs and tracking
   - Call analytics
   - Call performance metrics

5. **HubSpot Live** (`/hubspot-live`)
   - Real-time HubSpot data
   - Live CRM synchronization
   - Contact and deal updates

6. **Audit Trail** (`/audit-trail`)
   - System audit logs
   - Activity tracking
   - Change history

7. **Clients** (`/clients`)
   - Client list and management
   - Client health scores
   - Client detail pages (`/clients/:email`)

8. **Coaches** (`/coaches`)
   - Coach management
   - Coach performance tracking
   - Coach analytics

9. **Interventions** (`/interventions`)
   - Intervention tracking
   - AI-generated recommendations
   - Intervention history

10. **AI Knowledge** (`/ai-knowledge`)
    - AI knowledge base browser
    - RAG knowledge system
    - Vector embeddings search

11. **AI Learning** (`/ai-learning`)
    - AI decision history
    - Performance tracking
    - Learning metrics

---

### **More Menu Pages** (Dropdown)

12. **AI Dev Console** (`/ai-dev`)
    - AI development tools
    - Function testing
    - System diagnostics

13. **CEO War Room** (`/war-room`)
    - Executive dashboard
    - High-level metrics
    - Strategic overview

14. **Analytics** (`/analytics`)
    - Advanced analytics
    - Data visualization
    - Trend analysis

15. **Marketing Stress Test** (`/marketing-stress-test`)
    - Marketing campaign testing
    - Performance stress testing
    - Campaign analysis

16. **PTD Control** (`/ptd-control`)
    - PTD Intelligence control panel
    - AI agent management
    - Automation settings

17. **AI CEO** (`/ultimate-ceo`)
    - Ultimate CEO dashboard
    - AI-powered insights
    - Executive decision support

18. **HubSpot Analyzer** (`/hubspot-analyzer`)
    - HubSpot data analysis
    - CRM insights
    - Data quality checks

19. **Coach Tracker** (`/sales-coach-tracker`)
    - Sales coach tracking
    - Performance monitoring
    - Activity tracking

20. **Yesterday Bookings** (`/yesterday-bookings`)
    - Previous day bookings
    - Booking analytics
    - Historical data

21. **Workflow Strategy** (`/workflow-strategy`)
    - n8n workflow documentation
    - Workflow management
    - Automation strategies
    - ⚠️ Note: Currently embedded in Operations page, route may need to be added

---

### **Additional Pages**

22. **Operations** (`/operations`)
    - Operations center
    - Contains tabs:
      - HubSpot Command Center
      - Automation Tab
      - Settings Tab
      - Call Tracking (embedded)
      - Workflow Strategy (embedded)
      - HubSpot Analyzer (embedded)

23. **Overview** (`/overview`)
    - General overview page
    - System overview

24. **Meta Dashboard** (`/meta-dashboard`)
    - Meta CAPI dashboard
    - Facebook/Meta integration
    - Campaign tracking

25. **Setter Activity Today** (`/setter-activity-today`)
    - Today's setter activity
    - Daily activity tracking

26. **NotFound** (`*`)
    - 404 error page
    - Catch-all route

---

## 🔄 Page Flows & User Journeys

### **Primary Dashboard Flow**

```
Dashboard → Quick Actions → 
  ├─ Sync HubSpot
  ├─ Run BI Agent
  ├─ Generate Interventions
  ├─ View Clients
  ├─ Call Tracking
  └─ AI Control
```

### **Client Management Flow**

```
Clients → Client Detail (`/clients/:email`) → 
  ├─ Health Scores
  ├─ Intervention History
  ├─ Coach Assignment
  └─ Activity Timeline
```

### **Sales Flow**

```
Sales Pipeline → 
  ├─ Deal Management
  ├─ Revenue Forecasting
  └─ Pipeline Analytics
```

### **AI Intelligence Flow**

```
AI Knowledge → AI Learning → 
  ├─ Knowledge Base Search
  ├─ Decision History
  ├─ Performance Metrics
  └─ Learning Insights
```

### **Operations Flow**

```
Operations → 
  ├─ HubSpot Command Center
  ├─ Automation Settings
  ├─ System Settings
  ├─ Call Tracking
  ├─ Workflow Strategy
  └─ HubSpot Analyzer
```

### **Executive Flow**

```
War Room → Ultimate CEO → 
  ├─ High-Level Metrics
  ├─ Strategic Insights
  ├─ AI Recommendations
  └─ Decision Support
```

### **Analytics Flow**

```
Analytics → 
  ├─ Revenue Analytics
  ├─ Client Analytics
  ├─ Coach Performance
  └─ Trend Analysis
```

---

## 📱 Dashboard Components

### **Main Dashboard Components** (`src/components/dashboard/`)

1. **KPIGrid** - Key Performance Indicators grid
2. **MetricCard** - Individual metric cards
3. **RevenueChart** - Revenue visualization
4. **LiveRevenueChart** - Real-time revenue updates
5. **LiveActivityFeed** - Real-time activity stream
6. **ActivityFeed** - Activity history
7. **ClientRiskMatrix** - Risk assessment matrix
8. **HealthDistribution** - Health score distribution
9. **LiveHealthDistribution** - Real-time health distribution
10. **CoachLeaderboard** - Coach performance rankings
11. **CoachPerformanceTable** - Detailed coach metrics
12. **InterventionTracker** - Intervention tracking
13. **EnhancedInterventionTracker** - Advanced intervention features
14. **DashboardInterventionTracker** - Dashboard-specific tracker
15. **PredictiveAlerts** - AI-generated alerts
16. **ExecutiveBriefing** - Executive summary
17. **TodaySnapshot** - Daily snapshot metrics
18. **LiveTicker** - Real-time ticker updates
19. **RevenueBreakdown** - Revenue analysis
20. **PatternInsights** - Pattern detection insights
21. **LeakDetector** - Revenue leak detection
22. **QuickActions** - Quick action buttons
23. **LiveQuickActions** - Real-time quick actions
24. **QuickActionsPanel** - Quick actions panel
25. **GreetingBar** - User greeting bar
26. **AlertsBar** - Alert notifications bar
27. **ErrorMonitor** - Error monitoring
28. **ErrorMonitorPanel** - Error panel
29. **SystemHealthWidget** - System health indicator
30. **SystemStatusDropdown** - System status menu
31. **SyncStatusBadge** - Sync status indicator
32. **HubSpotSyncStatus** - HubSpot sync status
33. **TestDataAlert** - Test data warning
34. **MissionControlHeader** - Mission control header
35. **EnhancedEmptyState** - Empty state components
36. **DataTable** - Data table component
37. **StatusBadge** - Status badge component
38. **FilterControls** - Filter controls
39. **MetricDrilldownModal** - Metric detail modal

---

## 🎨 Navigation Structure

### **Main Navigation** (Always Visible)

- Dashboard
- Sales
- Stripe
- Calls
- HubSpot
- Audit
- Clients
- Coaches
- Interventions
- AI Knowledge
- AI Learning

### **More Menu** (Dropdown)

- AI Dev Console
- CEO War Room
- Analytics
- Marketing Stress Test
- PTD Control
- AI CEO
- HubSpot Analyzer
- Coach Tracker
- Yesterday Bookings
- Workflow Strategy

### **Quick Actions** (From Dashboard)

- Sync HubSpot
- Run BI Agent
- Generate Interventions
- View Clients
- Call Tracking
- AI Control
- Churn Predictor
- Daily Report
- At-Risk Clients

---

## 🔗 Route Summary

**Total Routes: 26**

**Main Routes:**

- `/` - Dashboard
- `/dashboard` - Dashboard (alias)
- `/operations` - Operations Center
- `/sales-pipeline` - Sales Pipeline
- `/stripe` - Stripe Intelligence
- `/call-tracking` - Call Tracking
- `/audit-trail` - Audit Trail
- `/war-room` - CEO War Room
- `/ai-knowledge` - AI Knowledge Base
- `/ai-learning` - AI Learning Dashboard
- `/overview` - Overview
- `/clients` - Clients List
- `/clients/:email` - Client Detail (dynamic)
- `/coaches` - Coaches
- `/interventions` - Interventions
- `/analytics` - Analytics
- `/meta-dashboard` - Meta Dashboard
- `/ptd-control` - PTD Control
- `/hubspot-analyzer` - HubSpot Analyzer
- `/sales-coach-tracker` - Sales Coach Tracker
- `/setter-activity-today` - Setter Activity Today
- `/yesterday-bookings` - Yesterday Bookings
- `/hubspot-live` - HubSpot Live Data
- `/ultimate-ceo` - Ultimate CEO
- `/marketing-stress-test` - Marketing Stress Test
- `/ai-dev` - AI Dev Console
- `/workflow-strategy` - Workflow Strategy (⚠️ Route missing, component exists)
- `*` - NotFound (404)

---

## 📝 Notes

1. **Workflow Strategy**: The component exists (`WorkflowStrategy.tsx`) and is listed in Navigation, but the route is not defined in `main.tsx`. It's currently embedded in the Operations page.

2. **Operations Page**: Contains multiple embedded components/tabs:
   - HubSpot Command Center
   - Automation Tab
   - Settings Tab
   - Call Tracking (full page component)
   - Workflow Strategy (full page component)
   - HubSpot Analyzer (full page component)

3. **Client Detail**: Uses dynamic routing with email parameter (`/clients/:email`)

4. **Dashboard Components**: 39+ reusable dashboard components in `src/components/dashboard/`

5. **Navigation**: Two-tier navigation system:
   - Main nav (always visible)
   - More menu (dropdown for additional pages)

---

## 🚀 Quick Access Shortcuts

Based on Navigation.tsx, keyboard shortcuts are available:

- `g d` - Dashboard
- `g s` - Sales
- `g c` - Clients
- etc. (first letter of each page)

---

**Last Updated**: Based on current codebase structure
**Total Pages**: 26 routes + 1 dynamic route
**Total Dashboard Components**: 39+
**Navigation Items**: 11 main + 10 more menu items
