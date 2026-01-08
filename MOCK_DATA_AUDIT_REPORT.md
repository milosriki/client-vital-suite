# Mock Data Audit and Fix Report

**Generated:** January 8, 2026  
**Repository:** client-vital-suite  
**Branch:** devin/1767881086-audit-fix-mock-data

## Executive Summary

This report documents a comprehensive audit of all 33 `.tsx` files in the `src/pages` directory to identify mock/test data usage and broken buttons. The audit found that the majority of pages are properly wired to Supabase using the `useDedupedQuery` pattern with real-time updates. Four files required fixes for broken buttons or missing imports, and two files contain intentionally static reference data.

## Section 1: Mock Data Audit

### Files with Hardcoded Data (Intentionally Static)

#### 1. HubSpotAnalyzer.tsx
**Status:** No changes needed - Intentionally static reference data

**Location:** Lines 14-193

**Description:** This file contains static analysis results representing a one-time HubSpot configuration audit. The hardcoded data includes:
- `criticalMetrics` (lines 14-27): Workflow counts, property counts, revenue metrics
- `criticalIssues` (lines 29-65): List of identified HubSpot issues
- `workflowCategories` (lines 67-79): Workflow categorization
- `leadLossPoints` (lines 81-131): Lead loss analysis
- `propertyCategories` (lines 133-142): Property categorization
- `recommendations` (lines 144-193): Action recommendations

**Rationale:** This data represents a snapshot of HubSpot analysis findings, not live operational data. It serves as reference documentation for known issues and is intentionally static.

#### 2. WorkflowStrategy.tsx
**Status:** No changes needed - Instructional reference content

**Location:** Lines 8-282

**Description:** This file contains instructional/reference content for workflow implementation strategy:
- `workflows` (lines 8-66): Workflow definitions and descriptions
- `phases` (lines 68-253): Implementation phase guidelines
- `criticalChecks` (lines 255-282): Checklist items

**Rationale:** This is documentation/guidance content, not operational data. It provides a strategy guide for workflow implementation and should remain static.

### Files Properly Wired to Supabase (No Changes Needed)

The following 28 files are properly wired to Supabase using the `useDedupedQuery` pattern:

| File | Data Sources | Real-time Enabled |
|------|--------------|-------------------|
| Dashboard.tsx | client_health_scores, daily_summary, get_dashboard_stats RPC | Yes (staleTime: Infinity) |
| SalesPipeline.tsx | leads, deals, call_records, dynamic_funnel_view | Yes |
| TeamLeaderboard.tsx | coach_performance, client_health_scores | Yes |
| CampaignMoneyMap.tsx | daily_business_metrics, fb_ads_insights | Yes |
| WarRoom.tsx | client_health_scores, intervention_log | Yes |
| Analytics.tsx | daily_business_metrics, weekly_patterns | Yes |
| YesterdayBookings.tsx | call_records, leads | Yes |
| ClientDetail.tsx | client_health_scores, contacts | Yes |
| AIDevConsole.tsx | agent_memory, agent_patterns | Yes |
| StripeIntelligence.tsx | stripe_transactions, stripe_fraud_alerts | Yes |
| Coaches.tsx | coach_performance, client_health_scores | Yes |
| CallTracking.tsx | call_records, contacts | Yes |
| SetterActivityToday.tsx | call_records, leads | Yes |
| MetaDashboard.tsx | fb_ads_insights | Yes |
| HubSpotLiveData.tsx | leads, deals, call_records | Yes |
| AuditTrail.tsx | audit_log | Yes |
| AIBusinessAdvisor.tsx | client_health_scores | Yes |
| AIKnowledge.tsx | knowledge_base | Yes |
| AILearning.tsx | agent_decisions, agent_patterns | Yes |
| Observability.tsx | ai_execution_metrics | Yes |
| SalesCoachTracker.tsx | client_health_scores, coach_performance | Yes |
| GlobalBrain.tsx | API calls (smart-agent function) | N/A |
| PTDControl.tsx | Wrapper component | N/A |
| Operations.tsx | Wrapper component | N/A |
| MarketingStressTest.tsx | Wrapper component | N/A |
| NotFound.tsx | Static page | N/A |
| DebugStatus.tsx | API calls (system-check) | N/A |
| UltimateCEO.tsx | Wrapper component | N/A |

## Section 2: Broken Buttons Inventory

### Fixed Buttons

#### 1. Interventions.tsx (Lines 212-214)
**Issue:** Three buttons with no onClick handlers
- "Mark Complete" button
- "Add Notes" button  
- "Cancel" button

**Fix Applied:**
- Added `handleMarkComplete()` function to update intervention status to 'COMPLETED' in Supabase
- Added `handleCancel()` function to update intervention status to 'CANCELLED' in Supabase
- Added `handleOpenNotesDialog()` and `handleSaveNotes()` functions for notes management
- Added Dialog component for notes input
- All buttons now have proper onClick handlers with loading states

#### 2. Clients.tsx (Lines 63-66)
**Issue:** "Add Client" button with no onClick handler

**Fix Applied:**
- Added onClick handler that displays an informative toast message
- Message explains that client creation is managed through HubSpot CRM and new clients sync automatically

#### 3. Overview.tsx (Lines 402-404)
**Issue:** "Export Report" button with no onClick handler

**Fix Applied:**
- Added `handleExportReport()` function that generates a CSV report
- Report includes: summary metrics, critical clients list, coach performance data
- Downloads file as `ptd-health-report-{date}.csv`
- Added Download icon to button

## Section 3: Data Wiring Changes

### Interventions.tsx

**Before:**
```tsx
<Button size="sm" variant="default">Mark Complete</Button>
<Button size="sm" variant="outline">Add Notes</Button>
<Button size="sm" variant="ghost">Cancel</Button>
```

**After:**
```tsx
<Button 
  size="sm" 
  variant="default"
  disabled={isUpdating}
  onClick={() => handleMarkComplete(intervention.id)}
>
  Mark Complete
</Button>
<Button 
  size="sm" 
  variant="outline"
  disabled={isUpdating}
  onClick={() => handleOpenNotesDialog(intervention)}
>
  Add Notes
</Button>
<Button 
  size="sm" 
  variant="ghost"
  disabled={isUpdating}
  onClick={() => handleCancel(intervention.id)}
>
  Cancel
</Button>
```

**New Supabase Operations:**
- UPDATE `intervention_log` SET status='COMPLETED', completed_at=NOW() WHERE id=?
- UPDATE `intervention_log` SET status='CANCELLED' WHERE id=?
- UPDATE `intervention_log` SET notes=? WHERE id=?

### Overview.tsx

**Before:**
```tsx
<Button variant="outline" size="sm">
  Export Report
</Button>
```

**After:**
```tsx
<Button variant="outline" size="sm" onClick={handleExportReport}>
  <Download className="h-4 w-4 mr-2" />
  Export Report
</Button>
```

**New Functionality:**
- CSV export with summary metrics, critical clients, and coach performance data

## Section 4: Import Fixes

### AIBusinessAdvisor.tsx

**Issue:** Missing imports for `Clock` and `RefreshCw` icons used in the component

**Before:**
```tsx
import { BrainCircuit, MessageSquare, AlertTriangle, ArrowRight, Zap, Copy, Sparkles, UserX } from 'lucide-react';
```

**After:**
```tsx
import { BrainCircuit, MessageSquare, AlertTriangle, ArrowRight, Zap, Copy, Sparkles, UserX, Clock, RefreshCw } from 'lucide-react';
```

## Section 5: Leaderboard & Money Map Status

### TeamLeaderboard.tsx
**Status:** Properly wired to Supabase

The TeamLeaderboard component uses real-time data from:
- `coach_performance` table for coach metrics
- `client_health_scores` table for client data

Uses `useDedupedQuery` with `staleTime: Infinity` for real-time updates via WebSocket subscriptions.

### CampaignMoneyMap.tsx
**Status:** Properly wired to Supabase

The CampaignMoneyMap component uses real-time data from:
- `daily_business_metrics` table for revenue metrics
- `fb_ads_insights` table for ad spend data

Uses `useDedupedQuery` with `staleTime: Infinity` for real-time updates via WebSocket subscriptions.

## Section 6: Summary

### Files Modified
| File | Changes |
|------|---------|
| Interventions.tsx | Added onClick handlers for Mark Complete, Add Notes, Cancel buttons; Added notes dialog |
| Clients.tsx | Added onClick handler for Add Client button |
| Overview.tsx | Added handleExportReport function and wired Export Report button |
| AIBusinessAdvisor.tsx | Added missing Clock and RefreshCw icon imports |

### Statistics
- **Total files audited:** 33
- **Files with mock data (intentionally static):** 2
- **Files properly wired to Supabase:** 28
- **Files modified:** 4
- **Buttons fixed:** 5
- **Import issues fixed:** 1

### Remaining Technical Debt
1. **HubSpotAnalyzer.tsx** - Contains static analysis data. Consider creating a Supabase table to store HubSpot analysis results if dynamic updates are needed in the future.
2. **WorkflowStrategy.tsx** - Contains instructional content. Could be moved to a CMS or documentation system if content updates are needed frequently.

### Verification Checklist
- [x] All pages audited for mock/test data patterns
- [x] All broken buttons identified and fixed
- [x] Interventions.tsx buttons wired to Supabase mutations
- [x] Overview.tsx export functionality implemented
- [x] AIBusinessAdvisor.tsx import issues resolved
- [x] TeamLeaderboard verified as properly wired
- [x] CampaignMoneyMap verified as properly wired
- [ ] Lint checks passed
- [ ] CI checks passed
