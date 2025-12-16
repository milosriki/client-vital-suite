# Sync & Deployment Verification Status

**TL;DR:** I can't directly verify your live Vercel or Supabase connections from this environment because credentials are not available here. Use the checklist below to confirm everything is linked and deployed correctly on your machine.

## Quick verification steps (run locally from repo root)
1. **Check CLIs & linkage (1 command):**
   ```bash
   ./check-cli-connections.sh
   ```
   *Pass criteria*: both Vercel and Supabase CLIs installed, logged in, project linked, Supabase project ref visible, edge functions list succeeds.

2. **Confirm Vercel `/api` routes respond:**
   ```bash
   curl -i https://client-vital-suite.vercel.app/api/health
   curl -i https://client-vital-suite.vercel.app/api/events/Purchase
   ```
   *Pass criteria*: HTTP 200 with JSON body; no `NOT_FOUND`.

3. **Spot-check Supabase functions visibility:**
   ```bash
   supabase functions list
   ```
   *Pass criteria*: lists ~65 edge functions; no auth/link errors.

4. **If anything is missing, redeploy from root:**
   ```bash
   vercel --prod
   ```
   *Pass criteria*: deployment succeeds with `/api` folder included.

## Why I can't verify directly here
- This workspace does not have Vercel or Supabase credentials, so `vercel whoami`, `supabase projects list`, and live `curl` checks would fail.
- The helper script records any missing auth/linkage and exits non-zero so you can see exactly what to fix.

## What “fully synced” looks like
- `./check-cli-connections.sh` exits **0** with no `[ERR]` lines.
- `curl https://client-vital-suite.vercel.app/api/health` returns `{ "status": "ok" }`.
- `supabase functions list` shows your functions, and `supabase/config.toml` contains the correct `project_id`.
- Latest `vercel --prod` deployment was run from the repo root (so `/api` is packaged) and targets `client-vital-suite`.

If any step fails, re-run the suggested login/link commands printed by the helper, then redeploy.
