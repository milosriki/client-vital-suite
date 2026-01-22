# HubSpot Connection Status

## 1. Local CLI (for MCP Tools)
**Status:** ❌ Not Authenticated
**Fix:** Run this command in your terminal:
```bash
hs auth
```
This enables tools like `get-applications-info`, `create-project`, etc.

## 2. Deployed App (Vercel/Supabase)
**Status:** ✅ Configured
**Details:**
- Environment Variable `HUBSPOT_API_KEY` is set in Vercel.
- Edge Function `sync-hubspot-to-supabase` uses this key.

## 3. How to Sync Data
To trigger a sync manually from the app:
1. Go to **Dashboard** > **HubSpot Live**.
2. Click **Sync Now**.
3. Check `sync_logs` table in Supabase for results.
