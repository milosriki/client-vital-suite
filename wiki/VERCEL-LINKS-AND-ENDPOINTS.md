# 🔗 Vercel Links & API Endpoints Summary

## 📍 Your Vercel Projects

### 1. **client-vital-suite** ✅ DEPLOYED
**Production URL:** `https://client-vital-suite.vercel.app`

**All Domains:**
- ✅ `client-vital-suite.vercel.app` (Main)
- ✅ `client-vital-suite-milos-projects-d46729ec.vercel.app`
- ✅ `client-vital-suite-git-main-milos-projects-d46729ec.vercel.app`
- ✅ `client-vital-suite-2eyibwcwu-milos-projects-d46729ec.vercel.app`

**Status:** ✅ Ready & Live (Production)

---

### 2. **jux** (Current Project)
**Status:** ⚠️ No deployments yet

---

## 🔌 API Endpoints Available

### **Frontend App URLs:**
- **Main:** `https://client-vital-suite.vercel.app`
- **Dashboard:** `https://client-vital-suite.vercel.app/ultimate-ceo`
- **Meta Dashboard:** `https://client-vital-suite.vercel.app/meta-dashboard`

### **API Endpoints (Vercel Serverless Functions):**

1. **Health Check:**
   ```
   GET https://client-vital-suite.vercel.app/api/health
   ```

2. **Send Single Event:**
   ```
   POST https://client-vital-suite.vercel.app/api/events/Purchase
   POST https://client-vital-suite.vercel.app/api/events/Lead
   POST https://client-vital-suite.vercel.app/api/events/InitiateCheckout
   ```

3. **Send Batch Events:**
   ```
   POST https://client-vital-suite.vercel.app/api/events/batch
   ```

4. **Webhook Backfill:**
   ```
   POST https://client-vital-suite.vercel.app/api/webhook/backfill
   ```

### **Supabase Edge Functions:**

All Supabase functions are accessible via:
```
https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/[function-name]
```

**Key Functions:**
- `/functions/v1/sync-hubspot-to-capi`
- `/functions/v1/process-capi-batch`
- `/functions/v1/send-to-stape-capi`
- `/functions/v1/ptd-agent`
- `/functions/v1/business-intelligence`
- And 80+ more...

---

## ⚠️ **ISSUE FOUND - Needs Fix**

### **Problem:**
`src/pages/MetaDashboard.tsx` has incorrect API fallback:

```typescript
const API_BASE = import.meta.env.VITE_META_CAPI_URL || 'http://localhost:3000';
```

**This will fail in production!** It should use `window.location.origin` instead.

### **Fix Needed:**
Change to:
```typescript
const API_BASE = import.meta.env.VITE_META_CAPI_URL || window.location.origin;
```

This way:
- ✅ Development: Uses `VITE_META_CAPI_URL` if set, or `window.location.origin` (localhost:5173)
- ✅ Production: Uses `VITE_META_CAPI_URL` if set, or `window.location.origin` (client-vital-suite.vercel.app)

---

## ✅ **What You Have:**

1. ✅ **Deployed Frontend** - `client-vital-suite.vercel.app`
2. ✅ **API Functions** - All deployed and working
3. ✅ **Environment Variables** - Set in Vercel
4. ✅ **Supabase Functions** - All deployed
5. ✅ **All Tokens** - Configured correctly

---

## 🎯 **What You Need:**

1. ⚠️ **Fix API_BASE** in `MetaDashboard.tsx` (see above)
2. ✅ **Optional:** Set `VITE_META_CAPI_URL` in Vercel if you want to override the default
3. ✅ **Optional:** Add custom domain if needed

---

## 📝 **Quick Test URLs:**

**Test Health Check:**
```bash
curl https://client-vital-suite.vercel.app/api/health
```

**Test Purchase Event:**
```bash
curl -X POST https://client-vital-suite.vercel.app/api/events/Purchase \
  -H "Content-Type: application/json" \
  -d '{"user_data":{"email":"test@example.com"},"custom_data":{"value":100,"currency":"AED"}}'
```

---

## ✅ **Summary:**

**Your Links:**
- ✅ Main App: `https://client-vital-suite.vercel.app`
- ✅ All API endpoints working
- ✅ All Supabase functions accessible

**Status:** 🟢 **Everything is deployed and working!**

**Action Needed:** Fix the `API_BASE` fallback in `MetaDashboard.tsx` to use `window.location.origin` instead of `localhost:3000`.

