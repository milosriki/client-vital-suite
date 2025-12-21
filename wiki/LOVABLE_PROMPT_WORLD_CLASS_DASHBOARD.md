# World-Class Executive Dashboard System - Lovable Implementation Prompt

## Quick Reference: What EXISTS vs What NEEDS TO BE BUILT

### Already Built (Do NOT Rebuild)
| Feature | Status | Location |
|---------|--------|----------|
| 3 Consolidated Pages | ✅ Complete | `/dashboard`, `/operations`, `/analytics` |
| Tabbed Navigation | ✅ Complete | All 3 pages use Shadcn Tabs |
| Dark Theme | ✅ Complete | `src/index.css` |
| Inter Font | ✅ Complete | `tailwind.config.ts` |
| Supabase Data Connections | ✅ Complete | React Query hooks throughout |
| Client Health Cards | ✅ Complete | `ClientRiskMatrix.tsx` (grid view) |
| Predictive Alerts | ✅ Complete | `PredictiveAlerts.tsx` (basic cards) |
| Activity Feed | ✅ Complete | `LiveActivityFeed.tsx` (static list) |
| Basic Audio Player | ✅ Partial | `SalesPipeline.tsx` (HTML5 audio) |
| Skeleton Loaders | ✅ Partial | 10/22 pages use them |
| Empty States | ✅ Partial | Basic text, no illustrations |
| Keyboard Shortcuts | ✅ Complete | In Navigation tooltips |

### Needs To Be Built (Priority)
| Feature | Priority | Description |
|---------|----------|-------------|
| Heatmap Chart | HIGH | Convert ClientRiskMatrix to scatter/heatmap |
| Kanban Board | HIGH | Drag-drop sales pipeline view |
| Ticker Feed | HIGH | Scrolling live HubSpot activity |
| API Usage Gauges | MEDIUM | Circular progress for API limits |
| Enhanced Audio Player | MEDIUM | Custom controls, speed, waveform |
| Workflow Status Diagram | MEDIUM | Visual Active/Paused/Error |
| Traffic Light Badges | LOW | Glowing circular health badges |
| Collapsible Sidebar | LOW | Desktop sidebar option |

---

## Context & Current State

We have successfully consolidated a fragmented 22-page app into 3 powerful command centers:
- **Executive Dashboard** (`/dashboard`) - 5 tabs: Today, Sales, Clients, HubSpot, Revenue
- **Operations Center** (`/operations`) - 4 tabs: HubSpot, Calls, Automation, System  
- **Analytics & Intelligence** (`/analytics`) - 4 tabs: Business, AI Intelligence, Marketing, Financial

**All data connections (Supabase/React Query) are built and working.** We need you to polish the Presentation Layer to be visually stunning, highly readable, and intuitive.

---

## 1. Design System & Aesthetic Requirements

### Current State: ✅ DARK THEME EXISTS
- Dark mode is already configured in `src/index.css`
- Theme uses Zinc 950 background, high contrast colors
- Inter font is configured in `tailwind.config.ts`

### What Needs Enhancement:
- **Mission Control Vibe**: Make it feel like a Bloomberg Terminal or NASA Mission Control
- **Data Density**: Show maximum information without clutter
- **Visual Hierarchy**: Use size, color, and spacing to guide attention
- **Typography**: Ensure numbers are highly legible (consider monospace for metrics)

### Specific Design Tokens:
```css
/* Use these existing tokens but enhance contrast */
--background: 240 10% 3.9% (Zinc 950)
--foreground: 0 0% 98% (Near white)
--card: 240 10% 7% (Zinc 900)
--muted: 240 4% 16% (Subtle borders)
--primary: 263 70% 50% (Violet accent)
```

---

## 2. Executive Dashboard (`/dashboard`) - Enhancement Requirements

### Tab 1: **Today (Daily Pulse)** - ACTIONABLE ITEMS FOCUS

#### Current State:
- ✅ `TodaysActivityWidget` exists (`src/components/dashboard/widgets/TodaysActivityWidget.tsx`)
- ✅ `PredictiveAlerts` exists (`src/components/dashboard/PredictiveAlerts.tsx`)
- ✅ `InterventionTracker` exists (`src/components/InterventionTracker.tsx`)
- ✅ `ClientRiskMatrix` exists (`src/components/dashboard/ClientRiskMatrix.tsx`)

#### What Needs Enhancement:

**A. ClientRiskMatrix - Convert to True Heatmap**
- **Current**: Grid of cards with colored borders
- **Required**: True heatmap visualization using Recharts or custom SVG
- **Layout**: 
  - X-axis: Risk Score (0-100)
  - Y-axis: Health Score (0-100)
  - Color intensity: Risk category (CRITICAL=red, HIGH=orange, MEDIUM=yellow, LOW=green)
  - Hover: Show client details tooltip
  - Click: Navigate to client detail page

**B. PredictiveAlerts - Add Urgency Indicators**
- **Current**: Simple cards with icons
- **Required**: 
  - Add pulsing animation for critical alerts
  - Add countdown timers for time-sensitive items
  - Add "Take Action" buttons with direct links
  - Color code: Red (urgent), Orange (high), Yellow (medium), Green (info)

**C. InterventionTracker - Enhanced Presentation**
- **Current**: List view with badges
- **Required**:
  - Add timeline visualization (vertical timeline on left)
  - Group by status (Pending, In Progress, Completed)
  - Add quick action buttons (Call Now, Schedule, Mark Complete)
  - Show AI recommendations prominently

**D. Mobile Optimization**
- Ensure Today tab is 100% mobile-friendly
- Stack cards vertically on mobile
- Make heatmap scrollable horizontally
- Touch-friendly action buttons

---

### Tab 2: **Sales (Pipeline)** - KANBAN/FUNNEL VIEW

#### Current State:
- ✅ `PipelineOverviewWidget` exists (`src/components/dashboard/widgets/PipelineOverviewWidget.tsx`)
- ✅ `SalesPipeline` page exists (`src/pages/SalesPipeline.tsx`) with table view

#### What Needs Enhancement:

**A. Kanban Board View**
- **Required**: Create drag-and-drop Kanban board
- **Columns**: New Leads → Follow Up → Appointment Set → Pitch Given → Closed
- **Cards**: Show lead name, value, owner, days in stage
- **Visual**: 
  - Color code by stage
  - Show deal value prominently
  - Show "stuck" deals (red border if >7 days in stage)
- **Interaction**: Drag to move between stages (update via API)

**B. Funnel View Alternative**
- **Required**: Visual funnel chart using Recharts
- **Stages**: Show conversion rates between stages
- **Metrics**: Display drop-off percentages
- **Tooltip**: Show count and value at each stage

**C. Setter Performance**
- **Required**: Grid showing each setter's:
  - Leads assigned
  - Conversion rate
  - Average deal value
  - Calls made today
- **Visual**: Use progress bars and badges

---

### Tab 3: **Clients (Health)** - TRAFFIC LIGHT STATUS

#### Current State:
- ✅ `LiveHealthDistribution` exists (`src/components/dashboard/LiveHealthDistribution.tsx`)
- ✅ `ClientTable` exists (`src/components/ClientTable.tsx`)

#### What Needs Enhancement:

**A. Traffic Light Badges**
- **Current**: Text badges (RED, YELLOW, GREEN, PURPLE)
- **Required**: 
  - Circular badges with glow effect
  - Red: `bg-red-500` with `shadow-glow-danger`
  - Yellow: `bg-yellow-500` with `shadow-glow-warning`
  - Green: `bg-green-500` with `shadow-glow-success`
  - Purple: `bg-purple-500` with `shadow-glow`
- **Size**: Larger badges (20px diameter) for better visibility

**B. Enhanced Table View**
- **Required**: 
  - Sortable columns (health score, risk, last contact)
  - Filter by zone (dropdown)
  - Search by name/email
  - Export to CSV button
  - Pagination (50 per page)

**C. Health Score Visualization**
- **Required**: 
  - Progress bars with color coding
  - Trend arrows (↑ improving, ↓ declining, → stable)
  - Mini sparkline charts showing 7-day trend

---

### Tab 4: **HubSpot (Live)** - TICKER/LIVE LOG

#### Current State:
- ✅ `LiveActivityFeed` exists (`src/components/dashboard/LiveActivityFeed.tsx`)
- ✅ `HubSpotManagementDashboard` exists (`src/components/hubspot/HubSpotManagementDashboard.tsx`)

#### What Needs Enhancement:

**A. Ticker Style Feed**
- **Current**: Static list
- **Required**: 
  - Scrolling ticker at top (like stock market)
  - Auto-scroll with pause on hover
  - Color-coded by activity type (call=blue, email=green, deal=purple)
  - Timestamp in relative format ("2m ago", "1h ago")

**B. Live Log View**
- **Required**: 
  - Terminal-style log view
  - Monospace font for timestamps
  - Color-coded entries
  - Auto-scroll to bottom
  - Filter by activity type
  - Search functionality

**C. Real-time Indicators**
- **Required**: 
  - "LIVE" badge with pulsing dot
  - Last sync timestamp
  - Connection status indicator
  - Activity count in last 5 minutes

---

### Tab 5: **Revenue** - STRIPE FINANCIAL CHARTS

#### Current State:
- ✅ `RevenueWidget` exists (`src/components/dashboard/widgets/RevenueWidget.tsx`)
- ✅ `LiveRevenueChart` exists (`src/components/dashboard/LiveRevenueChart.tsx`)

#### What Needs Enhancement:

**A. Enhanced Revenue Charts**
- **Required**: 
  - Line chart showing daily revenue (last 30 days)
  - Bar chart showing monthly comparison
  - Pie chart showing revenue by source
  - Forecast line (projected next 30 days)

**B. Stripe Integration Display**
- **Required**: 
  - Current balance card
  - Pending payouts
  - Recent transactions table
  - Payment method status
  - Subscription metrics (MRR, churn rate)

---

## 3. Operations Center (`/operations`) - Enhancement Requirements

### Tab 1: **HubSpot** - SYSTEM HEALTH

#### Current State:
- ✅ `HubSpotCommandCenter` exists (`src/components/ptd/HubSpotCommandCenter.tsx`)
- ✅ `HubSpotAnalyzer` exists (`src/pages/HubSpotAnalyzer.tsx`)

#### What Needs Enhancement:

**A. System Health Status Dashboard**
- **Required**: 
  - Large status cards (Connected/Disconnected/Warning)
  - Last sync timestamp with auto-refresh
  - Sync error count badge (red if >0)
  - API rate limit usage gauge

**B. Sync Errors Table**
- **Required**: 
  - Table with red accents for errors
  - Columns: Timestamp, Error Type, Contact ID, Error Message
  - Filter by error type
  - "Retry Failed Syncs" button
  - Export errors to CSV

**C. API Usage Gauges** ⚠️ MISSING COMPONENT
- **Required**: 
  - Circular progress gauges showing:
    - Daily API calls used / limit
    - Rate limit remaining
    - Error rate percentage
  - Color coding: Green (<50%), Yellow (50-80%), Red (>80%)
  - Tooltip showing exact numbers

---

### Tab 2: **Calls** - AUDIO PLAYER

#### Current State:
- ✅ `CallTracking` page exists (`src/pages/CallTracking.tsx`)
- ✅ Call records are displayed in table
- ✅ Basic HTML5 audio player exists in `SalesPipeline.tsx` (lines 969-977)

#### What Needs Enhancement:

**A. Audio Player Controls** ⚠️ NEEDS ENHANCEMENT (Basic exists)
- **Current**: Basic HTML5 `<audio controls>` element in SalesPipeline.tsx
- **Required Enhancement**: 
  - Custom styled audio player component
  - Play/Pause button with icon
  - Visual progress bar (scrubbing)
  - Duration display (current / total)
  - Volume control slider
  - Speed control (0.5x, 1x, 1.5x, 2x)
  - Waveform visualization (optional)
- **Data Source**: Call audio URLs from `call_records` table (`recording_url` field)

**B. Outcome Badges Enhancement**
- **Current**: Basic badges
- **Required**: 
  - More prominent badges
  - Icons for each outcome
  - Color coding: Completed=green, Missed=red, Voicemail=yellow
  - Click to filter by outcome

**C. Call Analytics**
- **Required**: 
  - Average call duration
  - Call volume chart (by hour/day)
  - Top callers list
  - Call quality scores (if available)

---

### Tab 3: **Automation** - WORKFLOW STATUS

#### Current State:
- ✅ `WorkflowStrategy` exists (`src/pages/WorkflowStrategy.tsx`)
- ✅ `AutomationTab` exists (`src/components/ptd/AutomationTab.tsx`)

#### What Needs Enhancement:

**A. Visual Workflow Status** ⚠️ NEEDS ENHANCEMENT
- **Current**: Text-based status
- **Required**: 
  - Visual workflow diagram
  - Status indicators: 
    - 🟢 Active (green dot)
    - 🟡 Paused (yellow dot)
    - 🔴 Error (red dot with error count)
  - Click workflow to see details
  - Toggle Active/Paused with switch

**B. Workflow Performance Metrics**
- **Required**: 
  - Executions today/week/month
  - Success rate percentage
  - Average execution time
  - Error rate
  - Last run timestamp

---

### Tab 4: **System** - CONFIGURATION & STATUS

#### Current State:
- ✅ `DashboardTab` exists (`src/components/ptd/DashboardTab.tsx`)
- ✅ `AuditTrail` exists (`src/pages/AuditTrail.tsx`)
- ✅ `SettingsTab` exists (`src/components/ptd/SettingsTab.tsx`)

#### What Needs Enhancement:

**A. Configuration Toggles**
- **Required**: 
  - Large, prominent toggle switches
  - Group by category (Sync, Notifications, Automation)
  - Save state with loading indicator
  - Confirmation dialogs for critical toggles

**B. Environment Status**
- **Required**: 
  - Status cards for each service:
    - Supabase (green/yellow/red)
    - HubSpot API (green/yellow/red)
    - Stripe API (green/yellow/red)
    - n8n Workflows (green/yellow/red)
  - Last check timestamp
  - "Test Connection" buttons

---

## 4. Analytics & Intelligence (`/analytics`) - Enhancement Requirements

### Tab 1: **Business** - TREND LINES

#### Current State:
- ✅ Analytics page exists (`src/pages/Analytics.tsx`)
- ✅ Recharts integration exists

#### What Needs Enhancement:

**A. Long-term Trend Lines**
- **Required**: 
  - Weekly patterns chart (12+ weeks)
  - Health score trends
  - Revenue trends
  - Client acquisition trends
  - All with smooth curves and tooltips

**B. Comparison Views**
- **Required**: 
  - Compare periods (This Month vs Last Month)
  - Year-over-year comparison
  - Toggle between absolute and percentage change

---

### Tab 2: **AI Intelligence** - CHAT INTERFACE

#### Current State:
- ✅ `UltimateAICEO` exists (`src/components/UltimateAICEO.tsx`)
- ✅ Chat interface exists

#### What Needs Enhancement:

**A. Enhanced Chat UI**
- **Required**: 
  - Better message bubbles (user vs AI)
  - Code syntax highlighting
  - Markdown rendering
  - File attachments
  - Voice input button
  - Quick action buttons

**B. AI Insights Panel**
- **Required**: 
  - Proactive insights cards
  - Priority badges
  - Action buttons
  - Dismiss/Archive functionality

---

### Tab 3: **Marketing** - META AD PERFORMANCE

#### Current State:
- ✅ `MetaDashboard` exists (`src/pages/MetaDashboard.tsx`)

#### What Needs Enhancement:

**A. Ad Performance Grids**
- **Required**: 
  - Campaign performance table
  - Metrics: Impressions, Clicks, CTR, CPC, Conversions
  - Sortable columns
  - Date range filter
  - Export to CSV

**B. Visual Charts**
- **Required**: 
  - Spend over time (line chart)
  - ROAS by campaign (bar chart)
  - Conversion funnel (funnel chart)

---

### Tab 4: **Financial** - REVENUE FORECASTING

#### Current State:
- ✅ `StripeIntelligence` exists (`src/pages/StripeIntelligence.tsx`)

#### What Needs Enhancement:

**A. Revenue Forecasting**
- **Required**: 
  - Projected MRR chart (next 6 months)
  - Growth rate calculation
  - Churn prediction
  - Revenue breakdown by product/service

**B. MRR Growth Charts**
- **Required**: 
  - Monthly MRR trend
  - New MRR vs Churned MRR
  - Net MRR growth
  - Customer count growth

---

## 5. Global UI Polish Requirements

### A. Navigation Enhancement

#### Current State:
- ✅ Top navigation exists (`src/components/Navigation.tsx`)
- ✅ Keyboard shortcuts already shown in tooltips (e.g., "g d" for dashboard)
- ✅ Active state indicator exists
- ✅ Lucide React icons used throughout
- ✅ Mobile hamburger menu with Sheet component

#### What Needs Enhancement:
- **Collapsible Sidebar**: Add sidebar navigation option (toggle button for desktop)
- **Enhanced Active State**: More prominent/glowing active page indicator
- **Breadcrumbs**: Add breadcrumbs for deep navigation (optional)

---

### B. Loading States - SKELETON LOADERS

#### Current State:
- ✅ `Skeleton` component exists (`src/components/ui/skeleton.tsx`)
- ⚠️ Some pages use spinners instead of skeletons

#### What Needs Enhancement:
- **Replace ALL spinners** with skeleton loaders that match content shape
- **Examples**:
  - Table skeleton: Rows with shimmer effect
  - Card skeleton: Rectangle with rounded corners
  - Chart skeleton: Grid lines with placeholder bars
  - List skeleton: Multiple rows with varying widths

**Implementation Pattern:**
```tsx
{isLoading ? (
  <div className="space-y-4">
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-64 w-full" />
  </div>
) : (
  <ActualContent />
)}
```

---

### C. Empty States - ILLUSTRATIONS

#### Current State:
- ✅ Some empty states exist but are basic
- ⚠️ No illustrations

#### What Needs Enhancement:
- **Add Illustrations**: Use Lucide icons or simple SVG illustrations
- **Helpful Messages**: 
  - "All Clear! 🎉" for no alerts
  - "No data yet - Sync from HubSpot to get started" for empty tables
  - "No calls today - Make your first call!" for empty call logs
- **Action Buttons**: Always provide a "Get Started" or "Sync Now" button

**Example Pattern:**
```tsx
{data.length === 0 ? (
  <Card className="p-12 text-center">
    <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500 opacity-50" />
    <h3 className="text-lg font-semibold mb-2">All Clear!</h3>
    <p className="text-muted-foreground mb-4">No items requiring attention.</p>
    <Button onClick={refresh}>Refresh</Button>
  </Card>
) : (
  <DataTable />
)}
```

---

### D. Mobile Optimization

#### Current State:
- ⚠️ Needs verification and enhancement

#### What Needs Enhancement:
- **Responsive Grids**: Ensure all grids stack on mobile
- **Touch Targets**: Minimum 44px height for buttons
- **Swipe Gestures**: Add swipe to navigate tabs on mobile
- **Bottom Navigation**: Consider bottom nav bar for mobile (optional)
- **Collapsible Sections**: Make long lists collapsible on mobile

**Breakpoints to Test:**
- Mobile: < 640px (sm)
- Tablet: 640px - 1024px (md-lg)
- Desktop: > 1024px (xl+)

---

## 6. Component Library Enhancements

### Existing Components to Enhance:

1. **ClientRiskMatrix** (`src/components/dashboard/ClientRiskMatrix.tsx`)
   - Current: Grid of cards with colored borders
   - Enhance: Convert to true heatmap/scatter plot

2. **LiveActivityFeed** (`src/components/dashboard/LiveActivityFeed.tsx`)
   - Current: Static list of activities
   - Enhance: Add scrolling ticker animation

3. **Audio in SalesPipeline** (`src/pages/SalesPipeline.tsx` lines 969-977)
   - Current: Basic HTML5 `<audio controls>`
   - Enhance: Extract to custom AudioPlayer component

### Required New Components:

1. **HeatmapChart** (`src/components/charts/HeatmapChart.tsx`)
   - Use Recharts ScatterChart or custom SVG
   - Accept data: `{ x: number, y: number, value: number, client: Client }[]`
   - Color scale based on risk category
   - Tooltip on hover, click to navigate

2. **KanbanBoard** (`src/components/sales/KanbanBoard.tsx`)
   - Drag-and-drop using `@dnd-kit/core` or `react-beautiful-dnd`
   - Columns configurable (array of stages)
   - Cards show lead/deal info
   - Update API on drop

3. **TickerFeed** (`src/components/hubspot/TickerFeed.tsx`)
   - CSS animation for scrolling (translateX)
   - Pause on hover (animation-play-state)
   - Auto-refresh with React Query

4. **AudioPlayer** (`src/components/calls/AudioPlayer.tsx`)
   - Wrapper around HTML5 audio element
   - Custom styled controls (Shadcn Button/Slider)
   - Speed control dropdown (0.5x, 1x, 1.5x, 2x)
   - Optional: Waveform using wavesurfer.js

5. **WorkflowStatusDiagram** (`src/components/automation/WorkflowStatusDiagram.tsx`)
   - Visual workflow boxes with arrows
   - Status dot indicators (green/yellow/red)
   - Expandable details on click

6. **UsageGauge** (`src/components/system/UsageGauge.tsx`)
   - Circular SVG progress (or Recharts RadialBarChart)
   - Color coding: Green (<50%), Yellow (50-80%), Red (>80%)
   - Tooltip with exact numbers

---

## 7. Implementation Priority

### Phase 1: Critical UX Improvements (Do First)
1. ⬜ Complete skeleton loader coverage (10/22 pages done)
2. ⬜ Enhance empty states with Lucide icons/illustrations
3. ⬜ Add glowing traffic light badges to client health table
4. ⬜ Mobile optimization for Today tab (stack, touch targets)
5. ⬜ Add pulsing animation to urgent PredictiveAlerts

### Phase 2: Visual Enhancements (Do Second)
1. ⬜ Convert ClientRiskMatrix to true heatmap (NEW COMPONENT)
2. ⬜ Create Kanban board for Sales pipeline (NEW COMPONENT)
3. ⬜ Add ticker feed for HubSpot live activity (NEW COMPONENT)
4. ⬜ Enhance revenue charts with forecasting line
5. ⬜ Add workflow status visualization (NEW COMPONENT)

### Phase 3: Advanced Features (Do Third)
1. ⬜ Create custom AudioPlayer component with speed controls
2. ⬜ Create API usage gauges (NEW COMPONENT)
3. ⬜ Add drag-and-drop to Kanban
4. ⬜ Enhanced AI chat interface (markdown, syntax highlighting)
5. ⬜ Revenue forecasting charts with MRR projection

---

## 8. Technical Notes

### Existing Data Sources:
- **Supabase Tables**: `client_health_scores`, `leads`, `deals`, `call_records`, `intervention_log`, `contact_activities`
- **Edge Functions**: `hubspot-live-query`, `sync-hubspot-to-supabase`, `business-intelligence`
- **React Query**: All data fetching is already set up with proper caching

### Styling Approach:
- Use Tailwind CSS utility classes
- Leverage existing Shadcn UI components
- Follow existing dark theme tokens
- Add custom animations for polish

### Performance Considerations:
- Use React.memo for expensive components
- Implement virtual scrolling for long lists
- Lazy load charts (only render when tab is active)
- Debounce search inputs

---

## 9. Success Criteria

After implementation, the dashboard should:
- ✅ Load in <2 seconds
- ✅ Be fully responsive (mobile, tablet, desktop)
- ✅ Have zero spinner loaders (all skeletons)
- ✅ Have helpful empty states everywhere
- ✅ Show critical information in <30 seconds (executive goal)
- ✅ Be accessible (keyboard navigation, screen reader friendly)
- ✅ Have smooth animations (no janky transitions)

---

## 10. Files to Reference

### Main Page Files (Already Built - 469, 225, 273 lines)
| File | Lines | Contains |
|------|-------|----------|
| `src/pages/Dashboard.tsx` | 469 | 5-tab Executive Dashboard with HeroStatCards, Tabs, all widgets |
| `src/pages/Operations.tsx` | 225 | 4-tab Operations Center with mode toggle, status badges |
| `src/pages/Analytics.tsx` | 273 | 4-tab Analytics with Recharts, UltimateAICEO integration |

### Widget Library (Already Built)
| File | Purpose |
|------|---------|
| `src/components/dashboard/widgets/TodaysActivityWidget.tsx` | Today's leads, deals, calls summary |
| `src/components/dashboard/widgets/PipelineOverviewWidget.tsx` | Pipeline stats and stages |
| `src/components/dashboard/widgets/RevenueWidget.tsx` | Revenue metrics display |

### HubSpot Components (Already Built)
| File | Purpose |
|------|---------|
| `src/components/hubspot/HubSpotManagementDashboard.tsx` | Full HubSpot management UI |
| `src/components/hubspot/CriticalAlertsBar.tsx` | Alert bar for critical issues |
| `src/components/hubspot/TodaysActivity.tsx` | Today's HubSpot activity |

### Theme Configuration (Already Built)
| File | Purpose |
|------|---------|
| `src/index.css` | CSS variables, dark theme, health zone colors |
| `tailwind.config.ts` | Font family, custom shadows, animations |

### Components to Enhance
| File | Current | Enhancement Needed |
|------|---------|-------------------|
| `src/components/dashboard/ClientRiskMatrix.tsx` | Grid cards | Heatmap visualization |
| `src/components/dashboard/PredictiveAlerts.tsx` | Static cards | Pulsing urgency animations |
| `src/components/dashboard/LiveActivityFeed.tsx` | Static list | Ticker scroll animation |
| `src/components/dashboard/widgets/PipelineOverviewWidget.tsx` | Stats only | Add Kanban board |
| `src/pages/CallTracking.tsx` | Table view | Custom AudioPlayer component |
| `src/pages/SalesPipeline.tsx` (lines 969-977) | Basic `<audio>` | Extract to reusable component |

---

## Ready to Build!

All the data connections, routing, and basic structure are in place. Focus on making it visually stunning and highly functional. The goal is a "Bloomberg Terminal" level of polish for health coaching business management.

Good luck! 🚀

