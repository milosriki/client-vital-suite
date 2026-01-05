-- Add assigned_coach to leads table to match truth mapping
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'assigned_coach') THEN
        ALTER TABLE public.leads ADD COLUMN assigned_coach TEXT;
    END IF;
END $$;
