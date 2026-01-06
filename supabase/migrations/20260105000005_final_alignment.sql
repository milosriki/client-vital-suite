-- Final Alignment: Add owner_name to client_health_scores
-- This allows tracking Setters (Setters) against client health outcomes.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_health_scores' AND column_name = 'owner_name') THEN
        ALTER TABLE public.client_health_scores ADD COLUMN owner_name TEXT;
    END IF;
END $$;
