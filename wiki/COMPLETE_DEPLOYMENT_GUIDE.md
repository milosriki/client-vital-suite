# 🚀 Complete Deployment Guide - Connect All Functions

## ✅ What This Does

This guide will:
1. ✅ Connect to Supabase project
2. ✅ Apply all database migrations
3. ✅ Deploy all 50+ Edge Functions
4. ✅ Verify everything is working

---

## 🎯 Quick Start (One Command)

```bash
cd /Users/milosvukovic/.cursor/worktrees/client-vital-suite-1/ovp
bash scripts/connect-and-deploy-all.sh
```

This will:
- ✅ Check/install Supabase CLI
- ✅ Login to Supabase
- ✅ Link project
- ✅ Apply all migrations
- ✅ Deploy all functions

---

## 📋 Step-by-Step Manual Process

### Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

### Step 2: Login to Supabase

```bash
supabase login
```

### Step 3: Link Project

```bash
cd /Users/milosvukovic/.cursor/worktrees/client-vital-suite-1/ovp
supabase link --project-ref ztjndilxurtsfqdsvfds
```

### Step 4: Apply Migrations

```bash
bash scripts/apply-all-migrations.sh
```

**OR manually:**
```bash
supabase db push --project-ref ztjndilxurtsfqdsvfds
```

### Step 5: Deploy All Functions

```bash
bash scripts/deploy-all-functions.sh
```

**OR deploy individually:**
```bash
supabase functions deploy FUNCTION_NAME --project-ref ztjndilxurtsfqdsvfds --no-verify-jwt
```

---

## 📊 Functions to Deploy (50+)

### Core AI Agents
- ✅ `ptd-agent` - Main PTD agent
- ✅ `ptd-agent-gemini` - Gemini-powered agent
- ✅ `ptd-agent-claude` - Claude-powered agent
- ✅ `ptd-ultimate-intelligence` - Ultimate intelligence
- ✅ `ai-ceo-master` - AI CEO master agent
- ✅ `smart-agent` - Smart agent with tools
- ✅ `agent-orchestrator` - Agent orchestrator

### Health & Intelligence
- ✅ `health-calculator` - Calculate client health scores
- ✅ `churn-predictor` - Predict churn risk
- ✅ `anomaly-detector` - Detect anomalies
- ✅ `intervention-recommender` - Recommend interventions
- ✅ `coach-analyzer` - Analyze coach performance

### Operations
- ✅ `daily-report` - Daily reports
- ✅ `data-quality` - Data quality checks
- ✅ `integration-health` - Integration health monitoring
- ✅ `pipeline-monitor` - Pipeline monitoring
- ✅ `ptd-watcher` - PTD watcher
- ✅ `ptd-24x7-monitor` - 24/7 monitoring

### HubSpot Integration
- ✅ `sync-hubspot-to-supabase` - Sync HubSpot to Supabase
- ✅ `sync-hubspot-to-capi` - Sync HubSpot to CAPI
- ✅ `fetch-hubspot-live` - Fetch live HubSpot data
- ✅ `hubspot-command-center` - HubSpot command center

### Stripe Integration
- ✅ `stripe-dashboard-data` - Stripe dashboard data
- ✅ `stripe-forensics` - Stripe forensics
- ✅ `stripe-payouts-ai` - Stripe payouts AI
- ✅ `enrich-with-stripe` - Enrich with Stripe data

### CAPI & Meta
- ✅ `send-to-stape-capi` - Send to Stape CAPI
- ✅ `process-capi-batch` - Process CAPI batch
- ✅ `capi-validator` - CAPI validator

### Lead Generation
- ✅ `generate-lead-reply` - Generate lead reply
- ✅ `generate-lead-replies` - Generate lead replies (batch)

### Knowledge & Processing
- ✅ `process-knowledge` - Process knowledge
- ✅ `generate-embeddings` - Generate embeddings
- ✅ `openai-embeddings` - OpenAI embeddings

### Proactive & Insights
- ✅ `proactive-insights-generator` - Generate proactive insights
- ✅ `ptd-proactive-scanner` - Proactive scanner
- ✅ `ptd-self-learn` - Self-learning agent

### CallGear Integration
- ✅ `callgear-icp-router` - CallGear ICP router
- ✅ `callgear-live-monitor` - CallGear live monitor
- ✅ `callgear-sentinel` - CallGear sentinel
- ✅ `callgear-supervisor` - CallGear supervisor
- ✅ `fetch-callgear-data` - Fetch CallGear data

### Business Intelligence
- ✅ `business-intelligence` - Business intelligence

### Other
- ✅ `fetch-forensic-data` - Fetch forensic data
- ✅ `anytrack-webhook` - AnyTrack webhook
- ✅ `stripe-webhook` - Stripe webhook
- ✅ `ai-trigger-deploy` - AI trigger deploy
- ✅ `ai-deploy-callback` - AI deploy callback
- ✅ `ptd-execute-action` - Execute actions

---

## 🔍 Verify Deployment

### Check Functions in Dashboard

Visit: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds/functions

You should see all 50+ functions listed.

### Test a Function

```bash
curl https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/health-calculator \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Check Migrations

Visit: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds/database/migrations

All migrations should show as "Applied".

---

## ⚠️ Common Issues

### Issue: "Function not found"
**Solution:** Deploy the function:
```bash
supabase functions deploy FUNCTION_NAME --project-ref ztjndilxurtsfqdsvfds
```

### Issue: "Table does not exist"
**Solution:** Apply migrations:
```bash
supabase db push --project-ref ztjndilxurtsfqdsvfds
```

### Issue: "Missing environment variable"
**Solution:** Set secrets in dashboard:
https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds/settings/functions

Required secrets:
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY` or `GEMINI_API_KEY`
- `HUBSPOT_API_KEY`
- `STRIPE_SECRET_KEY`
- `STAPE_CAPIG_API_KEY`
- `LOVABLE_API_KEY`

### Issue: "Not logged in"
**Solution:**
```bash
supabase login
```

---

## 📊 Status Check Script

Create a file `scripts/check-status.sh`:

```bash
#!/bin/bash
echo "🔍 Checking System Status..."
echo ""

# Check functions
echo "Functions deployed:"
supabase functions list --project-ref ztjndilxurtsfqdsvfds | wc -l

# Check migrations
echo ""
echo "Migrations applied:"
supabase migration list --project-ref ztjndilxurtsfqdsvfds | grep -c "Applied"

# Check secrets (requires dashboard access)
echo ""
echo "⚠️  Check secrets manually in dashboard"
```

---

## ✅ Success Checklist

After running the deployment:

- [ ] All migrations applied
- [ ] All 50+ functions deployed
- [ ] Functions visible in dashboard
- [ ] Secrets configured
- [ ] Test function call works
- [ ] Frontend can invoke functions
- [ ] No errors in function logs

---

## 🚀 Next Steps After Deployment

1. **Set Secrets** (if not already set):
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref ztjndilxurtsfqdsvfds
   supabase secrets set HUBSPOT_API_KEY=... --project-ref ztjndilxurtsfqdsvfds
   # ... etc
   ```

2. **Test Functions**:
   - Open frontend app
   - Try using features that call functions
   - Check browser console for errors

3. **Monitor Logs**:
   - Dashboard → Functions → Select function → Logs
   - Check for errors or warnings

---

## 📞 Support

If functions still don't work:
1. Check function logs in dashboard
2. Verify secrets are set
3. Verify migrations are applied
4. Check function code for errors
5. Test function directly with curl

---

**Last Updated:** 2025-01-13
**Status:** Ready to deploy ✅
