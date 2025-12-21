# Vercel Environment Variables Check Report

## ✅ Currently Set in Vercel

```
VITE_SUPABASE_URL                  ✅ Set (Production)
VITE_SUPABASE_PUBLISHABLE_KEY      ✅ Set (Production)
VITE_SUPABASE_ANON_KEY             ✅ Set (Production)
VITE_GEMINI_API_KEY                ✅ Set (Production)
FB_PIXEL_ID                        ✅ Set (Production)
FB_ACCESS_TOKEN                    ✅ Set (Production)
FB_TEST_EVENT_CODE                 ✅ Set (Production)
EVENT_SOURCE_URL                   ✅ Set (Production)
```

## ❌ Missing for `/api/agent.ts` Proxy

The new `/api/agent.ts` route needs **server-side** environment variables (NOT `VITE_*`):

### Required Variables:

1. **`SUPABASE_URL`** (server-side)
   - Value: `https://ztjndilxurtsfqdsvfds.supabase.co`
   - Note: You have `VITE_SUPABASE_URL` but need `SUPABASE_URL` (without VITE_ prefix)
   - Purpose: Used by serverless functions to call Supabase Edge Functions

2. **`SUPABASE_SERVICE_ROLE_KEY`** (server-side)
   - Value: Your Supabase service role key (starts with `eyJhbGci...`)
   - Location: Supabase Dashboard → Project Settings → API → `service_role` key
   - Purpose: Authenticates serverless functions to call Edge Functions
   - ⚠️ **CRITICAL**: Never expose this to browser (that's why it's NOT `VITE_*`)

## How to Add Missing Variables

### Option 1: Via Vercel CLI

```bash
# Add SUPABASE_URL (server-side)
vercel env add SUPABASE_URL production
# When prompted, enter: https://ztjndilxurtsfqdsvfds.supabase.co

# Add SUPABASE_SERVICE_ROLE_KEY (server-side)
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# When prompted, paste your service role key from Supabase dashboard
```

### Option 2: Via Vercel Dashboard

1. Go to: https://vercel.com/dashboard
2. Select project: `client-vital-suite`
3. Go to: **Settings** → **Environment Variables**
4. Click **Add New**
5. Add each variable:

   **Variable 1:**
   - Name: `SUPABASE_URL`
   - Value: `https://ztjndilxurtsfqdsvfds.supabase.co`
   - Environment: ✅ Production ✅ Preview ✅ Development
   - Click **Save**

   **Variable 2:**
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: `eyJhbGci...` (your service role key from Supabase)
   - Environment: ✅ Production ✅ Preview ✅ Development
   - Click **Save**

### Option 3: Get Service Role Key from Supabase

1. Go to: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds
2. Navigate to: **Settings** → **API**
3. Find: **Project API keys** → **service_role** (secret)
4. Click **Reveal** and copy the key
5. Add to Vercel as `SUPABASE_SERVICE_ROLE_KEY`

## Verify After Adding

```bash
vercel env ls | grep -E "(SUPABASE_URL|SERVICE_ROLE)"
```

Should show:
```
SUPABASE_URL                      Encrypted           Production
SUPABASE_SERVICE_ROLE_KEY         Encrypted           Production
```

## Why Two Different Variables?

- **`VITE_SUPABASE_URL`** → Used by **frontend** (browser) - exposed to client
- **`SUPABASE_URL`** → Used by **serverless functions** (server) - never exposed

- **`VITE_SUPABASE_ANON_KEY`** → Used by **frontend** - safe to expose
- **`SUPABASE_SERVICE_ROLE_KEY`** → Used by **serverless functions** - NEVER expose to browser

## After Adding Variables

1. **Redeploy** your Vercel project (or wait for next deployment)
2. **Test** the `/api/agent` endpoint:
   ```bash
   curl -X POST https://your-app.vercel.app/api/agent \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello"}'
   ```
3. **Check logs**:
   ```bash
   vercel logs --follow
   ```

## Current Status

- ✅ API route created: `api/agent.ts`
- ✅ Build passes: `npm run build` ✅
- ⚠️ **Missing**: `SUPABASE_URL` (server-side)
- ⚠️ **Missing**: `SUPABASE_SERVICE_ROLE_KEY` (server-side)

Once these are added, the proxy will work and you'll see agent calls in Vercel logs!

