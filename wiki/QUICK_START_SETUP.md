# ⚡ Quick Start Setup - Environment Variables & Performance

## 🎯 Goal
Set up all environment variables and configurations for maximum performance on both Vercel and Supabase.

---

## Step 1: Set Vercel Server-Side Environment Variables (REQUIRED)

### Get Supabase Service Role Key:
1. Go to: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds/settings/api
2. Find: **Project API keys** → **service_role** (secret)
3. Click **Reveal** and copy the key

### Set Variables (Choose One Method):

**Method A: Interactive Script**
```bash
./scripts/set-vercel-server-env.sh
```

**Method B: Manual CLI**
```bash
# Production
echo "https://ztjndilxurtsfqdsvfds.supabase.co" | vercel env add SUPABASE_URL production
# Then paste service role key when prompted:
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Preview
echo "https://ztjndilxurtsfqdsvfds.supabase.co" | vercel env add SUPABASE_URL preview
vercel env add SUPABASE_SERVICE_ROLE_KEY preview

# Development (optional)
echo "https://ztjndilxurtsfqdsvfds.supabase.co" | vercel env add SUPABASE_URL development
vercel env add SUPABASE_SERVICE_ROLE_KEY development
```

**Method C: Vercel Dashboard**
1. https://vercel.com/dashboard → `client-vital-suite` → Settings → Environment Variables
2. Add `SUPABASE_URL` = `https://ztjndilxurtsfqdsvfds.supabase.co`
3. Add `SUPABASE_SERVICE_ROLE_KEY` = (your service role key)
4. Select: Production, Preview, Development

### Verify:
```bash
vercel env ls | grep -E "(SUPABASE_URL|SERVICE_ROLE)"
```

---

## Step 2: Apply Database Migration

### Option A: Via Supabase Dashboard (Recommended)
1. Go to: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds/database/migrations
2. Click: **New Migration**
3. Name: `20251219000000_setup_cron_and_config`
4. Copy contents from: `supabase/migrations/20251219000000_setup_cron_and_config.sql`
5. Paste and click: **Run Migration**

### Option B: Via CLI (After syncing)
```bash
# First, sync remote migrations
supabase db pull

# Then push new migration
supabase db push --linked
```

### Verify Cron Jobs:
```sql
-- Run in Supabase SQL Editor
SELECT jobid, jobname, schedule FROM cron.job ORDER BY jobname;
```

**Expected:**
- `health-calculator-30min` - Every 30 minutes
- `churn-predictor-daily` - Daily at 02:30 UTC
- `ptd-self-learn-daily` - Daily at 02:00 UTC
- `ptd-24x7-monitor-5min` - Every 5 minutes
- `daily-settings-check` - Daily at 01:00 UTC

---

## Step 3: Deploy & Test

### Deploy to Vercel:
```bash
git add .
git commit -m "feat: complete environment setup and performance optimization"
git push
# Vercel will auto-deploy
```

### Test API Endpoint:
```bash
# After deployment, test /api/agent
curl -X POST https://your-app.vercel.app/api/agent \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

**Expected:** Returns 200 (success) or 400 (validation error), NOT 500

---

## ✅ Verification Checklist

- [ ] `SUPABASE_URL` set in Vercel (all environments)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in Vercel (all environments)
- [ ] Migration applied successfully
- [ ] Cron jobs created (5 jobs)
- [ ] Build passes: `npm run build`
- [ ] `/api/agent` endpoint works (200 or 400, not 500)
- [ ] Vercel logs show agent calls
- [ ] Supabase logs show cron job executions

---

## 📊 Performance Status

- ✅ **Frontend Build**: ~2.6 seconds (Target: < 5s)
- ✅ **Code Optimized**: Batch processing, error handling, caching
- ✅ **Config Optimized**: JWT verification, security settings
- ⏳ **Runtime Performance**: Verify after deployment

---

## 🆘 Troubleshooting

### If Vercel env vars fail:
- Check authentication: `vercel whoami`
- Check project link: `vercel link`
- Use Dashboard method as fallback

### If migration fails:
- Check migration syntax
- Apply via Dashboard instead
- Check for duplicate cron jobs

### If build fails:
- Run: `npm run build 2>&1 | grep -i error`
- Check TypeScript errors
- Verify all imports resolve

---

## 📝 Summary

**Code Status:** ✅ Complete
**Build Status:** ✅ Passing
**Missing:** Vercel env vars (manual step required)
**Next:** Set env vars → Deploy → Test

**Total Time:** ~10 minutes to complete setup

