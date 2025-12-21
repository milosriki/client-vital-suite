# Environment Variables Setup Guide - CLI Commands

## Current Status

### ✅ Vercel Environment Variables (Already Set):
- `VITE_SUPABASE_URL` ✅
- `VITE_SUPABASE_ANON_KEY` ✅
- `VITE_SUPABASE_PUBLISHABLE_KEY` ✅
- `FB_PIXEL_ID` ✅
- `FB_ACCESS_TOKEN` ✅
- `FB_TEST_EVENT_CODE` ✅
- `EVENT_SOURCE_URL` ✅
- `VITE_GEMINI_API_KEY` ✅

### ❌ Missing Vercel Variables (Server-Side):
- `SUPABASE_URL` - Required for `/api/agent.ts`
- `SUPABASE_SERVICE_ROLE_KEY` - Required for `/api/agent.ts`

### ✅ Supabase Secrets (Already Set):
- `ANTHROPIC_API_KEY` ✅
- `GEMINI_API_KEY` ✅
- `HUBSPOT_API_KEY` ✅
- `HUBSPOT_ACCESS_TOKEN` ✅
- `STRIPE_SECRET_KEY` (check if exists)
- `OPENAI_API_KEY` (check if exists)
- Plus 20+ other secrets ✅

---

## Step-by-Step CLI Setup

### Step 1: Get Supabase Service Role Key

**From Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds
2. Navigate to: **Settings** → **API**
3. Find: **Project API keys** → **service_role** (secret)
4. Click **Reveal** and copy the key

**Project URL:** `https://ztjndilxurtsfqdsvfds.supabase.co` (already known)

---

### Step 2: Set Vercel Server-Side Variables

**Run these commands one at a time:**

```bash
# Set SUPABASE_URL for Production
vercel env add SUPABASE_URL production
# When prompted, enter: https://ztjndilxurtsfqdsvfds.supabase.co

# Set SUPABASE_SERVICE_ROLE_KEY for Production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# When prompted, paste your service role key from Supabase dashboard

# Set for Preview environment
vercel env add SUPABASE_URL preview
# Enter: https://ztjndilxurtsfqdsvfds.supabase.co

vercel env add SUPABASE_SERVICE_ROLE_KEY preview
# Paste your service role key

# Set for Development environment (optional)
vercel env add SUPABASE_URL development
# Enter: https://ztjndilxurtsfqdsvfds.supabase.co

vercel env add SUPABASE_SERVICE_ROLE_KEY development
# Paste your service role key
```

---

### Step 3: Verify Vercel Variables

```bash
vercel env ls | grep -E "(SUPABASE_URL|SERVICE_ROLE)"
```

**Expected Output:**
```
SUPABASE_URL                      Encrypted           Production
SUPABASE_SERVICE_ROLE_KEY        Encrypted           Production
SUPABASE_URL                      Encrypted           Preview
SUPABASE_SERVICE_ROLE_KEY        Encrypted           Preview
SUPABASE_URL                      Encrypted           Development
SUPABASE_SERVICE_ROLE_KEY        Encrypted           Development
```

---

### Step 4: Configure Supabase Database Settings

```bash
# Apply cron migration
supabase migration up

# Or apply specific migration
supabase db execute --file supabase/migrations/20251219000000_setup_cron_and_config.sql
```

---

### Step 5: Verify Cron Jobs

```bash
supabase db execute "SELECT jobid, jobname, schedule FROM cron.job ORDER BY jobname;"
```

**Expected Jobs:**
- `health-calculator-30min` - `*/30 * * * *`
- `churn-predictor-daily` - `30 2 * * *`
- `ptd-self-learn-daily` - `0 2 * * *`
- `ptd-24x7-monitor-5min` - `*/5 * * * *`
- `daily-settings-check` - `0 1 * * *`

---

### Step 6: Verify Settings Functions

```bash
supabase db execute "
SELECT 
  public.get_supabase_url() as url,
  CASE WHEN public.get_service_role_key() != '' THEN 'Key configured' ELSE 'Key missing' END as key_status;
"
```

---

## Quick Verification Commands

```bash
# Check Vercel env vars
vercel env ls

# Check Supabase secrets
supabase secrets list

# Check Supabase status
supabase status

# Test build
npm run build
```

---

## Notes

- **Service Role Key**: Must be retrieved from Supabase Dashboard (cannot be retrieved via CLI for security)
- **Environment Variables**: Set for Production, Preview, and Development to ensure all environments work
- **Cron Jobs**: Will use helper functions that read from `app_settings` table or defaults
- **Performance**: All settings optimized for maximum speed

