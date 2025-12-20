# 🔐 COMPLETE ENVIRONMENT VARIABLES SETUP

**Total Variables**: 14  
**Required**: 5  
**Optional**: 9

---

## 🔗 VERCEL DASHBOARD LINK

**<https://vercel.com/milos-projects-d46729ec/client-vital-suite/settings/environment-variables>**

---

## ✅ REQUIRED VARIABLES (5)

### 1. `VITE_SUPABASE_URL`

| Field | Value |
|-------|-------|
| **Name** | `VITE_SUPABASE_URL` |
| **Value** | `https://ztjndilxurtsfqdsvfds.supabase.co` |
| **Environments** | ☑️ Production ☑️ Preview ☑️ Development |
| **Sensitive** | ☐ No |

**Used in files:**

- `src/integrations/supabase/client.ts:7`
- `src/components/ptd/StripeAIDashboard.tsx:86`
- `src/pages/StripeIntelligence.tsx:174`
- `src/utils/verifyBrowserConnection.ts:30`
- `api/system-check.ts:15`

---

### 2. `VITE_SUPABASE_PUBLISHABLE_KEY`

| Field | Value |
|-------|-------|
| **Name** | `VITE_SUPABASE_PUBLISHABLE_KEY` |
| **Value** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo` |
| **Environments** | ☑️ Production ☑️ Preview ☑️ Development |
| **Sensitive** | ☐ No |

**Used in files:**

- `src/integrations/supabase/client.ts:8`
- `src/components/ptd/StripeAIDashboard.tsx:87`
- `src/pages/StripeIntelligence.tsx:179`

---

### 3. `VITE_SUPABASE_ANON_KEY`

| Field | Value |
|-------|-------|
| **Name** | `VITE_SUPABASE_ANON_KEY` |
| **Value** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo` |
| **Environments** | ☑️ Production ☑️ Preview ☑️ Development |
| **Sensitive** | ☐ No |

> Same value as VITE_SUPABASE_PUBLISHABLE_KEY

**Used in files:**

- `api/system-check.ts:16`

---

### 4. `SUPABASE_URL`

| Field | Value |
|-------|-------|
| **Name** | `SUPABASE_URL` |
| **Value** | `https://ztjndilxurtsfqdsvfds.supabase.co` |
| **Environments** | ☑️ Production ☑️ Preview ☑️ Development |
| **Sensitive** | ☐ No |

**Used in files:**

- `api/system-check.ts:17`
- `api/agent.ts:75`
- `scripts/run-setup.mjs:6`

---

### 5. `SUPABASE_SERVICE_ROLE_KEY`

| Field | Value |
|-------|-------|
| **Name** | `SUPABASE_SERVICE_ROLE_KEY` |
| **Value** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDEyMDYwNywiZXhwIjoyMDY5Njk2NjA3fQ.1YKDkcl8EQ6eRG1y_-LaIfd03tEJffYNCVEyTrUuNCY` |
| **Environments** | ☑️ Production ☑️ Preview ☑️ Development |
| **Sensitive** | ☑️ **YES - Mark as Sensitive!** |

**Used in files:**

- `api/system-check.ts:18`
- `api/agent.ts:76`
- `scripts/run-setup.mjs:7`
- `scripts/query-stripe-blocked-ips.ts:10`

---

## ✅ OPTIONAL VARIABLES (9) - ALL VALUES FROM LOCAL ENV

### 6. `VITE_GEMINI_API_KEY`

| Field | Value |
|-------|-------|
| **Name** | `VITE_GEMINI_API_KEY` |
| **Value** | `AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s` |
| **Environments** | ☑️ Production ☑️ Preview ☑️ Development |
| **Sensitive** | ☐ No |
| **Purpose** | Google Gemini AI features |

---

### 7. `FB_PIXEL_ID`

| Field | Value |
|-------|-------|
| **Name** | `FB_PIXEL_ID` |
| **Value** | `349832333681399` |
| **Environments** | ☑️ Production ☑️ Preview ☑️ Development |
| **Sensitive** | ☐ No |
| **Purpose** | Facebook Conversion API tracking |

---

### 8. `FB_ACCESS_TOKEN`

| Field | Value |
|-------|-------|
| **Name** | `FB_ACCESS_TOKEN` |
| **Value** | `EAADKZCilWZBHEBQMFcIgF9iTEPeXBmOvExm0HFIXDzcRQA1DPOWoieespOjXQdr2wdsJlZBx4W3IJyIcwZC3mXw0ZBvnIUTTYagAiLaTN4ohBuuVTwDlVTEgrW0z85LSIEmHx2wtOzItBxsPtYVcJoTZBkZBZAFFPEUIoRo86Tok9YdJzhqwgPd5mTESjnjFxzDGtDPpAtZC1` |
| **Environments** | ☑️ Production ☑️ Preview ☑️ Development |
| **Sensitive** | ☑️ **YES - Mark as Sensitive!** |
| **Purpose** | Facebook Marketing API authentication |

---

### 9. `FB_TEST_EVENT_CODE`

| Field | Value |
|-------|-------|
| **Name** | `FB_TEST_EVENT_CODE` |
| **Value** | `TEST123` |
| **Environments** | ☐ Production ☑️ Preview ☑️ Development |
| **Sensitive** | ☐ No |
| **Purpose** | Facebook test events (for debugging) |

---

### 10. `EVENT_SOURCE_URL`

| Field | Value |
|-------|-------|
| **Name** | `EVENT_SOURCE_URL` |
| **Value** | `https://www.personaltrainersdubai.com` |
| **Environments** | ☑️ Production ☑️ Preview ☑️ Development |
| **Sensitive** | ☐ No |
| **Purpose** | Source URL for Facebook events |

---

### 11. `VITE_META_CAPI_URL`

| Field | Value |
|-------|-------|
| **Name** | `VITE_META_CAPI_URL` |
| **Value** | `https://client-vital-suite.vercel.app/api` |
| **Environments** | ☑️ Production ☑️ Preview ☑️ Development |
| **Sensitive** | ☐ No |
| **Purpose** | Meta CAPI backend endpoint |

---

### 12. `VITE_API_BASE`

| Field | Value |
|-------|-------|
| **Name** | `VITE_API_BASE` |
| **Value** | `https://client-vital-suite.vercel.app` |
| **Environments** | ☑️ Production ☑️ Preview ☑️ Development |
| **Sensitive** | ☐ No |
| **Purpose** | Base URL for API calls |

---

### 13. `AGENT_API_KEY`

| Field | Value |
|-------|-------|
| **Name** | `AGENT_API_KEY` |
| **Value** | `<GENERATE: openssl rand -hex 32>` |
| **Environments** | ☑️ Production ☑️ Preview ☑️ Development |
| **Sensitive** | ☑️ **YES - Mark as Sensitive!** |
| **Purpose** | Secure API agent endpoint |

---

### 14. `LOG_LEVEL`

| Field | Value |
|-------|-------|
| **Name** | `LOG_LEVEL` |
| **Value** | `info` |
| **Environments** | ☑️ Production ☑️ Preview ☑️ Development |
| **Sensitive** | ☐ No |
| **Purpose** | Backend logging verbosity |

---

## 📋 QUICK REFERENCE TABLE

| # | Variable | Required | Sensitive | Prod | Preview | Dev |
|---|----------|----------|-----------|------|---------|-----|
| 1 | `VITE_SUPABASE_URL` | ✅ | ☐ | ☑️ | ☑️ | ☑️ |
| 2 | `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | ☐ | ☑️ | ☑️ | ☑️ |
| 3 | `VITE_SUPABASE_ANON_KEY` | ✅ | ☐ | ☑️ | ☑️ | ☑️ |
| 4 | `SUPABASE_URL` | ✅ | ☐ | ☑️ | ☑️ | ☑️ |
| 5 | `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ☑️ | ☑️ | ☑️ | ☑️ |
| 6 | `VITE_GEMINI_API_KEY` | ☐ | ☐ | ☑️ | ☑️ | ☑️ |
| 7 | `FB_PIXEL_ID` | ☐ | ☐ | ☑️ | ☑️ | ☑️ |
| 8 | `FB_ACCESS_TOKEN` | ☐ | ☑️ | ☑️ | ☑️ | ☑️ |
| 9 | `FB_TEST_EVENT_CODE` | ☐ | ☐ | ☐ | ☑️ | ☑️ |
| 10 | `VITE_META_CAPI_URL` | ☐ | ☐ | ☑️ | ☑️ | ☑️ |
| 11 | `VITE_API_BASE` | ☐ | ☐ | ☑️ | ☑️ | ☑️ |
| 12 | `AGENT_API_KEY` | ☐ | ☑️ | ☑️ | ☑️ | ☑️ |
| 13 | `EVENT_SOURCE_URL` | ☐ | ☐ | ☑️ | ☑️ | ☑️ |
| 14 | `LOG_LEVEL` | ☐ | ☐ | ☑️ | ☑️ | ☑️ |

---

## 🚀 COPY-PASTE ALL VALUES

### Required (5)

```
VITE_SUPABASE_URL=https://ztjndilxurtsfqdsvfds.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo
SUPABASE_URL=https://ztjndilxurtsfqdsvfds.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDEyMDYwNywiZXhwIjoyMDY5Njk2NjA3fQ.1YKDkcl8EQ6eRG1y_-LaIfd03tEJffYNCVEyTrUuNCY
```

### Optional - Gemini & Facebook (5)

```
VITE_GEMINI_API_KEY=AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s
FB_PIXEL_ID=349832333681399
FB_ACCESS_TOKEN=EAADKZCilWZBHEBQMFcIgF9iTEPeXBmOvExm0HFIXDzcRQA1DPOWoieespOjXQdr2wdsJlZBx4W3IJyIcwZC3mXw0ZBvnIUTTYagAiLaTN4ohBuuVTwDlVTEgrW0z85LSIEmHx2wtOzItBxsPtYVcJoTZBkZBZAFFPEUIoRo86Tok9YdJzhqwgPd5mTESjnjFxzDGtDPpAtZC1
FB_TEST_EVENT_CODE=TEST123
EVENT_SOURCE_URL=https://www.personaltrainersdubai.com
```

### Optional - URLs & Config (3)

```
VITE_META_CAPI_URL=https://client-vital-suite.vercel.app/api
VITE_API_BASE=https://client-vital-suite.vercel.app
LOG_LEVEL=info
```

---

## ✅ SETUP CHECKLIST

- [ ] Go to <https://vercel.com/milos-projects-d46729ec/client-vital-suite/settings/environment-variables>
- [ ] Add `VITE_SUPABASE_URL` (Prod ✓ Preview ✓ Dev ✓)
- [ ] Add `VITE_SUPABASE_PUBLISHABLE_KEY` (Prod ✓ Preview ✓ Dev ✓)
- [ ] Add `VITE_SUPABASE_ANON_KEY` (Prod ✓ Preview ✓ Dev ✓)
- [ ] Add `SUPABASE_URL` (Prod ✓ Preview ✓ Dev ✓)
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` (Prod ✓ Preview ✓ Dev ✓) **+ Sensitive ✓**
- [ ] Click **Redeploy** to apply changes
- [ ] Test: `curl https://client-vital-suite.vercel.app/api/system-check`
