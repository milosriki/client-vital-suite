-- Fix 1: Add 'lost' to deal_status enum
ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'lost';

-- Fix 2: Add unique constraint on provider_call_id for HubSpot call upsert
ALTER TABLE call_records ADD CONSTRAINT call_records_provider_call_id_unique UNIQUE (provider_call_id);