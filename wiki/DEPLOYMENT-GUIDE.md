# 🚀 Complete Deployment Guide

## ✅ **FIXES APPLIED - READY FOR DEPLOYMENT**

All code fixes are complete. Follow this guide to deploy everything.

---

## 📋 **STEP 1: VERIFY PROJECT ID**

### **Current Situation:**
- **Code References:** `ztjndilxurtsfqdsvfds`
- **MCP Connected To:** `akhirugwpozlxfvtqmvj`

### **Action Required:**

**Option A: If `ztjndilxurtsfqdsvfds` is correct:**
- ✅ Code is already correct
- ⚠️ Update MCP connection to match

**Option B: If `akhirugwpozlxfvtqmvj` is correct:**
- Update these files:
  - `src/integrations/supabase/client.ts` (line 7)
  - `vercel.json` (line 46)
  - `supabase/config.toml` (line 1)

**How to Verify:**
1. Check Supabase Dashboard
2. Look at your active project URL
3. Match project ID from URL

---

## 📋 **STEP 2: APPLY MIGRATION**

### **New Migration:** `20251215000001_create_reassignment_log.sql`

**Apply via CLI:**
```bash
cd /Users/milosvukovic/.cursor/worktrees/client-vital-suite-1/rpk
supabase db push --project-ref ztjndilxurtsfqdsvfds
```

**Or via Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds
2. Navigate to: Database → Migrations
3. Click: "New Migration"
4. Paste migration SQL
5. Click: "Run Migration"

**Verify:**
```sql
SELECT * FROM reassignment_log LIMIT 1;
```

---

## 📋 **STEP 3: DEPLOY NEW FUNCTIONS**

### **Function 1: reassign-owner**

```bash
supabase functions deploy reassign-owner \
  --project-ref ztjndilxurtsfqdsvfds
```

**Verify:**
```bash
curl -X POST https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/reassign-owner \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contact_id": "test_123",
    "new_owner_id": "test_456",
    "reason": "TEST"
  }'
```

### **Function 2: auto-reassign-leads**

```bash
supabase functions deploy auto-reassign-leads \
  --project-ref ztjndilxurtsfqdsvfds
```

**Verify:**
```bash
curl -X POST https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/auto-reassign-leads \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "max_reassignments": 5,
    "sla_minutes": 20
  }'
```

---

## 📋 **STEP 4: DEPLOY ALL MISSING FUNCTIONS**

### **Quick Deploy Script:**

```bash
#!/bin/bash
# deploy-all-functions.sh

PROJECT_REF="ztjndilxurtsfqdsvfds"
FUNCTIONS_DIR="supabase/functions"

cd "$(dirname "$0")"

for dir in $FUNCTIONS_DIR/*/; do
  if [ -d "$dir" ] && [ -f "$dir/index.ts" ]; then
    func_name=$(basename "$dir")
    echo "Deploying $func_name..."
    supabase functions deploy "$func_name" --project-ref "$PROJECT_REF"
    echo "✅ $func_name deployed"
    echo ""
  fi
done

echo "🎉 All functions deployed!"
```

**Run:**
```bash
chmod +x deploy-all-functions.sh
./deploy-all-functions.sh
```

### **Or Deploy Individually:**

**Priority Functions:**
```bash
# AI Agents
supabase functions deploy ptd-agent-gemini --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy ptd-agent-claude --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy smart-agent --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy ptd-ultimate-intelligence --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy ai-ceo-master --project-ref ztjndilxurtsfqdsvfds

# Intelligence
supabase functions deploy health-calculator --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy churn-predictor --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy anomaly-detector --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy intervention-recommender --project-ref ztjndilxurtsfqdsvfds

# Sync
supabase functions deploy sync-hubspot-to-supabase --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy sync-hubspot-to-capi --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy fetch-hubspot-live --project-ref ztjndilxurtsfqdsvfds

# Stripe
supabase functions deploy stripe-dashboard-data --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy stripe-forensics --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy stripe-payouts-ai --project-ref ztjndilxurtsfqdsvfds

# Monitoring
supabase functions deploy ptd-watcher --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy ptd-24x7-monitor --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy business-intelligence --project-ref ztjndilxurtsfqdsvfds

# New Functions
supabase functions deploy reassign-owner --project-ref ztjndilxurtsfqdsvfds
supabase functions deploy auto-reassign-leads --project-ref ztjndilxurtsfqdsvfds
```

---

## 📋 **STEP 5: VERIFY SECRETS**

### **Check in Supabase Dashboard:**

**Go to:** Settings → Edge Functions → Secrets

**Required Secrets:**

**Critical (AI Functions):**
- ✅ `GOOGLE_API_KEY` or `GEMINI_API_KEY` - For Gemini AI
- ✅ `ANTHROPIC_API_KEY` - For Claude AI
- ✅ `LOVABLE_API_KEY` - Fallback for Lovable Gateway

**Integration Secrets:**
- ✅ `HUBSPOT_API_KEY` - For HubSpot sync & reassignment
- ✅ `STRIPE_SECRET_KEY` - For Stripe functions
- ✅ `STAPE_CAPIG_API_KEY` - For CAPI functions

**Set Secrets:**
```bash
supabase secrets set HUBSPOT_API_KEY=your_key --project-ref ztjndilxurtsfqdsvfds
supabase secrets set GOOGLE_API_KEY=your_key --project-ref ztjndilxurtsfqdsvfds
# ... etc
```

---

## 📋 **STEP 6: TEST FUNCTIONS**

### **Test reassign-owner:**
```typescript
// From frontend or API
const { data, error } = await supabase.functions.invoke('reassign-owner', {
  body: {
    contact_id: '12345',
    new_owner_id: '67890',
    reason: 'TEST_REASSIGNMENT'
  }
});

console.log('Reassignment result:', data);
```

### **Test auto-reassign-leads:**
```typescript
const { data, error } = await supabase.functions.invoke('auto-reassign-leads', {
  body: {
    max_reassignments: 10,
    sla_minutes: 20
  }
});

console.log('Auto-reassignment result:', data);
```

---

## 📋 **STEP 7: SCHEDULE AUTO-REASSIGNMENT (OPTIONAL)**

### **Create Cron Job:**

```sql
-- Run auto-reassignment every 15 minutes
SELECT cron.schedule(
  'auto-reassign-leads',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/auto-reassign-leads',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'max_reassignments', 50,
      'sla_minutes', 20
    )
  );
  $$
);
```

**Verify Cron Job:**
```sql
SELECT * FROM cron.job WHERE jobname = 'auto-reassign-leads';
```

---

## ✅ **VERIFICATION CHECKLIST**

### **Code:**
- [x] All imports standardized ✅
- [x] No linter errors ✅
- [x] No TypeScript errors ✅
- [x] Functions created ✅

### **Database:**
- [ ] Migration applied ⚠️
- [ ] `reassignment_log` table exists ⚠️
- [ ] Indexes created ⚠️

### **Functions:**
- [ ] `reassign-owner` deployed ⚠️
- [ ] `auto-reassign-leads` deployed ⚠️
- [ ] All other functions deployed ⚠️

### **Secrets:**
- [ ] `HUBSPOT_API_KEY` set ⚠️
- [ ] `GOOGLE_API_KEY` set ⚠️
- [ ] `ANTHROPIC_API_KEY` set ⚠️
- [ ] Other secrets verified ⚠️

### **Testing:**
- [ ] `reassign-owner` tested ⚠️
- [ ] `auto-reassign-leads` tested ⚠️
- [ ] Reassignment log working ⚠️

---

## 🎯 **QUICK START**

**Minimum to get reassignment working:**

1. **Apply Migration:**
   ```bash
   supabase db push --project-ref ztjndilxurtsfqdsvfds
   ```

2. **Deploy Functions:**
   ```bash
   supabase functions deploy reassign-owner --project-ref ztjndilxurtsfqdsvfds
   supabase functions deploy auto-reassign-leads --project-ref ztjndilxurtsfqdsvfds
   ```

3. **Verify Secret:**
   ```bash
   # Check HUBSPOT_API_KEY is set in Supabase Dashboard
   ```

4. **Test:**
   ```typescript
   await supabase.functions.invoke('reassign-owner', {
     body: { contact_id: 'test', new_owner_id: 'test', reason: 'TEST' }
   });
   ```

---

## 📊 **SUMMARY**

### **✅ Completed:**
- ✅ All code fixes applied
- ✅ Functions created
- ✅ Migration created
- ✅ Config updated
- ✅ Imports standardized

### **⚠️ Your Action Required:**
1. ⚠️ Verify project ID
2. ⚠️ Apply migration
3. ⚠️ Deploy functions
4. ⚠️ Verify secrets
5. ⚠️ Test functions

---

**All fixes complete! Ready for deployment.** 🚀
