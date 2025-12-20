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

- [ ] Production: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo`
- [ ] Preview: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo`
- [ ] Development: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo`

### 3. VITE_SUPABASE_ANON_KEY

- [ ] Production: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo`
- [ ] Preview: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo`
- [ ] Development: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo`

### 4. SUPABASE_URL

- [ ] Production: `https://ztjndilxurtsfqdsvfds.supabase.co`
- [ ] Preview: `https://ztjndilxurtsfqdsvfds.supabase.co`
- [ ] Development: `https://ztjndilxurtsfqdsvfds.supabase.co`

### 5. SUPABASE_SERVICE_ROLE_KEY ⚠️ SENSITIVE

- [ ] Production: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDEyMDYwNywiZXhwIjoyMDY5Njk2NjA3fQ.1YKDkcl8EQ6eRG1y_-LaIfd03tEJffYNCVEyTrUuNCY` + ☑️ Sensitive
- [ ] Preview: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDEyMDYwNywiZXhwIjoyMDY5Njk2NjA3fQ.1YKDkcl8EQ6eRG1y_-LaIfd03tEJffYNCVEyTrUuNCY` + ☑️ Sensitive
- [ ] Development: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDEyMDYwNywiZXhwIjoyMDY5Njk2NjA3fQ.1YKDkcl8EQ6eRG1y_-LaIfd03tEJffYNCVEyTrUuNCY` + ☑️ Sensitive

---

## ✅ Gemini & Facebook Variables (5)

### 6. VITE_GEMINI_API_KEY

- [ ] Production: `AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s`
- [ ] Preview: `AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s`
- [ ] Development: `AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s`

### 7. FB_PIXEL_ID

- [ ] Production: `349832333681399`
- [ ] Preview: `349832333681399`
- [ ] Development: `349832333681399`

### 8. FB_ACCESS_TOKEN ⚠️ SENSITIVE

- [ ] Production: `EAADKZCilWZBHEBQMFcIgF9iTEPeXBmOvExm0HFIXDzcRQA1DPOWoieespOjXQdr2wdsJlZBx4W3IJyIcwZC3mXw0ZBvnIUTTYagAiLaTN4ohBuuVTwDlVTEgrW0z85LSIEmHx2wtOzItBxsPtYVcJoTZBkZBZAFFPEUIoRo86Tok9YdJzhqwgPd5mTESjnjFxzDGtDPpAtZC1` + ☑️ Sensitive
- [ ] Preview: `EAADKZCilWZBHEBQMFcIgF9iTEPeXBmOvExm0HFIXDzcRQA1DPOWoieespOjXQdr2wdsJlZBx4W3IJyIcwZC3mXw0ZBvnIUTTYagAiLaTN4ohBuuVTwDlVTEgrW0z85LSIEmHx2wtOzItBxsPtYVcJoTZBkZBZAFFPEUIoRo86Tok9YdJzhqwgPd5mTESjnjFxzDGtDPpAtZC1` + ☑️ Sensitive
- [ ] Development: `EAADKZCilWZBHEBQMFcIgF9iTEPeXBmOvExm0HFIXDzcRQA1DPOWoieespOjXQdr2wdsJlZBx4W3IJyIcwZC3mXw0ZBvnIUTTYagAiLaTN4ohBuuVTwDlVTEgrW0z85LSIEmHx2wtOzItBxsPtYVcJoTZBkZBZAFFPEUIoRo86Tok9YdJzhqwgPd5mTESjnjFxzDGtDPpAtZC1` + ☑️ Sensitive

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
