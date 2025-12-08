# Lovable + Vercel Sync Troubleshooting Guide

## Problem: Vercel Not Updating When Lovable Makes Changes

If Lovable is pushing changes to GitHub but Vercel is not deploying/updating, follow this troubleshooting guide.

## Understanding the Integration Flow

```
Lovable → GitHub (main branch) → Vercel (auto-deploy)
```

**Expected behavior:**
1. You make changes in Lovable
2. Lovable commits and pushes to GitHub `main` branch
3. Vercel detects the GitHub push
4. Vercel automatically builds and deploys

## Common Issues & Solutions

### Issue 1: Vercel Watching Wrong Branch

**Symptom:** Vercel not deploying when Lovable pushes to GitHub

**Solution:**
1. Go to Vercel Dashboard → Your Project
2. Click **Settings** → **Git**
3. Check **Production Branch** - it should be `main`
4. If it's different, change it to `main`
5. Save changes

### Issue 2: GitHub Integration Disconnected

**Symptom:** No deployments triggered at all

**Solution:**
1. Go to Vercel Dashboard → Your Project
2. Click **Settings** → **Git**
3. Check if GitHub is connected
4. If disconnected, click **Connect Git Repository**
5. Select: `milosriki/client-vital-suite`
6. Authorize Vercel to access the repository

### Issue 3: Build Configuration Mismatch

**Symptom:** Builds fail or deploy old version

**Solution:**

Ensure Vercel has these settings (should be auto-configured via `vercel.json`):

```
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

**To verify:**
1. Go to Vercel Dashboard → Your Project → Settings → General
2. Scroll to "Build & Development Settings"
3. Verify the above settings match

### Issue 4: Environment Variables Missing

**Symptom:** App builds but doesn't work (white screen, errors)

**Solution:**

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add required variables:
   - `VITE_SUPABASE_URL` = Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key
3. Select environments: ✅ Production, ✅ Preview, ✅ Development
4. Click **Save**
5. **Redeploy** the project for changes to take effect

### Issue 5: Ignored Push Events

**Symptom:** Some commits don't trigger deployment

**Solution:**

Check if `.vercelignore` is excluding too much:
- Should NOT exclude `src/`, `public/`, or other source files
- Should exclude: `node_modules`, `dist`, `.env`, test files

Our `.vercelignore` is correctly configured.

### Issue 6: Deployment Paused or Failed

**Symptom:** Deployments exist but show as paused/failed

**Solution:**
1. Go to Vercel Dashboard → Your Project → Deployments
2. Check latest deployment status
3. If failed, click on it to see error logs
4. Common failures:
   - **Build errors**: Check code syntax, missing dependencies
   - **Memory limit**: Upgrade Vercel plan or optimize build
   - **Timeout**: Build takes too long, optimize dependencies

### Issue 7: Lovable Not Pushing to Main Branch

**Symptom:** Lovable changes not appearing in GitHub main branch

**Solution:**
1. Go to GitHub repository: https://github.com/milosriki/client-vital-suite
2. Check which branch has the latest commits
3. If Lovable is pushing to a different branch:
   - Check Lovable project settings
   - Verify the connected branch
   - Contact Lovable support if needed

## Verification Steps

After fixing any issues, verify the integration works:

### Step 1: Check GitHub
```bash
# View latest commits on main branch
git checkout main
git pull origin main
git log --oneline -5
```

### Step 2: Make a Test Change in Lovable
1. Go to Lovable: https://lovable.dev/projects/2849fe86-5874-418c-a421-d4e916c8a052
2. Make a small change (e.g., update a text)
3. Wait for Lovable to commit and push

### Step 3: Verify GitHub Updated
1. Go to GitHub: https://github.com/milosriki/client-vital-suite
2. Check latest commit - should show your Lovable change
3. Note the commit time

### Step 4: Verify Vercel Deployed
1. Go to Vercel Dashboard → Your Project → Deployments
2. Check for a new deployment with matching timestamp
3. Status should show "Ready" (green checkmark)
4. Click deployment to see details

### Step 5: Test Live Site
1. Visit your Vercel production URL
2. Verify your change is visible
3. Check browser console for errors (F12)

## Manual Deployment (If Automatic Fails)

If automatic deployment continues to fail:

### Option 1: Deploy via Vercel Dashboard
1. Go to Vercel Dashboard → Your Project
2. Click **Deployments** tab
3. Click **Redeploy** on the latest deployment
4. Select "Use existing Build Cache" or "Rebuild"

### Option 2: Deploy via Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
cd /path/to/client-vital-suite
vercel --prod
```

## Checking Vercel Webhook (Advanced)

Vercel uses GitHub webhooks for automatic deployment:

1. Go to GitHub → Settings → Webhooks
2. Look for Vercel webhook (https://vercel.com/hook/...)
3. Check "Recent Deliveries"
4. If webhook is failing:
   - Click "Redeliver"
   - Check response status
   - If 404/403, reconnect Vercel integration

## Contact Support

If none of the above solutions work:

**Lovable Support:**
- Issues with Lovable pushing to GitHub
- Lovable project configuration
- Contact: support@lovable.dev

**Vercel Support:**
- Issues with Vercel deployment
- Vercel integration with GitHub
- Contact: https://vercel.com/support

**GitHub Support:**
- Issues with repository permissions
- Webhook problems
- Contact: https://support.github.com

## Quick Checklist

Before seeking support, verify:

- [ ] Lovable is pushing to `main` branch in GitHub
- [ ] Vercel is watching the `main` branch
- [ ] GitHub-Vercel integration is connected
- [ ] Environment variables are set in Vercel
- [ ] Latest GitHub commit timestamp matches Vercel deployment
- [ ] Build succeeds locally: `npm install && npm run build`
- [ ] No errors in Vercel deployment logs
- [ ] Vercel project is not paused or archived

## Configuration Files Reference

This repository has the correct Vercel configuration:

- ✅ `vercel.json` - Vercel deployment settings
- ✅ `.vercelignore` - Files to exclude from deployment
- ✅ `package.json` - Build scripts configured
- ✅ `vite.config.ts` - Vite build configuration
- ✅ Vercel Analytics integrated in `src/main.tsx`

## Logs to Check

When troubleshooting, always check these logs:

1. **Vercel Deployment Logs**
   - Dashboard → Deployments → Click deployment → View logs
   - Look for: Build errors, runtime errors, warnings

2. **GitHub Actions** (if any)
   - Repository → Actions tab
   - Check for failed workflows

3. **Browser Console**
   - F12 → Console tab
   - Look for: API errors, network failures, JavaScript errors

4. **Vercel Function Logs** (if using)
   - Dashboard → Functions tab
   - Real-time logs for serverless functions

## Expected Timeline

After making changes in Lovable:
- GitHub commit: ~30 seconds
- Vercel deployment starts: ~1-2 minutes
- Build completion: ~2-5 minutes
- Live update: Immediate after build

Total time: **3-7 minutes** from Lovable change to live update

If it takes longer, something is wrong.

## Monitoring

Set up monitoring to catch issues early:

1. **Vercel Deployment Notifications**
   - Settings → Notifications
   - Enable: Deployment failed, Deployment ready

2. **GitHub Notifications**
   - Watch the repository
   - Get notified of new commits

3. **Vercel Analytics**
   - Monitor traffic and errors
   - Already integrated in the app

---

**Last Updated:** December 2024  
**Maintainer:** PTD Fitness Team
