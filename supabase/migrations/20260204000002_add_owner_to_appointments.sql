-- Add owner_id to appointments table for Setter/Closer attribution
-- This links the HubSpot Meeting Owner to the appointment in Supabase

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'owner_id') THEN
        ALTER TABLE public.appointments ADD COLUMN owner_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_appointments_owner_id ON public.appointments(owner_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'owner_name') THEN
        ALTER TABLE public.appointments ADD COLUMN owner_name TEXT;
    END IF;
END $$;
