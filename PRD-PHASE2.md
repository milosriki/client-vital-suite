# PRD: Phase 2 — Sales Intelligence & Enhanced Pages

## Context
PTD Fitness dashboard at `/Users/milosvukovic/client-vital-suite`. 
Next.js (Vite) + Supabase + shadcn/ui + Tailwind. 
Data sources: `client_packages_live`, `training_sessions_live`, `aws_ops_snapshot`, `session_depletion_alerts`, `deals`, `contacts`, `call_records`, `daily_business_metrics` tables in Supabase.
Use `supabase` from `@/integrations/supabase/client`. Cast custom tables as `never`.
Use existing `lazyWithRetry` pattern for lazy routes (see src/main.tsx).
Use existing shadcn/ui components from `@/components/ui/*`.

## Tasks

- [x] Build an **Alert Center** page at `/alert-center` — reads from `session_depletion_alerts` table (anon readable). Shows all alerts in a table with columns: Priority (CRITICAL red badge / HIGH orange badge), Client Name, Phone (clickable tel: link), Remaining Sessions, Last Coach, Status (pending/contacted/renewed/churned as colored badges), Created date. Add filter by status and priority. Add action buttons to update status (PATCH via supabase client with service key — for now just show the buttons, actual update needs auth). Add the route to main.tsx with lazyWithRetry and add "Alert Center" to Navigation.tsx with AlertTriangle icon in MAIN group.

- [x] Build a **Setter Command Center** page at `/setter-command-center` — reads from `call_records` table. Shows: (1) Top card row with KPIs: Total Calls Today, Avg Call Duration, Connection Rate, Calls Per Setter. (2) Setter Leaderboard table: group call_records by caller_name for last 30 days, show total calls, connected calls, avg duration, connection rate. (3) Speed-to-Lead section: for each call_record with a matching lead (join contacts on phone), show time from contact.created_at to first call_record. Add route + nav item with Phone icon.

- [x] Enhance the **CommandCenter** page — add a "Daily Ops" quick-view card that shows sessions_today, packages_critical, clients_decreasing from the `aws_ops_snapshot` table (latest row). This should be a small summary card linking to /daily-ops for full view.

- [x] Ensure `npm run build` passes with zero TypeScript errors after ALL changes

- [ ] Run `git add -A && git commit -m "feat: Alert Center + Setter Command Center + CommandCenter enhancement" && git push`
