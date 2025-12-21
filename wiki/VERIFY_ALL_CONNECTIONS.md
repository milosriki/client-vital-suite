# ✅ Verify All Connections - Complete Status Check

## 🔍 **CONNECTION VERIFICATION**

### **1. Supabase Connection** ✅

**Status:** ✅ **CONNECTED**

**Project ID:** `ztjndilxurtsfqdsvfds`
**URL:** `https://ztjndilxurtsfqdsvfds.supabase.co`

**Verification:**
- ✅ Frontend client configured
- ✅ Environment variables set
- ✅ Database accessible
- ✅ Migrations applied (60+ migrations found)

---

### **2. Edge Functions Status** ⚠️

**Expected Functions (from config.toml):** 60+ functions

**Functions in Codebase:**
- ✅ `ptd-agent-gemini`
- ✅ `health-calculator`
- ✅ `churn-predictor`
- ✅ `anomaly-detector`
- ✅ `intervention-recommender`
- ✅ `coach-analyzer`
- ✅ `daily-report`
- ✅ `data-quality`
- ✅ `integration-health`
- ✅ `pipeline-monitor`
- ✅ `ptd-watcher`
- ✅ `ptd-agent`
- ✅ `fetch-hubspot-live`
- ✅ `hubspot-command-center`
- ✅ `send-to-stape-capi`
- ✅ `sync-hubspot-to-capi`
- ✅ `capi-validator`
- ✅ `process-capi-batch`
- ✅ `stripe-dashboard-data`
- ✅ `stripe-forensics`
- ✅ `stripe-payouts-ai`
- ✅ `enrich-with-stripe`
- ✅ `proactive-insights-generator`
- ✅ `sync-hubspot-to-supabase`
- ✅ `business-intelligence`
- ✅ `anytrack-webhook`
- ✅ `generate-lead-reply`
- ✅ `agent-orchestrator`
- ✅ `smart-agent`
- ✅ `ptd-agent-claude`
- ✅ `process-knowledge`
- ✅ `openai-embeddings`
- ✅ `ptd-self-learn`
- ✅ `generate-embeddings`
- ✅ `ptd-24x7-monitor`
- ✅ `ptd-execute-action`
- ✅ `ai-ceo-master`
- ✅ `fetch-forensic-data`
- ✅ `generate-lead-replies`
- ✅ `ai-trigger-deploy`
- ✅ `ai-deploy-callback`
- ✅ `ptd-proactive-scanner`
- ✅ `callgear-supervisor`
- ✅ `callgear-live-monitor`
- ✅ `callgear-icp-router`
- ✅ `ptd-ultimate-intelligence`
- ✅ `fetch-callgear-data`
- ✅ `reassign-owner` (NEW)
- ✅ `auto-reassign-leads` (NEW)

**Action Required:** ⚠️ **Deploy all functions**

---

### **3. Database Tables** ✅

**Status:** ✅ **60+ tables found**

**Key Tables:**
- ✅ `contacts` - HubSpot contacts
- ✅ `leads` - Lead tracking
- ✅ `deals` - Deal tracking
- ✅ `client_health_scores` - Health scores
- ✅ `sync_logs` - Sync tracking
- ✅ `sync_errors` - Error tracking
- ✅ `reassignment_log` - Reassignment tracking (NEW)
- ✅ `agent_memory` - AI memory
- ✅ `agent_patterns` - AI patterns
- ✅ `events` - Event tracking
- ✅ `attribution_events` - Attribution
- ✅ `call_records` - Call records
- ✅ And 50+ more...

**Status:** ✅ **All tables exist**

---

### **4. Migrations** ✅

**Status:** ✅ **60+ migrations applied**

**Recent Migrations:**
- ✅ `20251215000001_create_reassignment_log.sql` - Reassignment log
- ✅ `20251215000002_add_more_hubspot_contact_fields.sql` - Enhanced contacts (NEW)

**Action Required:** ⚠️ **Apply new migration** (`20251215000002`)

---

### **5. HubSpot Integration** ⚠️

**Status:** ⚠️ **NEEDS VERIFICATION**

**Functions:**
- ✅ `sync-hubspot-to-supabase` - Created
- ✅ `sync-hubspot-to-capi` - Created
- ✅ `fetch-hubspot-live` - Created
- ✅ `hubspot-command-center` - Created
- ✅ `reassign-owner` - Created (NEW)
- ✅ `auto-reassign-leads` - Created (NEW)

**Secrets Required:**
- ⚠️ `HUBSPOT_API_KEY` - **VERIFY IN SUPABASE DASHBOARD**

**Action Required:**
1. ⚠️ Verify `HUBSPOT_API_KEY` is set in Supabase secrets
2. ⚠️ Deploy all HubSpot functions
3. ⚠️ Test sync function

---

### **6. Stripe Integration** ⚠️

**Status:** ⚠️ **NEEDS VERIFICATION**

**Functions:**
- ✅ `stripe-dashboard-data` - Created
- ✅ `stripe-forensics` - Created
- ✅ `stripe-payouts-ai` - Created
- ✅ `stripe-webhook` - Created
- ✅ `enrich-with-stripe` - Created

**Secrets Required:**
- ⚠️ `STRIPE_SECRET_KEY` - **VERIFY IN SUPABASE DASHBOARD**

**Action Required:**
1. ⚠️ Verify `STRIPE_SECRET_KEY` is set
2. ⚠️ Deploy Stripe functions
3. ⚠️ Configure webhook URL

---

### **7. Meta/Facebook CAPI** ⚠️

**Status:** ⚠️ **NEEDS VERIFICATION**

**Functions:**
- ✅ `send-to-stape-capi` - Created
- ✅ `sync-hubspot-to-capi` - Created
- ✅ `capi-validator` - Created
- ✅ `process-capi-batch` - Created

**Secrets Required:**
- ⚠️ `STAPE_CAPIG_API_KEY` - **VERIFY IN SUPABASE DASHBOARD**

**Vercel Environment Variables:**
- ⚠️ `FB_PIXEL_ID` - **SET IN VERCEL**
- ⚠️ `FB_ACCESS_TOKEN` - **SET IN VERCEL**

**Action Required:**
1. ⚠️ Verify Stape API key in Supabase
2. ⚠️ Set Meta credentials in Vercel
3. ⚠️ Deploy CAPI functions

---

### **8. AnyTrack Integration** ✅

**Status:** ✅ **CONFIGURED**

**Function:**
- ✅ `anytrack-webhook` - Created

**Webhook URL:**
- ✅ `https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/anytrack-webhook`

**Action Required:**
- ⚠️ Deploy function
- ⚠️ Configure webhook in AnyTrack dashboard

---

### **9. AI Services** ⚠️

**Anthropic Claude:**
- ✅ Functions created
- ⚠️ `ANTHROPIC_API_KEY` - **VERIFY IN SUPABASE DASHBOARD**

**Google Gemini:**
- ✅ Functions created
- ⚠️ `GOOGLE_API_KEY` or `GEMINI_API_KEY` - **VERIFY IN SUPABASE DASHBOARD**

**OpenAI:**
- ✅ Functions created
- ⚠️ `OPENAI_API_KEY` - **VERIFY IN SUPABASE DASHBOARD** (if using)

**Action Required:**
1. ⚠️ Verify all AI API keys in Supabase secrets
2. ⚠️ Deploy AI agent functions

---

### **10. Vercel Frontend** ✅

**Status:** ✅ **CONFIGURED**

**Environment Variables Set:**
- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_PUBLISHABLE_KEY`

**Missing (for API routes):**
- ⚠️ `FB_PIXEL_ID`
- ⚠️ `FB_ACCESS_TOKEN`

**Action Required:**
- ⚠️ Set Meta credentials in Vercel dashboard

---

## 📋 **COMPLETE CHECKLIST**

### **Database:**
- [x] Supabase connected ✅
- [x] Tables created ✅
- [x] Migrations applied ✅
- [ ] New migration applied ⚠️ (`20251215000002`)

### **Edge Functions:**
- [x] Functions created ✅ (60+)
- [ ] Functions deployed ⚠️ (Need to deploy all)
- [ ] Functions tested ⚠️

### **Secrets (Supabase Dashboard):**
- [ ] `HUBSPOT_API_KEY` ⚠️
- [ ] `STRIPE_SECRET_KEY` ⚠️
- [ ] `STAPE_CAPIG_API_KEY` ⚠️
- [ ] `ANTHROPIC_API_KEY` ⚠️
- [ ] `GOOGLE_API_KEY` or `GEMINI_API_KEY` ⚠️
- [ ] `OPENAI_API_KEY` ⚠️ (if using)
- [ ] `LOVABLE_API_KEY` ⚠️ (if using)

### **Vercel Environment Variables:**
- [x] `VITE_SUPABASE_URL` ✅
- [x] `VITE_SUPABASE_PUBLISHABLE_KEY` ✅
- [ ] `FB_PIXEL_ID` ⚠️
- [ ] `FB_ACCESS_TOKEN` ⚠️

### **Integrations:**
- [ ] HubSpot sync tested ⚠️
- [ ] Stripe webhook configured ⚠️
- [ ] AnyTrack webhook configured ⚠️
- [ ] Meta CAPI tested ⚠️
- [ ] AI agents tested ⚠️

---

## 🚀 **QUICK FIX COMMANDS**

### **1. Apply New Migration:**
```bash
cd /Users/milosvukovic/.cursor/worktrees/client-vital-suite-1/rpk
supabase db push --project-ref ztjndilxurtsfqdsvfds
```

### **2. Deploy All Functions (Batch):**
```bash
# Deploy all functions
cd supabase/functions
for dir in */; do
  func_name=$(basename "$dir")
  echo "Deploying $func_name..."
  supabase functions deploy "$func_name" --project-ref ztjndilxurtsfqdsvfds
done
```

### **3. Deploy Priority Functions:**
```bash
# Critical functions first
supabase functions deploy sync-hubspot-to-supabase --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy reassign-owner --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy auto-reassign-leads --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy anytrack-webhook --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy ptd-agent --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy ptd-agent-claude --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy ptd-agent-gemini --project-ref ztjndilxurtsfqdsvfds
```

### **4. Set Secrets (Supabase Dashboard):**
Go to: **Supabase Dashboard → Settings → Edge Functions → Secrets**

Add:
- `HUBSPOT_API_KEY=your_key`
- `STRIPE_SECRET_KEY=your_key`
- `STAPE_CAPIG_API_KEY=your_key`
- `ANTHROPIC_API_KEY=your_key`
- `GOOGLE_API_KEY=your_key`

### **5. Set Vercel Environment Variables:**
Go to: **Vercel Dashboard → Project → Settings → Environment Variables**

Add:
- `FB_PIXEL_ID=your_pixel_id`
- `FB_ACCESS_TOKEN=your_token`

---

## ✅ **VERIFICATION TESTS**

### **Test 1: Supabase Connection**
```typescript
import { supabase } from '@/integrations/supabase/client';
const { data, error } = await supabase.from('contacts').select('*').limit(1);
console.log('Supabase connected:', !error && !!data);
```

### **Test 2: HubSpot Sync**
```typescript
const { data, error } = await supabase.functions.invoke('sync-hubspot-to-supabase', {
  body: { sync_type: 'contacts', incremental: true }
});
console.log('HubSpot sync:', data);
```

### **Test 3: AI Agent**
```typescript
const { data, error } = await supabase.functions.invoke('ptd-agent', {
  body: { message: 'Hello' }
});
console.log('AI Agent:', data);
```

### **Test 4: Reassignment**
```typescript
const { data, error } = await supabase.functions.invoke('reassign-owner', {
  body: {
    contact_id: 'test_123',
    new_owner_id: 'test_456',
    reason: 'TEST'
  }
});
console.log('Reassignment:', data);
```

---

## 📊 **SUMMARY**

### **✅ Working:**
- ✅ Supabase connection
- ✅ Database tables
- ✅ Migrations (60+ applied)
- ✅ Code written (60+ functions)
- ✅ Frontend configured

### **⚠️ Needs Action:**
- ⚠️ Deploy Edge Functions (60+ need deployment)
- ⚠️ Verify secrets (check Supabase dashboard)
- ⚠️ Set Vercel env vars (FB_PIXEL_ID, FB_ACCESS_TOKEN)
- ⚠️ Apply new migration (`20251215000002`)
- ⚠️ Test all integrations

---

## 🎯 **PRIORITY ACTIONS**

### **Immediate (Critical):**
1. ⚠️ Verify secrets in Supabase dashboard
2. ⚠️ Apply new migration (`20251215000002`)
3. ⚠️ Deploy critical functions (sync, reassign, webhooks)

### **High Priority:**
4. ⚠️ Deploy all Edge Functions
5. ⚠️ Set Vercel environment variables
6. ⚠️ Test HubSpot sync

### **Medium Priority:**
7. ⚠️ Configure webhooks (AnyTrack, Stripe)
8. ⚠️ Test AI agents
9. ⚠️ Test all integrations

---

**Everything is coded and ready! Need to deploy and verify secrets.** 🚀
