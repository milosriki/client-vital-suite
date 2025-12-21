# CLI Connection Check (Vercel + Supabase)

Run this helper from the repo root to confirm you have the right CLIs installed, logged in, and linked to the correct projects:

```bash
./check-cli-connections.sh
```

What it does:

1. Verifies the binaries exist and prints their versions.
2. Checks Vercel authentication (`vercel whoami`) and whether the repo is linked (`vercel link --confirm`).
3. Checks Supabase authentication (`supabase projects list`), confirms the `project_id` in `supabase/config.toml` exists in your account, and attempts to list Edge Functions to confirm visibility.

If a step fails, it prints the exact command to fix it (e.g., `vercel login`, `vercel link`, or `supabase login`), records the issue, and exits **non-zero** with a short summary so CI or shell scripts can catch missing setup.
