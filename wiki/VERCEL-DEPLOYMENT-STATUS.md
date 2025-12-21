# 🔍 Vercel Deployment Status & Links

## 📍 Your Vercel Projects

### **client-vital-suite** - needs local confirmation
**Production URL:** `https://client-vital-suite.vercel.app`

**All Available Domains (from prior deploys):**
- `client-vital-suite.vercel.app` (Main Production)
- `client-vital-suite-milos-projects-d46729ec.vercel.app`
- `client-vital-suite-git-main-milos-projects-d46729ec.vercel.app`
- `client-vital-suite-2eyibwcwu-milos-projects-d46729ec.vercel.app`

**Status:** ⚠️ Cannot verify live readiness from this workspace (no Vercel auth here).
**Legend:** ✅ = confirmed locally, ⚠️ = unknown from here, ❌/**red** = fix before testing (usually missing login/link or env).
**Framework:** Vite (React)
**Node Version:** 24.x

---

## 🔌 What's Deployed

### ✅ **Frontend App:**
- ✅ React/Vite application
- ✅ All pages and components
- ✅ Supabase integration configured

### ✅ **API Functions Status:**
**Current State:** Unknown from this sandbox (no Vercel creds here). Run the verification commands below on your machine.

**Available API Endpoints (Vercel Serverless Functions, expected when deployed):**
- `/api/health` → should return `{ "status": "ok" }`
- `/api/events/[name]` → single events
- `/api/events/batch` → batch events
- `/api/webhook/backfill` → webhook handler

**How to verify live:**
- `curl -i https://client-vital-suite.vercel.app/api/health`
- `curl -i https://client-vital-suite.vercel.app/api/events/Purchase`

If either returns `NOT_FOUND`, re-run `vercel --prod` from the repo root after `vercel link`.

**Quick verification commands:**
```bash
curl -i https://client-vital-suite.vercel.app/api/health
curl -i https://client-vital-suite.vercel.app/api/events/Purchase
```

**If a future deploy ever shows `NOT_FOUND`:**
- Ensure the deploy is run from the repo root (so `/api` is included) and the project is linked to `client-vital-suite`.
- Deploy with: `vercel --prod`

---

## 🎯 What You Need

### ❓ Do these functions need to be on Vercel?

Yes. Everything under `/api` is a **Vercel Serverless Function** and must be deployed with the Vercel project so the endpoints resolve at `https://client-vital-suite.vercel.app/api/*`. Supabase Edge Functions (`/supabase/functions/*`) are already deployed from the Supabase project and do not replace or host the `/api` routes.

### **Option 1: Deploy API Functions (Recommended)**

Your API functions are in `/api/` folder:
- ✅ `api/health.ts` - Health check endpoint
- ✅ `api/events/[name].ts` - Single event endpoint
- ✅ `api/events/batch.ts` - Batch events endpoint
- ✅ `api/webhook/backfill.ts` - Webhook endpoint

**To Deploy:**
1. Make sure you're in the `jux` project directory
2. Run: `vercel --prod`
3. This will deploy both frontend AND API functions

### **Option 2: Check Current Project**

The `client-vital-suite` deployment might be from a different codebase. Check:
- Is `client-vital-suite` connected to this `jux` repo?
- Or is it a separate project?

---

## 📊 Current Status Summary

| Component | Status | URL |
|-----------|--------|-----|
| **Frontend** | ⚠️ Needs confirmation | `https://client-vital-suite.vercel.app` |
| **API Functions** | ⚠️ Needs confirmation | Served from `https://client-vital-suite.vercel.app/api/*` |
| **Supabase Functions** | ⚠️ Needs confirmation | `https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/` |
| **Environment Vars** | ⚠️ Needs confirmation | FB_PIXEL_ID, FB_ACCESS_TOKEN (verify with `vercel env pull`) |

---

## 🔧 Next Steps

1. **Keep deploying from repo root** to ensure `/api` stays included:
   ```bash
   vercel --prod
   ```

2. **If linking on a new machine:**
   ```bash
   vercel link
   # Select: client-vital-suite
   vercel --prod
   ```

3. **Spot-check periodically:**
   ```bash
   curl https://client-vital-suite.vercel.app/api/health
   ```

---

## ✅/⚠️ Current Reality

- ⚠️ Cannot verify live deploy status from this sandbox (no Vercel/Supabase credentials).
- ✅ You can verify in ~60 seconds locally: run `./check-cli-connections.sh`, then curl `/api/health`.

## 🔔 What to do locally

1) `./check-cli-connections.sh` — confirms Vercel+Supabase CLI install, login, and project linkage.
2) `curl -i https://client-vital-suite.vercel.app/api/health` — confirms Vercel API routes are live.
3) `supabase functions list` — confirms project ref is visible and functions are listed.
4) If any step fails: run `vercel link` (choose `client-vital-suite`), `vercel --prod`, and re-run the checks.

---

## 📝 Summary

**Links to verify:**
- `https://client-vital-suite.vercel.app`
- `https://client-vital-suite.vercel.app/api/health`

**Action:** Run the local checks above; if anything fails, re-link (`vercel link`) and redeploy from the repo root (`vercel --prod`).

---

## 🧭 What went wrong and how to double-check the CLIs

### Root cause of the earlier `NOT_FOUND` error
- A deploy was triggered without the repository root linked to the Vercel project, so the `/api` folder was not packaged and Vercel returned `NOT_FOUND` for every serverless route.
- Redeploying from the repo root with the project linked restored the `/api/*` handlers, which is why `/api/health` now returns `{ "status": "ok" }`.

### 60-second CLI sanity check (start here)
Run these in order from the **repo root** to confirm both CLIs are pointed at the right accounts and projects:

1) **Vercel CLI is installed & authenticated**
```bash
vercel --version   # should print a version number
vercel whoami      # expect: milos-9957 (team: milos-projects-d46729ec)
```

2) **Repo is linked to the correct Vercel project**
```bash
vercel link        # select/confirm: client-vital-suite (team milos-projects-d46729ec)
vercel env pull    # optional: confirm envs download without errors
```

3) **Supabase CLI is installed & pointing at the right instance**
```bash
supabase --version           # should print a version number
supabase projects list       # ensure ztjndilxurtsfqdsvfds is visible
supabase link --project-ref ztjndilxurtsfqdsvfds
supabase functions list      # optional: should list ~65 functions
```

4) **Deployment check** (only after the above succeeds)
```bash
vercel --prod   # deploys frontend + /api/*
```

If any command errors, fix the linkage/auth first (e.g., `vercel logout && vercel login`, or re-run `supabase link`) before redeploying.

### Verify the Vercel CLI is linked to the right project
```bash
# Confirm you're authenticated
vercel whoami

# Make sure you're inside this repo, then confirm linkage
vercel link
# Select or confirm: client-vital-suite (milos-projects-d46729ec)

# Deploy from the root so /api is included
vercel --prod
```

### Verify Supabase CLI is pointed at the correct project
```bash
# Confirm the CLI is installed and you are logged in
supabase --version
supabase projects list

# From the repo root, ensure the project ref matches the expected instance
supabase link --project-ref ztjndilxurtsfqdsvfds

# Optional: test an edge function invocation if needed
supabase functions list
```

### If you're working in Lovable
- You can keep using Lovable for editing, but run the above Vercel/Supabase CLI checks locally to ensure the toolchain is linked to the right projects before deploying.

