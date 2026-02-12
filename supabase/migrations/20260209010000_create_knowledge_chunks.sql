-- Create knowledge_chunks table for precise RAG (Gemini 004 = 768 dimensions)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID, -- Optional foreign key if linking to a parent document table
    chunk_index INTEGER NOT NULL,
    filepath TEXT NOT NULL, -- Source file name
    content TEXT NOT NULL,
    embedding vector(768), -- Gemini Text Embedding 004
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast retrieval (IVFFlat)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding 
ON public.knowledge_chunks 
USING ivfflat (embedding vector_ip_ops) 
WITH (lists = 100);

-- Enable RLS
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Allow Service Role (Edge Function) full access
CREATE POLICY "Allow Service Role Full Access" ON public.knowledge_chunks
FOR ALL
USING (true)
WITH CHECK (true);

-- Similarity Search Function (RPC)
CREATE OR REPLACE FUNCTION match_knowledge_chunks (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  filepath TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kc.filepath,
    (kc.embedding <#> query_embedding) * -1 as similarity
  FROM knowledge_chunks kc
  WHERE 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
