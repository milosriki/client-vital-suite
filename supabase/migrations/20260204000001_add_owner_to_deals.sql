-- Add owner_id to deals table for Setter attribution
-- This links the HubSpot Deal Owner (Setter) to the deal in Supabase

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'owner_id') THEN
        ALTER TABLE public.deals ADD COLUMN owner_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_deals_owner_id ON public.deals(owner_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'owner_name') THEN
        ALTER TABLE public.deals ADD COLUMN owner_name TEXT;
    END IF;
END $$;
