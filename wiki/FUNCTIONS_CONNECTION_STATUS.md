# 🔌 Functions Connection Status & Fix Guide

## ✅ What I've Created

### 1. **Deployment Scripts** ✅
- ✅ `scripts/deploy-all-functions.sh` - Deploys all 50+ functions
- ✅ `scripts/apply-all-migrations.sh` - Applies all database migrations  
- ✅ `scripts/connect-and-deploy-all.sh` - Complete setup script

### 2. **Documentation** ✅
- ✅ `COMPLETE_DEPLOYMENT_GUIDE.md` - Full deployment guide

---

## 🚀 Quick Fix - Run This Now

```bash
cd /Users/milosvukovic/.cursor/worktrees/client-vital-suite-1/ovp
bash scripts/connect-and-deploy-all.sh
```

This will:
1. ✅ Connect to Supabase
2. ✅ Apply all migrations (creates missing tables)
3. ✅ Deploy all 50+ functions
4. ✅ Verify everything is connected

---

## 📊 Functions Status

### ✅ Functions That Exist (50+)
All functions are in `supabase/functions/` directory:
- ✅ All AI agents (ptd-agent, ptd-agent-gemini, etc.)
- ✅ All HubSpot functions (sync-hubspot-to-supabase, etc.)
- ✅ All Stripe functions (stripe-forensics, etc.)
- ✅ All health/intelligence functions
- ✅ All CallGear functions
- ✅ All CAPI functions

### ⚠️ Functions That Need Deployment
**Status:** Functions exist in code but may not be deployed to Supabase yet.

**Solution:** Run deployment script above.

---

## 🔧 What Was Fixed

### 1. **Missing HubSpot Tables** ✅ FIXED
- Created `hubspot_deals` table
- Created `sync_logs`, `sync_errors`, `sync_queue` tables
- Migration: `20251213000005_create_missing_hubspot_tables.sql`

### 2. **Wrong Table References** ✅ FIXED
- Fixed `business-intelligence` to use `deals` table
- Fixed `sync-hubspot-to-supabase` column names

### 3. **Missing Functions in Config** ✅ VERIFIED
- All functions are listed in `supabase/config.toml`
- All have `verify_jwt = false` (correct for internal use)

---

## 📋 Functions Called from Frontend

### ✅ Verified Functions (Called from UI):
1. `ptd-agent-gemini` - AI chat
2. `ptd-24x7-monitor` - Monitoring
3. `process-knowledge` - Knowledge processing
4. `stripe-dashboard-data` - Stripe dashboard
5. `stripe-forensics` - Stripe forensics
6. `stripe-payouts-ai` - Stripe payouts
7. `sync-hubspot-to-supabase` - HubSpot sync
8. `hubspot-command-center` - HubSpot commands
9. `health-calculator` - Health scores
10. `churn-predictor` - Churn prediction
11. `anomaly-detector` - Anomaly detection
12. `intervention-recommender` - Interventions
13. `coach-analyzer` - Coach analysis
14. `sync-hubspot-to-capi` - CAPI sync
15. `enrich-with-stripe` - Stripe enrichment
16. `process-capi-batch` - CAPI batch
17. `ptd-watcher` - Watcher
18. `fetch-hubspot-live` - Live HubSpot data
19. `daily-report` - Daily reports
20. `send-to-stape-capi` - Stape CAPI
21. `data-quality` - Data quality
22. `integration-health` - Integration health
23. `pipeline-monitor` - Pipeline monitoring
24. `capi-validator` - CAPI validation
25. `ai-ceo-master` - AI CEO
26. `ai-trigger-deploy` - AI deploy
27. `fetch-forensic-data` - Forensic data
28. `proactive-insights-generator` - Proactive insights
29. `business-intelligence` - Business intelligence

**Total:** 29+ functions called from frontend

---

## 🎯 Action Required

### **Run Deployment Script:**

```bash
cd /Users/milosvukovic/.cursor/worktrees/client-vital-suite-1/ovp
bash scripts/connect-and-deploy-all.sh
```

### **Or Deploy Manually:**

```bash
# 1. Login
supabase login

# 2. Link project
supabase link --project-ref ztjndilxurtsfqdsvfds

# 3. Apply migrations
supabase db push --project-ref ztjndilxurtsfqdsvfds

# 4. Deploy functions (one by one or use script)
supabase functions deploy FUNCTION_NAME --project-ref ztjndilxurtsfqdsvfds --no-verify-jwt
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] All migrations applied (check dashboard)
- [ ] All functions deployed (check dashboard)
- [ ] Functions visible in Supabase dashboard
- [ ] Test function call works
- [ ] Frontend can invoke functions
- [ ] No errors in browser console
- [ ] Secrets are set (if functions need them)

---

## 🔍 Check Status

### In Supabase Dashboard:
1. Go to: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds/functions
2. You should see 50+ functions listed
3. Check each function's status (Active/Inactive)

### Test a Function:
```bash
curl https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/health-calculator \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 📞 If Functions Still Don't Work

1. **Check Function Logs:**
   - Dashboard → Functions → Select function → Logs
   - Look for errors

2. **Check Secrets:**
   - Dashboard → Settings → Edge Functions → Secrets
   - Verify required secrets are set

3. **Check Migrations:**
   - Dashboard → Database → Migrations
   - Verify all migrations are applied

4. **Check Function Code:**
   - Verify function exists in `supabase/functions/`
   - Check for syntax errors

---

## ✅ Summary

**Status:** ✅ All scripts created, ready to deploy

**Next Step:** Run `bash scripts/connect-and-deploy-all.sh`

**Expected Result:** All 50+ functions deployed and connected ✅
