# 🚀 Complete Vercel Environment Variables Setup Instructions

## Quick Start

**Dashboard**: <https://vercel.com/milos-projects-d46729ec/client-vital-suite/settings/environment-variables>

---

## Method 1: Automated Script (Recommended)

```bash
# Run the automated script
bash scripts/add-all-vercel-env.sh

# Then manually mark sensitive vars in dashboard:
# 1. Go to dashboard link above
# 2. Find SUPABASE_SERVICE_ROLE_KEY → Click → Check "Sensitive"
# 3. Find FB_ACCESS_TOKEN → Click → Check "Sensitive"
```

---

## Method 2: Manual Setup

Use the checklist: [VERCEL_ENV_SETUP_CHECKLIST.md](./VERCEL_ENV_SETUP_CHECKLIST.md)

---

## All 13 Variables Summary

| # | Variable | Value | Environments | Sensitive |
|---|----------|-------|--------------|-----------|
| 1 | `VITE_SUPABASE_URL` | `https://ztjndilxurtsfqdsvfds.supabase.co` | All 3 | No |
| 2 | `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbG...V15Lo` | All 3 | No |
| 3 | `VITE_SUPABASE_ANON_KEY` | `eyJhbG...V15Lo` | All 3 | No |
| 4 | `SUPABASE_URL` | `https://ztjndilxurtsfqdsvfds.supabase.co` | All 3 | No |
| 5 | `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...uNCY` | All 3 | **YES** |
| 6 | `VITE_GEMINI_API_KEY` | `AIzaSy...5_i_s` | All 3 | No |
| 7 | `FB_PIXEL_ID` | `349832333681399` | All 3 | No |
| 8 | `FB_ACCESS_TOKEN` | `your_fb_access_token_here...pAtZC1` | All 3 | **YES** |
| 9 | `FB_TEST_EVENT_CODE` | `TEST123` | Preview + Dev | No |
| 10 | `EVENT_SOURCE_URL` | `https://www.personaltrainersdubai.com` | All 3 | No |
| 11 | `VITE_META_CAPI_URL` | `https://client-vital-suite.vercel.app/api` | All 3 | No |
| 12 | `VITE_API_BASE` | `https://client-vital-suite.vercel.app` | All 3 | No |
| 13 | `LOG_LEVEL` | `info` | All 3 | No |

---

## Step-by-Step: Mark Sensitive Variables

1. Go to: <https://vercel.com/milos-projects-d46729ec/client-vital-suite/settings/environment-variables>
2. Find `SUPABASE_SERVICE_ROLE_KEY`
3. Click on it
4. Check the **"Sensitive"** checkbox
5. Save
6. Repeat for `FB_ACCESS_TOKEN`

---

## Step-by-Step: Redeploy

### Option A: Via Dashboard

1. Go to: <https://vercel.com/milos-projects-d46729ec/client-vital-suite/deployments>
2. Find latest deployment
3. Click **"..."** (three dots)
4. Click **"Redeploy"**
5. Wait for build to complete

### Option B: Via CLI

```bash
vercel --prod
```

---

## Verification

### Test System Check Endpoint

```bash
curl https://client-vital-suite.vercel.app/api/system-check
```

Expected response:

```json
{
  "ok": true,
  "env": {
    "VITE_SUPABASE_URL": {"ok": true},
    "VITE_SUPABASE_ANON_KEY": {"ok": true},
    "SUPABASE_URL": {"ok": true},
    "SUPABASE_SERVICE_ROLE_KEY": {"ok": true}
  },
  "localhost": {"ok": true},
  "supabase": {
    "db": {"ok": true},
    "edge_function_verify_all_keys": {"ok": true}
  }
}
```

### Verify All Variables

```bash
bash scripts/verify-vercel-env.sh
```

---

## Troubleshooting

### Variables Not Showing Up?

- Wait 1-2 minutes after adding
- Trigger a redeploy
- Check you selected correct environment (Production/Preview/Development)

### Build Failing?

- Check all required variables are set
- Verify no typos in variable names
- Ensure sensitive vars are marked correctly

### System Check Failing?

- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Check `SUPABASE_URL` points to correct project
- Ensure database is accessible

---

## Reference Files

- **Complete Setup Guide**: [COMPLETE_ENV_VARS_SETUP.md](./COMPLETE_ENV_VARS_SETUP.md)
- **Checklist**: [VERCEL_ENV_SETUP_CHECKLIST.md](./VERCEL_ENV_SETUP_CHECKLIST.md)
- **Automated Script**: `scripts/add-all-vercel-env.sh`
- **Verification Script**: `scripts/verify-vercel-env.sh`
