# Vercel Environment Variables Guide

## Overview
This document lists all environment variables needed for each Vercel environment (Production, Preview, Development).

---

## Environment Variables by Type

### 🔵 Frontend Variables (VITE_* - Build-time)
These are embedded into the frontend bundle at build time. Set in **all environments**.

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `VITE_SUPABASE_URL` | ✅ Yes | Supabase project URL | `https://ztjndilxurtsfqdsvfds.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ Yes | Supabase publishable key (anon key) | `eyJhbGci...` |
| `VITE_SUPABASE_ANON_KEY` | ⚠️ Optional | Legacy anon key (if not using publishable) | `eyJhbGci...` |

### 🔴 Server-side Variables (Runtime - API Routes)
These are only available in serverless functions. Set in **all environments**.

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `SUPABASE_URL` | ✅ Yes | Supabase project URL (for API routes) | `https://ztjndilxurtsfqdsvfds.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | Service role key (server-only, never exposed) | `eyJhbGci...` |
| `FB_PIXEL_ID` | ✅ Yes | Facebook Pixel ID | `1234567890` |
| `FB_ACCESS_TOKEN` | ✅ Yes | Facebook Marketing API token | `EAABwzLix...` |
| `FB_TEST_EVENT_CODE` | ⚠️ Optional | Facebook test event code (for testing) | `TEST12345` |
| `EVENT_SOURCE_URL` | ✅ Yes | Event source URL for Meta events | `https://www.personaltrainersdubai.com` |
| `AGENT_API_KEY` | ⚠️ Optional | Optional API key for `/api/agent` protection | `your-secret-key` |

---

## Environment Configuration

### Production Environment
**Set all variables below:**

**Frontend (VITE_*):**
- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_PUBLISHABLE_KEY`
- ⚠️ `VITE_SUPABASE_ANON_KEY` (optional, if not using publishable)

**Server-side:**
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `FB_PIXEL_ID`
- ✅ `FB_ACCESS_TOKEN`
- ⚠️ `FB_TEST_EVENT_CODE` (optional, remove for production)
- ✅ `EVENT_SOURCE_URL`
- ⚠️ `AGENT_API_KEY` (optional, for extra security)

---

### Preview Environment
**Set all variables below (same as Production):**

**Frontend (VITE_*):**
- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_PUBLISHABLE_KEY`
- ⚠️ `VITE_SUPABASE_ANON_KEY` (optional)

**Server-side:**
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `FB_PIXEL_ID`
- ✅ `FB_ACCESS_TOKEN`
- ✅ `FB_TEST_EVENT_CODE` (recommended for preview/testing)
- ✅ `EVENT_SOURCE_URL`
- ⚠️ `AGENT_API_KEY` (optional)

---

### Development Environment
**Set all variables below (same as Production/Preview):**

**Frontend (VITE_*):**
- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_PUBLISHABLE_KEY`
- ⚠️ `VITE_SUPABASE_ANON_KEY` (optional)

**Server-side:**
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `FB_PIXEL_ID`
- ✅ `FB_ACCESS_TOKEN`
- ✅ `FB_TEST_EVENT_CODE` (recommended for local testing)
- ✅ `EVENT_SOURCE_URL`
- ⚠️ `AGENT_API_KEY` (optional)

---

## Custom Environments (if you have one more)

If you have a **staging** or **custom** environment, set the same variables as Production.

**Example: Staging Environment**
- Same variables as Production
- Use `FB_TEST_EVENT_CODE` for testing
- May use different `EVENT_SOURCE_URL` if needed

---

## Quick Checklist

### ✅ Already Set (from previous setup):
- [x] `SUPABASE_URL` (Production, Preview, Development)
- [x] `SUPABASE_SERVICE_ROLE_KEY` (Production, Preview, Development)
- [x] `VITE_SUPABASE_URL` (Production)
- [x] `VITE_SUPABASE_ANON_KEY` (Production)
- [x] `VITE_SUPABASE_PUBLISHABLE_KEY` (Production)

### ⚠️ Need to Verify/Add:
- [ ] `VITE_SUPABASE_URL` (Preview, Development)
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` (Preview, Development)
- [ ] `FB_PIXEL_ID` (all environments)
- [ ] `FB_ACCESS_TOKEN` (all environments)
- [ ] `FB_TEST_EVENT_CODE` (all environments - optional)
- [ ] `EVENT_SOURCE_URL` (all environments)
- [ ] `AGENT_API_KEY` (all environments - optional)

---

## How to Set Variables in Vercel

### Via CLI:
```bash
# Frontend variable (Production)
echo "https://ztjndilxurtsfqdsvfds.supabase.co" | vercel env add VITE_SUPABASE_URL production

# Server-side variable (Production)
echo "your-value" | vercel env add FB_PIXEL_ID production

# Repeat for preview and development
echo "your-value" | vercel env add FB_PIXEL_ID preview
echo "your-value" | vercel env add FB_PIXEL_ID development
```

### Via Dashboard:
1. Go to: https://vercel.com/milos-projects-d46729ec/client-vital-suite/settings/environments/production
2. Click "Add New" for each variable
3. Select environment(s): Production ✅, Preview ✅, Development ✅
4. Enter variable name and value
5. Save

---

## Verification

After setting variables, verify with:
```bash
curl https://client-vital-suite.vercel.app/api/system-check
```

This endpoint checks all required variables and reports what's missing.

---

## Notes

- **VITE_*** variables are embedded at build time - changes require redeploy
- **Server-side** variables are available at runtime - changes take effect on next deployment
- **Never** put `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_*` variable (security risk)
- **FB_TEST_EVENT_CODE** should be removed from Production for real events
- All environments can use the same Supabase credentials (same project)

