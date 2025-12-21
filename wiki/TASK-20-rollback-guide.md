# Task 20: Rollback / Emergency Procedures

## Context
If something breaks, how do we fix it?

## Actions
1. **Database**: Run `DROP TABLE sync_logs;` etc.
2. **Code**: `git revert <commit-hash>`.
3. **Functions**: Redeploy previous versions via Supabase CLI.
