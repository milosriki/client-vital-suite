# Mock Data Detection & Cleanup Guide

## Problem

The Vercel production deployment at https://client-vital-suite.vercel.app was displaying test/mock data instead of real production data. This happened because the Supabase database contained test records that were created during development.

## Solution Implemented

We've added an automated test data detection and cleanup system that:

1. **Detects Test Data Automatically** - Scans the database for test data patterns on page load
2. **Shows Prominent Alerts** - Displays a clear warning banner when test data is found
3. **One-Click Cleanup** - Provides an easy button to clear test data and sync real data from HubSpot

## What Was Added

### 1. Test Data Detection Utility (`src/utils/detectTestData.ts`)

This utility automatically detects test data by looking for:
- Emails ending with `@example.com`, `@email.com`, or `@test.com`
- Phone numbers with test patterns (`555-0%`)
- Deals with names containing "test" or "fake"
- Records without HubSpot IDs

```typescript
import { detectTestData, clearTestData } from "@/utils/detectTestData";

// Check for test data
const result = await detectTestData();
// Returns: { hasTestData: boolean, testDataCount: number, sources: string[] }

// Clear test data and sync from HubSpot
const cleanup = await clearTestData();
// Returns: { success: boolean, message: string }
```

### 2. Test Data Alert Component (`src/components/dashboard/TestDataAlert.tsx`)

A reusable alert component that:
- Automatically checks for test data on mount
- Shows a prominent warning banner when test data is detected
- Provides a "Clear & Sync from HubSpot" button
- Can be dismissed by the user
- Shows which tables contain test data

### 3. Integration with Key Pages

The alert has been added to:
- **Dashboard** (`/dashboard`) - Main executive dashboard
- **Overview** (`/overview`) - Client health score overview

Users will see the alert immediately when they land on these pages if test data exists.

## How It Works

### Test Data Detection Patterns

The system looks for these patterns:

**Email Patterns:**
- `*@example.com`
- `*@email.com`
- `*@test.com`

**Phone Patterns:**
- `555-0*` (standard test phone numbers)

**Deal Patterns:**
- Deal names containing "test"
- Deal names containing "fake"
- Deals without `hubspot_deal_id`

### Tables Scanned

- `contacts` - CRM contacts
- `leads` - Lead records
- `enhanced_leads` - Enhanced lead data
- `deals` - Sales deals

### Cleanup Process

When the user clicks "Clear & Sync from HubSpot":

1. **Deletes Test Data** from all tables:
   - Removes all records matching test patterns
   - Uses the existing `sync-hubspot-to-supabase` Edge Function

2. **Syncs Real Data** from HubSpot:
   - Fetches fresh data from HubSpot API
   - Populates database with real contacts, leads, and deals

3. **Confirms Success**:
   - Shows toast notification with sync results
   - Hides the alert banner
   - Refreshes dashboard data

## Usage Instructions

### For End Users

1. **Visit the Dashboard**
   - Go to https://client-vital-suite.vercel.app/dashboard

2. **Check for Alert**
   - If test data exists, you'll see an amber/yellow alert banner at the top

3. **Clear Test Data**
   - Click the "Clear & Sync from HubSpot" button
   - Confirm the action in the dialog
   - Wait for the sync to complete (~10-30 seconds)

4. **Verify**
   - The alert should disappear
   - Dashboard should now show real data from HubSpot

### Alternative Methods

The cleanup function is also available on these pages:
- **HubSpot Live Data** (`/hubspot-live`) - "Clear Fake & Sync" button
- **Sales Pipeline** (`/sales-pipeline`) - "Clear Test Data & Sync" dialog

## Technical Details

### Edge Function Used

The cleanup uses the `sync-hubspot-to-supabase` Edge Function with the `clear_fake_data` flag:

```typescript
await supabase.functions.invoke('sync-hubspot-to-supabase', {
  body: { 
    clear_fake_data: true,  // Remove test data
    sync_type: 'all'         // Sync all data types
  }
});
```

### Performance

- Detection query: ~200-500ms (runs 4 queries in parallel)
- Cleanup + sync: ~10-30 seconds (depending on HubSpot data volume)
- Alert component: Lightweight, minimal performance impact

## Files Modified

1. **New Files:**
   - `src/utils/detectTestData.ts` - Detection and cleanup utilities
   - `src/components/dashboard/TestDataAlert.tsx` - Alert component

2. **Modified Files:**
   - `src/pages/Dashboard.tsx` - Added TestDataAlert component
   - `src/pages/Overview.tsx` - Added TestDataAlert component

## Future Improvements

Potential enhancements:
- Add scheduled automatic test data cleanup (e.g., nightly cron job)
- Show detailed breakdown of test data by table
- Add "preview" mode to see what will be deleted before confirming
- Add test data prevention at the data ingestion level
- Create admin panel for bulk data management

## Troubleshooting

### Alert Not Showing
- Check browser console for errors
- Verify Supabase connection is working
- Ensure tables exist in database

### Cleanup Fails
- Check `HUBSPOT_API_KEY` is set in Supabase Edge Function secrets
- Verify HubSpot API access
- Check Edge Function logs in Supabase dashboard

### Data Still Shows After Cleanup
- Hard refresh the page (Ctrl+F5 or Cmd+Shift+R)
- Clear browser cache
- Check if query cache needs to be invalidated

## Related Documentation

- [LOVABLE_PROTECTION.md](./LOVABLE_PROTECTION.md) - Protecting files from Lovable
- [HUBSPOT_ANALYSIS_SUMMARY.md](./HUBSPOT_ANALYSIS_SUMMARY.md) - HubSpot integration details
- Supabase Edge Function: `supabase/functions/sync-hubspot-to-supabase/index.ts`
