# Data Cleanup Guide

## Remove All Mock/Fake Data from Production

This guide explains how to clean up test data from your production database.

## ✅ Current State

The application code is **ALREADY CLEAN** and properly implemented:

- ✅ **Coaches.tsx** - Queries from `coach_performance` table
- ✅ **Dashboard.tsx** - Queries from database with proper loading/error states
- ✅ **Clients.tsx** - Queries from `client_health_scores` table
- ✅ **All Components** - No hardcoded or mock data found

## 🧹 Cleanup Methods

### Method 1: Using the Dashboard UI (Recommended)

1. Navigate to the Dashboard
2. Look for the **Test Data Alert** banner at the top
3. Click **"Clear & Sync from HubSpot"**
4. Confirm the action
5. Wait for the sync to complete

### Method 2: Using Supabase Edge Function

Call the `cleanup-fake-contacts` edge function directly:

```bash
# Using curl
curl -X POST https://your-project.supabase.co/functions/v1/cleanup-fake-contacts \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Method 3: Using Sync Function with Cleanup Flag

Call the `sync-hubspot-to-supabase` function with cleanup flag:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/sync-hubspot-to-supabase \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clear_fake_data": true, "sync_type": "all"}'
```

## 🎯 What Gets Cleaned

The cleanup process removes:

### Test Email Patterns
- `*@example.com`
- `*@email.com`
- `*@test.com`
- `*@fake.com`
- `*@dummy.com`
- `*@sample.com`
- `*@testing.com`
- `*@localhost*`
- `test*@*`
- `fake*@*`
- Temporary email services (mailinator, guerrillamail, etc.)

### Test Data in Tables
- **contacts** - Fake emails
- **leads** - Fake emails and phone numbers (555-0*)
- **enhanced_leads** - Fake emails
- **client_health_scores** - Fake emails
- **deals** - Names containing "test" or "fake", or missing HubSpot IDs
- **intervention_log** - Orphaned interventions for non-existent clients
- **capi_events_enriched** - Old failed events (30+ days)

### Specific Known Fake Emails
- test123@gmail.com
- test@fb.com
- test@marko.com
- admin@test.com
- user@test.com
- contact@example.com
- And more...

## 🔍 Detection

The application automatically detects test data using `/src/utils/detectTestData.ts`:

```typescript
// This runs on Dashboard load
const { hasTestData, testDataCount, sources } = await detectTestData();
```

If test data is found, a warning banner appears on the Dashboard.

## 📊 Verification

After cleanup, verify the results:

1. **Check Dashboard** - No test data alert should appear
2. **Check Tables** - Query Supabase to verify:
   ```sql
   SELECT * FROM contacts WHERE email ILIKE '%@example.com' OR email ILIKE '%@email.com';
   SELECT * FROM leads WHERE email ILIKE '%@test.com';
   SELECT * FROM deals WHERE hubspot_deal_id IS NULL;
   ```

## 🚀 Production Deployment

To deploy the updated cleanup functions:

```bash
# Login to Supabase
npx supabase login

# Deploy the cleanup function
npx supabase functions deploy cleanup-fake-contacts

# Deploy the sync function
npx supabase functions deploy sync-hubspot-to-supabase
```

## ⚠️ Important Notes

1. **Backup First** - Always backup your database before running cleanup
2. **Irreversible** - Cleanup operations cannot be undone
3. **Production Only** - This is designed for production data cleanup
4. **HubSpot Sync** - After cleanup, fresh data is synced from HubSpot
5. **Automatic Detection** - The TestDataAlert component monitors for test data

## 📝 Code Verification

Run the verification script to confirm no hardcoded data:

```bash
npx tsx scripts/verify-no-mock-data.ts
```

This checks all key files for:
- Hardcoded arrays with data
- Mock data patterns
- Test email addresses
- Fake IDs like '123456'

## ✨ Summary

**The codebase is already clean.** All pages and components properly query from the database with:
- ✅ Proper loading states
- ✅ Error handling
- ✅ Empty state messages ("No data yet - sync from HubSpot")
- ✅ Real-time queries
- ✅ Test data detection and cleanup tools

The only task remaining is to **run the cleanup function** to remove test data from the database itself.
