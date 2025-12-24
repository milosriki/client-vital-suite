-- ============================================
-- FIX: Rename embeddings → embedding column
-- The remote DB has 'embeddings' but code expects 'embedding'
-- ============================================

-- Only rename if the old column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agent_memory' AND column_name = 'embeddings'
    ) THEN
        ALTER TABLE agent_memory RENAME COLUMN embeddings TO embedding;
    END IF;
END $$;

-- Drop old index if exists
DROP INDEX IF EXISTS idx_agent_memory_embedding;

-- Create index on correct column name
CREATE INDEX IF NOT EXISTS idx_agent_memory_embedding 
ON agent_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
