# ⚠️ CRITICAL FIRST STEP: Set Vercel Environment Variables

## Required Variables for `/api/agent.ts`

Before proceeding with the rest of the plan, you **MUST** set these environment variables in Vercel:

### Step 1: Get Supabase Service Role Key

1. Go to: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds
2. Navigate to: **Settings** → **API**
3. Find: **Project API keys** → **service_role** (secret)
4. Click **Reveal** and copy the key (starts with `eyJhbGci...`)

### Step 2: Add to Vercel Dashboard

1. Go to: https://vercel.com/dashboard
2. Select project: `client-vital-suite`
3. Navigate to: **Settings** → **Environment Variables**
4. Click **Add New**

**Variable 1:**
- Name: `SUPABASE_URL`
- Value: `https://ztjndilxurtsfqdsvfds.supabase.co`
- Environments: ✅ Production ✅ Preview ✅ Development
- Click **Save**

**Variable 2:**
- Name: `SUPABASE_SERVICE_ROLE_KEY`
- Value: `[paste your service role key here]`
- Environments: ✅ Production ✅ Preview ✅ Development
- Click **Save**

### Step 3: Verify

```bash
vercel env ls | grep -E "(SUPABASE_URL|SERVICE_ROLE)"
```

Should show both variables listed.

### Step 4: Redeploy

After adding, trigger a new deployment:
```bash
git push
# Vercel will auto-deploy with new env vars
```

---

## Why This Must Be Done First

- `/api/agent.ts` requires these variables to proxy to Supabase
- Without them, the API route will return 500 errors
- These are server-side variables (NOT `VITE_*`) - never exposed to browser

