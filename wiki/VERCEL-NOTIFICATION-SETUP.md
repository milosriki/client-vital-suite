# Vercel Notification Setup for GitHub Actions

## Overview

The GitHub Actions workflow now includes a step to notify and check Vercel deployment status after code is pushed.

## What Was Added

### In `.github/workflows/ai-code-deploy.yml`

Added a **"Notify Vercel"** step that:

1. ✅ Logs that Vercel will auto-deploy the pushed commit
2. ✅ Checks the last 10 Vercel deployments (if tokens are configured)
3. ✅ Shows deployment status and URLs
4. ✅ Continues even if Vercel check fails (non-blocking)

## Required Secrets (Optional but Recommended)

To enable full Vercel deployment checking, add these secrets in GitHub:

**Settings → Secrets and variables → Actions → New repository secret**

1. **VERCEL_TOKEN**
   - Get from: <https://vercel.com/account/tokens>
   - Create a new token with read access to deployments
   - Used to check deployment status

2. **VERCEL_PROJECT_ID**
   - Found in: `.vercel/project.json` (already in repo)
   - Current value: `prj_8ufqRnF5PCmzd7ep9HPvqPMQC2lA`
   - Or get from: Vercel Dashboard → Project Settings

## How It Works

1. **Code Push**: When workflow pushes code, Vercel automatically starts deployment
2. **Notification Step**: Waits 15 seconds, then checks Vercel API
3. **Status Check**: Fetches last 10 deployments and shows status
4. **Non-Blocking**: If tokens aren't set, workflow continues (just logs info)

## Workflow Location

The notification step is added **after** the "Commit and push" step and **before** "Notify Supabase - Success".

```yaml
- name: Commit and push
  # ... pushes code ...

- name: Notify Vercel
  # ... checks deployment status ...

- name: Notify Supabase - Success
  # ... notifies Supabase ...
```

## Testing

To test the notification:

1. Trigger the workflow via `repository_dispatch`:

   ```bash
   curl -X POST https://api.github.com/repos/milosriki/client-vital-suite/dispatches \
     -H "Authorization: token YOUR_GITHUB_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "event_type": "ai-deploy",
       "client_payload": {
         "files": [],
         "commit_message": "Test Vercel notification"
       }
     }'
   ```

2. Check workflow logs for:
   - ✅ "Code pushed to repository"
   - ✅ "Vercel will auto-deploy this commit"
   - ✅ "Recent deployments:" (if tokens set)

## Viewing Last 10 Deployments

The step shows the last 10 Vercel deployments with:

- Deployment URL
- State (READY, BUILDING, ERROR, etc.)
- Created timestamp

Example output:

```
📊 Recent deployments:
  • client-vital-suite.vercel.app - READY - 2025-01-20T10:30:00Z
  • client-vital-suite-git-main.vercel.app - READY - 2025-01-20T10:25:00Z
  ...
```

## Notes

- **Vercel auto-deploys** on push - no manual trigger needed
- The notification step is **informational only** - it doesn't trigger deployments
- If secrets aren't set, workflow still works (just skips API check)
- Step uses `continue-on-error: true` so failures don't block the workflow
