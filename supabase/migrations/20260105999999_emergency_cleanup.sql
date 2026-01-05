-- One-time cleanup of error storm
DELETE FROM public.sync_errors WHERE resolved_at IS NULL;
