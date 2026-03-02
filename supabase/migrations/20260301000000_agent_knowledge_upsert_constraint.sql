-- Add unique constraint on (source, title) for agent_knowledge
-- Enables upsert deduplication when re-ingesting findings/plans
DO $$
BEGIN
  -- Remove duplicates first (keep the newest row per source+title)
  DELETE FROM public.agent_knowledge a
  USING public.agent_knowledge b
  WHERE a.source = b.source
    AND a.title = b.title
    AND a.id < b.id;

  -- Create unique index if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'agent_knowledge_source_title_unique'
  ) THEN
    CREATE UNIQUE INDEX agent_knowledge_source_title_unique
    ON public.agent_knowledge (source, title)
    WHERE source IS NOT NULL AND title IS NOT NULL;
  END IF;
END $$;
