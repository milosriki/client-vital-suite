# Vercel GitHub Actions Checks Setup Guide

## What to Add in Vercel Modal

When you see the **"Connect GitHub Actions"** modal in Vercel, follow these steps:

### Step 1: Expand "Send workflow updates to Vercel"

Click the arrow next to **"Send workflow updates to Vercel"** to expand it.

### Step 2: In "Select checks to add" Section

**Option A: Enter a GitHub SHA (Recommended for first time)**

1. Find a recent commit SHA that has run the workflow
2. Enter it in the **"Enter a GitHub SHA"** field (e.g., `d94b5f7`)
3. Click **"Search"** or wait for it to auto-detect checks

**Option B: Search for checks**

1. Use the **"Search for GitHub Checks"** field
2. Type: `AI Code Deployment` or `validate-and-deploy`
3. Select the checks you want

### Step 3: Select These Checks

Check these boxes (they will appear after entering a SHA or searching):

- ✅ **"AI Code Deployment - validate-and-deploy"** (or similar name)
  - This is the main validation job
  - Status: Required for production deployments

**Optional checks** (if they appear):

- ✅ **"TypeScript validation"** (if shown separately)
- ✅ **"ESLint validation"** (if shown separately)
- ✅ **"Build test"** (if shown separately)

### Step 4: Configure Check Names

The workflow uses this check name format:

```
AI Code Deployment - validate-and-deploy
```

If Vercel shows different names, you can:

1. **Use the exact name** shown in the search results
2. **Or update the workflow** to match what Vercel expects

### Step 5: Click "Add"

After selecting the checks, click the **"Add"** button at the bottom of the modal.

---

## How It Works

1. **GitHub Action runs** → Validates code, builds, pushes
2. **Action notifies Vercel** → Uses `vercel/repository-dispatch/actions/status@v1`
3. **Vercel waits** → Checks must pass before promoting to production
4. **Deployment proceeds** → Once checks pass, Vercel promotes the deployment

---

## Check Names Reference

The workflow sends these check names to Vercel:

| Check Name | When It Runs | Status |
|------------|--------------|--------|
| `AI Code Deployment - validate-and-deploy` | After all validations pass | ✅ Success |
| `AI Code Deployment - validate-and-deploy` | If validation fails | ❌ Failure |

---

## Troubleshooting

### "No configured checks found"

**Solution:**

1. Make sure you've run the workflow at least once
2. Enter a specific commit SHA that has workflow runs
3. Check GitHub Actions tab to see if workflow completed

### Checks not appearing

**Solution:**

1. Wait a few minutes after workflow completes
2. Try a different commit SHA
3. Make sure workflow uses `vercel/repository-dispatch/actions/status@v1`

### Check name mismatch

**Solution:**

1. Check what name Vercel expects (shown in search results)
2. Update the workflow file to match that name
3. Re-run the workflow

---

## Example: What You Should See

After entering a SHA and searching, you should see:

```
✅ AI Code Deployment - validate-and-deploy
   Status: success
   Commit: d94b5f7...
```

Then check the box and click **"Add"**.

---

## Next Steps

After adding checks:

1. ✅ Vercel will wait for checks to pass
2. ✅ Production deployments require checks to succeed
3. ✅ Preview deployments can proceed without checks (if configured)

To test:

1. Push a commit to `main` branch
2. Watch GitHub Actions workflow run
3. Check Vercel deployment - it should wait for checks
4. Once checks pass, deployment promotes to production

