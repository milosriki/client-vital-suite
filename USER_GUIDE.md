# User Guide — Live Workflows

## Admin Workflow
1. Sign in to the dashboard (Vercel-hosted UI).
2. Review company KPIs and at-risk clients (Supabase real-time data).
3. Trigger interventions for Yellow/Red zone clients.
4. Monitor marketing performance and ROAS; adjust campaigns.
5. Review coach performance and configure automations.

## Coach Workflow
1. Open assigned clients and health scores.
2. Review recommended interventions; execute actions.
3. Log session notes and update statuses.
4. Track personal performance and close feedback loops.

## Setter Workflow
1. View new leads and pipeline stages.
2. Call leads and record outcomes; monitor conversion rates.
3. Track bookings and performance.

## Agent Interactions
- Ask for Stripe forensics, HubSpot sync status, call summaries, proactive insights, or daily summaries.
- Agents pull live data via tools; no mock responses.

## Verification Before Use
- Run `./check-cli-connections.sh` to confirm Vercel/Supabase auth and project linkage.
- Curl `/api/health` on Vercel; list Supabase functions via `supabase functions list`.
- Redeploy from repo root (`vercel --prod`, `./deploy-all-functions.sh`) if linkage/auth issues are detected.
