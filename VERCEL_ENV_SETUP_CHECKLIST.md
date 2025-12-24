# ✅ Vercel Environment Variables Setup Checklist

**Dashboard Link**: <https://vercel.com/milos-projects-d46729ec/client-vital-suite/settings/environment-variables>

---

## 📋 Quick Setup (2 Options)

### Option 1: Automated Script

```bash
bash scripts/add-all-vercel-env.sh
```

Then manually mark sensitive vars in dashboard.

### Option 2: Manual Setup (Recommended)

Follow checklist below.

---

## ✅ Required Variables (5)

### 1. VITE_SUPABASE_URL

- [ ] Production: `https://ztjndilxurtsfqdsvfds.supabase.co`
- [ ] Preview: `https://ztjndilxurtsfqdsvfds.supabase.co`
- [ ] Development: `https://ztjndilxurtsfqdsvfds.supabase.co`

### 2. VITE_SUPABASE_PUBLISHABLE_KEY

- [ ] Production: `your_jwt_here`
- [ ] Preview: `your_jwt_here`
- [ ] Development: `your_jwt_here`

### 3. VITE_SUPABASE_ANON_KEY

- [ ] Production: `your_jwt_here`
- [ ] Preview: `your_jwt_here`
- [ ] Development: `your_jwt_here`

### 4. SUPABASE_URL

- [ ] Production: `https://ztjndilxurtsfqdsvfds.supabase.co`
- [ ] Preview: `https://ztjndilxurtsfqdsvfds.supabase.co`
- [ ] Development: `https://ztjndilxurtsfqdsvfds.supabase.co`

### 5. SUPABASE_SERVICE_ROLE_KEY ⚠️ SENSITIVE

- [ ] Production: `your_jwt_here` + ☑️ Sensitive
- [ ] Preview: `your_jwt_here` + ☑️ Sensitive
- [ ] Development: `your_jwt_here` + ☑️ Sensitive

---

## ✅ Gemini & Facebook Variables (5)

### 6. VITE_GEMINI_API_KEY

- [ ] Production: `your_gemini_api_key_here`
- [ ] Preview: `your_gemini_api_key_here`
- [ ] Development: `your_gemini_api_key_here`

### 7. FB_PIXEL_ID

- [ ] Production: `349832333681399`
- [ ] Preview: `349832333681399`
- [ ] Development: `349832333681399`

### 8. FB_ACCESS_TOKEN ⚠️ SENSITIVE

- [ ] Production: `your_fb_access_token_here` + ☑️ Sensitive
- [ ] Preview: `your_fb_access_token_here` + ☑️ Sensitive
- [ ] Development: `your_fb_access_token_here` + ☑️ Sensitive

### 9. FB_TEST_EVENT_CODE

- [ ] Preview: `TEST123`
- [ ] Development: `TEST123`
- [ ] Production: (skip - not needed)

### 10. EVENT_SOURCE_URL

- [ ] Production: `https://www.personaltrainersdubai.com`
- [ ] Preview: `https://www.personaltrainersdubai.com`
- [ ] Development: `https://www.personaltrainersdubai.com`

---

## ✅ URL & Config Variables (3)

### 11. VITE_META_CAPI_URL

- [ ] Production: `https://client-vital-suite.vercel.app/api`
- [ ] Preview: `https://client-vital-suite.vercel.app/api`
- [ ] Development: `https://client-vital-suite.vercel.app/api`

### 12. VITE_API_BASE

- [ ] Production: `https://client-vital-suite.vercel.app`
- [ ] Preview: `https://client-vital-suite.vercel.app`
- [ ] Development: `https://client-vital-suite.vercel.app`

### 13. LOG_LEVEL

- [ ] Production: `info`
- [ ] Preview: `info`
- [ ] Development: `info`

---

## 🚀 After Setup

1. [ ] Go to Deployments tab
2. [ ] Click "..." on latest deployment
3. [ ] Click "Redeploy"
4. [ ] Wait for build to complete
5. [ ] Test: `curl https://client-vital-suite.vercel.app/api/system-check`

---

## 📝 Notes

- **Sensitive variables**: Must manually mark `SUPABASE_SERVICE_ROLE_KEY` and `FB_ACCESS_TOKEN` as "Sensitive" in dashboard
- **FB_TEST_EVENT_CODE**: Only needed for Preview and Development (not Production)
- **All other variables**: Set for all 3 environments (Production, Preview, Development)
