-- Remove n8n_base_url column from app_settings table
-- n8n is no longer used - all workflows are handled by Supabase Edge Functions

ALTER TABLE public.app_settings DROP COLUMN IF EXISTS n8n_base_url;
