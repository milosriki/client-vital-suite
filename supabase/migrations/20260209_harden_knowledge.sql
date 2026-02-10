-- 🛡️ HARDENING: knowledge_chunks (RLS & Maintenance)

-- 1. RLS POLICY: Allow "Authenticated" users (Dashboard) to READ chunks
-- This is critical for the "Brain Visualization" frontend.
CREATE POLICY "Allow Authenticated Read" ON public.knowledge_chunks
FOR SELECT
USING (auth.role() = 'authenticated');

-- 2. MAINTENANCE: Function to optimize table after migration
-- This should be run after the "Wipe & Rebuild" phase.
CREATE OR REPLACE FUNCTION maintenance_knowledge_chunks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reclaim storage and optimize indices
  VACUUM ANALYZE public.knowledge_chunks;
END;
$$;
