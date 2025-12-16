# Agent Capabilities for Fixing and Deploying

This repository already includes helper scripts for validating CLI setup (see `check-cli-connections.sh`) and deploying Supabase Edge Functions (see `deploy-all-functions.sh`). Here is what I can do to help you get fixes shipped and deployed:

- **Diagnose & patch code**: review failing areas, make targeted code changes, and keep diffs small and well-documented.
- **Run local checks**: execute lint/tests or the CLI helper (`./check-cli-connections.sh`) to verify Vercel/Supabase logins and project linkage before deployment.
- **Prepare deployments**: ensure `/api` serverless routes are included when deploying from the repo root and confirm `supabase/functions` are discoverable for Edge deployments.
- **Update scripts/docs**: extend or fix deployment scripts and add concise runbooks so you can repeat the steps locally.
- **Surface blockers early**: when a required CLI is missing or mis-linked, report the exact command to remediate and exit non-zero so CI or shell scripts catch the issue.
- **Explain full capabilities and data flow**: see `CAPABILITIES_AND_DATA_FLOW.md` for how Stripe forensics, HubSpot sync, call intelligence, RAG memory, and proactive agents fit together without removing any functions.

If you want me to proceed with a deployment from here, share which target (Vercel or Supabase) to run first and whether to use production settings; I can then run the existing helpers to validate authentication and project linkage before executing the deploy commands.
