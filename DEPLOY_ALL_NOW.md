# Deploy everything now (Vercel + Supabase)

Use these steps to push all frontend/API routes to Vercel and all Supabase Edge Functions in one session. No Docker required.

**Fast path (copy/paste from repo root):**
```bash
./check-cli-connections.sh \
  && vercel link \
  && vercel --prod \
  && curl -i https://client-vital-suite.vercel.app/api/health \
  && ./deploy-all-functions.sh
```
If any command fails, fix the reported auth/link issue, then rerun from the same root path so `/api/*` routes and all Edge Functions get included.

## 1) Pre-flight (1 minute)
- From repo root, verify CLIs and links:
  ```bash
  ./check-cli-connections.sh
  ```
  Fix any red/ERR items before deploying (login/link or install as prompted).

## 2) Deploy Vercel (frontend + /api/*)
- Ensure you are in the repo root and linked to `client-vital-suite` (the fast-path above already does this):
  ```bash
  vercel link
  vercel whoami
  ```
- Deploy the latest main to production:
  ```bash
  vercel --prod
  ```
- Quick health check after deploy:
  ```bash
  curl -i https://client-vital-suite.vercel.app/api/health
  ```

## 3) Deploy Supabase Edge Functions
- Ensure Supabase CLI is logged in and project is visible (project ref auto-detected):
  ```bash
  supabase projects list | head
  ```
- Deploy all functions with discovery and fail-fast checks:
  ```bash
  ./deploy-all-functions.sh
  ```

## 4) Verify live status (spot checks)
- Supabase functions: check dashboard or run one function curl with anon key.
- Vercel routes: hit a live route like `/api/events/health` or `/api/webhook/backfill`.
- Frontend: open the production URL and validate key dashboards load with real data.

## Notes
- The last Vercel deployment was ~10 hours ago; the commands above redeploy everything from your current branch.
- Run Vercel and Supabase steps from the repo root so `/api` routes and Edge Functions are included.
