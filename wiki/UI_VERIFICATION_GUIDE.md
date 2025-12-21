# UI Verification Guide

This workspace cannot directly open the deployed UI or send authenticated UI requests because it lacks project credentials and browser access. Use the checklist below on your machine to confirm the live experience works end-to-end (frontend, Vercel API routes, Supabase-backed data) and that the agent can answer domain questions like Stripe payments or call summaries.

## Quick checks (1–2 minutes)
1. **CLI sanity**
   - `./check-cli-connections.sh` – confirms Vercel/Supabase CLIs are installed, logged in, and linked to the right projects.
2. **Vercel API health**
   - `curl -i https://client-vital-suite.vercel.app/api/health` – should return `{"status":"ok"}`.
3. **Supabase visibility**
   - `supabase functions list` – should show the 60+ Edge Functions that power data sync.

## UI & agent behavior
1. Open the production app in a browser while logged in: `https://client-vital-suite.vercel.app`.
2. Verify key pages load with real data (dashboards, calls, payments). Missing data typically points to Supabase credentials or sync jobs.
3. Use the in-app agent to ask domain questions such as:
   - "What are the best Stripe payment insights this week?"
   - "Summarize yesterday's setter calls."
   - If the agent fails or responds with gaps, cross-check that `/api` routes respond (step 2 above) and that Supabase functions are running.

## If something is broken
- **Vercel**: `vercel link` (from repo root) then `vercel --prod` to redeploy frontend + `/api`.
- **Supabase**: Ensure `PROJECT_REF` matches `supabase/config.toml`, then run `./deploy-all-functions.sh`.
- Rerun the quick checks to confirm the fixes.
