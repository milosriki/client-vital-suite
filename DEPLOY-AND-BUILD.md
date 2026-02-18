# PTD Fitness — Next Build Tasks

## Context
This is a Next.js (Vite) + Supabase fitness business management platform.
- Repo: `/Users/milosvukovic/client-vital-suite`
- Supabase project: `ztjndilxurtsfqdsvfds`
- Vercel team: `team_k2pQynzJNHrOBWbIDzK5NX4U`

Two new pages were just built: `/daily-ops` and `/client-activity`. 
Data comes from `aws_ops_snapshot`, `client_packages_live`, and `training_sessions_live` Supabase tables (synced from AWS RDS via `scripts/sync-aws-to-supabase.cjs`).

## Tasks

- [ ] Deploy to Vercel production: `npx vercel deploy --prod --yes --scope team_k2pQynzJNHrOBWbIDzK5NX4U`
- [ ] Verify the build succeeds with zero TypeScript errors
- [ ] After deploy, verify the production URL responds (curl the Vercel URL)
- [ ] Build a **Session Depletion Alert** edge function at `supabase/functions/check-session-depletion/index.ts` that: reads `client_packages_live` where `depletion_priority IN ('CRITICAL','HIGH')` and `future_booked = 0`, generates alert records in a new `session_depletion_alerts` table (create via the setup-tables edge function pattern — use `SUPABASE_DB_URL` env + postgres.js import), with fields: `id uuid PK, client_name, client_phone, client_email, package_id, remaining_sessions, last_coach, priority ('CRITICAL'|'HIGH'), alert_status ('pending'|'contacted'|'renewed'|'churned'), created_at, updated_at`. Deploy it: `npx supabase functions deploy check-session-depletion --project-ref ztjndilxurtsfqdsvfds --no-verify-jwt`
- [ ] Build a **Renewal Projections** component — add a new tab "Renewals" to the existing `/client-activity` page showing: clients sorted by `days_until_depleted` ASC, projected renewal date, projected revenue (package_value), pipeline total. Use the data already in `client_packages_live`.
- [ ] Ensure `npm run build` passes with zero errors after all changes
- [ ] Git commit all changes with conventional commit message and push to origin
