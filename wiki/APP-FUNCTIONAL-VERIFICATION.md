# Full App Functional Verification (Vercel + Supabase + UI)

This checklist covers the **whole app logic** (frontend pages, `/api` routes, Supabase Edge Functions, and the in-app agent)**.** Run it locally where you have credentials; this workspace cannot directly hit live services.
* ✅ in the CLI or docs = good/green, ❌/**[ERR]**/**red** = a blocker to fix before assuming the UI works.
* If you see red for secrets or functions, resolve it (login/link/redeploy) before testing the browser; otherwise some pages will 404 or show empty data.

## 1) Fast pre-flight (60 seconds)
- `./check-cli-connections.sh` – confirms Vercel/Supabase CLIs are installed, authenticated, and linked to the right project refs.
- `curl -i https://client-vital-suite.vercel.app/api/health` – expect `{"status":"ok"}`.
- `supabase functions list` – expect 60+ Edge Functions to show; if the project ref is missing, re-run `supabase link --project-ref <ref>`.

## 2) Backend sanity (Vercel `/api`)
From repo root:
- `vercel whoami` – verify you are logged in as the intended Vercel user/team.
- `vercel link` – ensure the repo is linked before deploying so `/api` routes are included.
- `vercel --prod` – redeploy frontend + `/api` if any route is `NOT_FOUND`.
- Spot-check routes:
  - `/api/health` → `{"status":"ok"}`
  - `/api/events/your-event` → 200/404 depending on the event name, but should not be `NOT_FOUND` for the route itself.
  - `/api/events/batch` and `/api/webhook/backfill` should return structured JSON or validation errors, not 404s.

## 3) Data plane (Supabase functions)
- `supabase projects list` – confirm the configured `project_id` is visible under your account.
- `./deploy-all-functions.sh` – re-deploy the 60+ Edge Functions; script now fails fast if credentials or the project ref are missing.
- `supabase functions status <fn>` (pick a few high-traffic functions like `stripe-webhook`, `hubspot-command-center`) to ensure they are deployed and reachable.

## 4) Frontend pages & agent flows
Start locally for fast iteration (uses your env vars):
- `npm install` (once), then `npm run dev` and open `http://localhost:5173`.
- Verify key pages render with real data:
  - Dashboards (main KPIs load, no auth errors in console)
  - Payments/Stripe views (transactions visible, no 401/404 from `/api`)
  - Calls/Setters pages (call lists load; filters work)
  - Any agent/assistant panel answers domain questions (e.g., "Best Stripe payments this week?", "Summarize yesterday's setter calls").
- If the UI stalls or shows placeholders, check the browser console for `/api` failures; redeploy Vercel/Supabase as needed.

## 5) Alignment + common fixes
- **Wrong project link**: `vercel link` or `supabase link --project-ref <ref>` from repo root, then redeploy.
- **Env drift**: sync Vercel env vars via `vercel env pull .env.local`; ensure Supabase env is consistent with `supabase/config.toml`.
- **Partial deploys**: always deploy from repo root so `/api` functions are packaged; re-run `vercel --prod` after linking.

## 6) What cannot be verified here
This workspace has no live credentials or browser access, so the above steps must be run on your machine to confirm production status. The checklist keeps Vercel, Supabase, and the UI in lockstep once those commands succeed.
